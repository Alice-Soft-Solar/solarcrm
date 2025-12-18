'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { LoadingSpinner } from '@/components/ui';
import LeadForm, { LeadFormData } from '@/components/leads/LeadForm';

interface Profile {
  id: string;
  full_name: string;
  company_id: string;
  roles: {
    role_name: string;
  } | {
    role_name: string;
  }[];
}

interface ExecutiveOption {
  id: string;
  full_name: string;
}

export default function NewLeadPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [executives, setExecutives] = useState<ExecutiveOption[]>([]);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = useMemo(() => createClient(supabaseUrl, supabaseKey), [supabaseUrl, supabaseKey]);

  const roleName =
    typeof profile?.roles === 'object' && profile?.roles && 'role_name' in profile.roles
      ? profile.roles.role_name
      : Array.isArray(profile?.roles) && profile.roles[0]
      ? profile.roles[0].role_name
      : '';

  const isAdmin = roleName === 'Admin' || roleName === 'Super Admin';
  const isSales = roleName === 'Sales';
  const isSalesLead = roleName === 'salesLead';

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        const { data: profileData, error } = await supabase
          .from('profiles')
          .select(`
            id,
            full_name,
            company_id,
            roles (role_name)
          `)
          .eq('id', user.id)
          .single();

        if (error || !profileData) {
          console.error('Error fetching profile for leads:', error);
          router.push('/dashboard');
          return;
        }

        const roles = profileData.roles as { role_name: string } | { role_name: string }[];
        const currentRoleName = Array.isArray(roles) ? roles[0]?.role_name : roles?.role_name;
        const allowedRoles = ['Sales', 'Admin', 'Super Admin', 'salesLead'];
        if (!currentRoleName || !allowedRoles.includes(currentRoleName)) {
          alert('You do not have permission to access leads.');
          router.push('/dashboard');
          return;
        }

        setProfile({
          ...profileData,
          roles: Array.isArray(roles) ? roles : [roles],
        });

        // Fetch executives via API route to bypass RLS and ensure proper data fetching
        if (currentRoleName === 'Admin' || currentRoleName === 'Super Admin' || currentRoleName === 'salesLead') {
          try {
            const execResponse = await fetch('/api/leads/executives', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                companyId: profileData.company_id,
                roleName: currentRoleName,
                currentUserId: user.id,
                currentUserFullName: profileData.full_name,
              }),
            });

            if (execResponse.ok) {
              const execData = await execResponse.json();
              if (execData.success && execData.executives) {
                setExecutives(execData.executives);
        } else {
                console.error('Failed to fetch executives:', execData.error);
              }
          } else {
              const errorData = await execResponse.json();
              console.error('Error fetching executives:', errorData.error);
            }
          } catch (fetchError) {
            console.error('Exception fetching executives:', fetchError);
          }
        }

        // Location fetching is now handled by LeadForm component
      } catch (err) {
        console.error('Error initializing lead form:', err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [router, supabase]);

  const handlePhotoChange = (file: File | null) => {
    setPhotoFile(file);
    if (file) {
      setPhotoPreview(URL.createObjectURL(file));
    } else {
      setPhotoPreview(null);
    }
  };

  const handleSubmit = async (formData: LeadFormData, _photoFile: File | null) => {
    // Photo is tracked separately in photoFile state
    if (!profile) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const fd = new FormData();
      fd.append('userId', user.id);
      fd.append('companyId', profile.company_id);
      fd.append('roleName', roleName || '');

      fd.append('customer_name', formData.customer_name);
      fd.append('mobile_number', formData.mobile_number);
      fd.append('power_bill', formData.power_bill);
      fd.append('units', formData.units);
      fd.append('address', formData.address);
      fd.append('status', formData.status);
      fd.append('visit_status', formData.visit_status);
      fd.append('referrer_name', formData.referrer_name);
      fd.append('latitude', formData.latitude);
      fd.append('longitude', formData.longitude);

      if (isAdmin) {
        fd.append('executive_id', formData.executive_id);
        const executive = executives.find((e) => e.id === formData.executive_id);
        fd.append('executive_name', executive?.full_name || '');
      } else if (isSalesLead) {
        // Sales Lead: creator_id is always their own ID, but they can select executive for assignment
        fd.append('executive_id', user.id); // creator_id = Sales Lead's own ID
        fd.append('executive_name', profile.full_name);
        // Note: executive_id from form is for assignment/tracking, but creator_id remains Sales Lead's ID
      } else {
        fd.append('executive_id', user.id);
        fd.append('executive_name', profile.full_name);
      }

      // Photo is tracked in state via onPhotoChange callback
      if (photoFile) {
        fd.append('photo', photoFile);
      }

      const res = await fetch('/api/leads/create', {
        method: 'POST',
        body: fd,
      });

      const json = await res.json();
      if (!res.ok) {
        console.error('Create lead error:', json);
        alert(json.error || 'Failed to create lead');
        return;
      }

      // Redirect based on role:
      // - Admin/Super Admin/Sales Lead: Go to success page first, then they can navigate to view leads
      // - Sales: Direct redirect to view leads (no success page)
      if (isAdmin || isSalesLead) {
        const leadId = json.lead?.id || '';
        router.push(`/dashboard/leads/success?leadId=${leadId}`);
      } else {
        // Sales role: direct redirect to view leads
      router.push('/dashboard/leads');
      }
    } catch (err: any) {
      console.error('Unexpected error creating lead:', err);
      alert(err.message || 'Unexpected error creating lead');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !profile) {
    return <LoadingSpinner fullScreen text="Loading lead form..." />;
  }

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">Create New Lead</h1>
          <p className="text-sm text-foreground opacity-70">
            Capture customer details, referrer, selfie photo, and location.
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-6 shadow-sm">
          <LeadForm
            initialData={{
              executive_id: isSales ? profile.id : '',
            }}
            executives={executives}
            isAdmin={isAdmin || isSalesLead}
            onPhotoChange={handlePhotoChange}
            photoPreview={photoPreview}
            onSubmit={handleSubmit}
            saving={saving}
            submitLabel="Save Entry"
          />
        </div>
      </main>
    </DashboardLayout>
  );
}



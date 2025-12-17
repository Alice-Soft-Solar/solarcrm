'use client';

import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { LoadingSpinner, Button } from '@/components/ui';
import LeadForm, { LeadFormData } from '@/components/leads/LeadForm';

interface Lead {
  id: string;
  created_at: string;
  company_id: string;
  creator_id: string;
  customer_name: string;
  customer_phone: string | number;
  power_bill: number | null;
  status: string;
  power_units: number | null;
  customer_address: string;
  referer: string;
  photo_url: string | null;
  latitude: string | null;
  longitude: string | null;
  visit_status: string;
  executive_name?: string | null;
}

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

export default function ViewLeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('');
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  // editForm state removed - now using LeadForm component
  const [saving, setSaving] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = useMemo(() => createClient(supabaseUrl, supabaseKey), [supabaseUrl, supabaseKey]);

  const roleName =
    typeof profile?.roles === 'object' && profile?.roles && 'role_name' in profile.roles
      ? profile.roles.role_name
      : Array.isArray(profile?.roles) && profile.roles[0]
      ? profile.roles[0].role_name
      : '';

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
          console.error('Error fetching profile:', error);
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
      } catch (err) {
        console.error('Error:', err);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [router, supabase]);

  useEffect(() => {
    if (!profile) return;

    fetchLeads();
  }, [profile, searchQuery, selectedDateRange, pagination.page]);

  const fetchLeads = async () => {
    if (!profile) return;

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch('/api/leads/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          companyId: profile.company_id,
          roleName: roleName,
          page: pagination.page,
          limit: pagination.limit,
          search: searchQuery,
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        console.error('Error fetching leads:', json);
        alert(json.error || 'Failed to fetch leads');
        return;
      }

      setLeads(json.leads || []);
      setPagination(prev => ({
        ...prev,
        total: json.pagination?.total || 0,
        totalPages: json.pagination?.totalPages || 0,
      }));
    } catch (err: any) {
      console.error('Error fetching leads:', err);
      alert(err.message || 'Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
    const displayHours = date.getHours() % 12 || 12;
    return `${day}/${month}/${year} ${displayHours}:${minutes} ${ampm}`;
  };

  const formatPhoneNumber = (phone: string | number) => {
    if (!phone) return 'N/A';
    const phoneStr = String(phone);
    // Format as +91XXXXXXXXXX if it's a 10-digit number
    if (/^\d{10}$/.test(phoneStr)) {
      return `+91${phoneStr}`;
    }
    return phoneStr;
  };

  const handlePhoneCall = (phone: string | number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!phone) return;
    const phoneStr = String(phone);
    const cleanPhone = phoneStr.replace(/[^0-9]/g, '');
    window.location.href = `tel:${cleanPhone}`;
  };

  const handleWhatsApp = (phone: string | number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!phone) return;
    const phoneStr = String(phone);
    const cleanPhone = phoneStr.replace(/[^0-9]/g, '');
    // Remove leading +91 or 91 if present, then add 91
    const whatsappNumber = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
    const message = encodeURIComponent('Hi, this is from SolarGM');
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');
  };

  const handleGoogleMaps = (latitude: string | null, longitude: string | null, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!latitude || !longitude) {
      alert('Location coordinates not available');
      return;
    }
    window.open(`https://www.google.com/maps?q=${latitude},${longitude}`, '_blank');
  };

  const handleView = (lead: Lead, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedLead(lead);
    setIsViewModalOpen(true);
  };

  // Get image URL from Supabase storage - handles both public URLs and storage paths
  // Images are stored in 'work-order-docs' bucket, not 'lead-photos'
  const getImageUrl = async (photoUrl: string | null): Promise<string | null> => {
    if (!photoUrl) return null;
    
    // If it's already a full URL, check which bucket it's from and extract path
    if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
      // Check if it's a Supabase storage URL
      if (photoUrl.includes('supabase.co/storage/v1/object/')) {
        // Try to extract bucket and path from URL
        // Format examples:
        // - https://xxx.supabase.co/storage/v1/object/public/work-order-docs/path/to/file.jpg
        // - https://xxx.supabase.co/storage/v1/object/sign/work-order-docs/path/to/file.jpg
        // - https://xxx.supabase.co/storage/v1/object/public/lead-photos/path/to/file.jpg
        
        let bucket = 'work-order-docs'; // Default to work-order-docs as that's where images actually are
        let storagePath: string | null = null;
        
        // Check for work-order-docs bucket first (where images actually are)
        const workOrderDocsMatch = photoUrl.match(/\/object\/(?:public|sign)\/work-order-docs\/(.+?)(?:\?|$)/);
        if (workOrderDocsMatch && workOrderDocsMatch[1]) {
          bucket = 'work-order-docs';
          storagePath = decodeURIComponent(workOrderDocsMatch[1]);
        } 
        // Check for lead-photos bucket (legacy)
        else {
          const leadPhotosMatch = photoUrl.match(/\/object\/(?:public|sign)\/lead-photos\/(.+?)(?:\?|$)/);
          if (leadPhotosMatch && leadPhotosMatch[1]) {
            bucket = 'lead-photos';
            storagePath = decodeURIComponent(leadPhotosMatch[1]);
          }
        }
        
        if (storagePath) {
          try {
            // Generate signed URL (works for both public and private buckets)
            const { data: signedData, error: signedError } = await supabase.storage
              .from(bucket)
              .createSignedUrl(storagePath, 3600);
            
            if (!signedError && signedData?.signedUrl) {
              return signedData.signedUrl;
            }
          } catch (err) {
            console.warn(`Could not get signed URL from ${bucket}, using original URL:`, err);
          }
        }
      }
      // If it's already a signed URL or valid URL, return as-is
      return photoUrl;
    }

    // If it's a storage path (not a full URL), try both buckets
    // Try work-order-docs first (where images actually are)
    const buckets = ['work-order-docs', 'lead-photos'];
    
    for (const bucket of buckets) {
      try {
        // Try signed URL first (more reliable)
        const { data: signedData, error: signedError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(photoUrl, 3600);
        
        if (!signedError && signedData?.signedUrl) {
          return signedData.signedUrl;
        }

        // Fallback to public URL
        const { data: publicData } = supabase.storage
          .from(bucket)
          .getPublicUrl(photoUrl);
        
        if (publicData?.publicUrl) {
          return publicData.publicUrl;
        }
      } catch (err) {
        // Try next bucket
        continue;
      }
    }
    
    // If all attempts failed, return original URL
    return photoUrl;
  };

  // Pre-fetch image URLs for all leads immediately when leads are loaded
  useEffect(() => {
    const fetchImageUrls = async () => {
      const urlMap: Record<string, string> = {};
      const promises = leads.map(async (lead) => {
        if (lead.photo_url && !imageUrls[lead.id]) {
          try {
            const url = await getImageUrl(lead.photo_url);
            if (url) {
              urlMap[lead.id] = url;
            }
          } catch (err) {
            console.error(`Error fetching image for lead ${lead.id}:`, err);
          }
        }
      });
      
      await Promise.all(promises);
      
      if (Object.keys(urlMap).length > 0) {
        setImageUrls(prev => ({ ...prev, ...urlMap }));
      }
    };

    if (leads.length > 0) {
      fetchImageUrls();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads]);

  // Keep selectedLead in sync with leads array (for view modal)
  // This ensures the view modal shows updated data when leads array changes
  useEffect(() => {
    if (selectedLead && isViewModalOpen) {
      const updatedLead = leads.find(lead => lead.id === selectedLead.id);
      if (updatedLead && JSON.stringify(updatedLead) !== JSON.stringify(selectedLead)) {
        setSelectedLead(updatedLead);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, isViewModalOpen]);

  const handleImageClick = async (photoUrl: string | null, leadId: string) => {
    if (!photoUrl) return;
    
    // Get or use cached URL
    let imageUrl = imageUrls[leadId];
    if (!imageUrl) {
      imageUrl = await getImageUrl(photoUrl) || photoUrl;
      setImageUrls(prev => ({ ...prev, [leadId]: imageUrl }));
    }
    
    setSelectedImageUrl(imageUrl);
    setIsImageModalOpen(true);
  };

  // Get available visit status options based on current visit_status
  const getAvailableVisitOptions = (currentVisitStatus: string | null | undefined): string[] => {
    // Normalize the input: trim whitespace and handle null/undefined
    const current = (currentVisitStatus || 'First Visit').trim();
    
    // Case-insensitive comparison with normalized values
    const normalized = current.toLowerCase();
    
    if (normalized === 'first visit') {
      return ['Second Visit'];
    } else if (normalized === 'second visit') {
      return ['Third Visit'];
    } else if (normalized === 'third visit' || normalized.startsWith('third visit')) {
      // Already at third visit, no more options
      return [];
    }
    
    // Fallback: if somehow status is unknown, allow progression from First Visit
    return ['Second Visit'];
  };

  const handleEdit = (lead: Lead, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingLead(lead);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (lead: Lead) => {
    if (!confirm(`Are you sure you want to delete lead for ${lead.customer_name}?`)) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch('/api/leads/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lead_id: lead.id,
          userId: user.id,
          roleName: roleName,
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        console.error('Error deleting lead:', json);
        alert(json.error || 'Failed to delete lead');
        return;
      }

      alert('Lead deleted successfully');
      fetchLeads();
      if (isViewModalOpen) {
        setIsViewModalOpen(false);
      }
    } catch (err: any) {
      console.error('Error deleting lead:', err);
      alert(err.message || 'Failed to delete lead');
    }
  };

  const handleSaveEdit = async (formData: LeadFormData, _photoFile: File | null) => {
    if (!editingLead) return;

    setSaving(true);
    try {
      // Determine final status based on visit stage and current status
      let finalStatus = formData.status;
      let finalVisitStatus = formData.visit_status;

      // If third visit and still "Follow Up Required", auto-update to "Not Interested"
      if (formData.visit_status === 'Third Visit' && formData.status === 'Follow Up Required') {
        finalStatus = 'Not Interested';
        // Keep visit_status as "Third Visit" (don't change it)
        finalVisitStatus = 'Third Visit';
      }

      // Build update payload based on role
      const updatePayload: any = {
        lead_id: editingLead.id,
        visit_status: finalVisitStatus,
        status: finalStatus,
      };

      // Admin/Super Admin/Sales Lead can edit all fields
      if (roleName === 'Admin' || roleName === 'Super Admin' || roleName === 'salesLead') {
        updatePayload.customer_name = formData.customer_name;
        updatePayload.customer_phone = formData.mobile_number;
        updatePayload.power_bill = formData.power_bill;
        updatePayload.power_units = formData.units;
        updatePayload.customer_address = formData.address;
        updatePayload.referer = formData.referrer_name;
      }
      // Sales can only update status and visit_status
      // (already included in updatePayload)

      const response = await fetch('/api/leads/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      });

      const json = await response.json();
      if (!response.ok) {
        console.error('Error updating lead:', json);
        alert(json.error || 'Failed to update lead');
        return;
      }

      // Update the lead in the leads array immediately (optimistic update)
      const updatedLead: Lead = {
        ...editingLead,
        status: finalStatus,
        visit_status: finalVisitStatus,
        // Update other fields if Admin/Super Admin
        ...(roleName === 'Admin' || roleName === 'Super Admin' ? {
          customer_name: formData.customer_name,
          customer_phone: formData.mobile_number,
          power_bill: formData.power_bill ? parseFloat(formData.power_bill) : null,
          power_units: formData.units ? parseFloat(formData.units) : null,
          customer_address: formData.address,
          referer: formData.referrer_name,
        } : {}),
      };

      // Update leads array immediately
      setLeads(prevLeads => 
        prevLeads.map(lead => 
          lead.id === editingLead.id ? updatedLead : lead
        )
      );

      // Update selectedLead if it's the same lead being viewed (for view modal)
      if (selectedLead && selectedLead.id === editingLead.id) {
        setSelectedLead(updatedLead);
      }

      // Close edit modal and reset state
      setIsEditModalOpen(false);
      setEditingLead(null);

      // Show success message
      alert('Lead updated successfully');

      // Refresh leads list in background to ensure data consistency
      // This runs asynchronously so the UI updates immediately
      fetchLeads().catch(err => {
        console.error('Error refreshing leads after update:', err);
        // Don't show error to user as we've already updated state optimistically
      });
    } catch (err: any) {
      console.error('Error updating lead:', err);
      alert(err.message || 'Failed to update lead');
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = () => {
    fetchLeads();
  };

  const handleExportExcel = () => {
    // TODO: Implement Excel export
    alert('Excel export feature coming soon');
  };

  const handleExportPDF = () => {
    // TODO: Implement PDF export
    alert('PDF export feature coming soon');
  };

  // Generate date range options (last 30 days)
  const generateDateOptions = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  if (loading && !profile) {
    return <LoadingSpinner fullScreen text="Loading..." />;
  }

  if (!profile) {
    return null;
  }

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">View Leads</h1>
          <p className="text-sm text-foreground opacity-70">
            Manage and view all your leads in one place.
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search name, mobile, address..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="block w-full rounded-md border border-border bg-white px-4 py-2 text-sm text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleRefresh}
                variant="primary"
                size="sm"
                className="bg-accent hover:bg-accent-hover text-white px-4"
              >
                Refresh
              </Button>
              <Button
                onClick={handleExportExcel}
                variant="primary"
                size="sm"
                className="bg-accent hover:bg-accent-hover text-white px-4"
              >
                Excel
              </Button>
              <Button
                onClick={handleExportPDF}
                variant="primary"
                size="sm"
                className="bg-accent hover:bg-accent-hover text-white px-4"
              >
                Pdf
              </Button>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="overflow-x-auto">
            <div className="flex gap-2 min-w-max pb-2">
              {generateDateOptions().map((date) => {
                const dateObj = new Date(date);
                const isSelected = selectedDateRange === date;
                return (
                  <button
                    key={date}
                    onClick={() => {
                      setSelectedDateRange(isSelected ? '' : date);
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    className={`
                      whitespace-nowrap px-4 py-2 rounded-md text-sm font-medium transition-colors
                      ${isSelected
                        ? 'bg-accent text-white'
                        : 'bg-white border border-border text-foreground hover:bg-accent/10'
                      }
                    `}
                  >
                    {dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="bg-[#F8F9FA]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                    Time
                  </th>
                  {!isSales && (
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                      Executive
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                    Mobile
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                    Bill
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                    Units
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                    Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                    Visit Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                    Photo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                    Map
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={isSales ? 10 : 11} className="px-6 py-12 text-center text-sm text-foreground opacity-70">
                      {loading ? 'Loading leads...' : 'No leads found'}
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="hover:bg-zinc-50 transition-colors duration-150 cursor-pointer"
                      onClick={() => handleView(lead)}
                      onMouseEnter={() => setHoveredRowId(lead.id)}
                      onMouseLeave={() => setHoveredRowId(null)}
                    >
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">
                        {formatDate(lead.created_at)}
                      </td>
                      {!isSales && (
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">
                          {lead.executive_name || 'N/A'}
                        </td>
                      )}
                      <td className="px-6 py-4 text-sm text-foreground">
                        {lead.customer_name || 'N/A'}
                      </td>
                      <td 
                        className="whitespace-nowrap px-6 py-4 text-sm text-foreground"
                        onClick={(e) => handlePhoneCall(lead.customer_phone, e)}
                      >
                        <span className="hover:text-accent hover:underline cursor-pointer">
                          {formatPhoneNumber(lead.customer_phone)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground relative">
                        <div className="flex items-center gap-2">
                          <span>{lead.status || 'N/A'}</span>
                          {hoveredRowId === lead.id && (
                            <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleView(lead);
                                }}
                                className="p-1.5 rounded bg-accent hover:bg-accent-hover text-white transition-colors"
                                title="View"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4"
                fill="none"
                                  viewBox="0 0 24 24"
                stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePhoneCall(lead.customer_phone, e);
                                }}
                                className="p-1.5 rounded bg-accent hover:bg-accent-hover text-white transition-colors"
                                title="Call"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4"
                                  fill="none"
                viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleWhatsApp(lead.customer_phone, e);
                                }}
                                className="p-1.5 rounded bg-accent hover:bg-accent-hover text-white transition-colors"
                                title="WhatsApp"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGoogleMaps(lead.latitude, lead.longitude, e);
                                }}
                                className="p-1.5 rounded bg-accent hover:bg-accent-hover text-white transition-colors"
                                title="Map"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                  />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">
                        {lead.power_bill ? `₹${lead.power_bill}` : 'N/A'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">
                        {lead.power_units || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground max-w-xs truncate">
                        {lead.customer_address || 'N/A'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">
                        {lead.visit_status || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                        {lead.photo_url ? (
                          <div className="relative h-12 w-12">
                            <img
                              src={imageUrls[lead.id] || lead.photo_url}
                              alt="Lead photo"
                              className="h-12 w-12 rounded object-cover cursor-pointer border border-zinc-200 hover:opacity-80 transition-opacity"
                              onClick={() => handleImageClick(lead.photo_url, lead.id)}
                              onError={async (e) => {
                                const img = e.target as HTMLImageElement;
                                const currentSrc = img.src;
                                
                                // If we haven't tried to get the processed URL yet, try it
                                if (!imageUrls[lead.id] && lead.photo_url && currentSrc === lead.photo_url) {
                                  try {
                                    const processedUrl = await getImageUrl(lead.photo_url);
                                    if (processedUrl && processedUrl !== lead.photo_url) {
                                      img.src = processedUrl;
                                      setImageUrls(prev => ({ ...prev, [lead.id]: processedUrl }));
                                      return;
                                    }
                                  } catch (err) {
                                    console.error('Error processing image URL:', err);
                                  }
                                }
                                
                                // If all attempts failed, hide image and show fallback
                                img.style.display = 'none';
                                const fallback = img.nextElementSibling as HTMLElement;
                                if (fallback) {
                                  fallback.style.display = 'flex';
                                }
                              }}
                              onLoad={() => {
                                // Image loaded successfully, hide any fallback
                                const fallback = document.querySelector(`[data-lead-id="${lead.id}"] .image-fallback`) as HTMLElement;
                                if (fallback) {
                                  fallback.style.display = 'none';
                                }
                              }}
                            />
                            <span 
                              className="absolute inset-0 flex items-center justify-center text-foreground opacity-50 text-xs image-fallback"
                              style={{ display: 'none' }}
                              data-lead-id={lead.id}
                            >
                              N/A
                            </span>
                          </div>
                        ) : (
                          <span className="text-foreground opacity-50">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                        {lead.latitude && lead.longitude ? (
                          <button
                            onClick={() => handleGoogleMaps(lead.latitude, lead.longitude)}
                            className="text-accent hover:text-accent-hover transition-colors"
                            title="View on Google Maps"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                  strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
                          </button>
                        ) : (
                          <span className="text-foreground opacity-50">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-foreground opacity-70">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total leads)
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page === 1}
                variant="outline"
                size="sm"
              >
                Previous
              </Button>
              <Button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                disabled={pagination.page === pagination.totalPages}
                variant="outline"
                size="sm"
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* View Modal */}
        {isViewModalOpen && selectedLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setIsViewModalOpen(false)}>
            <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
                <h3 className="text-xl font-bold text-foreground">
                  Lead Details - {selectedLead.customer_name}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(selectedLead)}
                    className="px-4 py-2 rounded bg-accent hover:bg-accent-hover text-white text-sm transition-colors"
                  >
                    Edit
                  </button>
                  {(roleName === 'Admin' || roleName === 'Super Admin') && (
                    <button
                      onClick={() => handleDelete(selectedLead)}
                      className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white text-sm transition-colors"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    onClick={() => setIsViewModalOpen(false)}
                    className="text-foreground opacity-70 hover:text-foreground transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground opacity-70">Customer Name</label>
                    <p className="text-foreground">{selectedLead.customer_name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground opacity-70">Mobile</label>
                    <div className="flex items-center gap-2">
                      <p className="text-foreground">{formatPhoneNumber(selectedLead.customer_phone)}</p>
                      <button
                        onClick={() => handlePhoneCall(selectedLead.customer_phone)}
                        className="p-1.5 rounded bg-accent hover:bg-accent-hover text-white transition-colors"
                        title="Call"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleWhatsApp(selectedLead.customer_phone)}
                        className="p-1.5 rounded bg-accent hover:bg-accent-hover text-white transition-colors"
                        title="WhatsApp"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground opacity-70">Created At</label>
                    <p className="text-foreground">{formatDate(selectedLead.created_at)}</p>
                  </div>
                  {!isSales && (
                    <div>
                      <label className="text-sm font-medium text-foreground opacity-70">Executive</label>
                      <p className="text-foreground">{selectedLead.executive_name || 'N/A'}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-foreground opacity-70">Status</label>
                    <p className="text-foreground">{selectedLead.status || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground opacity-70">Visit Status</label>
                    <p className="text-foreground">{selectedLead.visit_status || 'First Visit'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground opacity-70">Power Bill</label>
                    <p className="text-foreground">{selectedLead.power_bill ? `₹${selectedLead.power_bill}` : 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground opacity-70">Power Units</label>
                    <p className="text-foreground">{selectedLead.power_units || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground opacity-70">Referer</label>
                    <p className="text-foreground">{selectedLead.referer || 'N/A'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-foreground opacity-70">Address</label>
                    <p className="text-foreground">{selectedLead.customer_address || 'N/A'}</p>
                  </div>
                  {selectedLead.latitude && selectedLead.longitude && (
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-foreground opacity-70">Location</label>
                      <div className="flex items-center gap-2">
                        <p className="text-foreground">
                          {selectedLead.latitude}, {selectedLead.longitude}
                        </p>
                        <button
                          onClick={() => handleGoogleMaps(selectedLead.latitude, selectedLead.longitude)}
                          className="px-3 py-1.5 rounded bg-accent hover:bg-accent-hover text-white text-sm transition-colors"
                        >
                          View on Google Maps
                        </button>
                      </div>
                    </div>
                  )}
                  {selectedLead.photo_url && (
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-foreground opacity-70">Photo</label>
                      <div className="mt-2 relative">
                        <img
                          src={imageUrls[selectedLead.id] || selectedLead.photo_url}
                          alt="Lead photo"
                          className="max-w-full h-auto rounded border border-zinc-200 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleImageClick(selectedLead.photo_url, selectedLead.id)}
                          onError={async (e) => {
                            const img = e.target as HTMLImageElement;
                            const currentSrc = img.src;
                            
                            // If we haven't tried to get the processed URL yet, try it
                            if (!imageUrls[selectedLead.id] && selectedLead.photo_url && currentSrc === selectedLead.photo_url) {
                              try {
                                const processedUrl = await getImageUrl(selectedLead.photo_url);
                                if (processedUrl && processedUrl !== selectedLead.photo_url) {
                                  img.src = processedUrl;
                                  setImageUrls(prev => ({ ...prev, [selectedLead.id]: processedUrl }));
                                  return;
                                }
                              } catch (err) {
                                console.error('Error processing image URL:', err);
                              }
                            }
                            
                            // If all attempts failed, hide image and show fallback
                            img.style.display = 'none';
                            const fallback = img.nextElementSibling as HTMLElement;
                            if (fallback) {
                              fallback.style.display = 'block';
                            }
                          }}
                        />
                        <span 
                          className="text-foreground opacity-50 text-sm image-fallback"
                          style={{ display: 'none' }}
                        >
                          Image not available
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {isEditModalOpen && editingLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => {
            setIsEditModalOpen(false);
            setEditingLead(null);
          }}>
            <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
                <h3 className="text-xl font-bold text-foreground">
                  Edit Lead - {editingLead.customer_name}
                </h3>
                <button
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingLead(null);
                  }}
                  className="text-foreground opacity-70 hover:text-foreground transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                {editingLead && (() => {
                  const currentVisitStatus = (editingLead.visit_status || 'First Visit').trim();
                  const availableOptions = getAvailableVisitOptions(currentVisitStatus);
                  const initialVisitStage = availableOptions.length > 0 ? availableOptions[0] : currentVisitStatus;
                  
                  return (
                    <LeadForm
                      initialData={{
                        customer_name: editingLead.customer_name || '',
                        mobile_number: String(editingLead.customer_phone || ''),
                        power_bill: String(editingLead.power_bill || ''),
                        units: String(editingLead.power_units || ''),
                        address: editingLead.customer_address || '',
                        status: editingLead.status || 'Interested',
                        visit_status: initialVisitStage,
                        referrer_name: editingLead.referer || '',
                      }}
                      isAdmin={roleName === 'Admin' || roleName === 'Super Admin' || roleName === 'salesLead'}
                      isEditMode={true}
                      editingVisitStatus={currentVisitStatus}
                      availableVisitOptions={availableOptions}
                      onSubmit={handleSaveEdit}
                      onCancel={() => {
                        setIsEditModalOpen(false);
                        setEditingLead(null);
                      }}
                      saving={saving}
                      submitLabel="Update"
                      cancelLabel="Cancel"
                    />
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Full Screen Image Modal */}
        {isImageModalOpen && selectedImageUrl && (
          <div 
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
            onClick={() => setIsImageModalOpen(false)}
          >
            <div className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center">
              <button
                onClick={() => setIsImageModalOpen(false)}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <img
                src={selectedImageUrl}
                alt="Lead photo - Full screen"
                className="max-w-full max-h-full object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
          </div>
        </div>
        )}
      </main>
    </DashboardLayout>
  );
}

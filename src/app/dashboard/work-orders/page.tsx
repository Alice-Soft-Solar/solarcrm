'use client';

import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { LoadingSpinner, Button } from '@/components/ui';
import { getAccessToken } from '@/lib/supabase-client';
import { compressImage, isCompressibleImage } from '@/utils/compressImage';

interface User {
  id: string;
  email?: string;
}

interface Profile {
  company_id: string;
  roles: {
    role_name: string;
  } | {
    role_name: string;
  }[];
}

export default function WorkOrdersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [formData, setFormData] = useState({
    work_order_number: '',
    customer_name: '',
    customer_address: '',
    town: '',
    customer_email: '',
    customer_phone: '',
    power_bill: '',
    power_units: '',
    site_details: '',
    structure_height: '',
    roof_type: '',
    plant_capacity: '',
    order_amount: '',
    aadhaar_url: '',
    pan_url: '',
    bank_statement_url: '',
    cancelled_check_url: '',
  });

  // Validation state for form fields
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Upload state for each document
  const [uploadStates, setUploadStates] = useState({
    aadhaar: { loading: false, error: '' },
    pan: { loading: false, error: '' },
    bank_statement: { loading: false, error: '' },
    cancelled_check: { loading: false, error: '' },
  });

  // Signed URLs for immediate viewing after upload
  const [signedUrls, setSignedUrls] = useState<{
    aadhaar?: string;
    pan?: string;
    bank_statement?: string;
    cancelled_check?: string;
  }>({});

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = useMemo(() => createClient(supabaseUrl, supabaseKey), [supabaseUrl, supabaseKey]);

  useEffect(() => {
    let isMounted = true;

    const fetchUser = async () => {
      try {
        console.log('🔍 Fetching user...');
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error('❌ Error fetching user:', userError);
          if (isMounted) {
            router.push('/login');
          }
          return;
        }

        if (!currentUser) {
          console.warn('⚠️ No user found');
          if (isMounted) {
            router.push('/login');
          }
          return;
        }

        console.log('✅ User found:', currentUser.id);
        if (isMounted) {
          setUser(currentUser);
        }

        console.log('🔍 Fetching profile...');
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select(`
            company_id,
            roles (role_name)
          `)
          .eq('id', currentUser.id)
          .single();

        if (profileError) {
          console.error('❌ Error fetching profile:', profileError);
          console.error('Error code:', profileError.code);
          console.error('Error message:', profileError.message);
          if (isMounted) {
            alert(`Error loading profile: ${profileError.message}. Redirecting to dashboard.`);
            router.push('/dashboard');
          }
          return;
        }

        if (!profileData) {
          console.warn('⚠️ No profile found');
          if (isMounted) {
            router.push('/dashboard');
          }
          return;
        }

        console.log('✅ Profile found:', profileData);

        // Check if user has authorized role (Sales, Sales Lead, Admin, or Super Admin)
        const roles = profileData.roles as { role_name: string } | { role_name: string }[];
        const roleName = Array.isArray(roles) ? roles[0]?.role_name : roles?.role_name;
        
        const allowedRoles = ['Sales', 'salesLead', 'Admin', 'Super Admin'];
        if (!roleName || !allowedRoles.includes(roleName)) {
          console.warn('⚠️ Unauthorized role:', roleName);
          if (isMounted) {
            alert('You do not have permission to create work orders. Only Sales, Sales Lead, Admin, and Super Admin can create work orders.');
            router.push('/dashboard');
          }
          return;
        }

        if (isMounted) {
          setProfile(profileData);
          setAuthorized(true);
          console.log('✅ Authorization complete');
          
          // Auto-generate work order number when profile is loaded
          generateNextWorkOrderNumber(profileData.company_id);
        }
      } catch (error: unknown) {
        console.error('❌ Unexpected error in fetchUser:', error);
        if (isMounted) {
          const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
          alert(`An error occurred: ${errorMessage}`);
          router.push('/dashboard');
        }
      } finally {
        if (isMounted) {
          setPageLoading(false);
        }
      }
    };

    fetchUser();

    return () => {
      isMounted = false;
    };
  }, [router]);

  /**
   * Generate next work order number from API
   */
  const generateNextWorkOrderNumber = async (companyId: string) => {
    try {
      // Get access token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        console.error('No access token found in session');
        setFormData((prev) => ({
          ...prev,
          work_order_number: 'AUTO-GENERATE',
        }));
        return;
      }

      // Call Supabase Edge Function (RLS-enforced, no service role key)
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/generate-work-order-number`;
      
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok && result.work_order_number) {
        setFormData((prev) => ({
          ...prev,
          work_order_number: result.work_order_number,
        }));
        console.log('✅ Work order number generated:', result.work_order_number);
      } else {
        console.error('Failed to generate work order number:', result.error);
        setFormData((prev) => ({
          ...prev,
          work_order_number: 'AUTO-GENERATE',
        }));
      }
    } catch (error) {
      console.error('Error generating work order number:', error);
      setFormData((prev) => ({
        ...prev,
        work_order_number: 'AUTO-GENERATE',
      }));
    }
  };

  /**
   * Uploads a document file to Supabase Storage and returns the public URL
   */
  async function uploadDocumentToSupabase(params: {
    file: File;
    docType: 'aadhaar' | 'pan' | 'bank_statement' | 'cancelled_check';
    companyId: string;
  }): Promise<{ publicUrl: string; signedUrl: string; filePath: string }> {
    const { file, docType, companyId } = params;

    try {
      // Get file extension from filename
      const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      
      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const fileName = `${docType}-${timestamp}.${fileExtension}`;
      
      // Build path: {company_id}/temp/{docType}-{timestamp}.{ext}
      // Using 'temp' folder since work order doesn't exist yet
      const filePath = `${companyId}/temp/${fileName}`;

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('work-order-docs')
        .upload(filePath, file, {
          upsert: true,
          cacheControl: '3600',
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Failed to upload file: ${uploadError.message}`);
      }

      // Get public URL for database storage
      const { data: urlData } = supabase.storage
        .from('work-order-docs')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL after upload');
      }

      // Also generate signed URL for immediate viewing
      const { data: signedData, error: signedError } = await supabase.storage
        .from('work-order-docs')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (signedError) {
        console.warn('Failed to generate signed URL, using public URL:', signedError);
        // Continue with public URL if signed URL fails
      }

      return {
        publicUrl: urlData.publicUrl,
        signedUrl: signedData?.signedUrl || urlData.publicUrl,
        filePath: filePath,
      };
    } catch (error) {
      console.error('Error in uploadDocumentToSupabase:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Document upload failed: ${errorMessage}`);
    }
  }

  /**
   * Handles file upload for a specific document type
   */
  const handleDocumentUpload = async (
    file: File | null,
    docType: 'aadhaar' | 'pan' | 'bank_statement' | 'cancelled_check'
  ) => {
    if (!file) return;

    if (!profile?.company_id) {
      alert('Company information not found. Please refresh the page.');
      return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setUploadStates(prev => ({
        ...prev,
        [docType]: { loading: false, error: 'Invalid file type. Please upload PDF, JPG, or PNG files only.' },
      }));
      return;
    }

    // Validate file size (8MB limit before compression)
    const maxSize = 10 * 1024 * 1024; // 8MB in bytes
    if (file.size > maxSize) {
      setUploadStates(prev => ({
        ...prev,
        [docType]: { loading: false, error: 'File size exceeds 10MB limit.' },
      }));
      return;
    }

    // Set loading state
    setUploadStates(prev => ({
      ...prev,
      [docType]: { loading: true, error: '' },
    }));

    try {
      // Compress image files before upload
      let fileToUpload = file;
      if (isCompressibleImage(file)) {
        try {
          fileToUpload = await compressImage(file);
        } catch (compressionError) {
          console.warn('Image compression failed, uploading original:', compressionError);
          // Continue with original file if compression fails
        }
      }

      const { publicUrl, signedUrl } = await uploadDocumentToSupabase({
        file: fileToUpload,
        docType,
        companyId: profile.company_id,
      });

      // Update form data with the public URL (for database storage)
      const fieldName = `${docType}_url` as 'aadhaar_url' | 'pan_url' | 'bank_statement_url' | 'cancelled_check_url';
      setFormData(prev => ({
        ...prev,
        [fieldName]: publicUrl,
      }));

      // Store signed URL for immediate viewing
      setSignedUrls(prev => ({
        ...prev,
        [docType]: signedUrl,
      }));

      // Clear error and loading state
      setUploadStates(prev => ({
        ...prev,
        [docType]: { loading: false, error: '' },
      }));
    } catch (error) {
      console.error(`Error uploading ${docType}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed, please try again';
      setUploadStates(prev => ({
        ...prev,
        [docType]: { loading: false, error: errorMessage },
      }));
    }
  };

  // Validate form fields
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.work_order_number.trim()) {
      newErrors.work_order_number = 'Work order number did not fill';
    }
    if (!formData.customer_name.trim()) {
      newErrors.customer_name = 'Customer name did not fill';
    }
    if (!formData.customer_address.trim()) {
      newErrors.customer_address = 'Customer address did not fill';
    }
    if (!formData.town.trim()) {
      newErrors.town = 'Town is required';
    }
    if (!formData.customer_phone.trim()) {
      newErrors.customer_phone = 'Customer phone number did not fill';
    }
    if (!formData.order_amount.trim()) {
      newErrors.order_amount = 'Order amount did not fill';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      if (!user || !profile) {
        alert('User information not found. Please refresh the page.');
        setLoading(false);
        return;
      }

      console.log('Submitting work order with data:', {
        company_id: profile.company_id,
        sales_executive_id: user.id,
        work_order_number: formData.work_order_number,
        customer_name: formData.customer_name,
        order_amount: formData.order_amount,
      });

      // Convert order_amount to number
      const orderAmount = parseFloat(formData.order_amount);
      if (isNaN(orderAmount)) {
        throw new Error('Order amount must be a valid number');
      }

      // Create work order via API route (uses service role key, bypasses RLS)
      const accessToken = getAccessToken();
      const response = await fetch('/api/work-orders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
        },
        body: JSON.stringify({
          ...(accessToken && { access_token: accessToken }),
          company_id: profile.company_id,
          sales_executive_id: user.id,
          work_order_number: formData.work_order_number,
          customer_name: formData.customer_name,
          customer_address: formData.customer_address,
          town: formData.town,
          customer_email: formData.customer_email || null,
          customer_phone: formData.customer_phone,
          power_bill: formData.power_bill ? parseFloat(formData.power_bill) : null,
          power_units: formData.power_units ? parseFloat(formData.power_units) : null,
          site_details: formData.site_details || null,
          structure_height: formData.structure_height || null,
          roof_type: formData.roof_type || null,
          // Format plant capacity: if numeric, append "kW", otherwise store as-is
          plant_capacity: formData.plant_capacity 
            ? (formData.plant_capacity.trim() && !isNaN(parseFloat(formData.plant_capacity)) 
                ? `${formData.plant_capacity}kW` 
                : formData.plant_capacity)
            : null,
          order_amount: orderAmount,
          aadhaar_url: formData.aadhaar_url || null,
          pan_url: formData.pan_url || null,
          bank_statement_url: formData.bank_statement_url || null,
          cancelled_check_url: formData.cancelled_check_url || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('❌ Error creating work order:', result);
        throw new Error(result.error || 'Failed to create work order');
      }

      console.log('✅ Work order created successfully:', result.workOrder);
      
      // Redirect to dashboard after successful creation
      router.push('/dashboard');
    } catch (error: unknown) {
      console.error('Error in handleSubmit:', error);
      const errorMessage = error instanceof Error ? error.message : 'An error occurred while creating work order';
      alert(`Error: ${errorMessage}\n\nCheck the browser console for more details.`);
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading || !user || !profile || !authorized) {
    return (
      <LoadingSpinner
        fullScreen
        text={pageLoading ? 'Fetching user data...' : 'Verifying permissions...'}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Work Orders" />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground">Create Work Order</h2>
          <p className="mt-2 text-foreground opacity-70">
            Fill in the form below to create a new work order
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-border bg-white p-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground">
                Work Order Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                readOnly
                value={formData.work_order_number}
                className={`mt-1 block w-full rounded-md border px-3 py-2 text-foreground cursor-not-allowed ${
                  errors.work_order_number 
                    ? 'border-red-500 bg-red-50' 
                    : 'border-border bg-zinc-50'
                }`}
                placeholder="Auto-generating..."
              />
              {errors.work_order_number && (
                <p className="mt-1 text-xs text-red-600">{errors.work_order_number}</p>
              )}
              <p className="mt-1 text-xs text-foreground opacity-60">
                Format: CompanyCode + Year + Month + Serial (e.g., GMS25120001)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground">
                Customer Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.customer_name}
                onChange={(e) => {
                  setFormData({ ...formData, customer_name: e.target.value });
                  // Clear error when user starts typing
                  if (errors.customer_name) {
                    setErrors({ ...errors, customer_name: '' });
                  }
                }}
                className={`mt-1 block w-full rounded-md border px-3 py-2 text-foreground placeholder-zinc-400 focus:outline-none focus:ring-2 transition-all duration-200 ${
                  errors.customer_name 
                    ? 'border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500' 
                    : 'border-border bg-white focus:border-accent focus:ring-accent'
                }`}
                placeholder="John Doe"
              />
              {errors.customer_name && (
                <p className="mt-1 text-xs text-red-600">{errors.customer_name}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium">
                Customer Address <span className="text-red-500">*</span>
              </label>

              <textarea
                value={formData.customer_address}
                onChange={(e) =>
                  setFormData({ ...formData, customer_address: e.target.value })
                }
                rows={2}
                className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2"
                placeholder="House No, Street, Area, City, State, Pincode"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground">
                Town <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.town}
                onChange={(e) => {
                  setFormData({ ...formData, town: e.target.value });
                  if (errors.town) {
                    setErrors({ ...errors, town: '' });
                  }
                }}
                className={`mt-1 block w-full rounded-md border px-3 py-2 text-foreground placeholder-zinc-400 focus:outline-none focus:ring-2 transition-all duration-200 ${
                  errors.town 
                    ? 'border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500' 
                    : 'border-border bg-white focus:border-accent focus:ring-accent'
                }`}
                placeholder="Enter town name"
              />
              {errors.town && (
                <p className="mt-1 text-xs text-red-600">{errors.town}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground">
                Customer Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={formData.customer_email}
                onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-foreground placeholder-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200"
                placeholder="customer@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground">
                Customer Phone <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={formData.customer_phone}
                onChange={(e) => {
                  setFormData({ ...formData, customer_phone: e.target.value });
                  // Clear error when user starts typing
                  if (errors.customer_phone) {
                    setErrors({ ...errors, customer_phone: '' });
                  }
                }}
                className={`mt-1 block w-full rounded-md border px-3 py-2 text-foreground placeholder-zinc-400 focus:outline-none focus:ring-2 transition-all duration-200 ${
                  errors.customer_phone 
                    ? 'border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500' 
                    : 'border-border bg-white focus:border-accent focus:ring-accent'
                }`}
                placeholder="+1 234 567 8900"
              />
              {errors.customer_phone && (
                <p className="mt-1 text-xs text-red-600">{errors.customer_phone}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground">
                Power Bill <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.power_bill}
                onChange={(e) => setFormData({ ...formData, power_bill: e.target.value })}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-foreground placeholder-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="320.50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground">
                Power Units <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.power_units}
                onChange={(e) => setFormData({ ...formData, power_units: e.target.value })}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-foreground placeholder-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="280"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground">
                Structure Height <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.structure_height}
                onChange={(e) => setFormData({ ...formData, structure_height: e.target.value })}
                className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200"
              >
                <option value="">Select height</option>
                <option value="3-4Ft">3-4Ft</option>
                <option value="6-7Ft">6-7Ft</option>
                <option value="8-10Ft">8-10Ft</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground">
                Roof Type <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.roof_type}
                onChange={(e) => setFormData({ ...formData, roof_type: e.target.value })}
                className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200"
              >
                <option value="">Select roof type</option>
                <option value="Iron Shed">Iron Shed</option>
                <option value="RCC">RCC</option>
                <option value="Single Floor">Single Floor</option>
                <option value="Double Floor">Double Floor</option>
                <option value="Apartment">Apartment</option>
                <option value="Ground">Ground</option>
                <option value="Asbestos Sheet">Asbestos Sheet</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground">
                Plant Capacity <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.plant_capacity}
                onChange={(e) => setFormData({ ...formData, plant_capacity: e.target.value })}
                className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200"
              >
                <option value="">Select capacity</option>
                <option value="1">1KW</option>
                <option value="2">2KW</option>
                <option value="3">3KW</option>
                <option value="4">4KW</option>
                <option value="5">5KW</option>
                <option value="6">6KW</option>
                <option value="7">7KW</option>
                <option value="8">8KW</option>
                <option value="9">9KW</option>
                <option value="10">10KW</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground">
                Order Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.order_amount}
                onChange={(e) => {
                  setFormData({ ...formData, order_amount: e.target.value });
                  // Clear error when user starts typing
                  if (errors.order_amount) {
                    setErrors({ ...errors, order_amount: '' });
                  }
                }}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                className={`mt-1 block w-full rounded-md border px-3 py-2 text-foreground placeholder-zinc-400 focus:outline-none focus:ring-2 transition-all duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                  errors.order_amount 
                    ? 'border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500' 
                    : 'border-border bg-white focus:border-accent focus:ring-accent'
                }`}
                placeholder="10000.00"
              />
              {errors.order_amount && (
                <p className="mt-1 text-xs text-red-600">{errors.order_amount}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground">
                Site Details
              </label>
              <textarea
                value={formData.site_details}
                onChange={(e) => setFormData({ ...formData, site_details: e.target.value })}
                rows={3}
                className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-foreground placeholder-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200"
                placeholder="Additional site information..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#1E1E1E] mb-3">
                Document Uploads
              </label>
              <div className="space-y-4">
                {/* Aadhaar Upload */}
                <div>
                  <label className="block text-xs font-medium text-foreground opacity-70 mb-1">
                    Aadhaar Document
                  </label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      handleDocumentUpload(file, 'aadhaar');
                    }}
                    disabled={uploadStates.aadhaar.loading}
                    className="block w-full text-sm text-foreground opacity-70 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-white hover:file:bg-accent-hover file:transition-colors file:duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {uploadStates.aadhaar.loading && (
                    <p className="mt-1 text-xs text-zinc-500">Uploading...</p>
                  )}
                  {uploadStates.aadhaar.error && (
                    <p className="mt-1 text-xs text-red-600">{uploadStates.aadhaar.error}</p>
                  )}
                  {formData.aadhaar_url && !uploadStates.aadhaar.loading && (
                    <div className="mt-1">
                      <p className="text-xs text-green-600">✓ Uploaded successfully</p>
                      <a
                        href={signedUrls.aadhaar || formData.aadhaar_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View document
                      </a>
                    </div>
                  )}
                </div>

                {/* PAN Upload */}
                <div>
                  <label className="block text-xs font-medium text-foreground opacity-70 mb-1">
                    PAN Document
                  </label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      handleDocumentUpload(file, 'pan');
                    }}
                    disabled={uploadStates.pan.loading}
                    className="block w-full text-sm text-foreground opacity-70 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-white hover:file:bg-accent-hover file:transition-colors file:duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {uploadStates.pan.loading && (
                    <p className="mt-1 text-xs text-zinc-500">Uploading...</p>
                  )}
                  {uploadStates.pan.error && (
                    <p className="mt-1 text-xs text-red-600">{uploadStates.pan.error}</p>
                  )}
                  {formData.pan_url && !uploadStates.pan.loading && (
                    <div className="mt-1">
                      <p className="text-xs text-green-600">✓ Uploaded successfully</p>
                      <a
                        href={signedUrls.pan || formData.pan_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View document
                      </a>
                    </div>
                  )}
                </div>

                {/* Bank Statement Upload */}
                <div>
                  <label className="block text-xs font-medium text-foreground opacity-70 mb-1">
                    Bank Statement Document
                  </label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      handleDocumentUpload(file, 'bank_statement');
                    }}
                    disabled={uploadStates.bank_statement.loading}
                    className="block w-full text-sm text-foreground opacity-70 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-white hover:file:bg-accent-hover file:transition-colors file:duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {uploadStates.bank_statement.loading && (
                    <p className="mt-1 text-xs text-zinc-500">Uploading...</p>
                  )}
                  {uploadStates.bank_statement.error && (
                    <p className="mt-1 text-xs text-red-600">{uploadStates.bank_statement.error}</p>
                  )}
                  {formData.bank_statement_url && !uploadStates.bank_statement.loading && (
                    <div className="mt-1">
                      <p className="text-xs text-green-600">✓ Uploaded successfully</p>
                      <a
                        href={signedUrls.bank_statement || formData.bank_statement_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View document
                      </a>
                    </div>
                  )}
                </div>

                {/* Cancelled Check Upload */}
                <div>
                  <label className="block text-xs font-medium text-foreground opacity-70 mb-1">
                    Cancelled Check Document
                  </label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      handleDocumentUpload(file, 'cancelled_check');
                    }}
                    disabled={uploadStates.cancelled_check.loading}
                    className="block w-full text-sm text-foreground opacity-70 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-white hover:file:bg-accent-hover file:transition-colors file:duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {uploadStates.cancelled_check.loading && (
                    <p className="mt-1 text-xs text-zinc-500">Uploading...</p>
                  )}
                  {uploadStates.cancelled_check.error && (
                    <p className="mt-1 text-xs text-red-600">{uploadStates.cancelled_check.error}</p>
                  )}
                  {formData.cancelled_check_url && !uploadStates.cancelled_check.loading && (
                    <div className="mt-1">
                      <p className="text-xs text-green-600">✓ Uploaded successfully</p>
                      <a
                        href={signedUrls.cancelled_check || formData.cancelled_check_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View document
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={loading}
              disabled={loading}
            >
              Create Work Order
            </Button>
            <Button
              asLink
              href="/dashboard"
              variant="outline"
              size="md"
            >
              Cancel
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}


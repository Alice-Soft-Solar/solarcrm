'use client';

import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { LoadingSpinner, Button } from '@/components/ui';

interface WorkOrder {
  id: string;
  work_order_number: string;
  customer_name: string;
  customer_address: string;
  customer_phone: string;
  site_details: string | null;
  structure_height: string | null;
  roof_type: string | null;
  plant_capacity: string | null;
  order_amount: number;
  aadhaar_url: string | null;
  pan_url: string | null;
  bank_statement_url: string | null;
  cancelled_check_url: string | null;
  created_at: string;
  company_id: string;
  company_name?: string;
  sales_executive_id: string;
  sales_executive_name?: string;
  status?: string;
  work_order_status: string | null;
}

interface Payment {
  id: string;
  work_order_id: string;
  amount: number;
  transaction_date: string;
  payment_method: string | null;
  status: string;
  first_payment: number | null;
  second_payment: number | null;
  final_payment: number | null;
  additional_payment: number | null;
  created_at: string;
  receipt_number?: string | null;
  pdf_url?: string | null;
  receipt_generated_at?: string | null;
}

interface PaymentSummary {
  orderAmount: number;
  totalPaid: number;
  pendingAmount: number;
  paymentPercentage: string;
  status: string;
}

export default function WorkOrdersListPage() {
  const router = useRouter();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [allWorkOrders, setAllWorkOrders] = useState<WorkOrder[]>([]); // Store all work orders for filtering
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<{ id: string; company_id: string; roles: { role_name: string } | { role_name: string }[] } | null>(null);
  const [roleName, setRoleName] = useState<string | null>(null);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCompany, setFilterCompany] = useState<string>('');
  const [filterSalesExecutive, setFilterSalesExecutive] = useState<string>('');
  const [filterPlantCapacity, setFilterPlantCapacity] = useState<string>('');

  // Detail view modal state
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [signedUrls, setSignedUrls] = useState<{
    aadhaar?: string;
    pan?: string;
    bank_statement?: string;
    cancelled_check?: string;
  }>({});

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingWorkOrder, setEditingWorkOrder] = useState<WorkOrder | null>(null);
  const [editFormData, setEditFormData] = useState({
    work_order_number: '',
    customer_name: '',
    customer_address: '',
    customer_phone: '',
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
  const [editLoading, setEditLoading] = useState(false);
  const [editDocumentUploading, setEditDocumentUploading] = useState({
    aadhaar: false,
    pan: false,
    bank_statement: false,
    cancelled_check: false,
  });
  const [editDocumentErrors, setEditDocumentErrors] = useState({
    aadhaar: null as string | null,
    pan: null as string | null,
    bank_statement: null as string | null,
    cancelled_check: null as string | null,
  });
  const [editSignedUrls, setEditSignedUrls] = useState<{
    aadhaar?: string;
    pan?: string;
    bank_statement?: string;
    cancelled_check?: string;
  }>({});

  // Delete confirmation state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingWorkOrder, setDeletingWorkOrder] = useState<WorkOrder | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Payments state
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [isAddPaymentModalOpen, setIsAddPaymentModalOpen] = useState(false);
  const [isEditPaymentModalOpen, setIsEditPaymentModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [paymentFormData, setPaymentFormData] = useState({
    amount: '',
    transaction_date: new Date().toISOString().split('T')[0],
    payment_method: '',
    status: 'completed',
    first_payment: '',
    second_payment: '',
    final_payment: '',
    additional_payment: '',
  });
  const [paymentType, setPaymentType] = useState<string>('');
  const [paymentFormLoading, setPaymentFormLoading] = useState(false);
  const [generatingReceipt, setGeneratingReceipt] = useState<string | null>(null);
  const [markingDispatched, setMarkingDispatched] = useState(false);

  // Dispatch confirmation state
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [dispatchingWorkOrder, setDispatchingWorkOrder] = useState<WorkOrder | null>(null);
  const [dispatchLoading, setDispatchLoading] = useState(false);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = useMemo(() => createClient(supabaseUrl, supabaseKey), [supabaseUrl, supabaseKey]);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        // Get current user
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !currentUser) {
          if (isMounted) {
            router.push('/login');
          }
          return;
        }

        if (isMounted) {
          setUser(currentUser);
        }

        // Get user profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select(`
            id,
            company_id,
            roles (role_name)
          `)
          .eq('id', currentUser.id)
          .single();

        if (profileError || !profileData) {
          console.error('Error fetching profile:', profileError);
          if (isMounted) {
            router.push('/dashboard');
          }
          return;
        }

        const roles = profileData.roles as { role_name: string } | { role_name: string }[];
        const currentRoleName = Array.isArray(roles) ? roles[0]?.role_name : roles?.role_name;

        // Check authorization
        const allowedRoles = ['Sales', 'Admin', 'Super Admin', 'Inventory'];
        if (!currentRoleName || !allowedRoles.includes(currentRoleName)) {
          if (isMounted) {
            alert('You do not have permission to view work orders.');
            router.push('/dashboard');
          }
          return;
        }

        if (isMounted) {
          setProfile(profileData);
          setRoleName(currentRoleName);
        }

        // Fetch work orders via API route
        let response;
        try {
          response = await fetch('/api/work-orders/list', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: currentUser.id,
            companyId: profileData.company_id,
              roleName: currentRoleName,
          }),
        });
        } catch (networkError) {
          console.error('Network error fetching work orders:', networkError);
          if (isMounted) {
            setWorkOrders([]);
            alert('Network error: Failed to connect to server. Please check your internet connection and try again.');
          }
          return;
        }

        if (!response.ok) {
          let errorMessage = 'Failed to fetch work orders';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
          console.error('Error fetching work orders:', errorMessage);
          if (isMounted) {
            setWorkOrders([]);
            alert(`Error loading work orders: ${errorMessage}`);
          }
          return;
        }

        let result;
        try {
          result = await response.json();
        } catch (parseError) {
          console.error('Error parsing response:', parseError);
        if (isMounted) {
            setWorkOrders([]);
            alert('Error parsing server response. Please try again.');
          }
          return;
        }

        if (isMounted) {
          const orders = result.workOrders || [];
          setAllWorkOrders(orders);
          setWorkOrders(orders);
        }
      } catch (error: any) {
        console.error('Error in fetchData:', error);
        alert(`An error occurred: ${error.message}`);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Get unique values for filter dropdowns
  const uniqueCompanies = useMemo(() => {
    const companies = new Set<string>();
    allWorkOrders.forEach(order => {
      if (order.company_name && order.company_name !== 'N/A') {
        companies.add(order.company_name);
      }
    });
    return Array.from(companies).sort();
  }, [allWorkOrders]);

  const uniqueSalesExecutives = useMemo(() => {
    const execs = new Set<string>();
    allWorkOrders.forEach(order => {
      if (order.sales_executive_name && order.sales_executive_name !== 'N/A') {
        execs.add(order.sales_executive_name);
      }
    });
    return Array.from(execs).sort();
  }, [allWorkOrders]);

  const uniquePlantCapacities = useMemo(() => {
    const capacities = new Set<string>();
    allWorkOrders.forEach(order => {
      if (order.plant_capacity && order.plant_capacity !== 'N/A') {
        capacities.add(order.plant_capacity);
      }
    });
    return Array.from(capacities).sort();
  }, [allWorkOrders]);

  // Sync filters to URL params for dashboard integration
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (filterCompany) params.set('company', filterCompany);
    if (filterSalesExecutive) params.set('salesExecutive', filterSalesExecutive);
    if (filterPlantCapacity) params.set('plantCapacity', filterPlantCapacity);
    
    const newUrl = params.toString() 
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    
    // Update URL without page reload
    window.history.replaceState({}, '', newUrl);
  }, [searchQuery, filterCompany, filterSalesExecutive, filterPlantCapacity]);

  // Filter work orders based on search and filters
  useEffect(() => {
    let filtered = [...allWorkOrders];

    // Apply search query (searches across multiple fields)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(order => {
        return (
          order.work_order_number.toLowerCase().includes(query) ||
          order.customer_name.toLowerCase().includes(query) ||
          order.customer_phone.toLowerCase().includes(query) ||
          (order.company_name && order.company_name.toLowerCase().includes(query)) ||
          (order.customer_address && order.customer_address.toLowerCase().includes(query)) ||
          (order.sales_executive_name && order.sales_executive_name.toLowerCase().includes(query)) ||
          (order.aadhaar_url && order.aadhaar_url.toLowerCase().includes(query)) ||
          (order.pan_url && order.pan_url.toLowerCase().includes(query)) ||
          (order.bank_statement_url && order.bank_statement_url.toLowerCase().includes(query)) ||
          (order.cancelled_check_url && order.cancelled_check_url.toLowerCase().includes(query))
        );
      });
    }

    // Apply company filter
    if (filterCompany) {
      filtered = filtered.filter(order => order.company_name === filterCompany);
    }

    // Apply sales executive filter
    if (filterSalesExecutive) {
      filtered = filtered.filter(order => order.sales_executive_name === filterSalesExecutive);
    }

    // Apply plant capacity filter
    if (filterPlantCapacity) {
      filtered = filtered.filter(order => order.plant_capacity === filterPlantCapacity);
    }

    setWorkOrders(filtered);
  }, [searchQuery, filterCompany, filterSalesExecutive, filterPlantCapacity, allWorkOrders]);

  const clearFilters = () => {
    setSearchQuery('');
    setFilterCompany('');
    setFilterSalesExecutive('');
    setFilterPlantCapacity('');
  };

  const hasActiveFilters = searchQuery.trim() || filterCompany || filterSalesExecutive || filterPlantCapacity;

  const openDetailModal = async (order: WorkOrder) => {
    setSelectedWorkOrder(order);
    setIsModalOpen(true);
    // Generate signed URLs for all documents
    await generateSignedUrls(order);
    // Fetch payments for this work order
    await fetchPayments(order.id);
  };

  const fetchPayments = async (workOrderId: string) => {
    if (!profile?.company_id) return;

    setPaymentsLoading(true);
    try {
      const response = await fetch('/api/payments/work-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          work_order_id: workOrderId,
          company_id: profile.company_id,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setPayments(result.payments || []);
        setPaymentSummary(result.paymentSummary || null);
      } else {
        console.error('Error fetching payments:', result.error);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const closeDetailModal = () => {
    setIsModalOpen(false);
    setSelectedWorkOrder(null);
    setSignedUrls({}); // Clear signed URLs when closing
    setPayments([]);
    setPaymentSummary(null);
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkOrder || !profile || !user) {
      alert('Missing required information. Please refresh the page and try again.');
      return;
    }

    // Validate work order has required fields
    if (!selectedWorkOrder.id) {
      alert('Invalid work order. Please refresh the page and try again.');
      return;
    }

    if (!profile.company_id) {
      alert('Your account is missing company information. Please contact support.');
      return;
    }

    // Verify work order belongs to user's company
    if (selectedWorkOrder.company_id && selectedWorkOrder.company_id !== profile.company_id) {
      console.error('Company ID mismatch:', {
        work_order_company_id: selectedWorkOrder.company_id,
        user_company_id: profile.company_id,
        work_order_id: selectedWorkOrder.id,
      });
      alert('This work order does not belong to your company. Please refresh the page.');
      return;
    }

    // Validate payment type and amount
    if (!paymentType) {
      alert('Please select a payment type');
      return;
    }

    if (!paymentFormData.amount || parseFloat(paymentFormData.amount) <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    // Prepare payment data based on selected payment type
    const paymentData: any = {
      work_order_id: selectedWorkOrder.id,
      amount: paymentFormData.amount,
      transaction_date: paymentFormData.transaction_date,
      payment_method: paymentFormData.payment_method || null,
      status: paymentFormData.status,
      company_id: profile.company_id,
      user_id: user.id,
    };

    // Set the amount in the selected payment type column
    paymentData[paymentType] = paymentFormData.amount;
    // Set other payment type fields to null
    paymentData.first_payment = paymentType === 'first_payment' ? paymentFormData.amount : null;
    paymentData.second_payment = paymentType === 'second_payment' ? paymentFormData.amount : null;
    paymentData.final_payment = paymentType === 'final_payment' ? paymentFormData.amount : null;
    paymentData.additional_payment = paymentType === 'additional_payment' ? paymentFormData.amount : null;

    // Log for debugging
    console.log('Creating payment:', {
      work_order_id: selectedWorkOrder.id,
      work_order_company_id: selectedWorkOrder.company_id,
      user_company_id: profile.company_id,
      payment_type: paymentType,
      amount: paymentFormData.amount,
    });

    setPaymentFormLoading(true);
    try {
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create payment');
      }

      alert('Payment added successfully!');
      setIsAddPaymentModalOpen(false);
      setPaymentFormData({
        amount: '',
        transaction_date: new Date().toISOString().split('T')[0],
        payment_method: '',
        status: 'completed',
        first_payment: '',
        second_payment: '',
        final_payment: '',
        additional_payment: '',
      });
      setPaymentType('');
      
      // Refresh payments
      await fetchPayments(selectedWorkOrder.id);
      
      // Refresh work orders list to update status
      if (user && profile && roleName) {
        const refreshResponse = await fetch('/api/work-orders/list', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            companyId: profile.company_id,
            roleName: roleName,
          }),
        });

        if (refreshResponse.ok) {
          const refreshResult = await refreshResponse.json();
          const orders = refreshResult.workOrders || [];
          setAllWorkOrders(orders);
          setWorkOrders(orders);
          
          // Update selected work order if it's still open
          const updatedOrder = orders.find((o: WorkOrder) => o.id === selectedWorkOrder.id);
          if (updatedOrder) {
            setSelectedWorkOrder(updatedOrder);
          }
        }
      }
    } catch (error: any) {
      console.error('Error adding payment:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setPaymentFormLoading(false);
    }
  };

  const handleGenerateReceipt = async (paymentId: string) => {
    if (!profile?.company_id) {
      alert('Company information not found');
      return;
    }

    setGeneratingReceipt(paymentId);
    try {
      const response = await fetch('/api/payments/generate-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_id: paymentId,
          company_id: profile.company_id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate receipt');
      }

      alert('Receipt generated successfully!');
      
      // Refresh payments to get updated receipt info
      if (selectedWorkOrder) {
        await fetchPayments(selectedWorkOrder.id);
      }
    } catch (error: any) {
      console.error('Error generating receipt:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setGeneratingReceipt(null);
    }
  };

  const generateReceiptSignedUrl = async (pdfUrl: string): Promise<string | null> => {
    if (!pdfUrl) return null;

    try {
      // Extract file path from URL (handles both full URLs and paths)
      const filePath = extractFilePathFromUrl(pdfUrl);
      
      if (!filePath) {
        return null;
      }

      // Generate signed URL for the PDF
      const { data, error } = await supabase.storage
        .from('work-order-docs')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error || !data?.signedUrl) {
        console.error('Error generating signed URL:', error);
        return null;
      }

      return data.signedUrl;
    } catch (error: any) {
      console.error('Error generating signed URL:', error);
      return null;
    }
  };

  const handleViewReceipt = async (pdfUrl: string) => {
    if (!pdfUrl) {
      alert('Receipt PDF not available');
      return;
    }

    const signedUrl = await generateReceiptSignedUrl(pdfUrl);
    if (!signedUrl) {
      alert('Failed to generate receipt URL. Please try again.');
      return;
    }

    // Open PDF in new tab for viewing
    window.open(signedUrl, '_blank');
  };

  const handleDownloadReceipt = async (pdfUrl: string, receiptNumber: string) => {
    if (!pdfUrl) {
      alert('Receipt PDF not available');
      return;
    }

    const signedUrl = await generateReceiptSignedUrl(pdfUrl);
    if (!signedUrl) {
      alert('Failed to generate receipt URL. Please try again.');
      return;
    }

    // Trigger download only (no new tab)
    const link = document.createElement('a');
    link.href = signedUrl;
    link.download = `${receiptNumber || 'receipt'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment || !profile) return;

    setPaymentFormLoading(true);
    try {
      const response = await fetch('/api/payments/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_id: editingPayment.id,
          amount: paymentFormData.amount,
          transaction_date: paymentFormData.transaction_date,
          payment_method: paymentFormData.payment_method || null,
          status: paymentFormData.status,
          first_payment: paymentFormData.first_payment || null,
          second_payment: paymentFormData.second_payment || null,
          final_payment: paymentFormData.final_payment || null,
          additional_payment: paymentFormData.additional_payment || null,
          company_id: profile.company_id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update payment');
      }

      alert('Payment updated successfully!');
      setIsEditPaymentModalOpen(false);
      setEditingPayment(null);
      
      // Refresh payments
      if (selectedWorkOrder) {
        await fetchPayments(selectedWorkOrder.id);
      }
      
      // Refresh work orders list
      if (user && profile && roleName) {
        const refreshResponse = await fetch('/api/work-orders/list', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            companyId: profile.company_id,
            roleName: roleName,
          }),
        });

        if (refreshResponse.ok) {
          const refreshResult = await refreshResponse.json();
          const orders = refreshResult.workOrders || [];
          setAllWorkOrders(orders);
          setWorkOrders(orders);
          
          if (selectedWorkOrder) {
            const updatedOrder = orders.find((o: WorkOrder) => o.id === selectedWorkOrder.id);
            if (updatedOrder) {
              setSelectedWorkOrder(updatedOrder);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error updating payment:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setPaymentFormLoading(false);
    }
  };

  const getFileType = (url: string | null): 'image' | 'pdf' | 'unknown' => {
    if (!url) return 'unknown';
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('.pdf') || lowerUrl.includes('application/pdf')) return 'pdf';
    if (lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg') || lowerUrl.includes('.png') || lowerUrl.includes('image/')) return 'image';
    return 'unknown';
  };

  /**
   * Extracts file path from a Supabase storage URL or returns the path if already a path
   * Example: https://xxx.supabase.co/storage/v1/object/public/work-order-docs/company/receipts/file.pdf
   * Returns: company/receipts/file.pdf
   * Also handles: company/receipts/file.pdf (returns as-is)
   */
  const extractFilePathFromUrl = (url: string | null): string | null => {
    if (!url) return null;
    
    // If it's already a path (doesn't start with http), return as-is
    if (!url.startsWith('http')) {
      return url;
    }
    
    try {
      const urlObj = new URL(url);
      // Extract path after /object/public/work-order-docs/
      const pathMatch = urlObj.pathname.match(/\/object\/public\/work-order-docs\/(.+)/);
      if (pathMatch && pathMatch[1]) {
        return decodeURIComponent(pathMatch[1]);
      }
      // Extract path after /object/sign/work-order-docs/ (for signed URLs)
      const signedPathMatch = urlObj.pathname.match(/\/object\/sign\/work-order-docs\/(.+)/);
      if (signedPathMatch && signedPathMatch[1]) {
        return decodeURIComponent(signedPathMatch[1]);
      }
      // Fallback: try to extract from pathname directly
      const directMatch = urlObj.pathname.match(/work-order-docs\/(.+)/);
      if (directMatch && directMatch[1]) {
        return decodeURIComponent(directMatch[1]);
      }
      return null;
    } catch {
      // If URL parsing fails, assume it's already a path
      return url;
    }
  };

  /**
   * Generates signed URLs for all documents in a work order
   */
  const generateSignedUrls = async (order: WorkOrder) => {
    const urls: typeof signedUrls = {};

    const generateUrl = async (url: string | null, key: keyof typeof urls) => {
      if (!url) return;
      const filePath = extractFilePathFromUrl(url);
      if (!filePath) return;

      try {
        const { data, error } = await supabase.storage
          .from('work-order-docs')
          .createSignedUrl(filePath, 3600); // 1 hour expiry

        if (!error && data?.signedUrl) {
          urls[key] = data.signedUrl;
        } else if (error) {
          console.error(`Error generating signed URL for ${key}:`, error);
        }
      } catch (error) {
        console.error(`Error generating signed URL for ${key}:`, error);
      }
    };

    await Promise.all([
      generateUrl(order.aadhaar_url, 'aadhaar'),
      generateUrl(order.pan_url, 'pan'),
      generateUrl(order.bank_statement_url, 'bank_statement'),
      generateUrl(order.cancelled_check_url, 'cancelled_check'),
    ]);

    setSignedUrls(urls);
  };

  // Check if user can edit a work order
  const canEdit = (order: WorkOrder): boolean => {
    if (!user || !roleName) return false;
    
    // Inventory has read-only access
    if (roleName === 'Inventory') {
      return false;
    }
    
    // Admin and Super Admin can edit any work order in their company
    if (roleName === 'Admin' || roleName === 'Super Admin') {
      return true;
    }
    
    // Sales can only edit their own work orders
    if (roleName === 'Sales') {
      return order.sales_executive_id === user.id;
    }
    
    return false;
  };

  // Handler for marking work order as dispatched (Inventory only)
  const handleMarkDispatched = async () => {
    if (!selectedWorkOrder || !user || !profile) {
      return;
    }

    if (selectedWorkOrder.work_order_status !== 'To Be Dispatched') {
      alert('This work order is not in "To Be Dispatched" status.');
      return;
    }

    if (!confirm(`Are you sure you want to mark work order #${selectedWorkOrder.work_order_number} as Dispatched?`)) {
      return;
    }

    setMarkingDispatched(true);
    try {
      const response = await fetch('/api/work-orders/mark-dispatched', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          work_order_id: selectedWorkOrder.id,
          user_id: user.id,
          company_id: profile.company_id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to mark as dispatched');
      }

      alert('Work order marked as dispatched successfully! Customer has been notified via WhatsApp.');

      // Refresh work orders list
      if (user && profile && roleName) {
        const refreshResponse = await fetch('/api/work-orders/list', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            companyId: profile.company_id,
            roleName: roleName,
          }),
        });

        if (refreshResponse.ok) {
          const refreshResult = await refreshResponse.json();
          const orders = refreshResult.workOrders || [];
          setAllWorkOrders(orders);
          setWorkOrders(orders);

          // Update selected work order
          const updatedOrder = orders.find((o: WorkOrder) => o.id === selectedWorkOrder.id);
          if (updatedOrder) {
            setSelectedWorkOrder(updatedOrder);
          } else {
            // If order is no longer visible (e.g., filtered out), close modal
            closeDetailModal();
          }
        }
      }
    } catch (error: any) {
      console.error('Error marking as dispatched:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setMarkingDispatched(false);
    }
  };

  // Check if user can delete a work order (only Admin and Super Admin)
  const canDelete = (order: WorkOrder): boolean => {
    if (!user || !roleName) return false;
    
    // Inventory has read-only access
    if (roleName === 'Inventory') {
      return false;
    }
    
    // Only Admin and Super Admin can delete work orders
    return roleName === 'Admin' || roleName === 'Super Admin';
  };

  const openEditModal = async (order: WorkOrder) => {
    if (!canEdit(order)) {
      alert('You do not have permission to edit this work order.');
      return;
    }
    setEditingWorkOrder(order);
    setEditFormData({
      work_order_number: order.work_order_number,
      customer_name: order.customer_name,
      customer_address: order.customer_address,
      customer_phone: order.customer_phone,
      site_details: order.site_details || '',
      structure_height: order.structure_height || '',
      roof_type: order.roof_type || '',
      plant_capacity: order.plant_capacity || '',
      order_amount: order.order_amount.toString(),
      aadhaar_url: order.aadhaar_url || '',
      pan_url: order.pan_url || '',
      bank_statement_url: order.bank_statement_url || '',
      cancelled_check_url: order.cancelled_check_url || '',
    });
    setIsEditModalOpen(true);
    // Generate signed URLs for existing documents
    await generateEditSignedUrls(order);
  };

  const generateEditSignedUrls = async (order: WorkOrder) => {
    const urls: typeof editSignedUrls = {};

    const generateUrl = async (url: string | null, key: keyof typeof urls) => {
      if (!url) return;
      const filePath = extractFilePathFromUrl(url);
      if (!filePath) return;

      try {
        const { data, error } = await supabase.storage
          .from('work-order-docs')
          .createSignedUrl(filePath, 3600);

        if (!error && data?.signedUrl) {
          urls[key] = data.signedUrl;
        }
      } catch (error) {
        console.error(`Error generating signed URL for ${key}:`, error);
      }
    };

    await Promise.all([
      generateUrl(order.aadhaar_url, 'aadhaar'),
      generateUrl(order.pan_url, 'pan'),
      generateUrl(order.bank_statement_url, 'bank_statement'),
      generateUrl(order.cancelled_check_url, 'cancelled_check'),
    ]);

    setEditSignedUrls(urls);
  };

  const handleEditDocumentUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    docType: 'aadhaar' | 'pan' | 'bank_statement' | 'cancelled_check'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!profile?.company_id) {
      alert('Company ID not found. Cannot upload document.');
      return;
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('Invalid file type. Only JPG, PNG, and PDF are allowed.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert('File size exceeds 5MB limit.');
      event.target.value = '';
      return;
    }

    setEditDocumentUploading(prev => ({ ...prev, [docType]: true }));
    setEditDocumentErrors(prev => ({ ...prev, [docType]: null }));

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      const timestamp = Date.now();
      const fileName = `${docType}-${timestamp}.${fileExtension}`;
      const filePath = `${profile.company_id}/temp/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('work-order-docs')
        .upload(filePath, file, {
          upsert: true,
          cacheControl: '3600',
        });

      if (uploadError) {
        throw new Error(`Failed to upload file: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('work-order-docs')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL after upload');
      }

      // Update form data with new URL
      const fieldName = `${docType}_url` as 'aadhaar_url' | 'pan_url' | 'bank_statement_url' | 'cancelled_check_url';
      setEditFormData(prev => ({ ...prev, [fieldName]: urlData.publicUrl }));

      // Generate signed URL for immediate viewing
      const { data: signedData } = await supabase.storage
        .from('work-order-docs')
        .createSignedUrl(filePath, 3600);

      if (signedData?.signedUrl) {
        setEditSignedUrls(prev => ({ ...prev, [docType]: signedData.signedUrl }));
      }
    } catch (error: any) {
      console.error(`Upload error for ${docType}:`, error);
      setEditDocumentErrors(prev => ({ ...prev, [docType]: error.message || 'Upload failed' }));
    } finally {
      setEditDocumentUploading(prev => ({ ...prev, [docType]: false }));
      event.target.value = '';
    }
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingWorkOrder(null);
    setEditFormData({
      work_order_number: '',
      customer_name: '',
      customer_address: '',
      customer_phone: '',
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
    setEditSignedUrls({});
    setEditDocumentUploading({
      aadhaar: false,
      pan: false,
      bank_statement: false,
      cancelled_check: false,
    });
    setEditDocumentErrors({
      aadhaar: null,
      pan: null,
      bank_statement: null,
      cancelled_check: null,
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkOrder) return;

    setEditLoading(true);
    try {
      const response = await fetch('/api/work-orders/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          work_order_id: editingWorkOrder.id,
          ...editFormData,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update work order');
      }

      // Refresh the work orders list
      if (user && profile && roleName) {
        const refreshResponse = await fetch('/api/work-orders/list', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            companyId: profile.company_id,
            roleName: roleName,
          }),
        });

        if (refreshResponse.ok) {
          const refreshResult = await refreshResponse.json();
          const orders = refreshResult.workOrders || [];
          setAllWorkOrders(orders);
          setWorkOrders(orders);
        }
      }

      alert('Work order updated successfully!');
      closeEditModal();
      // Close detail modal if open
      if (isModalOpen) {
        closeDetailModal();
      }
    } catch (error: any) {
      console.error('Error updating work order:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setEditLoading(false);
    }
  };

  const openDeleteModal = (order: WorkOrder) => {
    if (!canDelete(order)) {
      alert('You do not have permission to delete this work order.');
      return;
    }
    setDeletingWorkOrder(order);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setDeletingWorkOrder(null);
  };

  const handleDelete = async () => {
    if (!deletingWorkOrder || !user || !profile || !roleName) return;

    setDeleteLoading(true);
    try {
      const response = await fetch('/api/work-orders/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          work_order_id: deletingWorkOrder.id,
          userId: user.id,
          companyId: profile.company_id,
          roleName: roleName,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete work order');
      }

      // Remove from local state
      setWorkOrders(workOrders.filter(order => order.id !== deletingWorkOrder.id));
      setAllWorkOrders(allWorkOrders.filter(order => order.id !== deletingWorkOrder.id));

      alert('Work order deleted successfully!');
      closeDeleteModal();
      // Close detail modal if open
      if (isModalOpen && selectedWorkOrder?.id === deletingWorkOrder.id) {
        closeDetailModal();
      }
    } catch (error: any) {
      console.error('Error deleting work order:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const openDispatchModal = (order: WorkOrder) => {
    if (order.work_order_status !== 'To Be Dispatched') {
      return;
    }
    setDispatchingWorkOrder(order);
    setIsDispatchModalOpen(true);
  };

  const closeDispatchModal = () => {
    setIsDispatchModalOpen(false);
    setDispatchingWorkOrder(null);
  };

  const handleConfirmDispatch = async () => {
    if (!dispatchingWorkOrder || !user || !profile) return;

    setDispatchLoading(true);
    try {
      const response = await fetch('/api/work-orders/mark-dispatched', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          work_order_id: dispatchingWorkOrder.id,
          user_id: user.id,
          company_id: profile.company_id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to mark as dispatched');
      }

      // Update local state
      const updatedOrders = workOrders.map(order => 
        order.id === dispatchingWorkOrder.id 
          ? { ...order, work_order_status: 'Dispatched' }
          : order
      );
      setWorkOrders(updatedOrders);
      
      const updatedAllOrders = allWorkOrders.map(order => 
        order.id === dispatchingWorkOrder.id 
          ? { ...order, work_order_status: 'Dispatched' }
          : order
      );
      setAllWorkOrders(updatedAllOrders);

      alert('Work order marked as dispatched successfully! WhatsApp messages have been sent.');
      closeDispatchModal();
      
      // Close detail modal if open and update it
      if (isModalOpen && selectedWorkOrder?.id === dispatchingWorkOrder.id) {
        const updatedSelected = updatedOrders.find(o => o.id === dispatchingWorkOrder.id);
        if (updatedSelected) {
          setSelectedWorkOrder(updatedSelected);
        }
      }
    } catch (error: any) {
      console.error('Error marking as dispatched:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setDispatchLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading work orders..." />;
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Work Orders"
        rightAction={
          roleName !== 'Inventory' ? (
            <Button
              asLink
              href="/dashboard/work-orders"
              variant="primary"
              size="sm"
            >
              Create New
            </Button>
          ) : null
        }
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
          <h2 className="text-2xl font-bold text-foreground">Work Orders</h2>
          <p className="mt-2 text-foreground opacity-70">
            View and manage all work orders
                {hasActiveFilters && (
                  <span className="ml-2 text-sm">
                    ({workOrders.length} of {allWorkOrders.length} shown)
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Search and Filter Section */}
        <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4">
          <div className="space-y-4">
            {/* Search Bar */}
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-foreground mb-2">
                Search
              </label>
              <input
                type="text"
                id="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by customer name, order ID, phone, company, address..."
                className="block w-full rounded-md border border-border bg-white px-3 py-2 text-foreground placeholder-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            {/* Filter Row */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Company Filter */}
              <div>
                <label htmlFor="filter-company" className="block text-sm font-medium text-foreground mb-2">
                  Company
                </label>
                <select
                  id="filter-company"
                  value={filterCompany}
                  onChange={(e) => setFilterCompany(e.target.value)}
                  className="block w-full rounded-md border border-border bg-white px-3 py-2 text-foreground placeholder-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200"
                >
                  <option value="">All Companies</option>
                  {uniqueCompanies.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sales Executive Filter (only for Admin/Super Admin) */}
              {roleName !== 'Sales' && (
                <div>
                  <label htmlFor="filter-sales-exec" className="block text-sm font-medium text-foreground mb-2">
                    Sales Executive
                  </label>
                  <select
                    id="filter-sales-exec"
                    value={filterSalesExecutive}
                    onChange={(e) => setFilterSalesExecutive(e.target.value)}
                    className="block w-full rounded-md border border-border bg-white px-3 py-2 text-foreground placeholder-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200"
                  >
                    <option value="">All Sales Executives</option>
                    {uniqueSalesExecutives.map((exec) => (
                      <option key={exec} value={exec}>
                        {exec}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Plant Capacity Filter */}
              <div>
                <label htmlFor="filter-plant-capacity" className="block text-sm font-medium text-foreground mb-2">
                  Plant Capacity
                </label>
                <select
                  id="filter-plant-capacity"
                  value={filterPlantCapacity}
                  onChange={(e) => setFilterPlantCapacity(e.target.value)}
                  className="block w-full rounded-md border border-border bg-white px-3 py-2 text-foreground placeholder-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200"
                >
                  <option value="">All Capacities</option>
                  {uniquePlantCapacities.map((capacity) => (
                    <option key={capacity} value={capacity}>
                      {capacity}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <div>
                <button
                  onClick={clearFilters}
                  className="text-sm text-[#0BC28E] hover:text-[#0aa578] underline transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </div>

        {workOrders.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center">
            <p className="text-foreground opacity-70">No work orders found.</p>
            {roleName !== 'Inventory' && (
              <Link
                href="/dashboard/work-orders"
                className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
              >
                Create Your First Work Order
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200">
                <thead className="bg-[#F8F9FA]">
                  <tr>
                    {roleName === 'Inventory' && (
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                        Dispatched
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                      Work Order #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                      Company
                    </th>
                    {roleName !== 'Sales' && (
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                        Sales Executive
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                      Site Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                      Structure Height
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                      Roof Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                      Plant Capacity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {workOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-white transition-colors duration-150 cursor-pointer">
                      {roleName === 'Inventory' && (
                        <td className="whitespace-nowrap px-6 py-4 text-sm">
                          <input
                            type="checkbox"
                            checked={order.work_order_status === 'Dispatched'}
                            onChange={(e) => {
                              e.stopPropagation();
                              // Checkbox is controlled, so it won't change until status updates
                              if (!e.target.checked) return; // Only allow checking, not unchecking
                              if (order.work_order_status === 'To Be Dispatched') {
                                openDispatchModal(order);
                              }
                            }}
                            disabled={order.work_order_status !== 'To Be Dispatched'}
                            className="h-4 w-4 rounded border-zinc-300 text-[#0BC28E] focus:ring-[#0BC28E] focus:ring-offset-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </td>
                      )}
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-foreground">
                        {order.work_order_number}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        {order.work_order_status ? (
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            order.work_order_status === 'To Be Dispatched' 
                              ? 'bg-green-100 text-green-800' 
                              : order.work_order_status === 'Dispatched'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {order.work_order_status}
                          </span>
                        ) : (
                          <span className="text-[#1E1E1E] opacity-50">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground opacity-70">
                        <div>
                          <div className="font-medium text-foreground">
                            {order.customer_name}
                          </div>
                          <div className="text-xs text-foreground opacity-70">
                            {order.customer_address}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground opacity-70">
                        {order.customer_phone}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground opacity-70">
                        {order.company_name || 'N/A'}
                      </td>
                      {roleName !== 'Sales' && (
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground opacity-70">
                          {order.sales_executive_name || 'N/A'}
                        </td>
                      )}
                      <td className="px-6 py-4 text-sm text-foreground opacity-70">
                        <div className="max-w-xs truncate" title={order.site_details || 'N/A'}>
                          {order.site_details || 'N/A'}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground opacity-70">
                        {order.structure_height || 'N/A'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground opacity-70">
                        {order.roof_type || 'N/A'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground opacity-70">
                        {order.plant_capacity || 'N/A'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-foreground">
                        {formatCurrency(order.order_amount)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground opacity-70">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openDetailModal(order)}
                            className="text-[#1E1E1E] hover:text-[#0BC28E] transition-colors duration-150"
                            title="View Details"
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
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          </button>
                          {canEdit(order) && (
                            <button
                              onClick={() => openEditModal(order)}
                              className="text-blue-600 hover:text-blue-700 transition-colors duration-150"
                              title="Edit Work Order"
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
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                          )}
                          {canDelete(order) && (
                            <button
                              onClick={() => openDeleteModal(order)}
                              className="text-red-600 hover:text-red-700 transition-colors duration-150"
                              title="Delete Work Order"
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
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detail View Modal */}
        {isModalOpen && selectedWorkOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/30 backdrop-blur-md p-4">
            <div className="relative max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-xl">
              {/* Modal Header */}
              <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-8 py-5">
                <h3 className="text-2xl font-bold text-[#1E1E1E]">
                  Work Order Details - {selectedWorkOrder.work_order_number}
                </h3>
                <button
                  onClick={closeDetailModal}
                  className="text-[#1E1E1E] opacity-70 hover:text-[#0BC28E] transition-colors duration-200"
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

              {/* Modal Content */}
              <div className="p-8">
                <div className="grid gap-8 md:grid-cols-2">
                  {/* Basic Information */}
                  <div className="space-y-5">
                    <h4 className="text-xl font-bold text-[#1E1E1E] border-b border-zinc-200 pb-2">Basic Information</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-[#1E1E1E] opacity-80 mb-1">Work Order Number</label>
                        <p className="text-base text-[#1E1E1E] font-medium">{selectedWorkOrder.work_order_number}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#1E1E1E] opacity-80 mb-1">Customer Name</label>
                        <p className="text-base text-[#1E1E1E] font-medium">{selectedWorkOrder.customer_name}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#1E1E1E] opacity-80 mb-1">Customer Address</label>
                        <p className="text-base text-[#1E1E1E] font-medium">{selectedWorkOrder.customer_address}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#1E1E1E] opacity-80 mb-1">Customer Phone</label>
                        <p className="text-base text-[#1E1E1E] font-medium">{selectedWorkOrder.customer_phone}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#1E1E1E] opacity-80 mb-1">Company</label>
                        <p className="text-base text-[#1E1E1E] font-medium">{selectedWorkOrder.company_name || 'N/A'}</p>
                      </div>
                      {roleName !== 'Sales' && (
                        <div>
                          <label className="block text-sm font-semibold text-[#1E1E1E] opacity-80 mb-1">Sales Executive</label>
                          <p className="text-base text-[#1E1E1E] font-medium">{selectedWorkOrder.sales_executive_name || 'N/A'}</p>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-semibold text-[#1E1E1E] opacity-80 mb-1">Order Amount</label>
                        <p className="text-lg font-bold text-[#1E1E1E]">{formatCurrency(selectedWorkOrder.order_amount)}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#1E1E1E] opacity-80 mb-1">Created At</label>
                        <p className="text-base text-[#1E1E1E] font-medium">{formatDate(selectedWorkOrder.created_at)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Site Details */}
                  <div className="space-y-5">
                    <h4 className="text-xl font-bold text-[#1E1E1E] border-b border-zinc-200 pb-2">Site Details</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-[#1E1E1E] opacity-80 mb-1">Site Details</label>
                        <p className="text-base text-[#1E1E1E] font-medium">{selectedWorkOrder.site_details || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#1E1E1E] opacity-80 mb-1">Structure Height</label>
                        <p className="text-base text-[#1E1E1E] font-medium">{selectedWorkOrder.structure_height || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#1E1E1E] opacity-80 mb-1">Roof Type</label>
                        <p className="text-base text-[#1E1E1E] font-medium">{selectedWorkOrder.roof_type || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#1E1E1E] opacity-80 mb-1">Plant Capacity</label>
                        <p className="text-base text-[#1E1E1E] font-medium">{selectedWorkOrder.plant_capacity || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Documents Section */}
                <div className="mt-8 border-t border-zinc-200 pt-6">
                  <h4 className="mb-4 text-lg font-semibold text-[#1E1E1E]">Documents</h4>
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Aadhaar */}
                    {selectedWorkOrder.aadhaar_url && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-[#1E1E1E]">Aadhaar Document</label>
                        <div className="rounded-lg border border-zinc-200 bg-white p-4">
                          {signedUrls.aadhaar ? (
                            <>
                              {getFileType(selectedWorkOrder.aadhaar_url) === 'image' ? (
                                <img
                                  src={signedUrls.aadhaar}
                                  alt="Aadhaar"
                                  className="mb-2 max-h-64 w-full rounded object-contain"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : getFileType(selectedWorkOrder.aadhaar_url) === 'pdf' ? (
                                <iframe
                                  src={signedUrls.aadhaar}
                                  className="mb-2 h-64 w-full rounded"
                                  title="Aadhaar PDF"
                                />
                              ) : null}
                              <a
                                href={signedUrls.aadhaar}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 hover:underline transition-colors duration-150"
                              >
                                View Document
                                <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            </>
                          ) : (
                            <p className="text-sm text-[#1E1E1E] opacity-70">Loading document...</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* PAN */}
                    {selectedWorkOrder.pan_url && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-[#1E1E1E]">PAN Document</label>
                        <div className="rounded-lg border border-zinc-200 bg-white p-4">
                          {signedUrls.pan ? (
                            <>
                              {getFileType(selectedWorkOrder.pan_url) === 'image' ? (
                                <img
                                  src={signedUrls.pan}
                                  alt="PAN"
                                  className="mb-2 max-h-64 w-full rounded object-contain"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : getFileType(selectedWorkOrder.pan_url) === 'pdf' ? (
                                <iframe
                                  src={signedUrls.pan}
                                  className="mb-2 h-64 w-full rounded"
                                  title="PAN PDF"
                                />
                              ) : null}
                              <a
                                href={signedUrls.pan}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 hover:underline transition-colors duration-150"
                              >
                                View Document
                                <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            </>
                          ) : (
                            <p className="text-sm text-[#1E1E1E] opacity-70">Loading document...</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Bank Statement */}
                    {selectedWorkOrder.bank_statement_url && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-[#1E1E1E]">Bank Statement</label>
                        <div className="rounded-lg border border-zinc-200 bg-white p-4">
                          {signedUrls.bank_statement ? (
                            <>
                              {getFileType(selectedWorkOrder.bank_statement_url) === 'image' ? (
                                <img
                                  src={signedUrls.bank_statement}
                                  alt="Bank Statement"
                                  className="mb-2 max-h-64 w-full rounded object-contain"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : getFileType(selectedWorkOrder.bank_statement_url) === 'pdf' ? (
                                <iframe
                                  src={signedUrls.bank_statement}
                                  className="mb-2 h-64 w-full rounded"
                                  title="Bank Statement PDF"
                                />
                              ) : null}
                              <a
                                href={signedUrls.bank_statement}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 hover:underline transition-colors duration-150"
                              >
                                View Document
                                <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            </>
                          ) : (
                            <p className="text-sm text-[#1E1E1E] opacity-70">Loading document...</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Cancelled Check */}
                    {selectedWorkOrder.cancelled_check_url && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-[#1E1E1E]">Cancelled Check</label>
                        <div className="rounded-lg border border-zinc-200 bg-white p-4">
                          {signedUrls.cancelled_check ? (
                            <>
                              {getFileType(selectedWorkOrder.cancelled_check_url) === 'image' ? (
                                <img
                                  src={signedUrls.cancelled_check}
                                  alt="Cancelled Check"
                                  className="mb-2 max-h-64 w-full rounded object-contain"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : getFileType(selectedWorkOrder.cancelled_check_url) === 'pdf' ? (
                                <iframe
                                  src={signedUrls.cancelled_check}
                                  className="mb-2 h-64 w-full rounded"
                                  title="Cancelled Check PDF"
                                />
                              ) : null}
                              <a
                                href={signedUrls.cancelled_check}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 hover:underline transition-colors duration-150"
                              >
                                View Document
                                <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            </>
                          ) : (
                            <p className="text-sm text-[#1E1E1E] opacity-70">Loading document...</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {!selectedWorkOrder.aadhaar_url && !selectedWorkOrder.pan_url && !selectedWorkOrder.bank_statement_url && !selectedWorkOrder.cancelled_check_url && (
                    <p className="text-sm text-[#1E1E1E] opacity-70">No documents uploaded</p>
                  )}
                </div>
              </div>

              {/* Payments Section */}
              <div className="mt-8 border-t border-zinc-200 pt-6">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-[#1E1E1E]">Payments</h4>
                  {roleName === 'Admin' || roleName === 'Super Admin' ? (
                    <button
                      onClick={() => {
      setPaymentFormData({
        amount: '',
        transaction_date: new Date().toISOString().split('T')[0],
        payment_method: '',
        status: 'completed',
        first_payment: '',
        second_payment: '',
        final_payment: '',
        additional_payment: '',
      });
      setPaymentType('');
      setIsAddPaymentModalOpen(true);
                      }}
                      className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                    >
                      Add Payment
                    </button>
                  ) : null}
                </div>

                {/* Payments List */}
                {paymentsLoading ? (
                  <p className="text-sm text-[#1E1E1E] opacity-70">Loading payments...</p>
                ) : payments.length === 0 ? (
                  <p className="text-sm text-[#1E1E1E] opacity-70">No payments recorded</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-zinc-200">
                      <thead className="bg-[#F8F9FA]">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#1E1E1E] opacity-70">
                            Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#1E1E1E] opacity-70">
                            Amount
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#1E1E1E] opacity-70">
                            Method
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#1E1E1E] opacity-70">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#1E1E1E] opacity-70">
                            Receipt No.
                          </th>
                          {(roleName === 'Admin' || roleName === 'Super Admin') && (
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#1E1E1E] opacity-70">
                              Actions
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 bg-white">
                        {payments.map((payment) => (
                          <tr key={payment.id} className="hover:bg-white transition-colors duration-150">
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-[#1E1E1E] opacity-70">
                              {formatDate(payment.transaction_date)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-[#1E1E1E]">
                              ₹{payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-[#1E1E1E] opacity-70 capitalize">
                              {payment.payment_method || 'N/A'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-[#1E1E1E] opacity-70 capitalize">
                              {payment.status}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-[#1E1E1E] opacity-70">
                              {payment.receipt_number || '-'}
                            </td>
                            {(roleName === 'Admin' || roleName === 'Super Admin') && (
                              <td className="whitespace-nowrap px-4 py-3 text-sm">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingPayment(payment);
                                      setPaymentFormData({
                                        amount: payment.amount.toString(),
                                        transaction_date: payment.transaction_date,
                                        payment_method: payment.payment_method || '',
                                        status: payment.status,
                                        first_payment: payment.first_payment?.toString() || '',
                                        second_payment: payment.second_payment?.toString() || '',
                                        final_payment: payment.final_payment?.toString() || '',
                                        additional_payment: payment.additional_payment?.toString() || '',
                                      });
                                      setIsEditPaymentModalOpen(true);
                                    }}
                                    className="text-blue-600 hover:text-blue-700 transition-colors duration-150"
                                    title="Edit Payment"
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
                                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                      />
                                    </svg>
                                  </button>
                                  {!payment.pdf_url ? (
                                    <button
                                      onClick={() => handleGenerateReceipt(payment.id)}
                                      disabled={generatingReceipt === payment.id}
                                      className="text-green-600 hover:text-green-900 hover:text-green-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Generate Receipt"
                                    >
                                      {generatingReceipt === payment.id ? (
                                        <svg
                                          className="h-5 w-5 animate-spin"
                                          xmlns="http://www.w3.org/2000/svg"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                        >
                                          <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                          />
                                          <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                          />
                                        </svg>
                                      ) : (
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
                                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                          />
                                        </svg>
                                      )}
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => handleViewReceipt(payment.pdf_url!)}
                                        className="text-blue-600 hover:text-blue-700 transition-colors duration-150"
                                        title="View Receipt"
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
                                        onClick={() => handleDownloadReceipt(payment.pdf_url!, payment.receipt_number || 'receipt')}
                                        className="text-purple-600 hover:text-purple-900 hover:text-purple-700 transition-colors duration-150"
                                        title="Download Receipt"
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
                                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                          />
                                        </svg>
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 border-t border-zinc-200 bg-white px-6 py-4">
                <div className="flex items-center justify-between">
                  <button
                    onClick={closeDetailModal}
                    className="rounded-md bg-[#0BC28E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0aa578] transition-colors duration-200"
                  >
                    Close
                  </button>
                  <div className="flex gap-2">
                    {/* Inventory: Mark as Dispatched button */}
                    {selectedWorkOrder && roleName === 'Inventory' && selectedWorkOrder.work_order_status === 'To Be Dispatched' && (
                      <button
                        onClick={handleMarkDispatched}
                        disabled={markingDispatched}
                        className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                      >
                        {markingDispatched ? 'Marking...' : 'Mark as Dispatched'}
                      </button>
                    )}
                    {/* Admin/Super Admin: Edit and Delete buttons */}
                    {selectedWorkOrder && (canEdit(selectedWorkOrder) || canDelete(selectedWorkOrder)) && (
                      <>
                        {canEdit(selectedWorkOrder) && (
                          <button
                            onClick={() => {
                              closeDetailModal();
                              openEditModal(selectedWorkOrder);
                            }}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                          >
                            Edit
                          </button>
                        )}
                        {canDelete(selectedWorkOrder) && (
                          <button
                            onClick={() => {
                              closeDetailModal();
                              openDeleteModal(selectedWorkOrder);
                            }}
                            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                          >
                            Delete
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {isEditModalOpen && editingWorkOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/30 backdrop-blur-md p-4">
            <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-xl">
              <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
                <h3 className="text-xl font-bold text-[#1E1E1E]">
                  Edit Work Order - {editingWorkOrder.work_order_number}
                </h3>
                <button
                  onClick={closeEditModal}
                  className="text-[#1E1E1E] opacity-70 hover:text-[#0BC28E] transition-colors duration-200"
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

              <form onSubmit={handleEditSubmit} className="p-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-[#1E1E1E]">
                      Work Order Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editFormData.work_order_number}
                      onChange={(e) => setEditFormData({ ...editFormData, work_order_number: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-[#1E1E1E]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#1E1E1E]">
                      Customer Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editFormData.customer_name}
                      onChange={(e) => setEditFormData({ ...editFormData, customer_name: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-[#1E1E1E]"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-[#1E1E1E]">
                      Customer Address <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      value={editFormData.customer_address}
                      onChange={(e) => setEditFormData({ ...editFormData, customer_address: e.target.value })}
                      rows={3}
                      className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-[#1E1E1E]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#1E1E1E]">
                      Customer Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={editFormData.customer_phone}
                      onChange={(e) => setEditFormData({ ...editFormData, customer_phone: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-[#1E1E1E]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#1E1E1E]">
                      Order Amount <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editFormData.order_amount}
                      onChange={(e) => setEditFormData({ ...editFormData, order_amount: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-[#1E1E1E]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#1E1E1E]">
                      Structure Height
                    </label>
                    <input
                      type="text"
                      value={editFormData.structure_height}
                      onChange={(e) => setEditFormData({ ...editFormData, structure_height: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-[#1E1E1E]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#1E1E1E]">
                      Roof Type
                    </label>
                    <input
                      type="text"
                      value={editFormData.roof_type}
                      onChange={(e) => setEditFormData({ ...editFormData, roof_type: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-[#1E1E1E]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#1E1E1E]">
                      Plant Capacity
                    </label>
                    <input
                      type="text"
                      value={editFormData.plant_capacity}
                      onChange={(e) => setEditFormData({ ...editFormData, plant_capacity: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-[#1E1E1E]"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-[#1E1E1E]">
                      Site Details
                    </label>
                    <textarea
                      value={editFormData.site_details}
                      onChange={(e) => setEditFormData({ ...editFormData, site_details: e.target.value })}
                      rows={4}
                      className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-[#1E1E1E]"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-[#1E1E1E] mb-3">
                      Document Uploads
                    </label>
                    <div className="space-y-3">
                      {/* Aadhaar Upload */}
                      <div>
                        <label htmlFor="edit_aadhaar_file" className="block text-xs font-medium text-[#1E1E1E] opacity-70 mb-1">
                          Aadhaar Document
                        </label>
                        <input
                          id="edit_aadhaar_file"
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => handleEditDocumentUpload(e, 'aadhaar')}
                          disabled={editDocumentUploading.aadhaar}
                          className="block w-full text-sm text-[#1E1E1E] opacity-70 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-white file:text-[#1E1E1E] hover:file:bg-zinc-100 disabled:opacity-50"
                        />
                        {editDocumentUploading.aadhaar && <p className="mt-1 text-sm text-blue-500">Uploading...</p>}
                        {editDocumentErrors.aadhaar && <p className="mt-1 text-sm text-red-500">{editDocumentErrors.aadhaar}</p>}
                        {editFormData.aadhaar_url && !editDocumentUploading.aadhaar && (
                          <p className="mt-1 text-sm text-green-500">
                            {editSignedUrls.aadhaar ? (
                              <>
                                Uploaded! <a href={editSignedUrls.aadhaar} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">View document</a>
                              </>
                            ) : (
                              'Uploaded! (Generating view link...)'
                            )}
                          </p>
                        )}
                      </div>

                      {/* PAN Upload */}
                      <div>
                        <label htmlFor="edit_pan_file" className="block text-xs font-medium text-[#1E1E1E] opacity-70 mb-1">
                          PAN Document
                        </label>
                        <input
                          id="edit_pan_file"
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => handleEditDocumentUpload(e, 'pan')}
                          disabled={editDocumentUploading.pan}
                          className="block w-full text-sm text-[#1E1E1E] opacity-70 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-white file:text-[#1E1E1E] hover:file:bg-zinc-100 disabled:opacity-50"
                        />
                        {editDocumentUploading.pan && <p className="mt-1 text-sm text-blue-500">Uploading...</p>}
                        {editDocumentErrors.pan && <p className="mt-1 text-sm text-red-500">{editDocumentErrors.pan}</p>}
                        {editFormData.pan_url && !editDocumentUploading.pan && (
                          <p className="mt-1 text-sm text-green-500">
                            {editSignedUrls.pan ? (
                              <>
                                Uploaded! <a href={editSignedUrls.pan} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">View document</a>
                              </>
                            ) : (
                              'Uploaded! (Generating view link...)'
                            )}
                          </p>
                        )}
                      </div>

                      {/* Bank Statement Upload */}
                      <div>
                        <label htmlFor="edit_bank_statement_file" className="block text-xs font-medium text-[#1E1E1E] opacity-70 mb-1">
                          Bank Statement Document
                        </label>
                        <input
                          id="edit_bank_statement_file"
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => handleEditDocumentUpload(e, 'bank_statement')}
                          disabled={editDocumentUploading.bank_statement}
                          className="block w-full text-sm text-[#1E1E1E] opacity-70 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-white file:text-[#1E1E1E] hover:file:bg-zinc-100 disabled:opacity-50"
                        />
                        {editDocumentUploading.bank_statement && <p className="mt-1 text-sm text-blue-500">Uploading...</p>}
                        {editDocumentErrors.bank_statement && <p className="mt-1 text-sm text-red-500">{editDocumentErrors.bank_statement}</p>}
                        {editFormData.bank_statement_url && !editDocumentUploading.bank_statement && (
                          <p className="mt-1 text-sm text-green-500">
                            {editSignedUrls.bank_statement ? (
                              <>
                                Uploaded! <a href={editSignedUrls.bank_statement} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">View document</a>
                              </>
                            ) : (
                              'Uploaded! (Generating view link...)'
                            )}
                          </p>
                        )}
                      </div>

                      {/* Cancelled Check Upload */}
                      <div>
                        <label htmlFor="edit_cancelled_check_file" className="block text-xs font-medium text-[#1E1E1E] opacity-70 mb-1">
                          Cancelled Check Document
                        </label>
                        <input
                          id="edit_cancelled_check_file"
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => handleEditDocumentUpload(e, 'cancelled_check')}
                          disabled={editDocumentUploading.cancelled_check}
                          className="block w-full text-sm text-[#1E1E1E] opacity-70 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-white file:text-[#1E1E1E] hover:file:bg-zinc-100 disabled:opacity-50"
                        />
                        {editDocumentUploading.cancelled_check && <p className="mt-1 text-sm text-blue-500">Uploading...</p>}
                        {editDocumentErrors.cancelled_check && <p className="mt-1 text-sm text-red-500">{editDocumentErrors.cancelled_check}</p>}
                        {editFormData.cancelled_check_url && !editDocumentUploading.cancelled_check && (
                          <p className="mt-1 text-sm text-green-500">
                            {editSignedUrls.cancelled_check ? (
                              <>
                                Uploaded! <a href={editSignedUrls.cancelled_check} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">View document</a>
                              </>
                            ) : (
                              'Uploaded! (Generating view link...)'
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-4">
                  <button
                    type="submit"
                    disabled={editLoading}
                    className="rounded-md bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {editLoading ? 'Updating...' : 'Update Work Order'}
                  </button>
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="rounded-md border border-zinc-300 px-6 py-2 text-sm font-semibold text-[#1E1E1E] hover:bg-white hover:bg-white transition-colors duration-150"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {isDeleteModalOpen && deletingWorkOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/30 backdrop-blur-md p-4">
            <div className="relative w-full max-w-md rounded-lg border border-zinc-200 bg-white shadow-xl">
              <div className="p-6">
                <h3 className="text-lg font-bold text-[#1E1E1E] mb-2">
                  Delete Work Order
                </h3>
                <p className="text-sm text-[#1E1E1E] opacity-70 mb-4">
                  Are you sure you want to delete work order <strong>{deletingWorkOrder.work_order_number}</strong>? This action cannot be undone.
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={handleDelete}
                    disabled={deleteLoading}
                    className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleteLoading ? 'Deleting...' : 'Delete'}
                  </button>
                  <button
                    onClick={closeDeleteModal}
                    disabled={deleteLoading}
                    className="flex-1 rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-[#1E1E1E] hover:bg-white hover:bg-white transition-colors duration-150 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dispatch Confirmation Modal */}
        {isDispatchModalOpen && dispatchingWorkOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/30 backdrop-blur-md p-4">
            <div className="relative w-full max-w-md rounded-lg border border-zinc-200 bg-white shadow-xl">
              <div className="p-6">
                <h3 className="text-lg font-bold text-[#1E1E1E] mb-2">
                  Confirm Dispatch
                </h3>
                <p className="text-sm text-[#1E1E1E] opacity-70 mb-4">
                  Are you sure you want to mark work order <strong>{dispatchingWorkOrder.work_order_number}</strong> as Dispatched? This will send WhatsApp messages to the customer, admin, and sales executive.
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={handleConfirmDispatch}
                    disabled={dispatchLoading}
                    className="flex-1 rounded-md bg-[#0BC28E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0aa075] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {dispatchLoading ? 'Dispatching...' : 'OK'}
                  </button>
                  <button
                    onClick={closeDispatchModal}
                    disabled={dispatchLoading}
                    className="flex-1 rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-[#1E1E1E] hover:bg-white transition-colors duration-150 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Payment Modal */}
        {isAddPaymentModalOpen && selectedWorkOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/30 backdrop-blur-md p-4">
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-xl">
              {/* Modal Header */}
              <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-8 py-5">
                <h3 className="text-2xl font-bold text-[#1E1E1E]">
                  Add Payment - {selectedWorkOrder.work_order_number}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddPaymentModalOpen(false)}
                  disabled={paymentFormLoading}
                  className="text-[#1E1E1E] opacity-70 hover:text-[#1E1E1E] disabled:opacity-50"
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
              
              {/* Modal Body */}
              <div className="p-8">
                <form onSubmit={handleAddPayment} className="space-y-6">
                  {/* Amount Information Row */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Work Order Amount */}
                    <div>
                      <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                        Work Order Amount
                      </label>
                      <div className="flex items-center rounded-lg border-2 border-zinc-300 bg-white px-4 py-3 text-lg">
                        <span className="mr-2 text-xl font-bold">₹</span>
                        <span className="font-bold text-[#1E1E1E]">
                          {selectedWorkOrder.order_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Total Due Amount */}
                    <div>
                      <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                        Total Due Amount
                      </label>
                      <div className="flex items-center rounded-lg border-2 border-red-300 bg-red-50 px-4 py-3 text-lg">
                        <span className="mr-2 text-xl font-bold text-red-600">₹</span>
                        <span className="font-bold text-red-600">
                          {(() => {
                            const orderAmount = parseFloat(selectedWorkOrder.order_amount.toString());
                            const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
                            const dueAmount = orderAmount - totalPaid;
                            return dueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Details Row */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Payment Type Dropdown */}
                    <div>
                      <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                        Payment Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={paymentType}
                        onChange={(e) => {
                          setPaymentType(e.target.value);
                          // Clear amount when changing payment type
                          setPaymentFormData({ ...paymentFormData, amount: '' });
                        }}
                        className="block w-full rounded-lg border-2 border-zinc-300 bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                      >
                        <option value="">Select payment type</option>
                        <option value="first_payment">First Payment</option>
                        <option value="second_payment">Second Payment</option>
                        <option value="final_payment">Final Payment</option>
                        <option value="additional_payment">Additional Payment</option>
                      </select>
                    </div>

                    {/* Payment Amount (conditional based on payment type) */}
                    {paymentType && (
                      <div>
                        <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                          Payment Amount <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-[#1E1E1E] opacity-70">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={paymentFormData.amount}
                            onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                            className="block w-full rounded-lg border-2 border-zinc-300 bg-white pl-10 pr-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Transaction Details Row */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Transaction Date */}
                    <div>
                      <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                        Transaction Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={paymentFormData.transaction_date}
                        onChange={(e) => setPaymentFormData({ ...paymentFormData, transaction_date: e.target.value })}
                        className="block w-full rounded-lg border-2 border-zinc-300 bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                      />
                    </div>

                    {/* Payment Method */}
                    <div>
                      <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                        Payment Method
                      </label>
                      <select
                        value={paymentFormData.payment_method}
                        onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_method: e.target.value })}
                        className="block w-full rounded-lg border-2 border-zinc-300 bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                      >
                        <option value="">Select method</option>
                        <option value="cash">Cash</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="cheque">Cheque</option>
                        <option value="online">Online</option>
                        <option value="upi">UPI</option>
                        <option value="card">Card</option>
                      </select>
                    </div>
                  </div>

                  {/* Status Row */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                        Status
                      </label>
                      <select
                        value={paymentFormData.status}
                        onChange={(e) => setPaymentFormData({ ...paymentFormData, status: e.target.value })}
                        className="block w-full rounded-lg border-2 border-zinc-300 bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                      >
                        <option value="completed">Completed</option>
                        <option value="pending">Pending</option>
                        <option value="failed">Failed</option>
                      </select>
                    </div>
                    <div></div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4 pt-6">
                    <button
                      type="submit"
                      disabled={paymentFormLoading}
                      className="flex-1 rounded-lg bg-green-600 px-6 py-3 text-base font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                    >
                      {paymentFormLoading ? 'Adding...' : 'Add Payment'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddPaymentModalOpen(false)}
                      disabled={paymentFormLoading}
                      className="flex-1 rounded-lg border-2 border-zinc-300 px-6 py-3 text-base font-semibold text-[#1E1E1E] hover:bg-zinc-50 transition-colors duration-150 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Edit Payment Modal */}
        {isEditPaymentModalOpen && editingPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/30 backdrop-blur-md p-4">
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-xl">
              {/* Modal Header */}
              <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-8 py-5">
                <h3 className="text-2xl font-bold text-[#1E1E1E]">
                  Edit Payment
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditPaymentModalOpen(false);
                    setEditingPayment(null);
                  }}
                  disabled={paymentFormLoading}
                  className="text-[#1E1E1E] opacity-70 hover:text-[#1E1E1E] disabled:opacity-50"
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
              
              {/* Modal Body */}
              <div className="p-8">
                <form onSubmit={handleUpdatePayment} className="space-y-6">
                  {/* Payment Details Row */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                        Payment Amount <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-[#1E1E1E] opacity-70">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={paymentFormData.amount}
                          onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                          className="block w-full rounded-lg border-2 border-zinc-300 bg-white pl-10 pr-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                        Transaction Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={paymentFormData.transaction_date}
                        onChange={(e) => setPaymentFormData({ ...paymentFormData, transaction_date: e.target.value })}
                        className="block w-full rounded-lg border-2 border-zinc-300 bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                      />
                    </div>
                  </div>

                  {/* Payment Method and Status Row */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                        Payment Method
                      </label>
                      <select
                        value={paymentFormData.payment_method}
                        onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_method: e.target.value })}
                        className="block w-full rounded-lg border-2 border-zinc-300 bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                      >
                        <option value="">Select method</option>
                        <option value="cash">Cash</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="cheque">Cheque</option>
                        <option value="online">Online</option>
                        <option value="upi">UPI</option>
                        <option value="card">Card</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                        Status
                      </label>
                      <select
                        value={paymentFormData.status}
                        onChange={(e) => setPaymentFormData({ ...paymentFormData, status: e.target.value })}
                        className="block w-full rounded-lg border-2 border-zinc-300 bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                      >
                        <option value="completed">Completed</option>
                        <option value="pending">Pending</option>
                        <option value="failed">Failed</option>
                      </select>
                    </div>
                  </div>

                  {/* Payment Type Amounts */}
                  <div>
                    <h4 className="text-lg font-semibold text-[#1E1E1E] mb-4">Payment Type Amounts</h4>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                          First Payment
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-[#1E1E1E] opacity-70">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            value={paymentFormData.first_payment}
                            onChange={(e) => setPaymentFormData({ ...paymentFormData, first_payment: e.target.value })}
                            className="block w-full rounded-lg border-2 border-zinc-300 bg-white pl-10 pr-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                          Second Payment
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-[#1E1E1E] opacity-70">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            value={paymentFormData.second_payment}
                            onChange={(e) => setPaymentFormData({ ...paymentFormData, second_payment: e.target.value })}
                            className="block w-full rounded-lg border-2 border-zinc-300 bg-white pl-10 pr-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                          Final Payment
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-[#1E1E1E] opacity-70">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            value={paymentFormData.final_payment}
                            onChange={(e) => setPaymentFormData({ ...paymentFormData, final_payment: e.target.value })}
                            className="block w-full rounded-lg border-2 border-zinc-300 bg-white pl-10 pr-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                          Additional Payment
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-[#1E1E1E] opacity-70">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            value={paymentFormData.additional_payment}
                            onChange={(e) => setPaymentFormData({ ...paymentFormData, additional_payment: e.target.value })}
                            className="block w-full rounded-lg border-2 border-zinc-300 bg-white pl-10 pr-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4 pt-6">
                    <button
                      type="submit"
                      disabled={paymentFormLoading}
                      className="flex-1 rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                    >
                      {paymentFormLoading ? 'Updating...' : 'Update Payment'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditPaymentModalOpen(false);
                        setEditingPayment(null);
                      }}
                      disabled={paymentFormLoading}
                      className="flex-1 rounded-lg border-2 border-zinc-300 px-6 py-3 text-base font-semibold text-[#1E1E1E] hover:bg-zinc-50 transition-colors duration-150 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}


'use client';

import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { LoadingSpinner, Button } from '@/components/ui';
import { getAccessToken } from '@/lib/supabase-client';
import { compressImage, isCompressibleImage } from '@/utils/compressImage';

interface WorkOrder {
  id: string;
  work_order_number: string;
  customer_name: string;
  customer_address: string;
  town: string | null;
  customer_email: string | null;
  customer_phone: string;
  power_bill: number | null;
  power_units: number | null;
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
  warranty_approval?: string | null;
  subsidy_amount?: number | null;
  subsidy_status?: string | null;
  erection_done_at?: string | null;
  meter_completed_at?: string | null;
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
  cheque_number?: string | null;
  bank_name?: string | null;
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

  // BackOffice modal state (used by Admin, Super Admin, and BackOffice roles)
  const [isBackOfficeModalOpen, setIsBackOfficeModalOpen] = useState(false);
  const [backOfficeEditingWorkOrder, setBackOfficeEditingWorkOrder] = useState<WorkOrder | null>(null);
  const [backOfficeLoading, setBackOfficeLoading] = useState(false);
  const [backOfficeFormData, setBackOfficeFormData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    customer_address: '',
    town: '',
    order_amount: '',
    plant_capacity: '',
    structure_height: '',
    roof_type: '',
    power_bill: '',
    power_units: '',
    site_details: '',
    work_order_status: '',
    subsidy_amount: '',
    subsidy_status: '',
    erection_done_at: '',
    meter_completed_at: '',
    warranty_approval: '',
    aadhaar_url: '',
    pan_url: '',
    bank_statement_url: '',
    cancelled_check_url: '',
  });
  const [backOfficeDocumentUploading, setBackOfficeDocumentUploading] = useState({
    aadhaar: false,
    pan: false,
    bank_statement: false,
    cancelled_check: false,
  });
  const [backOfficeDocumentErrors, setBackOfficeDocumentErrors] = useState({
    aadhaar: null as string | null,
    pan: null as string | null,
    bank_statement: null as string | null,
    cancelled_check: null as string | null,
  });
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});


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
    cheque_number: '',
    bank_name: '',
  });
  const [paymentType, setPaymentType] = useState<string>('');
  const [paymentFormLoading, setPaymentFormLoading] = useState(false);
  const [generatingReceipt, setGeneratingReceipt] = useState<string | null>(null);
  const [markingDispatched, setMarkingDispatched] = useState(false);

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Notification modal state (replaces browser alerts)
  const [notificationModal, setNotificationModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  }>({ isOpen: false, type: 'info', title: '', message: '' });

  const showNotification = (type: 'success' | 'error' | 'info', title: string, message: string) => {
    setNotificationModal({ isOpen: true, type, title, message });
  };

  const closeNotification = () => {
    setNotificationModal({ ...notificationModal, isOpen: false });
  };

  // Ledger PDF generation state
  const [generatingLedger, setGeneratingLedger] = useState(false);
  const [generatingSalesExecLedger, setGeneratingSalesExecLedger] = useState(false);

  // Dues Report PDF generation state
  const [duesReportFromDate, setDuesReportFromDate] = useState('');
  const [duesReportToDate, setDuesReportToDate] = useState('');
  const [generatingDuesReport, setGeneratingDuesReport] = useState(false);

  // To Be Dispatched PDF generation state
  const [toBeDispatchedFromDate, setToBeDispatchedFromDate] = useState('');
  const [toBeDispatchedToDate, setToBeDispatchedToDate] = useState('');
  const [generatingToBeDispatched, setGeneratingToBeDispatched] = useState(false);

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
        const allowedRoles = ['Sales', 'salesLead', 'Admin', 'Super Admin', 'Inventory', 'Accounts', 'BackOffice'];
        if (!currentRoleName || !allowedRoles.includes(currentRoleName)) {
          if (isMounted) {
            showNotification('error', 'Access Denied', 'You do not have permission to view work orders.');
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
          const accessToken = getAccessToken();
          response = await fetch('/api/work-orders/list', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
            },
            body: JSON.stringify({
              ...(accessToken && { access_token: accessToken }),
              userId: currentUser.id,
              companyId: profileData.company_id,
              roleName: currentRoleName,
            }),
          });
        } catch (networkError) {
          console.error('Network error fetching work orders:', networkError);
          if (isMounted) {
            setWorkOrders([]);
            showNotification('error', 'Network Error', 'Failed to connect to server. Please check your internet connection and try again.');
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
            showNotification('error', 'Error', `Error loading work orders: ${errorMessage}`);
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
            showNotification('error', 'Error', 'Error parsing server response. Please try again.');
          }
          return;
        }

        if (isMounted) {
          const orders = result.workOrders || [];
          setAllWorkOrders(orders);
          setWorkOrders(orders);
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error('Error in fetchData:', error.message);
          showNotification('error', 'Error', error.message);
        } else {
          console.error('Unknown error in fetchData:', error);
          showNotification('error', 'Error', 'An error occurred. Please try again.');
        }
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

    // For BackOffice role, only show work orders with 'Dispatched' status or later
    // (statuses that come after Dispatched in the workflow)
    if (roleName === 'BackOffice') {
      const backOfficeVisibleStatuses = [
        'Dispatched',
        'Erection and Installation',
        'Dept. Submission of Docs',
        'Meter Installation',
        'Subsidy Ready for Redemption',
        'Customer Eligible for Redemption',
        'Subsidy Follow Up',
        'Subsidy Received by Customer',
        'Online Mobile App Demo to Customer',
        'Tata Sales Force Upload',
        'Warranty Certificate Approval',
        'Warranty Rejected',
        'Warranty Certificate Given to Customer',
        'Successfully Completed'
      ];
      filtered = filtered.filter(order => 
        order.work_order_status && backOfficeVisibleStatuses.includes(order.work_order_status)
      );
    }

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
  }, [searchQuery, filterCompany, filterSalesExecutive, filterPlantCapacity, allWorkOrders, roleName]);

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
    if (!profile?.company_id || !user || !roleName) return;

    setPaymentsLoading(true);
    try {
      const accessToken = getAccessToken();
      const response = await fetch('/api/payments/work-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
        },
        body: JSON.stringify({
          ...(accessToken && { access_token: accessToken }),
          work_order_id: workOrderId,
          company_id: profile.company_id,
          user_id: user.id,
          roleName: roleName,
        }),
      });

      // IMPORTANT: Check response.ok BEFORE consuming the body
      // This prevents 'Body is unusable: Body has already been read' error
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error fetching payments:', errorText);
        return;
      }

      const result = await response.json();
      setPayments(result.payments || []);
      setPaymentSummary(result.paymentSummary || null);
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
      showNotification('error', 'Error', 'Missing required information. Please refresh the page and try again.');
      return;
    }

    // Validate work order has required fields
    if (!selectedWorkOrder.id) {
      showNotification('error', 'Error', 'Invalid work order. Please refresh the page and try again.');
      return;
    }

    if (!profile.company_id) {
      showNotification('error', 'Error', 'Your account is missing company information. Please contact support.');
      return;
    }

    // Verify work order belongs to user's company
    if (selectedWorkOrder.company_id && selectedWorkOrder.company_id !== profile.company_id) {
      console.error('Company ID mismatch:', {
        work_order_company_id: selectedWorkOrder.company_id,
        user_company_id: profile.company_id,
        work_order_id: selectedWorkOrder.id,
      });
      showNotification('error', 'Error', 'This work order does not belong to your company. Please refresh the page.');
      return;
    }

    // Validate payment type and amount
    if (!paymentType) {
      showNotification('error', 'Validation Error', 'Please select a payment type');
      return;
    }

    if (!paymentFormData.amount || parseFloat(paymentFormData.amount) <= 0) {
      showNotification('error', 'Validation Error', 'Please enter a valid payment amount');
      return;
    }

    // Prepare payment data based on selected payment type
    const paymentData: Record<string, string | number | null> = {
      work_order_id: selectedWorkOrder.id,
      amount: paymentFormData.amount,
      transaction_date: paymentFormData.transaction_date,
      payment_method: paymentFormData.payment_method || null,
      status: paymentFormData.status,
      company_id: profile.company_id,
      user_id: user.id,
      cheque_number: paymentFormData.payment_method === 'cheque' ? (paymentFormData.cheque_number || null) : null,
      bank_name: (paymentFormData.payment_method === 'bank_transfer' || paymentFormData.payment_method === 'cheque') ? (paymentFormData.bank_name || null) : null,
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
      const accessToken = getAccessToken();
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
        },
        body: JSON.stringify({
          ...paymentData,
          ...(accessToken && { access_token: accessToken }),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create payment');
      }

      showNotification('success', 'Success!', 'Payment added successfully!');
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
        cheque_number: '',
        bank_name: '',
      });
      setPaymentType('');

      // Refresh payments
      await fetchPayments(selectedWorkOrder.id);

      // Auto-generate receipt PDF for the newly created payment
      if (result.payment?.id) {
        try {
          await handleGenerateReceipt(result.payment.id);
        } catch (receiptError) {
          console.error('Error auto-generating receipt:', receiptError);
          // Don't fail the entire operation if receipt generation fails
        }
      }

      // Refresh work orders list to update status
      if (user && profile && roleName) {
        const accessToken = getAccessToken();
        const refreshResponse = await fetch('/api/work-orders/list', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
          },
          body: JSON.stringify({
            ...(accessToken && { access_token: accessToken }),
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
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error adding payment:', error.message);
        
        // Handle specific "exceeds balance" error gracefully
        if (error.message.includes('Payment amount exceeds remaining balance')) {
          showNotification('info', 'Payment Limit Reached', error.message);
        } else {
          showNotification('error', 'Error', error.message);
        }
      } else {
        console.error('Unknown error adding payment:', error);
        showNotification('error', 'Error', 'Something went wrong');
      }
    } finally {
      setPaymentFormLoading(false);
    }
  };

  const handleGenerateReceipt = async (paymentId: string) => {
    if (!profile?.company_id) {
      showNotification('error', 'Error', 'Company information not found');
      return;
    }

    setGeneratingReceipt(paymentId);
    try {
      const accessToken = getAccessToken();
      const response = await fetch('/api/payments/generate-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
        },
        body: JSON.stringify({
          payment_id: paymentId,
          company_id: profile.company_id,
          ...(accessToken && { access_token: accessToken }),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate receipt');
      }

      showNotification('success', 'Success!', 'Receipt generated successfully!');

      // Refresh payments to get updated receipt info
      if (selectedWorkOrder) {
        await fetchPayments(selectedWorkOrder.id);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error generating receipt:', error.message);
        showNotification('error', 'Error', error.message);
      } else {
        console.error('Unknown error generating receipt:', error);
        showNotification('error', 'Error', 'Something went wrong');
      }
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
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error generating signed URL:', error.message);
      } else {
        console.error('Unknown error generating signed URL:', error);
      }
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

    // Fetch the PDF and trigger download
    try {
      const response = await fetch(signedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${receiptNumber || 'receipt'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading receipt:', error);
      alert('Failed to download receipt. Please try again.');
    }
  };

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment || !profile) return;

    setPaymentFormLoading(true);
    try {
      const accessToken = getAccessToken();
      const response = await fetch('/api/payments/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
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
          cheque_number: paymentFormData.payment_method === 'cheque' ? (paymentFormData.cheque_number || null) : null,
          bank_name: (paymentFormData.payment_method === 'bank_transfer' || paymentFormData.payment_method === 'cheque') ? (paymentFormData.bank_name || null) : null,
          company_id: profile.company_id,
          ...(accessToken && { access_token: accessToken }),
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
        const accessToken = getAccessToken();
        const refreshResponse = await fetch('/api/work-orders/list', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
          },
          body: JSON.stringify({
            ...(accessToken && { access_token: accessToken }),
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
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error updating payment:', error.message);
        alert(`Error: ${error.message}`);
      } else {
        console.error('Unknown error updating payment:', error);
        alert('Error: Something went wrong');
      }
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

    // Inventory and Accounts have read-only access
    if (roleName === 'Inventory' || roleName === 'Accounts') {
      return false;
    }

    // BackOffice can edit all work orders (but only status/subsidy fields via separate modal)
    if (roleName === 'BackOffice') {
      return true;
    }

    // Admin and Super Admin can edit any work order in their company
    if (roleName === 'Admin' || roleName === 'Super Admin') {
      return true;
    }

    // Sales and Sales Lead can only edit their own work orders
    if (roleName === 'Sales' || roleName === 'salesLead') {
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
      // Get access token from Supabase session (more reliable than localStorage)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('No active session. Please refresh the page and try again.');
      }
      
      const accessToken = session.access_token;
      
      const requestHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      };
      
      const requestBody = {
        access_token: accessToken,
        work_order_id: selectedWorkOrder.id,
        user_id: user.id,
        company_id: profile.company_id,
      };
      
      const response = await fetch('/api/work-orders/mark-dispatched', {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to mark as dispatched');
      }

      alert('Work order marked as dispatched successfully! Customer has been notified via WhatsApp.');

      // Refresh work orders list
      if (user && profile && roleName) {
        const accessToken = getAccessToken();
        const refreshResponse = await fetch('/api/work-orders/list', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
          },
          body: JSON.stringify({
            ...(accessToken && { access_token: accessToken }),
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
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error marking as dispatched:', error.message);
        alert(`Error: ${error.message}`);
      } else {
        console.error('Unknown error marking as dispatched:', error);
        alert('Error: Something went wrong');
      }
    } finally {
      setMarkingDispatched(false);
    }
  };

  // Check if user can delete a work order (only Admin and Super Admin)
  const canDelete = (order: WorkOrder): boolean => {
    if (!user || !roleName) return false;

    // Inventory, Accounts, and BackOffice have read-only access (cannot delete)
    if (roleName === 'Inventory' || roleName === 'Accounts' || roleName === 'BackOffice') {
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

    // BackOffice users get a different edit modal with only status/subsidy fields
    if (roleName === 'BackOffice') {
      openBackOfficeModal(order);
      return;
    }

    setEditingWorkOrder(order);
    setEditFormData({
      work_order_number: order.work_order_number,
      customer_name: order.customer_name,
      customer_address: order.customer_address,
      town: order.town || '',
      customer_email: order.customer_email || '',
      customer_phone: order.customer_phone,
      power_bill: order.power_bill != null ? order.power_bill.toString() : '',
      power_units: order.power_units != null ? order.power_units.toString() : '',
      site_details: order.site_details || '',
      structure_height: order.structure_height || '',
      roof_type: order.roof_type || '',
      // Extract numeric value from plant_capacity (remove "kW" if present)
      plant_capacity: order.plant_capacity
        ? (order.plant_capacity.endsWith('kW')
          ? order.plant_capacity.replace('kW', '')
          : order.plant_capacity)
        : '',
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

    const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB (before compression)
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('Invalid file type. Only JPG, PNG, and PDF are allowed.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert('File size exceeds 10MB limit. Please use a smaller file.');
      event.target.value = '';
      return;
    }

    setEditDocumentUploading(prev => ({ ...prev, [docType]: true }));
    setEditDocumentErrors(prev => ({ ...prev, [docType]: null }));

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

      const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      const timestamp = Date.now();
      const fileName = `${docType}-${timestamp}.${fileExtension}`;
      const filePath = `${profile.company_id}/temp/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('work-order-docs')
        .upload(filePath, fileToUpload, {
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      console.error(`Upload error for ${docType}:`, error);
      setEditDocumentErrors(prev => ({ ...prev, [docType]: errorMessage }));
    } finally {
      setEditDocumentUploading(prev => ({ ...prev, [docType]: false }));
      event.target.value = '';
    }
  };

  const handleBackOfficeDocumentUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    docType: 'aadhaar' | 'pan' | 'bank_statement' | 'cancelled_check'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!profile?.company_id) {
      alert('Company ID not found. Cannot upload document.');
      return;
    }

    const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB (before compression)
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('Invalid file type. Only JPG, PNG, and PDF are allowed.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert('File size exceeds 8MB limit. Please use a smaller file.');
      event.target.value = '';
      return;
    }

    setBackOfficeDocumentUploading(prev => ({ ...prev, [docType]: true }));
    setBackOfficeDocumentErrors(prev => ({ ...prev, [docType]: null }));

    try {
      // Compress image files before upload
      let fileToUpload = file;
      if (isCompressibleImage(file)) {
        try {
          fileToUpload = await compressImage(file);
        } catch (compressionError) {
          console.warn('Image compression failed, uploading original:', compressionError);
        }
      }

      const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      const timestamp = Date.now();
      const fileName = `${docType}-${timestamp}.${fileExtension}`;
      const filePath = `${profile.company_id}/temp/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('work-order-docs')
        .upload(filePath, fileToUpload, {
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

      // Update BackOffice form data with new URL
      const fieldName = `${docType}_url` as 'aadhaar_url' | 'pan_url' | 'bank_statement_url' | 'cancelled_check_url';
      setBackOfficeFormData(prev => ({ ...prev, [fieldName]: urlData.publicUrl }));

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      console.error(`Upload error for ${docType}:`, error);
      setBackOfficeDocumentErrors(prev => ({ ...prev, [docType]: errorMessage }));
    } finally {
      setBackOfficeDocumentUploading(prev => ({ ...prev, [docType]: false }));
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
      const accessToken = getAccessToken();
      // Format plant_capacity: if numeric, append "kW", otherwise store as-is
      const formattedPlantCapacity = editFormData.plant_capacity
        ? (editFormData.plant_capacity.trim() && !isNaN(parseFloat(editFormData.plant_capacity))
          ? `${editFormData.plant_capacity}kW`
          : editFormData.plant_capacity)
        : null;

      const response = await fetch('/api/work-orders/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
        },
        body: JSON.stringify({
          work_order_id: editingWorkOrder.id,
          ...editFormData,
          plant_capacity: formattedPlantCapacity,
          ...(accessToken && { access_token: accessToken }),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update work order');
      }

      // Refresh the work orders list
      if (user && profile && roleName) {
        const accessToken = getAccessToken();
        const refreshResponse = await fetch('/api/work-orders/list', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
          },
          body: JSON.stringify({
            ...(accessToken && { access_token: accessToken }),
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
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error updating work order:', error.message);
        alert(`Error: ${error.message}`);
      } else {
        console.error('Unknown error updating work order:', error);
        alert('Error: Something went wrong');
      }
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
      const accessToken = getAccessToken();
      const response = await fetch('/api/work-orders/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
        },
        body: JSON.stringify({
          ...(accessToken && { access_token: accessToken }),
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
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error deleting work order:', error.message);
        alert(`Error: ${error.message}`);
      } else {
        console.error('Unknown error deleting work order:', error);
        alert('Error: Something went wrong');
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  // BackOffice modal functions
  const openBackOfficeModal = (order: WorkOrder) => {
    setBackOfficeEditingWorkOrder(order);
    
    // Helper to format date for HTML date input (YYYY-MM-DD)
    const formatDateForInput = (dateValue: string | null | undefined): string => {
      if (!dateValue) return '';
      try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return '';
        return date.toISOString().split('T')[0];
      } catch {
        return '';
      }
    };
    
    setBackOfficeFormData({
      customer_name: order.customer_name || '',
      customer_email: order.customer_email || '',
      customer_phone: order.customer_phone || '',
      customer_address: order.customer_address || '',
      town: order.town || '',
      order_amount: order.order_amount?.toString() || '',
      plant_capacity: order.plant_capacity?.replace('kW', '').replace('KW', '') || '',
      structure_height: order.structure_height || '',
      roof_type: order.roof_type || '',
      power_bill: order.power_bill?.toString() || '',
      power_units: order.power_units?.toString() || '',
      site_details: order.site_details || '',
      work_order_status: order.work_order_status || '',
      subsidy_amount: order.subsidy_amount?.toString() || '',
      subsidy_status: order.subsidy_status || '',
      erection_done_at: formatDateForInput(order.erection_done_at),
      meter_completed_at: formatDateForInput(order.meter_completed_at),
      warranty_approval: order.warranty_approval || '',
      aadhaar_url: order.aadhaar_url || '',
      pan_url: order.pan_url || '',
      bank_statement_url: order.bank_statement_url || '',
      cancelled_check_url: order.cancelled_check_url || '',
    });
    setIsBackOfficeModalOpen(true);
  };

  const closeBackOfficeModal = () => {
    setIsBackOfficeModalOpen(false);
    setBackOfficeEditingWorkOrder(null);
    setBackOfficeFormData({
      customer_name: '',
      customer_email: '',
      customer_phone: '',
      customer_address: '',
      town: '',
      order_amount: '',
      plant_capacity: '',
      structure_height: '',
      roof_type: '',
      power_bill: '',
      power_units: '',
      site_details: '',
      work_order_status: '',
      subsidy_amount: '',
      subsidy_status: '',
      erection_done_at: '',
      meter_completed_at: '',
      warranty_approval: '',
      aadhaar_url: '',
      pan_url: '',
      bank_statement_url: '',
      cancelled_check_url: '',
    });
  };

  const handleBackOfficeUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backOfficeEditingWorkOrder) return;

    // Validation for Admin updates
    if (roleName === 'Admin' || roleName === 'Super Admin') {
      const errors: Record<string, boolean> = {};
      
      if (!backOfficeFormData.customer_name?.trim()) errors.customer_name = true;
      if (!backOfficeFormData.customer_address?.trim()) errors.customer_address = true;
      if (!backOfficeFormData.town?.trim()) errors.town = true;
      if (!backOfficeFormData.customer_phone?.trim()) errors.customer_phone = true;
      if (!backOfficeFormData.order_amount) errors.order_amount = true;

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        // Show gentle toast notification
        showNotification('info', 'Required Fields', 'Please fill the highlighted fields.');
        return;
      }
    }

    setFormErrors({}); // Clear errors if valid
    setBackOfficeLoading(true);
    try {
      const accessToken = getAccessToken();

      // For Admin users, use full work order update API
      if (roleName === 'Admin' || roleName === 'Super Admin') {
        // Format plant capacity
        const formattedPlantCapacity = backOfficeFormData.plant_capacity
          ? (backOfficeFormData.plant_capacity.trim() && !isNaN(parseFloat(backOfficeFormData.plant_capacity))
            ? `${backOfficeFormData.plant_capacity}kW`
            : backOfficeFormData.plant_capacity)
          : null;

        const response = await fetch('/api/work-orders/update', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken && {'Authorization': `Bearer ${accessToken}`}),
          },
          body: JSON.stringify({
            work_order_id: backOfficeEditingWorkOrder.id,
            work_order_number: backOfficeEditingWorkOrder.work_order_number, // Add this required field
            customer_name: backOfficeFormData.customer_name,
            customer_email: backOfficeFormData.customer_email,
            customer_phone: backOfficeFormData.customer_phone,
            customer_address: backOfficeFormData.customer_address,
            town: backOfficeFormData.town,
            order_amount: backOfficeFormData.order_amount,
            plant_capacity: formattedPlantCapacity,
            structure_height: backOfficeFormData.structure_height,
            roof_type: backOfficeFormData.roof_type,
            power_bill: backOfficeFormData.power_bill,
            power_units: backOfficeFormData.power_units,
            site_details: backOfficeFormData.site_details,
            work_order_status: backOfficeFormData.work_order_status,
            subsidy_amount: backOfficeFormData.subsidy_amount,
            subsidy_status: backOfficeFormData.subsidy_status,
            erection_done_at: backOfficeFormData.erection_done_at,
            meter_completed_at: backOfficeFormData.meter_completed_at,
            aadhaar_url: backOfficeFormData.aadhaar_url,
            pan_url: backOfficeFormData.pan_url,
            bank_statement_url: backOfficeFormData.bank_statement_url,
            cancelled_check_url: backOfficeFormData.cancelled_check_url,
            ...(accessToken && { access_token: accessToken }),
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to update work order');
        }
      } else {
        // For BackOffice users, use status update API
        const response = await fetch('/api/work-orders/update-status', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
          },
          body: JSON.stringify({
            work_order_id: backOfficeEditingWorkOrder.id,
            work_order_status: backOfficeFormData.work_order_status,
            // Only send subsidy fields if they have values
            ...(backOfficeFormData.subsidy_amount && { subsidy_amount: backOfficeFormData.subsidy_amount }),
            ...(backOfficeFormData.subsidy_status && { subsidy_status: backOfficeFormData.subsidy_status }),
            erection_done_at: backOfficeFormData.erection_done_at,
            meter_completed_at: backOfficeFormData.meter_completed_at,
            warranty_approval: backOfficeFormData.warranty_approval,
            ...(accessToken && { access_token: accessToken }),
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to update work order status');
        }
      }

      // Refresh work orders list
      if (user && profile && roleName) {
        const accessToken = getAccessToken();
        const refreshResponse = await fetch('/api/work-orders/list', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
          },
          body: JSON.stringify({
            ...(accessToken && { access_token: accessToken }),
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

      showNotification('success', 'Success!', 'Work order updated successfully!');
      closeBackOfficeModal();
      
      // Close detail modal if open
      if (isModalOpen) {
        closeDetailModal();
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error updating work order:', error.message);
        showNotification('error', 'Error', error.message);
      } else {
        console.error('Unknown error updating work order:', error);
        showNotification('error', 'Error', 'Something went wrong');
      }
    } finally {
      setBackOfficeLoading(false);
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

  // Handler for generating ledger PDF (Admin only)
  const handleGenerateLedger = async () => {
    if (!profile?.company_id || !user) {
      alert('Missing required information. Please refresh the page.');
      return;
    }

    setGeneratingLedger(true);
    try {
      const accessToken = getAccessToken();
      const response = await fetch('/api/ledger/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
        },
        body: JSON.stringify({
          ...(accessToken && { access_token: accessToken }),
          company_id: profile.company_id,
          user_id: user.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate ledger');
      }

      // Download PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const today = new Date().toISOString().split('T')[0];
      link.download = `ledger-${today}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error generating ledger:', error.message);
        alert(`Error: ${error.message}`);
      } else {
        console.error('Unknown error generating ledger:', error);
        alert('Error: Failed to generate ledger PDF');
      }
    } finally {
      setGeneratingLedger(false);
    }
  };

  // Handler for generating dues report PDF (Admin only)
  const handleGenerateDuesReport = async () => {
    if (!profile?.company_id || !user) {
      alert('Missing required information. Please refresh the page.');
      return;
    }

    setGeneratingDuesReport(true);
    try {
      const accessToken = getAccessToken();
      const response = await fetch('/api/reports/dues-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
        },
        body: JSON.stringify({
          ...(accessToken && { access_token: accessToken }),
          company_id: profile.company_id,
          user_id: user.id,
          from_date: duesReportFromDate || null,
          to_date: duesReportToDate || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate dues report');
      }

      // Download PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const today = new Date().toISOString().split('T')[0];
      link.download = `dues-report-${today}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error generating dues report:', error.message);
        alert(`Error: ${error.message}`);
      } else {
        console.error('Unknown error generating dues report:', error);
        alert('Error: Failed to generate dues report PDF');
      }
    } finally {
      setGeneratingDuesReport(false);
    }
  };

  // Handler for generating To Be Dispatched PDF (Admin only)
  const handleGenerateToBeDispatched = async () => {
    if (!profile?.company_id || !user) {
      alert('Missing required information. Please refresh the page.');
      return;
    }

    setGeneratingToBeDispatched(true);
    try {
      const accessToken = getAccessToken();
      const response = await fetch('/api/reports/to-be-dispatched', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
        },
        body: JSON.stringify({
          ...(accessToken && { access_token: accessToken }),
          company_id: profile.company_id,
          user_id: user.id,
          from_date: toBeDispatchedFromDate || null,
          to_date: toBeDispatchedToDate || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate To Be Dispatched report');
      }

      // Download PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const today = new Date().toISOString().split('T')[0];
      link.download = `to-be-dispatched-${today}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error generating To Be Dispatched report:', error.message);
        alert(`Error: ${error.message}`);
      } else {
        console.error('Unknown error generating To Be Dispatched report:', error);
        alert('Error: Failed to generate To Be Dispatched report PDF');
      }
    } finally {
      setGeneratingToBeDispatched(false);
    }
  };

  // Handler for generating sales executive ledger PDF
  const handleGenerateSalesExecLedger = async () => {
    if (!profile?.company_id || !user) {
      showNotification('error', 'Error', 'Missing required information. Please refresh the page.');
      return;
    }

    // For Admin/Super Admin: require sales executive filter selection
    if (roleName === 'Admin' || roleName === 'Super Admin') {
      if (!filterSalesExecutive) {
        showNotification('error', 'Validation Error', 'Please select a sales executive from the filter dropdown first.');
        return;
      }

      // Confirmation dialog for Admin
      const confirmed = window.confirm(
        `Generate ledger for ${filterSalesExecutive}?\n\nThis will create a PDF with all work orders and payments for this sales executive.`
      );
      if (!confirmed) return;
    } else if (roleName === 'Sales') {
      // Confirmation dialog for Sales
      const confirmed = window.confirm(
        'Generate your ledger?\n\nThis will create a PDF with all your work orders and payments.'
      );
      if (!confirmed) return;
    }

    setGeneratingSalesExecLedger(true);
    try {
      const accessToken = getAccessToken();
      const requestBody: any = {
        ...(accessToken && { access_token: accessToken }),
        company_id: profile.company_id,
        user_id: user.id,
      };

      // For Admin: include sales_executive_name
      if (roleName === 'Admin' || roleName === 'Super Admin') {
        requestBody.sales_executive_name = filterSalesExecutive;
      }
      // For Sales: API will auto-detect from profile

      const response = await fetch('/api/ledger/sales-executive/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate sales executive ledger');
      }

      // Download PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const today = new Date().toISOString().split('T')[0];
      const execName = roleName === 'Sales' ? 'my' : filterSalesExecutive.replace(/\s+/g, '-').toLowerCase();
      link.download = `ledger-${execName}-${today}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error generating sales executive ledger:', error.message);
        showNotification('error', 'Error', error.message);
      } else {
        console.error('Unknown error generating sales executive ledger:', error);
        showNotification('error', 'Error', 'Failed to generate sales executive ledger PDF');
      }
    } finally {
      setGeneratingSalesExecLedger(false);
    }
  };

  const handleConfirmDispatch = async () => {
    if (!dispatchingWorkOrder || !user || !profile) return;

    setDispatchLoading(true);
    try {
      // Get access token from Supabase session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('No active session. Please refresh the page and try again.');
      }
      
      const accessToken = session.access_token;
      
      const response = await fetch('/api/work-orders/mark-dispatched', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          access_token: accessToken,
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

      setShowSuccessModal(true);
      closeDispatchModal();

      // Close detail modal if open and update it
      if (isModalOpen && selectedWorkOrder?.id === dispatchingWorkOrder.id) {
        const updatedSelected = updatedOrders.find(o => o.id === dispatchingWorkOrder.id);
        if (updatedSelected) {
          setSelectedWorkOrder(updatedSelected);
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error marking as dispatched:', error.message);
        showNotification('error', 'Error', error.message);
      } else {
        console.error('Unknown error marking as dispatched:', error);
        showNotification('error', 'Error', 'Something went wrong');
      }
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
          <>
            {/* Sales Executive Ledger Button - for Sales (always) or Admin (when filter selected) */}
            {/* 
            {(roleName === 'Sales' || 
              ((roleName === 'Admin' || roleName === 'Super Admin') && filterSalesExecutive)) && (
              <Button
                onClick={handleGenerateSalesExecLedger}
                disabled={generatingSalesExecLedger}
                variant="secondary"
                size="sm"
                className="mr-2"
              >
                {generatingSalesExecLedger 
                  ? 'Generating...' 
                  : (roleName === 'Sales' ? 'Generate My Ledger' : 'Generate Executive Ledger')}
              </Button>
            )}
            */}
            {/* Admin Ledger Button - for Admin only */}
            {/* 
            {(roleName === 'Admin' || roleName === 'Super Admin') && (
              <Button
                onClick={handleGenerateLedger}
                disabled={generatingLedger}
                variant="secondary"
                size="sm"
                className="mr-2"
              >
                {generatingLedger ? 'Generating...' : 'Generate Ledger PDF'}
              </Button>
            )}
            */}
            {roleName !== 'Inventory' && roleName !== 'Accounts' && roleName !== 'BackOffice' ? (
              <Button
                asLink
                href="/dashboard/work-orders"
                variant="primary"
                size="sm"
              >
                Create New
              </Button>
            ) : null}
          </>
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

            {/* Admin Action Buttons - TEMPORARILY DISABLED */}
            {/* {(roleName === 'Admin' || roleName === 'Super Admin') && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleGenerateToBeDispatched}
                  disabled={generatingToBeDispatched}
                  className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {generatingToBeDispatched ? 'Generating...' : 'To Be Dispatched'}
                </button>
                <button
                  disabled
                  className="px-4 py-2 bg-black text-white rounded-md opacity-50 cursor-not-allowed text-sm font-medium"
                  title="Coming soon"
                >
                  Customer List
                </button>
              </div>
            )} */}
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

        {/* Dues Report Section (Admin Only) - TEMPORARILY DISABLED */}
        {/* {(roleName === 'Admin' || roleName === 'Super Admin') && (
          <div className="mb-6 rounded-lg border border-border bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-3">Dues Report (Admin Only)</h3>
            <div className="flex items-end gap-4">
              <div>
                <label htmlFor="dues-from-date" className="block text-xs font-medium text-foreground mb-1">
                  From Date
                </label>
                <input
                  id="dues-from-date"
                  type="date"
                  value={duesReportFromDate}
                  onChange={(e) => setDuesReportFromDate(e.target.value)}
                  className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200"
                />
              </div>
              <div>
                <label htmlFor="dues-to-date" className="block text-xs font-medium text-foreground mb-1">
                  To Date
                </label>
                <input
                  id="dues-to-date"
                  type="date"
                  value={duesReportToDate}
                  onChange={(e) => setDuesReportToDate(e.target.value)}
                  className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200"
                />
              </div>
              <div>
                <Button
                  onClick={handleGenerateDuesReport}
                  disabled={generatingDuesReport}
                  variant="primary"
                  size="sm"
                >
                  {generatingDuesReport ? 'Generating...' : 'Download Dues PDF'}
                </Button>
              </div>
            </div>
            <p className="text-xs text-foreground opacity-60 mt-2">
              Leave dates empty to generate report for ALL orders
            </p>
          </div>
        )} */}

        {workOrders.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center">
            <p className="text-foreground opacity-70">No work orders found.</p>
            {roleName !== 'Inventory' && roleName !== 'Accounts' && roleName !== 'BackOffice' && (
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
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                      Actions
                    </th>
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
                    {roleName !== 'Sales' && roleName !== 'salesLead' && (
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {workOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-white transition-colors duration-150 cursor-pointer">
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
                              onClick={() => {
                                // Admin and Super Admin use BackOffice modal for status updates
                                if (roleName === 'Admin' || roleName === 'Super Admin') {
                                  openBackOfficeModal(order);
                                } else {
                                  // Other roles use regular edit modal
                                  openEditModal(order);
                                }
                              }}
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
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${order.work_order_status === 'To Be Dispatched'
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
                        {order.plant_capacity
                          ? (order.plant_capacity.endsWith('kW')
                            ? order.plant_capacity
                            : `${order.plant_capacity}kW`)
                          : 'N/A'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-foreground">
                        {formatCurrency(order.order_amount)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground opacity-70">
                        {formatDate(order.created_at)}
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
                        <label className="block text-sm font-semibold text-[#1E1E1E] opacity-80 mb-1">Town</label>
                        <p className="text-base text-[#1E1E1E] font-medium">{selectedWorkOrder.town || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#1E1E1E] opacity-80 mb-1">Customer Email</label>
                        <p className="text-base text-[#1E1E1E] font-medium">{selectedWorkOrder.customer_email || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#1E1E1E] opacity-80 mb-1">Customer Phone</label>
                        <p className="text-base text-[#1E1E1E] font-medium">{selectedWorkOrder.customer_phone}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#1E1E1E] opacity-80 mb-1">Power Bill</label>
                        <p className="text-base text-[#1E1E1E] font-medium">{selectedWorkOrder.power_bill != null ? `₹${selectedWorkOrder.power_bill.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#1E1E1E] opacity-80 mb-1">Power Units</label>
                        <p className="text-base text-[#1E1E1E] font-medium">{selectedWorkOrder.power_units != null ? `${selectedWorkOrder.power_units} kWh` : 'N/A'}</p>
                      </div>
                      {(roleName !== 'Admin' && roleName !== 'Super Admin') && (
                        <div>
                          <label className="block text-sm font-semibold text-[#1E1E1E] opacity-80 mb-1">Company</label>
                          <p className="text-base text-[#1E1E1E] font-medium">{selectedWorkOrder.company_name || 'N/A'}</p>
                        </div>
                      )}
                      {roleName !== 'Sales' && roleName !== 'salesLead' && (
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
                  {roleName === 'Admin' || roleName === 'Super Admin' || roleName === 'Accounts' ? (
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
                          cheque_number: '',
                          bank_name: '',
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
                          {(roleName === 'Admin' || roleName === 'Super Admin' || roleName === 'Accounts') && (
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
                            {(roleName === 'Admin' || roleName === 'Super Admin' || roleName === 'Accounts') && (
                              <td className="whitespace-nowrap px-4 py-3 text-sm">
                                <div className="flex items-center gap-2">
                                  {(roleName === 'Admin' || roleName === 'Super Admin') && (
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
                                          cheque_number: payment.cheque_number || '',
                                          bank_name: payment.bank_name || '',
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
                                  )}
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
                      Town <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editFormData.town}
                      onChange={(e) => setEditFormData({ ...editFormData, town: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-[#1E1E1E]"
                      placeholder="Enter town name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#1E1E1E]">
                      Customer Email
                    </label>
                    <input
                      type="email"
                      value={editFormData.customer_email}
                      onChange={(e) => setEditFormData({ ...editFormData, customer_email: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-[#1E1E1E]"
                      placeholder="customer@example.com"
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
                      Power Bill
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editFormData.power_bill}
                      onChange={(e) => setEditFormData({ ...editFormData, power_bill: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-[#1E1E1E]"
                      placeholder="320.50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#1E1E1E]">
                      Power Units
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editFormData.power_units}
                      onChange={(e) => setEditFormData({ ...editFormData, power_units: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-[#1E1E1E]"
                      placeholder="280"
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
                    <select
                      value={editFormData.structure_height}
                      onChange={(e) => setEditFormData({ ...editFormData, structure_height: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-[#1E1E1E]"
                    >
                      <option value="">Select height</option>
                      <option value="3-4Ft">3-4Ft</option>
                      <option value="6-7Ft">6-7Ft</option>
                      <option value="8-10Ft">8-10Ft</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#1E1E1E]">
                      Roof Type
                    </label>
                    <select
                      value={editFormData.roof_type}
                      onChange={(e) => setEditFormData({ ...editFormData, roof_type: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-[#1E1E1E]"
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
                    <label className="block text-sm font-medium text-[#1E1E1E]">
                      Plant Capacity
                    </label>
                    <select
                      value={editFormData.plant_capacity}
                      onChange={(e) => setEditFormData({ ...editFormData, plant_capacity: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-[#1E1E1E]"
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
                        <option value="first_payment">First Payment (Advance)</option>
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
                            value={paymentFormData.amount || ''}
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
                        value={paymentFormData.transaction_date || ''}
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
                        value={paymentFormData.payment_method || ''}
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

                  {/* Bank Name and Cheque Number (conditional) */}
                  {(paymentFormData.payment_method === 'bank_transfer' || paymentFormData.payment_method === 'cheque') && (
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                          Bank Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={paymentFormData.bank_name || ''}
                          onChange={(e) => setPaymentFormData({ ...paymentFormData, bank_name: e.target.value })}
                          className="block w-full rounded-lg border-2 border-zinc-300 bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                          placeholder="Enter bank name"
                        />
                      </div>
                      {paymentFormData.payment_method === 'cheque' ? (
                        <div>
                          <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                            Cheque Number <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={paymentFormData.cheque_number || ''}
                            onChange={(e) => setPaymentFormData({ ...paymentFormData, cheque_number: e.target.value })}
                            className="block w-full rounded-lg border-2 border-zinc-300 bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                            placeholder="Enter cheque number"
                          />
                        </div>
                      ) : (
                        <div></div>
                      )}
                    </div>
                  )}

                  {/* Status Row */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                        Status
                      </label>
                      <select
                        value={paymentFormData.status || ''}
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
                          value={paymentFormData.amount || ''}
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
                        value={paymentFormData.transaction_date || ''}
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
                        value={paymentFormData.payment_method || ''}
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
                        value={paymentFormData.status || ''}
                        onChange={(e) => setPaymentFormData({ ...paymentFormData, status: e.target.value })}
                        className="block w-full rounded-lg border-2 border-zinc-300 bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                      >
                        <option value="completed">Completed</option>
                        <option value="pending">Pending</option>
                        <option value="failed">Failed</option>
                      </select>
                    </div>
                  </div>

                  {/* Bank Name and Cheque Number (conditional) */}
                  {(paymentFormData.payment_method === 'bank_transfer' || paymentFormData.payment_method === 'cheque') && (
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                          Bank Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={paymentFormData.bank_name || ''}
                          onChange={(e) => setPaymentFormData({ ...paymentFormData, bank_name: e.target.value })}
                          className="block w-full rounded-lg border-2 border-zinc-300 bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                          placeholder="Enter bank name"
                        />
                      </div>
                      {paymentFormData.payment_method === 'cheque' ? (
                        <div>
                          <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                            Cheque Number <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={paymentFormData.cheque_number || ''}
                            onChange={(e) => setPaymentFormData({ ...paymentFormData, cheque_number: e.target.value })}
                            className="block w-full rounded-lg border-2 border-zinc-300 bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                            placeholder="Enter cheque number"
                          />
                        </div>
                      ) : (
                        <div></div>
                      )}
                    </div>
                  )}

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
                            value={paymentFormData.first_payment || ''}
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
                            value={paymentFormData.second_payment || ''}
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
                            value={paymentFormData.final_payment || ''}
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
                            value={paymentFormData.additional_payment || ''}
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

        {/* BackOffice Edit Modal */}
        {isBackOfficeModalOpen && backOfficeEditingWorkOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
              <div className="sticky top-0 bg-white border-b border-zinc-200 px-8 py-6 z-10">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-[#1E1E1E]">
                    Update Work Order - {backOfficeEditingWorkOrder.work_order_number}
                  </h2>
                  <button
                    onClick={closeBackOfficeModal}
                    disabled={backOfficeLoading}
                    className="text-zinc-500 hover:text-zinc-700 transition-colors disabled:opacity-50"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="px-8 py-6">
                <form onSubmit={handleBackOfficeUpdate}>
                  <div className="space-y-6">
                    {/* Customer and Work Order Fields - Admin Only */}
                    {(roleName === 'Admin' || roleName === 'Super Admin') && (
                      <>
                        <div className="pb-4 border-b border-zinc-200">
                          <h3 className="text-lg font-semibold text-[#1E1E1E]">Work Order Details</h3>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-6">
                          {/* Customer Name */}
                          <div>
                            <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                              Customer Name
                            </label>
                            <input
                              type="text"
                              value={backOfficeFormData.customer_name}
                              onChange={(e) => setBackOfficeFormData({ ...backOfficeFormData, customer_name: e.target.value })}
                              className={`block w-full rounded-lg border-2 ${formErrors.customer_name ? 'border-red-500' : 'border-zinc-300'} bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all`}
                            />
                          </div>

                          {/* Customer Email */}
                          <div>
                            <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                              Customer Email
                            </label>
                            <input
                              type="email"
                              value={backOfficeFormData.customer_email}
                              onChange={(e) => setBackOfficeFormData({ ...backOfficeFormData, customer_email: e.target.value })}
                              className="block w-full rounded-lg border-2 border-zinc-300 bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                            />
                          </div>
                        </div>

                        {/* Customer Address - Full Width */}
                        <div>
                          <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                            Customer Address
                          </label>
                          <textarea
                            value={backOfficeFormData.customer_address}
                            onChange={(e) => setBackOfficeFormData({ ...backOfficeFormData, customer_address: e.target.value })}
                            rows={3}
                            className={`block w-full rounded-lg border-2 ${formErrors.customer_address ? 'border-red-500' : 'border-zinc-300'} bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all`}
                          />
                        </div>

                        {/* Town and Customer Phone */}
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                              Town
                            </label>
                            <input
                              type="text"
                              value={backOfficeFormData.town}
                              onChange={(e) => setBackOfficeFormData({ ...backOfficeFormData, town: e.target.value })}
                              className={`block w-full rounded-lg border-2 ${formErrors.town ? 'border-red-500' : 'border-zinc-300'} bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all`}
                            />
                          </div>

                          <div>
                            <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                              Customer Phone
                            </label>
                            <input
                              type="tel"
                              value={backOfficeFormData.customer_phone}
                              onChange={(e) => setBackOfficeFormData({ ...backOfficeFormData, customer_phone: e.target.value })}
                              className={`block w-full rounded-lg border-2 ${formErrors.customer_phone ? 'border-red-500' : 'border-zinc-300'} bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all`}
                            />
                          </div>
                        </div>

                        {/* Power Bill and Order Amount */}
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                              Power Bill
                            </label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-[#1E1E1E] opacity-70">₹</span>
                              <input
                                type="number"
                                step="0.01"
                                value={backOfficeFormData.power_bill}
                                onChange={(e) => setBackOfficeFormData({ ...backOfficeFormData, power_bill: e.target.value })}
                                className="block w-full rounded-lg border-2 border-zinc-300 bg-white pl-10 pr-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                              Order Amount
                            </label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-[#1E1E1E] opacity-70">₹</span>
                              <input
                                type="number"
                                step="0.01"
                                value={backOfficeFormData.order_amount}
                                onChange={(e) => setBackOfficeFormData({ ...backOfficeFormData, order_amount: e.target.value })}
                                className={`block w-full rounded-lg border-2 ${formErrors.order_amount ? 'border-red-500' : 'border-zinc-300'} bg-white pl-10 pr-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all`}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Power Units - Full Width */}
                        <div>
                          <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                            Power Units
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={backOfficeFormData.power_units}
                            onChange={(e) => setBackOfficeFormData({ ...backOfficeFormData, power_units: e.target.value })}
                            placeholder="kWh"
                            className="block w-full rounded-lg border-2 border-zinc-300 bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                          />
                        </div>

                        {/* Site Details - Full Width */}
                        <div>
                          <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                            Site Details
                          </label>
                          <textarea
                            value={backOfficeFormData.site_details}
                            onChange={(e) => setBackOfficeFormData({ ...backOfficeFormData, site_details: e.target.value })}
                            rows={4}
                            className="block w-full rounded-lg border-2 border-zinc-300 bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                          />
                        </div>

                        {/* Documents Section - File uploads enabled for Admin */}
                        <div className="pb-4 border-t border-zinc-200 pt-6">
                          <h4 className="text-base font-semibold text-[#1E1E1E] mb-3">Document Uploads</h4>
                          <div className="space-y-4">
                            {/* Aadhaar Upload */}
                            <div>
                              <label htmlFor="backoffice_aadhaar_file" className="block text-sm font-medium text-[#1E1E1E] mb-1">
                                Aadhaar Document
                              </label>
                              <input
                                id="backoffice_aadhaar_file"
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={(e) => handleBackOfficeDocumentUpload(e, 'aadhaar')}
                                disabled={backOfficeDocumentUploading.aadhaar}
                                className="block w-full text-sm text-[#1E1E1E] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#0BC28E] file:text-white hover:file:bg-[#0aa578] disabled:opacity-50 cursor-pointer"
                              />
                              {backOfficeDocumentUploading.aadhaar && <p className="mt-1 text-sm text-blue-500">Uploading...</p>}
                              {backOfficeDocumentErrors.aadhaar && <p className="mt-1 text-sm text-red-500">{backOfficeDocumentErrors.aadhaar}</p>}
                              {backOfficeFormData.aadhaar_url && !backOfficeDocumentUploading.aadhaar && (
                                <p className="mt-1 text-sm text-green-600">
                                  ✓ Uploaded! <a href={backOfficeFormData.aadhaar_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View</a>
                                </p>
                              )}
                            </div>

                            {/* PAN Upload */}
                            <div>
                              <label htmlFor="backoffice_pan_file" className="block text-sm font-medium text-[#1E1E1E] mb-1">
                                PAN Document
                              </label>
                              <input
                                id="backoffice_pan_file"
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={(e) => handleBackOfficeDocumentUpload(e, 'pan')}
                                disabled={backOfficeDocumentUploading.pan}
                                className="block w-full text-sm text-[#1E1E1E] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#0BC28E] file:text-white hover:file:bg-[#0aa578] disabled:opacity-50 cursor-pointer"
                              />
                              {backOfficeDocumentUploading.pan && <p className="mt-1 text-sm text-blue-500">Uploading...</p>}
                              {backOfficeDocumentErrors.pan && <p className="mt-1 text-sm text-red-500">{backOfficeDocumentErrors.pan}</p>}
                              {backOfficeFormData.pan_url && !backOfficeDocumentUploading.pan && (
                                <p className="mt-1 text-sm text-green-600">
                                  ✓ Uploaded! <a href={backOfficeFormData.pan_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View</a>
                                </p>
                              )}
                            </div>

                            {/* Bank Statement Upload */}
                            <div>
                              <label htmlFor="backoffice_bank_statement_file" className="block text-sm font-medium text-[#1E1E1E] mb-1">
                                Bank Statement Document
                              </label>
                              <input
                                id="backoffice_bank_statement_file"
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={(e) => handleBackOfficeDocumentUpload(e, 'bank_statement')}
                                disabled={backOfficeDocumentUploading.bank_statement}
                                className="block w-full text-sm text-[#1E1E1E] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#0BC28E] file:text-white hover:file:bg-[#0aa578] disabled:opacity-50 cursor-pointer"
                              />
                              {backOfficeDocumentUploading.bank_statement && <p className="mt-1 text-sm text-blue-500">Uploading...</p>}
                              {backOfficeDocumentErrors.bank_statement && <p className="mt-1 text-sm text-red-500">{backOfficeDocumentErrors.bank_statement}</p>}
                              {backOfficeFormData.bank_statement_url && !backOfficeDocumentUploading.bank_statement && (
                                <p className="mt-1 text-sm text-green-600">
                                  ✓ Uploaded! <a href={backOfficeFormData.bank_statement_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View</a>
                                </p>
                              )}
                            </div>

                            {/* Cancelled Check Upload */}
                            <div>
                              <label htmlFor="backoffice_cancelled_check_file" className="block text-sm font-medium text-[#1E1E1E] mb-1">
                                Cancelled Check Document
                              </label>
                              <input
                                id="backoffice_cancelled_check_file"
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={(e) => handleBackOfficeDocumentUpload(e, 'cancelled_check')}
                                disabled={backOfficeDocumentUploading.cancelled_check}
                                className="block w-full text-sm text-[#1E1E1E] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#0BC28E] file:text-white hover:file:bg-[#0aa578] disabled:opacity-50 cursor-pointer"
                              />
                              {backOfficeDocumentUploading.cancelled_check && <p className="mt-1 text-sm text-blue-500">Uploading...</p>}
                              {backOfficeDocumentErrors.cancelled_check && <p className="mt-1 text-sm text-red-500">{backOfficeDocumentErrors.cancelled_check}</p>}
                              {backOfficeFormData.cancelled_check_url && !backOfficeDocumentUploading.cancelled_check && (
                                <p className="mt-1 text-sm text-green-600">
                                  ✓ Uploaded! <a href={backOfficeFormData.cancelled_check_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View</a>
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Technical Fields */}
                        <div className="grid grid-cols-3 gap-6">
                          <div>
                            <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                              Plant Capacity
                            </label>
                            <select
                              value={backOfficeFormData.plant_capacity}
                              onChange={(e) => setBackOfficeFormData({ ...backOfficeFormData, plant_capacity: e.target.value })}
                              className="block w-full rounded-lg border-2 border-zinc-300 bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
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
                            <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                              Structure Height
                            </label>
                            <select
                              value={backOfficeFormData.structure_height}
                              onChange={(e) => setBackOfficeFormData({ ...backOfficeFormData, structure_height: e.target.value })}
                              className="block w-full rounded-lg border-2 border-zinc-300 bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                            >
                              <option value="">Select height</option>
                              <option value="3-4Ft">3-4Ft</option>
                              <option value="6-7Ft">6-7Ft</option>
                              <option value="8-10Ft">8-10Ft</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                              Roof Type
                            </label>
                            <select
                              value={backOfficeFormData.roof_type}
                              onChange={(e) => setBackOfficeFormData({ ...backOfficeFormData, roof_type: e.target.value })}
                              className="block w-full rounded-lg border-2 border-zinc-300 bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
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
                        </div>
                      </>
                    )}


                    {/* Status Management Section - Visible to ALL roles (Admin, Super Admin, BackOffice) */}
                    <div className="pb-4 border-b border-zinc-200 mt-6">
                      <h3 className="text-lg font-semibold text-[#1E1E1E]">Status Management</h3>
                    </div>

                    {/* Work Order Status */}
                    <div>
                      <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                        Work Order Status
                      </label>
                      <select
                        value={backOfficeFormData.work_order_status}
                        onChange={(e) => setBackOfficeFormData({ ...backOfficeFormData, work_order_status: e.target.value })}
                        className="block w-full rounded-lg border-2 border-zinc-300 bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                      >
                        <option value="">Select Status</option>
                        <option value="Erection and Installation">Erection and Installation</option>
                        <option value="Dept. Submission of Docs">Dept. Submission of Docs</option>
                        <option value="Meter Installation">Meter Installation</option>
                        <option value="Subsidy Ready for Redemption">Subsidy Ready for Redemption</option>
                        <option value="Customer Eligible for Redemption">Customer Eligible for Redemption</option>
                        <option value="Subsidy Follow Up">Subsidy Follow Up</option>
                        <option value="Subsidy Received by Customer">Subsidy Received by Customer</option>
                        <option value="Online Mobile App Demo to Customer">Online Mobile App Demo to Customer</option>
                        <option value="Tata Sales Force Upload">Tata Sales Force Upload</option>
                        <option value="Warranty Certificate Approval">Warranty Certificate Approval</option>
                        <option value="Warranty Certificate Given to Customer">Warranty Certificate Given to Customer</option>
                        <option value="Successfully Completed">Successfully Completed</option>
                      </select>
                      <p className="mt-1 text-sm text-zinc-600">Current: {backOfficeEditingWorkOrder.work_order_status || 'Not set'}</p>
                    </div>

                    {/* Subsidy Fields Row - Show from 'Subsidy Ready for Redemption' onwards */}
                    {['Subsidy Ready for Redemption', 'Customer Eligible for Redemption', 'Subsidy Follow Up', 'Subsidy Received by Customer', 'Online Mobile App Demo to Customer', 'Tata Sales Force Upload', 'Warranty Certificate Approval', 'Warranty Certificate Given to Customer', 'Successfully Completed'].includes(backOfficeFormData.work_order_status) && (
                    <div className="grid grid-cols-2 gap-6">
                      {/* Subsidy Amount */}
                      <div>
                        <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                          Subsidy Amount
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-[#1E1E1E] opacity-70">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            value={backOfficeFormData.subsidy_amount}
                            onChange={(e) => setBackOfficeFormData({ ...backOfficeFormData, subsidy_amount: e.target.value })}
                            placeholder="Enter subsidy amount"
                            className="block w-full rounded-lg border-2 border-zinc-300 bg-white pl-10 pr-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                          />
                        </div>
                      </div>

                      {/* Subsidy Status */}
                      <div>
                        <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                          Subsidy Status
                        </label>
                        <select
                          value={backOfficeFormData.subsidy_status}
                          onChange={(e) => setBackOfficeFormData({ ...backOfficeFormData, subsidy_status: e.target.value })}
                          className="block w-full rounded-lg border-2 border-zinc-300 bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                        >
                          <option value="">Select Status</option>
                          <option value="Pending">Pending</option>
                          <option value="Received">Received</option>
                          <option value="Not Applicable">Not Applicable</option>
                        </select>
                      </div>
                    </div>
                    )}

                    {/* Warranty Approval Field - Show only for 'Warranty Certificate Approval' status */}
                    {backOfficeFormData.work_order_status === 'Warranty Certificate Approval' && (
                    <div>
                      <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                        Warranty Approval Decision <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={backOfficeFormData.warranty_approval}
                        onChange={(e) => {
                          const value = e.target.value;
                          setBackOfficeFormData({ 
                            ...backOfficeFormData, 
                            warranty_approval: value,
                            // If rejected, change status to "Warranty Rejected"
                            work_order_status: value === 'Rejected' ? 'Warranty Rejected' : backOfficeFormData.work_order_status
                          });
                        }}
                        className="block w-full rounded-lg border-2 border-zinc-300 bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                      >
                        <option value="">Select Decision</option>
                        <option value="Accepted">Accepted</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                      {backOfficeFormData.warranty_approval === 'Rejected' && (
                        <p className="mt-1 text-sm text-red-600">
                          Note: Status will be changed to "Warranty Rejected"
                        </p>
                      )}
                    </div>
                    )}

                    {/* Installation Dates Row */}
                    <div className="grid grid-cols-2 gap-6">
                      {/* Erection Done At */}
                      <div>
                        <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                          Erection Completed Date
                        </label>
                        <input
                          type="date"
                          value={backOfficeFormData.erection_done_at}
                          onChange={(e) => setBackOfficeFormData({ ...backOfficeFormData, erection_done_at: e.target.value })}
                          className="block w-full rounded-lg border-2 border-zinc-300 bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                        />
                      </div>

                      {/* Meter Completed At */}
                      <div>
                        <label className="block text-base font-semibold text-[#1E1E1E] mb-2">
                          Meter Installation Date
                        </label>
                        <input
                          type="date"
                          value={backOfficeFormData.meter_completed_at}
                          onChange={(e) => setBackOfficeFormData({ ...backOfficeFormData, meter_completed_at: e.target.value })}
                          className="block w-full rounded-lg border-2 border-zinc-300 bg-white px-4 py-3 text-base text-[#1E1E1E] focus:border-[#0BC28E] focus:outline-none focus:ring-2 focus:ring-[#0BC28E] transition-all"
                        />
                      </div>
                    </div>

                    {/* Info Note */}
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> Leave fields empty to keep current values. Only filled fields will be updated.
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4 pt-6 mt-6 border-t border-zinc-200">
                    <button
                      type="submit"
                      disabled={backOfficeLoading}
                      className="flex-1 rounded-lg bg-[#0BC28E] px-6 py-3 text-base font-semibold text-white hover:bg-[#0BA87D] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                    >
                      {backOfficeLoading ? 'Updating...' : 'Update Work Order'}
                    </button>
                    <button
                      type="button"
                      onClick={closeBackOfficeModal}
                      disabled={backOfficeLoading}
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

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-8 max-w-md mx-4 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Success!</h3>
              <p className="text-sm text-gray-600 mb-6">
                Work order marked as dispatched successfully! WhatsApp messages have been sent.
              </p>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full rounded-lg bg-[#0BC28E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0BA87D] transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal (replaces browser alerts) */}
      {notificationModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/30 backdrop-blur-md p-4">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl border border-zinc-200">
            <div className="text-center">
              {/* Icon based on type */}
              <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${
                notificationModal.type === 'success' ? 'bg-green-100' :
                notificationModal.type === 'error' ? 'bg-red-100' : 'bg-blue-100'
              }`}>
                {notificationModal.type === 'success' && (
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {notificationModal.type === 'error' && (
                  <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {notificationModal.type === 'info' && (
                  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              
              {/* Title */}
              <h3 className={`text-lg font-semibold mb-2 ${
                notificationModal.type === 'success' ? 'text-green-800' :
                notificationModal.type === 'error' ? 'text-red-800' : 'text-blue-800'
              }`}>
                {notificationModal.title}
              </h3>
              
              {/* Message */}
              <p className="text-sm text-gray-600 mb-6">
                {notificationModal.message}
              </p>
              
              {/* OK Button */}
              <button
                onClick={closeNotification}
                className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors ${
                  notificationModal.type === 'success' ? 'bg-[#0BC28E] hover:bg-[#0BA87D]' :
                  notificationModal.type === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


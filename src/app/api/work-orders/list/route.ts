import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, hasRole } from '@/lib/supabase-server';

/**
 * API route to fetch work orders list
 * 
 * Security: RLS enforced + Server-side verification
 * - Uses cookie-based authentication (automatic)
 * - Verifies user identity from database (not frontend)
 * - RLS policies filter data at database level
 */

export async function POST(request: NextRequest) {
  try {
    console.log('=== WORK ORDERS LIST API DEBUG START ===');
    
    // Step 1: Create authenticated Supabase client (uses cookies)
    const supabase = await createServerClient(request);
    console.log('[DEBUG 1] Supabase client created');

    // Step 2: Verify user and get verified profile/role from database
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);
    console.log('[DEBUG 2] User verified:', { userId, companyId, roleName });

    // Step 3: Check authorization - only specific roles can access work orders
    const allowedRoles = ['Sales', 'salesLead', 'Admin', 'Super Admin', 'Inventory', 'Accounts', 'BackOffice'];
    if (!hasRole(roleName, allowedRoles)) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not have access to work orders' },
        { status: 403 }
      );
    }

    // Step 4: Parse pagination parameters (if sent in body)
    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {
      // No body is fine, use defaults
    }

    const { page = 1, limit = 50 } = body;

    // === DEBUG: Test if RLS functions work ===
    console.log('[DEBUG 3] Testing RLS function via raw query...');
    
    // Test 0: Check if we can call the get_user_company_id function directly
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_company_id');
      console.log('[DEBUG 3.1] get_user_company_id() result:', { 
        data: rpcData, 
        error: rpcError?.message,
        hint: rpcError?.hint 
      });
    } catch (e) {
      console.log('[DEBUG 3.1] get_user_company_id() call failed:', e);
    }

    // Test 0b: Check get_user_role_name function
    try {
      const { data: roleData, error: roleError } = await supabase.rpc('get_user_role_name');
      console.log('[DEBUG 3.2] get_user_role_name() result:', { 
        data: roleData, 
        error: roleError?.message 
      });
    } catch (e) {
      console.log('[DEBUG 3.2] get_user_role_name() call failed:', e);
    }

    // Test 1: Simple count without filters (to see if RLS allows ANY access)
    const { count: totalCount, error: countError } = await supabase
      .from('work_orders')
      .select('*', { count: 'exact', head: true });
    
    console.log('[DEBUG 4] Simple count result:', { totalCount, countError: countError?.message });

    // Test 2: Count with explicit company_id filter (bypassing RLS company check)
    const { count: filteredCount, error: filteredError } = await supabase
      .from('work_orders')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId);
    
    console.log('[DEBUG 5] Filtered count (with company_id):', { filteredCount, filteredError: filteredError?.message, companyId });

    // Step 5: Build query with RLS enforcement
    // Note: RLS policies automatically filter based on user's role and company
    // This manual filtering is an additional safety layer
    const isAdmin = roleName === 'Admin' || roleName === 'Super Admin';

    let query = supabase
      .from('work_orders')
      .select(`
        id,
        work_order_number,
        customer_name,
        customer_address,
        town,
        customer_email,
        customer_phone,
        power_bill,
        power_units,
        site_details,
        structure_height,
        roof_type,
        plant_capacity,
        order_amount,
        aadhaar_url,
        pan_url,
        bank_statement_url,
        cancelled_check_url,
        created_at,
        company_id,
        sales_executive_id,
        work_order_status,
        erection_done_at,
        meter_completed_at,
        subsidy_amount,
        subsidy_status,
        warranty_approval
      `)
      .order('created_at', { ascending: false });

    // Add pagination
    const pageSize = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
    const pageNumber = Math.max(parseInt(page) || 1, 1);
    const from = (pageNumber - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query.range(from, to);

    // Additional filtering (RLS + manual for defense in depth)
    if (roleName === 'Sales' || roleName === 'salesLead') {
      // Sales and salesLead see only their own work orders
      query = query.eq('sales_executive_id', userId);
    } else if (roleName === 'Inventory') {
      // Inventory sees "To Be Dispatched" and "Dispatched" orders
      query = query.eq('company_id', companyId);
      query = query.or('work_order_status.eq.To Be Dispatched,work_order_status.eq.Dispatched');
    } else if (roleName === 'BackOffice') {
      // BackOffice sees work orders from "Dispatched" onwards (post-dispatch processing)
      query = query.eq('company_id', companyId);
      query = query.in('work_order_status', [
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
      ]);
    } else if (isAdmin || roleName === 'Accounts') {
      // Admin and Accounts see all company work orders
      query = query.eq('company_id', companyId);
    }

    console.log('[DEBUG 6] Executing main query for role:', roleName);
    const { data, error } = await query;
    console.log('[DEBUG 7] Query result:', { rowCount: data?.length || 0, error: error?.message });
    console.log('=== WORK ORDERS LIST API DEBUG END ===');

    if (error) {
      console.error('Error fetching work orders:', error);
      return NextResponse.json(
        {
          error: error.message || 'Failed to fetch work orders',
          details: error.details || null,
          code: error.code || null
        },
        { status: 400 }
      );
    }

    // Fetch additional data (company names, sales executive names)
    let transformedData = data || [];
    if (transformedData.length > 0) {
      // Get unique company IDs
      const companyIds = [...new Set(
        transformedData
          .map((order: any) => order.company_id)
          .filter((id: string | null) => id !== null)
      )];

      // Fetch company names
      const companyMap: Record<string, string> = {};
      if (companyIds.length > 0 && companyIds.length <= 100) {
        try {
          const validCompanyIds = companyIds.filter((id: any) => id && typeof id === 'string' && id.length > 0);

          if (validCompanyIds.length > 0) {
            const { data: companiesData, error: companiesError } = await supabase
              .from('companies')
              .select('id, name')
              .in('id', validCompanyIds);

            if (companiesError) {
              console.error('Error fetching company names:', companiesError);
            } else if (companiesData && Array.isArray(companiesData)) {
              companiesData.forEach((company: any) => {
                if (company && company.id) {
                  companyMap[company.id] = company.name || 'N/A';
                }
              });
            }
          }
        } catch (err) {
          console.error('Exception fetching company names:', err);
        }
      }

      // Fetch sales executive names for all roles (not just Admin)
      const salesExecMap: Record<string, string> = {};
      const salesExecIds = [...new Set(
        transformedData
          .map((order: any) => order.sales_executive_id)
          .filter((id: string | null) => id !== null)
      )];

      if (salesExecIds.length > 0 && salesExecIds.length <= 100) {
        try {
          const validSalesExecIds = salesExecIds.filter((id: any) => id && typeof id === 'string' && id.length > 0);

          if (validSalesExecIds.length > 0) {
            // Use authenticated supabase client for profile lookup (RLS enforced)
            const { data: profilesData, error: profilesError } = await supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', validSalesExecIds);

            if (profilesError) {
              console.error('Error fetching sales executive names:', profilesError);
            } else if (profilesData && Array.isArray(profilesData)) {
              profilesData.forEach((profile: any) => {
                if (profile && profile.id) {
                  salesExecMap[profile.id] = profile.full_name || 'N/A';
                }
              });
            }
          }
        } catch (err) {
          console.error('Exception fetching sales executive names:', err);
        }
      }

      // Calculate work_order_status for orders where it's NULL
      const workOrderIdsNeedingStatus = transformedData
        .filter((order: any) => !order.work_order_status)
        .map((order: any) => order.id);

      const statusMap: Record<string, string | null> = {};

      if (workOrderIdsNeedingStatus.length > 0) {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('payments_data')
          .select('work_order_id, first_payment, second_payment, final_payment, additional_payment')
          .in('work_order_id', workOrderIdsNeedingStatus);

        if (!paymentsError && paymentsData) {
          const paymentsByWorkOrder: Record<string, any[]> = {};
          paymentsData.forEach((payment: any) => {
            if (!paymentsByWorkOrder[payment.work_order_id]) {
              paymentsByWorkOrder[payment.work_order_id] = [];
            }
            paymentsByWorkOrder[payment.work_order_id].push(payment);
          });

          workOrderIdsNeedingStatus.forEach((workOrderId: string) => {
            const workOrder = transformedData.find((o: any) => o.id === workOrderId);
            if (!workOrder) return;

            const payments = paymentsByWorkOrder[workOrderId] || [];

            let totalPaid = 0;
            payments.forEach((payment: any) => {
              totalPaid += parseFloat(payment.first_payment || 0);
              totalPaid += parseFloat(payment.second_payment || 0);
              totalPaid += parseFloat(payment.final_payment || 0);
              totalPaid += parseFloat(payment.additional_payment || 0);
            });

            const orderAmount = parseFloat(workOrder.order_amount?.toString() || '0');

            if (orderAmount > 0 && totalPaid >= orderAmount * 0.65) {
              statusMap[workOrderId] = 'To Be Dispatched';
            } else {
              statusMap[workOrderId] = null;
            }
          });
        }
      }

      // Add company names, sales executive names, and calculated status
      transformedData = transformedData.map((order: any) => ({
        ...order,
        company_name: order.company_id
          ? companyMap[order.company_id] || 'N/A'
          : 'N/A',
        sales_executive_name: order.sales_executive_id
          ? salesExecMap[order.sales_executive_id] || 'N/A'
          : 'N/A',
        work_order_status: order.work_order_status || statusMap[order.id] || null,
      }));

      // For Inventory role: Show "To Be Dispatched" and "Dispatched" orders
      if (roleName === 'Inventory') {
        transformedData = transformedData.filter((order: any) =>
          order.work_order_status === 'To Be Dispatched' || order.work_order_status === 'Dispatched'
        );
      }

      // For BackOffice role: Show work orders from "Dispatched" onwards
      if (roleName === 'BackOffice') {
        const backOfficeStatuses = [
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
        transformedData = transformedData.filter((order: any) =>
          order.work_order_status && backOfficeStatuses.includes(order.work_order_status)
        );
      }
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('work_orders')
      .select('id', { count: 'exact', head: true });

    // Apply same filters for count
    if (roleName === 'Sales' || roleName === 'salesLead') {
      countQuery = countQuery.eq('sales_executive_id', userId);
    } else if (roleName === 'Inventory') {
      countQuery = countQuery.eq('company_id', companyId);
      countQuery = countQuery.or('work_order_status.eq.To Be Dispatched,work_order_status.eq.Dispatched');
    } else if (roleName === 'BackOffice') {
      countQuery = countQuery.eq('company_id', companyId);
      countQuery = countQuery.in('work_order_status', [
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
      ]);
    } else if (isAdmin || roleName === 'Accounts') {
      countQuery = countQuery.eq('company_id', companyId);
    }

    const { count } = await countQuery;

    return NextResponse.json({
      workOrders: transformedData,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error: unknown) {
    console.error('API Error fetching work orders:', error);

    // Handle authentication errors
    if (error instanceof Error && error.message?.includes('Unauthorized')) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, hasRole, getServiceClient } from '@/lib/supabase-server';

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
    // Step 1: Create authenticated Supabase client (uses cookies)
    const supabase = await createServerClient(request);

    // Step 2: Verify user and get verified profile/role from database
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Step 3: Check authorization - only specific roles can access work orders
    const allowedRoles = ['Sales', 'salesLead', 'Admin', 'Super Admin', 'Inventory', 'Accounts'];
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
        work_order_status
      `)
      .order('created_at', { ascending: false });

    // Add pagination
    const pageSize = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
    const pageNumber = Math.max(parseInt(page) || 1, 1);
    const from = (pageNumber - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query.range(from, to);

    // Additional filtering (RLS + manual for defense in depth)
    if (roleName === 'Sales') {
      // Sales see only their own work orders
      query = query.eq('sales_executive_id', userId);
    } else if (roleName === 'Inventory') {
      // Inventory sees ONLY "To Be Dispatched" and "Dispatched" orders (NO NULL status)
      query = query.eq('company_id', companyId);
      query = query.or('work_order_status.eq.To Be Dispatched,work_order_status.eq.Dispatched');
    } else if (isAdmin || roleName === 'Accounts') {
      // Admin and Accounts see all company work orders
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;

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
            // Use service client to bypass RLS for profile lookup (same as leads route)
            const serviceClient = getServiceClient();
            const { data: profilesData, error: profilesError } = await serviceClient
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
      // IMPORTANT: Trust database status - if status is "To Be Dispatched" in DB, it was already verified
      // The query at line 84 already filters for these statuses, so we trust what comes from DB
      // Only verify payment for NULL status orders that were calculated to be "To Be Dispatched" (from statusMap)
      if (roleName === 'Inventory') {
        // Track which orders have status from database vs calculated
        const originalDataMap = new Map(data.map((d: any) => [d.id, d.work_order_status]));

        // Separate orders: DB status (trusted) vs calculated status (needs verification)
        const ordersNeedingVerification = transformedData.filter((order: any) => {
          // If status is "To Be Dispatched" but wasn't in original DB query, it's calculated
          return order.work_order_status === 'To Be Dispatched' &&
            originalDataMap.get(order.id) !== 'To Be Dispatched';
        });

        // Only verify payment for calculated "To Be Dispatched" orders
        if (ordersNeedingVerification.length > 0) {
          const calculatedIds = ordersNeedingVerification.map((o: any) => o.id);

          const { data: paymentsData } = await supabase
            .from('payments_data')
            .select('work_order_id, first_payment, second_payment, final_payment, additional_payment')
            .in('work_order_id', calculatedIds);

          if (paymentsData && paymentsData.length > 0) {
            const paymentsByWorkOrder: Record<string, number> = {};
            paymentsData.forEach((payment: any) => {
              const workOrderId = payment.work_order_id;
              if (!paymentsByWorkOrder[workOrderId]) {
                paymentsByWorkOrder[workOrderId] = 0;
              }
              paymentsByWorkOrder[workOrderId] += parseFloat(payment.first_payment || 0);
              paymentsByWorkOrder[workOrderId] += parseFloat(payment.second_payment || 0);
              paymentsByWorkOrder[workOrderId] += parseFloat(payment.final_payment || 0);
              paymentsByWorkOrder[workOrderId] += parseFloat(payment.additional_payment || 0);
            });

            // Filter: Include all "Dispatched", all DB "To Be Dispatched" (trusted), and verified calculated "To Be Dispatched"
            transformedData = transformedData.filter((order: any) => {
              if (order.work_order_status === 'Dispatched') {
                return true; // Always include "Dispatched"
              }
              if (order.work_order_status === 'To Be Dispatched') {
                // If it came from DB, trust it (already verified)
                if (originalDataMap.get(order.id) === 'To Be Dispatched') {
                  return true;
                }
                // If calculated, verify payment >= 65%
                const totalPaid = paymentsByWorkOrder[order.id] || 0;
                const orderAmount = parseFloat(order.order_amount?.toString() || '0');
                return orderAmount > 0 && totalPaid >= orderAmount * 0.65;
              }
              return false;
            });
          } else {
            // No payment data - trust DB status, filter out unverified calculated orders
            transformedData = transformedData.filter((order: any) => {
              if (order.work_order_status === 'Dispatched') {
                return true;
              }
              if (order.work_order_status === 'To Be Dispatched') {
                // Only include if it came from DB (trusted)
                return originalDataMap.get(order.id) === 'To Be Dispatched';
              }
              return false;
            });
          }
        } else {
          // No calculated orders - show all "To Be Dispatched" and "Dispatched" (all from DB, trusted)
          transformedData = transformedData.filter((order: any) =>
            order.work_order_status === 'Dispatched' || order.work_order_status === 'To Be Dispatched'
          );
        }
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

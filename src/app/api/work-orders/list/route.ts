import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { userId, companyId, roleName } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Validate roleName
     const allowedRoles = ['Sales', 'Admin', 'Super Admin', 'Inventory'];
    if (!roleName || !allowedRoles.includes(roleName)) {
      return NextResponse.json(
        { error: 'Invalid or missing role. Only Sales, Admin, Super Admin, and Inventory can access work orders.' },
        { status: 403 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      console.error('NEXT_PUBLIC_SUPABASE_URL is not configured');
      return NextResponse.json(
        { error: 'Supabase URL not configured' },
        { status: 500 }
      );
    }

    if (!supabaseServiceKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not configured');
      return NextResponse.json(
        { error: 'Service role key not configured' },
        { status: 500 }
      );
    }

    // Use service role key to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Build query based on role
    const isAdmin = roleName === 'Admin' || roleName === 'Super Admin';
    
    let query = supabase
      .from('work_orders')
      .select(`
        id,
        work_order_number,
        customer_name,
        customer_address,
        customer_phone,
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

    // Filter based on role
    if (roleName === 'Sales') {
      // Sales can only see their own work orders
      query = query.eq('sales_executive_id', userId);
    } else if (roleName === 'Inventory') {
      // Inventory can see work orders with status "To Be Dispatched" and "Dispatched" in their company
      // Also include NULL status to catch work orders that meet 65%+ payment but trigger hasn't run
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
      query = query.or('work_order_status.eq.To Be Dispatched,work_order_status.eq.Dispatched,work_order_status.is.null');
    } else if (roleName === 'Admin' || roleName === 'Super Admin') {
      // Admin/Super Admin can see all work orders in their company
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
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

    // Fetch company names and sales executive names
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
          // Filter out any invalid IDs
          const validCompanyIds = companyIds.filter((id: any) => id && typeof id === 'string' && id.length > 0);
          
          if (validCompanyIds.length > 0) {
            const { data: companiesData, error: companiesError } = await supabase
              .from('companies')
              .select('id, name')
              .in('id', validCompanyIds);

            if (companiesError) {
              console.error('Error fetching company names:', companiesError);
              // Check if error message contains HTML (indicating a network/proxy issue)
              if (typeof companiesError.message === 'string' && companiesError.message.includes('<html>')) {
                console.error('Received HTML error response - possible network/proxy issue');
              }
              // Continue without company names rather than failing completely
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
          // Continue without company names
        }
      } else if (companyIds.length > 100) {
        console.warn('Too many company IDs to fetch in one query, skipping company names');
      }

      // For Admin/Super Admin, fetch sales executive names
      const salesExecMap: Record<string, string> = {};
      if (isAdmin) {
        // Get unique sales executive IDs
        const salesExecIds = [...new Set(
          transformedData
            .map((order: any) => order.sales_executive_id)
            .filter((id: string | null) => id !== null)
        )];

        // Fetch sales executive names
        if (salesExecIds.length > 0 && salesExecIds.length <= 100) {
          try {
            // Filter out any invalid IDs
            const validSalesExecIds = salesExecIds.filter((id: any) => id && typeof id === 'string' && id.length > 0);
            
            if (validSalesExecIds.length > 0) {
              const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', validSalesExecIds);

              if (profilesError) {
                console.error('Error fetching sales executive names:', profilesError);
                // Check if error message contains HTML (indicating a network/proxy issue)
                if (typeof profilesError.message === 'string' && profilesError.message.includes('<html>')) {
                  console.error('Received HTML error response - possible network/proxy issue');
                }
                // Continue without sales executive names rather than failing completely
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
            // Continue without sales executive names
          }
        } else if (salesExecIds.length > 100) {
          console.warn('Too many sales executive IDs to fetch in one query, skipping names');
        }
      }

      // Calculate work_order_status for orders where it's NULL
      // This handles cases where the trigger hasn't run yet
      const workOrderIdsNeedingStatus = transformedData
        .filter((order: any) => !order.work_order_status)
        .map((order: any) => order.id);

      const statusMap: Record<string, string | null> = {};
      
      if (workOrderIdsNeedingStatus.length > 0) {
        // Fetch payments for work orders with NULL status
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('payments_data')
          .select('work_order_id, first_payment, second_payment, final_payment, additional_payment')
          .in('work_order_id', workOrderIdsNeedingStatus);

        if (!paymentsError && paymentsData) {
          // Group payments by work_order_id and calculate totals
          const paymentsByWorkOrder: Record<string, any[]> = {};
          paymentsData.forEach((payment: any) => {
            if (!paymentsByWorkOrder[payment.work_order_id]) {
              paymentsByWorkOrder[payment.work_order_id] = [];
            }
            paymentsByWorkOrder[payment.work_order_id].push(payment);
          });

          // Calculate status for each work order
          workOrderIdsNeedingStatus.forEach((workOrderId: string) => {
            const workOrder = transformedData.find((o: any) => o.id === workOrderId);
            if (!workOrder) return;

            const payments = paymentsByWorkOrder[workOrderId] || [];
            
            // Calculate total paid (same logic as trigger)
            let totalPaid = 0;
            payments.forEach((payment: any) => {
              totalPaid += parseFloat(payment.first_payment || 0);
              totalPaid += parseFloat(payment.second_payment || 0);
              totalPaid += parseFloat(payment.final_payment || 0);
              totalPaid += parseFloat(payment.additional_payment || 0);
            });

            const orderAmount = parseFloat(workOrder.order_amount?.toString() || '0');
            
            // Determine status
            if (orderAmount > 0 && totalPaid >= orderAmount * 0.65) {
              statusMap[workOrderId] = 'To Be Dispatched';
            } else {
              statusMap[workOrderId] = null;
            }
          });
        }
      }

      // Add company names, sales executive names, and calculated status to work orders
      transformedData = transformedData.map((order: any) => ({
        ...order,
        company_name: order.company_id 
          ? companyMap[order.company_id] || 'N/A'
          : 'N/A',
        ...(isAdmin && {
          sales_executive_name: order.sales_executive_id 
            ? salesExecMap[order.sales_executive_id] || 'N/A'
            : 'N/A',
        }),
        // Use calculated status if work_order_status is NULL, otherwise use the database value
        work_order_status: order.work_order_status || statusMap[order.id] || null,
      }));

      // For Inventory role, show work orders with "To Be Dispatched" and "Dispatched" status
      // This allows inventory to see both pending dispatch and already dispatched orders
      if (roleName === 'Inventory') {
        transformedData = transformedData.filter((order: any) => 
          order.work_order_status === 'To Be Dispatched' || order.work_order_status === 'Dispatched'
        );
      }
    }

    return NextResponse.json({
      workOrders: transformedData,
    });
  } catch (error: unknown) {
    console.error('API Error fetching work orders:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}


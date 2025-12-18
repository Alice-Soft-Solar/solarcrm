import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, companyId, roleName, filters } = body;

    if (!userId || !companyId) {
      return NextResponse.json(
        { error: 'User ID and Company ID are required' },
        { status: 400 }
      );
    }

    // Extract filter values
    const searchQuery = filters?.searchQuery || '';
    const filterCompany = filters?.filterCompany || '';
    const filterSalesExecutive = filters?.filterSalesExecutive || '';
    const filterPlantCapacity = filters?.filterPlantCapacity || '';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const isAdmin = roleName === 'Admin' || roleName === 'Super Admin';
    const isSalesLead = roleName === 'salesLead';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Fetch leads statistics with role-based filtering
    let leadsQuery = supabase
      .from('leads')
      .select('id, status, company_id, creator_id');

    // For Sales Lead: Fetch separate stats for "My Leads" and "Team Leads"
    let myLeadsStats = null;
    let teamLeadsStats = null;

    if (isSalesLead) {
      // Fetch Sales Lead's own leads
      const { data: myLeads, error: myLeadsError } = await supabase
        .from('leads')
        .select('id, status, company_id, creator_id')
        .eq('creator_id', userId);

      if (myLeadsError) {
        console.error('Error fetching Sales Lead own leads:', myLeadsError);
      }

      // First, get the Sales role ID
      const { data: salesRole, error: salesRoleError } = await supabase
        .from('roles')
        .select('id')
        .eq('role_name', 'Sales')
        .single();

      if (salesRoleError) {
        console.error('Error fetching Sales role:', salesRoleError);
      }

      // Fetch Sales role users in the same company
      const { data: salesProfiles, error: salesProfilesError } = salesRole
        ? await supabase
            .from('profiles')
            .select('id')
            .eq('company_id', companyId)
            .eq('role_id', salesRole.id)
        : { data: [], error: null };

      if (salesProfilesError) {
        console.error('Error fetching Sales profiles:', salesProfilesError);
      }

      const salesUserIds = (salesProfiles || []).map((p: any) => p.id);

      // Fetch team leads (leads created by Sales role users)
      const { data: teamLeads, error: teamLeadsError } = salesUserIds.length > 0
        ? await supabase
            .from('leads')
            .select('id, status, company_id, creator_id')
            .eq('company_id', companyId)
            .in('creator_id', salesUserIds)
        : { data: [], error: null };

      if (teamLeadsError) {
        console.error('Error fetching team leads:', teamLeadsError);
      }

      // Calculate "My Leads" statistics
      const myLeadsData = myLeads || [];
      myLeadsStats = {
        total: myLeadsData.length,
        interested: myLeadsData.filter((lead: any) => lead.status === 'Interested').length,
        notInterested: myLeadsData.filter((lead: any) => lead.status === 'Not Interested').length,
        followUpRequired: myLeadsData.filter((lead: any) => lead.status === 'Follow Up Required').length,
      };

      // Calculate "Team Leads" statistics
      const teamLeadsData = teamLeads || [];
      teamLeadsStats = {
        total: teamLeadsData.length,
        interested: teamLeadsData.filter((lead: any) => lead.status === 'Interested').length,
        notInterested: teamLeadsData.filter((lead: any) => lead.status === 'Not Interested').length,
        followUpRequired: teamLeadsData.filter((lead: any) => lead.status === 'Follow Up Required').length,
      };

    }

    // Handle leads query result (only for non-Sales Lead roles)
    let leads: any[] = [];
    let leadsError: any = null;
    
    if (!isSalesLead) {
      // Apply role-based filtering for leads (Sales, Admin, Super Admin)
      if (roleName === 'Sales') {
        // Sales can only see their own leads
        leadsQuery = leadsQuery.eq('creator_id', userId);
      } else if (isAdmin) {
        // Admin can see all leads in their company
        leadsQuery = leadsQuery.eq('company_id', companyId);
      }

      const { data: leadsData, error: leadsErrorData } = await leadsQuery;
      leads = leadsData || [];
      leadsError = leadsErrorData;
    }

    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
    }

    // Calculate lead statistics (for non-Sales Lead roles)
    const allLeads = leads || [];
    const totalLeads = allLeads.length;
    const interestedLeads = allLeads.filter((lead: any) => 
      lead.status === 'Interested'
    ).length;
    const notInterestedLeads = allLeads.filter((lead: any) => 
      lead.status === 'Not Interested'
    ).length;
    const followUpRequiredLeads = allLeads.filter((lead: any) => 
      lead.status === 'Follow Up Required'
    ).length;

    // Build work orders query with all necessary fields for filtering
    let workOrdersQuery = supabase
      .from('work_orders')
      .select('id, order_amount, created_at, work_order_status, company_id, sales_executive_id, work_order_number, customer_name, customer_phone, customer_address, plant_capacity, company_id');

    if (!isAdmin) {
      workOrdersQuery = workOrdersQuery.eq('company_id', companyId);
      if (roleName === 'Sales') {
        workOrdersQuery = workOrdersQuery.eq('sales_executive_id', userId);
      }
    } else {
      workOrdersQuery = workOrdersQuery.eq('company_id', companyId);
    }

    const { data: workOrders, error: workOrdersError } = await workOrdersQuery;

    if (workOrdersError) {
      console.error('Error fetching work orders:', workOrdersError);
      return NextResponse.json(
        { error: 'Failed to fetch work orders' },
        { status: 500 }
      );
    }

    // Fetch company names and sales executive names for filtering
    let companyMap: Record<string, string> = {};
    let salesExecMap: Record<string, string> = {};
    
    if (workOrders && workOrders.length > 0) {
      const companyIds = [...new Set(workOrders.map((o: any) => o.company_id).filter(Boolean))];
      const salesExecIds = [...new Set(workOrders.map((o: any) => o.sales_executive_id).filter(Boolean))];

      if (companyIds.length > 0) {
        const { data: companies } = await supabase
          .from('companies')
          .select('id, name')
          .in('id', companyIds);
        if (companies) {
          companies.forEach((c: any) => {
            companyMap[c.id] = c.name;
          });
        }
      }

      if (salesExecIds.length > 0) {
        const { data: salesExecs } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', salesExecIds);
        if (salesExecs) {
          salesExecs.forEach((se: any) => {
            salesExecMap[se.id] = se.full_name;
          });
        }
      }
    }

    // Apply filters to work orders
    let filteredWorkOrders = workOrders || [];
    
    // Apply search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filteredWorkOrders = filteredWorkOrders.filter((order: any) => {
        const companyName = companyMap[order.company_id] || '';
        const salesExecName = salesExecMap[order.sales_executive_id] || '';
        return (
          order.work_order_number?.toLowerCase().includes(query) ||
          order.customer_name?.toLowerCase().includes(query) ||
          order.customer_phone?.toLowerCase().includes(query) ||
          companyName.toLowerCase().includes(query) ||
          order.customer_address?.toLowerCase().includes(query) ||
          salesExecName.toLowerCase().includes(query)
        );
      });
    }

    // Apply company filter
    if (filterCompany) {
      filteredWorkOrders = filteredWorkOrders.filter((order: any) => {
        return companyMap[order.company_id] === filterCompany;
      });
    }

    // Apply sales executive filter
    if (filterSalesExecutive) {
      filteredWorkOrders = filteredWorkOrders.filter((order: any) => {
        return salesExecMap[order.sales_executive_id] === filterSalesExecutive;
      });
    }

    // Apply plant capacity filter
    if (filterPlantCapacity) {
      filteredWorkOrders = filteredWorkOrders.filter((order: any) => {
        return order.plant_capacity === filterPlantCapacity;
      });
    }

    // Calculate work order statuses (handle NULL statuses)
    // OPTIMIZATION: Fetch all payments in one query instead of N+1 queries
    const workOrderIdsNeedingStatus = filteredWorkOrders
      .filter((order: any) => !order.work_order_status)
      .map((order: any) => order.id);

    const paymentsByWorkOrder: Record<string, any[]> = {};
    
    if (workOrderIdsNeedingStatus.length > 0) {
      // Fetch all payments for work orders with NULL status in one query
      const { data: allPayments } = await supabase
        .from('payments_data')
        .select('work_order_id, first_payment, second_payment, final_payment, additional_payment')
        .in('work_order_id', workOrderIdsNeedingStatus);

      if (allPayments) {
        // Group payments by work_order_id
        allPayments.forEach((payment: any) => {
          if (!paymentsByWorkOrder[payment.work_order_id]) {
            paymentsByWorkOrder[payment.work_order_id] = [];
          }
          paymentsByWorkOrder[payment.work_order_id].push(payment);
        });
      }
    }

    // Calculate status for each work order (now using pre-fetched data)
    const workOrdersWithStatus = filteredWorkOrders.map((order: any) => {
      if (order.work_order_status) {
        return { ...order, status: order.work_order_status };
      }

      // Calculate status from pre-fetched payments
      const payments = paymentsByWorkOrder[order.id] || [];
      let totalPaid = 0;
      
      payments.forEach((p: any) => {
        totalPaid += parseFloat(p.first_payment || 0);
        totalPaid += parseFloat(p.second_payment || 0);
        totalPaid += parseFloat(p.final_payment || 0);
        totalPaid += parseFloat(p.additional_payment || 0);
      });

      const orderAmount = parseFloat(order.order_amount?.toString() || '0');
      const status = orderAmount > 0 && totalPaid >= orderAmount * 0.65
        ? 'To Be Dispatched'
        : 'Pending';

      return { ...order, status };
    });

    // Work Orders Stats
    const totalWorkOrders = workOrdersWithStatus.length;
    const pendingOrders = workOrdersWithStatus.filter((o: any) => 
      o.status === 'Pending' || !o.status
    ).length;
    const closedOrders = workOrdersWithStatus.filter((o: any) => 
      o.status === 'Closed' || o.status === 'Completed'
    ).length;
    const toBeDispatched = workOrdersWithStatus.filter((o: any) => 
      o.status === 'To Be Dispatched'
    ).length;
    const dispatchedOrders = workOrdersWithStatus.filter((o: any) => 
      o.status === 'Dispatched'
    ).length;

    // Time-based work orders
    const todayOrders = workOrdersWithStatus.filter((o: any) => {
      const created = new Date(o.created_at);
      return created >= today;
    }).length;

    const weekOrders = workOrdersWithStatus.filter((o: any) => {
      const created = new Date(o.created_at);
      return created >= startOfWeek;
    }).length;

    const monthOrders = workOrdersWithStatus.filter((o: any) => {
      const created = new Date(o.created_at);
      return created >= startOfMonth;
    }).length;

    // Fetch payments
    let paymentsQuery = supabase
      .from('payments_data')
      .select('amount, transaction_date, work_order_id, company_id');

    if (!isAdmin) {
      paymentsQuery = paymentsQuery.eq('company_id', companyId);
    } else {
      paymentsQuery = paymentsQuery.eq('company_id', companyId);
    }

    const { data: payments, error: paymentsError } = await paymentsQuery;

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError);
    }

    // Payment Stats
    const allPayments = payments || [];
    const todayPayments = allPayments.filter((p: any) => {
      const date = new Date(p.transaction_date);
      return date >= today;
    });
    const todayReceived = todayPayments.reduce((sum: number, p: any) => 
      sum + parseFloat(p.amount || 0), 0
    );

    const monthPayments = allPayments.filter((p: any) => {
      const date = new Date(p.transaction_date);
      return date >= startOfMonth;
    });
    const monthlyReceived = monthPayments.reduce((sum: number, p: any) => 
      sum + parseFloat(p.amount || 0), 0
    );

    // Calculate pending payments (sum of order_amount - total paid)
    let totalPending = 0;
    for (const order of workOrdersWithStatus) {
      const orderAmount = parseFloat(order.order_amount?.toString() || '0');
      const { data: orderPayments } = await supabase
        .from('payments_data')
        .select('first_payment, second_payment, final_payment, additional_payment')
        .eq('work_order_id', order.id);

      let totalPaid = 0;
      if (orderPayments) {
        orderPayments.forEach((p: any) => {
          totalPaid += parseFloat(p.first_payment || 0);
          totalPaid += parseFloat(p.second_payment || 0);
          totalPaid += parseFloat(p.final_payment || 0);
          totalPaid += parseFloat(p.additional_payment || 0);
        });
      }

      totalPending += Math.max(0, orderAmount - totalPaid);
    }

    // Dispatch Summary
    const dispatchToday = workOrdersWithStatus.filter((o: any) => {
      if (o.status !== 'To Be Dispatched') return false;
      const created = new Date(o.created_at);
      return created >= today;
    }).length;

    const dispatchWeek = workOrdersWithStatus.filter((o: any) => {
      if (o.status !== 'To Be Dispatched') return false;
      const created = new Date(o.created_at);
      return created >= startOfWeek;
    }).length;

    const dispatchMonth = workOrdersWithStatus.filter((o: any) => {
      if (o.status !== 'To Be Dispatched') return false;
      const created = new Date(o.created_at);
      return created >= startOfMonth;
    }).length;

    // Chart data - Work Orders by Status
    const statusDistribution = {
      'Pending': pendingOrders,
      'To Be Dispatched': toBeDispatched,
      'Dispatched': dispatchedOrders,
      'Closed': closedOrders,
    };

    // Chart data - Payments over time (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (6 - i));
      date.setHours(0, 0, 0, 0);
      return date;
    });

    const paymentsByDay = last7Days.map(date => {
      const dayPayments = allPayments.filter((p: any) => {
        const paymentDate = new Date(p.transaction_date);
        paymentDate.setHours(0, 0, 0, 0);
        return paymentDate.getTime() === date.getTime();
      });
      const total = dayPayments.reduce((sum: number, p: any) => 
        sum + parseFloat(p.amount || 0), 0
      );
      return {
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        amount: total,
      };
    });

    return NextResponse.json({
      success: true,
      stats: {
        workOrders: {
          total: totalWorkOrders,
          pending: pendingOrders,
          closed: closedOrders,
          toBeDispatched,
          dispatched: dispatchedOrders,
          today: todayOrders,
          week: weekOrders,
          month: monthOrders,
        },
        leads: {
          total: totalLeads,
          interested: interestedLeads,
          notInterested: notInterestedLeads,
          followUpRequired: followUpRequiredLeads,
        },
        // Sales Lead specific: separate stats for "My Leads" and "Team Leads"
        ...(isSalesLead && myLeadsStats && teamLeadsStats ? {
          myLeads: myLeadsStats,
          teamLeads: teamLeadsStats,
        } : {}),
        payments: {
          todayReceived,
          monthlyReceived,
          pending: totalPending,
        },
        dispatch: {
          today: dispatchToday,
          week: dispatchWeek,
          month: dispatchMonth,
          pending: toBeDispatched,
        },
        charts: {
          statusDistribution,
          paymentsByDay,
        },
      },
    });
  } catch (error: any) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
}


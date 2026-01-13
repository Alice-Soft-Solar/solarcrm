import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, isAdmin as checkIsAdmin, isSalesLead as checkIsSalesLead, isSales as checkIsSales } from '@/lib/supabase-server';

/**
 * API route to fetch dashboard statistics
 * 
 * Security: RLS enforced + Server-side verification
 * - Uses cookie-based authentication (automatic)
 * - Verifies user identity from database (not frontend)
 * - Returns data based on verified user role and company
 * 
 * Role Access:
 * - Admin/Super Admin: All company data (leads, work orders, payments, dispatch)
 * - Sales Lead: Only leads data for company
 * - Sales: Only their own leads and work orders
 * - Inventory: Only dispatch data
 */

export async function POST(request: NextRequest) {
  try {
    // Step 1: Create authenticated Supabase client (uses cookies)
    const supabase = await createServerClient(request);

    // Step 2: Verify user and get verified profile/role from database
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);
    
    console.log('[DEBUG] User Verification - userId:', userId, 'companyId:', companyId, 'roleName:', roleName);

    // Step 3: Determine role-based access
    const isAdmin = checkIsAdmin(roleName);
    const isSalesLead = checkIsSalesLead(roleName);
    const isSales = checkIsSales(roleName);
    const isInventory = roleName === 'Inventory';
    const isAccounts = roleName === 'Accounts';

    // Step 4: Initialize response structure
    const response: any = {
      stats: {
        charts: {
          statusDistribution: {},
          paymentsByDay: [],
        },
      },
    };

    let totalOrderAmount = 0;

    // Step 5: Fetch leads statistics (if user has access)
    const LEADS_ALLOWED_ROLES = ['Sales', 'salesLead', 'Admin', 'Super Admin'];
    const hasLeadsAccess = LEADS_ALLOWED_ROLES.includes(roleName);

    if (hasLeadsAccess) {
      try {
        if (isSalesLead) {
          // Sales Lead: Calculate separate stats for "My Leads" and "Team Leads"

          // My Leads: Leads created by the Sales Lead (creator_id = userId)
          const myLeadsQuery = supabase
            .from('leads')
            .select('id, status')
            .eq('company_id', companyId)
            .eq('creator_id', userId);

          const { data: myLeadsData, error: myLeadsError } = await myLeadsQuery;

          if (myLeadsError) {
            console.error('Error fetching my leads stats:', myLeadsError);
          } else if (myLeadsData) {
            const myTotal = myLeadsData.length;
            const myInterested = myLeadsData.filter(l => l.status === 'Interested').length;
            const myNotInterested = myLeadsData.filter(l => l.status === 'Not Interested').length;
            const myFollowUpRequired = myLeadsData.filter(l => l.status === 'Follow Up Required').length;

            response.stats.myLeads = {
              total: myTotal,
              interested: myInterested,
              notInterested: myNotInterested,
              followUpRequired: myFollowUpRequired,
            };
          }

          // Team Leads: All leads from the same company (all company leads)
          const teamLeadsQuery = supabase
            .from('leads')
            .select('id, status')
            .eq('company_id', companyId);

          const { data: teamLeadsData, error: teamLeadsError } = await teamLeadsQuery;

          if (teamLeadsError) {
            console.error('Error fetching team leads stats:', teamLeadsError);
          } else if (teamLeadsData) {
            const teamTotal = teamLeadsData.length;
            const teamInterested = teamLeadsData.filter(l => l.status === 'Interested').length;
            const teamNotInterested = teamLeadsData.filter(l => l.status === 'Not Interested').length;
            const teamFollowUpRequired = teamLeadsData.filter(l => l.status === 'Follow Up Required').length;

            response.stats.teamLeads = {
              total: teamTotal,
              interested: teamInterested,
              notInterested: teamNotInterested,
              followUpRequired: teamFollowUpRequired,
            };
          }
        } else {
          // For other roles (Sales, Admin, Super Admin): Single leads stats
          let leadsQuery = supabase.from('leads').select('id, status');

          // For Sales: Only their own leads
          if (isSales) {
            leadsQuery = leadsQuery.eq('creator_id', userId);
          } else if (isAdmin) {
            // For Admin: All company leads
            leadsQuery = leadsQuery.eq('company_id', companyId);
          }

          // Execute query (RLS handles additional filtering)
          const { data: leadsData, error: leadsError } = await leadsQuery;

          if (leadsError) {
            console.error('Error fetching leads stats:', leadsError);
          } else if (leadsData) {
            // Calculate statistics
            const total = leadsData.length;
            const interested = leadsData.filter(l => l.status === 'Interested').length;
            const notInterested = leadsData.filter(l => l.status === 'Not Interested').length;
            const followUpRequired = leadsData.filter(l => l.status === 'Follow Up Required').length;

            response.stats.leads = {
              total,
              interested,
              notInterested,
              followUpRequired,
            };
          }
        }
      } catch (err) {
        console.error('Exception fetching leads stats:', err);
      }
    }

    // Step 6: Fetch work orders statistics (if user has access)
    // Sales Lead now has access to work orders (same as Sales - only their own)
    const WORK_ORDER_ALLOWED_ROLES = ['Sales', 'salesLead', 'Admin', 'Super Admin', 'Inventory', 'Accounts', 'BackOffice'];
    const hasWorkOrderAccess = WORK_ORDER_ALLOWED_ROLES.includes(roleName);
    const isBackOffice = roleName === 'BackOffice';

    if (hasWorkOrderAccess) {
      try {
        // Base query for work orders (RLS automatically filters based on role)
        let workOrdersQuery = supabase.from('work_orders').select('id, work_order_status, created_at, order_amount, company_id');

        // For Inventory: Only fetch "To Be Dispatched" and "Dispatched" work orders
        if (isInventory) {
          workOrdersQuery = workOrdersQuery
            .eq('company_id', companyId)
            .or('work_order_status.eq.To Be Dispatched,work_order_status.eq.Dispatched');
        } else if (isBackOffice) {
          // BackOffice: See work orders from Dispatched onwards
          workOrdersQuery = workOrdersQuery
            .eq('company_id', companyId)
            .in('work_order_status', [
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
        } else if (isAccounts) {
          // Accounts: See all company work orders (for count only)
          workOrdersQuery = workOrdersQuery.eq('company_id', companyId);
        } else if (roleName === 'Sales' || roleName === 'salesLead') {
          // Sales and Sales Lead see only their own work orders
          workOrdersQuery = workOrdersQuery.eq('sales_executive_id', userId);
        } else if (isAdmin) {
          // Admin sees all company work orders
          workOrdersQuery = workOrdersQuery.eq('company_id', companyId);
        }

        // Execute query (RLS handles filtering)
        const { data: workOrdersData, error: workOrdersError } = await workOrdersQuery;

        if (workOrdersError) {
          console.error('Error fetching work orders stats:', workOrdersError);
        } else if (workOrdersData) {
          // Calculate statistics (simple status-based counting)
          const total = workOrdersData.length;

          // Build status distribution chart data
          const statusCounts: Record<string, number> = {};
          workOrdersData.forEach((w: any) => {
            if (w.work_order_status) {
              const status = w.work_order_status;
              statusCounts[status] = (statusCounts[status] || 0) + 1;
            }
          });

          // Status counts (normalized)
          const pending = (statusCounts['Pending'] || 0) + (statusCounts['Created'] || 0);
          const toBeDispatched = statusCounts['To Be Dispatched'] || 0;
          const dispatched = statusCounts['Dispatched'] || 0;
          const advancePaid = statusCounts['Advance Paid'] || 0;
          const closed = (statusCounts['Closed'] || 0) + 
                         (statusCounts['Completed'] || 0) + 
                         (statusCounts['Successfully Completed'] || 0);

          // Calculate total order amount for Admin (Exclude Cancelled/Rejected/No Status)
          if (isAdmin) {
            // Log status-wise amounts for debugging
            const statusAmounts: Record<string, number> = {};
            workOrdersData.forEach((w: any) => {
              const status = w.work_order_status || 'No Status';
              statusAmounts[status] = (statusAmounts[status] || 0) + (parseFloat(w.order_amount?.toString() || '0'));
            });
            console.log('[DASHBOARD STATS DEBUG] Status-wise Amounts:', statusAmounts);

            // Include all orders except explicitly cancelled/rejected ones
            // This ensures orders with NULL status or "To Be Dispatched" are counted
            const activeOrders = workOrdersData.filter((w: any) => 
              w.work_order_status !== 'Cancelled' && 
              w.work_order_status !== 'Rejected' &&
              w.work_order_status !== 'Order Cancelled'
            );
            totalOrderAmount = activeOrders.reduce((sum, w: any) => sum + (parseFloat(w.order_amount?.toString() || '0')), 0);
          }

          // Time-based counts
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const thisWeekStart = new Date(today);
          thisWeekStart.setDate(today.getDate() - today.getDay());
          const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

          const todayCount = workOrdersData.filter((w: any) => {
            const createdAt = new Date(w.created_at);
            return createdAt >= today;
          }).length;

          const thisWeekCount = workOrdersData.filter((w: any) => {
            const createdAt = new Date(w.created_at);
            return createdAt >= thisWeekStart;
          }).length;

          const thisMonthCount = workOrdersData.filter((w: any) => {
            const createdAt = new Date(w.created_at);
            return createdAt >= thisMonthStart;
          }).length;

          response.stats.workOrders = {
            total,
            pending,
            toBeDispatched,
            dispatched,
            installed: statusCounts['Installed'] || 0,
            completed: statusCounts['Completed'] || 0,
            advancePaid,
            closed,
            today: todayCount,
            thisWeek: thisWeekCount,
            thisMonth: thisMonthCount,
          };

          // Build status distribution chart data
          // Include "Unknown" for those without status
          if (!isInventory) {
             const missingStatusCount = workOrdersData.filter((w: any) => !w.work_order_status).length;
             if (missingStatusCount > 0) {
               statusCounts['Unknown'] = missingStatusCount;
             }
          }
          // For Inventory: Only show "To Be Dispatched" and "Dispatched"
          if (isInventory) {
            response.stats.charts.statusDistribution = {
              'To Be Dispatched': toBeDispatched,
              'Dispatched': dispatched,
            };
          } else if (isBackOffice || isAdmin) {
            // For BackOffice and Admin: Show full status distribution in the pie chart
            response.stats.charts.statusDistribution = statusCounts;
          } else {
            // For other roles: Show limited statuses
            response.stats.charts.statusDistribution = {
              'To Be Dispatched': toBeDispatched,
              'Dispatched': dispatched,
              'Installed': statusCounts['Installed'] || 0,
              'Completed': statusCounts['Completed'] || 0,
            };
          }
        }
      } catch (err) {
        console.error('Exception fetching work orders stats:', err);
      }
    }

    // Step 7: Fetch payments statistics (Admin and Accounts)
    if (isAdmin) {
      try {
        console.log('[DEBUG] Fetching payments for companyId:', companyId);
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('payments_data')
          .select('amount, transaction_date, work_order_id, work_orders!inner(company_id)')
          .eq('work_orders.company_id', companyId);

        console.log('[DEBUG] Payments Query Result - Data Count:', paymentsData?.length || 0);
        console.log('[DEBUG] Payments Query Error:', paymentsError);
        if (paymentsData && paymentsData.length > 0) {
          const totalAmount = paymentsData.reduce((sum, p) => sum + (parseFloat(p.amount?.toString() || '0')), 0);
          console.log('[DEBUG] Total Payment Amount:', totalAmount);
        }

        if (paymentsError) {
          console.error('Error fetching payments stats:', paymentsError);
        } else if (paymentsData) {
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

          const todayPayments = paymentsData.filter(p => {
            const transactionDate = new Date(p.transaction_date);
            return transactionDate >= today;
          });

          const monthlyPayments = paymentsData.filter(p => {
            const transactionDate = new Date(p.transaction_date);
            return transactionDate >= thisMonthStart;
          });

          const todayReceived = todayPayments.reduce((sum, p) => sum + (parseFloat(p.amount?.toString() || '0')), 0);
          const monthlyReceived = monthlyPayments.reduce((sum, p) => sum + (parseFloat(p.amount?.toString() || '0')), 0);
          const totalReceived = paymentsData.reduce((sum, p) => sum + (parseFloat(p.amount?.toString() || '0')), 0);

          response.stats.payments = {
            totalReceived,
            todayReceived,
            monthlyReceived,
            pending: Math.max(0, totalOrderAmount - totalReceived),
            totalOrderValue: totalOrderAmount, // Add this field
          };
          
          console.log('[DEBUG] Final Payment Stats:', response.stats.payments);

          // Build payments by day chart data (last 7 days)
          const paymentsByDay: { date: string; amount: number }[] = [];
          const last7Days = Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            return date;
          });

          last7Days.forEach(date => {
            const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayEnd.getDate() + 1);

            const dayPayments = paymentsData.filter(p => {
              const transactionDate = new Date(p.transaction_date);
              return transactionDate >= dayStart && transactionDate < dayEnd;
            });

            const dayTotal = dayPayments.reduce((sum, p) => sum + (parseFloat(p.amount?.toString() || '0')), 0);

            paymentsByDay.push({
              date: date.toISOString().split('T')[0],
              amount: dayTotal,
            });
          });

          response.stats.charts.paymentsByDay = paymentsByDay;
        }
      } catch (err) {
        console.error('Exception fetching payments stats:', err);
      }
    }

    // Step 7b: Fetch simple counts for Accounts role
    if (isAccounts) {
      try {
        // Total payments count (RLS will filter by company)
        const { count: totalPayments, error: totalPaymentsError } = await supabase
          .from('payments_data')
          .select('*', { count: 'exact', head: true });

        // Pending payments count (RLS will filter by company)
        const { count: pendingPayments, error: pendingPaymentsError } = await supabase
          .from('payments_data')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        if (totalPaymentsError || pendingPaymentsError) {
          console.error('Error fetching accounts payments stats:', totalPaymentsError || pendingPaymentsError);
        } else {
          response.stats.payments = {
            totalCount: totalPayments || 0,
            pending: pendingPayments || 0,
          };
        }
      } catch (err) {
        console.error('Exception fetching accounts payments stats:', err);
      }
    }

    // Step 8: Fetch dispatch statistics (Admin only)
    if (isAdmin) {
      try {
        const { data: dispatchData, error: dispatchError } = await supabase
          .from('work_orders')
          .select('id, work_order_status, created_at')
          .eq('company_id', companyId)
          .in('work_order_status', ['To Be Dispatched', 'Dispatched']);

        if (dispatchError) {
          console.error('Error fetching dispatch stats:', dispatchError);
        } else if (dispatchData) {
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const thisWeekStart = new Date(today);
          thisWeekStart.setDate(today.getDate() - today.getDay());
          const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

          const todayCount = dispatchData.filter(d => {
            const createdAt = new Date(d.created_at);
            return createdAt >= today && d.work_order_status === 'Dispatched';
          }).length;

          const weekCount = dispatchData.filter(d => {
            const createdAt = new Date(d.created_at);
            return createdAt >= thisWeekStart && d.work_order_status === 'Dispatched';
          }).length;

          const monthCount = dispatchData.filter(d => {
            const createdAt = new Date(d.created_at);
            return createdAt >= thisMonthStart && d.work_order_status === 'Dispatched';
          }).length;

          const pendingCount = dispatchData.filter(d => d.work_order_status === 'To Be Dispatched').length;

          response.stats.dispatch = {
            today: todayCount,
            week: weekCount,
            month: monthCount,
            pending: pendingCount,
          };
        }
      } catch (err) {
        console.error('Exception fetching dispatch stats:', err);
      }
    }

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error('Dashboard stats error:', error);

    // Handle authentication errors
    if (error instanceof Error && error.message?.includes('Unauthorized')) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}

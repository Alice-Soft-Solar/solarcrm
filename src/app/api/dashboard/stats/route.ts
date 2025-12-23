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
    const WORK_ORDER_ALLOWED_ROLES = ['Sales', 'salesLead', 'Admin', 'Super Admin', 'Inventory', 'Accounts'];
    const hasWorkOrderAccess = WORK_ORDER_ALLOWED_ROLES.includes(roleName);

    if (hasWorkOrderAccess) {
      try {
        // Base query for work orders (RLS automatically filters based on role)
        let workOrdersQuery = supabase.from('work_orders').select('id, work_order_status, created_at, order_amount, company_id');

        // For Inventory: Only fetch "To Be Dispatched" and "Dispatched" work orders
        if (isInventory) {
          workOrdersQuery = workOrdersQuery
            .eq('company_id', companyId)
            .or('work_order_status.eq.To Be Dispatched,work_order_status.eq.Dispatched');
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
          // For Inventory: Need to verify 65% payment for "To Be Dispatched" status
          let filteredWorkOrders = workOrdersData;

          if (isInventory) {
            // Get work order IDs that need payment verification
            const toBeDispatchedIds = workOrdersData
              .filter(w => w.work_order_status === 'To Be Dispatched')
              .map(w => w.id);

            if (toBeDispatchedIds.length > 0) {
              // Fetch payments for these work orders
              const { data: paymentsData } = await supabase
                .from('payments_data')
                .select('work_order_id, first_payment, second_payment, final_payment, additional_payment')
                .in('work_order_id', toBeDispatchedIds);

              if (paymentsData) {
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

                // Filter: Only include "To Be Dispatched" if payment >= 65%
                filteredWorkOrders = workOrdersData.filter((w: any) => {
                  if (w.work_order_status === 'Dispatched') {
                    return true; // Always include "Dispatched"
                  }
                  if (w.work_order_status === 'To Be Dispatched') {
                    const totalPaid = paymentsByWorkOrder[w.id] || 0;
                    const orderAmount = parseFloat(w.order_amount?.toString() || '0');
                    return orderAmount > 0 && totalPaid >= orderAmount * 0.65;
                  }
                  return false;
                });
              } else {
                // No payments data, only show "Dispatched"
                filteredWorkOrders = workOrdersData.filter((w: any) => w.work_order_status === 'Dispatched');
              }
            }
          }

          // Calculate statistics from filtered data
          const total = filteredWorkOrders.length;

          // Status counts
          const toBeDispatched = filteredWorkOrders.filter((w: any) => w.work_order_status === 'To Be Dispatched').length;
          const dispatched = filteredWorkOrders.filter((w: any) => w.work_order_status === 'Dispatched').length;
          const installed = isInventory ? 0 : filteredWorkOrders.filter((w: any) => w.work_order_status === 'Installed').length;
          const completed = isInventory ? 0 : filteredWorkOrders.filter((w: any) => w.work_order_status === 'Completed').length;

          // Time-based counts
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const thisWeekStart = new Date(today);
          thisWeekStart.setDate(today.getDate() - today.getDay());
          const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

          const todayCount = filteredWorkOrders.filter((w: any) => {
            const createdAt = new Date(w.created_at);
            return createdAt >= today;
          }).length;

          const thisWeekCount = filteredWorkOrders.filter((w: any) => {
            const createdAt = new Date(w.created_at);
            return createdAt >= thisWeekStart;
          }).length;

          const thisMonthCount = filteredWorkOrders.filter((w: any) => {
            const createdAt = new Date(w.created_at);
            return createdAt >= thisMonthStart;
          }).length;

          response.stats.workOrders = {
            total,
            toBeDispatched,
            dispatched,
            installed,
            completed,
            today: todayCount,
            thisWeek: thisWeekCount,
            thisMonth: thisMonthCount,
          };

          // Build status distribution chart data
          // For Inventory: Only show "To Be Dispatched" and "Dispatched"
          if (isInventory) {
            response.stats.charts.statusDistribution = {
              'To Be Dispatched': toBeDispatched,
              'Dispatched': dispatched,
            };
          } else {
            // For other roles: Show all statuses
            response.stats.charts.statusDistribution = {
              'To Be Dispatched': toBeDispatched,
              'Dispatched': dispatched,
              'Installed': installed,
              'Completed': completed,
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
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('payments_data')
          .select('amount, transaction_date, work_order_id, work_orders!inner(company_id)')
          .eq('work_orders.company_id', companyId);

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

          response.stats.payments = {
            todayReceived,
            monthlyReceived,
            pending: 0, // Would need additional calculation
          };

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

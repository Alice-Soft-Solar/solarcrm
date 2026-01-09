import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile } from '@/lib/supabase-server';
import { calculateTotalPaid, calculatePaymentPercentage } from '@/utils/payment-calculator';

/**
 * API Route: GET /api/reports
 * 
 * Purpose: Fetch report data based on report type and filters
 * Security: Uses RLS-enforced queries with user authentication (NO service role)
 * 
 * Query Parameters:
 * - type: Report type ID (customer_list, executive_wise_orders, etc.)
 * - companyId: Company ID (verified via RLS)
 * - startDate: Optional start date filter
 * - endDate: Optional end date filter
 * - executiveId: Optional executive filter
 * - stage: Optional stage filter
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type');
    const companyId = searchParams.get('companyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const executiveId = searchParams.get('executiveId');
    const stage = searchParams.get('stage');

    if (!reportType || !companyId) {
      return NextResponse.json({ error: 'Missing report type or company ID' }, { status: 400 });
    }

    // 1. Authenticate Request (RLS-enforced)
    const supabase = await createServerClient(request);
    await verifyUserAndGetProfile(supabase, request);

    // 2. Fetch Data Based on Report Type
    let data;
    
    // SPECIAL HANDLER: Receipts List (payment-centric report)
    if (reportType === 'receipts_list') {
      let paymentQuery = supabase
        .from('payments_data')
        .select(`
          *,
          work_orders!inner (
            customer_name, 
            customer_phone,
            work_order_number,
            sales_executive_id,
            company_id,
            profiles:sales_executive_id (full_name)
          )
        `)
        .eq('work_orders.company_id', companyId);

      if (startDate) paymentQuery = paymentQuery.gte('transaction_date', startDate);
      if (endDate) paymentQuery = paymentQuery.lte('transaction_date', endDate);
      
      const { data: payments, error } = await paymentQuery;
      if (error) throw error;
      
      data = payments.map((p: any) => ({
        ...p,
        executiveName: p.work_orders?.profiles?.full_name || 'Unassigned',
        customer_name: p.work_orders?.customer_name,
        mobileno: p.work_orders?.customer_phone,
        work_order_number: p.work_orders?.work_order_number
      }));

      if (executiveId) {
        data = data.filter((p: any) => p.work_orders.sales_executive_id === executiveId);
      }

    // SPECIAL HANDLER: Ledger (debit/credit transaction report)
    } else if (reportType === 'ledger') {
      // Fetch Orders (Debits) and Payments (Credits) separately
      let orderQuery = supabase
        .from('work_orders')
        .select(`
          created_at, order_amount, work_order_number, customer_name, customer_address, customer_phone, plant_capacity,
          sales_executive_id,
          profiles:sales_executive_id (full_name)
        `)
        .eq('company_id', companyId);

      let paymentQuery = supabase
        .from('payments_data')
        .select(`
          transaction_date, amount, payment_method, work_order_id,
          work_orders!inner (company_id, customer_name, sales_executive_id, profiles:sales_executive_id(full_name))
        `)
        .eq('work_orders.company_id', companyId);

      if (startDate) {
        orderQuery = orderQuery.gte('created_at', startDate);
        paymentQuery = paymentQuery.gte('transaction_date', startDate);
      }
      if (endDate) {
        orderQuery = orderQuery.lte('created_at', endDate);
        paymentQuery = paymentQuery.lte('transaction_date', endDate);
      }

      const [ordersRes, paymentsRes] = await Promise.all([orderQuery, paymentQuery]);
      if (ordersRes.error) throw ordersRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      const transactions: any[] = [];
      
      // Extract town helper
      const extractTown = (address: string) => {
        if (!address) return '';
        const parts = address.split(',').map(s => s.trim());
        return parts.length > 1 ? parts[parts.length - 2] : parts[0];
      };

      // Add Orders as Debits
      ordersRes.data?.forEach((o: any) => {
        transactions.push({
          date: o.created_at,
          type: 'Order',
          description: `${o.plant_capacity} kW`,
          debit: o.order_amount || 0,
          credit: 0,
          customer_name: o.customer_name,
          town: extractTown(o.customer_address || ''),
          mobile: o.customer_phone,
          executiveName: o.profiles?.full_name || 'Unassigned',
          executiveId: o.sales_executive_id
        });
      });

      // Add Payments as Credits
      paymentsRes.data?.forEach((p: any) => {
        transactions.push({
          date: p.transaction_date,
          type: p.payment_method || 'Payment',
          description: 'Received',
          debit: 0,
          credit: p.amount || 0,
          customer_name: p.work_orders?.customer_name,
          executiveName: p.work_orders?.profiles?.full_name || 'Unassigned',
          executiveId: p.work_orders?.sales_executive_id,
          town: '',
          mobile: ''
        });
      });

      // Sort by Executive → Customer → Date
      transactions.sort((a, b) => {
        if (a.executiveName !== b.executiveName) return a.executiveName.localeCompare(b.executiveName);
        if (a.customer_name !== b.customer_name) return a.customer_name.localeCompare(b.customer_name);
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

      // Calculate Running Balances & Format (dots for repeated customer names)
      let currentCustomer = '';
      let runningBalance = 0;
      
      data = transactions.map((t, index) => {
        if (t.customer_name !== currentCustomer) {
          currentCustomer = t.customer_name;
          runningBalance = 0;
        }
        
        runningBalance = runningBalance + t.debit - t.credit;
        const currentBalance = runningBalance;

        const isRepeated = index > 0 && transactions[index-1].customer_name === t.customer_name;

        return {
          date: t.date,
          customer_name: isRepeated ? '.' : t.customer_name,
          town: isRepeated ? '.' : t.town,
          mobile: isRepeated ? '.' : t.mobile,
          description: isRepeated ? '.' : t.description,
          type: t.type === 'Order' ? 'Order' : (t.type?.toLowerCase() === 'cash' ? 'CASH' : 'BANK'),
          debit: t.debit,
          credit: t.credit,
          balance: currentBalance,
          executiveName: t.executiveName,
          executiveId: t.executiveId
        };
      });

      if (executiveId) {
        data = data.filter((t: any) => t.executiveId === executiveId);
      }

    // STANDARD HANDLER: All other reports (work order-centric)
    } else {
      let query = supabase
        .from('work_orders')
        .select(`
          *,
          profiles:sales_executive_id (full_name),
          payments:payments_data (amount, first_payment, second_payment, final_payment, additional_payment)
        `)
        .eq('company_id', companyId);

      // Apply global filters
      if (startDate) query = query.gte('created_at', startDate);
      if (endDate) query = query.lte('created_at', endDate);
      if (executiveId) query = query.eq('sales_executive_id', executiveId);
      
      // Apply stage-specific filters
      switch (reportType) {
        case 'stage_6_stages': break; // Show all
        case 'to_be_dispatched':
          query = query.eq('work_order_status', 'To Be Dispatched');
          break;
        case 'stock_dispatched':
          query = query.eq('work_order_status', 'Dispatched');
          break;
        case 'erection_done':
          query = query.eq('work_order_status', 'Installed');
          break;
        case 'erection_dues':
          query = query.eq('work_order_status', 'Installed');
          break;
        case 'subsidy_report':
          query = query.eq('subsidy_status', 'received_and_due');
          break;
        case 'subsidy_not_eligible':
          query = query.eq('subsidy_status', 'not_eligible');
          break;
        case 'subsidy_not_ready':
          query = query.eq('subsidy_status', 'not_ready');
          break;
        case 'subsidy_not_received':
          query = query.eq('subsidy_status', 'not_received_by_customer');
          break;
        case 'stage_wise':
          if (stage) query = query.eq('work_order_status', stage);
          break;
      }

      const { data: rawData, error } = await query;
      if (error) throw error;
      
      data = rawData;
    }

    // 3. Post-processing for standard work order reports
    let reportData = data;
    if (reportType !== 'receipts_list' && reportType !== 'ledger') {
      reportData = data.map((wo: any) => {
        const totalPaid = calculateTotalPaid(wo.payments);
        const balance = wo.order_amount - totalPaid;
        return {
          ...wo,
          town: wo.town || '-', // Use the town field directly from database
          totalPaid,
          balance,
          paymentPercentage: calculatePaymentPercentage(totalPaid, wo.order_amount),
          executiveName: wo.profiles?.full_name || 'Unassigned'
        };
      });
    }

    // 4. Apply report-specific filtering
    if (reportType === 'to_be_dispatched') {
      reportData = reportData.filter((wo: any) => (wo.totalPaid / wo.order_amount) >= 0.65);
    }
    if (reportType === 'erection_dues') {
      reportData = reportData.filter((wo: any) => wo.balance > 0);
    }

    // 5. Apply sorting for specific reports
    if (reportType === 'executive_wise_orders' || reportType === 'dues_report') {
      reportData.sort((a: any, b: any) => a.executiveName.localeCompare(b.executiveName));
    }

    return NextResponse.json({ data: reportData });

  } catch (error: any) {
    console.error('Reports API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

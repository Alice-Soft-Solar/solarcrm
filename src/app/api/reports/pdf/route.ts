import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer, pdf, DocumentProps } from '@react-pdf/renderer';
import { createServerClient, verifyUserAndGetProfile } from '@/lib/supabase-server';
import { GenericReportTemplate } from '@/components/GenericReportTemplate';
import { LedgerTemplate } from '@/components/LedgerTemplate';
import { calculateTotalPaid, calculatePaymentPercentage } from '@/utils/payment-calculator';
import { getReportHeaders, getReportRowValues } from '@/utils/report-exports';

/**
 * API Route: GET /api/reports/pdf
 * 
 * Purpose: Generate and download PDF reports
 * Security: Uses RLS-enforced queries with user authentication (NO service role)
 * 
 * Query Parameters:
 * - type: Report type ID
 * - companyId: Company ID
 * - startDate: Optional start date
 * - endDate: Optional end date
 * - executiveId: Optional executive filter
 * - stage: Optional stage filter
 */

// --- Helper Functions for Ledger ---

function extractTown(address: string): string {
  if (!address) return '';
  const parts = address.split(',').map(s => s.trim());
  return parts.length > 1 ? parts[parts.length - 2] : parts[0];
}

function mapPaymentMethod(method: string): 'CASH' | 'BANK' | 'CHEQUE' | 'UPI' | 'ONLINE' | 'CARD' {
  const methodMap: Record<string, 'CASH' | 'BANK' | 'CHEQUE' | 'UPI' | 'ONLINE' | 'CARD'> = {
    'cash': 'CASH',
    'bank_transfer': 'BANK',
    'cheque': 'CHEQUE',
    'upi': 'UPI',
    'online': 'ONLINE',
    'card': 'CARD',
  };
  return methodMap[method?.toLowerCase()] || 'BANK';
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear().toString().slice(-2);
  return `${day}-${month}-${year}`;
}

// -----------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'report';
    const companyId = searchParams.get('companyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const executiveId = searchParams.get('executiveId');
    const stage = searchParams.get('stage');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    // 1. Authenticate Request (RLS-enforced)
    const supabase = await createServerClient(request);
    await verifyUserAndGetProfile(supabase, request);

    // 2. Fetch Company Info
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('name, company_address, company_phone1, company_phone2, company_email, gst_no')
      .eq('id', companyId)
      .single();

    if (companyError) {
      console.error('Error fetching company data:', companyError);
    }
    
    console.log('Company Data:', companyData);

    // 3. SPECIAL HANDLER: Ledger (Uses LedgerTemplate)
    if (reportType === 'ledger') {
      // Fetch Executives (either all or specific one)
      let execQuery = supabase
        .from('profiles')
        .select('id, full_name')
        .eq('company_id', companyId)
        .neq('full_name', 'N/A'); // Exclude N/A if present

      if (executiveId) {
        execQuery = execQuery.eq('id', executiveId);
      }

      const { data: executives, error: execError } = await execQuery;
      
      if (execError || !executives || executives.length === 0) {
        throw new Error('No sales executives found for the selected criteria');
      }

      // 3a. Batch Fetch Work Orders for ALL selected executives
      const executiveIds = executives.map(e => e.id);
      
      let allOrdersQuery = supabase
        .from('work_orders')
        .select(`
          id,
          work_order_number,
          customer_name,
          customer_address,
          customer_phone,
          town,
          plant_capacity,
          order_amount,
          created_at,
          sales_executive_id
        `)
        .eq('company_id', companyId)
        .in('sales_executive_id', executiveIds)
        .order('created_at', { ascending: true });

      if (startDate) allOrdersQuery = allOrdersQuery.gte('created_at', startDate);
      if (endDate) allOrdersQuery = allOrdersQuery.lte('created_at', endDate);

      const { data: allWorkOrders, error: ordersError } = await allOrdersQuery;
      if (ordersError) throw ordersError;

      // 3b. Batch Fetch Payments for ALL these orders
      const allWorkOrderIds = (allWorkOrders || []).map(wo => wo.id);
      
      let allPaymentsQuery = supabase
        .from('payments_data')
        .select('id, work_order_id, amount, transaction_date, payment_method')
        .in('work_order_id', allWorkOrderIds) // Fetch payments for ALL relevant orders
        .order('transaction_date', { ascending: true });

      // Note: Apply date filter to payments if needed, usually we want all or same range
      if (startDate) allPaymentsQuery = allPaymentsQuery.gte('transaction_date', startDate);
      if (endDate) allPaymentsQuery = allPaymentsQuery.lte('transaction_date', endDate);

      const { data: allPayments, error: paymentsError } = await allPaymentsQuery;
      if (paymentsError) throw paymentsError;

      // 3c. Pre-group Data in Memory
      // Group Payments by Work Order ID
      const paymentsByWorkOrder: Record<string, any[]> = {};
      (allPayments || []).forEach((p) => {
        if (!paymentsByWorkOrder[p.work_order_id]) paymentsByWorkOrder[p.work_order_id] = [];
        paymentsByWorkOrder[p.work_order_id].push(p);
      });

      // Group Work Orders by Executive ID
      const ordersByExecutive: Record<string, any[]> = {};
      (allWorkOrders || []).forEach((wo) => {
        if (!ordersByExecutive[wo.sales_executive_id]) ordersByExecutive[wo.sales_executive_id] = [];
        ordersByExecutive[wo.sales_executive_id].push(wo);
      });

      // 3d. Construct Report Data
      const salesExecutivesData = [];

      for (const exec of executives) {
        const executiveOrders = ordersByExecutive[exec.id]; // Get pre-fetched orders
        if (!executiveOrders || executiveOrders.length === 0) continue;

        // Build Customer Data for this Executive
        const customers = executiveOrders.map(wo => {
          const transactions = [];
          const orderCost = parseFloat(String(wo.order_amount || 0));

          // Order Transaction
          transactions.push({
            date: formatDate(wo.created_at),
            workOrderNo: wo.work_order_number || '',
            itemName: wo.plant_capacity || 'N/A',
            type: 'ORDER',
            orderCost: orderCost,
            receivedAmt: null as number | null,
            balance: orderCost
          });

          let runningBalance = orderCost;
          const woPayments = paymentsByWorkOrder[wo.id] || [];
          
          woPayments.forEach(p => {
            const amount = parseFloat(String(p.amount || 0));
            runningBalance -= amount;
            
            transactions.push({
              date: formatDate(p.transaction_date),
              workOrderNo: '',
              itemName: '',
              type: mapPaymentMethod(p.payment_method),
              orderCost: null as number | null,
              receivedAmt: amount,
              balance: runningBalance
            });
          });

          return {
            name: wo.customer_name,
            town: wo.town || '-', // Use town column
            mobile: wo.customer_phone || '',
            transactions
          };
        });

        salesExecutivesData.push({
          name: exec.full_name,
          customers
        });
      }

      if (salesExecutivesData.length === 0) {
         // Create an empty PDF explaining no data found
          const pdfBuffer = await renderToBuffer(
          React.createElement(GenericReportTemplate, {
            data: {
              title: 'EXECUTIVE & CUSTOMER LEDGER',
              companyName: companyData?.name || 'Solar CRM',
              companyAddress: companyData?.company_address || '',
              gstNumber: companyData?.gst_no || '',
              reportPeriod: `${startDate || 'All Time'} to ${endDate || 'Today'}`,
              generatedDate: new Date().toLocaleDateString(),
              headers: ['Message'],
              rows: [['No data found for the selected criteria.']],
              totals: []
            }
          }) as any
        );
         return new NextResponse(new Uint8Array(pdfBuffer), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="ledger-report.pdf"`,
          },
        });
      }

      const ledgerData = {
        companyName: companyData?.name || 'Solar CRM',
        companyAddress: companyData?.company_address || '',
        companyPhone1: companyData?.company_phone1 || '',
        companyPhone2: companyData?.company_phone2 || '',
        companyEmail: companyData?.company_email || '',
        gstNo: companyData?.gst_no || '',
        generatedDate: formatDate(new Date().toISOString()),
        fromDate: startDate ? formatDate(startDate) : undefined,
        toDate: endDate ? formatDate(endDate) : undefined,
        salesExecutives: salesExecutivesData
      };

      // Generate PDF using LedgerTemplate
      const LedgerElement = React.createElement(LedgerTemplate, { data: ledgerData });
      const pdfDoc = pdf(LedgerElement as React.ReactElement<DocumentProps>);
      const blob = await pdfDoc.toBlob();
      const arrayBuffer = await blob.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="executive-ledger-report.pdf"`,
        },
      });
    }

    // 4. Fetch Report Data for Standard Reports
    let data;
    
    // SPECIAL HANDLER: Receipts List
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

    // STANDARD HANDLER: All other reports
    } else {
      let query = supabase
        .from('work_orders')
        .select(`
          *,
          profiles:sales_executive_id (full_name),
          payments:payments_data (amount, first_payment, second_payment, final_payment, additional_payment, transaction_date)
        `)
        .eq('company_id', companyId);

      if (startDate) query = query.gte('created_at', startDate);
      if (endDate) query = query.lte('created_at', endDate);
      if (executiveId) query = query.eq('sales_executive_id', executiveId);
      
      switch (reportType) {
        case 'stage_6_stages': break;
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

    // 5. Post-processing for standard reports
    let processedData = data;
    if (reportType !== 'receipts_list' && reportType !== 'ledger') {
      processedData = data.map((wo: any) => {
        const totalPaid = calculateTotalPaid(wo.payments);
        const balance = wo.order_amount - totalPaid;
        
        // Find advance payment date (robust logic: sort by date and take first)
        let advance_paid_at = null;
        if (wo.payments && wo.payments.length > 0) {
           // Sort payments by transaction_date (ascending)
           const sortedPayments = [...wo.payments].sort((a: any, b: any) => {
             const dateA = new Date(a.transaction_date || 0).getTime();
             const dateB = new Date(b.transaction_date || 0).getTime();
             return dateA - dateB;
           });
           
           // Use the earliest payment date
           if (sortedPayments[0] && sortedPayments[0].transaction_date) {
             advance_paid_at = sortedPayments[0].transaction_date;
           }
        }

        // Logic to infer 'To Be Dispatched' date from payments (when 65% reached)
        let calculated_to_dispatch_at = null;
        if (wo.payments && wo.order_amount > 0) {
           // Reuse sorted payments or sort if needed
           const sortedPayments = [...wo.payments].sort((a: any, b: any) => {
             const dateA = new Date(a.transaction_date || 0).getTime();
             const dateB = new Date(b.transaction_date || 0).getTime();
             return dateA - dateB;
           });

           let runningTotal = 0;
           for (const p of sortedPayments) {
             runningTotal += parseFloat(p.amount || '0');
             if (runningTotal / wo.order_amount >= 0.65) {
               calculated_to_dispatch_at = p.transaction_date;
               break; // Found the date we crossed 65%
             }
           }
        }

        return {
          ...wo,
          town: wo.town || '-', // Use the town field directly from database
          totalPaid,
          balance,
          paymentPercentage: calculatePaymentPercentage(totalPaid, wo.order_amount),
          executiveName: wo.profiles?.full_name || 'Unassigned',
          advance_paid_at, // Map calculated advance date
          to_be_dispatched_at: wo.to_be_dispatched_at || calculated_to_dispatch_at, // Use DB date or inferred date
          completed_at: wo.meter_completed_at // Map completion date
        };
      });
    }

    // Apply filters
    if (reportType === 'to_be_dispatched') {
      processedData = processedData.filter((wo: any) => (wo.totalPaid / wo.order_amount) >= 0.65);
    }
    if (reportType === 'erection_dues') {
      processedData = processedData.filter((wo: any) => wo.balance > 0);
    }

    // Apply sorting
    if (reportType === 'executive_wise_orders' || reportType === 'dues_report') {
      processedData.sort((a: any, b: any) => a.executiveName.localeCompare(b.executiveName));
    }

    // 6. Map Data to PDF Table Format
    const headers = getReportHeaders(reportType);
    const rows = processedData.map((item: any) => getReportRowValues(item, reportType));

    // --- CALCULATE TOTALS ---
    const totals = new Array(headers.length).fill('');
    
    // Set Total Count (usually in the first or second column)
    if (headers.length > 0) {
      totals[0] = `Total: ${processedData.length}`;
    }

    // Helper to sum by field
    const sumField = (field: string) => processedData.reduce((sum: number, item: any) => sum + (Number(item[field]) || 0), 0);
    const formatCurrency = (val: number) => val.toLocaleString('en-IN', { maximumFractionDigits: 2 });

    // Map headers to fields for summation
    headers.forEach((header, index) => {
      const h = header.toLowerCase();
      let sum = 0;
      let shouldSum = false;

      // Skip percentage columns (can't sum percentages)
      if (h.includes('%') || h.includes('percent')) {
        return; // Skip this column
      }

      // Define mappings based on header names
      if (h.includes('amount') || h.includes('value') || h.includes('cost')) {
        // Try 'order_amount' or 'amount' (for receipts)
        if (reportType === 'receipts_list') sum = sumField('amount');
        else sum = sumField('order_amount');
        shouldSum = true;
      } else if (h.includes('paid') || h.includes('received')) {
        if (reportType === 'receipts_list') sum = sumField('amount'); // Receipts amount is "received"
        else sum = sumField('totalPaid');
        shouldSum = true;
      } else if (h.includes('due') || h.includes('balance')) {
        sum = sumField('balance');
        shouldSum = true;
      } else if (h.includes('subsidy amt')) {
        sum = sumField('subsidy_amount');
        shouldSum = true;
      }

      if (shouldSum && sum > 0) {
        totals[index] = formatCurrency(sum);
      }
    });
    // ------------------------

    const reportTitle = reportType?.replace(/_/g, ' ').toUpperCase() || 'SOLAR CRM REPORT';

    // 7. Generate PDF using GenericReportTemplate
    const pdfBuffer = await renderToBuffer(
      React.createElement(GenericReportTemplate, {
        data: {
          title: reportTitle,
          companyName: companyData?.name || 'Solar CRM',
          companyAddress: companyData?.company_address || '',
          gstNumber: companyData?.gst_no || '',
          reportPeriod: `${startDate || 'All Time'} to ${endDate || 'Today'}`,
          generatedDate: new Date().toLocaleDateString(),
          headers: headers,
          rows: rows,
          totals: totals // Pass the calculated totals
        }
      }) as any
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${reportType}-report.pdf"`,
      },
    });

  } catch (error: any) {
    console.error('PDF Generation Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

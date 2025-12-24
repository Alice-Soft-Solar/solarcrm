import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile } from '@/lib/supabase-server';
import React from 'react';
import { pdf, DocumentProps } from '@react-pdf/renderer';
import { LedgerTemplate } from '@/components/LedgerTemplate';

/**
 * API Route: Generate Admin Ledger PDF
 * 
 * Purpose: Generate a comprehensive sales ledger PDF for admin users
 * showing work orders and payments grouped by Sales Executive → Customer
 * 
 * Security: ADMIN ONLY (Admin, Super Admin)
 * 
 * Data Flow:
 * 1. Fetch all work_orders for company
 * 2. Fetch all payments_data for those work orders
 * 3. Group by sales_executive → customer
 * 4. Calculate sequential balances
 * 5. Generate PDF and stream to client
 */

/**
 * Helper: Extract town from customer address
 * Example: "OPP. STALL GIRLS HIGHSCHOOL, NAGARAMPALEM, GUNTUR, ANDHRA PRADESH"
 * Returns: "GUNTUR" (second-to-last comma-separated part)
 */
function extractTown(address: string): string {
  if (!address) return '';
  const parts = address.split(',').map(s => s.trim());
  // Return second-to-last part (town) or last part if only one comma
  return parts.length > 1 ? parts[parts.length - 2] : parts[0];
}

/**
 * Helper: Map payment method to transaction type label
 */
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

/**
 * Helper: Format date to DD-MMM-YY
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear().toString().slice(-2);
  return `${day}-${month}-${year}`;
}

export async function POST(request: NextRequest) {
  try {
    // Step 1: Authenticate and verify admin role
    const supabase = await createServerClient(request);
    const { companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Step 2: Check authorization - ADMIN ONLY
    const isAdmin = roleName === 'Admin' || roleName === 'Super Admin';
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Admin users can generate ledger reports' },
        { status: 403 }
      );
    }

    // Step 3: Fetch company details
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('name, company_address, company_phone1, company_phone2, company_email, gst_no')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Step 4: Fetch all work orders for this company
    const { data: workOrders, error: workOrdersError } = await supabase
      .from('work_orders')
      .select(`
        id,
        work_order_number,
        customer_name,
        customer_address,
        customer_phone,
        plant_capacity,
        order_amount,
        created_at,
        sales_executive_id
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });

    if (workOrdersError) {
      console.error('Error fetching work orders:', workOrdersError);
      return NextResponse.json(
        { error: 'Failed to fetch work orders' },
        { status: 500 }
      );
    }

    if (!workOrders || workOrders.length === 0) {
      return NextResponse.json(
        { error: 'No work orders found for this company' },
        { status: 404 }
      );
    }

    // Step 5: Fetch sales executive names
    const salesExecIds = [...new Set(workOrders.map(wo => wo.sales_executive_id))];
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', salesExecIds);

    const salesExecMap: Record<string, string> = {};
    if (!profilesError && profiles) {
      profiles.forEach((profile: any) => {
        salesExecMap[profile.id] = profile.full_name || 'Unknown';
      });
    }

    // Step 6: Fetch all payments for these work orders
    const workOrderIds = workOrders.map(wo => wo.id);
    const { data: payments, error: paymentsError } = await supabase
      .from('payments_data')
      .select('id, work_order_id, amount, transaction_date, payment_method')
      .in('work_order_id', workOrderIds)
      .order('transaction_date', { ascending: true });

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError);
      return NextResponse.json(
        { error: 'Failed to fetch payments' },
        { status: 500 }
      );
    }

    // Step 7: Group payments by work_order_id
    const paymentsByWorkOrder: Record<string, Array<{
      id: string;
      work_order_id: string;
      amount: number;
      transaction_date: string;
      payment_method: string;
    }>> = {};
    (payments || []).forEach((payment) => {
      if (!paymentsByWorkOrder[payment.work_order_id]) {
        paymentsByWorkOrder[payment.work_order_id] = [];
      }
      paymentsByWorkOrder[payment.work_order_id].push(payment);
    });

    // Step 8: Build ledger data structure with sequential balance calculation
    const salesExecutivesMap: Record<string, {
      name: string;
      customers: Array<{
        name: string;
        town: string;
        mobile: string;
        transactions: any[];
      }>;
    }> = {};

    workOrders.forEach((workOrder) => {
      const execId = workOrder.sales_executive_id;
      const execName = salesExecMap[execId] || 'Unknown Sales Executive';

      // Initialize sales executive if not exists
      if (!salesExecutivesMap[execId]) {
        salesExecutivesMap[execId] = {
          name: execName,
          customers: [],
        };
      }

      // Build customer transactions
      const transactions: any[] = [];
      
      // First transaction: ORDER row
      const orderBalance = parseFloat(workOrder.order_amount || 0);
      transactions.push({
        date: formatDate(workOrder.created_at),
        itemName: workOrder.plant_capacity || 'N/A',
        type: 'ORDER',
        orderCost: orderBalance,
        receivedAmt: null,
        balance: orderBalance,
      });

      // Subsequent transactions: PAYMENT rows with sequential balance calculation
      let runningBalance = orderBalance;
      const workOrderPayments = paymentsByWorkOrder[workOrder.id] || [];
      
      workOrderPayments.forEach((payment) => {
        const paymentAmount = parseFloat(payment.amount || 0);
        runningBalance -= paymentAmount; // Subtract payment from balance

        transactions.push({
          date: formatDate(payment.transaction_date),
          itemName: '', // Empty for payment rows
          type: mapPaymentMethod(payment.payment_method),
          orderCost: null,
          receivedAmt: paymentAmount,
          balance: runningBalance, // Can be negative (overpayment)
        });
      });

      // Add customer to sales executive
      salesExecutivesMap[execId].customers.push({
        name: workOrder.customer_name,
        town: extractTown(workOrder.customer_address || ''),
        mobile: workOrder.customer_phone || '',
        transactions,
      });
    });

    // Convert map to array
    const salesExecutives = Object.values(salesExecutivesMap);

    // Step 9: Prepare ledger data
    const ledgerData = {
      companyName: company.name || 'Company Name',
      companyAddress: company.company_address || '',
      companyPhone1: company.company_phone1 || '',
      companyPhone2: company.company_phone2 || '',
      companyEmail: company.company_email || '',
      gstNo: company.gst_no || '',
      generatedDate: formatDate(new Date().toISOString()),
      salesExecutives,
    };

    // Step 10: Generate PDF
    const LedgerElement = React.createElement(LedgerTemplate, { data: ledgerData });
    const pdfDoc = pdf(LedgerElement as React.ReactElement<DocumentProps>);

    // Convert to buffer
    const blob = await pdfDoc.toBlob();
    const arrayBuffer = await blob.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    // Step 11: Return PDF as downloadable file
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ledger-${formatDate(new Date().toISOString())}.pdf"`,
      },
    });
  } catch (error: unknown) {
    console.error('API Error generating ledger:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred while generating ledger' },
      { status: 500 }
    );
  }
}

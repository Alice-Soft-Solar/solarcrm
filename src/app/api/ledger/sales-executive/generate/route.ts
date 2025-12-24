import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import React from 'react';
import { pdf, DocumentProps } from '@react-pdf/renderer';
import { LedgerTemplate } from '@/components/LedgerTemplate';

/**
 * API Route: Generate Sales Executive Ledger PDF
 * 
 * Purpose: Generate a sales ledger PDF for a specific sales executive
 * showing their work orders and payments grouped by Customer
 * 
 * Security: ADMIN, SUPER ADMIN, and SALES roles
 * - Admin/Super Admin: Can generate ledger for any sales executive (via sales_executive_name param)
 * - Sales: Can only generate their own ledger (auto-detected from profile)
 * 
 * Data Flow:
 * 1. Authenticate user
 * 2. Determine target sales executive (from param or user profile)
 * 3. Fetch work_orders for that sales executive
 * 4. Fetch payments for those work orders
 * 5. Group by customer
 * 6. Calculate sequential balances
 * 7. Generate PDF and stream to client
 */

/**
 * Helper: Extract town from customer address
 */
function extractTown(address: string): string {
  if (!address) return '';
  const parts = address.split(',').map(s => s.trim());
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
    // Step 1: Authenticate and verify role
    const supabase = await createServerClient(request);
    const { companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Step 2: Check authorization - Admin, Super Admin, or Sales
    const isAdmin = roleName === 'Admin' || roleName === 'Super Admin';
    const isSales = roleName === 'Sales';
    
    if (!isAdmin && !isSales) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Admin and Sales users can generate sales executive ledgers' },
        { status: 403 }
      );
    }

    // Step 3: Parse request body
    const body = await request.json();
    let targetSalesExecutiveName: string;

    // Step 4: Determine target sales executive
    if (isSales) {
      // For Sales role: Use their own name from profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (profileError || !profile || !profile.full_name) {
        return NextResponse.json(
          { error: 'Sales executive profile not found' },
          { status: 404 }
        );
      }

      targetSalesExecutiveName = profile.full_name;
    } else {
      // For Admin: Use provided sales_executive_name
      if (!body.sales_executive_name) {
        return NextResponse.json(
          { error: 'sales_executive_name is required for Admin users' },
          { status: 400 }
        );
      }
      targetSalesExecutiveName = body.sales_executive_name;
    }

    // Step 5: Create service role client to bypass RLS for data fetching
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Step 6: Fetch company details
    const { data: company, error: companyError } = await adminSupabase
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

    // Step 7: Get sales executive ID from name
    const { data: targetProfile, error: targetProfileError } = await adminSupabase
      .from('profiles')
      .select('id, full_name')
      .eq('company_id', companyId)
      .eq('full_name', targetSalesExecutiveName)
      .single();

    if (targetProfileError || !targetProfile) {
      return NextResponse.json(
        { error: `Sales executive "${targetSalesExecutiveName}" not found` },
        { status: 404 }
      );
    }

    // Step 8: Fetch work orders for this sales executive only
    const { data: workOrders, error: workOrdersError } = await adminSupabase
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
      .eq('sales_executive_id', targetProfile.id)
      .order('created_at', { ascending: true });

    if (workOrdersError) {
      console.error('Error fetching work orders:', workOrdersError);
      return NextResponse.json(
        { error: 'Failed to fetch work orders' },
        { status: 500 }
      );
    }

    if (!workOrders || workOrders.length === 0) {
      // Return empty ledger for sales executive with no work orders
      const ledgerData = {
        companyName: company.name || 'Company Name',
        companyAddress: company.company_address || '',
        companyPhone1: company.company_phone1 || '',
        companyPhone2: company.company_phone2 || '',
        companyEmail: company.company_email || '',
        gstNo: company.gst_no || '',
        generatedDate: formatDate(new Date().toISOString()),
        salesExecutives: [{
          name: targetSalesExecutiveName,
          customers: [],
        }],
      };

      // Generate empty PDF
      const LedgerElement = React.createElement(LedgerTemplate, { data: ledgerData });
      const pdfDoc = pdf(LedgerElement as React.ReactElement<DocumentProps>);
      const blob = await pdfDoc.toBlob();
      const arrayBuffer = await blob.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="ledger-${targetSalesExecutiveName}-${formatDate(new Date().toISOString())}.pdf"`,
        },
      });
    }

    // Step 9: Fetch all payments for these work orders
    const workOrderIds = workOrders.map(wo => wo.id);
    const { data: payments, error: paymentsError } = await adminSupabase
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

    // Step 10: Group payments by work_order_id
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

    // Step 11: Build ledger data structure with customers
    const customers: Array<{
      name: string;
      town: string;
      mobile: string;
      transactions: any[];
    }> = [];

    workOrders.forEach((workOrder) => {
      // Build customer transactions
      const transactions: any[] = [];
      
      // First transaction: ORDER row
      const orderBalance = parseFloat(String(workOrder.order_amount || 0));
      transactions.push({
        date: formatDate(workOrder.created_at),
        workOrderNo: workOrder.work_order_number || '',
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
        const paymentAmount = parseFloat(String(payment.amount || 0));
        runningBalance -= paymentAmount; // Subtract payment from balance

        transactions.push({
          date: formatDate(payment.transaction_date),
          workOrderNo: '', // Empty for payment rows
          itemName: '', // Empty for payment rows
          type: mapPaymentMethod(payment.payment_method),
          orderCost: null,
          receivedAmt: paymentAmount,
          balance: runningBalance, // Can be negative (overpayment)
        });
      });

      // Add customer
      customers.push({
        name: workOrder.customer_name,
        town: extractTown(workOrder.customer_address || ''),
        mobile: workOrder.customer_phone || '',
        transactions,
      });
    });

    // Step 12: Prepare ledger data
    const ledgerData = {
      companyName: company.name || 'Company Name',
      companyAddress: company.company_address || '',
      companyPhone1: company.company_phone1 || '',
      companyPhone2: company.company_phone2 || '',
      companyEmail: company.company_email || '',
      gstNo: company.gst_no || '',
      generatedDate: formatDate(new Date().toISOString()),
      salesExecutives: [{
        name: targetSalesExecutiveName,
        customers,
      }],
    };

    // Step 13: Generate PDF
    const LedgerElement = React.createElement(LedgerTemplate, { data: ledgerData });
    const pdfDoc = pdf(LedgerElement as React.ReactElement<DocumentProps>);

    // Convert to buffer
    const blob = await pdfDoc.toBlob();
    const arrayBuffer = await blob.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    // Step 14: Return PDF as downloadable file
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ledger-${targetSalesExecutiveName}-${formatDate(new Date().toISOString())}.pdf"`,
      },
    });
  } catch (error: unknown) {
    console.error('API Error generating sales executive ledger:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred while generating sales executive ledger' },
      { status: 500 }
    );
  }
}

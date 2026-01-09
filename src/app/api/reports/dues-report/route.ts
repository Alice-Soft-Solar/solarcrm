import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile } from '@/lib/supabase-server';
import React from 'react';
import { pdf, DocumentProps } from '@react-pdf/renderer';
import { DuesReportTemplate } from '@/components/DuesReportTemplate';

/**
 * API Route: Generate Dues Report PDF
 * 
 * Purpose: Generate admin-only dues report showing work orders grouped by sales executive
 * with payment summaries, subtotals, and grand totals
 * 
 * Security: ADMIN ONLY (Admin, Super Admin)
 * 
 * Request Body:
 * - company_id: string
 * - user_id: string
 * - from_date?: string (optional, format: YYYY-MM-DD)
 * - to_date?: string (optional, format: YYYY-MM-DD)
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
        { error: 'Unauthorized: Only Admin users can generate dues reports' },
        { status: 403 }
      );
    }

    // Step 3: Parse request body
    const body = await request.json();
    const { from_date, to_date } = body;

    // Step 4: Fetch company details (using authenticated supabase)
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('name, company_address')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Step 5: Build work orders query with optional date filtering
    let workOrdersQuery = supabase
      .from('work_orders')
      .select(`
        id,
        created_at,
        work_order_number,
        customer_name,
        customer_address,
        customer_phone,
        order_amount,
        work_order_status,
        sales_executive_id
      `)
      .eq('company_id', companyId);

    // Apply date filter if provided
    if (from_date && to_date) {
      workOrdersQuery = workOrdersQuery
        .gte('created_at', from_date)
        .lte('created_at', to_date);
    }

    const { data: workOrders, error: workOrdersError } = await workOrdersQuery
      .order('sales_executive_id', { ascending: true })
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
        { error: 'No work orders found for the specified criteria' },
        { status: 404 }
      );
    }

    // Step 7: Fetch sales executive names using anon client (RLS enforced)
    // RLS policies must allow access to profiles within the same company
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

    // Step 8: Fetch all payments for these work orders
    const workOrderIds = workOrders.map(wo => wo.id);
    const { data: payments, error: paymentsError } = await supabase
      .from('payments_data')
      .select('work_order_id, amount')
      .in('work_order_id', workOrderIds);

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError);
    }

    // Step 8: Group payments by work_order_id
    const paymentsByWorkOrder: Record<string, number> = {};
    (payments || []).forEach((payment: any) => {
      if (!paymentsByWorkOrder[payment.work_order_id]) {
        paymentsByWorkOrder[payment.work_order_id] = 0;
      }
      paymentsByWorkOrder[payment.work_order_id] += parseFloat(payment.amount || 0);
    });

    // Step 9: Build data structure grouped by sales executive
    const salesExecutivesMap: Record<string, any> = {};

    workOrders.forEach((workOrder: any) => {
      const execId = workOrder.sales_executive_id;
      const execName = salesExecMap[execId] || 'Unknown Sales Executive';

      // Initialize sales executive if not exists
      if (!salesExecutivesMap[execId]) {
        salesExecutivesMap[execId] = {
          executiveName: execName,
          orders: [],
        };
      }

      // Calculate order details
      const contrValue = parseFloat(workOrder.order_amount || 0);
      const receipts = paymentsByWorkOrder[workOrder.id] || 0;
      const balance = contrValue - receipts;
      const recPercent = contrValue > 0 ? (receipts / contrValue) * 100 : 0;

      // Add order to executive's list
      salesExecutivesMap[execId].orders.push({
        ordDate: formatDate(workOrder.created_at),
        ordNo: workOrder.work_order_number,
        customerName: workOrder.customer_name,
        town: extractTown(workOrder.customer_address || ''),
        units: 1,
        mobileNo: workOrder.customer_phone || '',
        contrValue,
        receipts,
        balance,
        ordStatus: workOrder.work_order_status || 'Work Order Received',
        recPercent,
      });
    });

    // Step 10: Calculate subtotals for each executive
    const salesExecutives = Object.values(salesExecutivesMap).map((exec: any) => {
      const subtotal = {
        totalUnits: exec.orders.length,
        totalContrValue: exec.orders.reduce((sum: number, o: any) => sum + o.contrValue, 0),
        totalReceipts: exec.orders.reduce((sum: number, o: any) => sum + o.receipts, 0),
        totalBalance: exec.orders.reduce((sum: number, o: any) => sum + o.balance, 0),
      };

      return {
        executiveName: exec.executiveName,
        orders: exec.orders,
        subtotal,
      };
    });

    // Step 11: Calculate grand total
    const grandTotal = {
      totalUnits: workOrders.length,
      totalContrValue: salesExecutives.reduce((sum, exec) => sum + exec.subtotal.totalContrValue, 0),
      totalReceipts: salesExecutives.reduce((sum, exec) => sum + exec.subtotal.totalReceipts, 0),
      totalBalance: salesExecutives.reduce((sum, exec) => sum + exec.subtotal.totalBalance, 0),
    };

    // Step 12: Prepare report data
    const reportPeriod = from_date && to_date 
      ? `${formatDate(from_date)} To ${formatDate(to_date)}`
      : 'ALL';

    const reportData = {
      companyName: company.name || 'Company Name',
      companyAddress: company.company_address || '',
      branch: 'GUNTUR( ALL)',
      reportPeriod,
      generatedDate: formatDate(new Date().toISOString()),
      orderStatus: 'ALL',
      salesExecutives,
      grandTotal,
    };

    // Step 13: Generate PDF
    const DuesReportElement = React.createElement(DuesReportTemplate, { data: reportData });
    const pdfDoc = pdf(DuesReportElement as React.ReactElement<DocumentProps>);

    // Convert to buffer
    const blob = await pdfDoc.toBlob();
    const arrayBuffer = await blob.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    // Step 14: Return PDF as downloadable file
    const today = formatDate(new Date().toISOString());
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="dues-report-${today}.pdf"`,
      },
    });
  } catch (error: unknown) {
    console.error('API Error generating dues report:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred while generating dues report' },
      { status: 500 }
    );
  }
}

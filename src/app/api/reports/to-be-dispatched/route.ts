import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile } from '@/lib/supabase-server';
import React from 'react';
import { pdf, DocumentProps } from '@react-pdf/renderer';
import { ToBeDispatchedTemplate } from '@/components/ToBeDispatchedTemplate';

/**
 * API Route: Generate To Be Dispatched PDF
 * 
 * Purpose: Generate admin-only report showing work orders with "To Be Dispatched" status
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
        { error: 'Unauthorized: Only Admin users can generate To Be Dispatched reports' },
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

    // Step 5: Build work orders query - FILTER BY "To Be Dispatched" status
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
        plant_capacity,
        structure_height,
        roof_type,
        sales_executive_id
      `)
      .eq('company_id', companyId)
      .eq('work_order_status', 'To Be Dispatched'); // CRITICAL FILTER

    // Apply date filter if provided
    if (from_date && to_date) {
      workOrdersQuery = workOrdersQuery
        .gte('created_at', from_date)
        .lte('created_at', to_date);
    }

    const { data: workOrders, error: workOrdersError } = await workOrdersQuery
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
        { error: 'No "To Be Dispatched" work orders found for the specified criteria' },
        { status: 404 }
      );
    }

    // Step 7: Fetch sales executive names
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

    // Step 9: Group payments by work_order_id
    const paymentsByWorkOrder: Record<string, number> = {};
    (payments || []).forEach((payment: any) => {
      if (!paymentsByWorkOrder[payment.work_order_id]) {
        paymentsByWorkOrder[payment.work_order_id] = 0;
      }
      paymentsByWorkOrder[payment.work_order_id] += parseFloat(payment.amount || 0);
    });

    // Step 10: Build order rows with calculations
    const orders = workOrders.map((workOrder: any) => {
      const contrValue = parseFloat(workOrder.order_amount || 0);
      const receipts = paymentsByWorkOrder[workOrder.id] || 0;
      const percentage = contrValue > 0 ? (receipts / contrValue) * 100 : 0;

      return {
        recDate: formatDate(workOrder.created_at),
        ordNo: workOrder.work_order_number || '',
        customerName: workOrder.customer_name || '',
        customerAddress: workOrder.customer_address || '',
        town: extractTown(workOrder.customer_address || ''),
        mobileNo: workOrder.customer_phone || '',
        contrValue,
        receipts,
        percentage,
        capacity: workOrder.plant_capacity || 'N/A',
        striHeight: workOrder.structure_height || '',
        building: workOrder.roof_type || '',
        salesMan: salesExecMap[workOrder.sales_executive_id] || 'Unknown',
        remarks: workOrder.work_order_status || '',
      };
    });

    // Step 11: Calculate summary
    const summary = {
      totalContrValue: orders.reduce((sum, o) => sum + o.contrValue, 0),
      totalReceipts: orders.reduce((sum, o) => sum + o.receipts, 0),
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
      orders,
      summary,
    };

    // Step 13: Generate PDF
    const ToBeDispatchedElement = React.createElement(ToBeDispatchedTemplate, { data: reportData });
    const pdfDoc = pdf(ToBeDispatchedElement as React.ReactElement<DocumentProps>);

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
        'Content-Disposition': `attachment; filename="to-be-dispatched-${today}.pdf"`,
      },
    });
  } catch (error: unknown) {
    console.error('API Error generating To Be Dispatched report:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred while generating To Be Dispatched report' },
      { status: 500 }
    );
  }
}

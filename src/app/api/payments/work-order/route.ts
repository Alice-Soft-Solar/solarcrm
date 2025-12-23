import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { work_order_id, company_id } = body;

    if (!work_order_id || !company_id) {
      return NextResponse.json(
        { error: 'Missing required fields: work_order_id, company_id' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Service role key not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // First, check if work order exists
    const { data: workOrder, error: workOrderError } = await supabase
      .from('work_orders')
      .select('id, order_amount, company_id')
      .eq('id', work_order_id)
      .single();

    if (workOrderError) {
      console.error('Error fetching work order:', workOrderError);
      // Check if it's a "not found" error
      if (workOrderError.code === 'PGRST116' || workOrderError.message?.includes('No rows')) {
        return NextResponse.json(
          { error: 'Work order not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: `Error fetching work order: ${workOrderError.message}` },
        { status: 400 }
      );
    }

    if (!workOrder) {
      return NextResponse.json(
        { error: 'Work order not found' },
        { status: 404 }
      );
    }

    // Verify work order has a company_id
    if (!workOrder.company_id) {
      console.error('Work order has no company_id assigned');
      return NextResponse.json(
        { error: 'Work order is missing company information. Please contact support.' },
        { status: 400 }
      );
    }

    // Verify work order belongs to the user's company
    if (workOrder.company_id !== company_id) {
      console.error(`Company ID mismatch: Work order company_id=${workOrder.company_id}, User company_id=${company_id}, Work order ID=${work_order_id}`);
      return NextResponse.json(
        { error: 'This work order does not belong to your company' },
        { status: 403 }
      );
    }

    // Get all payments for this work order
    const { data: payments, error: paymentsError } = await supabase
      .from('payments_data')
      .select('*')
      .eq('work_order_id', work_order_id)
      .eq('company_id', company_id)
      .order('transaction_date', { ascending: false });

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError);
      return NextResponse.json(
        { error: paymentsError.message },
        { status: 400 }
      );
    }

    // Calculate totals
    let totalPaid = 0;
    if (payments) {
      payments.forEach((payment: any) => {
        totalPaid += parseFloat(payment.amount || 0);
      });
    }

    const orderAmount = parseFloat(workOrder.order_amount);
    const pendingAmount = orderAmount - totalPaid;
    const paymentPercentage = orderAmount > 0 ? (totalPaid / orderAmount) * 100 : 0;

    return NextResponse.json({
      success: true,
      payments: payments || [],
      paymentSummary: {
        orderAmount,
        totalPaid,
        pendingAmount,
        paymentPercentage: paymentPercentage.toFixed(2),
      },
    });
  } catch (error: unknown) {
    console.error('API Error fetching payments:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
}


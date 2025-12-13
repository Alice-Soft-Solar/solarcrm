import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      payment_id,
      amount,
      transaction_date,
      payment_method,
      status,
      first_payment,
      second_payment,
      final_payment,
      additional_payment,
      company_id,
    } = body;

    if (!payment_id || !company_id) {
      return NextResponse.json(
        { error: 'Missing required fields: payment_id, company_id' },
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

    // Get existing payment
    const { data: existingPayment, error: fetchError } = await supabase
      .from('payments_data')
      .select('*')
      .eq('id', payment_id)
      .eq('company_id', company_id)
      .single();

    if (fetchError || !existingPayment) {
      return NextResponse.json(
        { error: 'Payment not found or does not belong to your company' },
        { status: 404 }
      );
    }

    // Get work order
    const { data: workOrder, error: workOrderError } = await supabase
      .from('work_orders')
      .select('id, order_amount')
      .eq('id', existingPayment.work_order_id)
      .single();

    if (workOrderError || !workOrder) {
      return NextResponse.json(
        { error: 'Work order not found' },
        { status: 404 }
      );
    }

    // Calculate new amount if changed
    const newAmount = amount ? parseFloat(amount) : parseFloat(existingPayment.amount);
    if (isNaN(newAmount) || newAmount <= 0) {
      return NextResponse.json(
        { error: 'Payment amount must be a positive number' },
        { status: 400 }
      );
    }

    // Get all payments for this work order (excluding current one)
    const { data: otherPayments, error: otherPaymentsError } = await supabase
      .from('payments_data')
      .select('amount')
      .eq('work_order_id', existingPayment.work_order_id)
      .neq('id', payment_id);

    if (otherPaymentsError) {
      console.error('Error fetching other payments:', otherPaymentsError);
    }

    // Calculate total with new amount
    let totalPaid = newAmount;
    if (otherPayments) {
      otherPayments.forEach((payment: any) => {
        totalPaid += parseFloat(payment.amount || 0);
      });
    }

    // Check if exceeds order amount
    const orderAmount = parseFloat(workOrder.order_amount);
    if (totalPaid > orderAmount) {
      return NextResponse.json(
        { error: `Total payments would exceed order amount. Maximum allowed: ${orderAmount - (totalPaid - newAmount)}` },
        { status: 400 }
      );
    }

    // Update payment
    const updateData: any = {};
    if (amount !== undefined) updateData.amount = newAmount;
    if (transaction_date !== undefined) updateData.transaction_date = transaction_date;
    if (payment_method !== undefined) updateData.payment_method = payment_method;
    if (status !== undefined) updateData.status = status;
    if (first_payment !== undefined) updateData.first_payment = first_payment;
    if (second_payment !== undefined) updateData.second_payment = second_payment;
    if (final_payment !== undefined) updateData.final_payment = final_payment;
    if (additional_payment !== undefined) updateData.additional_payment = additional_payment;

    const { data: updatedPayment, error: updateError } = await supabase
      .from('payments_data')
      .update(updateData)
      .eq('id', payment_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating payment:', updateError);
      return NextResponse.json(
        { error: updateError.message, details: updateError.details },
        { status: 400 }
      );
    }

    // Calculate payment percentage
    const paymentPercentage = (totalPaid / orderAmount) * 100;

    return NextResponse.json({
      success: true,
      payment: updatedPayment,
      paymentSummary: {
        totalPaid,
        pendingAmount: orderAmount - totalPaid,
        paymentPercentage: paymentPercentage.toFixed(2),
        orderAmount,
      },
    });
  } catch (error: any) {
    console.error('API Error updating payment:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
}


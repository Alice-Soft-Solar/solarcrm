import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, hasRole } from '@/lib/supabase-server';

/**
 * API Route: Update Payment
 * 
 * Security: RLS enforced + Server-side verification
 * - Uses authenticated client with RLS enforcement
 * - Verifies user identity and company from database
 * - Only allows users to update payments in their own company
 */

export async function PUT(request: NextRequest) {
  try {
    // Step 1: Create authenticated Supabase client (uses cookies/JWT)
    const supabase = await createServerClient(request);

    // Step 2: Verify user and get verified profile/role from database
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Step 3: Check authorization - only certain roles can update payments
    const allowedRoles = ['Admin', 'Super Admin', 'Accounts'];
    if (!hasRole(roleName, allowedRoles)) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not have permission to update payments' },
        { status: 403 }
      );
    }

    // Step 4: Parse request body
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
      cheque_number,
      bank_name,
    } = body;

    if (!payment_id) {
      return NextResponse.json(
        { error: 'Missing required field: payment_id' },
        { status: 400 }
      );
    }

    // Step 5: Get existing payment with RLS enforcement
    // RLS ensures payment belongs to user's company
    const { data: existingPayment, error: fetchError } = await supabase
      .from('payments_data')
      .select('*')
      .eq('id', payment_id)
      .single();

    if (fetchError || !existingPayment) {
      return NextResponse.json(
        { error: 'Payment not found or does not belong to your company' },
        { status: 404 }
      );
    }

    // Step 6: Get work order with RLS enforcement
    const { data: workOrder, error: workOrderError } = await supabase
      .from('work_orders')
      .select('*')
      .eq('id', existingPayment.work_order_id)
      .single();

    if (workOrderError || !workOrder) {
      return NextResponse.json(
        { error: 'Work order not found' },
        { status: 404 }
      );
    }

    // Step 7: Calculate new amount if changed
    const newAmount = amount ? parseFloat(amount) : parseFloat(existingPayment.amount);
    if (isNaN(newAmount) || newAmount <= 0) {
      return NextResponse.json(
        { error: 'Payment amount must be a positive number' },
        { status: 400 }
      );
    }

    // Step 8: Get all payments for this work order (excluding current one)
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

    // Step 9: Update payment with RLS enforcement
    const updateData: any = {};
    if (amount !== undefined) updateData.amount = newAmount;
    if (transaction_date !== undefined) updateData.transaction_date = transaction_date;
    if (payment_method !== undefined) updateData.payment_method = payment_method;
    if (status !== undefined) updateData.status = status;
    if (first_payment !== undefined) updateData.first_payment = first_payment;
    if (second_payment !== undefined) updateData.second_payment = second_payment;
    if (final_payment !== undefined) updateData.final_payment = final_payment;
    if (additional_payment !== undefined) updateData.additional_payment = additional_payment;
    if (cheque_number !== undefined) updateData.cheque_number = cheque_number;
    if (bank_name !== undefined) updateData.bank_name = bank_name;

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

    // ⭐ Integrated WhatsApp Payment Update Notification
    // Only notify if the amount changed or if it's the first time notifying (though usually it's an update)
    (async () => {
      try {
        const { notifyPaymentReceived } = await import('@/utils/whatsapp-notifier');
        await notifyPaymentReceived(
          workOrder as any,
          newAmount,
          totalPaid,
          supabase
        );
      } catch (err) {
        console.error('[WhatsApp Notification Error]:', err);
      }
    })();

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
  } catch (error: unknown) {
    console.error('API Error updating payment:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message?.includes('Unauthorized')) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, hasRole } from '@/lib/supabase-server';
import { sendWhatsAppMessage } from '@/utils/whatsapp';

/**
 * API Route: Create Payment
 * 
 * Security: RLS enforced + Server-side verification
 * - Uses authenticated client with RLS enforcement
 * - Verifies user identity and company from database
 * - Only allows users to create payments for their own company's work orders
 */

export async function POST(request: NextRequest) {
  try {
    // Step 1: Create authenticated Supabase client (uses cookies/JWT)
    const supabase = await createServerClient(request);

    // Step 2: Verify user and get verified profile/role from database
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Step 3: Check authorization - only certain roles can create payments
    const allowedRoles = ['Admin', 'Super Admin', 'Accounts'];
    if (!hasRole(roleName, allowedRoles)) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not have permission to create payments' },
        { status: 403 }
      );
    }

    // Step 4: Parse request body
    const body = await request.json();

    const {
      work_order_id,
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

    // Step 5: Validate required fields (company_id no longer needed from request)
    if (!work_order_id || !amount || !transaction_date) {
      return NextResponse.json(
        { error: 'Missing required fields: work_order_id, amount, transaction_date' },
        { status: 400 }
      );
    }

    // Validate work_order_id is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(work_order_id)) {
      return NextResponse.json(
        { error: 'Invalid work order ID format' },
        { status: 400 }
      );
    }

    // Validate amount is positive
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return NextResponse.json(
        { error: 'Payment amount must be a positive number' },
        { status: 400 }
      );
    }

    // Step 6: Check if work order exists and belongs to user's company (RLS enforced)

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
    if (workOrder.company_id !== companyId) {
      console.error(`Company ID mismatch: Work order company_id=${workOrder.company_id}, User company_id=${companyId}, Work order ID=${work_order_id}`);
      return NextResponse.json(
        { error: 'This work order does not belong to your company' },
        { status: 403 }
      );
    }

    // Get existing payments for this work order to calculate totals
    const { data: existingPayments, error: paymentsError } = await supabase
      .from('payments_data')
      .select('amount, first_payment, second_payment, final_payment, additional_payment')
      .eq('work_order_id', work_order_id);

    if (paymentsError) {
      console.error('Error fetching existing payments:', paymentsError);
    }

    // Calculate total paid amount
    let totalPaid = 0;
    if (existingPayments) {
      existingPayments.forEach((payment: any) => {
        totalPaid += parseFloat(payment.amount || 0);
      });
    }

    // Check if new payment would exceed order amount
    const newTotalPaid = totalPaid + paymentAmount;
    if (newTotalPaid > parseFloat(workOrder.order_amount)) {
      return NextResponse.json(
        { error: `Payment amount exceeds remaining balance. Remaining: ${parseFloat(workOrder.order_amount) - totalPaid}` },
        { status: 400 }
      );
    }

    // Double-check work order still exists before inserting (prevent race conditions)
    const { data: verifyWorkOrder, error: verifyError } = await supabase
      .from('work_orders')
      .select('id')
      .eq('id', work_order_id)
      .single();

    if (verifyError || !verifyWorkOrder) {
      console.error('Work order verification failed before payment insert:', verifyError);
      return NextResponse.json(
        { error: 'Work order no longer exists. Please refresh and try again.' },
        { status: 404 }
      );
    }

    // Step 7: Create payment record with RLS enforcement
    // RLS policy ensures payment is created with authenticated user's company_id
    const { data: paymentData, error: paymentError } = await supabase
      .from('payments_data')
      .insert({
        company_id: companyId, // Use verified company ID from authenticated user
        work_order_id: work_order_id,
        amount: paymentAmount,
        transaction_date,
        payment_method: payment_method || null,
        status: status || 'completed',
        first_payment: first_payment || null,
        second_payment: second_payment || null,
        final_payment: final_payment || null,
        additional_payment: additional_payment || null,
        cheque_number: cheque_number || null,
        bank_name: bank_name || null,
      })
      .select()
      .single();


    if (paymentError) {
      console.error('Error creating payment:', paymentError);
      console.error('Payment insert details:', {
        work_order_id,
        company_id: companyId,
        amount: paymentAmount,
        error_code: paymentError.code,
        error_message: paymentError.message,
        error_details: paymentError.details,
        error_hint: paymentError.hint,
      });

      // Check for foreign key constraint violation
      if (paymentError.code === '23503' || paymentError.message?.includes('foreign key constraint')) {
        return NextResponse.json(
          { 
            error: 'Invalid work order reference. The work order may have been deleted or the reference is incorrect.',
            details: `Work Order ID: ${work_order_id}`,
            hint: 'Please refresh the page and try again.'
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { 
          error: paymentError.message || 'Failed to create payment',
          details: paymentError.details,
          hint: paymentError.hint,
        },
        { status: 400 }
      );
    }

    // Calculate payment percentage
    const orderAmount = parseFloat(workOrder.order_amount);
    const paymentPercentage = (newTotalPaid / orderAmount) * 100;

    // Check if this is the first payment (no existing payments before this one)
    // If so, update work order status to "Advance Paid"
    const isFirstPayment = !existingPayments || existingPayments.length === 0;
    if (isFirstPayment) {
      const { error: statusUpdateError } = await supabase
        .from('work_orders')
        .update({ work_order_status: 'Advance Paid' })
        .eq('id', work_order_id);
      
      if (statusUpdateError) {
        console.error('Error updating work order status to Advance Paid:', statusUpdateError);
      } else {
        console.log('✅ Work order status updated to Advance Paid');
      }
    }

    // ====================
    // PAYMENT RECEIVED NOTIFICATIONS  
    // ====================
    // Send payment confirmation notifications to customer and stakeholders
    // This runs for ALL payments (non-blocking, best-effort)
    (async () => {
      try {
        const { notifyPaymentReceived } = await import('@/utils/whatsapp-notifier');
        
        // Re-fetch full work order details for notifications
        const { data: fullWorkOrder } = await supabase
          .from('work_orders')
          .select('*')
          .eq('id', work_order_id)
          .single();

        if (!fullWorkOrder) {
          console.warn('⚠️ Could not fetch work order for payment notifications');
          return;
        }

        // Send payment received notifications
        await notifyPaymentReceived(
          fullWorkOrder as any,
          paymentAmount,
          newTotalPaid,
          supabase as any
        );
      } catch (error) {
        console.error('Error sending payment received notifications:', error);
      }
    })();

    // ====================
    // TO BE DISPATCHED NOTIFICATIONS
    // ====================
    // Check if payment reached 65% and status should be "To Be Dispatched"
    // The database trigger should handle the status update, but we'll check and trigger WhatsApp
    const shouldBeDispatched = orderAmount > 0 && newTotalPaid >= orderAmount * 0.65;
    
    // Get current work order status after payment (trigger may have updated it)
    // Wait a bit for the trigger to process
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const { data: currentWorkOrder } = await supabase
      .from('work_orders')
      .select('work_order_status')
      .eq('id', work_order_id)
      .single();

    // If status changed to "To Be Dispatched", send WhatsApp notifications
    if (shouldBeDispatched && currentWorkOrder?.work_order_status === 'To Be Dispatched') {
      // Send notifications asynchronously (non-blocking)
      (async () => {
        try {
          // Use authenticated supabase client for fetching profiles
          // Re-fetch full work order details
          const { data: fullWorkOrder } = await supabase
            .from('work_orders')
            .select('*')
            .eq('id', work_order_id)
            .single();

          if (!fullWorkOrder) return;

          // Fetch sales executive for contact info
          const { getSalesExecutive, getAdminUsers, getInventoryUsers, sendWhatsAppToUsers, sendWhatsAppToUser } = await import('@/utils/whatsapp-helpers');
          const { getCustomerToBeDispatchedMessage, getAdminToBeDispatchedMessage, getAdminSalesToBeDispatchedMessage } = await import('@/utils/whatsapp-templates');
          
          const salesExecutive = fullWorkOrder.sales_executive_id
            ? await getSalesExecutive(fullWorkOrder.sales_executive_id, supabase as any)
            : null;

          // Prepare work order data
          const workOrderData = {
            work_order_number: fullWorkOrder.work_order_number,
            customer_name: fullWorkOrder.customer_name,
            order_amount: orderAmount,
            payment_received: newTotalPaid,
            plant_capacity: fullWorkOrder.plant_capacity,
            executive_name: salesExecutive?.full_name,
            executive_contact: salesExecutive?.phone || undefined, // Convert null to undefined
            site_details: fullWorkOrder.site_details,
            customer_address: fullWorkOrder.customer_address,
            customer_phone: fullWorkOrder.customer_phone,
          };

          // Send to customer
          if (fullWorkOrder.customer_phone) {
            const customerMessage = getCustomerToBeDispatchedMessage(workOrderData);
            await sendWhatsAppMessage({
              to: fullWorkOrder.customer_phone,
              body: customerMessage,
            }).catch(err => console.error('Customer WhatsApp error:', err));
          }

          // Send to admin users (separate message for admin/sales)
          const adminUsers = await getAdminUsers(fullWorkOrder.company_id, supabase as any);
          if (adminUsers.length > 0) {
            const adminMessage = getAdminSalesToBeDispatchedMessage(workOrderData);
            await sendWhatsAppToUsers(adminUsers, adminMessage).catch(err => console.error('Admin WhatsApp error:', err));
          }

          // Send to sales executive (only if not already in admin users list to avoid duplicates)
          if (salesExecutive && salesExecutive.phone) {
            const isSalesExecAlsoAdmin = adminUsers.some(admin => admin.id === salesExecutive.id);
            if (!isSalesExecAlsoAdmin) {
              const salesMessage = getAdminSalesToBeDispatchedMessage(workOrderData);
              await sendWhatsAppToUser(salesExecutive, salesMessage).catch(err => console.error('Sales Executive WhatsApp error:', err));
            } else {
              console.log('ℹ️ Sales Executive is also an Admin, already notified via admin group');
            }
          }

          // Send to inventory users (detailed dispatch info)
          const inventoryUsers = await getInventoryUsers(fullWorkOrder.company_id, supabase as any);
          if (inventoryUsers.length > 0) {
            const inventoryMessage = getAdminToBeDispatchedMessage(workOrderData);
            await sendWhatsAppToUsers(inventoryUsers, inventoryMessage).catch(err => console.error('Inventory WhatsApp error:', err));
          }
        } catch (error) {
          console.error('Error sending to-be-dispatched notifications:', error);
        }
      })();
    }

    return NextResponse.json({
      success: true,
      payment: paymentData,
      paymentSummary: {
        totalPaid: newTotalPaid,
        pendingAmount: orderAmount - newTotalPaid,
        paymentPercentage: paymentPercentage.toFixed(2),
        orderAmount: orderAmount,
      },
    });
  } catch (error: unknown) {
    console.error('API Error creating payment:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
}


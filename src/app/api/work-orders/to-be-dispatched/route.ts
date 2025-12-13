/**
 * API endpoint to handle "To Be Dispatched" status change
 * This can be called by database triggers or payment creation/update APIs
 * POST /api/work-orders/to-be-dispatched
 * 
 * Body: { work_order_id: string }
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getCustomerToBeDispatchedMessage, getAdminToBeDispatchedMessage, getAdminSalesToBeDispatchedMessage } from '@/utils/whatsapp-templates';
import { getAdminUsers, getInventoryUsers, sendWhatsAppToUser, sendWhatsAppToUsers } from '@/utils/whatsapp-helpers';
import { sendWhatsAppMessage } from '@/utils/whatsapp';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { work_order_id } = body;

    if (!work_order_id) {
      return NextResponse.json(
        { error: 'work_order_id is required' },
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

    // Fetch work order details
    const { data: workOrder, error: workOrderError } = await supabase
      .from('work_orders')
      .select('*')
      .eq('id', work_order_id)
      .single();

    if (workOrderError || !workOrder) {
      return NextResponse.json(
        { error: 'Work order not found' },
        { status: 404 }
      );
    }

    // Verify status is "To Be Dispatched"
    if (workOrder.work_order_status !== 'To Be Dispatched') {
      return NextResponse.json(
        { error: `Work order status is not "To Be Dispatched". Current status: ${workOrder.work_order_status}` },
        { status: 400 }
      );
    }

    // Calculate total payment received
    const { data: payments } = await supabase
      .from('payments_data')
      .select('first_payment, second_payment, final_payment, additional_payment')
      .eq('work_order_id', work_order_id);

    let totalPaid = 0;
    if (payments) {
      payments.forEach((payment: any) => {
        totalPaid += parseFloat(payment.first_payment || 0);
        totalPaid += parseFloat(payment.second_payment || 0);
        totalPaid += parseFloat(payment.final_payment || 0);
        totalPaid += parseFloat(payment.additional_payment || 0);
      });
    }

    // Fetch sales executive for contact info
    const salesExecutive = workOrder.sales_executive_id
      ? await (await import('@/utils/whatsapp-helpers')).getSalesExecutive(workOrder.sales_executive_id, supabase)
      : null;

    // Prepare work order data
    const workOrderData = {
      work_order_number: workOrder.work_order_number,
      customer_name: workOrder.customer_name,
      order_amount: parseFloat(workOrder.order_amount?.toString() || '0'),
      payment_received: totalPaid,
      plant_capacity: workOrder.plant_capacity,
      executive_name: salesExecutive?.full_name,
      executive_contact: salesExecutive?.phone,
      site_details: workOrder.site_details,
      customer_address: workOrder.customer_address,
      customer_phone: workOrder.customer_phone,
    };

    // Send WhatsApp messages (non-blocking)
    try {
      // Send to customer
      if (workOrder.customer_phone) {
        const customerMessage = getCustomerToBeDispatchedMessage(workOrderData);
        const customerResult = await sendWhatsAppMessage({
          to: workOrder.customer_phone,
          body: customerMessage,
        });
        if (customerResult.success) {
          console.log('✅ Customer "To Be Dispatched" WhatsApp sent');
        } else {
          console.warn('⚠️ Customer WhatsApp failed:', customerResult.error);
        }
      }

      // Send to admin users (separate message for admin/sales)
      const adminUsers = await getAdminUsers(workOrder.company_id, supabase);
      if (adminUsers.length > 0) {
        const adminMessage = getAdminSalesToBeDispatchedMessage(workOrderData);
        const adminResults = await sendWhatsAppToUsers(adminUsers, adminMessage);
        const successCount = adminResults.filter((r) => r.result.success).length;
        console.log(`✅ Admin "To Be Dispatched" WhatsApp sent: ${successCount}/${adminUsers.length}`);
      }

      // Send to sales executive (if different from admin)
      if (salesExecutive && salesExecutive.phone) {
        const salesMessage = getAdminSalesToBeDispatchedMessage(workOrderData);
        const salesResult = await sendWhatsAppToUser(salesExecutive, salesMessage);
        if (salesResult.success) {
          console.log('✅ Sales Executive "To Be Dispatched" WhatsApp sent');
        } else {
          console.warn('⚠️ Sales Executive WhatsApp failed:', salesResult.error);
        }
      }

      // Send to inventory users
      const inventoryUsers = await getInventoryUsers(workOrder.company_id, supabase);
      if (inventoryUsers.length > 0) {
        const inventoryMessage = getAdminToBeDispatchedMessage(workOrderData);
        const inventoryResults = await sendWhatsAppToUsers(inventoryUsers, inventoryMessage);
        const successCount = inventoryResults.filter((r) => r.result.success).length;
        console.log(`✅ Inventory "To Be Dispatched" WhatsApp sent: ${successCount}/${inventoryUsers.length}`);
      }
    } catch (whatsappError) {
      console.error('Error sending WhatsApp notifications:', whatsappError);
      // Don't fail the request if WhatsApp fails
    }

    return NextResponse.json({
      success: true,
      message: 'WhatsApp notifications sent for "To Be Dispatched" status',
    });
  } catch (error: any) {
    console.error('API Error handling to-be-dispatched:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
}


/**
 * API endpoint for inventory to mark work order as "Dispatched"
 * POST /api/work-orders/mark-dispatched
 * 
 * Body: { work_order_id: string, user_id: string, company_id: string }
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getCustomerDispatchedMessage, getAdminSalesDispatchedMessage } from '@/utils/whatsapp-templates';
import { getSalesExecutive, getAdminUsers, sendWhatsAppToUser, sendWhatsAppToUsers } from '@/utils/whatsapp-helpers';
import { sendWhatsAppMessage } from '@/utils/whatsapp';
import { ROLES, isInventoryRole } from '@/constants/roles';
import { WORK_ORDER_STATUS } from '@/constants/work-order-status';
import { calculateTotalPaid } from '@/utils/payment-calculator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { work_order_id, user_id, company_id } = body;

    if (!work_order_id || !user_id || !company_id) {
      return NextResponse.json(
        { error: 'Missing required fields: work_order_id, user_id, company_id' },
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

    // Verify user is Inventory role
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        id,
        company_id,
        roles!inner (
          role_name
        )
      `)
      .eq('id', user_id)
      .eq('company_id', company_id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: 'User profile not found or unauthorized' },
        { status: 403 }
      );
    }

    const roleName = (userProfile as any).roles?.role_name;
    if (!isInventoryRole(roleName)) {
      return NextResponse.json(
        { error: `Only ${ROLES.INVENTORY} role can mark work orders as dispatched` },
        { status: 403 }
      );
    }

    // Fetch work order
    const { data: workOrder, error: workOrderError } = await supabase
      .from('work_orders')
      .select('*')
      .eq('id', work_order_id)
      .eq('company_id', company_id)
      .single();

    if (workOrderError || !workOrder) {
      return NextResponse.json(
        { error: 'Work order not found or does not belong to your company' },
        { status: 404 }
      );
    }

    // Verify work order is in "To Be Dispatched" status
    if (workOrder.work_order_status !== WORK_ORDER_STATUS.TO_BE_DISPATCHED) {
      return NextResponse.json(
        { error: `Work order must be in "${WORK_ORDER_STATUS.TO_BE_DISPATCHED}" status. Current status: ${workOrder.work_order_status || 'null'}` },
        { status: 400 }
      );
    }

    // Update work order status to "Dispatched"
    const { data: updatedWorkOrder, error: updateError } = await supabase
      .from('work_orders')
      .update({ work_order_status: WORK_ORDER_STATUS.DISPATCHED })
      .eq('id', work_order_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating work order status:', updateError);
      return NextResponse.json(
        { error: updateError.message || 'Failed to update work order status' },
        { status: 400 }
      );
    }

    // Fetch sales executive for contact info
    const salesExecutive = workOrder.sales_executive_id
      ? await getSalesExecutive(workOrder.sales_executive_id, supabase as any)
      : null;

    // Calculate total payment received using centralized utility
    const { data: payments } = await supabase
      .from('payments_data')
      .select('first_payment, second_payment, final_payment, additional_payment, amount')
      .eq('work_order_id', work_order_id);

    const totalPaid = calculateTotalPaid(payments);

    // Prepare work order data
    const workOrderData = {
      work_order_number: workOrder.work_order_number,
      customer_name: workOrder.customer_name,
      order_amount: parseFloat(workOrder.order_amount?.toString() || '0'),
      payment_received: totalPaid,
      plant_capacity: workOrder.plant_capacity,
      executive_name: salesExecutive?.full_name,
      executive_contact: salesExecutive?.phone || undefined, // Convert null to undefined
      customer_address: workOrder.customer_address,
      customer_phone: workOrder.customer_phone,
    };

    // Send WhatsApp messages (non-blocking)
    try {
      // Send to customer
      if (workOrder.customer_phone) {
        const customerMessage = getCustomerDispatchedMessage(workOrderData);
        const customerResult = await sendWhatsAppMessage({
          to: workOrder.customer_phone,
          body: customerMessage,
        });
        if (customerResult.success) {
          console.log('✅ Customer "Dispatched" WhatsApp sent');
        } else {
          console.warn('⚠️ Customer WhatsApp failed:', customerResult.error);
        }
      }

      // Send to admin users
      const adminUsers = await getAdminUsers(workOrder.company_id, supabase as any);
      if (adminUsers.length > 0) {
        const adminMessage = getAdminSalesDispatchedMessage(workOrderData);
        const adminResults = await sendWhatsAppToUsers(adminUsers, adminMessage);
        const successCount = adminResults.filter((r) => r.result.success).length;
        console.log(`✅ Admin "Dispatched" WhatsApp sent: ${successCount}/${adminUsers.length}`);
      }

      // Send to sales executive (only if not already in admin users list to avoid duplicates)
      if (salesExecutive && salesExecutive.phone) {
        const isSalesExecAlsoAdmin = adminUsers.some(admin => admin.id === salesExecutive.id);
        if (!isSalesExecAlsoAdmin) {
          const salesMessage = getAdminSalesDispatchedMessage(workOrderData);
          const salesResult = await sendWhatsAppToUser(salesExecutive, salesMessage);
          if (salesResult.success) {
            console.log('✅ Sales Executive "Dispatched" WhatsApp sent');
          } else {
            console.warn('⚠️ Sales Executive WhatsApp failed:', salesResult.error);
          }
        } else {
          console.log('ℹ️ Sales Executive is also an Admin, already notified via admin group');
        }
      }
    } catch (whatsappError) {
      console.error('Error sending WhatsApp notifications:', whatsappError);
      // Don't fail the request if WhatsApp fails
    }

    return NextResponse.json({
      success: true,
      workOrder: updatedWorkOrder,
      message: 'Work order marked as dispatched and customer notified',
    });
  } catch (error: any) {
    console.error('API Error marking as dispatched:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
}


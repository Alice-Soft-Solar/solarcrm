import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, hasRole } from '@/lib/supabase-server';

/**
 * API Route: Mark Work Order as Dispatched
 * 
 * Security: RLS enforced + Server-side verification
 * - Uses authenticated client with RLS enforcement
 * - Only Inventory/Admin can mark as dispatched
 * - RLS ensures work order belongs to user's company
 */

export async function POST(request: NextRequest) {
  try {
    // Step 1: Create authenticated Supabase client
    const supabase = await createServerClient(request);

    // Step 2: Verify user and get verified profile/role
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Step 3: Check authorization
    const allowedRoles = ['Admin', 'Super Admin', 'Inventory'];
    if (!hasRole(roleName, allowedRoles)) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Inventory and Admin can mark work orders as dispatched' },
        { status: 403 }
      );
    }

    // Step 4: Parse request body
    const body = await request.json();
    const { work_order_id } = body;

    if (!work_order_id) {
      return NextResponse.json(
        { error: 'Missing required field: work_order_id' },
        { status: 400 }
      );
    }

    // Step 5: Update work order status with RLS enforcement
    // RLS policy ensures we can only update work orders in our company
    const { data, error } = await supabase
      .from('work_orders')
      .update({ work_order_status: 'Dispatched' })
      .eq('id', work_order_id)
      .select()
      .single();

    if (error) {
      console.error('Error marking work order as dispatched:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to update work order status' },
        { status: 400 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Work order not found or does not belong to your company' },
        { status: 404 }
      );
    }

    // Step 6: Send WhatsApp notifications to customer and stakeholders
    try {
      const { notifyStatusChange } = await import('@/utils/whatsapp-notifier');
      
      // Get payment total for notification
      const { data: payments } = await supabase
        .from('payments_data')
        .select('payment_received')
        .eq('work_order_id', work_order_id);
      
      const totalPaid = payments?.reduce((sum, p) => sum + (p.payment_received || 0), 0) || 0;
      
      // Send notifications
      await notifyStatusChange(data, 'Dispatched', totalPaid, supabase);
    } catch (notifyError) {
      // Log error but don't fail the request if notifications fail
      console.error('Error sending WhatsApp notifications:', notifyError);
    }

    return NextResponse.json({
      success: true,
      workOrder: data,
      whatsappSent: true, // Indicate that WhatsApp notifications were attempted
    });
  } catch (error: unknown) {
    console.error('API Error marking work order as dispatched:', error);
    
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

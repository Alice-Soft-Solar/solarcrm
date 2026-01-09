import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, hasRole } from '@/lib/supabase-server';

/**
 * API Route: Recalculate Work Order Status
 * 
 * Security: RLS enforced + Server-side verification
 * - Uses authenticated client with RLS enforcement
 * - Only Admin can recalculate status
 * - RLS ensures work order belongs to user's company
 */

export async function POST(request: NextRequest) {
  try {
    // Step 1: Create authenticated Supabase client
    const supabase = await createServerClient(request);

    // Step 2: Verify user and get verified profile/role
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Step 3: Check authorization - ADMIN ONLY
    const allowedRoles = ['Admin', 'Super Admin'];
    if (!hasRole(roleName, allowedRoles)) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Admin can recalculate work order status' },
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

    // Step 5: Get work order with RLS enforcement
    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .select('id, order_amount')
      .eq('id', work_order_id)
      .single();

    if (woError || !workOrder) {
      return NextResponse.json(
        { error: 'Work order not found or does not belong to your company' },
        { status: 404 }
      );
    }

    // Step 6: Get total payments with RLS enforcement
    const { data: payments, error: paymentsError } = await supabase
      .from('payments_data')
      .select('amount')
      .eq('work_order_id', work_order_id);

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError);
      return NextResponse.json(
        { error: 'Failed to fetch payments' },
        { status: 400 }
      );
    }

    // Calculate total paid
    const totalPaid = (payments || []).reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0);
    const orderAmount = parseFloat(workOrder.order_amount);
    const paymentPercentage = orderAmount > 0 ? (totalPaid / orderAmount) * 100 : 0;

    // Determine status based on payment percentage
    let newStatus = 'Created';
    if (paymentPercentage >= 100) {
      newStatus = 'Completed';
    } else if (paymentPercentage >= 65) {
      newStatus = 'To Be Dispatched';
    } else if (paymentPercentage > 0) {
      newStatus = 'Advance Paid';
    }

    // Step 7: Update status with RLS enforcement
    const { data: updatedWorkOrder, error: updateError } = await supabase
      .from('work_orders')
      .update({ work_order_status: newStatus })
      .eq('id', work_order_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating work order status:', updateError);
      return NextResponse.json(
        { error: updateError.message || 'Failed to update status' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      workOrder: updatedWorkOrder,
      calculatedStatus: newStatus,
      paymentPercentage: paymentPercentage.toFixed(2),
    });
  } catch (error: unknown) {
    console.error('API Error recalculating work order status:', error);
    
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

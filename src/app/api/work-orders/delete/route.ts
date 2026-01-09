import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, isAdmin } from '@/lib/supabase-server';

/**
 * API Route: Delete Work Order
 * 
 * Security: RLS enforced + Server-side verification
 * - Uses authenticated client with RLS enforcement
 * - Verifies user identity and company from database
 * - Only Admin/Super Admin can delete work orders
 * - RLS ensures work order belongs to user's company
 */

export async function DELETE(request: NextRequest) {
  try {
    // Step 1: Create authenticated Supabase client (uses cookies/JWT)
    const supabase = await createServerClient(request);

    // Step 2: Verify user and get verified profile/role from database
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Step 3: Check authorization - only Admin and Super Admin can delete
    if (!isAdmin(roleName)) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Admin and Super Admin can delete work orders' },
        { status: 403 }
      );
    }

    // Step 4: Parse request body
    const body = await request.json();
    const { work_order_id } = body;

    if (!work_order_id) {
      return NextResponse.json(
        { error: 'Work order ID is required' },
        { status: 400 }
      );
    }

    // Step 5: Delete associated payments first (cascade delete)
    // RLS policy ensures we can only delete payments for work orders in our company
    const { error: paymentsDeleteError } = await supabase
      .from('payments_data')
      .delete()
      .eq('work_order_id', work_order_id);

    if (paymentsDeleteError) {
      console.error('Error deleting associated payments:', paymentsDeleteError);
      return NextResponse.json(
        { 
          error: 'Failed to delete associated payments', 
          details: paymentsDeleteError.message 
        },
        { status: 400 }
      );
    }

    // Step 6: Delete work order with RLS enforcement
    // RLS policy ensures we can only delete work orders in our company
    const { error } = await supabase
      .from('work_orders')
      .delete()
      .eq('id', work_order_id);

    if (error) {
      console.error('Error deleting work order:', error);
      return NextResponse.json(
        { error: error.message, details: error.details, hint: error.hint },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Work order deleted successfully',
    });
  } catch (error: unknown) {
    console.error('API Error deleting work order:', error);
    
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

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { work_order_id, userId, companyId, roleName } = body;

    if (!work_order_id) {
      return NextResponse.json(
        { error: 'Work order ID is required' },
        { status: 400 }
      );
    }

    if (!userId || !roleName) {
      return NextResponse.json(
        { error: 'User ID and role are required' },
        { status: 400 }
      );
    }

    // Only Admin and Super Admin can delete work orders
    if (roleName !== 'Admin' && roleName !== 'Super Admin') {
      return NextResponse.json(
        { error: 'You do not have permission to delete work orders. Only Admin and Super Admin can delete work orders.' },
        { status: 403 }
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

    // Use service role key to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify work order exists and belongs to the user's company (if companyId provided)
      const { data: workOrder, error: fetchError } = await supabase
        .from('work_orders')
        .select('id, company_id')
        .eq('id', work_order_id)
        .single();

      if (fetchError || !workOrder) {
        return NextResponse.json(
          { error: 'Work order not found' },
          { status: 404 }
        );
      }

    // Verify work order belongs to the user's company (if companyId provided)
    if (companyId && workOrder.company_id !== companyId) {
        return NextResponse.json(
          { error: 'You do not have permission to delete this work order' },
          { status: 403 }
        );
      }

    // Step 1: Delete all associated payments first (cascade delete)
    // This is required because of the foreign key constraint: payments_data_work_order_id_fkey
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

    // Step 2: Delete work order (now safe since payments are deleted)
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
  } catch (error: any) {
    console.error('API Error deleting work order:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
}


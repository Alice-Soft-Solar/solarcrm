import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to recalculate work_order_status for all work orders
 * This is useful when the trigger wasn't active or when migrating existing data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { work_order_id, company_id } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Build query - either specific work order or all work orders
    let query = supabase
      .from('work_orders')
      .select('id, order_amount, company_id');

    if (work_order_id) {
      query = query.eq('id', work_order_id);
    }
    if (company_id) {
      query = query.eq('company_id', company_id);
    }

    const { data: workOrders, error: workOrdersError } = await query;

    if (workOrdersError) {
      console.error('Error fetching work orders:', workOrdersError);
      return NextResponse.json(
        { error: workOrdersError.message },
        { status: 400 }
      );
    }

    if (!workOrders || workOrders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No work orders found',
        updated: 0,
      });
    }

    let updatedCount = 0;
    const errors: string[] = [];

    // Process each work order
    for (const workOrder of workOrders) {
      try {
        // Calculate total paid using the same logic as the trigger
        const { data: payments, error: paymentsError } = await supabase
          .from('payments_data')
          .select('first_payment, second_payment, final_payment, additional_payment')
          .eq('work_order_id', workOrder.id);

        if (paymentsError) {
          console.error(`Error fetching payments for work order ${workOrder.id}:`, paymentsError);
          errors.push(`Work order ${workOrder.id}: ${paymentsError.message}`);
          continue;
        }

        // Calculate total paid (same logic as trigger)
        let totalPaid = 0;
        if (payments && payments.length > 0) {
          payments.forEach((payment: any) => {
            totalPaid += parseFloat(payment.first_payment || 0);
            totalPaid += parseFloat(payment.second_payment || 0);
            totalPaid += parseFloat(payment.final_payment || 0);
            totalPaid += parseFloat(payment.additional_payment || 0);
          });
        }

        const orderAmount = parseFloat(workOrder.order_amount?.toString() || '0');
        
        // Determine status
        let newStatus: string | null = null;
        if (orderAmount > 0 && totalPaid >= orderAmount * 0.65) {
          newStatus = 'To Be Dispatched';
        }

        // Update work order status
        const { error: updateError } = await supabase
          .from('work_orders')
          .update({ work_order_status: newStatus })
          .eq('id', workOrder.id);

        if (updateError) {
          console.error(`Error updating work order ${workOrder.id}:`, updateError);
          errors.push(`Work order ${workOrder.id}: ${updateError.message}`);
        } else {
          updatedCount++;
        }
      } catch (error: unknown) {
        console.error(`Error processing work order ${workOrder.id}:`, error);
        errors.push(`Work order ${workOrder.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      total: workOrders.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: unknown) {
    console.error('API Error recalculating status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
}


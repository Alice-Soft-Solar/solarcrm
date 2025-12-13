import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      work_order_id,
      work_order_number,
      customer_name,
      customer_address,
      customer_phone,
      site_details,
      structure_height,
      roof_type,
      plant_capacity,
      order_amount,
      aadhaar_url,
      pan_url,
      bank_statement_url,
      cancelled_check_url,
    } = body;

    // Validate required fields
    if (!work_order_id) {
      return NextResponse.json(
        { error: 'Work order ID is required' },
        { status: 400 }
      );
    }

    if (!work_order_number || !customer_name || !customer_address || !customer_phone || !order_amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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

    // Use service role key to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Convert order_amount to number
    const orderAmount = parseFloat(order_amount);
    if (isNaN(orderAmount)) {
      return NextResponse.json(
        { error: 'Order amount must be a valid number' },
        { status: 400 }
      );
    }

    // Update work order
    const { data, error } = await supabase
      .from('work_orders')
      .update({
        work_order_number,
        customer_name,
        customer_address,
        customer_phone,
        site_details: site_details || null,
        structure_height: structure_height || null,
        roof_type: roof_type || null,
        plant_capacity: plant_capacity || null,
        order_amount: orderAmount,
        aadhaar_url: aadhaar_url || null,
        pan_url: pan_url || null,
        bank_statement_url: bank_statement_url || null,
        cancelled_check_url: cancelled_check_url || null,
      })
      .eq('id', work_order_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating work order:', error);
      return NextResponse.json(
        { error: error.message, details: error.details, hint: error.hint },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      workOrder: data,
    });
  } catch (error: any) {
    console.error('API Error updating work order:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
}













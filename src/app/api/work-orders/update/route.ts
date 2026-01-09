import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, hasRole } from '@/lib/supabase-server';

/**
 * API Route: Update Work Order
 * 
 * Security: RLS enforced + Server-side verification
 * - Uses authenticated client with RLS enforcement
 * - Verifies user identity and company from database
 * - Only allows users to update work orders in their own company
 */

export async function PUT(request: NextRequest) {
  try {
    // Step 1: Create authenticated Supabase client (uses cookies/JWT)
    const supabase = await createServerClient(request);

    // Step 2: Verify user and get verified profile/role from database
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Step 3: Check authorization - only certain roles can update work orders
    const allowedRoles = ['Admin', 'Super Admin', 'Sales', 'salesLead'];
    if (!hasRole(roleName, allowedRoles)) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not have permission to update work orders' },
        { status: 403 }
      );
    }

    // Step 4: Parse request body
    const body = await request.json();

    const {
      work_order_id,
      work_order_number,
      customer_name,
      customer_address,
      town,
      customer_email,
      customer_phone,
      power_bill,
      power_units,
      site_details,
      structure_height,
      roof_type,
      plant_capacity,
      order_amount,
      aadhaar_url,
      pan_url,
      bank_statement_url,
      cancelled_check_url,
      work_order_status,
      subsidy_amount,
      subsidy_status,
      erection_done_at,
      meter_completed_at,
      warranty_approval,
    } = body;

    // 5. Validate required fields
    if (!work_order_id) {
      return NextResponse.json(
        { error: 'Work order ID is required' },
        { status: 400 }
      );
    }
    
    // DEBUG: Check for missing fields
    const missingFields = [];
    if (!work_order_number) missingFields.push('work_order_number');
    if (!customer_name) missingFields.push('customer_name');
    if (!customer_address) missingFields.push('customer_address');
    if (!town) missingFields.push('town');
    if (!customer_phone) missingFields.push('customer_phone');
    if (!order_amount) missingFields.push('order_amount');
    
    if (missingFields.length > 0) {
      console.error('Update Work Order - Missing Fields:', missingFields, 'Body:', body);
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    if (!work_order_number || !customer_name || !customer_address || !town || !customer_phone || !order_amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Step 6: Convert order_amount to number
    const orderAmount = parseFloat(order_amount);
    if (isNaN(orderAmount)) {
      return NextResponse.json(
        { error: 'Order amount must be a valid number' },
        { status: 400 }
      );
    }

    // Step 7: Update work order with RLS enforcement
    // RLS policy ensures user can only update work orders in their company
    const { data, error } = await supabase
      .from('work_orders')
      .update({
        work_order_number,
        customer_name,
        customer_address,
        town,
        customer_email: customer_email || null,
        customer_phone,
        power_bill: power_bill ? parseFloat(power_bill) : null,
        power_units: power_units ? parseFloat(power_units) : null,
        site_details: site_details || null,
        structure_height: structure_height || null,
        roof_type: roof_type || null,
        plant_capacity: plant_capacity || null,
        order_amount: orderAmount,
        aadhaar_url: aadhaar_url || null,
        pan_url: pan_url || null,
        bank_statement_url: bank_statement_url || null,
        cancelled_check_url: cancelled_check_url || null,
        work_order_status: work_order_status || null,
        subsidy_amount: subsidy_amount ? parseFloat(subsidy_amount) : null,
        subsidy_status: subsidy_status || null,
        erection_done_at: erection_done_at || null,
        meter_completed_at: meter_completed_at || null,
        warranty_approval: warranty_approval || null,
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
  } catch (error: unknown) {
    console.error('API Error updating work order:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
}













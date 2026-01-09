import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, hasRole } from '@/lib/supabase-server';

/**
 * API Route: Get To Be Dispatched Work Orders
 * 
 * Security: RLS enforced + Server-side verification
 * - Uses authenticated client with RLS enforcement
 * - RLS automatically filters work orders by company_id
 */

export async function GET(request: NextRequest) {
  try {
    // Step 1: Create authenticated Supabase client
    const supabase = await createServerClient(request);

    // Step 2: Verify user and get verified profile/role
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Step 3: Check authorization
    const allowedRoles = ['Admin', 'Super Admin', 'Inventory'];
    if (!hasRole(roleName, allowedRoles)) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not have permission to view dispatch queue' },
        { status: 403 }
      );
    }

    // Step 4: Fetch work orders with status "To Be Dispatched" with RLS enforcement
    // RLS policy automatically filters by company_id
    const { data: workOrders, error } = await supabase
      .from('work_orders')
      .select(`
        id,
        work_order_number,
        customer_name,
        customer_address,
        customer_phone,
        plant_capacity,
        order_amount,
        work_order_status,
        created_at,
        sales_executive_id
      `)
      .eq('work_order_status', 'To Be Dispatched')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching to-be-dispatched work orders:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch work orders' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      workOrders: workOrders || [],
    });
  } catch (error: unknown) {
    console.error('API Error fetching to-be-dispatched work orders:', error);
    
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

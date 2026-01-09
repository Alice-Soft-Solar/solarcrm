import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, hasRole } from '@/lib/supabase-server';

/**
 * API Route: Get Payments for Work Order
 * 
 * Security: RLS enforced + Server-side verification
 * - Uses authenticated client with RLS enforcement
 * - RLS automatically filters payments by company_id
 */

export async function GET(request: NextRequest) {
  try {
    // Step 1: Create authenticated Supabase client
    const supabase = await createServerClient(request);

    // Step 2: Verify user and get verified profile/role
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Step 3: Get work_order_id from query params
    const { searchParams } = new URL(request.url);
    const work_order_id = searchParams.get('work_order_id');

    if (!work_order_id) {
      return NextResponse.json(
        { error: 'Missing required parameter: work_order_id' },
        { status: 400 }
      );
    }

    // Step 4: Fetch payments with RLS enforcement
    // RLS policy automatically filters by company_id
    const { data: payments, error } = await supabase
      .from('payments_data')
      .select('*')
      .eq('work_order_id', work_order_id)
      .order('transaction_date', { ascending: false });

    if (error) {
      console.error('Error fetching payments:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch payments' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      payments: payments || [],
    });
  } catch (error: unknown) {
    console.error('API Error fetching payments:', error);
    
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

/**
 * POST handler - same as GET but reads work_order_id from body
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1: Create authenticated Supabase client
    const supabase = await createServerClient(request);

    // Step 2: Verify user and get verified profile/role
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Step 3: Get work_order_id from body
    const body = await request.json();
    const { work_order_id } = body;

    if (!work_order_id) {
      return NextResponse.json(
        { error: 'Missing required field: work_order_id' },
        { status: 400 }
      );
    }

    // Step 4: Fetch payments with RLS enforcement
    const { data: payments, error } = await supabase
      .from('payments_data')
      .select('*')
      .eq('work_order_id', work_order_id)
      .order('transaction_date', { ascending: false });

    if (error) {
      console.error('Error fetching payments:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch payments' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      payments: payments || [],
    });
  } catch (error: unknown) {
    console.error('API Error fetching payments:', error);
    
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

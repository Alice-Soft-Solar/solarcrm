import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, isAdmin } from '@/lib/supabase-server';

/**
 * API Route: Update Employee
 * 
 * Security: RLS enforced + Server-side verification
 * - Uses authenticated client with RLS enforcement
 * - Only Admin/Super Admin can update employees
 * - RLS ensures employee belongs to user's company
 */

export async function PUT(request: NextRequest) {
  try {
    // Step 1: Create authenticated Supabase client
    const supabase = await createServerClient(request);

    // Step 2: Verify user and get verified profile/role
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Step 3: Check authorization - ADMIN ONLY
    if (!isAdmin(roleName)) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Admin and Super Admin can update employees' },
        { status: 403 }
      );
    }

    // Step 4: Parse request body
    const body = await request.json();
    const { user_id, full_name, phone_number, role_id, company_id } = body;

    // Step 5: Validate required fields
    if (!user_id) {
      return NextResponse.json(
        { error: 'Missing required field: user_id' },
        { status: 400 }
      );
    }

    // Step 6: Build update object
    const updateData: any = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (phone_number !== undefined) updateData.phone_number = phone_number;
    if (role_id !== undefined) updateData.role_id = role_id;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Step 7: Update employee with RLS enforcement
    // RLS policy ensures we can only update employees in our company
    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating employee:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to update employee' },
        { status: 400 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Employee not found or does not belong to your company' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      employee: data,
    });
  } catch (error: unknown) {
    console.error('API Error updating employee:', error);
    
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

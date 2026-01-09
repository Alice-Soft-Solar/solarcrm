import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, isAdmin } from '@/lib/supabase-server';

/**
 * API Route: Delete Employee
 * 
 * Security: Proxies to Supabase Edge Function
 * - Only Admin/Super Admin can delete employees
 * - Calls edge function which has service role access in Supabase backend
 */

const EDGE_FUNCTION_URL = 'https://xjgzudgmtbgitxcnklbm.supabase.co/functions/v1/delete-user';

export async function DELETE(request: NextRequest) {
  try {
    // Step 1: Create authenticated Supabase client
    const supabase = await createServerClient(request);

    // Step 2: Verify user and get verified profile/role
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Step 3: Check authorization - only Admin and Super Admin can delete
    if (!isAdmin(roleName)) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Admin and Super Admin can delete employees' },
        { status: 403 }
      );
    }

    // Step 4: Parse request body
    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Step 5: Delete profile first (RLS enforced)
    // RLS ensures we can only delete profiles in our company
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', user_id);

    if (profileError) {
      console.error('Error deleting profile:', profileError);
      return NextResponse.json(
        { error: profileError.message || 'Failed to delete employee profile' },
        { status: 400 }
      );
    }

    // Step 6: Call Supabase Edge Function to delete auth user
    // Edge function has service role access in secure backend environment
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseAnonKey) {
      throw new Error('Supabase anon key not configured');
    }

    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ user_id }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Edge function error:', errorData);
      // Auth user delete failed, but profile is already deleted - log warning
      console.warn('Profile deleted but auth user deletion failed:', errorData.error);
    }

    return NextResponse.json({
      success: true,
      message: 'Employee deleted successfully',
    });
  } catch (error: unknown) {
    console.error('API Error deleting employee:', error);
    
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

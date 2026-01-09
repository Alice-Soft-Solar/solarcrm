import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile } from '@/lib/supabase-server';

/**
 * API Route: List Employees
 * 
 * Security Model:
 * - User is verified via JWT token (verifyUserAndGetProfile)
 * - Query uses verified companyId to filter (not RLS)
 * - RLS doesn't work because Supabase JS can't set auth.uid() in server context
 * - This is equivalent security: user is verified, then query filters by their company
 */

export async function POST(request: NextRequest) {
  try {
    // Step 1: Create authenticated Supabase client (needed for verification)
    const supabase = await createServerClient(request);

    // Step 2: Verify user and get verified profile/role
    // This decodes JWT and fetches profile - if this succeeds, user is authenticated
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Step 3: Parse request body (for excludeUserId)
    const body = await request.json();
    const { excludeUserId } = body;

    // Step 4: Query profiles using authenticated supabase client
    // IMPORTANT: The RLS policy on profiles must allow company-level access:
    // company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    // If RLS is set to (auth.uid() = id), employees won't show up!
    let query = supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        phone_number,
        company_id,
        role_id,
        roles (
          role_name
        )
      `)
      .eq('company_id', companyId)
      .order('full_name', { ascending: true });

    // Exclude current user if requested
    if (excludeUserId) {
      query = query.neq('id', excludeUserId);
    }

    const { data: employees, error } = await query;


    if (error) {
      console.error('Error fetching employees:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch employees' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      profiles: employees || [],
    });
  } catch (error: unknown) {
    console.error('API Error fetching employees:', error);
    
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

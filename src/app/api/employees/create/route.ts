import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, isAdmin } from '@/lib/supabase-server';

/**
 * API Route: Create Employee
 * 
 * Security: Proxies to Supabase Edge Function
 * - Only Admin/Super Admin can create employees
 * - Calls edge function which has service role access in Supabase backend
 */

const EDGE_FUNCTION_URL = 'https://xjgzudgmtbgitxcnklbm.supabase.co/functions/v1/create-user-with-profile';

export async function POST(request: NextRequest) {
  try {
    // Step 1: Create authenticated Supabase client
    const supabase = await createServerClient(request);

    // Step 2: Verify user and get verified profile/role from database
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Step 3: Check authorization - only Admin and Super Admin can create employees
    if (!isAdmin(roleName)) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Admin and Super Admin can create employees' },
        { status: 403 }
      );
    }

    // Step 4: Parse request body
    const body = await request.json();
    const { email, password, full_name, role_id, company_id, phone_number } = body;

    if (!email || !password || !full_name || !role_id || !company_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Step 5: Call Supabase Edge Function to create user
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
      body: JSON.stringify({
        email,
        password,
        full_name,
        role_id,
        company_id,
        phone_number: phone_number || null,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Edge function error:', errorData);
      throw new Error(errorData.error || 'Failed to create user via edge function');
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      employee: {
        id: data.user_id,
        email,
        full_name,
        role_id,
        company_id,
        phone_number,
      },
    });
  } catch (error: unknown) {
    console.error('API Error creating employee:', error);
    
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

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile } from '@/lib/supabase-server';

/**
 * API Route: Get Employee Emails
 * 
 * Security: Proxies to Supabase Edge Function
 * - Verifies user authentication first
 * - Calls edge function which has service role access in Supabase backend
 */

const EDGE_FUNCTION_URL = 'https://xjgzudgmtbgitxcnklbm.supabase.co/functions/v1/get-user-emails';

export async function POST(request: NextRequest) {
  try {
    // Step 1: Create authenticated Supabase client
    const supabase = await createServerClient(request);

    // Step 2: Verify user and get verified profile/role
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Step 3: Parse request body
    const body = await request.json();
    const { userIds } = body;

    if (!userIds || !Array.isArray(userIds)) {
      return NextResponse.json(
        { error: 'userIds array is required' },
        { status: 400 }
      );
    }

    // Step 4: Call Supabase Edge Function to fetch emails
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
      body: JSON.stringify({ userIds }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Failed to fetch emails from edge function');
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      emailMap: data.emailMap || {},
    });
  } catch (error: unknown) {
    console.error('API Error fetching employee emails:', error);
    
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

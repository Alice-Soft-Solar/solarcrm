import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, hasRole } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    // Create authenticated Supabase client
    const supabase = await createServerClient(request);
    
    // Verify user and get profile
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Check if user has permission to view quotations
    const allowedRoles = ['Admin', 'Super Admin', 'Sales Lead', 'Sales', 'salesLead'];
    if (!hasRole(roleName, allowedRoles)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch quotations based on role
    let query = supabase
      .from('quotations')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    // Sales Executive can only see their own quotations
    if (roleName === 'Sales') {
      query = query.eq('created_by', userId);
    }

    const { data: quotations, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching quotations:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch quotations' }, { status: 500 });
    }

    return NextResponse.json({ quotations: quotations || [] }, { status: 200 });

  } catch (error: unknown) {
    console.error('Quotations list API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

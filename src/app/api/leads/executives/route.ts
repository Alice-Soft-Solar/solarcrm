import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

/**
 * API route to fetch executives for lead assignment dropdown
 * Uses service role key to bypass RLS and ensure proper data fetching
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, roleName, currentUserId, currentUserFullName } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
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

    // Fetch all profiles from the same company
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        roles (role_name)
      `)
      .eq('company_id', companyId);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return NextResponse.json(
        { error: profilesError.message || 'Failed to fetch profiles' },
        { status: 400 }
      );
    }

    interface ExecutiveOption {
      id: string;
      full_name: string;
    }

    let executives: ExecutiveOption[] = [];

    if (roleName === 'Admin' || roleName === 'Super Admin') {
      // Admin/Super Admin: Show Sales executives and Sales Leads
      executives = (profiles || [])
        .filter((p: any) => {
          const r = p.roles as { role_name: string } | { role_name: string }[];
          const rn = Array.isArray(r) ? r[0]?.role_name : r?.role_name;
          return rn === 'Sales' || rn === 'salesLead';
        })
        .map((p: any) => ({
          id: p.id,
          full_name: p.full_name || 'Unnamed',
        }));
    } else if (roleName === 'salesLead') {
      // Sales Lead: Show only Sales executives (not other Sales Leads) + themselves
      const salesExecs = (profiles || [])
        .filter((p: any) => {
          const r = p.roles as { role_name: string } | { role_name: string }[];
          const rn = Array.isArray(r) ? r[0]?.role_name : r?.role_name;
          return rn === 'Sales';
        })
        .map((p: any) => ({
          id: p.id,
          full_name: p.full_name || 'Unnamed',
        }));

      // Add the current Sales Lead themselves
      executives = [
        ...salesExecs,
        {
          id: currentUserId,
          full_name: currentUserFullName || 'Unnamed',
        },
      ];
    }

    // Sort alphabetically by full_name
    executives.sort((a, b) => a.full_name.localeCompare(b.full_name));

    return NextResponse.json({
      success: true,
      executives,
    });
  } catch (error: any) {
    console.error('API Error fetching executives:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, getServiceClient } from '@/lib/supabase-server';

/**
 * API route to fetch executives for lead assignment dropdown
 * Uses authenticated client with RLS enforcement
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1: Read request body first (before any other operations that might consume it)
    const body = await request.json();
    const { companyId, roleName, currentUserId, currentUserFullName } = body;

    // Step 2: Create authenticated Supabase client
    const supabase = await createServerClient(request);

    // Step 3: Verify user and get verified profile/role from database
    const { userId, companyId: verifiedCompanyId, roleName: verifiedRoleName } = await verifyUserAndGetProfile(supabase, request);

    // Use verified companyId from server, not from request body
    const targetCompanyId = verifiedCompanyId || companyId;
    const targetRoleName = verifiedRoleName || roleName;

    if (!targetCompanyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Use service client for fetching profiles (bypasses RLS for this lookup only)
    const serviceClient = getServiceClient();

    // Fetch all profiles from the same company
    const { data: profiles, error: profilesError } = await serviceClient
      .from('profiles')
      .select(`
        id,
        full_name,
        roles (role_name)
      `)
      .eq('company_id', targetCompanyId);

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

    if (targetRoleName === 'Admin' || targetRoleName === 'Super Admin') {
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
    } else if (targetRoleName === 'Sales') {
      // Sales: Show only Sales Lead accounts
      executives = (profiles || [])
        .filter((p: any) => {
          const r = p.roles as { role_name: string } | { role_name: string }[];
          const rn = Array.isArray(r) ? r[0]?.role_name : r?.role_name;
          return rn === 'salesLead';
        })
        .map((p: any) => ({
          id: p.id,
          full_name: p.full_name || 'Unnamed',
        }));
    } else if (targetRoleName === 'salesLead') {
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
          id: userId || currentUserId,
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

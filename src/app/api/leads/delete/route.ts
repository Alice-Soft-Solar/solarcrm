import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, isAdmin as checkIsAdmin } from '@/lib/supabase-server';

/**
 * API route to delete a lead
 * 
 * Security: RLS enforced + Server-side verification
 * - Uses cookie-based authentication (automatic)
 * - Verifies user identity from database (not frontend)
 * - Only Admin/Super Admin can delete leads
 */

export async function DELETE(request: NextRequest) {
  try {
    // Step 1: Create authenticated Supabase client (uses cookies)
    const supabase = await createServerClient(request);

    // Step 2: Verify user and get verified profile/role from database
    const { userId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Step 3: Check authorization - only Admin/Super Admin can delete
    const isAdmin = checkIsAdmin(roleName);
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Admin and Super Admin can delete leads' },
        { status: 403 }
      );
    }

    // Step 4: Parse request body
    const body = await request.json();
    const { lead_id } = body;

    if (!lead_id) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      );
    }

    // Step 5: Verify lead exists and user has access (RLS enforces this)
    const { data: existingLead, error: fetchError } = await supabase
      .from('leads')
      .select('id, company_id')
      .eq('id', lead_id)
      .single();

    if (fetchError || !existingLead) {
      return NextResponse.json(
        { error: 'Lead not found or access denied' },
        { status: 404 }
      );
    }

    // Step 6: Delete lead (RLS enforces access)
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', lead_id);

    if (error) {
      console.error('Error deleting lead:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to delete lead' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Lead deleted successfully',
    });
  } catch (error: any) {
    console.error('API Error deleting lead:', error);
    
    // Handle authentication errors
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
}

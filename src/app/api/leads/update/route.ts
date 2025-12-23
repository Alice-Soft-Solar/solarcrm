import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, hasRole, isAdmin as checkIsAdmin, isSalesLead as checkIsSalesLead } from '@/lib/supabase-server';

/**
 * API route to update a lead
 * 
 * Security: RLS enforced + Server-side verification
 * - Uses cookie-based authentication (automatic)
 * - Verifies user identity from database (not frontend)
 * - RLS policies enforce access control
 * 
 * Permissions:
 * - Admin/Super Admin/Sales Lead: Can update all fields
 * - Sales: Can only update status and visit_status
 */

export async function PUT(request: NextRequest) {
  try {
    // Step 1: Create authenticated Supabase client (uses cookies)
    const supabase = await createServerClient(request);

    // Step 2: Verify user and get verified profile/role from database
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Step 3: Check authorization
    const allowedRoles = ['Sales', 'salesLead', 'Admin', 'Super Admin'];
    if (!hasRole(roleName, allowedRoles)) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not have permission to update leads' },
        { status: 403 }
      );
    }

    // Step 4: Parse request body
    const body = await request.json();
    const {
      lead_id,
      visit_status,
      status,
      customer_name,
      customer_phone,
      power_bill,
      power_units,
      customer_address,
      referer,
    } = body;

    if (!lead_id) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      );
    }

    // Step 5: Verify lead exists and user has access (RLS enforces this)
    const { data: existingLead, error: fetchError } = await supabase
      .from('leads')
      .select('id, company_id, creator_id')
      .eq('id', lead_id)
      .single();

    if (fetchError || !existingLead) {
      return NextResponse.json(
        { error: 'Lead not found or access denied' },
        { status: 404 }
      );
    }

    // Step 6: Build update object based on role
    const updateData: any = {};

    // All roles can update status and visit_status
    if (visit_status !== undefined) {
      updateData.visit_status = visit_status;
    }
    if (status !== undefined) {
      updateData.status = status;
    }

    // Only Admin/Super Admin/Sales Lead can update other fields
    const isAdmin = checkIsAdmin(roleName);
    const isSalesLead = checkIsSalesLead(roleName);
    
    if (isAdmin || isSalesLead) {
      if (customer_name !== undefined) {
        updateData.customer_name = customer_name;
      }
      if (customer_phone !== undefined) {
        updateData.customer_phone = customer_phone;
      }
      if (power_bill !== undefined) {
        updateData.power_bill = power_bill ? parseFloat(power_bill) : null;
      }
      if (power_units !== undefined) {
        updateData.power_units = power_units ? parseFloat(power_units) : null;
      }
      if (customer_address !== undefined) {
        updateData.customer_address = customer_address;
      }
      if (referer !== undefined) {
        updateData.referer = referer;
      }
    }

    // Step 7: Update lead (RLS enforces access)
    const { data, error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', lead_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating lead:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to update lead' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      lead: data,
    });
  } catch (error: unknown) {
    console.error('API Error updating lead:', error);
    
    // Handle authentication errors
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

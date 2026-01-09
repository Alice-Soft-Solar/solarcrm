import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, hasRole } from '@/lib/supabase-server';

/**
 * API route for BackOffice to update work order status and related fields
 * 
 * Security: RLS enforced + Server-side verification
 * - Only BackOffice, Admin, and Super Admin can update these fields
 * - RLS policies ensure company_id match
 */

export async function PUT(request: NextRequest) {
  try {
    // Step 1: Create authenticated Supabase client (uses cookies)
    const supabase = await createServerClient(request);
    
    // Step 2: Verify user and get verified profile/role from database
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);
    
    // Step 3: Check authorization - only BackOffice, Admin, Super Admin can update
    const allowedRoles = ['BackOffice', 'Admin', 'Super Admin'];
    if (!hasRole(roleName, allowedRoles)) {
      return NextResponse.json(
        { error: 'Unauthorized: Only BackOffice and Admin can update work order status' },
        { status: 403 }
      );
    }

    // Step 4: Parse request body
    const body = await request.json();
    const {
      work_order_id,
      work_order_status,
      subsidy_amount,
      subsidy_status,
      erection_done_at,
      meter_completed_at,
      warranty_approval,
    } = body;

    // Validate required fields
    if (!work_order_id) {
      return NextResponse.json(
        { error: 'Missing required field: work_order_id' },
        { status: 400 }
      );
    }

    // Build update object with only provided fields
    const updateData: Record<string, any> = {};
    
    if (work_order_status !== undefined) {
      updateData.work_order_status = work_order_status;
    }
    
    if (subsidy_amount !== undefined) {
      // Convert empty string to null, otherwise convert to number
      if (subsidy_amount === '' || subsidy_amount === null) {
        updateData.subsidy_amount = null;
      } else {
        const amount = typeof subsidy_amount === 'string' ? parseFloat(subsidy_amount) : subsidy_amount;
        updateData.subsidy_amount = isNaN(amount) ? null : amount;
      }
    }
    
    if (subsidy_status !== undefined) {
      // Only include subsidy_status if it's a valid value (not empty)
      // The database has a check constraint that only allows specific values
      const validSubsidyStatuses = ['Pending', 'Received', 'Not Applicable'];
      if (subsidy_status && validSubsidyStatuses.includes(subsidy_status)) {
        updateData.subsidy_status = subsidy_status;
      } else if (subsidy_status === '' || subsidy_status === null) {
        // Don't include in update - keep existing value
        // OR set to null if you want to clear it
        // updateData.subsidy_status = null; // Uncomment if null is allowed
      }
    }
    
    if (erection_done_at !== undefined) {
      // Convert empty string to null for PostgreSQL timestamp
      updateData.erection_done_at = erection_done_at === '' ? null : erection_done_at;
    }
    
    if (meter_completed_at !== undefined) {
      // Convert empty string to null for PostgreSQL timestamp
      updateData.meter_completed_at = meter_completed_at === '' ? null : meter_completed_at;
    }
    
    if (warranty_approval !== undefined) {
      // Convert empty string to null for warranty_approval field
      updateData.warranty_approval = warranty_approval === '' ? null : warranty_approval;
    }

    // Check if there are any fields to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields provided for update' },
        { status: 400 }
      );
    }

    // DEBUG: Log what we're about to update
    console.log('[UPDATE-STATUS DEBUG] Received body:', body);
    console.log('[UPDATE-STATUS DEBUG] Update data being sent:', JSON.stringify(updateData, null, 2));

    // Step 5: Get the previous status before updating (for comparison)
    const { data: previousWorkOrder } = await supabase
      .from('work_orders')
      .select('work_order_status')
      .eq('id', work_order_id)
      .eq('company_id', companyId)
      .single();

    // Update work order (RLS will ensure company_id match)
    const { data, error } = await supabase
      .from('work_orders')
      .update(updateData)
      .eq('id', work_order_id)
      .eq('company_id', companyId) // Extra safety: ensure company match
      .select()
      .single();

    if (error) {
      console.error('Error updating work order:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to update work order' },
        { status: 400 }
      );
    }

    // ====================
    // STATUS CHANGE NOTIFICATIONS
    // ====================
    // Send WhatsApp notifications if status changed (non-blocking, best-effort)
    if (work_order_status !== undefined && previousWorkOrder?.work_order_status !== work_order_status) {
      (async () => {
        try {
          const { notifyStatusChange } = await import('@/utils/whatsapp-notifier');
          
          // Get total payments for notifications
          const { data: payments } = await supabase
            .from('payments_data')
            .select('amount')
            .eq('work_order_id', work_order_id);
          
          const totalPaid = payments?.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0) || 0;
          
          // Send status change notifications
          await notifyStatusChange(
            data as any,
            work_order_status,
            totalPaid,
            supabase as any
          );
          
          console.log(`✅ Status change notifications sent for ${work_order_status}`);
        } catch (error) {
          console.error('Error sending status change notifications:', error);
        }
      })();
    }

    return NextResponse.json({
      success: true,
      workOrder: data,
      message: 'Work order updated successfully',
    });
  } catch (error: unknown) {
    console.error('API Error updating work order:', error);

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

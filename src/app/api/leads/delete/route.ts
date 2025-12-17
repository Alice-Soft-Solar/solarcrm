import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

/**
 * API route to delete a lead
 * 
 * Only Admin and Super Admin can delete leads
 */

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { lead_id, userId, roleName } = body;

    if (!lead_id) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      );
    }

    if (!userId || !roleName) {
      return NextResponse.json(
        { error: 'User ID and role name are required' },
        { status: 400 }
      );
    }

    // Only Admin and Super Admin can delete
    if (roleName !== 'Admin' && roleName !== 'Super Admin') {
      return NextResponse.json(
        { error: 'Only Admin and Super Admin can delete leads' },
        { status: 403 }
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Delete lead
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
  } catch (error: unknown) {
    console.error('API Error deleting lead:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}


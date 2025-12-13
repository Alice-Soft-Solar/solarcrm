import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(request: NextRequest) {
  try {
    const { user_id, full_name, role_id, company_id, phone_number } = await request.json();

    // Validate required fields
    if (!user_id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!full_name || !role_id || !company_id) {
      return NextResponse.json(
        { error: 'Missing required fields. Please provide: full_name, role_id, and company_id' },
        { status: 400 }
      );
    }

    // Validate full_name
    if (typeof full_name !== 'string' || full_name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Full name must be a non-empty string' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Service role key not configured' },
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

    // Update profile in profiles table
    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: full_name.trim(),
        role_id,
        company_id,
        phone_number: phone_number || null,
      })
      .eq('id', user_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to update employee profile' },
        { status: 400 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      employee: {
        id: data.id,
        full_name: data.full_name,
        role_id: data.role_id,
        company_id: data.company_id,
      },
    });
  } catch (error: unknown) {
    console.error('API Error updating employee:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}







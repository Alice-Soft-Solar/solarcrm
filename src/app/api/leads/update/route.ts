import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

/**
 * API route to update a lead
 * 
 * Supports updating visit_status, status, and other lead fields
 */

export async function PUT(request: NextRequest) {
  try {
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

    // Build update object
    const updateData: any = {};

    if (visit_status !== undefined) {
      updateData.visit_status = visit_status;
    }
    if (status !== undefined) {
      updateData.status = status;
    }
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

    // Update lead
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
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}


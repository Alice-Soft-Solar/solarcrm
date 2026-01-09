import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, hasRole } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    // Create authenticated Supabase client
    const supabase = await createServerClient(request);
    
    // Verify user and get profile
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    const quotationId = params.id;

    // Fetch quotation
    const { data: quotation, error: fetchError } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', quotationId)
      .eq('company_id', companyId)
      .single();

    if (fetchError || !quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    // Check permissions (Sales Executive can only access their own)
    if (roleName === 'Sales' && quotation.created_by !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ quotation }, { status: 200 });

  } catch (error: unknown) {
    console.error('Get quotation API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    // Create authenticated Supabase client
    const supabase = await createServerClient(request);
    
    // Verify user and get profile
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    const quotationId = params.id;

    // Fetch quotation to check permissions
    const { data: quotation, error: fetchError } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', quotationId)
      .eq('company_id', companyId)
      .single();

    if (fetchError || !quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    // Check permissions
    const canDelete = 
      roleName === 'Admin' ||
      roleName === 'Super Admin' ||
      roleName === 'Sales Lead' ||
      roleName === 'salesLead' ||
      (roleName === 'Sales' && quotation.created_by === userId);

    if (!canDelete) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete quotation
    const { error: deleteError } = await supabase
      .from('quotations')
      .delete()
      .eq('id', quotationId);

    if (deleteError) {
      console.error('Error deleting quotation:', deleteError);
      return NextResponse.json({ error: 'Failed to delete quotation' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Quotation deleted successfully' }, { status: 200 });

  } catch (error: unknown) {
    console.error('Delete quotation API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

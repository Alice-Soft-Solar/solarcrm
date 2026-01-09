import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createServerClient, verifyUserAndGetProfile, hasRole } from '@/lib/supabase-server';
import LeadsPDFTemplate, { LeadRow } from '@/components/LeadsPDFTemplate';

/**
 * API route to generate leads PDF
 * 
 * Security: RLS enforced + Server-side verification
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1: Create authenticated Supabase client
    const supabase = await createServerClient(request);

    // Step 2: Verify user and get profile
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Step 3: Check authorization
    const allowedRoles = ['Sales', 'salesLead', 'Admin', 'Super Admin'];
    if (!hasRole(roleName, allowedRoles)) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not have permission to generate leads PDF' },
        { status: 403 }
      );
    }

    // Step 4: Parse request body for filters
    const body = await request.json();
    const { filters } = body;

    // Step 5: Get company name
    const { data: companyData } = await supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single();

    const companyName = companyData?.name || 'Solar CRM';

    // Step 6: Fetch leads with filters
    let query = supabase
      .from('leads')
      .select(`
        id,
        created_at,
        customer_name,
        customer_phone,
        power_bill,
        power_units,
        customer_address,
        status,
        visit_status,
        creator_id
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    // Apply filters if provided
    if (filters) {
      if (filters.executiveId) {
        query = query.eq('creator_id', filters.executiveId);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.visitStatus) {
        query = query.eq('visit_status', filters.visitStatus);
      }
      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo + 'T23:59:59');
      }
      if (filters.singleDate) {
        query = query.gte('created_at', filters.singleDate);
        query = query.lte('created_at', filters.singleDate + 'T23:59:59');
      }
    }

    // Role-based filtering for Sales users (only see their own leads)
    if (roleName === 'Sales') {
      query = query.eq('creator_id', userId);
    }

    const { data: leadsData, error: leadsError } = await query;

    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
      return NextResponse.json(
        { error: 'Failed to fetch leads data' },
        { status: 500 }
      );
    }

    // Step 8: Get executive names for all leads
    const creatorIds = [...new Set(leadsData?.map(lead => lead.creator_id).filter(Boolean))];
    
    let executiveMap: Record<string, string> = {};
    if (creatorIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', creatorIds);
      
      if (profilesData) {
        executiveMap = profilesData.reduce((acc, profile) => {
          acc[profile.id] = profile.full_name;
          return acc;
        }, {} as Record<string, string>);
      }
    }

    // Step 9: Map leads data with executive names
    const leads: LeadRow[] = (leadsData || []).map(lead => ({
      id: lead.id,
      executive_name: executiveMap[lead.creator_id] || 'Unassigned',
      created_at: lead.created_at,
      customer_name: lead.customer_name,
      customer_phone: lead.customer_phone,
      power_bill: lead.power_bill,
      power_units: lead.power_units,
      customer_address: lead.customer_address,
      visit_status: lead.visit_status || 'First Visit',
      status: lead.status || 'N/A',
    }));

    // Step 10: Generate filter info string
    let filterInfo = '';
    if (filters) {
      const parts = [];
      if (filters.status) parts.push(`Status: ${filters.status}`);
      if (filters.visitStatus) parts.push(`Visit: ${filters.visitStatus}`);
      if (filters.singleDate) parts.push(`Date: ${filters.singleDate}`);
      if (filters.dateFrom || filters.dateTo) {
        parts.push(`Period: ${filters.dateFrom || '...'} to ${filters.dateTo || '...'}`);
      }
      filterInfo = parts.join(' | ');
    }

    // Step 11: Generate PDF
    const now = new Date();
    const generatedAt = `${now.toLocaleDateString('en-IN')} ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;

    const pdfBuffer = await renderToBuffer(
      LeadsPDFTemplate({
        companyName,
        leads,
        generatedAt,
        filterInfo,
      })
    );

    // Step 12: Return PDF response
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="leads-report-${now.toISOString().split('T')[0]}.pdf"`,
      },
    });
  } catch (error: unknown) {
    console.error('API Error generating leads PDF:', error);
    
    if (error instanceof Error && error.message?.includes('Unauthorized')) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, hasRole, getServiceClient } from '@/lib/supabase-server';

/**
 * API route to fetch leads list
 * 
 * Security: RLS enforced + Server-side verification
 * - Uses cookie-based authentication (automatic)
 * - Verifies user identity from database (not frontend)
 * - RLS policies filter data at database level
 * 
 * Role Access:
 * - Sales: Only their own leads
 * - Sales Lead: All leads in their company
 * - Admin/Super Admin: All leads in their company
 */

export async function POST(request: NextRequest) {
  try {
    // Step 1: Create authenticated Supabase client (uses cookies)
    const supabase = await createServerClient(request);

    // Step 2: Verify user and get verified profile/role from database
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Step 3: Check authorization
    const allowedRoles = ['Sales', 'salesLead', 'Admin', 'Super Admin'];
    if (!hasRole(roleName, allowedRoles)) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not have access to leads' },
        { status: 403 }
      );
    }

    // Step 4: Parse request body for filters
    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {
      // No body is fine, use defaults
    }

    const {
      page = 1,
      limit = 50,
      filters = {}
    } = body;

    const {
      executiveId = '',
      status = '',
      visitStatus = '',
      singleDate = '',
      dateFrom = '',
      dateTo = '',
    } = filters;

    // Step 5: Build query with RLS enforcement
    let query = supabase
      .from('leads')
      .select(`
        id,
        created_at,
        company_id,
        creator_id,
        customer_name,
        customer_phone,
        power_bill,
        status,
        power_units,
        customer_address,
        referer,
        photo_url,
        latitude,
        longitude,
        visit_status
      `)
      .order('created_at', { ascending: false });

    // Apply filters with AND logic
    if (executiveId && executiveId.trim()) {
      query = query.eq('creator_id', executiveId.trim());
    }

    if (status && status.trim()) {
      query = query.eq('status', status.trim());
    }

    if (visitStatus && visitStatus.trim()) {
      query = query.eq('visit_status', visitStatus.trim());
    }

    // Date filters
    if (singleDate && singleDate.trim()) {
      const date = new Date(singleDate.trim());
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.gte('created_at', startOfDay.toISOString())
                   .lte('created_at', endOfDay.toISOString());
    } else if (dateFrom && dateTo && dateFrom.trim() && dateTo.trim()) {
      const fromDate = new Date(dateFrom.trim());
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(dateTo.trim());
      toDate.setHours(23, 59, 59, 999);
      query = query.gte('created_at', fromDate.toISOString())
                   .lte('created_at', toDate.toISOString());
    }

    // Handle pagination
    const requestedLimit = parseInt(limit) || 50;
    let pageSize: number;
    let pageNumber: number;
    
    if (requestedLimit >= 10000) {
      // Fetch all leads for client-side filtering
      pageSize = requestedLimit;
      pageNumber = 1;
    } else {
      // Apply pagination
      pageSize = Math.min(Math.max(requestedLimit, 1), 100);
      pageNumber = Math.max(parseInt(page) || 1, 1);
      const from = (pageNumber - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching leads:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch leads' },
        { status: 400 }
      );
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('leads')
      .select('id', { count: 'exact', head: true });

    // Apply same filters to count query
    if (executiveId && executiveId.trim()) {
      countQuery = countQuery.eq('creator_id', executiveId.trim());
    }
    if (status && status.trim()) {
      countQuery = countQuery.eq('status', status.trim());
    }
    if (visitStatus && visitStatus.trim()) {
      countQuery = countQuery.eq('visit_status', visitStatus.trim());
    }
    if (singleDate && singleDate.trim()) {
      const date = new Date(singleDate.trim());
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      countQuery = countQuery.gte('created_at', startOfDay.toISOString())
                             .lte('created_at', endOfDay.toISOString());
    } else if (dateFrom && dateTo && dateFrom.trim() && dateTo.trim()) {
      const fromDate = new Date(dateFrom.trim());
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(dateTo.trim());
      toDate.setHours(23, 59, 59, 999);
      countQuery = countQuery.gte('created_at', fromDate.toISOString())
                             .lte('created_at', toDate.toISOString());
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Error counting leads:', countError);
    }

    // Map data to ensure consistent field names
    const mappedLeads = (data || []).map((lead: any) => ({
      id: lead.id,
      created_at: lead.created_at,
      company_id: lead.company_id,
      creator_id: lead.creator_id,
      customer_name: lead.customer_name || '',
      customer_phone: lead.customer_phone || '',
      power_bill: lead.power_bill || null,
      status: lead.status || '',
      power_units: lead.power_units || null,
      customer_address: lead.customer_address || '',
      referer: lead.referer || '',
      photo_url: lead.photo_url || null,
      latitude: lead.latitude || null,
      longitude: lead.longitude || null,
      visit_status: lead.visit_status || 'First Visit',
      executive_name: null as string | null, // Will be populated below - allows string or null
    }));
    
    // Fetch executive names separately (more reliable than joins)
    const creatorIds = [...new Set(
      mappedLeads
        .map(lead => lead.creator_id)
        .filter((id): id is string => id !== null && id !== undefined)
    )];
    
    if (creatorIds.length > 0) {
      try {
        // Use service client to bypass RLS for profile lookup (same as executives route)
        const serviceClient = getServiceClient();
        const { data: profilesData, error: profilesError } = await serviceClient
          .from('profiles')
          .select('id, full_name')
          .in('id', creatorIds);

        if (profilesError) {
          console.error('Error fetching executive names:', profilesError);
        } else if (profilesData && Array.isArray(profilesData)) {
          const profileMap = new Map(profilesData.map((p: any) => [p.id, p.full_name || 'N/A']));
          
          mappedLeads.forEach(lead => {
            if (lead.creator_id) {
              lead.executive_name = profileMap.get(lead.creator_id) || 'N/A';
            } else {
              lead.executive_name = 'N/A';
            }
          });
        }
      } catch (err) {
        console.error('Exception fetching executive names:', err);
        // Set N/A for all if fetch fails
        mappedLeads.forEach(lead => {
          lead.executive_name = 'N/A';
        });
      }
    } else {
      // No creator IDs, set all to N/A
      mappedLeads.forEach(lead => {
        lead.executive_name = 'N/A';
      });
    }

    // Calculate pagination response
    const actualCount = requestedLimit >= 10000 ? mappedLeads.length : (count || 0);

    return NextResponse.json({
      leads: mappedLeads,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total: actualCount,
        totalPages: requestedLimit >= 10000 ? 1 : Math.ceil(actualCount / pageSize),
      },
    });
  } catch (error: unknown) {
    console.error('API Error fetching leads:', error);
    
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

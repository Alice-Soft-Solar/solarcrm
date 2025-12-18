import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

/**
 * API route to fetch leads list
 * 
 * Supports filtering by role:
 * - Sales: only their own leads
 * - Admin/Super Admin: all leads in their company
 */

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { 
      userId, 
      companyId, 
      roleName, 
      page = 1, 
      limit = 50, 
      search = '',
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

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Validate roleName
    const allowedRoles = ['Sales', 'Admin', 'Super Admin', 'salesLead'];
    if (!roleName || !allowedRoles.includes(roleName)) {
      return NextResponse.json(
        { error: 'Invalid or missing role. Only Sales, Admin, Super Admin, and salesLead can access leads.' },
        { status: 403 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      console.error('NEXT_PUBLIC_SUPABASE_URL is not configured');
      return NextResponse.json(
        { error: 'Supabase URL not configured' },
        { status: 500 }
      );
    }

    if (!supabaseServiceKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not configured');
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

    // Build query - try to use schema field names, fallback to old names if needed
    // Also fetch creator profile for executive name
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
        visit_status,
        profiles!creator_id(full_name)
      `)
      .order('created_at', { ascending: false });

    // Filter based on role
    if (roleName === 'Sales') {
      // Sales can only see their own leads
      query = query.eq('creator_id', userId);
    } else if (roleName === 'salesLead') {
      // Sales Lead can see all leads created by all executives in their company
      // Show which executive created each lead
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
    } else if (roleName === 'Admin' || roleName === 'Super Admin') {
      // Admin/Super Admin can see all leads in their company
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
    }

    // Search filtering removed - now handled client-side for partial phone matching
    // This allows searching individual digits (e.g., "8" finds all phones containing "8")

    // Apply filters with AND logic
    // Executive filter
    if (executiveId && executiveId.trim()) {
      query = query.eq('creator_id', executiveId.trim());
    }

    // Status filter
    if (status && status.trim()) {
      query = query.eq('status', status.trim());
    }

    // Visit Status filter
    if (visitStatus && visitStatus.trim()) {
      query = query.eq('visit_status', visitStatus.trim());
    }

    // Date filters - handle single date OR date range OR month/day/year
    if (singleDate && singleDate.trim()) {
      // Single date: filter by exact date
      const date = new Date(singleDate.trim());
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.gte('created_at', startOfDay.toISOString())
                   .lte('created_at', endOfDay.toISOString());
    } else if (dateFrom && dateTo && dateFrom.trim() && dateTo.trim()) {
      // Date range: filter between from and to dates
      const fromDate = new Date(dateFrom.trim());
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(dateTo.trim());
      toDate.setHours(23, 59, 59, 999);
      query = query.gte('created_at', fromDate.toISOString())
                   .lte('created_at', toDate.toISOString());
    }

    // Handle pagination - if limit is very large (10000+), fetch all without pagination
    // Otherwise apply pagination for backward compatibility
    const requestedLimit = parseInt(limit) || 50;
    let pageSize: number;
    let pageNumber: number;
    
    if (requestedLimit >= 10000) {
      // Fetch all leads (no pagination) for client-side filtering
      // Don't apply .range() to get all results
      pageSize = requestedLimit; // Use the large limit
      pageNumber = 1;
    } else {
      // Apply pagination for smaller requests
      pageSize = Math.min(Math.max(requestedLimit, 1), 100); // Limit between 1-100
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
    // If fetching all leads (limit >= 10000), count is the actual fetched count
    // Otherwise, get total count for pagination
    let countQuery = supabase
      .from('leads')
      .select('id', { count: 'exact', head: true });

    // Apply same filters to count query
    if (roleName === 'Sales') {
      countQuery = countQuery.eq('creator_id', userId);
    } else if (roleName === 'salesLead') {
      if (companyId) {
        countQuery = countQuery.eq('company_id', companyId);
      }
    } else if (roleName === 'Admin' || roleName === 'Super Admin') {
      if (companyId) {
        countQuery = countQuery.eq('company_id', companyId);
      }
    }

    // Search filtering removed - now handled client-side for partial phone matching

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

    // Map data to ensure consistent field names (handle both old and new field names)
    // Also fetch executive names separately if not included in the query
    const mappedLeads = (data || []).map((lead: any) => {
      const profile = lead.profiles;
      let executiveName = null;
      
      if (profile) {
        executiveName = profile.full_name || (Array.isArray(profile) && profile[0]?.full_name) || null;
      }
      
      return {
        id: lead.id,
        created_at: lead.created_at,
        company_id: lead.company_id,
        creator_id: lead.creator_id,
        customer_name: lead.customer_name || '',
        customer_phone: lead.customer_phone || lead.mobile_number || '',
        power_bill: lead.power_bill || null,
        status: lead.status || '',
        power_units: lead.power_units || lead.units || null,
        customer_address: lead.customer_address || lead.address || '',
        referer: lead.referer || lead.referrer_name || '',
        photo_url: lead.photo_url || null,
        latitude: lead.latitude || null,
        longitude: lead.longitude || null,
        visit_status: lead.visit_status || 'First Visit', // Default to First Visit if not set, don't fallback to status
        executive_name: executiveName,
      };
    });
    
    // If executive names weren't fetched, fetch them separately
    const creatorIds = mappedLeads
      .map(lead => lead.creator_id)
      .filter((id, index, self) => id && self.indexOf(id) === index);
    
    if (creatorIds.length > 0 && mappedLeads.some(lead => !lead.executive_name)) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', creatorIds);
      
      const profileMap = new Map((profilesData || []).map((p: any) => [p.id, p.full_name]));
      
      mappedLeads.forEach(lead => {
        if (!lead.executive_name && lead.creator_id) {
          lead.executive_name = profileMap.get(lead.creator_id) || null;
        }
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
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

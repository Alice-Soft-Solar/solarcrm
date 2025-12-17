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

    const { userId, companyId, roleName, page = 1, limit = 50, search = '' } = body;

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

    // Apply search filter if provided
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      // Try both field name variations for compatibility
      query = query.or(`customer_name.ilike.${searchTerm},customer_phone.ilike.${searchTerm},customer_address.ilike.${searchTerm},mobile_number.ilike.${searchTerm},address.ilike.${searchTerm}`);
    }

    // Add pagination
    const pageSize = Math.min(Math.max(parseInt(limit) || 50, 1), 100); // Limit between 1-100
    const pageNumber = Math.max(parseInt(page) || 1, 1);
    const from = (pageNumber - 1) * pageSize;
    const to = from + pageSize - 1;
    
    query = query.range(from, to);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching leads:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch leads' },
        { status: 400 }
      );
    }

    // Get total count for pagination (without pagination limit)
    let countQuery = supabase
      .from('leads')
      .select('id', { count: 'exact', head: true });

    if (roleName === 'Sales') {
      countQuery = countQuery.eq('creator_id', userId);
    } else if (roleName === 'Admin' || roleName === 'Super Admin') {
      if (companyId) {
        countQuery = countQuery.eq('company_id', companyId);
      }
    }

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      countQuery = countQuery.or(`customer_name.ilike.${searchTerm},customer_phone.ilike.${searchTerm},customer_address.ilike.${searchTerm},mobile_number.ilike.${searchTerm},address.ilike.${searchTerm}`);
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

    return NextResponse.json({
      leads: mappedLeads,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
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

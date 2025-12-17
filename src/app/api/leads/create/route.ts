import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';


export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const userId = formData.get('userId') as string | null;
    const companyId = formData.get('companyId') as string | null;
    const roleName = formData.get('roleName') as string | null;

    const customer_name = formData.get('customer_name') as string | null;
    // Accept both mobile_number (from form) and map to customer_phone (database column)
    const mobile_number = formData.get('mobile_number') as string | null;
    const power_bill = formData.get('power_bill') as string | null;
    // Accept both units (from form) and map to power_units (database column)
    const units = formData.get('units') as string | null;
    // Accept both address (from form) and map to customer_address (database column)
    const address = formData.get('address') as string | null;
    const status = formData.get('status') as string | null;
    const visit_status = formData.get('visit_status') as string | null;
    // Accept both referrer_name (from form) and map to referer (database column)
    const referrer_name = formData.get('referrer_name') as string | null;
    const executive_id = formData.get('executive_id') as string | null;
    const executive_name = formData.get('executive_name') as string | null;
    const latitude = formData.get('latitude') as string | null;
    const longitude = formData.get('longitude') as string | null;
    const photo = formData.get('photo') as File | null;

    if (!userId || !companyId || !roleName) {
      return NextResponse.json(
        { error: 'Missing user context (userId, companyId, roleName)' },
        { status: 400 },
      );
    }

    // Basic required fields
    if (!customer_name || !mobile_number) {
      return NextResponse.json(
        { error: 'Customer name and mobile number are required' },
        { status: 400 },
      );
    }

    // Map form field names to database column names
    const customer_phone = mobile_number; // Form sends mobile_number, DB expects customer_phone
    const power_units = units ? parseFloat(units) : null; // Form sends units, DB expects power_units
    const customer_address = address; // Form sends address, DB expects customer_address
    const referer = referrer_name; // Form sends referrer_name, DB expects referer

    // Allowed roles - includes salesLead (camelCase to match database)
    const allowedRoles = ['Sales', 'Admin', 'Super Admin', 'salesLead'];
    if (!allowedRoles.includes(roleName)) {
      return NextResponse.json(
        { error: 'Only Sales, Admin, Super Admin, and salesLead can create leads' },
        { status: 403 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Service role key not configured' },
        { status: 500 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Upload photo to Supabase Storage (optional)
    // Images are stored in 'work-order-docs' bucket under companyId/leads/ path
    let photo_url: string | null = null;
    if (photo && photo.size > 0) {
      const fileExt = photo.name.split('.').pop() || 'jpg';
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `${companyId}/leads/${fileName}`;

      // Use work-order-docs bucket (where images are actually stored)
      const { error: uploadError } = await supabase.storage
        .from('work-order-docs')
        .upload(filePath, photo, {
          cacheControl: '3600',
          upsert: false,
          contentType: photo.type || 'image/jpeg',
        });

      if (uploadError) {
        console.error('Error uploading lead photo:', uploadError);
        return NextResponse.json(
          { error: 'Failed to upload photo', details: uploadError.message },
          { status: 400 },
        );
      }

      // Get public URL from work-order-docs bucket
      const { data: publicUrlData } = supabase.storage
        .from('work-order-docs')
        .getPublicUrl(filePath);

      photo_url = publicUrlData.publicUrl || null;
    }

    // Determine creator_id based on role:
    // - For Sales: creator_id = userId (Sales's own profile ID)
    // - For Sales Lead: creator_id = userId (Sales Lead's own profile ID)
    // - For Admin/Super Admin: creator_id = executive_id from form (selected Sales executive's profile ID)
    // Note: executive_id and executive_name are NOT database columns - they're only used to determine creator_id
    const creatorId = (roleName === 'Sales' || roleName === 'salesLead') ? userId : (executive_id || userId);

    // Insert into leads table using CORRECT database column names
    // Note: 
    // - Database only has 'creator_id' (foreign key to profiles.id), NOT 'created_by', NOT 'executive_id', NOT 'executive_name'
    // - Executive name is fetched later via JOIN: profiles!creator_id(full_name)
    const { data, error } = await supabase
      .from('leads')
      .insert({
        company_id: companyId,
        creator_id: creatorId, // Sales: their own profile ID, Admin: selected Sales executive's profile ID
        customer_name,
        customer_phone, // Database column name (mapped from mobile_number)
        power_bill: power_bill ? parseFloat(power_bill) : null,
        power_units, // Database column name (mapped from units)
        customer_address, // Database column name (mapped from address)
        status,
        visit_status: visit_status || 'First Visit', // Default to First Visit if not provided
        referer, // Database column name (mapped from referrer_name)
        latitude,
        longitude,
        photo_url,
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting lead:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to create lead', details: error.details },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        lead: data,
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error('API Error creating lead:', err);
    return NextResponse.json(
      { error: err.message || 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}



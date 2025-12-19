import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, getServiceClient, hasRole, isAdmin as checkIsAdmin, isSalesLead as checkIsSalesLead, isSales as checkIsSales } from '@/lib/supabase-server';

/**
 * API route to create a new lead
 * 
 * Security: RLS enforced + Server-side verification
 * - Uses cookie-based authentication (automatic)
 * - Verifies user identity from database (not frontend)
 * - Storage uploads use service role (bucket permissions only)
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
        { error: 'Unauthorized: You do not have permission to create leads' },
        { status: 403 }
      );
    }

    // Step 4: Parse form data
    const formData = await request.formData();

    const customer_name = formData.get('customer_name') as string | null;
    const mobile_number = formData.get('mobile_number') as string | null;
    const power_bill = formData.get('power_bill') as string | null;
    const units = formData.get('units') as string | null;
    const address = formData.get('address') as string | null;
    const status = formData.get('status') as string | null;
    const visit_status = formData.get('visit_status') as string | null;
    const referrer_name = formData.get('referrer_name') as string | null;
    const executive_id = formData.get('executive_id') as string | null;
    const latitude = formData.get('latitude') as string | null;
    const longitude = formData.get('longitude') as string | null;
    const photo = formData.get('photo') as File | null;

    // Step 5: Validate required fields
    if (!customer_name || !mobile_number) {
      return NextResponse.json(
        { error: 'Customer name and mobile number are required' },
        { status: 400 }
      );
    }

    // Step 6: Map form fields to database columns
    const customer_phone = mobile_number;
    const power_units = units ? parseFloat(units) : null;
    const customer_address = address;
    const referer = referrer_name;

    // Step 7: Determine creator_id based on role
    const isAdmin = checkIsAdmin(roleName);
    const isSalesLead = checkIsSalesLead(roleName);
    const isSales = checkIsSales(roleName);
    
    const creatorId = (isSales || isSalesLead) ? userId : (executive_id || userId);

    // Step 8: Upload photo to storage (service role for bucket access only)
    let photo_url: string | null = null;
    if (photo && photo.size > 0) {
      const serviceSupabase = getServiceClient();
      const fileExt = photo.name.split('.').pop() || 'jpg';
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `${companyId}/leads/${fileName}`;

      const { error: uploadError } = await serviceSupabase.storage
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
          { status: 400 }
        );
      }

      const { data: publicUrlData } = serviceSupabase.storage
        .from('work-order-docs')
        .getPublicUrl(filePath);

      photo_url = publicUrlData.publicUrl || null;
    }

    // Step 9: Insert lead (RLS enforced - must match user's company_id)
    const { data, error } = await supabase
      .from('leads')
      .insert({
        company_id: companyId, // Verified company ID from database
        creator_id: creatorId,
        customer_name,
        customer_phone,
        power_bill: power_bill ? parseFloat(power_bill) : null,
        power_units,
        customer_address,
        status,
        visit_status: visit_status || 'First Visit',
        referer,
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
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        lead: data,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('API Error creating lead:', error);
    
    // Handle authentication errors
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

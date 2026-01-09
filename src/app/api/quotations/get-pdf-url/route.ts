import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, hasRole } from '@/lib/supabase-server';

/**
 * API Route: Get Signed URL for Quotation PDF
 * Returns a signed URL that grants temporary access to the PDF file
 */

export async function POST(request: NextRequest) {
  try {
    // Create authenticated Supabase client
    const supabase = await createServerClient(request);
    
    // Verify user and get profile
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Check authorization
    const allowedRoles = ['Admin', 'Super Admin', 'Sales Lead', 'Sales', 'salesLead'];
    if (!hasRole(roleName, allowedRoles)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { pdf_path } = body;

    if (!pdf_path) {
      return NextResponse.json(
        { error: 'Missing pdf_path' },
        { status: 400 }
      );
    }

    // Handle both full URLs (old format) and file paths (new format)
    let actualPath = pdf_path;
    
    // If it's a full URL, extract the path
    if (pdf_path.includes('/storage/') && pdf_path.includes('work-order-docs')) {
      // Extract path after 'work-order-docs/'
      const match = pdf_path.match(/work-order-docs\/(.+)$/);
      if (match) {
        actualPath = match[1];
      }
    }

    // Verify the path contains the user's company ID (security check)
    if (!actualPath.includes(companyId)) {
      console.error(`Authorization failed: path "${actualPath}" does not contain companyId "${companyId}"`);
      return NextResponse.json(
        { error: 'Unauthorized: PDF does not belong to your company' },
        { status: 403 }
      );
    }

    // Generate signed URL (valid for 1 hour)
    const { data, error } = await supabase.storage
      .from('work-order-docs')
      .createSignedUrl(actualPath, 3600);

    if (error) {
      console.error('Error creating signed URL:', error);
      return NextResponse.json(
        { error: 'Failed to generate PDF URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signed_url: data.signedUrl,
    });

  } catch (error: unknown) {
    console.error('Get PDF URL error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

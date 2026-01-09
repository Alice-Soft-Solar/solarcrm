import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, hasRole } from '@/lib/supabase-server';
import React from 'react';
import { pdf, DocumentProps } from '@react-pdf/renderer';
import { QuotationPDFTemplate } from '@/components/QuotationPDFTemplate';

/**
 * API Route: Generate Quotation PDF
 * 
 * Security: RLS enforced + Server-side verification
 * Generates A4 PDF and stores in Supabase bucket
 */

export async function POST(request: NextRequest) {
  try {
    // Step 1: Create authenticated Supabase client
    const supabase = await createServerClient(request);

    // Step 2: Verify user and get profile
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Step 3: Check authorization
    const allowedRoles = ['Admin', 'Super Admin', 'Sales Lead', 'Sales', 'salesLead'];
    if (!hasRole(roleName, allowedRoles)) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not have permission to generate quotation PDFs' },
        { status: 403 }
      );
    }

    // Step 4: Parse request body
    const body = await request.json();
    const { quotation_id } = body;

    if (!quotation_id) {
      return NextResponse.json(
        { error: 'Missing required field: quotation_id' },
        { status: 400 }
      );
    }

    // Step 5: Fetch quotation details
    const { data: quotation, error: quotationError } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', quotation_id)
      .eq('company_id', companyId)
      .single();

    if (quotationError || !quotation) {
      return NextResponse.json(
        { error: 'Quotation not found or does not belong to your company' },
        { status: 404 }
      );
    }

    // Sales can only generate PDFs for their own quotations
    if (roleName === 'Sales' && quotation.created_by !== userId) {
      return NextResponse.json(
        { error: 'Forbidden: You can only generate PDFs for your own quotations' },
        { status: 403 }
      );
    }

    // Step 6: Prepare quotation data for PDF
    const quotationData = {
      quotation_number: quotation.quotation_number,
      quotation_date: quotation.quotation_date,
      customer_name: quotation.customer_name,
      customer_address: quotation.customer_address,
      customer_city: quotation.customer_city,
      customer_phone: quotation.customer_phone,
      plant_capacity: quotation.plant_capacity,
      system_type: quotation.system_type,
      roof_type: quotation.roof_type,
      order_amount: parseFloat(quotation.order_amount) || 0,
      panel_brand: quotation.panel_brand,
      payment_terms: quotation.payment_terms || '90% BEFORE WORKSTART & 10% AFTER COMPLETION',
      delivery_days: quotation.delivery_days || '30 to 60',
      warranty_years: quotation.warranty_years || '5',
      components_list: quotation.components_list,
      scope_of_work: quotation.scope_of_work,
    };

    // Step 7: Generate PDF
    const QuotationElement = React.createElement(QuotationPDFTemplate, { data: quotationData });
    const pdfDoc = pdf(QuotationElement as React.ReactElement<DocumentProps>);

    const blob = await pdfDoc.toBlob();
    const arrayBuffer = await blob.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    // Step 8: Upload PDF to storage
    const fileName = `${quotation.quotation_number}.pdf`;
    const filePath = `${companyId}/quotations/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('work-order-docs')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('Error uploading PDF:', uploadError);
      return NextResponse.json(
        { error: `Failed to upload PDF: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Step 9: Get file path and update quotation record
    const pdfPath = filePath;

    // Step 10: Update quotation record with PDF path
    const { error: updateError } = await supabase
      .from('quotations')
      .update({ 
        pdf_url: pdfPath,
        updated_at: new Date().toISOString()
      })
      .eq('id', quotation_id);

    if (updateError) {
      console.error('Error updating quotation with PDF path:', updateError);
      // Don't fail - PDF was still generated
    }

    return NextResponse.json({
      success: true,
      pdf_url: pdfPath,
      quotation_number: quotation.quotation_number,
    });

  } catch (error: unknown) {
    console.error('Generate quotation PDF error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

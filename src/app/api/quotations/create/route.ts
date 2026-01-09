import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, hasRole } from '@/lib/supabase-server';
import React from 'react';
import { pdf, DocumentProps } from '@react-pdf/renderer';
import { QuotationPDFTemplate } from '@/components/QuotationPDFTemplate';

export async function POST(request: NextRequest) {
  try {
    // Create authenticated Supabase client
    const supabase = await createServerClient(request);
    
    // Verify user and get profile
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Check if user has permission to create quotations
    const allowedRoles = ['Admin', 'Super Admin', 'Sales Lead', 'Sales', 'salesLead'];
    if (!hasRole(roleName, allowedRoles)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    // Validate required fields
    const requiredFields = [
      'customer_name',
      'customer_address',
      'customer_city',
      'customer_phone',
      'plant_capacity',
      'system_type',
      'order_amount',
      'panel_brand',
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    // Generate quotation number
    const { data: lastQuotation } = await supabase
      .from('quotations')
      .select('quotation_number')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let quotationNumber = 'QT-GMS-0001';
    if (lastQuotation?.quotation_number) {
      const lastNumber = parseInt(lastQuotation.quotation_number.split('-').pop() || '0');
      const nextNumber = (lastNumber + 1).toString().padStart(4, '0');
      quotationNumber = `QT-GMS-${nextNumber}`;
    }

    // Create quotation data
    const quotationData = {
      quotation_number: quotationNumber,
      customer_name: body.customer_name,
      customer_address: body.customer_address,
      customer_city: body.customer_city,
      customer_phone: body.customer_phone,
      plant_capacity: body.plant_capacity,
      system_type: body.system_type,
      roof_type: body.roof_type || null,
      order_amount: parseFloat(body.order_amount),
      panel_brand: body.panel_brand,
      payment_terms: body.payment_terms || '90% BEFORE WORKSTART & 10% AFTER COMPLETION',
      delivery_days: body.delivery_days || '30 to 60',
      warranty_years: body.warranty_years || '5',
      components_list: body.components_list || '(TATA Panels, Inverter, Cables, ACDC box, and Structure)',
      scope_of_work: body.scope_of_work || 'Technical Feasibility, Transport, Erection, Installation, Testing and Commissioning, Civil works and Subsidy status follow-up.',
      status: body.status || 'draft',
      quotation_date: new Date().toISOString().split('T')[0],
      created_by: userId,
      company_id: companyId,
    };

    // Insert quotation first
    const { data: quotation, error: insertError } = await supabase
      .from('quotations')
      .insert(quotationData)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating quotation:', insertError);
      return NextResponse.json({ error: 'Failed to create quotation' }, { status: 500 });
    }

    // Auto-generate PDF
    try {
      const pdfData = {
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
        payment_terms: quotation.payment_terms,
        delivery_days: quotation.delivery_days,
        warranty_years: quotation.warranty_years,
        components_list: quotation.components_list,
        scope_of_work: quotation.scope_of_work,
      };

      // Generate PDF
      const QuotationElement = React.createElement(QuotationPDFTemplate, { data: pdfData });
      const pdfDoc = pdf(QuotationElement as React.ReactElement<DocumentProps>);
      const blob = await pdfDoc.toBlob();
      const arrayBuffer = await blob.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);

      // Upload PDF to storage
      const fileName = `${quotation.quotation_number}.pdf`;
      const filePath = `${companyId}/quotations/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('work-order-docs')
        .upload(filePath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true,
          cacheControl: '3600',
        });

      if (uploadError) {
        console.error('Error uploading PDF:', uploadError);
        // Don't fail the whole request, quotation was created
      } else {
        // Store just the file path (not the full public URL)
        // This is consistent with how receipts are stored
        const pdfPath = filePath;

        // Update quotation with PDF path
        await supabase
          .from('quotations')
          .update({ pdf_url: pdfPath })
          .eq('id', quotation.id);

        // Return updated quotation with pdf_url
        quotation.pdf_url = pdfPath;
      }
    } catch (pdfError) {
      console.error('Error generating PDF:', pdfError);
      // Don't fail - quotation was still created
    }

    return NextResponse.json({ quotation }, { status: 201 });

  } catch (error: unknown) {
    console.error('Create quotation API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}


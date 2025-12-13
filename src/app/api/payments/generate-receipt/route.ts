import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { pdf, DocumentProps } from '@react-pdf/renderer';
import ReceiptTemplate from '@/components/ReceiptTemplate';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { payment_id, company_id } = body;

    if (!payment_id || !company_id) {
      return NextResponse.json(
        { error: 'Missing required fields: payment_id, company_id' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Service role key not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Fetch payment details
    const { data: payment, error: paymentError } = await supabase
      .from('payments_data')
      .select('*')
      .eq('id', payment_id)
      .eq('company_id', company_id)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json(
        { error: 'Payment not found or does not belong to your company' },
        { status: 404 }
      );
    }

    // Fetch work order details
    const { data: workOrder, error: workOrderError } = await supabase
      .from('work_orders')
      .select('*')
      .eq('id', payment.work_order_id)
      .single();

    if (workOrderError || !workOrder) {
      return NextResponse.json(
        { error: 'Work order not found' },
        { status: 404 }
      );
    }

    // Fetch company details with super_base_id and logo
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('name, address, phone, super_base_id, logo_url')
      .eq('id', company_id)
      .single();

    if (companyError) {
      console.error('Error fetching company:', companyError);
    }

    // Fetch super base company details if super_base_id exists
    let superBaseCompany = null;
    let logoUrl: string | undefined = company?.logo_url || undefined;
    
    if (company?.super_base_id) {
      const { data: superBase, error: superBaseError } = await supabase
        .from('companies')
        .select('name, logo_url')
        .eq('id', company.super_base_id)
        .single();

      if (!superBaseError && superBase) {
        superBaseCompany = superBase;
        // Use super base company logo if available, otherwise use company logo
        logoUrl = superBase.logo_url || company?.logo_url || undefined;
      }
    }

    // Generate signed URL if logo is stored in Supabase storage (path format)
    // Assumes logo_url might be a storage path like "company-id/logo.png"
    if (logoUrl && !logoUrl.startsWith('http://') && !logoUrl.startsWith('https://')) {
      try {
        // Try common storage buckets - adjust bucket name if different
        const possibleBuckets = ['company-logos', 'logos', 'work-order-docs'];
        for (const bucket of possibleBuckets) {
          const { data: signedData, error: signedError } = await supabase.storage
            .from(bucket)
            .createSignedUrl(logoUrl, 3600); // 1 hour expiry
          
          if (!signedError && signedData?.signedUrl) {
            logoUrl = signedData.signedUrl;
            break;
          }
        }
      } catch (error) {
        console.error('Error generating signed URL for logo:', error);
        // Continue without logo if signed URL generation fails
        logoUrl = undefined;
      }
    }

    // Get all payments for this work order to calculate totals
    const { data: allPayments, error: allPaymentsError } = await supabase
      .from('payments_data')
      .select('amount')
      .eq('work_order_id', payment.work_order_id)
      .eq('company_id', company_id);

    if (allPaymentsError) {
      console.error('Error fetching all payments:', allPaymentsError);
    }

    // Calculate totals
    let totalPaid = 0;
    if (allPayments) {
      allPayments.forEach((p: any) => {
        totalPaid += parseFloat(p.amount || 0);
      });
    }

    const orderAmount = parseFloat(workOrder.order_amount);
    const pendingAmount = orderAmount - totalPaid;

    // Determine payment type
    let paymentType = 'additional_payment';
    if (payment.first_payment) paymentType = 'first_payment';
    else if (payment.second_payment) paymentType = 'second_payment';
    else if (payment.final_payment) paymentType = 'final_payment';
    else if (payment.additional_payment) paymentType = 'additional_payment';

    // Generate receipt number if not exists
    let receiptNumber = payment.receipt_number;
    if (!receiptNumber) {
      const currentYear = new Date().getFullYear();
      const prefix = `REC-${currentYear}-`;

      // Get the last receipt number for this year
      const { data: lastReceipt, error: lastReceiptError } = await supabase
        .from('payments_data')
        .select('receipt_number')
        .like('receipt_number', `${prefix}%`)
        .order('receipt_number', { ascending: false })
        .limit(1)
        .single();

      let sequence = 1;
      if (!lastReceiptError && lastReceipt?.receipt_number) {
        const lastSequence = parseInt(
          lastReceipt.receipt_number.replace(prefix, ''),
          10
        );
        if (!isNaN(lastSequence)) {
          sequence = lastSequence + 1;
        }
      }

      receiptNumber = `${prefix}${sequence.toString().padStart(4, '0')}`;
    }

    // Prepare receipt data with proper company mapping
    // Use super base company name if available, otherwise use company name
    const displayCompanyName = superBaseCompany?.name || company?.name || 'Company Name';
    
    const receiptData = {
      receiptNumber,
      receiptDate: payment.receipt_generated_at || payment.created_at || new Date().toISOString(),
      companyName: displayCompanyName,
      companyAddress: company?.address || '',
      companyPhone: company?.phone || '',
      companyLogoUrl: logoUrl,
      customerName: workOrder.customer_name,
      customerAddress: workOrder.customer_address,
      customerPhone: workOrder.customer_phone,
      workOrderNumber: workOrder.work_order_number,
      orderAmount,
      paymentType,
      paymentAmount: parseFloat(payment.amount),
      paymentMethod: payment.payment_method || 'N/A',
      transactionDate: payment.transaction_date,
      totalPaid,
      pendingAmount,
    };

    // Generate PDF
    const ReceiptElement = React.createElement(ReceiptTemplate, { data: receiptData });
    const pdfDoc = pdf(ReceiptElement as React.ReactElement<DocumentProps>);

    // Convert to buffer
    const blob = await pdfDoc.toBlob();
    const arrayBuffer = await blob.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    // Upload PDF to Supabase Storage
    const fileName = `${receiptNumber}.pdf`;
    const filePath = `${company_id}/receipts/${fileName}`;

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

    // Store the file path (not public URL) since bucket is private
    // We'll generate signed URLs when needed for viewing/downloading
    const pdfUrl = filePath;

    // Update payment record with receipt details
    const { data: updatedPayment, error: updateError } = await supabase
      .from('payments_data')
      .update({
        receipt_number: receiptNumber,
        pdf_url: pdfUrl,
        receipt_generated_at: new Date().toISOString(),
      })
      .eq('id', payment_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating payment:', updateError);
      return NextResponse.json(
        { error: `Failed to update payment: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      receipt: {
        receipt_number: receiptNumber,
        pdf_url: pdfUrl,
        receipt_generated_at: updatedPayment.receipt_generated_at,
      },
    });
  } catch (error: any) {
    console.error('API Error generating receipt:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while generating receipt' },
      { status: 500 }
    );
  }
}


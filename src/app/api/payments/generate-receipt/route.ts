import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { pdf, DocumentProps } from '@react-pdf/renderer';
import { ReceiptTemplate } from '@/components/ReceiptTemplate';

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

    // Fetch company details with all required fields for receipt
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('name, company_address, company_phone1, company_phone2, company_email, gst_no')
      .eq('id', company_id)
      .single();

    if (companyError || !company) {
      console.error('Error fetching company:', companyError);
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
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

    // Prepare receipt data with company details from database
    const receiptData = {
      receiptNumber,
      receiptDate: payment.receipt_generated_at || payment.created_at || new Date().toISOString(),
      companyName: company.name || 'Company Name',
      companyAddress: company.company_address || '',
      companyPhone1: company.company_phone1 || '',
      companyPhone2: company.company_phone2 || '',
      companyEmail: company.company_email || '',
      gstNo: company.gst_no || '',
      customerName: workOrder.customer_name || 'N/A',
      amount: parseFloat(payment.amount) || 0,
      paymentMethod: payment.payment_method || 'bank_transfer',
      bankName: payment.bank_name || '',
      chequeNo: payment.cheque_no || '',
      status: payment.status || 'Completed',
      orderValue: orderAmount ?? 0,
      totalReceived: totalPaid ?? 0,
      balanceAmount: pendingAmount ?? 0,
    };

    // Guard: Ensure data is valid before PDF generation
    if (!receiptData || !receiptData.receiptNumber) {
      throw new Error('Receipt data missing');
    }

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
  } catch (error: unknown) {
    console.error('API Error generating receipt:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred while generating receipt' },
      { status: 500 }
    );
  }
}


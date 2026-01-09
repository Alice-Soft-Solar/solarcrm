import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, hasRole } from '@/lib/supabase-server';
import React from 'react';
import { pdf, DocumentProps } from '@react-pdf/renderer';
import { ReceiptTemplate } from '@/components/ReceiptTemplate';
import { notifyPaymentReceipt } from '@/utils/whatsapp-notifier';

/**
 * API Route: Generate Payment Receipt
 * 
 * Security: RLS enforced + Server-side verification
 * - Uses authenticated client with RLS enforcement for data fetching
 * - Service client used ONLY for storage upload (bucket permissions)
 * - RLS ensures payment belongs to user's company
 */

export async function POST(request: NextRequest) {
  try {
    // Step 1: Create authenticated Supabase client
    const supabase = await createServerClient(request);

    // Step 2: Verify user and get verified profile/role
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Step 3: Check authorization
    const allowedRoles = ['Admin', 'Super Admin', 'Accounts'];
    if (!hasRole(roleName, allowedRoles)) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not have permission to generate receipts' },
        { status: 403 }
      );
    }

    // Step 4: Parse request body
    const body = await request.json();
    const { payment_id } = body;

    if (!payment_id) {
      return NextResponse.json(
        { error: 'Missing required field: payment_id' },
        { status: 400 }
      );
    }

    // Step 5: Fetch payment details with RLS enforcement
    const { data: payment, error: paymentError } = await supabase
      .from('payments_data')
      .select('*')
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json(
        { error: 'Payment not found or does not belong to your company' },
        { status: 404 }
      );
    }

    // Step 6: Fetch work order details with RLS enforcement
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

    // Step 7: Fetch company details with RLS enforcement
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('name, company_address, company_phone1, company_phone2, company_email, gst_no')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      console.error('Error fetching company:', companyError);
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Step 8: Get all payments for this work order with RLS enforcement
    const { data: allPayments, error: allPaymentsError } = await supabase
      .from('payments_data')
      .select('amount')
      .eq('work_order_id', payment.work_order_id);

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

    // Step 9: Generate receipt number if not exists
    let receiptNumber = payment.receipt_number;
    if (!receiptNumber) {
      const currentYear = new Date().getFullYear();
      const prefix = `REC-${currentYear}-`;

      // Get the last receipt number for this year with RLS enforcement
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

    // Step 10: Prepare receipt data
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
      chequeNo: payment.cheque_number || '',
      status: payment.status || 'Completed',
      orderValue: orderAmount ?? 0,
      totalReceived: totalPaid ?? 0,
      balanceAmount: pendingAmount ?? 0,
    };

    if (!receiptData || !receiptData.receiptNumber) {
      throw new Error('Receipt data missing');
    }

    // Step 11: Generate PDF
    const ReceiptElement = React.createElement(ReceiptTemplate, { data: receiptData });
    const pdfDoc = pdf(ReceiptElement as React.ReactElement<DocumentProps>);

    const blob = await pdfDoc.toBlob();
    const arrayBuffer = await blob.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    // Step 12: Upload PDF to storage (requires service client for bucket access)
    const fileName = `${receiptNumber}.pdf`;
    const filePath = `${companyId}/receipts/${fileName}`;

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

    const pdfUrl = filePath;

    // Step 13: Update payment record with RLS enforcement
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

    // ⭐ Integrated WhatsApp Receipt Sharing
    // Fire-and-forget notification to avoid delaying the response
    (async () => {
      try {
        await notifyPaymentReceipt(
          workOrder as any, // Cast to ExtendedWorkOrder
          receiptNumber,
          pdfUrl,
          supabase
        );
      } catch (err) {
        console.error('[WhatsApp Notification Error]:', err);
      }
    })();

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
    
    if (error instanceof Error && error.message?.includes('Unauthorized')) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred while generating receipt' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppMessage, formatPhoneNumber, isValidPhoneNumber } from '@/utils/whatsapp';

/**
 * API route for sending WhatsApp messages
 * POST /api/whatsapp/send
 * 
 * Body:
 * {
 *   "to": "phone_number",
 *   "body": "message content"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, body: messageBody } = body;

    // Validate required fields
    if (!to || !messageBody) {
      return NextResponse.json(
        { error: 'Missing required fields: to, body' },
        { status: 400 }
      );
    }

    // Validate phone number format
    if (!isValidPhoneNumber(to)) {
      return NextResponse.json(
        { error: `Invalid phone number format: ${to}. Please provide a valid phone number.` },
        { status: 400 }
      );
    }

    // Send WhatsApp message
    const result = await sendWhatsAppMessage({
      to,
      body: messageBody,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send WhatsApp message' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      formattedPhone: formatPhoneNumber(to),
    });
  } catch (error: unknown) {
    console.error('API Error sending WhatsApp message:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}


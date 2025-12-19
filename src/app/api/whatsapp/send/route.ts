import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppMessage, formatPhoneNumber, isValidPhoneNumber } from '@/utils/whatsapp';

/**
 * API route for sending WhatsApp messages
 * POST /api/whatsapp/send
 * 
 * WhatsApp is observational, not transactional.
 * This endpoint always returns 200 OK with outcome in body.
 * Provider errors are logged but never cause HTTP errors.
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

    // Validate required fields (input validation, not WhatsApp failure)
    if (!to || !messageBody) {
      return NextResponse.json(
        { 
          attempted: false,
          delivered: false,
          reason: 'Missing required fields: to, body',
          error: 'Missing required fields: to, body'
        },
        { status: 400 }
      );
    }

    // Validate phone number format (input validation, not WhatsApp failure)
    if (!isValidPhoneNumber(to)) {
      return NextResponse.json(
        { 
          attempted: false,
          delivered: false,
          reason: `Invalid phone number format: ${to}`,
          error: `Invalid phone number format: ${to}. Please provide a valid phone number.`
        },
        { status: 400 }
      );
    }

    const formattedPhone = formatPhoneNumber(to);

    // Attempt to send WhatsApp message (best-effort, non-blocking)
    const result = await sendWhatsAppMessage({
      to,
      body: messageBody,
    });

    // Log outcome for observability
    if (result.success) {
      console.log('[WhatsApp API] Message sent successfully:', {
        to: formattedPhone.substring(0, 4) + '****',
        messageId: result.messageId,
      });
    } else {
      // Log provider-side failures (expected behavior, not errors)
      console.warn('[WhatsApp API] Provider returned failure (expected):', {
        to: formattedPhone.substring(0, 4) + '****',
        reason: result.error,
        note: 'This is observational - provider state is volatile',
      });
    }

    // Always return 200 OK - WhatsApp outcome is in response body
    // Never treat WhatsApp provider failures as HTTP errors
    return NextResponse.json({
      attempted: true,
      delivered: result.success,
      formattedPhone: formattedPhone,
      messageId: result.messageId || null,
      reason: result.success ? 'Message sent to provider' : (result.error || 'Unknown provider response'),
      // Include error for debugging, but don't treat as HTTP error
      ...(result.error && { providerError: result.error }),
    }, { status: 200 });

  } catch (error: unknown) {
    // Only log unexpected system errors (not WhatsApp provider errors)
    console.error('[WhatsApp API] Unexpected system error (not provider error):', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    
    // Return 200 OK even for system errors - WhatsApp is best-effort
    return NextResponse.json({
      attempted: false,
      delivered: false,
      reason: 'System error prevented attempt',
      error: errorMessage,
    }, { status: 200 });
  }
}


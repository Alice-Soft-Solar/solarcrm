/**
 * WhatsApp messaging utility using Whapi.Cloud API
 * Handles sending text messages to customers via WhatsApp
 */

export interface WhatsAppMessageParams {
  to: string; // Phone number or Chat ID (pattern: ^[\d-]{9,31}(@[\w\.]{1,})?$)
  body: string; // Message text content
  quoted?: string; // Message ID to quote/reply to
  edit?: string; // Message ID to edit
  typing_time?: number; // Time in seconds to simulate typing (0-60)
  no_link_preview?: boolean; // Set true to send link without preview
  wide_link_preview?: boolean; // Set true for fullwidth link preview
  mentions?: string[]; // Array of phone numbers to mention in group messages
}

export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Formats phone number according to Whapi.Cloud API specification
 * Pattern: ^[\d-]{9,31}(@[\w\.]{1,})?$
 * - 9-31 digits (with optional dashes)
 * - Optionally followed by @domain (e.g., @s.whatsapp.net)
 * 
 * @param phone - Phone number in any format
 * @returns Formatted phone number (e.g., "919876543210" or "919876543210@s.whatsapp.net")
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters except dashes and @
  let cleaned = phone.replace(/[^\d-@]/g, '');
  
  // If it already has @domain, return as-is (already formatted)
  if (cleaned.includes('@')) {
    return cleaned;
  }
  
  // Remove dashes for processing
  let digitsOnly = cleaned.replace(/-/g, '');
  
  // If it starts with 0, remove it
  if (digitsOnly.startsWith('0')) {
    digitsOnly = digitsOnly.substring(1);
  }
  
  // If it doesn't start with country code, assume India (91)
  if (!digitsOnly.startsWith('91') && digitsOnly.length === 10) {
    digitsOnly = '91' + digitsOnly;
  }
  
  // Validate length (9-31 digits as per API spec)
  if (digitsOnly.length < 9 || digitsOnly.length > 31) {
    throw new Error(`Phone number length invalid: ${digitsOnly.length} digits (must be 9-31)`);
  }
  
  return digitsOnly;
}

/**
 * Validates phone number format according to Whapi.Cloud API spec
 * Pattern: ^[\d-]{9,31}(@[\w\.]{1,})?$
 * 
 * @param phone - Phone number to validate
 * @returns true if valid, false otherwise
 */
export function isValidPhoneNumber(phone: string): boolean {
  try {
    const formatted = formatPhoneNumber(phone);
    // Match API pattern: 9-31 digits/dashes, optionally followed by @domain
    return /^[\d-]{9,31}(@[\w\.]{1,})?$/.test(formatted);
  } catch {
    return false;
  }
}

/**
 * Sends a WhatsApp text message via Whapi.Cloud API
 * 
 * @param params - Message parameters (to, body)
 * @param apiToken - Whapi.Cloud API token (optional, will use env var if not provided)
 * @returns Promise with response data
 */
export async function sendWhatsAppMessage(
  params: WhatsAppMessageParams,
  apiToken?: string
): Promise<WhatsAppResponse> {
  const token = apiToken || process.env.WHAPI_CLOUD_API_TOKEN;
  
  if (!token) {
    return {
      success: false,
      error: 'WHAPI_CLOUD_API_TOKEN is not configured in environment variables',
    };
  }

  // Validate phone number
  if (!isValidPhoneNumber(params.to)) {
    return {
      success: false,
      error: `Invalid phone number format: ${params.to}`,
    };
  }

  // Format phone number
  const formattedPhone = formatPhoneNumber(params.to);

  // Validate message body
  if (!params.body || params.body.trim().length === 0) {
    return {
      success: false,
      error: 'Message body cannot be empty',
    };
  }

  try {
    // Prepare request body according to API specification
    const requestBody: {
      to: string;
      body: string;
      quoted?: string;
      edit?: string;
      typing_time?: number;
      no_link_preview?: boolean;
      wide_link_preview?: boolean;
      mentions?: string[];
    } = {
      to: formattedPhone,
      body: params.body.trim(),
    };

    // Add optional parameters if provided
    if (params.quoted) {
      requestBody.quoted = params.quoted;
    }
    if (params.edit) {
      requestBody.edit = params.edit;
    }
    if (params.typing_time !== undefined) {
      // Validate typing_time range (0-60 seconds)
      if (params.typing_time < 0 || params.typing_time > 60) {
        return {
          success: false,
          error: 'typing_time must be between 0 and 60 seconds',
        };
      }
      requestBody.typing_time = params.typing_time;
    }
    if (params.no_link_preview !== undefined) {
      requestBody.no_link_preview = params.no_link_preview;
    }
    if (params.wide_link_preview !== undefined) {
      requestBody.wide_link_preview = params.wide_link_preview;
    }
    if (params.mentions && params.mentions.length > 0) {
      requestBody.mentions = params.mentions;
    }

    // Log request for debugging (without sensitive data)
    if (process.env.NODE_ENV === 'development') {
      console.log('[WhatsApp API] Sending message to:', formattedPhone.substring(0, 4) + '****');
    }

    const response = await fetch('https://gate.whapi.cloud/messages/text', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    let data: any;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      throw new Error(`Unexpected response format: ${text}`);
    }

    if (!response.ok) {
      // Handle API error responses
      const errorMessage = data.error || data.message || data.detail || data.errors?.[0]?.message || `HTTP ${response.status}: ${response.statusText}`;
      
      // Log error for debugging
      if (process.env.NODE_ENV === 'development') {
        console.error('[WhatsApp API] Error response:', {
          status: response.status,
          statusText: response.statusText,
          data: data,
        });
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }

    // Extract message ID from response (API may return different field names)
    const messageId = data.id || data.message_id || data.messageId || data.messages?.[0]?.id || undefined;

    return {
      success: true,
      messageId: messageId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      success: false,
      error: `Failed to send WhatsApp message: ${errorMessage}`,
    };
  }
}


/**
 * Webhook Signature Verification
 *
 * Verifies webhooks from Coinbase using HMAC-SHA256 signature
 * Prevents replay attacks and ensures webhook authenticity
 *
 * Based on: https://docs.cdp.coinbase.com/onramp-&-offramp/webhooks#webhook-signature-verification
 */

import crypto from 'crypto';

interface SignatureComponents {
  timestamp: string;
  headerNames: string[];
  signature: string;
}

/**
 * Parse the X-Hook0-Signature header
 * Format: "t=1234567890,h=header1:header2,v1=signature_hash"
 */
function parseSignatureHeader(signatureHeader: string): SignatureComponents | null {
  try {
    const parts = signatureHeader.split(',');
    const components: Partial<SignatureComponents> = {
      headerNames: []
    };

    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key === 't') {
        components.timestamp = value;
      } else if (key === 'h') {
        components.headerNames = value ? value.split(':') : [];
      } else if (key === 'v1') {
        components.signature = value;
      }
    }

    if (!components.timestamp || !components.signature) {
      return null;
    }

    return components as SignatureComponents;
  } catch (error) {
    console.error('❌ [WEBHOOK] Error parsing signature header:', error);
    return null;
  }
}

/**
 * Construct the signed payload string
 * Format: timestamp + header_values + raw_body
 */
function constructSignedPayload(
  timestamp: string,
  headerNames: string[],
  headers: Record<string, string | string[] | undefined>,
  rawBody: string
): string {
  // Start with timestamp
  let payload = timestamp;

  // Append header values in order
  for (const headerName of headerNames) {
    const headerValue = headers[headerName.toLowerCase()];
    if (headerValue) {
      // Handle array or string
      const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
      payload += value;
    }
  }

  // Append raw body
  payload += rawBody;

  return payload;
}

/**
 * Verify webhook signature
 *
 * @param signatureHeader - X-Hook0-Signature header value
 * @param headers - All request headers
 * @param rawBody - Raw request body string
 * @param secret - Webhook signing secret from Coinbase
 * @param maxAge - Maximum age of webhook in seconds (default: 300 = 5 minutes)
 * @returns true if signature is valid, false otherwise
 */
export function verifyWebhookSignature(
  signatureHeader: string,
  headers: Record<string, string | string[] | undefined>,
  rawBody: string,
  secret: string,
  maxAge: number = 300
): boolean {
  try {
    // Parse signature header
    const components = parseSignatureHeader(signatureHeader);
    if (!components) {
      console.error('❌ [WEBHOOK] Invalid signature header format');
      return false;
    }

    // Check timestamp to prevent replay attacks
    const webhookTimestamp = parseInt(components.timestamp, 10);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const age = currentTimestamp - webhookTimestamp;

    if (age > maxAge) {
      console.error('❌ [WEBHOOK] Webhook too old:', {
        age,
        maxAge,
        webhookTime: new Date(webhookTimestamp * 1000).toISOString(),
        currentTime: new Date(currentTimestamp * 1000).toISOString()
      });
      return false;
    }

    if (age < -60) {
      console.error('❌ [WEBHOOK] Webhook timestamp is in the future');
      return false;
    }

    // Construct the signed payload
    const signedPayload = constructSignedPayload(
      components.timestamp,
      components.headerNames,
      headers,
      rawBody
    );

    // Compute HMAC-SHA256 signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    // Timing-safe comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(components.signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );

    if (!isValid) {
      console.error('❌ [WEBHOOK] Signature mismatch', {
        expected: expectedSignature,
        received: components.signature
      });
    }

    return isValid;
  } catch (error) {
    console.error('❌ [WEBHOOK] Signature verification error:', error);
    return false;
  }
}

/**
 * Fallback: Verify using x-coinbase-signature header (older format)
 * This is simpler: just HMAC(timestamp + body)
 */
export function verifyLegacySignature(
  signature: string,
  timestamp: string,
  rawBody: string,
  secret: string,
  maxAge: number = 300
): boolean {
  try {
    // Check timestamp
    const webhookTimestamp = parseInt(timestamp, 10);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const age = currentTimestamp - webhookTimestamp;

    if (age > maxAge || age < -60) {
      console.error('❌ [WEBHOOK] Legacy signature: timestamp invalid');
      return false;
    }

    // Compute HMAC: timestamp + body
    const payload = timestamp + rawBody;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // Timing-safe comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );

    return isValid;
  } catch (error) {
    console.error('❌ [WEBHOOK] Legacy signature verification error:', error);
    return false;
  }
}

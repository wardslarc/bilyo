import crypto from 'node:crypto';

export interface SvixHeaders {
  id?: string | null;
  timestamp?: string | null;
  signature?: string | null;
}

/**
 * Verifies Svix webhook signatures natively using node:crypto (EMAIL_DELIVERY_PLAN.md §5.4).
 * Enforces 5-minute replay prevention window and constant-time HMAC-SHA256 comparison.
 */
export function verifySvixSignature(
  rawBody: string,
  headers: SvixHeaders,
  secret?: string | null,
  maxAgeSeconds = 300
): { valid: boolean; error?: string } {
  if (!secret || typeof secret !== 'string') {
    return { valid: false, error: 'MISSING_SECRET' };
  }

  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) {
    return { valid: false, error: 'MISSING_HEADERS' };
  }

  // Check timestamp freshness (5 minutes default)
  const tsNumber = Number.parseInt(timestamp, 10);
  if (Number.isNaN(tsNumber)) {
    return { valid: false, error: 'INVALID_TIMESTAMP' };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - tsNumber) > maxAgeSeconds) {
    return { valid: false, error: 'STALE_TIMESTAMP' };
  }

  // Parse secret key: strip 'whsec_' prefix and decode base64
  let key: Buffer;
  try {
    const rawSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
    key = Buffer.from(rawSecret, 'base64');
  } catch {
    return { valid: false, error: 'INVALID_SECRET_FORMAT' };
  }

  const toSign = `${id}.${timestamp}.${rawBody}`;
  const computedSignature = crypto
    .createHmac('sha256', key)
    .update(toSign)
    .digest('base64');

  // svix-signature can contain multiple space-separated entries e.g. "v1,sig1 v1,sig2"
  const passedSignatures = signature.split(' ');
  for (const item of passedSignatures) {
    const parts = item.split(',');
    if (parts.length === 2 && parts[0] === 'v1') {
      const sig = parts[1];
      try {
        const sigBuf = Buffer.from(sig, 'base64');
        const compBuf = Buffer.from(computedSignature, 'base64');
        if (sigBuf.length === compBuf.length && crypto.timingSafeEqual(sigBuf, compBuf)) {
          return { valid: true };
        }
      } catch {
        // Fall through to next entry
      }
    }
  }

  return { valid: false, error: 'SIGNATURE_MISMATCH' };
}

import crypto from 'node:crypto';

export function getSigningSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.MFA_ENCRYPTION_KEY ||
    'bilyo-default-challenge-signing-secret-32-chars'
  );
}

/**
 * Creates an HMAC-SHA256 signed token from a JSON-serializable payload.
 * Format: `<base64url(payload)>.<hex(hmac)>`
 */
export function signSignedPayload<T extends object>(
  payload: T,
  secret: string = getSigningSecret()
): string {
  const jsonStr = JSON.stringify(payload);
  const base64 = Buffer.from(jsonStr, 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(base64)
    .digest('hex');

  return `${base64}.${signature}`;
}

/**
 * Verifies the HMAC-SHA256 signature of a token and parses its JSON payload.
 * Uses constant-time comparison to prevent timing attacks.
 * Returns null if the token format is invalid, signature mismatch, or parsing fails.
 */
export function verifySignedToken<T extends object>(
  token: string,
  secret: string = getSigningSecret()
): T | null {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [base64, signature] = parts;
  if (!/^[0-9a-fA-F]{64}$/.test(signature)) {
    return null;
  }

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(base64)
    .digest('hex');

  const sigBuf = Buffer.from(signature, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const jsonStr = Buffer.from(base64, 'base64url').toString('utf8');
    return JSON.parse(jsonStr) as T;
  } catch {
    return null;
  }
}

import crypto from 'node:crypto';

async function getCookieStore() {
  const { cookies } = await import('next/headers');
  return cookies();
}

export const MFA_CHALLENGE_COOKIE_NAME = 'mfa_challenge';
export const MFA_CHALLENGE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes (§8.10)
export const MAX_CHALLENGE_ATTEMPTS = 5;

export interface MfaChallengePayload {
  userId: string;
  email: string;
  nonce: string;
  expiresAt: number;
  attempts: number;
}

function getSigningSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.MFA_ENCRYPTION_KEY ||
    'bilyo-default-challenge-signing-secret-32-chars'
  );
}

/**
 * Creates a signed token for the MFA challenge.
 */
export function signChallengePayload(payload: MfaChallengePayload): string {
  const jsonStr = JSON.stringify(payload);
  const base64 = Buffer.from(jsonStr, 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSigningSecret())
    .update(base64)
    .digest('hex');

  return `${base64}.${signature}`;
}

/**
 * Verifies the signature and expiration of an MFA challenge token.
 * Returns the payload if valid and unexpired; null otherwise.
 */
export function verifyChallengeToken(token: string): MfaChallengePayload | null {
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
    .createHmac('sha256', getSigningSecret())
    .update(base64)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  const sigBuf = Buffer.from(signature, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const jsonStr = Buffer.from(base64, 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr) as MfaChallengePayload;

    if (!payload.userId || !payload.expiresAt || !payload.nonce) {
      return null;
    }

    if (Date.now() > payload.expiresAt) {
      return null; // Expired
    }

    if (payload.attempts >= MAX_CHALLENGE_ATTEMPTS) {
      return null; // Exceeded attempt budget
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Sets the signed MFA challenge cookie.
 */
export async function setMfaChallengeCookie(userId: string, email: string): Promise<string> {
  const cookieStore = await getCookieStore();
  const payload: MfaChallengePayload = {
    userId,
    email,
    nonce: crypto.randomBytes(16).toString('hex'),
    expiresAt: Date.now() + MFA_CHALLENGE_EXPIRY_MS,
    attempts: 0,
  };

  const token = signChallengePayload(payload);

  cookieStore.set(MFA_CHALLENGE_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 300, // 5 minutes
  });

  return token;
}

/**
 * Retrieves and verifies the MFA challenge payload from request cookies.
 */
export async function getMfaChallengeFromCookies(): Promise<MfaChallengePayload | null> {
  const cookieStore = await getCookieStore();
  const cookie = cookieStore.get(MFA_CHALLENGE_COOKIE_NAME);
  if (!cookie?.value) {
    return null;
  }

  return verifyChallengeToken(cookie.value);
}

/**
 * Increments the attempt counter on the challenge cookie.
 * If 5 wrong codes occur, destroys the challenge and returns null (§8.10).
 */
export async function incrementMfaChallengeAttempts(): Promise<{
  destroyed: boolean;
  remainingAttempts: number;
}> {
  const cookieStore = await getCookieStore();
  const current = await getMfaChallengeFromCookies();

  if (!current) {
    cookieStore.delete(MFA_CHALLENGE_COOKIE_NAME);
    return { destroyed: true, remainingAttempts: 0 };
  }

  const nextAttempts = current.attempts + 1;
  if (nextAttempts >= MAX_CHALLENGE_ATTEMPTS) {
    cookieStore.delete(MFA_CHALLENGE_COOKIE_NAME);
    return { destroyed: true, remainingAttempts: 0 };
  }

  const updatedPayload: MfaChallengePayload = {
    ...current,
    attempts: nextAttempts,
  };

  const newToken = signChallengePayload(updatedPayload);
  const remainingSeconds = Math.max(1, Math.floor((current.expiresAt - Date.now()) / 1000));

  cookieStore.set(MFA_CHALLENGE_COOKIE_NAME, newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: remainingSeconds,
  });

  return {
    destroyed: false,
    remainingAttempts: MAX_CHALLENGE_ATTEMPTS - nextAttempts,
  };
}

/**
 * Clears the MFA challenge cookie.
 */
export async function clearMfaChallengeCookie(): Promise<void> {
  const cookieStore = await getCookieStore();
  cookieStore.delete(MFA_CHALLENGE_COOKIE_NAME);
}

export interface MfaSessionTokenPayload {
  userId: string;
  mfaVerifiedAt: string;
  expiresAt: number;
}

/**
 * Signs a short-lived (60s) session token after successful TOTP/recovery verification.
 * Used exclusively by Auth.js credentials provider to issue the authenticated session with mfaVerifiedAt.
 */
export function signMfaSessionToken(userId: string, mfaVerifiedAt: string): string {
  const payload: MfaSessionTokenPayload = {
    userId,
    mfaVerifiedAt,
    expiresAt: Date.now() + 60 * 1000,
  };

  const jsonStr = JSON.stringify(payload);
  const base64 = Buffer.from(jsonStr, 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSigningSecret())
    .update(base64)
    .digest('hex');

  return `${base64}.${signature}`;
}

/**
 * Verifies a short-lived mfaSessionToken.
 */
export function verifyMfaSessionToken(token: string): MfaSessionTokenPayload | null {
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
    .createHmac('sha256', getSigningSecret())
    .update(base64)
    .digest('hex');

  const sigBuf = Buffer.from(signature, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const jsonStr = Buffer.from(base64, 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr) as MfaSessionTokenPayload;

    if (!payload.userId || !payload.mfaVerifiedAt || !payload.expiresAt) {
      return null;
    }

    if (Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}


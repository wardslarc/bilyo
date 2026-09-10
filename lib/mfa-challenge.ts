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

import { signSignedPayload, verifySignedToken } from './signed-token.ts';

/**
 * Creates a signed token for the MFA challenge.
 */
export function signChallengePayload(payload: MfaChallengePayload): string {
  return signSignedPayload(payload as unknown as Record<string, unknown>);
}

/**
 * Verifies the signature and expiration of an MFA challenge token.
 * Returns the payload if valid and unexpired; null otherwise.
 */
export function verifyChallengeToken(token: string): MfaChallengePayload | null {
  const payload = verifySignedToken<MfaChallengePayload>(token);
  if (!payload) {
    return null;
  }

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
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes (§8.10)
  };

  return signSignedPayload(payload as unknown as Record<string, unknown>);
}

/**
 * Verifies a short-lived mfaSessionToken.
 */
export function verifyMfaSessionToken(token: string): MfaSessionTokenPayload | null {
  const payload = verifySignedToken<MfaSessionTokenPayload>(token);
  if (!payload) {
    return null;
  }

  if (!payload.userId || !payload.mfaVerifiedAt || !payload.expiresAt) {
    return null;
  }

  if (Date.now() > payload.expiresAt) {
    return null;
  }

  return payload;
}


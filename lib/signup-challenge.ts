import crypto from 'node:crypto';
import { signSignedPayload, verifySignedToken } from './signed-token.ts';

export const SIGNUP_CHALLENGE_COOKIE_NAME = 'signup_challenge';
export const SIGNUP_CHALLENGE_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes (matches code expiry)

export interface SignupChallengePayload {
  userId: string;
  email: string;
  nonce: string;
  expiresAt: number;
}

async function getCookieStore() {
  try {
    const { cookies } = await import('next/headers');
    return await cookies();
  } catch {
    return null;
  }
}

/**
 * Sets the signed signup challenge cookie identifying the pending account (§4.3).
 * Contains no authority; only names the account whose verification code is being checked.
 */
export async function setSignupChallengeCookie(userId: string, email: string): Promise<string> {
  const payload: SignupChallengePayload = {
    userId,
    email,
    nonce: crypto.randomBytes(16).toString('hex'),
    expiresAt: Date.now() + SIGNUP_CHALLENGE_EXPIRY_MS,
  };

  const token = signSignedPayload(payload);
  const cookieStore = await getCookieStore();

  if (cookieStore) {
    cookieStore.set(SIGNUP_CHALLENGE_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(SIGNUP_CHALLENGE_EXPIRY_MS / 1000), // 900 seconds
    });
  }

  return token;
}

/**
 * Retrieves and verifies the signup challenge payload from request cookies.
 */
export async function getSignupChallengeFromCookies(): Promise<SignupChallengePayload | null> {
  const cookieStore = await getCookieStore();
  if (!cookieStore) {
    return null;
  }

  const cookie = cookieStore.get(SIGNUP_CHALLENGE_COOKIE_NAME);
  if (!cookie?.value) {
    return null;
  }

  const payload = verifySignedToken<SignupChallengePayload>(cookie.value);
  if (!payload) {
    return null;
  }

  if (!payload.userId || !payload.email || !payload.nonce || !payload.expiresAt) {
    return null;
  }

  if (Date.now() > payload.expiresAt) {
    return null;
  }

  return payload;
}

/**
 * Clears the signup challenge cookie.
 */
export async function clearSignupChallengeCookie(): Promise<void> {
  const cookieStore = await getCookieStore();
  if (cookieStore) {
    cookieStore.delete(SIGNUP_CHALLENGE_COOKIE_NAME);
  }
}

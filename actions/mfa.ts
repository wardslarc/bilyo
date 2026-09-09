'use server';

import qrcode from 'qrcode';
import bcrypt from 'bcryptjs';
import dbConnect from '../lib/mongodb.ts';
import { User } from '../models/user.ts';
import { requireUser } from '../lib/auth-guards.ts';
import {
  generateSecret,
  buildOtpauthUri,
  verifyCode,
  generateRecoveryCodes,
  consumeRecoveryCode,
} from '../lib/mfa.ts';
import { encrypt, decrypt } from '../lib/crypto.ts';
import {
  setMfaChallengeCookie,
  getMfaChallengeFromCookies,
  incrementMfaChallengeAttempts,
  clearMfaChallengeCookie,
  signMfaSessionToken,
} from '../lib/mfa-challenge.ts';
import { loginSchema } from '../lib/validation/auth.ts';
import type { ActionResult } from '@/types';

// Cost-10 dummy hash for timing protection on unknown email
const DUMMY_HASH = '$2a$10$6iTTYhZTDeaLrFMbocue6.gz2JAFZ6MDEmHW6mdSWBrO5tKKowGoS';

/**
 * Step 1 of login: verifies email and password (§8.10).
 * If MFA is enabled, sets the signed 5-minute mfa_challenge cookie and returns requiresMfa: true.
 * If MFA is not enabled, returns requiresMfa: false so the client can establish the session directly.
 */
export async function verifyPasswordStep(
  input: unknown
): Promise<ActionResult<{ requiresMfa: boolean }>> {
  const parseResult = loginSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: 'Please enter a valid email and password',
    };
  }

  const { email, password } = parseResult.data;

  try {
    await dbConnect();
    const user = await User.findOne({ email });

    if (!user || !user.passwordHash) {
      await bcrypt.compare(password, DUMMY_HASH);
      return { ok: false, error: 'Invalid email or password' };
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return { ok: false, error: 'Invalid email or password' };
    }

    // Check account suspension (§5.8)
    if (user.suspendedAt || user.deletionRequestedAt) {
      return {
        ok: false,
        error: 'Your account is suspended. Please contact support at support@bilyoapp.com',
      };
    }

    // Check rate limit lock (§5.11 rule 8)
    if (user.mfaLockedUntil && user.mfaLockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.mfaLockedUntil.getTime() - Date.now()) / 60000);
      return {
        ok: false,
        error: `Account is temporarily locked due to repeated failed sign-in attempts. Please try again in ${minutesLeft} minute(s).`,
      };
    }

    // Check if MFA is enabled
    if (user.mfaEnabledAt && user.mfaSecretEncrypted) {
      await setMfaChallengeCookie(user._id.toString(), user.email);
      return {
        ok: true,
        data: { requiresMfa: true },
      };
    }

    return {
      ok: true,
      data: { requiresMfa: false },
    };
  } catch (error) {
    console.error('Password verification error:', (error as Error).message);
    return {
      ok: false,
      error: 'An unexpected error occurred during sign-in. Please try again.',
    };
  }
}

/**
 * Step 2 of login: verifies TOTP code or recovery code against the active challenge cookie (§8.10).
 */
export async function verifyMfaChallenge(input: {
  code?: string;
  recoveryCode?: string;
}): Promise<
  ActionResult<{
    userId: string;
    email: string;
    mfaVerifiedAt: string;
    mfaSessionToken: string;
    remainingRecoveryCodes?: number;
  }>
> {
  const challenge = await getMfaChallengeFromCookies();
  if (!challenge) {
    return {
      ok: false,
      error: 'Your sign-in challenge has expired or exceeded maximum attempts. Please sign in again.',
    };
  }

  try {
    await dbConnect();
    const user = await User.findById(challenge.userId);
    if (!user) {
      await clearMfaChallengeCookie();
      return { ok: false, error: 'User not found. Please sign in again.' };
    }

    if (user.mfaLockedUntil && user.mfaLockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.mfaLockedUntil.getTime() - Date.now()) / 60000);
      return {
        ok: false,
        error: `Sign-in is temporarily locked. Please try again in ${minutesLeft} minute(s).`,
      };
    }

    // Verification branch A: TOTP 6-digit code
    if (input.code) {
      const cleanCode = input.code.trim();
      if (!/^\d{6}$/.test(cleanCode) || !user.mfaSecretEncrypted) {
        return handleFailedAttempt(user);
      }

      let secret: string;
      try {
        secret = decrypt(user.mfaSecretEncrypted);
      } catch {
        return { ok: false, error: 'Corrupted MFA secret. Please contact support.' };
      }

      const acceptedStep = verifyCode(secret, cleanCode, user.mfaLastUsedStep);
      if (acceptedStep === null) {
        return handleFailedAttempt(user);
      }

      // Successful TOTP verification
      user.mfaLastUsedStep = acceptedStep;
      user.mfaFailedAttempts = 0;
      user.mfaLockedUntil = null;
      await user.save();

      await clearMfaChallengeCookie();

      const mfaVerifiedAt = new Date().toISOString();
      const mfaSessionToken = signMfaSessionToken(user._id.toString(), mfaVerifiedAt);

      return {
        ok: true,
        data: {
          userId: user._id.toString(),
          email: user.email,
          mfaVerifiedAt,
          mfaSessionToken,
        },
      };
    }

    // Verification branch B: Recovery code
    if (input.recoveryCode) {
      const cleanRecovery = input.recoveryCode.trim().toLowerCase();
      const hashes = user.mfaRecoveryCodeHashes || [];

      const { valid, remainingHashedCodes } = await consumeRecoveryCode(cleanRecovery, hashes);
      if (!valid) {
        return handleFailedAttempt(user);
      }

      // Successful recovery code consumption
      user.mfaRecoveryCodeHashes = remainingHashedCodes;
      user.mfaFailedAttempts = 0;
      user.mfaLockedUntil = null;
      await user.save();

      await clearMfaChallengeCookie();

      const mfaVerifiedAt = new Date().toISOString();
      const mfaSessionToken = signMfaSessionToken(user._id.toString(), mfaVerifiedAt);

      return {
        ok: true,
        data: {
          userId: user._id.toString(),
          email: user.email,
          mfaVerifiedAt,
          mfaSessionToken,
          remainingRecoveryCodes: remainingHashedCodes.length,
        },
      };
    }

    return { ok: false, error: 'Please enter a 6-digit verification code or recovery code.' };
  } catch (error) {
    console.error('MFA challenge verification error:', (error as Error).message);
    return {
      ok: false,
      error: 'An unexpected error occurred while verifying your code. Please try again.',
    };
  }
}

async function handleFailedAttempt(user: InstanceType<typeof User>) {
  const { destroyed, remainingAttempts } = await incrementMfaChallengeAttempts();

  user.mfaFailedAttempts = (user.mfaFailedAttempts || 0) + 1;
  // 10 failures in 1 hr locks sign-in for 15 minutes (§5.11 rule 8)
  if (user.mfaFailedAttempts >= 10) {
    user.mfaLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
  }
  await user.save();

  if (destroyed) {
    return {
      ok: false as const,
      error: 'Too many incorrect attempts (5/5). Your sign-in challenge was reset. Please sign in again.',
    };
  }

  return {
    ok: false as const,
    error: `Invalid verification code. ${remainingAttempts} attempt(s) remaining before sign-in resets.`,
  };
}

/**
 * Phase 1 of MFA enrolment (§8.9):
 * Generates base32 secret, encrypts at rest as pending (15 min expiry),
 * and renders server-side QR data URL (zero secrets leave server).
 */
export async function initiateMfaEnrolment(): Promise<
  ActionResult<{
    qrDataUrl: string;
    secretBase32: string;
    alreadyEnrolled?: boolean;
    mfaSessionToken?: string;
  }>
> {
  try {
    const sessionUser = await requireUser();
    await dbConnect();
    const user = await User.findById(sessionUser.id);
    if (!user) {
      return { ok: false, error: 'User not found' };
    }

    // If already enrolled in MFA, do not overwrite active secret.
    // Return single-use session token so client can refresh its session and enter dashboard.
    if (user.mfaEnabledAt && user.mfaSecretEncrypted) {
      const mfaVerifiedAt = new Date().toISOString();
      const mfaSessionToken = signMfaSessionToken(user._id.toString(), mfaVerifiedAt);
      return {
        ok: true,
        data: {
          qrDataUrl: '',
          secretBase32: '',
          alreadyEnrolled: true,
          mfaSessionToken,
        },
      };
    }

    const secret = generateSecret();
    const encryptedSecret = encrypt(secret);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15-minute expiry

    user.mfaPendingSecretEncrypted = encryptedSecret;
    user.mfaPendingExpiresAt = expiresAt;
    await user.save();

    const uri = buildOtpauthUri(user.email, secret);
    const qrDataUrl = await qrcode.toDataURL(uri, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 256,
    });

    return {
      ok: true,
      data: {
        qrDataUrl,
        secretBase32: secret,
      },
    };
  } catch (error) {
    console.error('Initiate MFA enrolment error:', (error as Error).message);
    return {
      ok: false,
      error: 'Failed to initiate MFA setup. Please check your session or try again.',
    };
  }
}

/**
 * Phase 2 of MFA enrolment (§8.9):
 * Confirms code against pending secret, promotes to active mfaSecretEncrypted,
 * sets mfaEnabledAt, and generates 10 single-use recovery codes.
 * Issues single-use mfaSessionToken to upgrade user session to mfaEnabled: true.
 */
export async function confirmMfaEnrolment(
  code: string
): Promise<ActionResult<{ recoveryCodes: string[]; mfaSessionToken: string }>> {
  if (!code || !/^\d{6}$/.test(code.trim())) {
    return { ok: false, error: 'Please enter a valid 6-digit code' };
  }

  try {
    const sessionUser = await requireUser();
    await dbConnect();
    const user = await User.findById(sessionUser.id);
    if (!user) {
      return { ok: false, error: 'User not found' };
    }

    if (!user.mfaPendingSecretEncrypted || !user.mfaPendingExpiresAt) {
      return { ok: false, error: 'No pending MFA setup found. Please restart enrolment.' };
    }

    if (user.mfaPendingExpiresAt < new Date()) {
      return { ok: false, error: 'MFA setup session expired (15 min). Please start over.' };
    }

    const secret = decrypt(user.mfaPendingSecretEncrypted);
    const acceptedStep = verifyCode(secret, code.trim());

    if (acceptedStep === null) {
      return {
        ok: false,
        error: 'Invalid code. Please ensure your device clock is synchronized and try again.',
      };
    }

    // Generate 10 single-use recovery codes
    const { plainCodes, hashedCodes } = await generateRecoveryCodes();

    // Promote pending secret to active
    user.mfaSecretEncrypted = user.mfaPendingSecretEncrypted;
    user.mfaPendingSecretEncrypted = null;
    user.mfaPendingExpiresAt = null;
    user.mfaEnabledAt = new Date();
    user.mfaLastUsedStep = acceptedStep;
    user.mfaRecoveryCodeHashes = hashedCodes;
    user.mfaFailedAttempts = 0;
    user.mfaLockedUntil = null;

    await user.save();

    // Issue mfaSessionToken so client can establish authenticated session with mfaEnabled: true
    const mfaVerifiedAt = new Date().toISOString();
    const mfaSessionToken = signMfaSessionToken(user._id.toString(), mfaVerifiedAt);

    return {
      ok: true,
      data: {
        recoveryCodes: plainCodes,
        mfaSessionToken,
      },
    };
  } catch (error) {
    console.error('Confirm MFA enrolment error:', (error as Error).message);
    return {
      ok: false,
      error: 'An unexpected error occurred while confirming MFA setup.',
    };
  }
}

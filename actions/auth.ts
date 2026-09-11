'use server';

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import dbConnect from '../lib/mongodb.ts';
import { User } from '../models/user.ts';
import { PasswordResetToken } from '../models/password-reset-token.ts';
import { VerificationToken } from '../models/verification-token.ts';
import { isDisposableDomain } from '../lib/email/disposable-domains.ts';
import { domainAcceptsMail } from '../lib/email/dns-check.ts';
import {
  setSignupChallengeCookie,
  getSignupChallengeFromCookies,
  clearSignupChallengeCookie,
  signSignupSessionToken,
} from '../lib/signup-challenge.ts';
import { renderEmailVerificationEmail } from '../lib/email/templates/email-verification.ts';
import { sendEmail } from '../lib/email/send.ts';
import {
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../lib/validation/auth.ts';
import { getClientIp, enforceRateLimits } from '../lib/rate-limit.ts';
import type { ActionResult } from '@/types';

/**
 * Issues a 6-digit code and 32-byte magic link token for email verification (SIGNUP_VERIFICATION_PLAN.md §4.3).
 * Code expires in 15 minutes; link expires in 24 hours.
 */
export async function issueVerificationCredential(user: {
  _id: import('mongoose').Types.ObjectId | string;
  name: string;
  email: string;
}): Promise<void> {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const codeHash = await bcrypt.hash(code, 10);

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  const codeExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15m

  await VerificationToken.create({
    userId: user._id,
    purpose: 'EMAIL_VERIFY',
    tokenHash,
    codeHash,
    expiresAt,
    codeExpiresAt,
    attempts: 0,
  });

  await User.updateOne(
    { _id: user._id },
    {
      $set: { emailVerificationSentAt: new Date() },
      $inc: { emailVerificationSends: 1 },
    }
  );

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const verifyUrl = `${appUrl}/verify-email/${token}`;

  try {
    const { subject, html, text } = renderEmailVerificationEmail({
      userName: user.name,
      code,
      verifyUrl,
    });

    const sendRes = await sendEmail({
      userId: user._id,
      kind: 'EMAIL_VERIFICATION',
      toEmail: user.email,
      idempotencyKey: `email-verify:${tokenHash}`,
      subject,
      html,
      text,
    });

    if (process.env.NODE_ENV !== 'production' && sendRes.ok && sendRes.skipped) {
      console.log(`[DEV EMAIL VERIFICATION] To: ${user.email} | Code: ${code} | Link: ${verifyUrl}`);
    }
  } catch (err) {
    console.error('[actions/auth] Verification email dispatch error:', err);
  }
}

/**
 * Server Action for User Registration (§8.1, M1-T02).
 * Validates with Zod, checks disposable blocklist (Gate 2), checks DNS MX (Gate 3),
 * checks email uniqueness, hashes with bcrypt cost 10, creates user with emailVerifiedAt: null,
 * issues verification credential, sets signup challenge cookie.
 */
export async function registerUser(
  input: unknown
): Promise<ActionResult<{ userId: string; pendingVerification?: boolean }>> {
  const parseResult = registerSchema.safeParse(input);

  if (!parseResult.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parseResult.error.issues) {
      const key = issue.path[0];
      if (key && !fieldErrors[String(key)]) {
        fieldErrors[String(key)] = issue.message;
      }
    }
    return {
      ok: false,
      error: 'Please fix the errors in the form',
      fieldErrors,
    };
  }

  const { name, email, password } = parseResult.data;

  // Gate 2: Disposable-domain blocklist (§4.1)
  if (isDisposableDomain(email)) {
    return {
      ok: false,
      error: 'Disposable email addresses are not accepted. Please use a permanent email address.',
      fieldErrors: {
        email: 'Disposable email addresses are not accepted',
      },
    };
  }

  // Gate 3: DNS MX lookup on domain (§4.2)
  const mxVerdict = await domainAcceptsMail(email);
  if (mxVerdict === 'NO_MX') {
    return {
      ok: false,
      error: 'We cannot find this email domain. Please check for typos.',
      fieldErrors: {
        email: 'We cannot find this email domain. Please check for typos.',
      },
    };
  }

  try {
    const ip = await getClientIp();
    const rateCheck = await enforceRateLimits([
      {
        key: `rate:register:ip:${ip}`,
        limit: 5,
        windowSeconds: 3600,
        errorMessage: 'Too many registration attempts from this network. Please try again later.',
      },
      {
        key: `rate:register:email:${email}`,
        limit: 3,
        windowSeconds: 3600,
        errorMessage: 'Too many registration attempts for this email address. Please try again later.',
      },
    ]);

    if (!rateCheck.allowed) {
      return {
        ok: false,
        error: rateCheck.error || 'Too many registration attempts. Please try again later.',
      };
    }

    await dbConnect();

    // Check email uniqueness (lowercased)
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return {
        ok: false,
        error: 'An account with this email already exists',
        fieldErrors: {
          email: 'An account with this email already exists',
        },
      };
    }

    // Bcrypt cost 10 (§11 M1-T02)
    const passwordHash = await bcrypt.hash(password, 10);

    if (!passwordHash.startsWith('$2')) {
      throw new Error('Failed to generate valid bcrypt hash');
    }

    // Create user with emailVerifiedAt: null (Gate 4 pending)
    const newUser = await User.create({
      name,
      email,
      passwordHash,
      role: 'USER',
      emailVerifiedAt: null,
    });

    // Issue verification code + magic link
    await issueVerificationCredential({
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
    });

    // Set signed signup challenge cookie for /verify-email
    await setSignupChallengeCookie(newUser._id.toString(), newUser.email);

    return {
      ok: true,
      data: {
        userId: newUser._id.toString(),
        pendingVerification: true,
      },
    };
  } catch (error) {
    // Log server error without sensitive credentials
    console.error('Registration error for email:', email, (error as Error).message);
    return {
      ok: false,
      error: 'An unexpected error occurred while creating your account. Please try again.',
    };
  }
}

/**
 * Server Action to resend a verification code (§4.7).
 * Enforces 60s cooldown, 5-send lifetime cap, and hard stop on bounced address.
 * Burns prior codes while keeping prior links alive.
 */
export async function resendVerification(): Promise<
  ActionResult<{ success: boolean; cooldownSeconds?: number }>
> {
  try {
    await dbConnect();
    const challenge = await getSignupChallengeFromCookies();
    if (!challenge?.userId) {
      return {
        ok: false,
        error: 'Verification session expired. Please sign in or register again.',
      };
    }

    const user = await User.findById(challenge.userId);
    if (!user) {
      return {
        ok: false,
        error: 'Account not found. Please register again.',
      };
    }

    if (user.emailVerifiedAt) {
      return {
        ok: true,
        data: { success: true },
      };
    }

    // Hard stop if email hard bounced
    if (user.emailBouncedAt) {
      return {
        ok: false,
        error: 'We were unable to deliver email to this address. Please register with a different email.',
      };
    }

    // Lifetime cap: max 5 sends (§4.7)
    if ((user.emailVerificationSends || 0) >= 5) {
      return {
        ok: false,
        error: 'Maximum verification attempts reached. Please contact support at support@bilyoapp.com',
      };
    }

    // Cooldown: 60 seconds
    if (user.emailVerificationSentAt) {
      const elapsed = Date.now() - user.emailVerificationSentAt.getTime();
      if (elapsed < 60_000) {
        const remaining = Math.ceil((60_000 - elapsed) / 1000);
        return {
          ok: false,
          error: `Please wait ${remaining}s before requesting a new code.`,
        };
      }
    }

    // Burn prior codes while leaving prior links alive (§4.7)
    await VerificationToken.updateMany(
      { userId: user._id, purpose: 'EMAIL_VERIFY', usedAt: null, codeInvalidAt: null },
      { $set: { codeInvalidAt: new Date() } }
    );

    await issueVerificationCredential({
      _id: user._id,
      name: user.name,
      email: user.email,
    });

    await setSignupChallengeCookie(user._id.toString(), user.email);

    return {
      ok: true,
      data: { success: true },
    };
  } catch (error) {
    console.error('[actions/auth] resendVerification error:', error);
    return {
      ok: false,
      error: 'An unexpected error occurred while resending the verification code.',
    };
  }
}

/**
 * Server Action to verify a 6-digit signup code (§4.4, §4.6).
 * Enforces server-side attempt budget (max 5 attempts per code).
 * Atomically increments attempts before comparison.
 * On match: marks user emailVerifiedAt, consumes token usedAt, clears challenge cookie,
 * and returns signupSessionToken for instant session minting (Path C).
 */
export async function verifySignupCode(
  inputCode: unknown
): Promise<
  ActionResult<{
    success: boolean;
    alreadyVerified?: boolean;
    signupSessionToken?: string;
  }>
> {
  const code = typeof inputCode === 'string' ? inputCode.trim() : '';
  if (!code || !/^\d{6}$/.test(code)) {
    return {
      ok: false,
      error: 'Please enter a valid 6-digit verification code',
    };
  }

  try {
    await dbConnect();
    const challenge = await getSignupChallengeFromCookies();
    if (!challenge?.userId) {
      return {
        ok: false,
        error: 'Your verification session has expired. Please sign in or register again.',
      };
    }

    const user = await User.findById(challenge.userId);
    if (!user) {
      return {
        ok: false,
        error: 'Account not found. Please register again.',
      };
    }

    // Special case (§6): if user was already verified (e.g. magic link clicked in email)
    if (user.emailVerifiedAt) {
      await clearSignupChallengeCookie();
      return {
        ok: true,
        data: { success: true, alreadyVerified: true },
      };
    }

    // Find the latest active verification token for this account
    const token = await VerificationToken.findOne({
      userId: user._id,
      purpose: 'EMAIL_VERIFY',
      usedAt: null,
    }).sort({ createdAt: -1 });

    if (!token) {
      return {
        ok: false,
        error: 'No active verification code found. Please request a new one.',
      };
    }

    if (token.codeInvalidAt) {
      return {
        ok: false,
        error: 'This verification code is no longer valid. Please request a new one.',
      };
    }

    if (token.codeExpiresAt < new Date()) {
      return {
        ok: false,
        error: 'This verification code has expired. Please request a new one.',
      };
    }

    // Atomically increment attempts BEFORE bcrypt compare (§4.4, §4.6)
    const updatedToken = await VerificationToken.findOneAndUpdate(
      { _id: token._id, usedAt: null, codeInvalidAt: null },
      { $inc: { attempts: 1 } },
      { returnDocument: 'after' }
    );

    if (!updatedToken) {
      return {
        ok: false,
        error: 'This code was already consumed or superseded. Please request a new one.',
      };
    }

    // If attempts exceed 5, burn code
    if (updatedToken.attempts > 5) {
      await VerificationToken.updateOne(
        { _id: updatedToken._id },
        { $set: { codeInvalidAt: new Date() } }
      );
      return {
        ok: false,
        error: 'Too many incorrect attempts. This code has been invalidated. Please request a new code.',
      };
    }

    const isMatch = await bcrypt.compare(code, updatedToken.codeHash);
    if (!isMatch) {
      const remaining = Math.max(0, 5 - updatedToken.attempts);
      if (remaining === 0) {
        await VerificationToken.updateOne(
          { _id: updatedToken._id },
          { $set: { codeInvalidAt: new Date() } }
        );
        return {
          ok: false,
          error: 'Too many incorrect attempts. This code has been invalidated. Please request a new code.',
        };
      }
      return {
        ok: false,
        error: `Incorrect verification code. ${remaining} attempt(s) remaining.`,
      };
    }

    // Code matched! Mark emailVerifiedAt on user and usedAt on token
    const verifiedAt = new Date();
    const userUpdateFields: Record<string, unknown> = {
      emailVerifiedAt: verifiedAt,
    };

    // Trial assignment (§6.10, ACCESS_ROLLOUT_PLAN.md A2)
    if (process.env.TRIAL_ENABLED === 'true' && user.accessUntil == null) {
      const trialDays = Number.parseInt(process.env.TRIAL_DAYS || '14', 10);
      const safeTrialDays = Number.isFinite(trialDays) && trialDays > 0 ? trialDays : 14;
      userUpdateFields.accessUntil = new Date(verifiedAt.getTime() + safeTrialDays * 86400000);
    }

    await User.updateOne(
      { _id: user._id },
      { $set: userUpdateFields }
    );

    await VerificationToken.updateOne(
      { _id: updatedToken._id },
      { $set: { usedAt: verifiedAt } }
    );

    await clearSignupChallengeCookie();

    const signupSessionToken = signSignupSessionToken(
      user._id.toString(),
      updatedToken._id.toString()
    );

    return {
      ok: true,
      data: {
        success: true,
        signupSessionToken,
      },
    };
  } catch (error) {
    console.error('[actions/auth] verifySignupCode error:', error);
    return {
      ok: false,
      error: 'An unexpected error occurred while verifying your code. Please try again.',
    };
  }
}

/**
 * Server Action to request a password reset (§8.10, M1-T06).
 * Single-use token, hashed with SHA-256 at rest, 1-hour expiry.
 * Anti-enumeration: returns identical message for both known and unknown emails.
 * Link printed to server log until email delivery is wired in M9.
 */
export async function requestPasswordReset(
  input: unknown
): Promise<ActionResult<{ message: string }>> {
  const parseResult = forgotPasswordSchema.safeParse(input);

  if (!parseResult.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parseResult.error.issues) {
      const key = issue.path[0];
      if (key && !fieldErrors[String(key)]) {
        fieldErrors[String(key)] = issue.message;
      }
    }
    return {
      ok: false,
      error: 'Please enter a valid email address',
      fieldErrors,
    };
  }

  const { email } = parseResult.data;
  const genericSuccessMessage =
    'If an account exists with this email, a reset link has been sent.';

  try {
    const ip = await getClientIp();
    const rateCheck = await enforceRateLimits([
      {
        key: `rate:forgot-password:ip:${ip}`,
        limit: 5,
        windowSeconds: 900,
        errorMessage: 'Too many password reset requests from this network. Please try again later.',
      },
      {
        key: `rate:forgot-password:email:${email}`,
        limit: 3,
        windowSeconds: 900,
        errorMessage: 'Too many password reset requests for this email address. Please try again later.',
      },
    ]);

    if (!rateCheck.allowed) {
      return {
        ok: false,
        error: rateCheck.error || 'Too many password reset requests. Please try again later.',
      };
    }

    await dbConnect();
    const user = await User.findOne({ email });

    // Anti-enumeration: don't reveal whether user exists (§8.10, M1-T06)
    if (!user) {
      return {
        ok: true,
        data: { message: genericSuccessMessage },
      };
    }

    // Generate 32-byte secure token and hash at rest using SHA-256
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1-hour expiry

    // Save token record (TTL indexed)
    await PasswordResetToken.create({
      userId: user._id,
      tokenHash,
      expiresAt,
    });

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    try {
      const { sendEmail } = await import('@/lib/email/send');
      const { renderPasswordResetEmail } = await import('@/lib/email/templates/password-reset');

      const { subject, html, text } = renderPasswordResetEmail({
        userName: user.name,
        resetUrl,
      });

      await sendEmail({
        userId: user._id,
        kind: 'PASSWORD_RESET',
        toEmail: email,
        subject,
        html,
        text,
        idempotencyKey: `password-reset:${tokenHash}`,
      });
    } catch (mailErr) {
      console.error('[actions/auth] Password reset email error:', mailErr);
    }

    return {
      ok: true,
      data: { message: genericSuccessMessage },
    };
  } catch (error) {
    console.error('Password reset request error:', (error as Error).message);
    return {
      ok: false,
      error: 'An unexpected error occurred while processing your request. Please try again.',
    };
  }
}

/**
 * Server Action to reset a password with a valid token (§8.10, M1-T06).
 * Checks single-use (usedAt == null), 1-hour expiry (expiresAt > now).
 * Hashes new password with bcrypt cost 10 and marks token as used.
 */
export async function resetPassword(
  input: unknown
): Promise<ActionResult<{ success: boolean }>> {
  const parseResult = resetPasswordSchema.safeParse(input);

  if (!parseResult.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parseResult.error.issues) {
      const key = issue.path[0];
      if (key && !fieldErrors[String(key)]) {
        fieldErrors[String(key)] = issue.message;
      }
    }
    return {
      ok: false,
      error: 'Please fix the errors below',
      fieldErrors,
    };
  }

  const { token, password } = parseResult.data;

  try {
    await dbConnect();

    // Hash the presented token to match stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetTokenDoc = await PasswordResetToken.findOne({ tokenHash });

    if (!resetTokenDoc) {
      return {
        ok: false,
        error: 'Invalid or expired password reset link. Please request a new one.',
      };
    }

    // Single-use check: must not be used previously
    if (resetTokenDoc.usedAt) {
      return {
        ok: false,
        error: 'This password reset link has already been used. Please request a new one.',
      };
    }

    // Expiry check: must not be expired
    if (resetTokenDoc.expiresAt < new Date()) {
      return {
        ok: false,
        error: 'This password reset link has expired. Please request a new one.',
      };
    }

    // Hash new password with bcrypt cost 10
    const passwordHash = await bcrypt.hash(password, 10);

    // Update user password and invalidate previous sessions
    await User.updateOne(
      { _id: resetTokenDoc.userId },
      { $set: { passwordHash, sessionsValidFrom: new Date() } }
    );

    // Mark token as used
    resetTokenDoc.usedAt = new Date();
    await resetTokenDoc.save();

    return {
      ok: true,
      data: { success: true },
    };
  } catch (error) {
    console.error('Password reset completion error:', (error as Error).message);
    return {
      ok: false,
      error: 'An unexpected error occurred while resetting your password. Please try again.',
    };
  }
}

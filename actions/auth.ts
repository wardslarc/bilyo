'use server';

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import dbConnect from '../lib/mongodb.ts';
import { User } from '../models/user.ts';
import { PasswordResetToken } from '../models/password-reset-token.ts';
import {
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../lib/validation/auth.ts';
import type { ActionResult } from '@/types';

/**
 * Server Action for User Registration (§8.1, M1-T02).
 * Validates with Zod, checks email uniqueness, hashes with bcrypt cost 10,
 * assigns role 'USER', plan 'FREE', planSource 'DEFAULT'.
 * Never logs raw passwords. Duplicate email returns field error, never 500.
 */
export async function registerUser(
  input: unknown
): Promise<ActionResult<{ userId: string }>> {
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

  try {
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

    // Create user with default role & plan
    const newUser = await User.create({
      name,
      email,
      passwordHash,
      role: 'USER',
      plan: 'FREE',
      planSource: 'DEFAULT',
    });

    return {
      ok: true,
      data: {
        userId: newUser._id.toString(),
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

    // Until M9 (Resend integration), print link to server log
    const appUrl =
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;
    console.log(`[PASSWORD_RESET] Link for ${email}: ${resetUrl}`);

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

    // Update user password
    await User.updateOne(
      { _id: resetTokenDoc.userId },
      { $set: { passwordHash } }
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

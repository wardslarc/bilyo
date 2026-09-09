'use server';

import bcrypt from 'bcryptjs';
import qrcode from 'qrcode';
import dbConnect from '../lib/mongodb.ts';
import { User } from '../models/user.ts';
import { Business } from '../models/business.ts';
import { Customer } from '../models/customer.ts';
import { Quotation } from '../models/quotation.ts';
import { requireUser, assertNotSuspended, AuthGuardError } from '../lib/auth-guards.ts';
import {
  changePasswordSchema,
  changeEmailSchema,
  closeAccountSchema,
  regenerateRecoveryCodesSchema,
  confirmDeviceReplacementSchema,
} from '../lib/validation/account.ts';
import {
  generateSecret,
  buildOtpauthUri,
  verifyCode,
  generateRecoveryCodes,
} from '../lib/mfa.ts';
import { encrypt, decrypt } from '../lib/crypto.ts';
import {
  sanitizeUserExport,
  formatQuotationsCsv,
  formatCustomersCsv,
} from '../lib/export.ts';
import type { ActionResult } from '@/types';

/**
 * Change password action (§8.4, M6-T05).
 * Requires current password verification and a valid new password (min 8 chars).
 */
export async function changePassword(
  input: unknown
): Promise<ActionResult<{ message: string }>> {
  try {
    const sessionUser = await requireUser();
    await assertNotSuspended(sessionUser.id);

    const parseResult = changePasswordSchema.safeParse(input);
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

    const { currentPassword, newPassword } = parseResult.data;

    await dbConnect();
    const user = await User.findById(sessionUser.id);
    if (!user || !user.passwordHash) {
      return {
        ok: false,
        error: 'User account not found',
      };
    }

    const isValidCurrentPassword = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );

    if (!isValidCurrentPassword) {
      return {
        ok: false,
        error: 'Current password is incorrect',
        fieldErrors: {
          currentPassword: 'Current password is incorrect',
        },
      };
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await User.updateOne(
      { _id: user._id },
      { $set: { passwordHash: newPasswordHash } }
    );

    return {
      ok: true,
      data: {
        message: 'Password changed successfully',
      },
    };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('changePassword error:', (error as Error).message);
    return {
      ok: false,
      error: 'An unexpected error occurred while changing your password',
    };
  }
}

/**
 * Change email action (§8.4, M6-T05).
 * Checks email uniqueness across all users, updates email, and clears emailVerifiedAt.
 */
export async function changeEmail(
  input: unknown
): Promise<ActionResult<{ email: string }>> {
  try {
    const sessionUser = await requireUser();
    await assertNotSuspended(sessionUser.id);

    const parseResult = changeEmailSchema.safeParse(input);
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

    const newEmail = parseResult.data.email.toLowerCase().trim();

    if (newEmail === sessionUser.email.toLowerCase().trim()) {
      return {
        ok: false,
        error: 'New email cannot be the same as your current email',
        fieldErrors: {
          email: 'New email cannot be the same as your current email',
        },
      };
    }

    await dbConnect();
    const existing = await User.findOne({ email: newEmail });
    if (existing && existing._id.toString() !== sessionUser.id) {
      return {
        ok: false,
        error: 'An account with this email already exists',
        fieldErrors: {
          email: 'An account with this email already exists',
        },
      };
    }

    await User.updateOne(
      { _id: sessionUser.id },
      {
        $set: {
          email: newEmail,
          emailVerifiedAt: null,
        },
      }
    );

    return {
      ok: true,
      data: {
        email: newEmail,
      },
    };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('changeEmail error:', (error as Error).message);
    return {
      ok: false,
      error: 'An unexpected error occurred while updating your email',
    };
  }
}

export interface ExportDataResult {
  jsonString: string;
  quotationsCsv: string;
  customersCsv: string;
}

/**
 * Export user data action (§8.4, M6-T05).
 * Complies with Philippine Data Privacy Act data portability rights.
 * Strictly scopes all queries by session userId.
 * Redacts all password and MFA secrets.
 */
export async function exportUserData(): Promise<ActionResult<ExportDataResult>> {
  try {
    const sessionUser = await requireUser();
    await assertNotSuspended(sessionUser.id);

    await dbConnect();

    // Query exclusively scoped to sessionUser.id
    const [dbUser, business, customers, quotations] =
      await Promise.all([
        User.findById(sessionUser.id).lean(),
        Business.findOne({ userId: sessionUser.id }).lean(),
        Customer.find({ userId: sessionUser.id }).sort({ createdAt: -1 }).lean(),
        Quotation.find({ userId: sessionUser.id }).sort({ createdAt: -1 }).lean(),
      ]);

    if (!dbUser) {
      return {
        ok: false,
        error: 'User record not found',
      };
    }

    const sanitizedUser = sanitizeUserExport(dbUser);

    const fullExport = {
      exportDate: new Date().toISOString(),
      user: sanitizedUser,
      business: business || null,
      customers,
      quotations,
    };

    const jsonString = JSON.stringify(fullExport, null, 2);
    const quotationsCsv = formatQuotationsCsv(quotations as unknown as Record<string, unknown>[]);
    const customersCsv = formatCustomersCsv(customers as unknown as Record<string, unknown>[]);

    return {
      ok: true,
      data: {
        jsonString,
        quotationsCsv,
        customersCsv,
      },
    };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('exportUserData error:', (error as Error).message);
    return {
      ok: false,
      error: 'An unexpected error occurred while preparing your data export',
    };
  }
}

/**
 * Close account action (§8.4, M6-T05).
 * Sets deletionRequestedAt: new Date(). Nothing is hard-deleted (§5.9, §8.4).
 * Requires password confirmation to prevent unauthorized or accidental closure.
 */
export async function closeAccount(
  input: unknown
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const sessionUser = await requireUser();
    await assertNotSuspended(sessionUser.id);

    const parseResult = closeAccountSchema.safeParse(input);
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

    const { password } = parseResult.data;

    await dbConnect();
    const user = await User.findById(sessionUser.id);
    if (!user || !user.passwordHash) {
      return {
        ok: false,
        error: 'User account not found',
      };
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return {
        ok: false,
        error: 'Incorrect password',
        fieldErrors: {
          password: 'Incorrect password',
        },
      };
    }

    // Set deletionRequestedAt (§8.4, M6-T05). Nothing is hard-deleted.
    await User.updateOne(
      { _id: user._id },
      { $set: { deletionRequestedAt: new Date() } }
    );

    return {
      ok: true,
      data: {
        success: true,
      },
    };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('closeAccount error:', (error as Error).message);
    return {
      ok: false,
      error: 'An unexpected error occurred while processing account closure',
    };
  }
}

/**
 * Retrieves the current user's security status (§5.11, M6-T06).
 */
export async function getSecurityStatus(): Promise<
  ActionResult<{
    mfaEnabled: boolean;
    mfaEnabledAt: Date | null;
    remainingRecoveryCodes: number;
  }>
> {
  try {
    const sessionUser = await requireUser();
    await assertNotSuspended(sessionUser.id);

    await dbConnect();
    const user = await User.findById(sessionUser.id).select(
      'mfaEnabledAt mfaRecoveryCodeHashes'
    );
    if (!user) {
      return { ok: false, error: 'User not found' };
    }

    return {
      ok: true,
      data: {
        mfaEnabled: Boolean(user.mfaEnabledAt),
        mfaEnabledAt: user.mfaEnabledAt || null,
        remainingRecoveryCodes: user.mfaRecoveryCodeHashes?.length || 0,
      },
    };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('getSecurityStatus error:', (error as Error).message);
    return {
      ok: false,
      error: 'An unexpected error occurred while loading security status',
    };
  }
}

/**
 * Regenerates 10 fresh single-use recovery codes (§5.11 rule 6, M6-T06).
 * Requires account password verification and invalidates all ten previous codes.
 */
export async function regenerateRecoveryCodes(
  input: unknown
): Promise<
  ActionResult<{ recoveryCodes: string[]; remainingRecoveryCodes: number }>
> {
  try {
    const sessionUser = await requireUser();
    await assertNotSuspended(sessionUser.id);

    const parseResult = regenerateRecoveryCodesSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        ok: false,
        error: 'Password is required to regenerate recovery codes',
      };
    }

    await dbConnect();
    const user = await User.findById(sessionUser.id);
    if (!user || !user.passwordHash) {
      return { ok: false, error: 'User account not found' };
    }

    const isPasswordValid = await bcrypt.compare(
      parseResult.data.password,
      user.passwordHash
    );
    if (!isPasswordValid) {
      return { ok: false, error: 'Incorrect password' };
    }

    if (!user.mfaEnabledAt || !user.mfaSecretEncrypted) {
      return { ok: false, error: 'MFA is not enabled on this account' };
    }

    // Regenerate 10 fresh recovery codes; replaces/invalidates all existing codes
    const { plainCodes, hashedCodes } = await generateRecoveryCodes();
    user.mfaRecoveryCodeHashes = hashedCodes;
    await user.save();

    return {
      ok: true,
      data: {
        recoveryCodes: plainCodes,
        remainingRecoveryCodes: 10,
      },
    };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('regenerateRecoveryCodes error:', (error as Error).message);
    return {
      ok: false,
      error: 'An unexpected error occurred while regenerating recovery codes',
    };
  }
}

/**
 * Phase 1 of device replacement (§5.11, M6-T06).
 * Generates pending secret + QR code. Crucially, the active device remains operational.
 */
export async function initiateDeviceReplacement(): Promise<
  ActionResult<{ qrDataUrl: string; secretBase32: string }>
> {
  try {
    const sessionUser = await requireUser();
    await assertNotSuspended(sessionUser.id);

    await dbConnect();
    const user = await User.findById(sessionUser.id);
    if (!user) {
      return { ok: false, error: 'User not found' };
    }

    if (!user.mfaEnabledAt || !user.mfaSecretEncrypted) {
      return { ok: false, error: 'MFA is not yet enrolled' };
    }

    const secret = generateSecret();
    const encryptedSecret = encrypt(secret);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

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
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('initiateDeviceReplacement error:', (error as Error).message);
    return {
      ok: false,
      error: 'Failed to initiate device replacement setup',
    };
  }
}

/**
 * Phase 2 of device replacement (§5.11, M6-T06).
 * Confirms code from the NEW device. Only upon success is the pending secret promoted
 * and the old device dropped. Generates 10 new recovery codes.
 */
export async function confirmDeviceReplacement(
  input: unknown
): Promise<
  ActionResult<{ recoveryCodes: string[]; remainingRecoveryCodes: number }>
> {
  try {
    const sessionUser = await requireUser();
    await assertNotSuspended(sessionUser.id);

    const parseResult = confirmDeviceReplacementSchema.safeParse(input);
    if (!parseResult.success) {
      return { ok: false, error: 'Please enter a valid 6-digit verification code' };
    }

    const { code } = parseResult.data;

    await dbConnect();
    const user = await User.findById(sessionUser.id);
    if (!user) {
      return { ok: false, error: 'User not found' };
    }

    if (!user.mfaPendingSecretEncrypted || !user.mfaPendingExpiresAt) {
      return {
        ok: false,
        error: 'No pending device replacement session found. Please start over.',
      };
    }

    if (user.mfaPendingExpiresAt < new Date()) {
      return {
        ok: false,
        error: 'Device replacement session expired (15 min). Please start over.',
      };
    }

    const pendingSecret = decrypt(user.mfaPendingSecretEncrypted);
    const acceptedStep = verifyCode(pendingSecret, code);

    if (acceptedStep === null) {
      // Old device remains untouched!
      return {
        ok: false,
        error:
          'Invalid verification code from your new authenticator app. Your existing device remains active.',
      };
    }

    // New device confirmed -> promote secret and generate fresh recovery codes
    const { plainCodes, hashedCodes } = await generateRecoveryCodes();

    user.mfaSecretEncrypted = user.mfaPendingSecretEncrypted;
    user.mfaPendingSecretEncrypted = null;
    user.mfaPendingExpiresAt = null;
    user.mfaLastUsedStep = acceptedStep;
    user.mfaRecoveryCodeHashes = hashedCodes;
    user.mfaFailedAttempts = 0;
    user.mfaLockedUntil = null;
    await user.save();

    return {
      ok: true,
      data: {
        recoveryCodes: plainCodes,
        remainingRecoveryCodes: 10,
      },
    };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('confirmDeviceReplacement error:', (error as Error).message);
    return {
      ok: false,
      error: 'An unexpected error occurred while confirming device replacement.',
    };
  }
}


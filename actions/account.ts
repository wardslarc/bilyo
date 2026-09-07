'use server';

import bcrypt from 'bcryptjs';
import dbConnect from '../lib/mongodb.ts';
import { User } from '../models/user.ts';
import { Business } from '../models/business.ts';
import { Customer } from '../models/customer.ts';
import { Product } from '../models/product.ts';
import { Quotation } from '../models/quotation.ts';
import { Invoice } from '../models/invoice.ts';
import { requireUser, assertNotSuspended, AuthGuardError } from '../lib/auth-guards.ts';
import {
  changePasswordSchema,
  changeEmailSchema,
  closeAccountSchema,
} from '../lib/validation/account.ts';
import {
  sanitizeUserExport,
  formatInvoicesCsv,
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
  invoicesCsv: string;
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
    const [dbUser, business, customers, products, quotations, invoices] =
      await Promise.all([
        User.findById(sessionUser.id).lean(),
        Business.findOne({ userId: sessionUser.id }).lean(),
        Customer.find({ userId: sessionUser.id }).sort({ createdAt: -1 }).lean(),
        Product.find({ userId: sessionUser.id }).sort({ createdAt: -1 }).lean(),
        Quotation.find({ userId: sessionUser.id }).sort({ createdAt: -1 }).lean(),
        Invoice.find({ userId: sessionUser.id }).sort({ createdAt: -1 }).lean(),
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
      products,
      quotations,
      invoices,
    };

    const jsonString = JSON.stringify(fullExport, null, 2);
    const invoicesCsv = formatInvoicesCsv(invoices as unknown as Record<string, unknown>[]);
    const quotationsCsv = formatQuotationsCsv(quotations as unknown as Record<string, unknown>[]);
    const customersCsv = formatCustomersCsv(customers as unknown as Record<string, unknown>[]);

    return {
      ok: true,
      data: {
        jsonString,
        invoicesCsv,
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

'use server';

import dbConnect from '../lib/mongodb.ts';
import { Business } from '../models/business.ts';
import { requireUser, assertNotSuspended, AuthGuardError } from '../lib/auth-guards.ts';
import { businessProfileSchema, type BusinessProfileInput } from '../lib/validation/business.ts';
import type { ActionResult } from '../types/index.ts';

export interface SerializedBusiness {
  id: string;
  userId: string;
  businessName: string;
  address: string;
  email: string;
  phone: string;
  tin: string;
  vatRegistered: boolean;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Helper to safely revalidate paths without failing under pure Node test environments
 */
async function safeRevalidate(path: string) {
  try {
    const { revalidatePath } = await import('next/cache');
    revalidatePath(path);
  } catch {
    // Ignore in non-Next environments (e.g. unit tests)
  }
}

/**
 * Retrieve the current authenticated user's business profile (AGENTS.md §3.1).
 * Returns null if the user has not completed onboarding/created a profile yet.
 */
export async function getBusinessProfile(): Promise<ActionResult<SerializedBusiness | null>> {
  try {
    const user = await requireUser();
    await assertNotSuspended(user.id);

    await dbConnect();
    const doc = await Business.findOne({ userId: user.id }).lean();

    if (!doc) {
      return { ok: true, data: null };
    }

    return {
      ok: true,
      data: {
        id: doc._id.toString(),
        userId: doc.userId.toString(),
        businessName: doc.businessName,
        address: doc.address || '',
        email: doc.email || '',
        phone: doc.phone || '',
        tin: doc.tin || '',
        vatRegistered: Boolean(doc.vatRegistered),
        logoUrl: doc.logoUrl || null,
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('getBusinessProfile error:', (error as Error).message);
    return { ok: false, error: 'Failed to load business profile' };
  }
}

/**
 * Create or update the current authenticated user's business profile (M2-T01).
 * Atomic upsert ensures calling twice updates instead of creating duplicate records.
 */
export async function saveBusinessProfile(
  input: BusinessProfileInput
): Promise<ActionResult<SerializedBusiness>> {
  try {
    const user = await requireUser();
    await assertNotSuspended(user.id);

    const parseResult = businessProfileSchema.safeParse(input);
    if (!parseResult.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parseResult.error.issues) {
        const fieldName = issue.path[0];
        if (fieldName && typeof fieldName === 'string' && !fieldErrors[fieldName]) {
          fieldErrors[fieldName] = issue.message;
        }
      }
      return {
        ok: false,
        error: 'Please fix the errors below.',
        fieldErrors,
      };
    }

    const data = parseResult.data;

    await dbConnect();

    // Idempotent upsert scoped strictly by userId (AGENTS.md §3.1)
    const doc = await Business.findOneAndUpdate(
      { userId: user.id },
      {
        $set: {
          businessName: data.businessName,
          address: data.address || '',
          email: data.email || '',
          phone: data.phone || '',
          tin: data.tin || '',
          vatRegistered: data.vatRegistered,
          logoUrl: data.logoUrl || null,
        },
        $setOnInsert: {
          userId: user.id,
        },
      },
      {
        returnDocument: 'after',
        upsert: true,
        runValidators: true,
        lean: true,
      }
    );

    if (!doc) {
      return { ok: false, error: 'Failed to save business profile' };
    }

    await safeRevalidate('/dashboard/settings');
    await safeRevalidate('/dashboard');

    return {
      ok: true,
      data: {
        id: doc._id.toString(),
        userId: doc.userId.toString(),
        businessName: doc.businessName,
        address: doc.address || '',
        email: doc.email || '',
        phone: doc.phone || '',
        tin: doc.tin || '',
        vatRegistered: Boolean(doc.vatRegistered),
        logoUrl: doc.logoUrl || null,
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('saveBusinessProfile error:', (error as Error).message);
    return { ok: false, error: 'An unexpected error occurred while saving your business profile.' };
  }
}

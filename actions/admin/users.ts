'use server';

import { revalidatePath } from 'next/cache';
import dbConnect from '../../lib/mongodb.ts';
import { User } from '../../models/user.ts';
import { requireAdmin } from '../../lib/admin/guard.ts';
import { recordAudit } from '../../lib/admin/audit.ts';
import { adminActionReasonSchema } from '../../lib/validation/admin.ts';
import type { ActionResult } from '@/types';

/**
 * Suspend an account (§5.9, M7-T05).
 * Blocks the user's next sign-in and mutating server actions.
 * Leaves existing public links intact.
 * Requires a typed reason (min 10 characters).
 * Cannot suspend an admin account.
 */
export async function suspendUser(
  input: unknown
): Promise<ActionResult<{ suspendedAt: Date }>> {
  try {
    const admin = await requireAdmin();
    const parseResult = adminActionReasonSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        ok: false,
        error: parseResult.error.issues[0]?.message || 'Invalid input',
      };
    }

    const { userId, reason } = parseResult.data;
    await dbConnect();

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return { ok: false, error: 'User not found' };
    }

    // AGENTS.md §4: Never suspend an admin from the console
    if (targetUser.role === 'ADMIN') {
      return { ok: false, error: 'Platform administrators cannot be suspended from the console' };
    }

    if (targetUser.suspendedAt) {
      return { ok: false, error: 'Account is already suspended' };
    }

    const before = {
      suspendedAt: null,
      suspendedReason: null,
      suspendedByUserId: null,
    };

    const suspendedAt = new Date();
    targetUser.suspendedAt = suspendedAt;
    targetUser.suspendedReason = reason;
    targetUser.suspendedByUserId = admin.id;
    await targetUser.save();

    await recordAudit({
      action: 'USER_SUSPEND',
      targetUserId: targetUser._id.toString(),
      targetType: 'User',
      targetId: targetUser._id.toString(),
      reason,
      before,
      after: {
        suspendedAt,
        suspendedReason: reason,
        suspendedByUserId: admin.id,
      },
    });

    revalidatePath(`/admin/users/${userId}`);
    revalidatePath('/admin/users');

    return { ok: true, data: { suspendedAt } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to suspend user';
    return { ok: false, error: msg };
  }
}

/**
 * Unsuspend an account (§5.9, M7-T05).
 * Clears suspension fields and restores sign-in and mutation access.
 * Requires a typed reason (min 10 characters).
 */
export async function unsuspendUser(
  input: unknown
): Promise<ActionResult<{ ok: true }>> {
  try {
    await requireAdmin();
    const parseResult = adminActionReasonSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        ok: false,
        error: parseResult.error.issues[0]?.message || 'Invalid input',
      };
    }

    const { userId, reason } = parseResult.data;
    await dbConnect();

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return { ok: false, error: 'User not found' };
    }

    if (!targetUser.suspendedAt) {
      return { ok: false, error: 'Account is not currently suspended' };
    }

    const before = {
      suspendedAt: targetUser.suspendedAt,
      suspendedReason: targetUser.suspendedReason,
      suspendedByUserId: targetUser.suspendedByUserId,
    };

    targetUser.suspendedAt = null;
    targetUser.suspendedReason = null;
    targetUser.suspendedByUserId = null;
    await targetUser.save();

    await recordAudit({
      action: 'USER_UNSUSPEND',
      targetUserId: targetUser._id.toString(),
      targetType: 'User',
      targetId: targetUser._id.toString(),
      reason,
      before,
      after: {
        suspendedAt: null,
        suspendedReason: null,
        suspendedByUserId: null,
      },
    });

    revalidatePath(`/admin/users/${userId}`);
    revalidatePath('/admin/users');

    return { ok: true, data: { ok: true } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to unsuspend user';
    return { ok: false, error: msg };
  }
}

/**
 * Disable all public links for a user (§5.9, M7-T05).
 * Separate, harsher action for abuse/phishing: causes /i/* and /q/* for this user to return 404.
 * Requires a typed reason (min 10 characters).
 */
export async function disableUserPublicLinks(
  input: unknown
): Promise<ActionResult<{ publicLinksDisabledAt: Date }>> {
  try {
    await requireAdmin();
    const parseResult = adminActionReasonSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        ok: false,
        error: parseResult.error.issues[0]?.message || 'Invalid input',
      };
    }

    const { userId, reason } = parseResult.data;
    await dbConnect();

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return { ok: false, error: 'User not found' };
    }

    if (targetUser.publicLinksDisabledAt) {
      return { ok: false, error: 'Public links are already disabled for this user' };
    }

    const before = {
      publicLinksDisabledAt: null,
    };

    const publicLinksDisabledAt = new Date();
    targetUser.publicLinksDisabledAt = publicLinksDisabledAt;
    await targetUser.save();

    await recordAudit({
      action: 'PUBLIC_LINKS_DISABLE',
      targetUserId: targetUser._id.toString(),
      targetType: 'User',
      targetId: targetUser._id.toString(),
      reason,
      before,
      after: {
        publicLinksDisabledAt,
      },
    });

    revalidatePath(`/admin/users/${userId}`);
    revalidatePath('/admin/users');

    return { ok: true, data: { publicLinksDisabledAt } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to disable public links';
    return { ok: false, error: msg };
  }
}

/**
 * Re-enable public links for a user (§5.9, M7-T05).
 * Clears publicLinksDisabledAt so valid public tokens resolve again.
 * Requires a typed reason (min 10 characters).
 */
export async function enableUserPublicLinks(
  input: unknown
): Promise<ActionResult<{ ok: true }>> {
  try {
    await requireAdmin();
    const parseResult = adminActionReasonSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        ok: false,
        error: parseResult.error.issues[0]?.message || 'Invalid input',
      };
    }

    const { userId, reason } = parseResult.data;
    await dbConnect();

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return { ok: false, error: 'User not found' };
    }

    if (!targetUser.publicLinksDisabledAt) {
      return { ok: false, error: 'Public links are already enabled for this user' };
    }

    const before = {
      publicLinksDisabledAt: targetUser.publicLinksDisabledAt,
    };

    targetUser.publicLinksDisabledAt = null;
    await targetUser.save();

    await recordAudit({
      action: 'PUBLIC_LINKS_ENABLE',
      targetUserId: targetUser._id.toString(),
      targetType: 'User',
      targetId: targetUser._id.toString(),
      reason,
      before,
      after: {
        publicLinksDisabledAt: null,
      },
    });

    revalidatePath(`/admin/users/${userId}`);
    revalidatePath('/admin/users');

    return { ok: true, data: { ok: true } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to enable public links';
    return { ok: false, error: msg };
  }
}

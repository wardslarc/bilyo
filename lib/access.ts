import type { AccessState, AccessStatus } from '@/types';

export interface AccessUserLike {
  accessUntil?: Date | string | null;
  firstPaidAt?: Date | string | null;
}

/**
 * Pure, synchronous calculation of user's access status (§6.10, ACCESS_BILLING_PLAN.md §3.3).
 *
 * Rules:
 * - Zero DB queries, strictly synchronous.
 * - accessUntil: null -> BETA (unlimited, no expiry).
 * - now <= accessUntil:
 *     firstPaidAt === null -> TRIAL
 *     firstPaidAt !== null -> ACTIVE
 * - now > accessUntil:
 *     firstPaidAt === null -> EXPIRED_TRIAL
 *     firstPaidAt !== null -> EXPIRED_PAID
 * - daysLeft:
 *     Infinity for BETA
 *     0 for EXPIRED_*
 *     Ceiled 24-hour days remaining for active windows
 */
export function accessState(
  user: AccessUserLike | null | undefined,
  now: Date = new Date()
): AccessState {
  if (!user || user.accessUntil == null) {
    return {
      status: 'BETA',
      accessUntil: null,
      daysLeft: Infinity,
    };
  }

  const accessUntil =
    user.accessUntil instanceof Date ? user.accessUntil : new Date(user.accessUntil);

  if (Number.isNaN(accessUntil.getTime())) {
    return {
      status: 'BETA',
      accessUntil: null,
      daysLeft: Infinity,
    };
  }

  const nowMs = now.getTime();
  const untilMs = accessUntil.getTime();
  const isPast = nowMs > untilMs;
  const hasPaid = Boolean(user.firstPaidAt);

  if (isPast) {
    return {
      status: hasPaid ? 'EXPIRED_PAID' : 'EXPIRED_TRIAL',
      accessUntil,
      daysLeft: 0,
    };
  }

  const diffMs = untilMs - nowMs;
  const daysLeft = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));

  const status: AccessStatus = hasPaid ? 'ACTIVE' : 'TRIAL';

  return {
    status,
    accessUntil,
    daysLeft,
  };
}

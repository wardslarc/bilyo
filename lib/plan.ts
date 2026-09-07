import type { Plan, PlanSource } from '@/types';

export interface PlanUser {
  plan?: Plan | null;
  planSource?: PlanSource | null;
  planOverrideExpiresAt?: Date | string | null;
  planOverrideReason?: string | null;
  billingPlan?: Plan | null;
}

export interface PlanLimits {
  monthlyInvoices: number;
  monthlyQuotations: number;
  maxCustomers: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: {
    monthlyInvoices: 5,
    monthlyQuotations: 5,
    maxCustomers: 10,
  },
  FREELANCER: {
    monthlyInvoices: Infinity,
    monthlyQuotations: Infinity,
    maxCustomers: Infinity,
  },
  BUSINESS: {
    monthlyInvoices: Infinity,
    monthlyQuotations: Infinity,
    maxCustomers: Infinity,
  },
};

/**
 * Checks whether an administrative plan override is currently live and unexpired (§5.10).
 */
export function isPlanOverrideActive(user?: PlanUser | null): boolean {
  if (!user || user.planSource !== 'ADMIN' || !user.planOverrideExpiresAt) {
    return false;
  }
  const expiry = new Date(user.planOverrideExpiresAt);
  return !isNaN(expiry.getTime()) && expiry.getTime() > Date.now();
}

/**
 * Single source of truth for resolving a user's active subscription tier (§5.10, M7-T06).
 *
 * Resolution order:
 * 1. An unexpired ADMIN override wins immediately.
 * 2. If the override has expired (or was never set), falls back to the active BILLING plan
 *    with zero background cleanup jobs required.
 * 3. Otherwise, defaults to FREE.
 *
 * PayMongo webhooks write to billing fields and will never clobber a live admin override.
 */
export function effectivePlan(user?: PlanUser | null): Plan {
  if (!user) return 'FREE';

  // 1. Unexpired ADMIN override takes precedence over everything
  if (isPlanOverrideActive(user)) {
    return user.plan || 'FREE';
  }

  // 2. Fall back to billing subscription (whether override expired or not set)
  if (user.billingPlan) {
    return user.billingPlan;
  }

  if (user.planSource === 'BILLING' && user.plan) {
    return user.plan;
  }

  // 3. Base default
  return 'FREE';
}

/**
 * Returns the operational limits associated with a user's effective plan.
 */
export function getEffectivePlanLimits(user?: PlanUser | null): PlanLimits {
  const plan = effectivePlan(user);
  return PLAN_LIMITS[plan];
}

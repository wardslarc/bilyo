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

export interface PlanLimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  plan: Plan;
  error?: string;
}

/**
 * Pure helper evaluating resource count against plan limits.
 * Exported for fast, deterministic unit testing of limits, plans, and overrides.
 */
export function evaluateResourceLimit(
  resource: 'INVOICES' | 'QUOTATIONS' | 'CUSTOMERS',
  currentCount: number,
  userOrPlan: Plan | PlanUser
): PlanLimitCheckResult {
  const plan = typeof userOrPlan === 'string' ? userOrPlan : effectivePlan(userOrPlan);
  const limits = PLAN_LIMITS[plan];

  let limit: number;
  let resourceName: string;
  let periodNote: string;

  if (resource === 'INVOICES') {
    limit = limits.monthlyInvoices;
    resourceName = 'invoices';
    periodNote = ' this month';
  } else if (resource === 'QUOTATIONS') {
    limit = limits.monthlyQuotations;
    resourceName = 'quotations';
    periodNote = ' this month';
  } else {
    limit = limits.maxCustomers;
    resourceName = 'customers';
    periodNote = '';
  }

  if (currentCount >= limit) {
    return {
      allowed: false,
      current: currentCount,
      limit,
      plan,
      error: `You have reached the limit of ${limit} ${resourceName} on the ${plan} plan (${currentCount}/${limit} used${periodNote}). Upgrade to Freelancer or Business for unlimited ${resourceName}.`,
    };
  }

  return {
    allowed: true,
    current: currentCount,
    limit,
    plan,
  };
}

/**
 * Server-side invoice creation limit check (§5.10, M8-T01).
 * FREE: 5 invoices per calendar month in Asia/Manila.
 * Overrides via effectivePlan() lift limits immediately.
 */
export async function checkCanCreateInvoice(
  userId: string,
  now: Date = new Date()
): Promise<PlanLimitCheckResult> {
  const dbConnect = (await import('./mongodb.ts')).default;
  await dbConnect();

  const { User } = await import('../models/user.ts');
  const user = await User.findById(userId).lean();
  const plan = effectivePlan(user);
  const limits = PLAN_LIMITS[plan];

  if (limits.monthlyInvoices === Infinity) {
    return { allowed: true, current: 0, limit: Infinity, plan };
  }

  const { Invoice } = await import('../models/invoice.ts');
  const { getManilaMonthRange } = await import('./dates.ts');
  const { startOfMonth, endOfMonth } = getManilaMonthRange(now);

  const current = await Invoice.countDocuments({
    userId,
    createdAt: { $gte: startOfMonth, $lte: endOfMonth },
  });

  return evaluateResourceLimit('INVOICES', current, plan);
}

/**
 * Server-side quotation creation limit check (§5.10, M8-T01).
 * FREE: 5 quotations per calendar month in Asia/Manila.
 * Overrides via effectivePlan() lift limits immediately.
 */
export async function checkCanCreateQuotation(
  userId: string,
  now: Date = new Date()
): Promise<PlanLimitCheckResult> {
  const dbConnect = (await import('./mongodb.ts')).default;
  await dbConnect();

  const { User } = await import('../models/user.ts');
  const user = await User.findById(userId).lean();
  const plan = effectivePlan(user);
  const limits = PLAN_LIMITS[plan];

  if (limits.monthlyQuotations === Infinity) {
    return { allowed: true, current: 0, limit: Infinity, plan };
  }

  const { Quotation } = await import('../models/quotation.ts');
  const { getManilaMonthRange } = await import('./dates.ts');
  const { startOfMonth, endOfMonth } = getManilaMonthRange(now);

  const current = await Quotation.countDocuments({
    userId,
    createdAt: { $gte: startOfMonth, $lte: endOfMonth },
  });

  return evaluateResourceLimit('QUOTATIONS', current, plan);
}

/**
 * Server-side customer creation limit check (§5.10, M8-T01).
 * FREE: 10 active customers total.
 * Overrides via effectivePlan() lift limits immediately.
 */
export async function checkCanCreateCustomer(
  userId: string
): Promise<PlanLimitCheckResult> {
  const dbConnect = (await import('./mongodb.ts')).default;
  await dbConnect();

  const { User } = await import('../models/user.ts');
  const user = await User.findById(userId).lean();
  const plan = effectivePlan(user);
  const limits = PLAN_LIMITS[plan];

  if (limits.maxCustomers === Infinity) {
    return { allowed: true, current: 0, limit: Infinity, plan };
  }

  const { Customer } = await import('../models/customer.ts');
  const current = await Customer.countDocuments({
    userId,
    archived: false,
  });

  return evaluateResourceLimit('CUSTOMERS', current, plan);
}

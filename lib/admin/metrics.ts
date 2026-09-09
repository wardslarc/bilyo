import dbConnect from '../mongodb.ts';
import { User } from '../../models/user.ts';
import { Quotation } from '../../models/quotation.ts';
import { requireAdmin } from './guard.ts';

export interface PlatformMetrics {
  totalUsers: number;
  newUsers7d: number;
  newUsers30d: number;
  activeUsers30d: number;
  documents30d: {
    invoices: number;
    quotations: number;
    total: number;
  };
  paidAccounts: {
    total: number;
    freelancer: number;
    business: number;
    comped: number;
  };
  mrrCentavos: number;
  suspendedCount: number;
  publicLinksDisabledCount: number;
  generatedAt: string;
}

// Plan prices per DEVELOPMENT_PLAN.md M9-T01: ₱299 Freelancer / ₱599 Business
export const FREELANCER_MONTHLY_CENTAVOS = 29900;
export const BUSINESS_MONTHLY_CENTAVOS = 59900;

/**
 * Computes MRR (Monthly Recurring Revenue) in integer centavos from paying subscription counts.
 * Pure function exported for unit testing (§5.10, §14).
 */
export function computePlatformMRR(
  payingFreelancerCount: number,
  payingBusinessCount: number
): number {
  const f = Math.max(0, Math.floor(payingFreelancerCount));
  const b = Math.max(0, Math.floor(payingBusinessCount));
  return f * FREELANCER_MONTHLY_CENTAVOS + b * BUSINESS_MONTHLY_CENTAVOS;
}

/**
 * Fetches platform-wide operational KPIs (M7-T07).
 * Bounded database aggregations with zero per-user loops.
 */
async function fetchPlatformMetricsInternal(): Promise<PlatformMetrics> {
  await requireAdmin();
  await dbConnect();

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  const [
    totalUsers,
    newUsers7d,
    newUsers30d,
    invoices30d,
    quotations30d,
    activeInvoiceUserIds,
    activeQuotationUserIds,
    payingFreelancer,
    payingBusiness,
    compedAccounts,
    suspendedCount,
    publicLinksDisabledCount,
  ] = await Promise.all([
    // 1. Total users
    User.countDocuments(),

    // 2. New signups 7d / 30d
    User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),

    // 3. Documents created in last 30d
    Promise.resolve(0),
    Quotation.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),

    // 4. Distinct users who created a document in last 30d
    Promise.resolve([]),
    Quotation.distinct('userId', { createdAt: { $gte: thirtyDaysAgo } }),

    // 5. Paid subscriptions (PayMongo billing)
    User.countDocuments({ plan: 'FREELANCER', planSource: 'BILLING' }),
    User.countDocuments({ plan: 'BUSINESS', planSource: 'BILLING' }),

    // 6. Active unexpired admin comps
    User.countDocuments({
      planSource: 'ADMIN',
      planOverrideExpiresAt: { $gt: now },
      plan: { $in: ['FREELANCER', 'BUSINESS'] },
    }),

    // 7. Security & moderation counts
    User.countDocuments({ suspendedAt: { $ne: null } }),
    User.countDocuments({ publicLinksDisabledAt: { $ne: null } }),
  ]);

  // Active users 30d: Union of distinct user IDs across invoices and quotations
  const activeUserSet = new Set<string>();
  for (const id of activeInvoiceUserIds) {
    if (id) activeUserSet.add(String(id));
  }
  for (const id of activeQuotationUserIds) {
    if (id) activeUserSet.add(String(id));
  }

  const mrrCentavos = computePlatformMRR(payingFreelancer, payingBusiness);

  return {
    totalUsers,
    newUsers7d,
    newUsers30d,
    activeUsers30d: activeUserSet.size,
    documents30d: {
      invoices: invoices30d,
      quotations: quotations30d,
      total: invoices30d + quotations30d,
    },
    paidAccounts: {
      total: payingFreelancer + payingBusiness,
      freelancer: payingFreelancer,
      business: payingBusiness,
      comped: compedAccounts,
    },
    mrrCentavos,
    suspendedCount,
    publicLinksDisabledCount,
    generatedAt: now.toISOString(),
  };
}

/**
 * Public accessor for platform metrics (cached for 5 minutes / 300 seconds per M7-T07).
 */
export async function getPlatformMetrics(options?: { forceFresh?: boolean }): Promise<PlatformMetrics> {
  if (options?.forceFresh) {
    return fetchPlatformMetricsInternal();
  }

  try {
    const { unstable_cache } = await import('next/cache');
    const cachedFn = unstable_cache(
      async () => fetchPlatformMetricsInternal(),
      ['admin-platform-metrics-v1'],
      {
        revalidate: 300,
        tags: ['admin-platform-metrics'],
      }
    );
    return await cachedFn();
  } catch {
    // Non-Next.js environments (CLI runners, test runners)
    return fetchPlatformMetricsInternal();
  }
}

import dbConnect from '../mongodb.ts';
import { User } from '../../models/user.ts';
import { Quotation } from '../../models/quotation.ts';
import { Interest } from '../../models/interest.ts';
import { requireAdmin } from './guard.ts';

export interface PlatformMetrics {
  totalUsers: number;
  newUsers7d: number;
  newUsers30d: number;
  activeUsers30d: number;
  quotesSent30d: number;
  quotesAccepted30d: number;
  acceptanceRate: number; // e.g. 75.5 for 75.5%
  suspendedCount: number;
  publicLinksDisabledCount: number;
  pricingNotifyCount: number;
  trialWallSurveyCount: number;
  generatedAt: string;
}

/**
 * Computes quotation acceptance rate as a percentage rounded to 1 decimal place.
 * Pure function exported for unit testing (DEVELOPMENT_PLAN.md §12 P1-T06).
 */
export function computeAcceptanceRate(
  quotesSent: number,
  quotesAccepted: number
): number {
  const sent = Math.max(0, Math.floor(quotesSent));
  const accepted = Math.max(0, Math.floor(quotesAccepted));
  if (sent === 0 || accepted === 0) return 0;
  return Math.min(100, Math.round((accepted / sent) * 1000) / 10);
}

/**
 * Fetches platform-wide operational KPIs (DEVELOPMENT_PLAN.md §12 P1-T06).
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
    quotesSent30d,
    quotesAccepted30d,
    activeQuotationUserIds,
    suspendedCount,
    publicLinksDisabledCount,
    pricingNotifyCount,
    trialWallSurveyCount,
  ] = await Promise.all([
    // 1. Total users
    User.countDocuments(),

    // 2. New signups 7d / 30d
    User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),

    // 3. Quotes sent in last 30d
    Quotation.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
      status: { $in: ['SENT', 'VIEWED', 'ACCEPTED', 'DECLINED'] },
    }),

    // 4. Quotes accepted in last 30d
    Quotation.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
      status: 'ACCEPTED',
    }),

    // 5. Distinct users who created a quotation in last 30d
    Quotation.distinct('userId', { createdAt: { $gte: thirtyDaysAgo } }),

    // 6. Security & moderation counts
    User.countDocuments({ suspendedAt: { $ne: null } }),
    User.countDocuments({ publicLinksDisabledAt: { $ne: null } }),

    // 7. Gate 3 & Pricing interest indicators (§3.4, A5, A6)
    Interest.countDocuments({ source: 'PRICING_NOTIFY' }),
    Interest.countDocuments({ source: 'TRIAL_WALL' }),
  ]);

  const acceptanceRate = computeAcceptanceRate(quotesSent30d, quotesAccepted30d);

  return {
    totalUsers,
    newUsers7d,
    newUsers30d,
    activeUsers30d: activeQuotationUserIds.length,
    quotesSent30d,
    quotesAccepted30d,
    acceptanceRate,
    suspendedCount,
    publicLinksDisabledCount,
    pricingNotifyCount,
    trialWallSurveyCount,
    generatedAt: now.toISOString(),
  };
}

/**
 * Public accessor for platform metrics (cached for 5 minutes / 300 seconds).
 */
export async function getPlatformMetrics(options?: { forceFresh?: boolean }): Promise<PlatformMetrics> {
  if (options?.forceFresh) {
    return fetchPlatformMetricsInternal();
  }

  try {
    const { unstable_cache } = await import('next/cache');
    const cachedFn = unstable_cache(
      async () => fetchPlatformMetricsInternal(),
      ['admin-platform-metrics-v2'],
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

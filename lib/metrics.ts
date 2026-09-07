import mongoose from 'mongoose';
import dbConnect from './mongodb.ts';
import { Invoice } from '../models/invoice.ts';
import { getManilaStartOfDay, getManilaMonthRange, isInvoiceOverdue } from './dates.ts';

export interface DashboardMetrics {
  currentMonthRevenueCentavos: number;
  currentMonthPaidCount: number;
  outstandingCentavos: number;
  outstandingCount: number;
  paidCentavos: number;
  paidCount: number;
  overdueCentavos: number;
  overdueCount: number;
  draftCount: number;
  draftCentavos: number;
  totalInvoiceCount: number;
}

export interface MetricInvoiceItem {
  status: string;
  totalCentavos: number;
  issueDate?: Date | string | number;
  dueDate?: Date | string | number;
  paidAt?: Date | string | number | null;
}

/**
 * Pure in-memory calculation of invoice metrics (§5.4).
 * Used for unit testing and validation without hitting the database.
 */
export function computeInvoiceMetricsFromList(
  invoices: MetricInvoiceItem[],
  now: Date = new Date()
): DashboardMetrics {
  const { startOfMonth, endOfMonth } = getManilaMonthRange(now);
  const todayStart = getManilaStartOfDay(now);

  const startOfMonthMs = startOfMonth.getTime();
  const endOfMonthMs = endOfMonth.getTime();
  const todayStartMs = todayStart.getTime();

  let currentMonthRevenueCentavos = 0;
  let currentMonthPaidCount = 0;
  let outstandingCentavos = 0;
  let outstandingCount = 0;
  let paidCentavos = 0;
  let paidCount = 0;
  let overdueCentavos = 0;
  let overdueCount = 0;
  let draftCount = 0;
  let draftCentavos = 0;
  let totalInvoiceCount = 0;

  for (const inv of invoices) {
    if (inv.status === 'CANCELLED') {
      continue;
    }

    totalInvoiceCount++;
    const total = Number(inv.totalCentavos ?? 0);

    if (inv.status === 'PAID') {
      paidCentavos += total;
      paidCount++;

      const paidDateMs = inv.paidAt
        ? new Date(inv.paidAt).getTime()
        : inv.issueDate
          ? new Date(inv.issueDate).getTime()
          : null;

      if (paidDateMs !== null && paidDateMs >= startOfMonthMs && paidDateMs <= endOfMonthMs) {
        currentMonthRevenueCentavos += total;
        currentMonthPaidCount++;
      }
    } else if (inv.status === 'SENT') {
      outstandingCentavos += total;
      outstandingCount++;

      if (inv.dueDate) {
        const dueMs = new Date(inv.dueDate).getTime();
        if (dueMs < todayStartMs) {
          overdueCentavos += total;
          overdueCount++;
        }
      }
    } else if (inv.status === 'DRAFT') {
      draftCount++;
      draftCentavos += total;
    }
  }

  return {
    currentMonthRevenueCentavos,
    currentMonthPaidCount,
    outstandingCentavos,
    outstandingCount,
    paidCentavos,
    paidCount,
    overdueCentavos,
    overdueCount,
    draftCount,
    draftCentavos,
    totalInvoiceCount,
  };
}

/**
 * Single aggregation pipeline to compute dashboard metrics for a user (§5.4, M5-T01).
 * Executes exactly ONE aggregation query ($match + $group) to get:
 * - current-month revenue
 * - outstanding (SENT)
 * - paid (all-time)
 * - overdue (SENT and dueDate < today in Asia/Manila)
 */
export async function getDashboardMetrics(
  userId: string,
  now: Date = new Date()
): Promise<DashboardMetrics> {
  await dbConnect();

  const userObjectId =
    mongoose.Types.ObjectId.isValid(userId) && typeof userId === 'string'
      ? new mongoose.Types.ObjectId(userId)
      : userId;

  const { startOfMonth, endOfMonth } = getManilaMonthRange(now);
  const todayStart = getManilaStartOfDay(now);

  const results = await Invoice.aggregate<{
    _id: null;
    totalInvoiceCount: number;
    currentMonthRevenueCentavos: number;
    currentMonthPaidCount: number;
    outstandingCentavos: number;
    outstandingCount: number;
    paidCentavos: number;
    paidCount: number;
    overdueCentavos: number;
    overdueCount: number;
    draftCount: number;
    draftCentavos: number;
  }>([
    {
      $match: {
        userId: userObjectId,
        status: { $ne: 'CANCELLED' },
      },
    },
    {
      $group: {
        _id: null,
        totalInvoiceCount: { $sum: 1 },

        // Current month revenue: PAID with paidAt or issueDate in current month
        currentMonthRevenueCentavos: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'PAID'] },
                  {
                    $or: [
                      {
                        $and: [
                          { $ne: ['$paidAt', null] },
                          { $gte: ['$paidAt', startOfMonth] },
                          { $lte: ['$paidAt', endOfMonth] },
                        ],
                      },
                      {
                        $and: [
                          { $eq: ['$paidAt', null] },
                          { $gte: ['$issueDate', startOfMonth] },
                          { $lte: ['$issueDate', endOfMonth] },
                        ],
                      },
                    ],
                  },
                ],
              },
              '$totalCentavos',
              0,
            ],
          },
        },
        currentMonthPaidCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'PAID'] },
                  {
                    $or: [
                      {
                        $and: [
                          { $ne: ['$paidAt', null] },
                          { $gte: ['$paidAt', startOfMonth] },
                          { $lte: ['$paidAt', endOfMonth] },
                        ],
                      },
                      {
                        $and: [
                          { $eq: ['$paidAt', null] },
                          { $gte: ['$issueDate', startOfMonth] },
                          { $lte: ['$issueDate', endOfMonth] },
                        ],
                      },
                    ],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },

        // Outstanding: SENT invoices
        outstandingCentavos: {
          $sum: {
            $cond: [{ $eq: ['$status', 'SENT'] }, '$totalCentavos', 0],
          },
        },
        outstandingCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'SENT'] }, 1, 0],
          },
        },

        // Paid: all-time PAID invoices
        paidCentavos: {
          $sum: {
            $cond: [{ $eq: ['$status', 'PAID'] }, '$totalCentavos', 0],
          },
        },
        paidCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'PAID'] }, 1, 0],
          },
        },

        // Overdue: SENT invoices with dueDate < todayStart (§5.4)
        overdueCentavos: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'SENT'] },
                  { $lt: ['$dueDate', todayStart] },
                ],
              },
              '$totalCentavos',
              0,
            ],
          },
        },
        overdueCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'SENT'] },
                  { $lt: ['$dueDate', todayStart] },
                ],
              },
              1,
              0,
            ],
          },
        },

        // Drafts
        draftCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'DRAFT'] }, 1, 0],
          },
        },
        draftCentavos: {
          $sum: {
            $cond: [{ $eq: ['$status', 'DRAFT'] }, '$totalCentavos', 0],
          },
        },
      },
    },
  ]);

  if (!results || results.length === 0) {
    return {
      currentMonthRevenueCentavos: 0,
      currentMonthPaidCount: 0,
      outstandingCentavos: 0,
      outstandingCount: 0,
      paidCentavos: 0,
      paidCount: 0,
      overdueCentavos: 0,
      overdueCount: 0,
      draftCount: 0,
      draftCentavos: 0,
      totalInvoiceCount: 0,
    };
  }

  const row = results[0];
  return {
    currentMonthRevenueCentavos: Number(row.currentMonthRevenueCentavos || 0),
    currentMonthPaidCount: Number(row.currentMonthPaidCount || 0),
    outstandingCentavos: Number(row.outstandingCentavos || 0),
    outstandingCount: Number(row.outstandingCount || 0),
    paidCentavos: Number(row.paidCentavos || 0),
    paidCount: Number(row.paidCount || 0),
    overdueCentavos: Number(row.overdueCentavos || 0),
    overdueCount: Number(row.overdueCount || 0),
    draftCount: Number(row.draftCount || 0),
    draftCentavos: Number(row.draftCentavos || 0),
    totalInvoiceCount: Number(row.totalInvoiceCount || 0),
  };
}

export interface RecentInvoiceItem {
  id: string;
  number: string;
  customerName: string;
  totalCentavos: number;
  status: string;
  issueDate: string;
  dueDate: string;
  createdAt: string;
}

/**
 * Fetch top recent invoices for the dashboard activity feed (§5.4, M5-T02).
 * Strictly scoped by userId.
 */
export async function getRecentInvoices(
  userId: string,
  limit: number = 5
): Promise<RecentInvoiceItem[]> {
  await dbConnect();

  const userObjectId =
    mongoose.Types.ObjectId.isValid(userId) && typeof userId === 'string'
      ? new mongoose.Types.ObjectId(userId)
      : userId;

  const docs = await Invoice.find({
    userId: userObjectId,
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('number status customerSnapshot totalCentavos issueDate dueDate createdAt')
    .lean();

  const now = new Date();

  return docs.map((doc) => {
    let displayStatus = String(doc.status ?? 'DRAFT');
    if (displayStatus === 'SENT' && doc.dueDate) {
      if (isInvoiceOverdue(doc.dueDate, 'SENT', now)) {
        displayStatus = 'OVERDUE';
      }
    }

    const customerSnapshot = doc.customerSnapshot as { name?: string } | undefined;

    return {
      id: String(doc._id),
      number: String(doc.number ?? ''),
      customerName: customerSnapshot?.name ? String(customerSnapshot.name) : 'Unnamed Customer',
      totalCentavos: Number(doc.totalCentavos ?? 0),
      status: displayStatus,
      issueDate: doc.issueDate ? new Date(doc.issueDate).toISOString() : new Date().toISOString(),
      dueDate: doc.dueDate ? new Date(doc.dueDate).toISOString() : new Date().toISOString(),
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
    };
  });
}

import mongoose from 'mongoose';
import dbConnect from './mongodb.ts';
import { Quotation } from '../models/quotation.ts';
import { Event } from '../models/event.ts';
import { User } from '../models/user.ts';
import { getDerivedQuotationStatus } from './documents.ts';
import { getManilaMonthRange } from './dates.ts';

export interface DashboardMetrics {
  // The Four Numbers (§1.1, §12 P4-T01)
  quotedThisMonth: {
    count: number;
    totalCentavos: number;
  };
  acceptedThisMonth: {
    count: number;
    totalCentavos: number;
  };
  awaitingResponse: {
    count: number;
    totalCentavos: number; // Potential value of awaiting set
  };

  // Overview counts
  totalQuotationCount: number;
  draftCount: number;
  sentCount: number;
  acceptedCount: number;
  declinedCount: number;
  expiredCount: number;
  totalQuotedCentavos: number;
  acceptedCentavos: number;
}

export interface MetricQuotationItem {
  status: string;
  totalCentavos: number;
  validUntil?: Date | string | number | null;
  sentAt?: Date | string | number | null;
  respondedAt?: Date | string | number | null;
  createdAt?: Date | string | number;
}

/**
 * Pure in-memory calculation of the four numbers dashboard metrics (§1.1, §12 P4-T01).
 * Quoted this month (sentAt in current Manila month)
 * Accepted this month (count + total)
 * Awaiting response (SENT+VIEWED, not expired)
 * Potential value (peso total of awaiting set)
 * Drafts are excluded from every figure.
 */
export function computeQuotationMetricsFromList(
  quotations: MetricQuotationItem[],
  now: Date = new Date()
): DashboardMetrics {
  const { startOfMonth, endOfMonth } = getManilaMonthRange(now);
  const startMs = startOfMonth.getTime();
  const endMs = endOfMonth.getTime();
  const nowMs = now.getTime();

  let draftCount = 0;
  let sentCount = 0;
  let acceptedCount = 0;
  let declinedCount = 0;
  let expiredCount = 0;
  let totalQuotedCentavos = 0;
  let acceptedCentavos = 0;

  let quotedThisMonthCount = 0;
  let quotedThisMonthCentavos = 0;

  let acceptedThisMonthCount = 0;
  let acceptedThisMonthCentavos = 0;

  let awaitingResponseCount = 0;
  let awaitingResponseCentavos = 0;

  for (const q of quotations) {
    const total = Number(q.totalCentavos ?? 0);
    const status = q.status;

    // Drafts are excluded from every figure (§12, P4-T01)
    if (status === 'DRAFT') {
      draftCount++;
      continue;
    }

    // 1. Quoted this month: quotations with sentAt in current Asia/Manila month
    if (q.sentAt) {
      const sentMs = new Date(q.sentAt).getTime();
      if (sentMs >= startMs && sentMs <= endMs) {
        quotedThisMonthCount++;
        quotedThisMonthCentavos += total;
      }
    }

    // 2. Accepted this month: status ACCEPTED and respondedAt (or sentAt fallback) in current Asia/Manila month
    if (status === 'ACCEPTED') {
      acceptedCount++;
      acceptedCentavos += total;
      totalQuotedCentavos += total;

      const dateToCheck = q.respondedAt
        ? new Date(q.respondedAt).getTime()
        : (q.sentAt ? new Date(q.sentAt).getTime() : 0);

      if (dateToCheck >= startMs && dateToCheck <= endMs) {
        acceptedThisMonthCount++;
        acceptedThisMonthCentavos += total;
      }
    } else if (status === 'SENT' || status === 'VIEWED') {
      totalQuotedCentavos += total;

      // Check expired: validUntil < now
      const isExpired = q.validUntil && new Date(q.validUntil).getTime() < nowMs;
      if (isExpired) {
        expiredCount++;
      } else {
        // 3. Awaiting response (SENT+VIEWED, not expired)
        // 4. Potential value (peso total of awaiting set)
        sentCount++;
        awaitingResponseCount++;
        awaitingResponseCentavos += total;
      }
    } else if (status === 'DECLINED') {
      declinedCount++;
      totalQuotedCentavos += total;
    }
  }

  return {
    quotedThisMonth: {
      count: quotedThisMonthCount,
      totalCentavos: quotedThisMonthCentavos,
    },
    acceptedThisMonth: {
      count: acceptedThisMonthCount,
      totalCentavos: acceptedThisMonthCentavos,
    },
    awaitingResponse: {
      count: awaitingResponseCount,
      totalCentavos: awaitingResponseCentavos,
    },
    totalQuotationCount: quotations.length,
    draftCount,
    sentCount,
    acceptedCount,
    declinedCount,
    expiredCount,
    totalQuotedCentavos,
    acceptedCentavos,
  };
}

/**
 * Aggregation to compute the four numbers metrics for a user (§12, P4-T01).
 * Strictly userId-scoped (§4.1).
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

  const quotations = await Quotation.find({ userId: userObjectId })
    .select('status totalCentavos validUntil sentAt respondedAt')
    .lean();

  return computeQuotationMetricsFromList(quotations, now);
}

export interface RecentQuotationItem {
  id: string;
  number: string;
  customerName: string;
  totalCentavos: number;
  currency?: string;
  status: string;
  issueDate: string;
  validUntil: string;
  createdAt: string;
}

/**
 * Fetch top recent quotations for the dashboard activity feed.
 * Strictly scoped by userId.
 */
export async function getRecentQuotations(
  userId: string,
  limit: number = 5
): Promise<RecentQuotationItem[]> {
  await dbConnect();

  const userObjectId =
    mongoose.Types.ObjectId.isValid(userId) && typeof userId === 'string'
      ? new mongoose.Types.ObjectId(userId)
      : userId;

  const docs = await Quotation.find({
    userId: userObjectId,
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('number currency status customerSnapshot totalCentavos issueDate validUntil createdAt')
    .lean();

  return docs.map((doc) => {
    const displayStatus = getDerivedQuotationStatus(doc.status, doc.validUntil);

    const customerSnapshot = doc.customerSnapshot as { name?: string } | undefined;

    return {
      id: String(doc._id),
      number: String(doc.number ?? ''),
      customerName: customerSnapshot?.name ? String(customerSnapshot.name) : 'Unnamed Client',
      totalCentavos: Number(doc.totalCentavos ?? 0),
      currency: doc.currency ? String(doc.currency) : 'PHP',
      status: displayStatus,
      issueDate: doc.issueDate ? new Date(doc.issueDate).toISOString() : new Date().toISOString(),
      validUntil: doc.validUntil ? new Date(doc.validUntil).toISOString() : new Date().toISOString(),
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
    };
  });
}

export interface NeedsAttentionItem {
  id: string;
  quotationId: string;
  quotationNumber: string;
  clientName: string;
  type: 'ACCEPTED' | 'DECLINED' | 'VIEWED';
  actor: 'CLIENT';
  createdAt: string;
  metadata?: Record<string, unknown>;
  isUnread: boolean;
}

export interface NeedsAttentionData {
  items: NeedsAttentionItem[];
  unseenCount: number;
  lastSeenEventsAt: string | null;
}

export interface RawAttentionEvent {
  id: string;
  quotationId: string;
  quotationNumber?: string;
  clientName?: string;
  type: 'ACCEPTED' | 'DECLINED' | 'VIEWED';
  actor: string;
  createdAt: Date | string;
  metadata?: Record<string, unknown>;
}

/**
 * Pure helper to calculate unread status and count against lastSeenEventsAt (§12, P3-T04).
 */
export function filterUnseenAttentionEvents<T extends RawAttentionEvent>(
  events: T[],
  lastSeenEventsAt: Date | string | null | undefined
): { unseenCount: number; items: Array<T & { isUnread: boolean }> } {
  const lastSeenMs = lastSeenEventsAt ? new Date(lastSeenEventsAt).getTime() : 0;

  let unseenCount = 0;
  const items = events.map((event) => {
    const eventMs = new Date(event.createdAt).getTime();
    const isUnread = !lastSeenMs || eventMs > lastSeenMs;
    if (isUnread) {
      unseenCount++;
    }
    return {
      ...event,
      isUnread,
    };
  });

  return { unseenCount, items };
}

/**
 * Fetches recent attention events (ACCEPTED, DECLINED, VIEWED) for the owner dashboard.
 * Strictly userId-scoped (§4.1, §12 P3-T04).
 */
export async function getNeedsAttentionData(userId: string): Promise<NeedsAttentionData> {
  await dbConnect();

  const userObjectId =
    mongoose.Types.ObjectId.isValid(userId) && typeof userId === 'string'
      ? new mongoose.Types.ObjectId(userId)
      : userId;

  const userDoc = await User.findById(userObjectId).select('lastSeenEventsAt').lean();
  const lastSeenEventsAt = userDoc?.lastSeenEventsAt ? new Date(userDoc.lastSeenEventsAt) : null;

  // Up to 10 recent client events
  const events = await Event.find({
    userId: userObjectId,
    actor: 'CLIENT',
    type: { $in: ['ACCEPTED', 'DECLINED', 'VIEWED'] },
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  if (!events || events.length === 0) {
    return {
      items: [],
      unseenCount: 0,
      lastSeenEventsAt: lastSeenEventsAt ? lastSeenEventsAt.toISOString() : null,
    };
  }

  // Double-check userId-scoped quotation lookup
  const quotationIds = events.map((e) => e.quotationId);
  const quotations = await Quotation.find({
    _id: { $in: quotationIds },
    userId: userObjectId,
  })
    .select('number customerSnapshot')
    .lean();

  const quotationMap = new Map(
    quotations.map((q) => [String(q._id), q])
  );

  const rawItems: RawAttentionEvent[] = events.map((event) => {
    const quote = quotationMap.get(String(event.quotationId));
    const customerSnapshot = quote?.customerSnapshot as { name?: string } | undefined;
    const clientName =
      (event.metadata?.respondedByName as string) ||
      customerSnapshot?.name ||
      'Client';

    return {
      id: String(event._id),
      quotationId: String(event.quotationId),
      quotationNumber: quote?.number ? String(quote.number) : 'Quotation',
      clientName,
      type: event.type as 'ACCEPTED' | 'DECLINED' | 'VIEWED',
      actor: 'CLIENT',
      createdAt: event.createdAt ? new Date(event.createdAt).toISOString() : new Date().toISOString(),
      metadata: (event.metadata as Record<string, unknown>) || {},
    };
  });

  const { unseenCount, items } = filterUnseenAttentionEvents(rawItems, lastSeenEventsAt);

  return {
    items: items as NeedsAttentionItem[],
    unseenCount,
    lastSeenEventsAt: lastSeenEventsAt ? lastSeenEventsAt.toISOString() : null,
  };
}

/**
 * Returns the count of unseen attention events since owner's lastSeenEventsAt.
 * Strictly userId-scoped (§4.1, §12 P3-T04).
 */
export async function getUnseenAttentionCount(userId: string): Promise<number> {
  await dbConnect();

  const userObjectId =
    mongoose.Types.ObjectId.isValid(userId) && typeof userId === 'string'
      ? new mongoose.Types.ObjectId(userId)
      : userId;

  const userDoc = await User.findById(userObjectId).select('lastSeenEventsAt').lean();
  const lastSeenEventsAt = userDoc?.lastSeenEventsAt ? new Date(userDoc.lastSeenEventsAt) : null;

  const query: Record<string, unknown> = {
    userId: userObjectId,
    actor: 'CLIENT',
    type: { $in: ['ACCEPTED', 'DECLINED', 'VIEWED'] },
  };

  if (lastSeenEventsAt) {
    query.createdAt = { $gt: lastSeenEventsAt };
  }

  const count = await Event.countDocuments(query);
  return count;
}


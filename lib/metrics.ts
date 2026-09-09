import mongoose from 'mongoose';
import dbConnect from './mongodb.ts';
import { Quotation } from '../models/quotation.ts';
import { Event } from '../models/event.ts';
import { User } from '../models/user.ts';
import { getDerivedQuotationStatus } from './documents.ts';

export interface DashboardMetrics {
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
  validUntil?: Date | string | number;
}

/**
 * Pure in-memory calculation of quotation metrics.
 * Used for unit testing and validation without hitting the database.
 */
export function computeQuotationMetricsFromList(
  quotations: MetricQuotationItem[],
  now: Date = new Date()
): DashboardMetrics {
  let draftCount = 0;
  let sentCount = 0;
  let acceptedCount = 0;
  let declinedCount = 0;
  let expiredCount = 0;
  let totalQuotedCentavos = 0;
  let acceptedCentavos = 0;

  const nowMs = now.getTime();

  for (const q of quotations) {
    const total = Number(q.totalCentavos ?? 0);

    let status = q.status;
    if ((status === 'SENT' || status === 'VIEWED') && q.validUntil) {
      if (new Date(q.validUntil).getTime() < nowMs) {
        status = 'EXPIRED';
      }
    }

    switch (status) {
      case 'DRAFT':
        draftCount++;
        break;
      case 'SENT':
      case 'VIEWED':
        sentCount++;
        totalQuotedCentavos += total;
        break;
      case 'ACCEPTED':
        acceptedCount++;
        totalQuotedCentavos += total;
        acceptedCentavos += total;
        break;
      case 'DECLINED':
        declinedCount++;
        totalQuotedCentavos += total;
        break;
      case 'EXPIRED':
        expiredCount++;
        totalQuotedCentavos += total;
        break;
    }
  }

  return {
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
 * Aggregation pipeline to compute dashboard quotation metrics for a user.
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
    .select('status totalCentavos validUntil')
    .lean();

  return computeQuotationMetricsFromList(quotations, now);
}

export interface RecentQuotationItem {
  id: string;
  number: string;
  customerName: string;
  totalCentavos: number;
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
    .select('number status customerSnapshot totalCentavos issueDate validUntil createdAt')
    .lean();

  return docs.map((doc) => {
    const displayStatus = getDerivedQuotationStatus(doc.status, doc.validUntil);

    const customerSnapshot = doc.customerSnapshot as { name?: string } | undefined;

    return {
      id: String(doc._id),
      number: String(doc.number ?? ''),
      customerName: customerSnapshot?.name ? String(customerSnapshot.name) : 'Unnamed Client',
      totalCentavos: Number(doc.totalCentavos ?? 0),
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


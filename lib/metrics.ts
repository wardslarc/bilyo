import mongoose from 'mongoose';
import dbConnect from './mongodb.ts';
import { Quotation } from '../models/quotation.ts';
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

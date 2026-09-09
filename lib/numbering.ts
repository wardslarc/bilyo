import type { Types } from 'mongoose';
import { Counter } from '../models/counter.ts';
import type { CounterKind } from '@/types';
import dbConnect from './mongodb.ts';
import { getManilaYear } from './dates.ts';

/**
 * Formats a quotation sequence number into Q-YYYY-NNNN.
 * Padded with 4 digits minimum (e.g. Q-2026-0001, Q-2026-0012).
 */
export function formatQuotationNumber(year: number, seq: number): string {
  const padded = String(seq).padStart(4, '0');
  return `Q-${year}-${padded}`;
}

/**
 * Generates an atomic sequential document number per user (§6.3).
 * Format: Q-YYYY-NNNN (e.g. Q-2026-0012)
 * Sequence is per user, per calendar year in Asia/Manila, resetting each January.
 * Never reused, never renumbered.
 */
export async function nextNumber(
  userId: string | Types.ObjectId,
  kind: CounterKind = 'QUOTATION',
  refDate: Date = new Date()
): Promise<string> {
  await dbConnect();

  const year = getManilaYear(refDate);

  const counter = await Counter.findOneAndUpdate(
    { userId, kind, year },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  return formatQuotationNumber(year, counter.seq);
}

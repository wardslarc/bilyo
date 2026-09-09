import type { Types } from 'mongoose';
import { Counter } from '../models/counter.ts';
import type { CounterKind } from '@/types';
import dbConnect from './mongodb.ts';

const KIND_PREFIX: Record<CounterKind, string> = {
  QUOTATION: 'QUO-',
};

/**
 * Generates an atomic sequential document number per user (§5.3).
 * Format: QUO-000001
 * Never reused, never renumbered.
 */
export async function nextNumber(
  userId: string | Types.ObjectId,
  kind: CounterKind
): Promise<string> {
  await dbConnect();

  const counter = await Counter.findOneAndUpdate(
    { userId, kind },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  const prefix = KIND_PREFIX[kind];
  const padded = String(counter.seq).padStart(6, '0');

  return `${prefix}${padded}`;
}

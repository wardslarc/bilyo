import type { Types } from 'mongoose';
import dbConnect from './mongodb.ts';
import { Event } from '../models/event.ts';
import type { EventType, EventActor, IEvent } from '@/types';

export interface RecordEventInput {
  quotationId: string | Types.ObjectId;
  userId: string | Types.ObjectId;
  type: EventType;
  actor: EventActor;
  metadata?: Record<string, unknown>;
}

/**
 * Appends a row to events (§6.6, §7).
 * Events are append-only. There is no update path and no delete path.
 */
export async function recordEvent(input: RecordEventInput): Promise<IEvent> {
  await dbConnect();

  const event = await Event.create({
    quotationId: input.quotationId,
    userId: input.userId,
    type: input.type,
    actor: input.actor,
    metadata: input.metadata || {},
  });

  return event;
}

/**
 * Retrieves the event timeline for a quotation, scoped by userId (§4.1, §6.6).
 * Sorted chronologically ascending (oldest first).
 */
export async function getQuotationEvents(
  quotationId: string | Types.ObjectId,
  userId: string | Types.ObjectId
): Promise<IEvent[]> {
  await dbConnect();

  return Event.find({
    quotationId,
    userId,
  })
    .sort({ createdAt: 1 })
    .lean();
}

/**
 * Check if an event type already exists for a quotation (§6.6).
 */
export async function hasQuotationEvent(
  quotationId: string | Types.ObjectId,
  type: EventType
): Promise<boolean> {
  await dbConnect();

  const found = await Event.findOne({
    quotationId,
    type,
  })
    .select('_id')
    .lean();

  return Boolean(found);
}


import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Event } from '../models/event.ts';
import { recordEvent, getQuotationEvents } from '../lib/events.ts';
import dbConnect from '../lib/mongodb.ts';

describe('Event Collection & Audit Trail (§6.6, P2-T03)', () => {
  const testUserId = new mongoose.Types.ObjectId();
  const testQuotationId = new mongoose.Types.ObjectId();
  let dbAvailable = false;

  after(async () => {
    if (dbAvailable) {
      try {
        await Event.deleteMany({ userId: testUserId });
        await mongoose.disconnect();
      } catch {}
    }
  });

  test('schema enforces required fields and valid enum values', async () => {
    const validEvent = new Event({
      quotationId: testQuotationId,
      userId: testUserId,
      type: 'CREATED',
      actor: 'OWNER',
      metadata: { source: 'test' },
    });

    await validEvent.validate();
    assert.strictEqual(validEvent.type, 'CREATED');
    assert.strictEqual(validEvent.actor, 'OWNER');
    assert.deepStrictEqual(validEvent.metadata, { source: 'test' });
  });

  test('schema rejects invalid event types and actors', async () => {
    const invalidType = new Event({
      quotationId: testQuotationId,
      userId: testUserId,
      type: 'INVALID_TYPE',
      actor: 'OWNER',
    });
    let typeError: mongoose.Error.ValidationError | null = null;
    try {
      await invalidType.validate();
    } catch (err) {
      typeError = err as mongoose.Error.ValidationError;
    }
    assert.ok(typeError?.errors?.type);

    const invalidActor = new Event({
      quotationId: testQuotationId,
      userId: testUserId,
      type: 'SENT',
      actor: 'HACKER',
    });
    let actorError: mongoose.Error.ValidationError | null = null;
    try {
      await invalidActor.validate();
    } catch (err) {
      actorError = err as mongoose.Error.ValidationError;
    }
    assert.ok(actorError?.errors?.actor);
  });

  test('recordEvent and getQuotationEvents produce rows in order (P2-T03 acceptance)', async () => {
    try {
      await dbConnect();
      dbAvailable = true;
    } catch (err) {
      console.warn('MongoDB not available, skipping live DB test:', (err as Error).message);
      return;
    }

    const quotationId = new mongoose.Types.ObjectId();

    // 1. Record CREATED event
    const event1 = await recordEvent({
      quotationId,
      userId: testUserId,
      type: 'CREATED',
      actor: 'OWNER',
      metadata: { initialDraft: true },
    });

    assert.ok(event1._id);
    assert.strictEqual(event1.type, 'CREATED');
    assert.strictEqual(event1.actor, 'OWNER');

    // 2. Record SENT event
    const event2 = await recordEvent({
      quotationId,
      userId: testUserId,
      type: 'SENT',
      actor: 'OWNER',
      metadata: { publicCode: '123456789012' },
    });

    assert.ok(event2._id);
    assert.strictEqual(event2.type, 'SENT');
    assert.strictEqual(event2.actor, 'OWNER');

    // 3. Fetch events in chronological order
    const events = await getQuotationEvents(quotationId, testUserId);
    assert.strictEqual(events.length, 2);
    assert.strictEqual(events[0].type, 'CREATED');
    assert.strictEqual(events[1].type, 'SENT');
    assert.strictEqual(events[0].actor, 'OWNER');
    assert.strictEqual(events[1].actor, 'OWNER');
    assert.ok(events[0].createdAt <= events[1].createdAt);

    // 4. Query with a different userId returns empty (userId-scoping check §4.1)
    const otherUserId = new mongoose.Types.ObjectId();
    const isolatedEvents = await getQuotationEvents(quotationId, otherUserId);
    assert.strictEqual(isolatedEvents.length, 0);
  });

  test('no update or delete export paths in lib/events.ts', async () => {
    const eventsModule = await import('../lib/events.ts');
    const exportedKeys = Object.keys(eventsModule);

    // Ensure no update or delete functions are exported
    assert.strictEqual(exportedKeys.some((k) => k.toLowerCase().includes('update')), false);
    assert.strictEqual(exportedKeys.some((k) => k.toLowerCase().includes('delete')), false);
    assert.strictEqual(exportedKeys.some((k) => k.toLowerCase().includes('remove')), false);
  });
});

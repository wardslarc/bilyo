import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterUnseenAttentionEvents,
  type RawAttentionEvent,
} from '../lib/metrics.ts';

describe('Needs Attention In-App Notifications (§12, P3-T04)', () => {
  const sampleEvents: RawAttentionEvent[] = [
    {
      id: 'evt-1',
      quotationId: 'quote-1',
      quotationNumber: 'Q-2026-0003',
      clientName: 'Alice Johnson',
      type: 'ACCEPTED',
      actor: 'CLIENT',
      createdAt: '2026-09-10T14:30:00.000Z',
    },
    {
      id: 'evt-2',
      quotationId: 'quote-2',
      quotationNumber: 'Q-2026-0002',
      clientName: 'Bob Smith',
      type: 'DECLINED',
      actor: 'CLIENT',
      createdAt: '2026-09-10T10:00:00.000Z',
      metadata: { reason: 'Budget constraints' },
    },
    {
      id: 'evt-3',
      quotationId: 'quote-3',
      quotationNumber: 'Q-2026-0001',
      clientName: 'Charlie Brown',
      type: 'VIEWED',
      actor: 'CLIENT',
      createdAt: '2026-09-09T08:00:00.000Z',
    },
  ];

  test('returns 0 unseenCount when events list is empty', () => {
    const result = filterUnseenAttentionEvents([], null);
    assert.strictEqual(result.unseenCount, 0);
    assert.strictEqual(result.items.length, 0);
  });

  test('marks all events as unread when owner has never seen events (lastSeenEventsAt is null)', () => {
    const result = filterUnseenAttentionEvents(sampleEvents, null);
    assert.strictEqual(result.unseenCount, 3);
    assert.strictEqual(result.items.length, 3);
    assert.strictEqual(result.items[0]?.isUnread, true);
    assert.strictEqual(result.items[1]?.isUnread, true);
    assert.strictEqual(result.items[2]?.isUnread, true);
  });

  test('correctly splits unread and read events around lastSeenEventsAt timestamp', () => {
    // Seen after evt-2 (10:00) but before evt-1 (14:30)
    const lastSeen = '2026-09-10T12:00:00.000Z';
    const result = filterUnseenAttentionEvents(sampleEvents, lastSeen);

    assert.strictEqual(result.unseenCount, 1);
    assert.strictEqual(result.items[0]?.isUnread, true); // evt-1 (14:30) > 12:00
    assert.strictEqual(result.items[1]?.isUnread, false); // evt-2 (10:00) < 12:00
    assert.strictEqual(result.items[2]?.isUnread, false); // evt-3 (08:00) < 12:00
  });

  test('returns 0 unread when lastSeenEventsAt is newer than all events', () => {
    const lastSeen = new Date('2026-09-11T00:00:00.000Z');
    const result = filterUnseenAttentionEvents(sampleEvents, lastSeen);

    assert.strictEqual(result.unseenCount, 0);
    assert.strictEqual(result.items[0]?.isUnread, false);
    assert.strictEqual(result.items[1]?.isUnread, false);
    assert.strictEqual(result.items[2]?.isUnread, false);
  });

  test('handles Date objects as well as ISO string timestamps for lastSeenEventsAt', () => {
    const lastSeenDate = new Date('2026-09-10T09:00:00.000Z');
    const result = filterUnseenAttentionEvents(sampleEvents, lastSeenDate);

    // evt-1 (14:30) and evt-2 (10:00) are > 09:00 -> 2 unread
    assert.strictEqual(result.unseenCount, 2);
    assert.strictEqual(result.items[0]?.isUnread, true);
    assert.strictEqual(result.items[1]?.isUnread, true);
    assert.strictEqual(result.items[2]?.isUnread, false);
  });
});

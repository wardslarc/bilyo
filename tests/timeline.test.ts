import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  getEventTitle,
  getActorLabel,
  formatTimelineUrl,
  sortEventsChronological,
  serializeEvent,
  type TimelineEvent,
} from '../lib/timeline.ts';

describe('Quotation Detail Timeline & Copy Link (§12, P3-T05)', () => {
  describe('Event Title & Actor Presentation', () => {
    test('maps all lifecycle event types to human-readable titles', () => {
      assert.strictEqual(getEventTitle('CREATED'), 'Quotation Created');
      assert.strictEqual(getEventTitle('SENT'), 'Sent to Client');
      assert.strictEqual(getEventTitle('VIEWED'), 'Viewed by Client');
      assert.strictEqual(getEventTitle('ACCEPTED'), 'Quotation Accepted');
      assert.strictEqual(getEventTitle('DECLINED'), 'Quotation Declined');
      assert.strictEqual(getEventTitle('MARKED_PAID'), 'Marked as Paid');
      assert.strictEqual(getEventTitle('UNMARKED_PAID'), 'Payment Status Cleared');
      assert.strictEqual(getEventTitle('LINK_REVOKED'), 'Public Link Revoked');
    });

    test('maps actor types accurately with client name attribution', () => {
      assert.strictEqual(getActorLabel('OWNER'), 'You');
      assert.strictEqual(getActorLabel('ADMIN'), 'Platform Admin');
      assert.strictEqual(getActorLabel('SYSTEM'), 'System');
      assert.strictEqual(getActorLabel('CLIENT'), 'Client');
      assert.strictEqual(
        getActorLabel('CLIENT', { respondedByName: 'Maria Santos' }),
        'Client (Maria Santos)'
      );
    });
  });

  describe('Chronological Sorting (Oldest First)', () => {
    test('sorts events chronologically from oldest to newest', () => {
      const unorderedEvents: TimelineEvent[] = [
        {
          id: 'evt-accepted',
          type: 'ACCEPTED',
          actor: 'CLIENT',
          createdAt: '2026-09-10T15:00:00.000Z',
        },
        {
          id: 'evt-created',
          type: 'CREATED',
          actor: 'OWNER',
          createdAt: '2026-09-10T12:00:00.000Z',
        },
        {
          id: 'evt-sent',
          type: 'SENT',
          actor: 'OWNER',
          createdAt: '2026-09-10T13:00:00.000Z',
        },
        {
          id: 'evt-viewed',
          type: 'VIEWED',
          actor: 'CLIENT',
          createdAt: '2026-09-10T14:00:00.000Z',
        },
      ];

      const sorted = sortEventsChronological(unorderedEvents);

      assert.strictEqual(sorted[0]?.id, 'evt-created');
      assert.strictEqual(sorted[1]?.id, 'evt-sent');
      assert.strictEqual(sorted[2]?.id, 'evt-viewed');
      assert.strictEqual(sorted[3]?.id, 'evt-accepted');
    });
  });

  describe('formatTimelineUrl', () => {
    test('constructs complete public link URL with code', () => {
      const publicCode = 'abc123XYZ456';
      const origin = 'https://bilyo.ph';
      const url = formatTimelineUrl(publicCode, origin);

      assert.strictEqual(url, 'https://bilyo.ph/q/abc123XYZ456');
    });
  });

  describe('serializeEvent', () => {
    test('serializes ObjectId and Date instances into string representations', () => {
      const raw = {
        _id: '654321654321654321654321',
        quotationId: '123456123456123456123456',
        type: 'SENT',
        actor: 'OWNER',
        metadata: { channel: 'copy_link' },
        createdAt: new Date('2026-09-10T08:30:00.000Z'),
      };

      const serialized = serializeEvent(raw);

      assert.strictEqual(serialized.id, '654321654321654321654321');
      assert.strictEqual(serialized.quotationId, '123456123456123456123456');
      assert.strictEqual(serialized.type, 'SENT');
      assert.strictEqual(serialized.actor, 'OWNER');
      assert.strictEqual(serialized.createdAt, '2026-09-10T08:30:00.000Z');
      assert.deepStrictEqual(serialized.metadata, { channel: 'copy_link' });
    });
  });
});

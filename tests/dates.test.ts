import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, formatDateTime, isInvoiceOverdue } from '../lib/dates.ts';

describe('lib/dates.ts', () => {
  describe('formatDate', () => {
    test('formats dates in Asia/Manila timezone as Month Day, Year', () => {
      // 2026-09-30T12:00:00Z is 2026-09-30 20:00 in Manila (UTC+8)
      const date = new Date('2026-09-30T12:00:00Z');
      assert.strictEqual(formatDate(date), 'September 30, 2026');
    });

    test('handles UTC day roll-over in Asia/Manila', () => {
      // 2026-09-29T18:00:00Z is 2026-09-30 02:00 AM in Manila
      const date = new Date('2026-09-29T18:00:00Z');
      assert.strictEqual(formatDate(date), 'September 30, 2026');
    });

    test('handles invalid dates gracefully', () => {
      assert.strictEqual(formatDate('invalid'), 'Invalid Date');
    });
  });

  describe('formatDateTime', () => {
    test('formats dates with time in Asia/Manila', () => {
      // 2026-09-30T06:30:00Z is 2:30 PM Manila time
      const date = new Date('2026-09-30T06:30:00Z');
      assert.strictEqual(formatDateTime(date), 'September 30, 2026 at 2:30 PM');
    });
  });

  describe('isInvoiceOverdue', () => {
    test('returns false if status is not SENT', () => {
      const pastDue = new Date('2020-01-01T00:00:00Z');
      assert.strictEqual(isInvoiceOverdue(pastDue, 'DRAFT'), false);
      assert.strictEqual(isInvoiceOverdue(pastDue, 'PAID'), false);
      assert.strictEqual(isInvoiceOverdue(pastDue, 'CANCELLED'), false);
    });

    test('derives overdue when status is SENT and dueDate < today', () => {
      const now = new Date('2026-09-15T10:00:00Z');
      const pastDueDate = new Date('2026-09-10T00:00:00Z');
      const futureDueDate = new Date('2026-09-20T00:00:00Z');

      assert.strictEqual(isInvoiceOverdue(pastDueDate, 'SENT', now), true);
      assert.strictEqual(isInvoiceOverdue(futureDueDate, 'SENT', now), false);
    });
  });
});

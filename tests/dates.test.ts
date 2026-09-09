import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, formatDateTime } from '../lib/dates.ts';

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
});

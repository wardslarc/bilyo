import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, formatDateTime, getManilaYear } from '../lib/dates.ts';

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

  describe('getManilaYear', () => {
    test('returns correct calendar year for standard Manila dates', () => {
      const date = new Date('2026-06-15T12:00:00Z');
      assert.strictEqual(getManilaYear(date), 2026);
    });

    test('handles New Year boundary between UTC and Asia/Manila (UTC+8)', () => {
      // 2026-12-31T15:59:59Z is 2026-12-31 23:59:59 in Manila (Year 2026)
      const endOf2026 = new Date('2026-12-31T15:59:59Z');
      assert.strictEqual(getManilaYear(endOf2026), 2026);

      // 2026-12-31T16:00:00Z is 2027-01-01 00:00:00 in Manila (Year 2027)
      const startOf2027 = new Date('2026-12-31T16:00:00Z');
      assert.strictEqual(getManilaYear(startOf2027), 2027);
    });
  });
});

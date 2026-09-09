import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { nextNumber, formatQuotationNumber } from '../lib/numbering.ts';
import { Counter } from '../models/counter.ts';
import dbConnect from '../lib/mongodb.ts';

describe('lib/numbering.ts', () => {
  describe('formatQuotationNumber', () => {
    test('formats sequence number with 4-digit zero padding and year prefix (§6.3)', () => {
      assert.strictEqual(formatQuotationNumber(2026, 1), 'Q-2026-0001');
      assert.strictEqual(formatQuotationNumber(2026, 12), 'Q-2026-0012');
      assert.strictEqual(formatQuotationNumber(2026, 999), 'Q-2026-0999');
      assert.strictEqual(formatQuotationNumber(2026, 1000), 'Q-2026-1000');
    });

    test('first quote of 2027 formats as Q-2027-0001', () => {
      assert.strictEqual(formatQuotationNumber(2027, 1), 'Q-2027-0001');
    });
  });

  describe('nextNumber database integration', () => {
    const testUserId = new mongoose.Types.ObjectId();
    let dbAvailable = false;

    after(async () => {
      if (dbAvailable) {
        try {
          await Counter.deleteMany({ userId: testUserId });
          await mongoose.disconnect();
        } catch {}
      }
    });

    test('formats quotation numbers correctly and resets per Manila year', async () => {
      try {
        await dbConnect();
        dbAvailable = true;
      } catch (err) {
        console.warn('MongoDB not available, skipping live DB test:', (err as Error).message);
        return;
      }

      // Year 2026 sequence
      const date2026 = new Date('2026-06-15T00:00:00Z');
      const quo1 = await nextNumber(testUserId, 'QUOTATION', date2026);
      assert.strictEqual(quo1, 'Q-2026-0001');

      const quo2 = await nextNumber(testUserId, 'QUOTATION', date2026);
      assert.strictEqual(quo2, 'Q-2026-0002');

      // Year 2027 resets sequence back to 1
      const date2027 = new Date('2027-01-01T08:00:00+08:00');
      const quo2027_1 = await nextNumber(testUserId, 'QUOTATION', date2027);
      assert.strictEqual(quo2027_1, 'Q-2027-0001');
    });

    test('handles 20 concurrent nextNumber calls with ZERO collisions', async () => {
      try {
        await dbConnect();
        dbAvailable = true;
      } catch (err) {
        console.warn('MongoDB not available, skipping live DB test:', (err as Error).message);
        return;
      }

      const concurrentUserId = new mongoose.Types.ObjectId();
      const TOTAL_CALLS = 20;

      try {
        const promises: Promise<string>[] = [];
        const date2026 = new Date('2026-06-15T00:00:00Z');

        for (let i = 0; i < TOTAL_CALLS; i++) {
          promises.push(nextNumber(concurrentUserId, 'QUOTATION', date2026));
        }

        const results = await Promise.all(promises);

        // Verify count
        assert.strictEqual(results.length, TOTAL_CALLS);

        // Verify zero duplicates
        const uniqueResults = new Set(results);
        assert.strictEqual(uniqueResults.size, TOTAL_CALLS, 'Expected zero duplicates');

        // Verify range
        assert.strictEqual(uniqueResults.has('Q-2026-0001'), true);
        assert.strictEqual(uniqueResults.has('Q-2026-0020'), true);
      } finally {
        await Counter.deleteMany({ userId: concurrentUserId });
      }
    });
  });
});

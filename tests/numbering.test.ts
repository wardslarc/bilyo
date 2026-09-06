import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { nextNumber } from '../lib/numbering.ts';
import { Counter } from '../models/counter.ts';
import dbConnect from '../lib/mongodb.ts';

describe('lib/numbering.ts', () => {
  const testUserId = new mongoose.Types.ObjectId();

  after(async () => {
    await Counter.deleteMany({ userId: testUserId });
    await mongoose.disconnect();
  });

  test('formats quotation and invoice numbers correctly', async () => {
    await dbConnect();

    const inv1 = await nextNumber(testUserId, 'INVOICE');
    assert.strictEqual(inv1, 'INV-000001');

    const inv2 = await nextNumber(testUserId, 'INVOICE');
    assert.strictEqual(inv2, 'INV-000002');

    const quo1 = await nextNumber(testUserId, 'QUOTATION');
    assert.strictEqual(quo1, 'QUO-000001');
  });

  test('handles 1,000 near-concurrent nextNumber calls producing ZERO duplicates', async () => {
    await dbConnect();
    const concurrentUserId = new mongoose.Types.ObjectId();

    try {
      const TOTAL_CALLS = 1000;
      const promises: Promise<string>[] = [];

      for (let i = 0; i < TOTAL_CALLS; i++) {
        promises.push(nextNumber(concurrentUserId, 'INVOICE'));
      }

      const results = await Promise.all(promises);

      // Verify count
      assert.strictEqual(results.length, TOTAL_CALLS);

      // Verify zero duplicates
      const uniqueResults = new Set(results);
      assert.strictEqual(uniqueResults.size, TOTAL_CALLS, 'Expected zero duplicates');

      // Verify minimum and maximum sequence numbers
      assert.strictEqual(uniqueResults.has('INV-000001'), true);
      assert.strictEqual(uniqueResults.has('INV-001000'), true);
    } finally {
      await Counter.deleteMany({ userId: concurrentUserId });
    }
  });
});

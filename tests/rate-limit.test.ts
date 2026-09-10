import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimit } from '../models/rate-limit.ts';

// Set global.mongoose BEFORE importing lib/rate-limit.ts to mock connection
global.mongoose = {
  conn: { connection: { readyState: 1 } } as unknown as typeof import('mongoose'),
  promise: Promise.resolve({ connection: { readyState: 1 } } as unknown as typeof import('mongoose')),
};

const { checkRateLimit, enforceRateLimits } = await import('../lib/rate-limit.ts');

describe('Distributed Rate Limiting (lib/rate-limit.ts)', () => {
  test('checkRateLimit allows requests under threshold and blocks requests over threshold', async () => {
    let mockCount = 0;
    const origFindOneAndUpdate = RateLimit.findOneAndUpdate;

    try {
      // Mock findOneAndUpdate to simulate atomic Mongo updates
      RateLimit.findOneAndUpdate = (async (_query: unknown, update: unknown) => {
        const inc = (update as { $inc?: { count?: number } })?.$inc?.count || 1;
        mockCount += inc;
        return { count: mockCount } as unknown;
      }) as unknown as typeof RateLimit.findOneAndUpdate;

      const opts = {
        key: 'test-user-ip',
        limit: 3,
        windowSeconds: 60,
      };

      // 1st attempt: count 1 <= 3 -> allowed
      const res1 = await checkRateLimit(opts);
      assert.equal(res1.allowed, true);
      assert.equal(res1.remaining, 2);
      assert.equal(res1.count, 1);

      // 2nd attempt: count 2 <= 3 -> allowed
      const res2 = await checkRateLimit(opts);
      assert.equal(res2.allowed, true);
      assert.equal(res2.remaining, 1);
      assert.equal(res2.count, 2);

      // 3rd attempt: count 3 <= 3 -> allowed
      const res3 = await checkRateLimit(opts);
      assert.equal(res3.allowed, true);
      assert.equal(res3.remaining, 0);
      assert.equal(res3.count, 3);

      // 4th attempt: count 4 > 3 -> blocked!
      const res4 = await checkRateLimit(opts);
      assert.equal(res4.allowed, false);
      assert.equal(res4.remaining, 0);
      assert.equal(res4.count, 4);
      assert.ok(res4.error?.includes('Too many requests'));
      assert.ok(res4.resetSeconds > 0);
    } finally {
      RateLimit.findOneAndUpdate = origFindOneAndUpdate;
    }
  });

  test('enforceRateLimits stops at first exceeded limit', async () => {
    let callIndex = 0;
    const origFindOneAndUpdate = RateLimit.findOneAndUpdate;

    try {
      RateLimit.findOneAndUpdate = (async () => {
        callIndex++;
        // 1st limit returns count 1 (allowed), 2nd limit returns count 10 (exceeded)
        return { count: callIndex === 1 ? 1 : 10 } as unknown;
      }) as unknown as typeof RateLimit.findOneAndUpdate;

      const res = await enforceRateLimits([
        { key: 'ip-key', limit: 5, windowSeconds: 60 },
        { key: 'email-key', limit: 3, windowSeconds: 60, errorMessage: 'Email limit reached' },
      ]);

      assert.equal(res.allowed, false);
      assert.equal(res.error, 'Email limit reached');
    } finally {
      RateLimit.findOneAndUpdate = origFindOneAndUpdate;
    }
  });
});

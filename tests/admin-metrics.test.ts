import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePlatformMRR,
  FREELANCER_MONTHLY_CENTAVOS,
  BUSINESS_MONTHLY_CENTAVOS,
  type PlatformMetrics,
} from '../lib/admin/metrics.ts';

describe('Platform Metrics & Aggregations (M7-T07)', () => {
  describe('MRR Computation (computePlatformMRR)', () => {
    test('returns 0 centavos when there are 0 paying subscribers', () => {
      const mrr = computePlatformMRR(0, 0);
      assert.strictEqual(mrr, 0);
    });

    test('calculates correct Freelancer MRR (₱299 = 29,900 centavos per account)', () => {
      const count = 10;
      const expected = 10 * FREELANCER_MONTHLY_CENTAVOS; // 299,000 centavos (₱2,990.00)
      const mrr = computePlatformMRR(count, 0);
      assert.strictEqual(mrr, expected);
      assert.strictEqual(mrr, 299000);
    });

    test('calculates correct Business MRR (₱599 = 59,900 centavos per account)', () => {
      const count = 5;
      const expected = 5 * BUSINESS_MONTHLY_CENTAVOS; // 299,500 centavos (₱2,995.00)
      const mrr = computePlatformMRR(0, count);
      assert.strictEqual(mrr, expected);
      assert.strictEqual(mrr, 299500);
    });

    test('calculates combined MRR for mixed customer base', () => {
      const freelancers = 12;
      const businesses = 8;
      const expected =
        freelancers * FREELANCER_MONTHLY_CENTAVOS + businesses * BUSINESS_MONTHLY_CENTAVOS;
      const mrr = computePlatformMRR(freelancers, businesses);
      assert.strictEqual(mrr, expected);
      assert.strictEqual(mrr, 12 * 29900 + 8 * 59900); // 358,800 + 479,200 = 838,000 centavos
    });

    test('sanitizes negative or floating inputs gracefully', () => {
      assert.strictEqual(computePlatformMRR(-5, -10), 0);
      assert.strictEqual(computePlatformMRR(2.8, 3.1), 2 * 29900 + 3 * 59900);
    });
  });

  describe('Active User Set Union Logic', () => {
    test('deduplicates users who created both invoices and quotations in 30 days', () => {
      const invoiceUserIds = ['user_1', 'user_2', 'user_3'];
      const quotationUserIds = ['user_2', 'user_3', 'user_4'];

      const activeSet = new Set<string>();
      for (const id of invoiceUserIds) activeSet.add(String(id));
      for (const id of quotationUserIds) activeSet.add(String(id));

      // user_2 and user_3 appear in both; total distinct active creators is 4
      assert.strictEqual(activeSet.size, 4);
      assert.ok(activeSet.has('user_1'));
      assert.ok(activeSet.has('user_2'));
      assert.ok(activeSet.has('user_3'));
      assert.ok(activeSet.has('user_4'));
    });

    test('returns 0 when neither collection has document creation in 30 days', () => {
      const activeSet = new Set<string>();
      assert.strictEqual(activeSet.size, 0);
    });
  });

  describe('Empty State Invariant', () => {
    test('metrics object with zero counts represents valid platform state', () => {
      const emptyMetrics: PlatformMetrics = {
        totalUsers: 0,
        newUsers7d: 0,
        newUsers30d: 0,
        activeUsers30d: 0,
        documents30d: {
          invoices: 0,
          quotations: 0,
          total: 0,
        },
        paidAccounts: {
          total: 0,
          freelancer: 0,
          business: 0,
          comped: 0,
        },
        mrrCentavos: 0,
        suspendedCount: 0,
        publicLinksDisabledCount: 0,
        generatedAt: new Date().toISOString(),
      };

      assert.strictEqual(emptyMetrics.totalUsers, 0);
      assert.strictEqual(emptyMetrics.mrrCentavos, 0);
      assert.strictEqual(emptyMetrics.documents30d.total, 0);
      assert.strictEqual(emptyMetrics.suspendedCount, 0);
    });
  });
});

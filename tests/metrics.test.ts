import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getManilaMonthRange } from '../lib/dates.ts';
import {
  computeQuotationMetricsFromList,
  type MetricQuotationItem,
} from '../lib/metrics.ts';

describe('Dashboard Metrics & Aggregation Rules (§5.4, M5-T01)', () => {
  describe('lib/dates.ts Manila month range', () => {
    test('getManilaMonthRange returns correct UTC boundaries for Asia/Manila (UTC+8)', () => {
      // 2026-09-15 12:00:00 UTC = 2026-09-15 20:00:00 Manila
      const refDate = new Date(Date.UTC(2026, 8, 15, 12, 0, 0));
      const { startOfMonth, endOfMonth } = getManilaMonthRange(refDate);

      // Start of Sept in Manila is Sept 1, 2026 00:00:00 GMT+8 -> Aug 31, 2026 16:00:00 UTC
      assert.strictEqual(startOfMonth.toISOString(), '2026-08-31T16:00:00.000Z');

      // End of Sept in Manila is Sept 30, 2026 23:59:59.999 GMT+8 -> Sept 30, 2026 15:59:59.999 UTC
      assert.strictEqual(endOfMonth.toISOString(), '2026-09-30T15:59:59.999Z');
    });

    test('getManilaMonthRange handles year rollover correctly (January)', () => {
      const refDate = new Date(Date.UTC(2026, 0, 10, 0, 0, 0)); // Jan 2026
      const { startOfMonth, endOfMonth } = getManilaMonthRange(refDate);

      assert.strictEqual(startOfMonth.toISOString(), '2025-12-31T16:00:00.000Z');
      assert.strictEqual(endOfMonth.toISOString(), '2026-01-31T15:59:59.999Z');
    });
  });

  describe('computeQuotationMetricsFromList domain calculations', () => {
    const fixedNow = new Date('2026-09-15T04:00:00.000Z'); // 12:00 PM Manila on Sept 15, 2026

    test('returns zero metrics when user has no quotations', () => {
      const metrics = computeQuotationMetricsFromList([], fixedNow);
      assert.strictEqual(metrics.totalQuotationCount, 0);
      assert.strictEqual(metrics.draftCount, 0);
      assert.strictEqual(metrics.sentCount, 0);
      assert.strictEqual(metrics.acceptedCount, 0);
      assert.strictEqual(metrics.declinedCount, 0);
      assert.strictEqual(metrics.expiredCount, 0);
      assert.strictEqual(metrics.totalQuotedCentavos, 0);
      assert.strictEqual(metrics.acceptedCentavos, 0);
    });

    test('accurately categorizes draft, sent, accepted, declined, and expired quotations', () => {
      const quotations: MetricQuotationItem[] = [
        // 1. Accepted -> ₱25,000.00
        {
          status: 'ACCEPTED',
          totalCentavos: 2500000,
        },
        // 2. Sent (still valid) -> ₱15,000.00
        {
          status: 'SENT',
          totalCentavos: 1500000,
          validUntil: '2026-09-20T00:00:00.000Z',
        },
        // 3. Sent (past validUntil -> derived EXPIRED) -> ₱7,500.00
        {
          status: 'SENT',
          totalCentavos: 750000,
          validUntil: '2026-09-10T00:00:00.000Z',
        },
        // 4. Declined -> ₱10,000.00
        {
          status: 'DECLINED',
          totalCentavos: 1000000,
        },
        // 5. Draft -> ₱5,000.00 (not included in totalQuotedCentavos)
        {
          status: 'DRAFT',
          totalCentavos: 500000,
        },
      ];

      const metrics = computeQuotationMetricsFromList(quotations, fixedNow);

      assert.strictEqual(metrics.totalQuotationCount, 5);
      assert.strictEqual(metrics.draftCount, 1);
      assert.strictEqual(metrics.sentCount, 1);
      assert.strictEqual(metrics.acceptedCount, 1);
      assert.strictEqual(metrics.declinedCount, 1);
      assert.strictEqual(metrics.expiredCount, 1);

      // Quoted centavos includes non-drafts: 25,000 + 15,000 + 7,500 + 10,000 = 57,500.00
      assert.strictEqual(metrics.totalQuotedCentavos, 5750000);
      // Accepted centavos: 25,000.00
      assert.strictEqual(metrics.acceptedCentavos, 2500000);
    });
  });

  describe('Dashboard Empty State', () => {
    test('brand-new account: empty state activates when totalQuotationCount === 0', () => {
      const emptyMetrics = computeQuotationMetricsFromList([], new Date());
      const hasQuotations = emptyMetrics.totalQuotationCount > 0;
      assert.strictEqual(hasQuotations, false, 'Brand new account should trigger empty state');
    });
  });
});

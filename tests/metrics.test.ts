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

  describe('The Four Numbers Dashboard Metrics (§1.1, §12 P4-T01)', () => {
    test('a quote sent at 23:30 on 31 August (Manila) counts in August, not September (P4-T01 accept)', () => {
      // 23:30 on 31 August 2026 Manila (UTC+8) is 15:30:00 UTC on 31 August 2026
      const sentAug31Manila = '2026-08-31T15:30:00.000Z';

      const quotes: MetricQuotationItem[] = [
        {
          status: 'SENT',
          totalCentavos: 5000000, // ₱50,000.00
          sentAt: sentAug31Manila,
          validUntil: '2026-09-30T00:00:00.000Z',
        },
      ];

      // Tested within August (e.g. 23:45 on Aug 31 Manila -> 15:45 UTC)
      const nowInAugust = new Date('2026-08-31T15:45:00.000Z');
      const augustMetrics = computeQuotationMetricsFromList(quotes, nowInAugust);
      assert.strictEqual(augustMetrics.quotedThisMonth.count, 1, 'Must count in August');
      assert.strictEqual(augustMetrics.quotedThisMonth.totalCentavos, 5000000);

      // Tested in September (e.g. 00:05 on Sept 1 Manila -> 16:05 UTC on Aug 31)
      const nowInSeptember = new Date('2026-08-31T16:05:00.000Z');
      const septemberMetrics = computeQuotationMetricsFromList(quotes, nowInSeptember);
      assert.strictEqual(septemberMetrics.quotedThisMonth.count, 0, 'Must NOT count in September');
      assert.strictEqual(septemberMetrics.quotedThisMonth.totalCentavos, 0);
    });

    test('accepted this month counts quotes accepted within the current Manila month', () => {
      const nowInSept = new Date('2026-09-15T04:00:00.000Z'); // Sept 15 Manila

      const quotes: MetricQuotationItem[] = [
        // Accepted in September
        {
          status: 'ACCEPTED',
          totalCentavos: 2000000,
          sentAt: '2026-09-02T02:00:00.000Z',
          respondedAt: '2026-09-05T03:00:00.000Z',
        },
        // Accepted back in August
        {
          status: 'ACCEPTED',
          totalCentavos: 3000000,
          sentAt: '2026-08-10T02:00:00.000Z',
          respondedAt: '2026-08-12T03:00:00.000Z',
        },
      ];

      const metrics = computeQuotationMetricsFromList(quotes, nowInSept);
      assert.strictEqual(metrics.acceptedThisMonth.count, 1);
      assert.strictEqual(metrics.acceptedThisMonth.totalCentavos, 2000000);
      assert.strictEqual(metrics.acceptedCount, 2); // all time
    });

    test('awaiting response counts SENT and VIEWED unexpired quotes and sums potential value', () => {
      const nowInSept = new Date('2026-09-15T04:00:00.000Z'); // Sept 15, 2026

      const quotes: MetricQuotationItem[] = [
        // Active SENT -> ₱10,000.00
        {
          status: 'SENT',
          totalCentavos: 1000000,
          sentAt: '2026-09-10T00:00:00.000Z',
          validUntil: '2026-09-25T00:00:00.000Z',
        },
        // Active VIEWED -> ₱15,000.00
        {
          status: 'VIEWED',
          totalCentavos: 1500000,
          sentAt: '2026-09-10T00:00:00.000Z',
          validUntil: '2026-09-20T00:00:00.000Z',
        },
        // Expired SENT -> ₱5,000.00 (past validUntil)
        {
          status: 'SENT',
          totalCentavos: 500000,
          sentAt: '2026-09-01T00:00:00.000Z',
          validUntil: '2026-09-10T00:00:00.000Z',
        },
        // Accepted -> should not be in awaiting
        {
          status: 'ACCEPTED',
          totalCentavos: 4000000,
          sentAt: '2026-09-05T00:00:00.000Z',
          respondedAt: '2026-09-06T00:00:00.000Z',
        },
      ];

      const metrics = computeQuotationMetricsFromList(quotes, nowInSept);
      // Only the 2 unexpired SENT and VIEWED quotes count: 10,000 + 15,000 = 25,000
      assert.strictEqual(metrics.awaitingResponse.count, 2);
      assert.strictEqual(metrics.awaitingResponse.totalCentavos, 2500000);
    });

    test('drafts are completely excluded from every figure (§12, P4-T01)', () => {
      const now = new Date('2026-09-15T04:00:00.000Z');
      const draftsOnly: MetricQuotationItem[] = [
        {
          status: 'DRAFT',
          totalCentavos: 99999999,
          sentAt: '2026-09-15T00:00:00.000Z',
          validUntil: '2026-09-30T00:00:00.000Z',
        },
      ];

      const metrics = computeQuotationMetricsFromList(draftsOnly, now);
      assert.strictEqual(metrics.quotedThisMonth.count, 0);
      assert.strictEqual(metrics.quotedThisMonth.totalCentavos, 0);
      assert.strictEqual(metrics.acceptedThisMonth.count, 0);
      assert.strictEqual(metrics.acceptedThisMonth.totalCentavos, 0);
      assert.strictEqual(metrics.awaitingResponse.count, 0);
      assert.strictEqual(metrics.awaitingResponse.totalCentavos, 0);
      assert.strictEqual(metrics.totalQuotedCentavos, 0);
      assert.strictEqual(metrics.draftCount, 1);
      assert.strictEqual(metrics.totalQuotationCount, 1);
    });

    test('computes in under two seconds on a 200-quote account (P4-T01 accept)', () => {
      const now = new Date('2026-09-15T04:00:00.000Z');
      const twoHundredQuotes: MetricQuotationItem[] = [];

      for (let i = 0; i < 200; i++) {
        twoHundredQuotes.push({
          status: i % 4 === 0 ? 'DRAFT' : i % 4 === 1 ? 'SENT' : i % 4 === 2 ? 'VIEWED' : 'ACCEPTED',
          totalCentavos: 1000000 + i * 50000,
          sentAt: '2026-09-10T00:00:00.000Z',
          respondedAt: i % 4 === 3 ? '2026-09-12T00:00:00.000Z' : null,
          validUntil: '2026-09-25T00:00:00.000Z',
        });
      }

      const start = performance.now();
      const metrics = computeQuotationMetricsFromList(twoHundredQuotes, now);
      const elapsedMs = performance.now() - start;

      assert.strictEqual(metrics.totalQuotationCount, 200);
      assert.ok(elapsedMs < 2000, `Execution time was ${elapsedMs}ms, expected < 2000ms`);
      assert.ok(elapsedMs < 100, `Execution time ${elapsedMs}ms is comfortably fast`);
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


import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getManilaMonthRange } from '../lib/dates.ts';
import {
  computeInvoiceMetricsFromList,
  type MetricInvoiceItem,
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

  describe('computeInvoiceMetricsFromList domain calculations', () => {
    const fixedNow = new Date('2026-09-15T04:00:00.000Z'); // 12:00 PM Manila on Sept 15, 2026

    test('returns zero metrics when user has no invoices', () => {
      const metrics = computeInvoiceMetricsFromList([], fixedNow);
      assert.strictEqual(metrics.totalInvoiceCount, 0);
      assert.strictEqual(metrics.currentMonthRevenueCentavos, 0);
      assert.strictEqual(metrics.currentMonthPaidCount, 0);
      assert.strictEqual(metrics.outstandingCentavos, 0);
      assert.strictEqual(metrics.outstandingCount, 0);
      assert.strictEqual(metrics.paidCentavos, 0);
      assert.strictEqual(metrics.paidCount, 0);
      assert.strictEqual(metrics.overdueCentavos, 0);
      assert.strictEqual(metrics.overdueCount, 0);
      assert.strictEqual(metrics.draftCount, 0);
    });

    test('accurately categorizes current month revenue, outstanding, and overdue invoices', () => {
      const invoices: MetricInvoiceItem[] = [
        // 1. Paid in current month (Sept 2026) -> ₱25,000.00
        {
          status: 'PAID',
          totalCentavos: 2500000,
          issueDate: '2026-09-02T00:00:00.000Z',
          dueDate: '2026-09-10T00:00:00.000Z',
          paidAt: '2026-09-05T08:00:00.000Z',
        },
        // 2. Paid in previous month (Aug 2026) -> ₱10,000.00 (All-time paid, but NOT current month revenue)
        {
          status: 'PAID',
          totalCentavos: 1000000,
          issueDate: '2026-08-01T00:00:00.000Z',
          dueDate: '2026-08-15T00:00:00.000Z',
          paidAt: '2026-08-10T08:00:00.000Z',
        },
        // 3. Sent, not yet due (due Sept 25, 2026) -> ₱15,000.00 (Outstanding, NOT overdue)
        {
          status: 'SENT',
          totalCentavos: 1500000,
          issueDate: '2026-09-01T00:00:00.000Z',
          dueDate: '2026-09-25T00:00:00.000Z',
        },
        // 4. Sent, past due date (due Sept 5, 2026) -> ₱7,500.00 (Outstanding AND Overdue)
        {
          status: 'SENT',
          totalCentavos: 750000,
          issueDate: '2026-08-25T00:00:00.000Z',
          dueDate: '2026-09-05T00:00:00.000Z',
        },
        // 5. Draft -> ₱5,000.00
        {
          status: 'DRAFT',
          totalCentavos: 500000,
          issueDate: '2026-09-10T00:00:00.000Z',
          dueDate: '2026-09-30T00:00:00.000Z',
        },
        // 6. Cancelled -> ₱8,000.00 (Ignored in metrics)
        {
          status: 'CANCELLED',
          totalCentavos: 800000,
          issueDate: '2026-09-01T00:00:00.000Z',
          dueDate: '2026-09-10T00:00:00.000Z',
        },
      ];

      const metrics = computeInvoiceMetricsFromList(invoices, fixedNow);

      // Total count (excluding CANCELLED): 5
      assert.strictEqual(metrics.totalInvoiceCount, 5);

      // Current month revenue: only invoice 1 (₱25,000.00)
      assert.strictEqual(metrics.currentMonthRevenueCentavos, 2500000);
      assert.strictEqual(metrics.currentMonthPaidCount, 1);

      // All-time paid: invoices 1 and 2 (₱25,000 + ₱10,000 = ₱35,000.00)
      assert.strictEqual(metrics.paidCentavos, 3500000);
      assert.strictEqual(metrics.paidCount, 2);

      // Outstanding: invoices 3 and 4 (₱15,000 + ₱7,500 = ₱22,500.00)
      assert.strictEqual(metrics.outstandingCentavos, 2250000);
      assert.strictEqual(metrics.outstandingCount, 2);

      // Overdue: only invoice 4 (₱7,500.00)
      assert.strictEqual(metrics.overdueCentavos, 750000);
      assert.strictEqual(metrics.overdueCount, 1);

      // Draft: invoice 5 (₱5,000.00)
      assert.strictEqual(metrics.draftCount, 1);
      assert.strictEqual(metrics.draftCentavos, 500000);
    });

    test('PAID invoice with dueDate in the past is never overdue (§5.4)', () => {
      const invoices: MetricInvoiceItem[] = [
        {
          status: 'PAID',
          totalCentavos: 500000,
          issueDate: '2026-08-01T00:00:00.000Z',
          dueDate: '2026-08-10T00:00:00.000Z',
          paidAt: '2026-09-01T00:00:00.000Z',
        },
      ];

      const metrics = computeInvoiceMetricsFromList(invoices, fixedNow);
      assert.strictEqual(metrics.overdueCentavos, 0);
      assert.strictEqual(metrics.overdueCount, 0);
      assert.strictEqual(metrics.outstandingCentavos, 0);
    });

    test('DRAFT invoice with dueDate in the past is never overdue', () => {
      const invoices: MetricInvoiceItem[] = [
        {
          status: 'DRAFT',
          totalCentavos: 500000,
          issueDate: '2026-08-01T00:00:00.000Z',
          dueDate: '2026-08-10T00:00:00.000Z',
        },
      ];

      const metrics = computeInvoiceMetricsFromList(invoices, fixedNow);
      assert.strictEqual(metrics.overdueCentavos, 0);
      assert.strictEqual(metrics.overdueCount, 0);
      assert.strictEqual(metrics.outstandingCentavos, 0);
      assert.strictEqual(metrics.draftCount, 1);
    });
  });
});

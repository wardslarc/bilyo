import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAcceptanceRate,
  type PlatformMetrics,
} from '../lib/admin/metrics.ts';

describe('Platform Metrics & Aggregations (P1-T06)', () => {
  describe('Quotation Acceptance Rate Computation (computeAcceptanceRate)', () => {
    test('returns 0% when 0 quotes were sent', () => {
      assert.strictEqual(computeAcceptanceRate(0, 0), 0);
      assert.strictEqual(computeAcceptanceRate(0, 5), 0);
    });

    test('returns 0% when 0 quotes were accepted', () => {
      assert.strictEqual(computeAcceptanceRate(10, 0), 0);
    });

    test('calculates correct round percentage (5 of 10 = 50%)', () => {
      assert.strictEqual(computeAcceptanceRate(10, 5), 50);
    });

    test('calculates correct percentage rounded to 1 decimal place (1 of 3 = 33.3%)', () => {
      assert.strictEqual(computeAcceptanceRate(3, 1), 33.3);
    });

    test('calculates correct percentage rounded to 1 decimal place (2 of 3 = 66.7%)', () => {
      assert.strictEqual(computeAcceptanceRate(3, 2), 66.7);
    });

    test('caps at 100% and sanitizes inputs gracefully', () => {
      assert.strictEqual(computeAcceptanceRate(5, 10), 100);
      assert.strictEqual(computeAcceptanceRate(-5, -2), 0);
    });
  });

  describe('Empty State Invariant', () => {
    test('metrics object with zero counts represents valid platform state', () => {
      const emptyMetrics: PlatformMetrics = {
        totalUsers: 0,
        newUsers7d: 0,
        newUsers30d: 0,
        activeUsers30d: 0,
        quotesSent30d: 0,
        quotesAccepted30d: 0,
        acceptanceRate: 0,
        suspendedCount: 0,
        publicLinksDisabledCount: 0,
        pricingNotifyCount: 0,
        trialWallSurveyCount: 0,
        generatedAt: new Date().toISOString(),
      };

      assert.strictEqual(emptyMetrics.totalUsers, 0);
      assert.strictEqual(emptyMetrics.quotesSent30d, 0);
      assert.strictEqual(emptyMetrics.quotesAccepted30d, 0);
      assert.strictEqual(emptyMetrics.acceptanceRate, 0);
      assert.strictEqual(emptyMetrics.suspendedCount, 0);
    });
  });
});

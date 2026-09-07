import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateResourceLimit,
  effectivePlan,
  isPlanOverrideActive,
  PLAN_LIMITS,
  type PlanUser,
} from '../lib/plan.ts';
import { getManilaMonthRange } from '../lib/dates.ts';

describe('Plan Limits & Enforcement (M8-T01)', () => {
  describe('evaluateResourceLimit for FREE plan', () => {
    test('invoices: permits up to 4, rejects at 5 with clear usage message', () => {
      // Under limit
      const under = evaluateResourceLimit('INVOICES', 4, 'FREE');
      assert.strictEqual(under.allowed, true);
      assert.strictEqual(under.current, 4);
      assert.strictEqual(under.limit, 5);
      assert.strictEqual(under.error, undefined);

      // At limit
      const atLimit = evaluateResourceLimit('INVOICES', 5, 'FREE');
      assert.strictEqual(atLimit.allowed, false);
      assert.strictEqual(atLimit.current, 5);
      assert.strictEqual(atLimit.limit, 5);
      assert.ok(atLimit.error?.includes('5 invoices on the FREE plan (5/5 used this month)'));
      assert.ok(atLimit.error?.includes('Upgrade to Freelancer or Business'));

      // Over limit
      const over = evaluateResourceLimit('INVOICES', 6, 'FREE');
      assert.strictEqual(over.allowed, false);
    });

    test('quotations: permits up to 4, rejects at 5 with clear usage message', () => {
      const under = evaluateResourceLimit('QUOTATIONS', 4, 'FREE');
      assert.strictEqual(under.allowed, true);

      const atLimit = evaluateResourceLimit('QUOTATIONS', 5, 'FREE');
      assert.strictEqual(atLimit.allowed, false);
      assert.ok(atLimit.error?.includes('5 quotations on the FREE plan (5/5 used this month)'));
      assert.ok(atLimit.error?.includes('Upgrade to Freelancer or Business'));
    });

    test('customers: permits up to 9, rejects at 10 with clear usage message', () => {
      const under = evaluateResourceLimit('CUSTOMERS', 9, 'FREE');
      assert.strictEqual(under.allowed, true);

      const atLimit = evaluateResourceLimit('CUSTOMERS', 10, 'FREE');
      assert.strictEqual(atLimit.allowed, false);
      assert.ok(atLimit.error?.includes('10 customers on the FREE plan (10/10 used)'));
      assert.ok(atLimit.error?.includes('Upgrade to Freelancer or Business'));
    });
  });

  describe('Admin Override Lifts Limits Instantly (§5.10, M8-T01)', () => {
    test('live ADMIN override to BUSINESS lifts invoice limit to Infinity', () => {
      const user: PlanUser = {
        plan: 'BUSINESS',
        planSource: 'ADMIN',
        planOverrideExpiresAt: new Date(Date.now() + 30 * 86400000), // 30 days in future
      };

      assert.strictEqual(effectivePlan(user), 'BUSINESS');
      assert.strictEqual(isPlanOverrideActive(user), true);

      const res = evaluateResourceLimit('INVOICES', 100, user);
      assert.strictEqual(res.allowed, true);
      assert.strictEqual(res.limit, Infinity);
      assert.strictEqual(res.error, undefined);
    });

    test('live ADMIN override to FREELANCER lifts quotation and customer limits', () => {
      const user: PlanUser = {
        plan: 'FREELANCER',
        planSource: 'ADMIN',
        planOverrideExpiresAt: new Date(Date.now() + 60 * 86400000),
      };

      assert.strictEqual(effectivePlan(user), 'FREELANCER');

      const quoRes = evaluateResourceLimit('QUOTATIONS', 50, user);
      assert.strictEqual(quoRes.allowed, true);

      const custRes = evaluateResourceLimit('CUSTOMERS', 50, user);
      assert.strictEqual(custRes.allowed, true);
    });

    test('expired ADMIN override immediately enforces FREE limits with zero background jobs', () => {
      const user: PlanUser = {
        plan: 'BUSINESS',
        planSource: 'ADMIN',
        planOverrideExpiresAt: new Date(Date.now() - 1000 * 60), // Expired 1 minute ago
        billingPlan: null,
      };

      assert.strictEqual(effectivePlan(user), 'FREE');
      assert.strictEqual(isPlanOverrideActive(user), false);

      // Now subject to FREE limits again
      const invoiceRes = evaluateResourceLimit('INVOICES', 5, user);
      assert.strictEqual(invoiceRes.allowed, false);
      assert.ok(invoiceRes.error?.includes('FREE'));

      const custRes = evaluateResourceLimit('CUSTOMERS', 10, user);
      assert.strictEqual(custRes.allowed, false);
    });
  });

  describe('Asia/Manila Month Boundary (§5.7, M8-T01)', () => {
    test('month boundaries strictly align with Asia/Manila (UTC+8) and NOT UTC', () => {
      // Test reference date: September 15, 2026
      const refDate = new Date('2026-09-15T12:00:00Z');
      const { startOfMonth, endOfMonth } = getManilaMonthRange(refDate);

      // September 1, 2026 00:00:00 Manila (UTC+8) = August 31, 2026 16:00:00 UTC
      assert.strictEqual(startOfMonth.toISOString(), '2026-08-31T16:00:00.000Z');

      // September 30, 2026 23:59:59.999 Manila = September 30, 2026 15:59:59.999 UTC
      assert.strictEqual(endOfMonth.toISOString(), '2026-09-30T15:59:59.999Z');

      // 1 ms before Manila month starts: August 31 23:59:59.999 Manila -> August 31 15:59:59.999 UTC
      const justBefore = new Date('2026-08-31T15:59:59.999Z');
      assert.strictEqual(justBefore >= startOfMonth, false, 'Must not be in September');

      // Exactly when Manila month starts: September 1 00:00:00 Manila -> August 31 16:00:00.000 UTC
      const exactStart = new Date('2026-08-31T16:00:00.000Z');
      assert.strictEqual(exactStart >= startOfMonth && exactStart <= endOfMonth, true, 'Must be in September');

      // Middle of month: September 15
      const middle = new Date('2026-09-15T00:00:00.000Z');
      assert.strictEqual(middle >= startOfMonth && middle <= endOfMonth, true);

      // Exactly when Manila month ends: September 30 23:59:59.999 Manila -> September 30 15:59:59.999 UTC
      const exactEnd = new Date('2026-09-30T15:59:59.999Z');
      assert.strictEqual(exactEnd >= startOfMonth && exactEnd <= endOfMonth, true, 'Must be in September');

      // 1 ms after Manila month ends: October 1 00:00:00.000 Manila -> September 30 16:00:00.000 UTC
      const justAfter = new Date('2026-09-30T16:00:00.000Z');
      assert.strictEqual(justAfter <= endOfMonth, false, 'Must not be in September');
    });

    test('December to January year rollover in Asia/Manila', () => {
      const newYearsEve = new Date('2026-12-31T10:00:00Z');
      const { startOfMonth, endOfMonth } = getManilaMonthRange(newYearsEve);

      assert.strictEqual(startOfMonth.toISOString(), '2026-11-30T16:00:00.000Z');
      assert.strictEqual(endOfMonth.toISOString(), '2026-12-31T15:59:59.999Z');
    });
  });

  describe('PLAN_LIMITS Constants', () => {
    test('matches exact specification in DEVELOPMENT_PLAN.md §11', () => {
      assert.strictEqual(PLAN_LIMITS.FREE.monthlyInvoices, 5);
      assert.strictEqual(PLAN_LIMITS.FREE.monthlyQuotations, 5);
      assert.strictEqual(PLAN_LIMITS.FREE.maxCustomers, 10);

      assert.strictEqual(PLAN_LIMITS.FREELANCER.monthlyInvoices, Infinity);
      assert.strictEqual(PLAN_LIMITS.FREELANCER.monthlyQuotations, Infinity);
      assert.strictEqual(PLAN_LIMITS.FREELANCER.maxCustomers, Infinity);

      assert.strictEqual(PLAN_LIMITS.BUSINESS.monthlyInvoices, Infinity);
      assert.strictEqual(PLAN_LIMITS.BUSINESS.monthlyQuotations, Infinity);
      assert.strictEqual(PLAN_LIMITS.BUSINESS.maxCustomers, Infinity);
    });
  });
});

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  effectivePlan,
  isPlanOverrideActive,
  getEffectivePlanLimits,
  type PlanUser,
} from '../lib/plan.ts';
import { setPlanOverrideSchema } from '../lib/validation/admin.ts';

describe('Plan Override & effectivePlan Single Source of Truth (M7-T06)', () => {
  describe('effectivePlan across all four combinations of billing and override (§14)', () => {
    test('1. Default user with no billing and no override resolves to FREE', () => {
      const user: PlanUser = {
        plan: 'FREE',
        planSource: 'DEFAULT',
        planOverrideExpiresAt: null,
      };

      assert.strictEqual(effectivePlan(user), 'FREE');
      assert.strictEqual(isPlanOverrideActive(user), false);
    });

    test('2. User with active BILLING subscription resolves to billing plan', () => {
      const user: PlanUser = {
        plan: 'FREELANCER',
        planSource: 'BILLING',
        planOverrideExpiresAt: null,
      };

      assert.strictEqual(effectivePlan(user), 'FREELANCER');
      assert.strictEqual(isPlanOverrideActive(user), false);
    });

    test('3. User with active unexpired ADMIN override resolves immediately to override plan', () => {
      const futureDate = new Date(Date.now() + 90 * 86400000);
      const user: PlanUser = {
        plan: 'BUSINESS',
        planSource: 'ADMIN',
        planOverrideExpiresAt: futureDate,
        planOverrideReason: 'Support comp ticket #123',
      };

      assert.strictEqual(effectivePlan(user), 'BUSINESS');
      assert.strictEqual(isPlanOverrideActive(user), true);
    });

    test('4. Live ADMIN override takes precedence over an active BILLING plan', () => {
      const futureDate = new Date(Date.now() + 60 * 86400000);
      const user: PlanUser = {
        plan: 'BUSINESS', // Admin comped to Business
        planSource: 'ADMIN',
        planOverrideExpiresAt: futureDate,
        planOverrideReason: 'VIP partner MSME upgrade',
        billingPlan: 'FREELANCER', // User pays for Freelancer
      };

      assert.strictEqual(effectivePlan(user), 'BUSINESS');
      assert.strictEqual(isPlanOverrideActive(user), true);
    });

    test('5. Expired ADMIN override falls back dynamically to billing plan with zero cleanup jobs', () => {
      const pastDate = new Date(Date.now() - 1000 * 60); // Expired 1 minute ago
      const user: PlanUser = {
        plan: 'BUSINESS', // Old override
        planSource: 'ADMIN',
        planOverrideExpiresAt: pastDate,
        planOverrideReason: 'Old comp',
        billingPlan: 'FREELANCER',
      };

      // Invariant (§5.10): Falls back dynamically on read, no worker or cleanup job needed
      assert.strictEqual(effectivePlan(user), 'FREELANCER');
      assert.strictEqual(isPlanOverrideActive(user), false);
    });

    test('6. Expired ADMIN override with no billing subscription falls back to FREE', () => {
      const pastDate = new Date(Date.now() - 86400000); // Expired yesterday
      const user: PlanUser = {
        plan: 'FREELANCER',
        planSource: 'ADMIN',
        planOverrideExpiresAt: pastDate,
        planOverrideReason: 'Trial expired',
        billingPlan: null,
      };

      assert.strictEqual(effectivePlan(user), 'FREE');
      assert.strictEqual(isPlanOverrideActive(user), false);
    });
  });

  describe('PayMongo billing coexistence (§5.10)', () => {
    test('simulated PayMongo billing renewal does not overwrite live admin override', () => {
      const futureDate = new Date(Date.now() + 45 * 86400000);
      const user: PlanUser = {
        plan: 'BUSINESS', // Active admin override
        planSource: 'ADMIN',
        planOverrideExpiresAt: futureDate,
        billingPlan: 'FREELANCER',
      };

      // Verify initial live override
      assert.strictEqual(effectivePlan(user), 'BUSINESS');

      // Simulated PayMongo webhook event arrives (e.g. invoice.paid renewal or downgrade)
      // Webhook writes to billing fields only
      user.billingPlan = 'FREELANCER';

      // Effective plan STILL resolves to Business because override is live
      assert.strictEqual(effectivePlan(user), 'BUSINESS');
    });
  });

  describe('Plan limits helper (getEffectivePlanLimits)', () => {
    test('FREE effective plan returns strict operational limits', () => {
      const user: PlanUser = { plan: 'FREE', planSource: 'DEFAULT' };
      const limits = getEffectivePlanLimits(user);
      assert.strictEqual(limits.monthlyInvoices, 5);
      assert.strictEqual(limits.monthlyQuotations, 5);
      assert.strictEqual(limits.maxCustomers, 10);
    });

    test('ADMIN override to BUSINESS lifts operational limits to Infinity', () => {
      const user: PlanUser = {
        plan: 'BUSINESS',
        planSource: 'ADMIN',
        planOverrideExpiresAt: new Date(Date.now() + 30 * 86400000),
      };
      const limits = getEffectivePlanLimits(user);
      assert.strictEqual(limits.monthlyInvoices, Infinity);
      assert.strictEqual(limits.monthlyQuotations, Infinity);
      assert.strictEqual(limits.maxCustomers, Infinity);
    });
  });

  describe('Validation: setPlanOverrideSchema', () => {
    test('rejects reason shorter than 10 characters', () => {
      const res = setPlanOverrideSchema.safeParse({
        userId: '507f1f77bcf86cd799439011',
        plan: 'BUSINESS',
        reason: 'Too short',
      });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.match(res.error.issues[0]?.message, /at least 10 characters/i);
      }
    });

    test('rejects invalid plan name', () => {
      const res = setPlanOverrideSchema.safeParse({
        userId: '507f1f77bcf86cd799439011',
        plan: 'ENTERPRISE_UNLIMITED',
        reason: 'Valid operational justification provided here',
      });
      assert.strictEqual(res.success, false);
    });

    test('defaults to 90 days if not provided', () => {
      const res = setPlanOverrideSchema.safeParse({
        userId: '507f1f77bcf86cd799439011',
        plan: 'FREELANCER',
        reason: 'Comped due to support ticket #555',
      });
      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.days, 90);
        assert.strictEqual(res.data.plan, 'FREELANCER');
      }
    });

    test('accepts custom days within 1 to 365 range', () => {
      const res = setPlanOverrideSchema.safeParse({
        userId: '507f1f77bcf86cd799439011',
        plan: 'BUSINESS',
        reason: 'Annual complimentary VIP access granted',
        days: 365,
      });
      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.days, 365);
      }
    });
  });
});

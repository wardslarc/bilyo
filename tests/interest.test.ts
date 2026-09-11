import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  pricingInterestSchema,
  trialWallSurveySchema,
} from '../lib/validation/interest.ts';
import { accessState } from '../lib/access.ts';
import { assertAccessActive } from '../lib/auth-guards.ts';

describe('Pricing & Willingness-To-Pay Validation (ACCESS_BILLING_PLAN.md §3.4)', () => {
  test('validates valid pricing interest email and passType', () => {
    const valid = pricingInterestSchema.safeParse({
      email: 'user@example.com',
      passType: 'D90',
    });
    assert.equal(valid.success, true);
    if (valid.success) {
      assert.equal(valid.data.email, 'user@example.com');
      assert.equal(valid.data.passType, 'D90');
    }
  });

  test('trims and lowercases email for pricing interest', () => {
    const result = pricingInterestSchema.safeParse({
      email: '  User.Name@Example.COM  ',
    });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.email, 'user.name@example.com');
    }
  });

  test('rejects invalid email for pricing interest', () => {
    const result = pricingInterestSchema.safeParse({
      email: 'not-an-email',
    });
    assert.equal(result.success, false);
  });

  test('validates trial wall survey answers and optional fields', () => {
    const validSurvey = trialWallSurveySchema.safeParse({
      answer: 'WOULD_PAY_LOWER',
      suggestedPriceCentavos: 15000,
      comment: '₱150 per month would fit my budget',
    });
    assert.equal(validSurvey.success, true);

    const validNotNow = trialWallSurveySchema.safeParse({
      answer: 'NOT_NOW',
    });
    assert.equal(validNotNow.success, true);

    const validWouldNotPay = trialWallSurveySchema.safeParse({
      answer: 'WOULD_NOT_PAY',
      comment: 'I need recurring invoice generation',
    });
    assert.equal(validWouldNotPay.success, true);
  });

  test('rejects invalid trial wall survey answer', () => {
    const invalid = trialWallSurveySchema.safeParse({
      answer: 'INVALID_OPTION',
    });
    assert.equal(invalid.success, false);
  });
});

describe('Quotation Enforcement Toggle (ACCESS_ROLLOUT_PLAN.md A4)', () => {
  test('assertAccessActive is a no-op when ACCESS_ENFORCED is false', async () => {
    const originalEnforced = process.env.ACCESS_ENFORCED;
    process.env.ACCESS_ENFORCED = 'false';

    try {
      // Should not throw even with a dummy/non-existent user ID
      await assertAccessActive('dummy-id');
      assert.ok(true, 'assertAccessActive returned without throwing when unenforced');
    } finally {
      process.env.ACCESS_ENFORCED = originalEnforced;
    }
  });

  test('accessState marks expired trial correctly to feed enforcement', () => {
    const pastDate = new Date(Date.now() - 1000);
    const state = accessState({ accessUntil: pastDate, firstPaidAt: null });
    assert.equal(state.status, 'EXPIRED_TRIAL');
    assert.equal(state.daysLeft, 0);
  });

  test('accessState allows beta users indefinitely without expiration', () => {
    const state = accessState({ accessUntil: null });
    assert.equal(state.status, 'BETA');
    assert.equal(state.daysLeft, Infinity);
  });
});

describe('Trial Assignment on Email Verification (ACCESS_ROLLOUT_PLAN.md A2)', () => {
  function computeTrialAccessUntil(
    verifiedAt: Date,
    trialEnabled: boolean,
    trialDaysInput?: string,
    existingAccessUntil?: Date | null
  ): Date | null {
    if (!trialEnabled || existingAccessUntil != null) {
      return existingAccessUntil ?? null;
    }
    const days = Number.parseInt(trialDaysInput || '14', 10);
    const safeDays = Number.isFinite(days) && days > 0 ? days : 14;
    return new Date(verifiedAt.getTime() + safeDays * 86400000);
  }

  test('flag off -> accessUntil stays null', () => {
    const verifiedAt = new Date('2026-09-11T12:00:00Z');
    const result = computeTrialAccessUntil(verifiedAt, false);
    assert.equal(result, null);
  });

  test('flag on -> newly verified account receives 14 trial days by default', () => {
    const verifiedAt = new Date('2026-09-11T12:00:00Z');
    const result = computeTrialAccessUntil(verifiedAt, true);
    assert.ok(result);
    assert.equal(result.getTime() - verifiedAt.getTime(), 14 * 86400000);
  });

  test('custom TRIAL_DAYS env value is respected', () => {
    const verifiedAt = new Date('2026-09-11T12:00:00Z');
    const result = computeTrialAccessUntil(verifiedAt, true, '7');
    assert.ok(result);
    assert.equal(result.getTime() - verifiedAt.getTime(), 7 * 86400000);
  });

  test('an account that verifies twice does not get duplicate/stacked days', () => {
    const verifiedAt1 = new Date('2026-09-11T12:00:00Z');
    const firstGrant = computeTrialAccessUntil(verifiedAt1, true, '14', null);
    assert.ok(firstGrant);

    const verifiedAt2 = new Date('2026-09-12T12:00:00Z');
    const secondAttempt = computeTrialAccessUntil(verifiedAt2, true, '14', firstGrant);
    // Preserves existing accessUntil without granting additional 14 days
    assert.equal(secondAttempt?.getTime(), firstGrant.getTime());
  });

  test('existing accounts with null accessUntil remain untouched if untouched', () => {
    const result = computeTrialAccessUntil(new Date(), false, '14', null);
    assert.equal(result, null);
  });
});

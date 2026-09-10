import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Unverified User Reaper Logic (SIGNUP_VERIFICATION_PLAN.md §4.10)', () => {
  function isEligibleForReaping(user: {
    emailVerifiedAt: Date | null;
    createdAt: Date;
  }, now: number = Date.now()): boolean {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const cutoff = now - sevenDaysMs;

    return user.emailVerifiedAt === null && user.createdAt.getTime() < cutoff;
  }

  test('reaps accounts unverified and older than 7 days', () => {
    const now = Date.now();
    const eightDaysAgo = new Date(now - 8 * 24 * 60 * 60 * 1000);

    assert.equal(
      isEligibleForReaping({ emailVerifiedAt: null, createdAt: eightDaysAgo }, now),
      true
    );
  });

  test('does NOT reap accounts younger than 7 days even if unverified', () => {
    const now = Date.now();
    const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);
    const sixDaysAgo = new Date(now - 6 * 24 * 60 * 60 * 1000);

    assert.equal(
      isEligibleForReaping({ emailVerifiedAt: null, createdAt: threeDaysAgo }, now),
      false
    );
    assert.equal(
      isEligibleForReaping({ emailVerifiedAt: null, createdAt: sixDaysAgo }, now),
      false
    );
  });

  test('does NOT reap verified accounts regardless of age', () => {
    const now = Date.now();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    assert.equal(
      isEligibleForReaping({ emailVerifiedAt: thirtyDaysAgo, createdAt: thirtyDaysAgo }, now),
      false
    );
  });
});

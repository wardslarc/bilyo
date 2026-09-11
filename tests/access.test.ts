import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { accessState } from '../lib/access.ts';

describe('Bilyo Access State (§6.10, ACCESS_BILLING_PLAN.md §3.3)', () => {
  test('null accessUntil returns BETA status with Infinity daysLeft', () => {
    const state = accessState({ accessUntil: null });
    assert.equal(state.status, 'BETA');
    assert.equal(state.accessUntil, null);
    assert.equal(state.daysLeft, Infinity);
  });

  test('undefined user returns BETA status', () => {
    const state = accessState(undefined);
    assert.equal(state.status, 'BETA');
    assert.equal(state.accessUntil, null);
  });

  test('active window without firstPaidAt returns TRIAL status with daysLeft', () => {
    const now = new Date('2026-09-10T12:00:00Z');
    const accessUntil = new Date('2026-09-24T12:00:00Z'); // 14 days later
    const state = accessState({ accessUntil, firstPaidAt: null }, now);

    assert.equal(state.status, 'TRIAL');
    assert.equal(state.daysLeft, 14);
    assert.equal(state.accessUntil?.toISOString(), accessUntil.toISOString());
  });

  test('active window with firstPaidAt set returns ACTIVE status', () => {
    const now = new Date('2026-09-10T12:00:00Z');
    const accessUntil = new Date('2026-10-10T12:00:00Z'); // 30 days later
    const firstPaidAt = new Date('2026-09-10T11:00:00Z');
    const state = accessState({ accessUntil, firstPaidAt }, now);

    assert.equal(state.status, 'ACTIVE');
    assert.equal(state.daysLeft, 30);
  });

  test('one second past accessUntil returns EXPIRED_TRIAL when firstPaidAt is null', () => {
    const accessUntil = new Date('2026-09-10T12:00:00.000Z');
    const now = new Date('2026-09-10T12:00:01.000Z'); // exactly 1 second past
    const state = accessState({ accessUntil, firstPaidAt: null }, now);

    assert.equal(state.status, 'EXPIRED_TRIAL');
    assert.equal(state.daysLeft, 0);
  });

  test('past accessUntil returns EXPIRED_PAID when firstPaidAt is set', () => {
    const accessUntil = new Date('2026-09-10T12:00:00.000Z');
    const now = new Date('2026-09-10T12:00:01.000Z');
    const firstPaidAt = new Date('2026-08-10T12:00:00.000Z');
    const state = accessState({ accessUntil, firstPaidAt }, now);

    assert.equal(state.status, 'EXPIRED_PAID');
    assert.equal(state.daysLeft, 0);
  });

  test('handles Asia/Manila (UTC+8) day boundary accurately', () => {
    // 23:59:59 Manila time is 15:59:59 UTC
    const manilaMidnightEveUTC = new Date('2026-09-10T15:59:59.000Z');
    // Access expires at 16:00:00 UTC (00:00:00 Manila next day)
    const accessUntilUTC = new Date('2026-09-10T16:00:00.000Z');

    // 1 second before Manila midnight
    const stateBefore = accessState({ accessUntil: accessUntilUTC }, manilaMidnightEveUTC);
    assert.equal(stateBefore.status, 'TRIAL');
    assert.equal(stateBefore.daysLeft, 1);

    // 1 second after Manila midnight (16:00:01 UTC = 00:00:01 Manila next day)
    const manilaMidnightPastUTC = new Date('2026-09-10T16:00:01.000Z');
    const stateAfter = accessState({ accessUntil: accessUntilUTC }, manilaMidnightPastUTC);
    assert.equal(stateAfter.status, 'EXPIRED_TRIAL');
    assert.equal(stateAfter.daysLeft, 0);
  });

  test('lib/access.ts is strictly synchronous with zero await occurrences', () => {
    const filePath = path.resolve(process.cwd(), 'lib/access.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    const awaitMatches = content.match(/\bawait\b/g);
    assert.equal(awaitMatches, null, 'lib/access.ts must not contain await');
  });
});

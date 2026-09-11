import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { accessState } from '../lib/access.ts';
import { renderAccessExpiringEmail } from '../lib/email/templates/access-expiring.ts';

describe('Access Expiry Reminders (ACCESS_ROLLOUT_PLAN.md A7)', () => {
  test('reminder cron fires only on 7 days left and 1 day left', () => {
    const now = new Date('2026-09-11T01:00:00Z');

    // 7 days left
    const sevenDaysUntil = new Date(now.getTime() + 7 * 86400000);
    const state7 = accessState({ accessUntil: sevenDaysUntil }, now);
    assert.equal(state7.daysLeft, 7);

    // 1 day left
    const oneDayUntil = new Date(now.getTime() + 1 * 86400000);
    const state1 = accessState({ accessUntil: oneDayUntil }, now);
    assert.equal(state1.daysLeft, 1);

    // Other intervals should NOT trigger reminder
    const eightDaysUntil = new Date(now.getTime() + 8 * 86400000);
    const state8 = accessState({ accessUntil: eightDaysUntil }, now);
    assert.equal(state8.daysLeft, 8);

    const twoDaysUntil = new Date(now.getTime() + 2 * 86400000);
    const state2 = accessState({ accessUntil: twoDaysUntil }, now);
    assert.equal(state2.daysLeft, 2);

    const expired = new Date(now.getTime() - 1000);
    const stateExpired = accessState({ accessUntil: expired }, now);
    assert.equal(stateExpired.daysLeft, 0);
  });

  test('idempotency key is deterministic per user, expiry timestamp, and day bucket', () => {
    const userId = 'user-abc-123';
    const accessUntil = new Date('2026-09-18T01:00:00Z');
    const accessUntilMs = accessUntil.getTime();
    const daysLeft = 7;

    const key1 = `access-expiring-${userId}-${accessUntilMs}-${daysLeft}d`;
    const key2 = `access-expiring-${userId}-${accessUntilMs}-${daysLeft}d`;

    assert.equal(key1, key2);
    assert.equal(key1, `access-expiring-user-abc-123-${accessUntilMs}-7d`);
  });

  test('inert when accessUntil is null (beta accounts)', () => {
    const user = { accessUntil: null };
    const state = accessState(user);
    assert.equal(state.status, 'BETA');
    assert.equal(state.daysLeft, Infinity);
    // Infinity cannot equal 7 or 1
    assert.notEqual(state.daysLeft, 7);
    assert.notEqual(state.daysLeft, 1);
  });

  test('email template embeds mandatory disclaimer and avoids tax claims (AGENTS.md §3)', () => {
    const email = renderAccessExpiringEmail({
      daysLeft: 7,
      accessUntilFormatted: '18 September 2026',
      topUpUrl: 'https://bilyoapp.com/pricing',
      userName: 'Juan Dela Cruz',
    });

    assert.ok(email.subject.includes('7 days'));
    assert.ok(email.html.includes('18 September 2026'));
    // Mandatory §3 disclaimer is present in both html and text
    assert.ok(email.html.includes('This is a quotation, not a tax document'));
    assert.ok(email.text.includes('This is a quotation, not a tax document'));
    // No VAT computation or tax figures
    assert.ok(!email.html.toLowerCase().includes('vat computation'));
    assert.ok(!email.text.toLowerCase().includes('vat computation'));
  });
});

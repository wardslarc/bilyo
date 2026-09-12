import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { renderAdminSignupAlertEmail } from '../lib/email/templates/admin-signup-alert.ts';
import { parseAdminEmails } from '../lib/email/recipients.ts';

describe('lib/email/templates/admin-signup-alert.ts', () => {
  test('subject names the new user', () => {
    const { subject } = renderAdminSignupAlertEmail({
      userName: 'Maria Santos',
      userEmail: 'maria@example.com',
      registeredAtFormatted: 'September 12, 2026, 9:15 AM',
      verifiedAtFormatted: 'September 12, 2026, 9:18 AM',
      adminUrl: 'https://bilyoapp.com/admin/users/abc123',
    });

    assert.equal(subject, 'New Bilyo signup — Maria Santos');
  });

  test('carries the signup details and the admin link in both payloads', () => {
    const adminUrl = 'https://bilyoapp.com/admin/users/64f0c0ffee';
    const { html, text } = renderAdminSignupAlertEmail({
      userName: 'Juan dela Cruz',
      userEmail: 'juan@example.com',
      registeredAtFormatted: 'September 12, 2026, 9:15 AM',
      verifiedAtFormatted: 'September 12, 2026, 9:18 AM',
      trialEndsFormatted: 'September 26, 2026',
      adminUrl,
    });

    for (const payload of [html, text]) {
      assert.ok(payload.includes('Juan dela Cruz'));
      assert.ok(payload.includes('juan@example.com'));
      assert.ok(payload.includes('September 12, 2026, 9:18 AM'));
      assert.ok(payload.includes('September 26, 2026'));
      assert.ok(payload.includes(adminUrl));
    }
  });

  test('omits the access line when the user has no accessUntil', () => {
    const { html, text } = renderAdminSignupAlertEmail({
      userName: 'Ana',
      userEmail: 'ana@example.com',
      registeredAtFormatted: 'September 12, 2026, 9:15 AM',
      verifiedAtFormatted: 'September 12, 2026, 9:18 AM',
      adminUrl: 'https://bilyoapp.com/admin/users/abc123',
    });

    assert.ok(!html.includes('Access until'));
    assert.ok(!text.includes('Access until'));
  });

  test('escapes HTML special characters in user-supplied fields', () => {
    const { html } = renderAdminSignupAlertEmail({
      userName: '<script>alert("xss")</script>',
      userEmail: 'evil@example.com',
      registeredAtFormatted: 'September 12, 2026, 9:15 AM',
      verifiedAtFormatted: 'September 12, 2026, 9:18 AM',
      adminUrl: 'https://bilyoapp.com/admin/users/abc123',
    });

    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'));
  });
});

describe('lib/email/recipients.ts → parseAdminEmails', () => {
  test('returns an empty list when the allowlist is empty or absent', () => {
    assert.deepEqual(parseAdminEmails(undefined), []);
    assert.deepEqual(parseAdminEmails(''), []);
    assert.deepEqual(parseAdminEmails(' , , '), []);
  });

  test('trims, lowercases and drops blanks, keeping env order', () => {
    assert.deepEqual(parseAdminEmails(' Ops@Bilyoapp.com , ,second@bilyoapp.com '), [
      'ops@bilyoapp.com',
      'second@bilyoapp.com',
    ]);
  });

  test('deduplicates addresses that differ only by case or spacing', () => {
    assert.deepEqual(parseAdminEmails('ops@bilyoapp.com,OPS@bilyoapp.com, ops@bilyoapp.com'), [
      'ops@bilyoapp.com',
    ]);
  });
});

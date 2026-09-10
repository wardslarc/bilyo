import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { renderEmailVerificationEmail } from '../lib/email/templates/email-verification.ts';

describe('lib/email/templates/email-verification.ts', () => {
  test('renders subject line starting with the 6-digit code', () => {
    const { subject } = renderEmailVerificationEmail({
      userName: 'Juan',
      code: '849201',
      verifyUrl: 'https://bilyoapp.com/verify-email/abcdef123456',
    });

    assert.equal(subject, '849201 is your Bilyo verification code');
  });

  test('includes code and link in both HTML and text payloads', () => {
    const code = '472910';
    const verifyUrl = 'https://bilyoapp.com/verify-email/token-xyz-789';
    const { html, text } = renderEmailVerificationEmail({
      userName: 'Maria Santos',
      code,
      verifyUrl,
    });

    // Code and URL in HTML
    assert.ok(html.includes(code));
    assert.ok(html.includes(verifyUrl));
    assert.ok(html.includes('15 minutes'));
    assert.ok(html.includes('24 hours'));
    assert.ok(html.includes('Maria Santos'));

    // Code and URL in plain text
    assert.ok(text.includes(code));
    assert.ok(text.includes(verifyUrl));
    assert.ok(text.includes('15 minutes'));
    assert.ok(text.includes('24 hours'));
  });

  test('escapes HTML special characters in userName to prevent XSS', () => {
    const { html } = renderEmailVerificationEmail({
      userName: '<script>alert("xss")</script>',
      code: '112233',
      verifyUrl: 'https://bilyoapp.com/verify-email/test',
    });

    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'));
  });
});

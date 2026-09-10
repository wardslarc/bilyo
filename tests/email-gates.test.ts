import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { isDisposableDomain } from '../lib/email/disposable-domains.ts';
import { domainAcceptsMail, clearMxCache } from '../lib/email/dns-check.ts';

describe('Gate 2: Disposable Domain Blocklist (lib/email/disposable-domains.ts)', () => {
  test('identifies known disposable email addresses and domains', () => {
    assert.equal(isDisposableDomain('user@mailinator.com'), true);
    assert.equal(isDisposableDomain('test@10minutemail.com'), true);
    assert.equal(isDisposableDomain('tempmail.com'), true);
    assert.equal(isDisposableDomain('someone@sharklasers.com'), true);
    assert.equal(isDisposableDomain('USER@GUERRILLAMAIL.COM'), true);
  });

  test('permits legitimate email domains', () => {
    assert.equal(isDisposableDomain('user@gmail.com'), false);
    assert.equal(isDisposableDomain('founder@bilyoapp.com'), false);
    assert.equal(isDisposableDomain('user@yahoo.com'), false);
    assert.equal(isDisposableDomain('corp@outlook.com'), false);
  });

  test('handles malformed or empty inputs safely', () => {
    assert.equal(isDisposableDomain(''), false);
    assert.equal(isDisposableDomain('invalid'), false);
    // @ts-expect-error test non-string
    assert.equal(isDisposableDomain(null), false);
  });
});

describe('Gate 3: DNS MX Verification (lib/email/dns-check.ts)', () => {
  beforeEach(() => {
    clearMxCache();
  });

  test('accepts domains with valid MX records (e.g. gmail.com)', async () => {
    const verdict = await domainAcceptsMail('test@gmail.com');
    assert.equal(verdict, 'HAS_MX');
  });

  test('rejects non-existent domains as NO_MX', async () => {
    const verdict = await domainAcceptsMail('test@nonexistent-fake-domain-xyz-987654321.com');
    assert.equal(verdict, 'NO_MX');
  });

  test('rejects domains without dot as NO_MX', async () => {
    assert.equal(await domainAcceptsMail('localhost'), 'NO_MX');
    assert.equal(await domainAcceptsMail('invalid'), 'NO_MX');
  });

  test('caches verdicts in memory for subsequent checks', async () => {
    const start = Date.now();
    await domainAcceptsMail('gmail.com');
    const firstDuration = Date.now() - start;

    // Second call should hit memory cache and return practically instantly
    const cacheStart = Date.now();
    const secondVerdict = await domainAcceptsMail('gmail.com');
    const cacheDuration = Date.now() - cacheStart;

    assert.equal(secondVerdict, 'HAS_MX');
    assert.ok(cacheDuration <= firstDuration);
  });
});

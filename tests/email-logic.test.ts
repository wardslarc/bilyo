import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { canSendTo } from '../lib/email/suppression.ts';
import { canAdvanceStatus } from '../lib/email/status.ts';
import { verifySvixSignature } from '../lib/email/signature.ts';

describe('Email Logic (EMAIL_DELIVERY_PLAN.md §4.1, §5.4, §8)', () => {
  describe('canSendTo Pure Gate (§4.1)', () => {
    test('rejects empty or invalid recipient address', () => {
      assert.deepStrictEqual(canSendTo({ toEmail: '' }), {
        ok: false,
        reason: 'NO_ADDRESS',
      });
      assert.deepStrictEqual(canSendTo({ toEmail: 'not-an-email' }), {
        ok: false,
        reason: 'NO_ADDRESS',
      });
      assert.deepStrictEqual(canSendTo({ toEmail: null }), {
        ok: false,
        reason: 'NO_ADDRESS',
      });
    });

    test('rejects when owner is suspended', () => {
      assert.deepStrictEqual(
        canSendTo({
          toEmail: 'client@example.com',
          owner: { suspendedAt: new Date() },
        }),
        { ok: false, reason: 'OWNER_SUSPENDED' }
      );
    });

    test('rejects when owner public links are disabled', () => {
      assert.deepStrictEqual(
        canSendTo({
          toEmail: 'client@example.com',
          owner: { publicLinksDisabledAt: new Date() },
        }),
        { ok: false, reason: 'LINKS_DISABLED' }
      );
    });

    test('rejects when quotation public code is revoked', () => {
      assert.deepStrictEqual(
        canSendTo({
          toEmail: 'client@example.com',
          quotation: { publicCodeRevokedAt: new Date() },
        }),
        { ok: false, reason: 'CODE_REVOKED' }
      );
    });

    test('rejects past complaints (highest operational priority)', () => {
      assert.deepStrictEqual(
        canSendTo({
          toEmail: 'client@example.com',
          isSuppressedComplaint: true,
        }),
        { ok: false, reason: 'SUPPRESSED_COMPLAINT' }
      );
    });

    test('rejects past bounces', () => {
      assert.deepStrictEqual(
        canSendTo({
          toEmail: 'client@example.com',
          isSuppressedBounce: true,
        }),
        { ok: false, reason: 'SUPPRESSED_BOUNCE' }
      );
    });

    test('returns DRY_RUN when isDryRun is true', () => {
      assert.deepStrictEqual(
        canSendTo({
          toEmail: 'client@example.com',
          isDryRun: true,
        }),
        { ok: false, reason: 'DRY_RUN' }
      );
    });

    test('returns ok: true when all checks pass', () => {
      assert.deepStrictEqual(
        canSendTo({
          toEmail: 'client@example.com',
          owner: { suspendedAt: null, publicLinksDisabledAt: null },
          quotation: { publicCodeRevokedAt: null },
          isSuppressedBounce: false,
          isSuppressedComplaint: false,
          isDryRun: false,
        }),
        { ok: true }
      );
    });
  });

  describe('Status Precedence Ladder (§5.4)', () => {
    test('allows progressive transitions in order', () => {
      assert.strictEqual(canAdvanceStatus('QUEUED', 'SENT'), true);
      assert.strictEqual(canAdvanceStatus('SENT', 'DELIVERED'), true);
      assert.strictEqual(canAdvanceStatus('DELIVERED', 'BOUNCED'), true);
      assert.strictEqual(canAdvanceStatus('BOUNCED', 'COMPLAINED'), true);
    });

    test('refuses out-of-order regressions (e.g. late DELIVERED after BOUNCED)', () => {
      assert.strictEqual(
        canAdvanceStatus('BOUNCED', 'DELIVERED'),
        false,
        'Late delivered must never overwrite a bounced state'
      );
      assert.strictEqual(
        canAdvanceStatus('COMPLAINED', 'DELIVERED'),
        false,
        'Late delivered must never overwrite a complained state'
      );
      assert.strictEqual(
        canAdvanceStatus('DELIVERED', 'SENT'),
        false,
        'Late sent must never overwrite a delivered state'
      );
    });

    test('refuses transition to identical status', () => {
      assert.strictEqual(canAdvanceStatus('DELIVERED', 'DELIVERED'), false);
      assert.strictEqual(canAdvanceStatus('BOUNCED', 'BOUNCED'), false);
    });
  });

  describe('Svix Signature Verification (§5.4)', () => {
    // Generate a sample test secret (base64)
    const rawSecretBytes = crypto.randomBytes(32);
    const testSecret = `whsec_${rawSecretBytes.toString('base64')}`;

    test('accepts valid Svix signature', () => {
      const id = 'msg_test123';
      const timestamp = String(Math.floor(Date.now() / 1000));
      const rawBody = JSON.stringify({ type: 'email.delivered', data: { id: 'sample' } });

      const toSign = `${id}.${timestamp}.${rawBody}`;
      const sigBase64 = crypto
        .createHmac('sha256', rawSecretBytes)
        .update(toSign)
        .digest('base64');

      const headers = {
        id,
        timestamp,
        signature: `v1,${sigBase64}`,
      };

      const result = verifySvixSignature(rawBody, headers, testSecret);
      assert.strictEqual(result.valid, true);
    });

    test('rejects tampered raw body', () => {
      const id = 'msg_test123';
      const timestamp = String(Math.floor(Date.now() / 1000));
      const rawBody = JSON.stringify({ type: 'email.delivered' });

      const toSign = `${id}.${timestamp}.${rawBody}`;
      const sigBase64 = crypto
        .createHmac('sha256', rawSecretBytes)
        .update(toSign)
        .digest('base64');

      const headers = {
        id,
        timestamp,
        signature: `v1,${sigBase64}`,
      };

      const tamperedBody = JSON.stringify({ type: 'email.bounced' });
      const result = verifySvixSignature(tamperedBody, headers, testSecret);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error, 'SIGNATURE_MISMATCH');
    });

    test('rejects stale timestamp older than 5 minutes (replay protection)', () => {
      const id = 'msg_test123';
      const staleTimestamp = String(Math.floor(Date.now() / 1000) - 400); // 400 seconds ago (> 300s)
      const rawBody = '{}';

      const toSign = `${id}.${staleTimestamp}.${rawBody}`;
      const sigBase64 = crypto
        .createHmac('sha256', rawSecretBytes)
        .update(toSign)
        .digest('base64');

      const headers = {
        id,
        timestamp: staleTimestamp,
        signature: `v1,${sigBase64}`,
      };

      const result = verifySvixSignature(rawBody, headers, testSecret);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error, 'STALE_TIMESTAMP');
    });

    test('rejects missing headers or missing secret', () => {
      assert.strictEqual(
        verifySvixSignature('{}', { id: null, timestamp: null, signature: null }, testSecret).valid,
        false
      );
      assert.strictEqual(
        verifySvixSignature('{}', { id: '1', timestamp: '1', signature: 'v1,x' }, '').valid,
        false
      );
    });
  });
});

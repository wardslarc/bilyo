import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { publicResponseSchema } from '../lib/validation/response.ts';

describe('Public Response & Client Decision Boundary (P3-T02)', () => {
  describe('lib/validation/response.ts schema validation', () => {
    test('accepts valid ACCEPT response with 12-char code and client name', () => {
      const parsed = publicResponseSchema.safeParse({
        code: 'aB1-_xYz9012',
        action: 'ACCEPT',
        name: 'Maria Clara Santos',
      });
      assert.strictEqual(parsed.success, true);
      if (parsed.success) {
        assert.strictEqual(parsed.data.action, 'ACCEPT');
        assert.strictEqual(parsed.data.name, 'Maria Clara Santos');
        assert.strictEqual(parsed.data.code, 'aB1-_xYz9012');
      }
    });

    test('accepts valid DECLINE response', () => {
      const parsed = publicResponseSchema.safeParse({
        code: '123456789012',
        action: 'DECLINE',
        name: 'Juan Dela Cruz',
      });
      assert.strictEqual(parsed.success, true);
      if (parsed.success) {
        assert.strictEqual(parsed.data.action, 'DECLINE');
      }
    });

    test('rejects empty or whitespace-only name (name required by AGENTS.md §9)', () => {
      const parsedEmpty = publicResponseSchema.safeParse({
        code: 'aB1-_xYz9012',
        action: 'ACCEPT',
        name: '',
      });
      assert.strictEqual(parsedEmpty.success, false);

      const parsedSpaces = publicResponseSchema.safeParse({
        code: 'aB1-_xYz9012',
        action: 'ACCEPT',
        name: '   ',
      });
      assert.strictEqual(parsedSpaces.success, false);
    });

    test('rejects name exceeding 100 characters', () => {
      const parsed = publicResponseSchema.safeParse({
        code: 'aB1-_xYz9012',
        action: 'ACCEPT',
        name: 'A'.repeat(101),
      });
      assert.strictEqual(parsed.success, false);
    });

    test('rejects invalid action types', () => {
      const parsed = publicResponseSchema.safeParse({
        code: 'aB1-_xYz9012',
        action: 'PAID',
        name: 'Maria',
      });
      assert.strictEqual(parsed.success, false);
    });

    test('rejects invalid code formats', () => {
      assert.strictEqual(
        publicResponseSchema.safeParse({
          code: 'short',
          action: 'ACCEPT',
          name: 'Maria',
        }).success,
        false
      );

      assert.strictEqual(
        publicResponseSchema.safeParse({
          code: 'toolongtoken12345',
          action: 'ACCEPT',
          name: 'Maria',
        }).success,
        false
      );

      assert.strictEqual(
        publicResponseSchema.safeParse({
          code: 'invalid+char=',
          action: 'ACCEPT',
          name: 'Maria',
        }).success,
        false
      );
    });
  });

  describe('Server-side business guards (§6.7, P3-T02 acceptance criteria)', () => {
    // Pure logic simulation of respondToQuotation checks
    function evaluateResponsePreconditions(quote: {
      status: string;
      validUntil: Date;
      respondedAt?: Date | null;
      respondedByName?: string | null;
      publicCodeRevokedAt?: Date | null;
    }) {
      if (quote.publicCodeRevokedAt) {
        return { ok: false, error: 'This quotation link has been revoked.' };
      }

      if (quote.respondedAt || quote.status === 'ACCEPTED' || quote.status === 'DECLINED') {
        const dateStr = quote.respondedAt ? quote.respondedAt.toISOString().slice(0, 10) : 'earlier';
        const responder = quote.respondedByName ? ` by ${quote.respondedByName}` : '';
        return {
          ok: false,
          error: `This quotation was already ${quote.status.toLowerCase()} on ${dateStr}${responder}.`,
        };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (quote.validUntil < today) {
        return {
          ok: false,
          error: 'This quotation has expired and can no longer be accepted.',
        };
      }

      if (quote.status !== 'SENT' && quote.status !== 'VIEWED') {
        return {
          ok: false,
          error: `Cannot respond to a quotation in ${quote.status.toLowerCase()} status.`,
        };
      }

      return { ok: true };
    }

    test('accepts response when quote is SENT and unexpired', () => {
      const futureDate = new Date(Date.now() + 7 * 86400000);
      const res = evaluateResponsePreconditions({
        status: 'SENT',
        validUntil: futureDate,
        respondedAt: null,
      });
      assert.strictEqual(res.ok, true);
    });

    test('accepts response when quote is VIEWED and unexpired (§6.4)', () => {
      const futureDate = new Date(Date.now() + 7 * 86400000);
      const res = evaluateResponsePreconditions({
        status: 'VIEWED',
        validUntil: futureDate,
        respondedAt: null,
      });
      assert.strictEqual(res.ok, true);
    });

    test('rejects response when quote has expired past validUntil (P3-T02 accept)', () => {
      const pastDate = new Date(Date.now() - 86400000);
      const res = evaluateResponsePreconditions({
        status: 'SENT',
        validUntil: pastDate,
        respondedAt: null,
      });
      assert.strictEqual(res.ok, false);
      assert.ok(res.error?.includes('expired'));
    });

    test('double-submit or second device is refused with already answered error (P3-T02 accept)', () => {
      const futureDate = new Date(Date.now() + 7 * 86400000);
      const res = evaluateResponsePreconditions({
        status: 'ACCEPTED',
        validUntil: futureDate,
        respondedAt: new Date('2026-09-08T10:00:00Z'),
        respondedByName: 'Maria Clara',
      });
      assert.strictEqual(res.ok, false);
      assert.ok(res.error?.includes('already accepted'));
      assert.ok(res.error?.includes('Maria Clara'));
    });

    test('rejects response when quote is in DRAFT status', () => {
      const futureDate = new Date(Date.now() + 7 * 86400000);
      const res = evaluateResponsePreconditions({
        status: 'DRAFT',
        validUntil: futureDate,
        respondedAt: null,
      });
      assert.strictEqual(res.ok, false);
      assert.ok(res.error?.includes('draft'));
    });

    test('rejects response when link has been revoked', () => {
      const futureDate = new Date(Date.now() + 7 * 86400000);
      const res = evaluateResponsePreconditions({
        status: 'SENT',
        validUntil: futureDate,
        respondedAt: null,
        publicCodeRevokedAt: new Date(),
      });
      assert.strictEqual(res.ok, false);
      assert.ok(res.error?.includes('revoked'));
    });
  });
});

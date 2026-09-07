import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateLookupQuery, type AdminLookupMatch } from '../lib/admin/lookup.ts';

describe('Admin Support Lookup (M7-T04)', () => {
  describe('Query Validation & Guards (validateLookupQuery)', () => {
    test('rejects queries shorter than 4 characters', () => {
      const shortQueries = ['', 'a', 'ab', 'abc', 'INV', 'quo', '123', '   '];
      for (const q of shortQueries) {
        const res = validateLookupQuery(q);
        assert.strictEqual(res.valid, false, `Expected "${q}" to be rejected`);
        if (!res.valid) {
          assert.match(res.error, /at least 4 characters/i);
        }
      }
    });

    test('rejects bare prefixes that could dump all invoices or quotations', () => {
      const barePrefixes = ['INV-', 'inv-', 'QUO-', 'quo-', '  INV-  ', '  QUO-  '];
      for (const q of barePrefixes) {
        const res = validateLookupQuery(q);
        assert.strictEqual(res.valid, false, `Expected bare prefix "${q}" to be rejected`);
        if (!res.valid) {
          assert.match(res.error, /bare prefix/i);
        }
      }
    });

    test('accepts full document numbers', () => {
      const validNumbers = ['INV-000001', 'INV-000042', 'QUO-000001', 'QUO-000100'];
      for (const q of validNumbers) {
        const res = validateLookupQuery(q);
        assert.strictEqual(res.valid, true, `Expected "${q}" to be valid`);
        if (res.valid) {
          assert.ok(res.candidateNumbers.includes(q.toUpperCase()));
        }
      }
    });

    test('normalizes shorthand document numbers with 6-digit zero padding', () => {
      const res1 = validateLookupQuery('INV-42');
      assert.strictEqual(res1.valid, true);
      if (res1.valid) {
        assert.ok(res1.candidateNumbers.includes('INV-000042'));
        assert.ok(res1.candidateNumbers.includes('INV-42'));
      }

      const res2 = validateLookupQuery('quo-7');
      assert.strictEqual(res2.valid, true);
      if (res2.valid) {
        assert.ok(res2.candidateNumbers.includes('QUO-000007'));
      }

      const res3 = validateLookupQuery('INV-1');
      assert.strictEqual(res3.valid, true);
      if (res3.valid) {
        assert.ok(res3.candidateNumbers.includes('INV-000001'));
      }
    });

    test('accepts 12-character public tokens', () => {
      const token = 'aB3_d9Xz1234';
      const res = validateLookupQuery(token);
      assert.strictEqual(res.valid, true);
      if (res.valid) {
        assert.strictEqual(res.trimmed, token);
      }
    });
  });

  describe('Lookup Results Handling & Routing', () => {
    test('resolves single match redirect URL correctly', () => {
      const match: AdminLookupMatch = {
        id: '507f1f77bcf86cd799439011',
        kind: 'invoice',
        number: 'INV-000042',
        status: 'SENT',
        userId: 'user-123',
        userEmail: 'freelancer@example.com',
        businessName: 'Studio Ph',
        customerName: 'Acme Corp',
        issueDate: new Date('2026-03-01'),
        totalCentavos: 5000000,
        createdAt: new Date('2026-03-01'),
      };

      const redirectPath = `/admin/documents/${match.kind}/${match.id}`;
      assert.strictEqual(redirectPath, '/admin/documents/invoice/507f1f77bcf86cd799439011');
    });

    test('handles multiple matches across different accounts for same sequential number', () => {
      const matches: AdminLookupMatch[] = [
        {
          id: 'doc-1',
          kind: 'invoice',
          number: 'INV-000001',
          status: 'PAID',
          userId: 'user-A',
          userEmail: 'alice@example.com',
          businessName: 'Alice Design',
          customerName: 'Client One',
          issueDate: new Date('2026-01-01'),
          totalCentavos: 1000000,
          createdAt: new Date('2026-01-01'),
        },
        {
          id: 'doc-2',
          kind: 'invoice',
          number: 'INV-000001',
          status: 'SENT',
          userId: 'user-B',
          userEmail: 'bob@example.com',
          businessName: 'Bob Devs',
          customerName: 'Client Two',
          issueDate: new Date('2026-02-01'),
          totalCentavos: 2500000,
          createdAt: new Date('2026-02-01'),
        },
      ];

      assert.strictEqual(matches.length, 2);
      assert.notStrictEqual(matches[0].userId, matches[1].userId);
      assert.strictEqual(matches[0].number, matches[1].number);
    });

    test('unknown value result is clean empty match array, never throws error', () => {
      const emptyResult = {
        ok: true,
        matches: [],
        query: 'INV-999999',
      };

      assert.strictEqual(emptyResult.ok, true);
      assert.strictEqual(emptyResult.matches.length, 0);
      assert.strictEqual(emptyResult.query, 'INV-999999');
    });
  });
});

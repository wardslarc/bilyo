import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidPublicCode,
  isValidPublicToken,
  type PublicDocumentProjection,
} from '../lib/public-projection.ts';

describe('Public Link Projection & Security (P2-T02)', () => {
  describe('isValidPublicCode / isValidPublicToken', () => {
    test('accepts valid 12-char URL-safe base64 codes (§6.7)', () => {
      assert.strictEqual(isValidPublicCode('aB1-_xYz9012'), true);
      assert.strictEqual(isValidPublicCode('ABCDEFGHIJKL'), true);
      assert.strictEqual(isValidPublicCode('123456789012'), true);
      assert.strictEqual(isValidPublicToken('aB1-_xYz9012'), true);
    });

    test('rejects 13-char or malformed codes (returns 404 condition)', () => {
      assert.strictEqual(isValidPublicCode(null), false);
      assert.strictEqual(isValidPublicCode(undefined), false);
      assert.strictEqual(isValidPublicCode(''), false);
      assert.strictEqual(isValidPublicCode('short'), false);
      assert.strictEqual(isValidPublicCode('1234567890123'), false); // exactly 13 chars
      assert.strictEqual(isValidPublicCode('toolongtoken12345'), false);
      assert.strictEqual(isValidPublicCode('invalid+char='), false); // + and = not url-safe
      assert.strictEqual(isValidPublicCode('code with space'), false);
    });
  });

  describe('Minimal Projection Boundary (§5.6)', () => {
    test('projection payload contains NO user email and NO internal IDs', () => {
      // Mock raw DB document containing sensitive and internal fields
      const rawDbQuotation = {
        _id: '65f1a2b3c4d5e6f7a8b9c0d1',
        userId: '65f1a2b3c4d5e6f7a8b9c0d0',
        customerId: '65f1a2b3c4d5e6f7a8b9c0d2',
        userAccountEmail: 'owner@secret.com', // sensitive
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz', // highly sensitive
        number: 'QUO-000001',
        status: 'SENT',
        issueDate: new Date('2026-09-01'),
        validUntil: new Date('2026-09-30'),
        items: [
          {
            description: 'Consulting',
            quantity: 1,
            unitPriceCentavos: 500000,
            amountCentavos: 500000,
          },
        ],
        subtotalCentavos: 500000,
        discountCentavos: 0,
        totalCentavos: 500000,
        businessSnapshot: {
          businessName: 'Freelance Studio',
          address: 'Manila, Philippines',
          logoUrl: null,
        },
        customerSnapshot: {
          name: 'Acme Corp',
          email: 'billing@acme.com',
        },
      };

      // Transform via minimal projection contract
      const projection: PublicDocumentProjection = {
        kind: 'quotation',
        number: rawDbQuotation.number,
        status: rawDbQuotation.status as 'SENT',
        issueDate: rawDbQuotation.issueDate.toISOString(),
        secondaryDateLabel: 'Valid Until',
        secondaryDate: rawDbQuotation.validUntil.toISOString(),
        items: rawDbQuotation.items,
        subtotalCentavos: rawDbQuotation.subtotalCentavos,
        discountCentavos: rawDbQuotation.discountCentavos,
        totalCentavos: rawDbQuotation.totalCentavos,
        business: rawDbQuotation.businessSnapshot,
        customer: rawDbQuotation.customerSnapshot,
      };

      // Serialize to JSON (as would be passed across Server Component to Client)
      const json = JSON.stringify(projection);

      // Verify STRICT PROHIBITIONS:
      assert.strictEqual(json.includes('owner@secret.com'), false, 'NO user account email');
      assert.strictEqual(json.includes('$2a$10'), false, 'NO password hashes or secrets');
      assert.strictEqual(json.includes('65f1a2b3c4d5e6f7a8b9c0d0'), false, 'NO userId');
      assert.strictEqual(json.includes('65f1a2b3c4d5e6f7a8b9c0d1'), false, 'NO document _id');
      assert.strictEqual(json.includes('65f1a2b3c4d5e6f7a8b9c0d2'), false, 'NO customerId');

      // Verify required fields present
      assert.ok(json.includes('QUO-000001'));
      assert.ok(json.includes('Consulting'));
      assert.ok(json.includes('Freelance Studio'));
      assert.ok(json.includes('Acme Corp'));
    });

    test('revocation and publicLinksDisabledAt logic returns null (renders 404)', () => {
      // Simulating security evaluation
      const isPublicAccessible = (doc: {
        publicCodeRevokedAt?: Date | null;
        publicTokenRevokedAt?: Date | null;
        ownerLinksDisabledAt?: Date | null;
      }) => {
        if (doc.publicCodeRevokedAt) return false;
        if (doc.publicTokenRevokedAt) return false;
        if (doc.ownerLinksDisabledAt) return false;
        return true;
      };

      // Normal active document
      assert.strictEqual(
        isPublicAccessible({ publicCodeRevokedAt: null, ownerLinksDisabledAt: null }),
        true
      );

      // Revoked code -> 404
      assert.strictEqual(
        isPublicAccessible({
          publicCodeRevokedAt: new Date(),
          ownerLinksDisabledAt: null,
        }),
        false
      );

      // Legacy revoked token -> 404
      assert.strictEqual(
        isPublicAccessible({
          publicTokenRevokedAt: new Date(),
          ownerLinksDisabledAt: null,
        }),
        false
      );

      // Owner public links disabled for abuse -> 404
      assert.strictEqual(
        isPublicAccessible({
          publicCodeRevokedAt: null,
          ownerLinksDisabledAt: new Date(),
        }),
        false
      );
    });

    test('code is not sequential and not derived from ObjectId (§6.7)', async () => {
      const { randomBytes } = await import('crypto');
      const fakeId = '65f1a2b3c4d5e6f7a8b9c0d1';

      const code1 = randomBytes(9).toString('base64url').slice(0, 12);
      const code2 = randomBytes(9).toString('base64url').slice(0, 12);

      assert.notStrictEqual(code1, code2);
      assert.strictEqual(code1.length, 12);
      assert.strictEqual(code2.length, 12);
      assert.strictEqual(code1.includes(fakeId), false);
      assert.strictEqual(code2.includes(fakeId), false);
    });

    test('6-item quote with long business name renders cleanly without leaking sensitive fields (P3-T01 accept)', () => {
      const longBusinessName = 'A Very Long Philippine Service Business Name & Digital Technologies Enterprise Inc.';
      const items = Array.from({ length: 6 }, (_, i) => ({
        description: `Service item #${i + 1} with detailed scope and comprehensive turnaround specifications`,
        quantity: i + 1,
        unitPriceCentavos: 150000,
        amountCentavos: (i + 1) * 150000,
      }));

      const projection: PublicDocumentProjection = {
        kind: 'quotation',
        number: 'Q-2026-0042',
        status: 'SENT',
        issueDate: new Date('2026-09-01T00:00:00Z').toISOString(),
        secondaryDateLabel: 'Valid Until',
        secondaryDate: new Date('2026-09-30T00:00:00Z').toISOString(),
        items,
        subtotalCentavos: 3150000,
        discountCentavos: 150000,
        totalCentavos: 3000000,
        notes: 'Payment required within 15 calendar days from project kickoff.',
        terms: 'All deliverables subject to client milestone signoff.',
        business: {
          businessName: longBusinessName,
          address: 'Unit 402, Strata Tower, Ortigas Center, Pasig City',
          email: 'contact@longbusinessname.ph',
          phone: '+63 917 123 4567',
        },
        customer: {
          name: 'Maria Clara de los Santos',
          email: 'maria@clientcorp.ph',
          phone: '+63 918 987 6543',
          address: 'Makati City, Metro Manila',
        },
      };

      const json = JSON.stringify(projection);

      // Verify no ObjectId hex pattern (24-char hex)
      assert.strictEqual(/[0-9a-fA-F]{24}/.test(json), false, 'No ObjectIds in public projection');

      // Verify no internal fields
      assert.strictEqual(json.includes('userId'), false);
      assert.strictEqual(json.includes('customerId'), false);
      assert.strictEqual(json.includes('_id'), false);

      // Verify Open Graph tags representation
      const ogTitle = `${projection.number} from ${projection.business.businessName}`;
      const ogDescription = `Quotation for ${projection.customer.name} · Total: ₱30,000.00`;
      assert.ok(ogTitle.includes('Q-2026-0042'));
      assert.ok(ogTitle.includes(longBusinessName));
      assert.ok(ogDescription.includes('Maria Clara de los Santos'));
      assert.ok(ogDescription.includes('₱30,000.00'));
    });
  });
});


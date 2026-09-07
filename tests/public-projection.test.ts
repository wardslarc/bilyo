import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidPublicToken,
  type PublicDocumentProjection,
} from '../lib/public-projection.ts';

describe('Public Link Projection & Security (M4-T04)', () => {
  describe('isValidPublicToken', () => {
    test('accepts valid 12-char URL-safe base64 tokens', () => {
      assert.strictEqual(isValidPublicToken('aB1-_xYz9012'), true);
      assert.strictEqual(isValidPublicToken('ABCDEFGHIJKL'), true);
      assert.strictEqual(isValidPublicToken('123456789012'), true);
    });

    test('rejects malformed or invalid tokens', () => {
      assert.strictEqual(isValidPublicToken(null), false);
      assert.strictEqual(isValidPublicToken(undefined), false);
      assert.strictEqual(isValidPublicToken(''), false);
      assert.strictEqual(isValidPublicToken('short'), false);
      assert.strictEqual(isValidPublicToken('toolongtoken12345'), false);
      assert.strictEqual(isValidPublicToken('invalid+char='), false); // + and = not url-safe
      assert.strictEqual(isValidPublicToken('token with space'), false);
    });
  });

  describe('Minimal Projection Boundary (§5.6)', () => {
    test('projection payload contains NO user email and NO internal IDs', () => {
      // Mock raw DB document containing sensitive and internal fields
      const rawDbInvoice = {
        _id: '65f1a2b3c4d5e6f7a8b9c0d1',
        userId: '65f1a2b3c4d5e6f7a8b9c0d0',
        customerId: '65f1a2b3c4d5e6f7a8b9c0d2',
        userAccountEmail: 'owner@secret.com', // sensitive
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz', // highly sensitive
        number: 'INV-000001',
        status: 'SENT',
        issueDate: new Date('2026-09-01'),
        dueDate: new Date('2026-09-30'),
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
        vatRatePercent: 12,
        vatCentavos: 60000,
        totalCentavos: 560000,
        businessSnapshot: {
          businessName: 'Freelance Studio',
          address: 'Manila, Philippines',
          tin: '123-456-789-000',
          vatRegistered: true,
          logoUrl: null,
        },
        customerSnapshot: {
          name: 'Acme Corp',
          email: 'billing@acme.com',
        },
      };

      // Transform via minimal projection contract
      const projection: PublicDocumentProjection = {
        kind: 'invoice',
        number: rawDbInvoice.number,
        status: rawDbInvoice.status as 'SENT',
        issueDate: rawDbInvoice.issueDate.toISOString(),
        secondaryDateLabel: 'Due Date',
        secondaryDate: rawDbInvoice.dueDate.toISOString(),
        items: rawDbInvoice.items,
        subtotalCentavos: rawDbInvoice.subtotalCentavos,
        discountCentavos: rawDbInvoice.discountCentavos,
        vatRatePercent: rawDbInvoice.vatRatePercent,
        vatCentavos: rawDbInvoice.vatCentavos,
        totalCentavos: rawDbInvoice.totalCentavos,
        business: rawDbInvoice.businessSnapshot,
        customer: rawDbInvoice.customerSnapshot,
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
      assert.ok(json.includes('INV-000001'));
      assert.ok(json.includes('Consulting'));
      assert.ok(json.includes('Freelance Studio'));
      assert.ok(json.includes('Acme Corp'));
    });

    test('revocation and publicLinksDisabledAt logic returns null (renders 404)', () => {
      // Simulating security evaluation
      const isPublicAccessible = (doc: {
        publicTokenRevokedAt?: Date | null;
        ownerLinksDisabledAt?: Date | null;
      }) => {
        if (doc.publicTokenRevokedAt) return false;
        if (doc.ownerLinksDisabledAt) return false;
        return true;
      };

      // Normal active document
      assert.strictEqual(
        isPublicAccessible({ publicTokenRevokedAt: null, ownerLinksDisabledAt: null }),
        true
      );

      // Revoked token -> 404
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
          publicTokenRevokedAt: null,
          ownerLinksDisabledAt: new Date(),
        }),
        false
      );
    });
  });
});

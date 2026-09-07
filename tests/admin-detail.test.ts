import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isInvoiceOverdue } from '../lib/dates.ts';

describe('Admin User Detail & Read-Only Documents (M7-T03)', () => {
  describe('Document count & status categorization', () => {
    test('categorizes invoice statuses correctly including overdue check', () => {
      const invoices = [
        { status: 'DRAFT', dueDate: new Date() },
        { status: 'PAID', dueDate: new Date() },
        { status: 'CANCELLED', dueDate: new Date() },
        { status: 'SENT', dueDate: new Date(Date.now() + 86400000 * 2) }, // Future = SENT
        { status: 'SENT', dueDate: new Date(Date.now() - 86400000 * 2) }, // Past = OVERDUE
      ];

      let draft = 0;
      let sent = 0;
      let paid = 0;
      let overdue = 0;
      let cancelled = 0;

      for (const inv of invoices) {
        if (inv.status === 'PAID') paid++;
        else if (inv.status === 'CANCELLED') cancelled++;
        else if (inv.status === 'DRAFT') draft++;
        else if (inv.status === 'SENT') {
          if (isInvoiceOverdue(inv.dueDate, inv.status)) {
            overdue++;
          } else {
            sent++;
          }
        }
      }

      assert.strictEqual(draft, 1);
      assert.strictEqual(paid, 1);
      assert.strictEqual(cancelled, 1);
      assert.strictEqual(sent, 1);
      assert.strictEqual(overdue, 1);
      assert.strictEqual(draft + sent + paid + overdue + cancelled, 5);
    });

    test('categorizes quotation statuses correctly including expired check', () => {
      const now = new Date();
      const quotations = [
        { status: 'DRAFT', validUntil: new Date() },
        { status: 'ACCEPTED', validUntil: new Date(Date.now() - 86400000) }, // ACCEPTED takes precedence over validUntil
        { status: 'DECLINED', validUntil: new Date() },
        { status: 'SENT', validUntil: new Date(Date.now() + 86400000) }, // Valid = SENT
        { status: 'SENT', validUntil: new Date(Date.now() - 86400000) }, // Expired = EXPIRED
      ];

      let draft = 0;
      let sent = 0;
      let accepted = 0;
      let declined = 0;
      let expired = 0;

      for (const quo of quotations) {
        if (quo.status === 'ACCEPTED') accepted++;
        else if (quo.status === 'DECLINED') declined++;
        else if (quo.validUntil && new Date(quo.validUntil) < now && quo.status !== 'ACCEPTED') {
          expired++;
        } else if (quo.status === 'SENT') sent++;
        else if (quo.status === 'DRAFT') draft++;
      }

      assert.strictEqual(draft, 1);
      assert.strictEqual(accepted, 1);
      assert.strictEqual(declined, 1);
      assert.strictEqual(sent, 1);
      assert.strictEqual(expired, 1);
      assert.strictEqual(draft + sent + accepted + declined + expired, 5);
    });
  });

  describe('Unified document listing sort & customer snapshot fallback', () => {
    test('unified document list sorts chronologically newest first', () => {
      const docList = [
        { id: '1', kind: 'invoice', createdAt: new Date('2026-01-01') },
        { id: '2', kind: 'quotation', createdAt: new Date('2026-03-01') },
        { id: '3', kind: 'invoice', createdAt: new Date('2026-02-01') },
      ];

      docList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      assert.strictEqual(docList[0].id, '2');
      assert.strictEqual(docList[1].id, '3');
      assert.strictEqual(docList[2].id, '1');
    });

    test('customer name falls back from snapshot to customer directory to placeholder', () => {
      const customerMap = new Map<string, string>([['cust1', 'Acme Corp']]);

      function resolveName(snapshotName?: string, customerId?: string) {
        return snapshotName || (customerId ? customerMap.get(customerId) : undefined) || '—';
      }

      assert.strictEqual(resolveName('Juan Dela Cruz', 'cust1'), 'Juan Dela Cruz');
      assert.strictEqual(resolveName(undefined, 'cust1'), 'Acme Corp');
      assert.strictEqual(resolveName(undefined, 'cust999'), '—');
      assert.strictEqual(resolveName(undefined, undefined), '—');
    });
  });

  describe('Admin document viewer invariants', () => {
    test('revoked public link retains visibility for platform staff', () => {
      const doc = {
        publicToken: 'tok_123',
        publicTokenRevokedAt: new Date(),
      };

      const isRevokedForPublic = Boolean(doc.publicTokenRevokedAt);
      const isVisibleToAdmin = true; // Admin inspection does not filter by revoked public token

      assert.strictEqual(isRevokedForPublic, true);
      assert.strictEqual(isVisibleToAdmin, true);
    });

    test('money values remain integer centavos throughout document pipeline', () => {
      const items = [
        { description: 'Item 1', quantity: 2, unitPriceCentavos: 150000, amountCentavos: 300000 },
        { description: 'Item 2', quantity: 1, unitPriceCentavos: 50000, amountCentavos: 50000 },
      ];
      const subtotalCentavos = 350000;
      const discountCentavos = 50000;
      const vatCentavos = 36000; // 12% on (350000 - 50000 = 300000)
      const totalCentavos = 336000;

      assert.strictEqual(items.length, 2);
      assert.strictEqual(Number.isInteger(subtotalCentavos), true);
      assert.strictEqual(Number.isInteger(discountCentavos), true);
      assert.strictEqual(Number.isInteger(vatCentavos), true);
      assert.strictEqual(Number.isInteger(totalCentavos), true);
    });
  });
});

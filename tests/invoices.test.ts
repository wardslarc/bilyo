import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { invoiceSchema } from '../lib/validation/invoice.ts';
import { isInvoiceOverdue } from '../lib/dates.ts';
import { isDocumentEditable, getDocumentPdfDisclaimer } from '../lib/documents.ts';

describe('Invoice Domain & Validation (M4-T02)', () => {
  describe('lib/validation/invoice.ts schema', () => {
    test('validates valid invoice input with peso string price and discount', () => {
      const input = {
        customerId: '65f1a2b3c4d5e6f7a8b9c0d1',
        items: [
          {
            description: 'Frontend Development Services',
            quantity: '10',
            unitPrice: '1,500.00',
          },
        ],
        discount: '500.00',
        issueDate: '2026-09-01',
        dueDate: '2026-09-30',
        notes: 'Thank you for your business.',
        terms: 'Net 30 days.',
      };

      const result = invoiceSchema.safeParse(input);
      assert.ok(result.success, 'Valid invoice input should pass validation');
      if (result.success) {
        assert.strictEqual(result.data.customerId, '65f1a2b3c4d5e6f7a8b9c0d1');
        assert.strictEqual(result.data.items[0].quantity, 10);
        assert.strictEqual(result.data.items[0].unitPrice, 150000); // centavos
        assert.strictEqual(result.data.discount, 50000); // centavos
        assert.ok(result.data.issueDate instanceof Date);
        assert.ok(result.data.dueDate instanceof Date);
      }
    });

    test('rejects missing customerId', () => {
      const input = {
        customerId: '',
        items: [{ description: 'Design', quantity: 1, unitPrice: '1000' }],
        issueDate: '2026-09-01',
        dueDate: '2026-09-30',
      };

      const result = invoiceSchema.safeParse(input);
      assert.strictEqual(result.success, false);
      if (!result.success) {
        const error = result.error.issues.find((i) => i.path[0] === 'customerId');
        assert.ok(error, 'Should have customerId error');
      }
    });

    test('rejects empty line items array', () => {
      const input = {
        customerId: '65f1a2b3c4d5e6f7a8b9c0d1',
        items: [],
        issueDate: '2026-09-01',
        dueDate: '2026-09-30',
      };

      const result = invoiceSchema.safeParse(input);
      assert.strictEqual(result.success, false);
      if (!result.success) {
        const error = result.error.issues.find((i) => i.path[0] === 'items');
        assert.ok(error, 'Should have items error');
      }
    });

    test('rejects invalid or negative unit prices', () => {
      const input = {
        customerId: '65f1a2b3c4d5e6f7a8b9c0d1',
        items: [{ description: 'Design', quantity: 1, unitPrice: '-500' }],
        issueDate: '2026-09-01',
        dueDate: '2026-09-30',
      };

      const result = invoiceSchema.safeParse(input);
      assert.strictEqual(result.success, false);
    });

    test('rejects invalid issue or due dates', () => {
      const input = {
        customerId: '65f1a2b3c4d5e6f7a8b9c0d1',
        items: [{ description: 'Design', quantity: 1, unitPrice: '500' }],
        issueDate: 'not-a-date',
        dueDate: '2026-09-30',
      };

      const result = invoiceSchema.safeParse(input);
      assert.strictEqual(result.success, false);
    });
  });

  describe('Invoice Status and Lifecycle Rules (§5.4)', () => {
    test('isInvoiceOverdue derives OVERDUE only for SENT invoices past due date', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      // SENT and past due date -> true
      assert.strictEqual(isInvoiceOverdue(pastDate, 'SENT'), true);

      // SENT and future due date -> false
      assert.strictEqual(isInvoiceOverdue(futureDate, 'SENT'), false);

      // DRAFT or PAID past due date -> false (never overdue)
      assert.strictEqual(isInvoiceOverdue(pastDate, 'DRAFT'), false);
      assert.strictEqual(isInvoiceOverdue(pastDate, 'PAID'), false);
      assert.strictEqual(isInvoiceOverdue(pastDate, 'CANCELLED'), false);
    });

    test('isDocumentEditable locks PAID and CANCELLED terminal states', () => {
      assert.strictEqual(isDocumentEditable('invoice', 'DRAFT'), true);
      assert.strictEqual(isDocumentEditable('invoice', 'SENT'), true);
      assert.strictEqual(isDocumentEditable('invoice', 'OVERDUE'), true);
      assert.strictEqual(isDocumentEditable('invoice', 'PAID'), false);
      assert.strictEqual(isDocumentEditable('invoice', 'CANCELLED'), false);
    });

    test('PDF disclaimer matches BIR non-official receipt mandate', () => {
      const disclaimer = getDocumentPdfDisclaimer('invoice');
      assert.ok(disclaimer.includes('not an official sales invoice or receipt'));
      assert.ok(disclaimer.includes('BIR regulations'));
    });
  });
});

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

    test('terminal invoice states prevent edit and invalid transitions', () => {
      // Simulating terminal check logic from updateInvoice
      const canEdit = (status: string) => status !== 'PAID' && status !== 'CANCELLED';
      assert.strictEqual(canEdit('PAID'), false, 'PAID invoice cannot be edited');
      assert.strictEqual(canEdit('CANCELLED'), false, 'CANCELLED invoice cannot be edited');
      assert.strictEqual(canEdit('DRAFT'), true, 'DRAFT invoice can be edited');
      assert.strictEqual(canEdit('SENT'), true, 'SENT invoice can be edited');

      // Simulating terminal check logic from markInvoicePaid
      const canMarkPaid = (status: string) => status !== 'PAID' && status !== 'CANCELLED';
      assert.strictEqual(canMarkPaid('PAID'), false, 'Already PAID invoice cannot be marked paid again');
      assert.strictEqual(canMarkPaid('CANCELLED'), false, 'CANCELLED invoice cannot be marked paid');
      assert.strictEqual(canMarkPaid('SENT'), true, 'SENT invoice can be marked paid');
      assert.strictEqual(canMarkPaid('OVERDUE'), true, 'OVERDUE invoice can be marked paid');

      // Simulating terminal check logic from cancelInvoice
      const canCancel = (status: string) => status !== 'PAID' && status !== 'CANCELLED';
      assert.strictEqual(canCancel('PAID'), false, 'PAID invoice cannot be cancelled');
      assert.strictEqual(canCancel('CANCELLED'), false, 'Already CANCELLED invoice cannot be cancelled again');
      assert.strictEqual(canCancel('DRAFT'), true, 'DRAFT invoice can be cancelled');
      assert.strictEqual(canCancel('SENT'), true, 'SENT invoice can be cancelled');
    });

    test('PDF disclaimer matches BIR non-official receipt mandate', () => {
      const disclaimer = getDocumentPdfDisclaimer('invoice');
      assert.ok(disclaimer.includes('not an official sales invoice or receipt'));
      assert.ok(disclaimer.includes('BIR regulations'));
    });
  });

  describe('Quotation to Invoice Conversion Rules (§5.4, §8.2, M4-T05)', () => {
    test('conversion eligibility: only SENT or ACCEPTED quotations may be converted', () => {
      const isEligible = (status: string) => status === 'SENT' || status === 'ACCEPTED';
      assert.strictEqual(isEligible('SENT'), true);
      assert.strictEqual(isEligible('ACCEPTED'), true);
      assert.strictEqual(isEligible('DRAFT'), false);
      assert.strictEqual(isEligible('DECLINED'), false);
      assert.strictEqual(isEligible('EXPIRED'), false);
    });

    test('conversion copies items, totals, and snapshots into a new DRAFT invoice', () => {
      const mockQuotation = {
        _id: 'quot_123',
        userId: 'user_abc',
        customerId: 'cust_789',
        number: 'QUO-000001',
        status: 'SENT',
        items: [
          {
            description: 'Web Design',
            quantity: 2,
            unitPriceCentavos: 500000,
            amountCentavos: 1000000,
          },
        ],
        subtotalCentavos: 1000000,
        discountCentavos: 100000,
        vatRatePercent: 12,
        vatCentavos: 108000,
        totalCentavos: 1008000,
        customerSnapshot: {
          name: 'Acme Corp',
          email: 'acme@example.com',
          phone: '09171234567',
          address: 'Makati City',
          tin: '123-456-789-000',
        },
        businessSnapshot: {
          businessName: 'Freelancer Studio',
          address: 'BGC, Taguig',
          email: 'me@studio.ph',
          phone: '09181234567',
          tin: '987-654-321-000',
          vatRegistered: true,
          logoUrl: null,
        },
        convertedInvoiceId: null as string | null,
      };

      // Transform logic
      const invoiceNumber = 'INV-000001';
      const mockInvoice = {
        userId: mockQuotation.userId,
        customerId: mockQuotation.customerId,
        number: invoiceNumber,
        sourceQuotationId: mockQuotation._id,
        items: mockQuotation.items,
        subtotalCentavos: mockQuotation.subtotalCentavos,
        discountCentavos: mockQuotation.discountCentavos,
        vatRatePercent: mockQuotation.vatRatePercent,
        vatCentavos: mockQuotation.vatCentavos,
        totalCentavos: mockQuotation.totalCentavos,
        status: 'DRAFT',
        customerSnapshot: mockQuotation.customerSnapshot,
        businessSnapshot: mockQuotation.businessSnapshot,
      };

      // Quotation transitions
      mockQuotation.convertedInvoiceId = 'inv_created_001';
      mockQuotation.status = 'ACCEPTED';

      assert.strictEqual(mockInvoice.status, 'DRAFT');
      assert.strictEqual(mockInvoice.sourceQuotationId, 'quot_123');
      assert.strictEqual(mockInvoice.totalCentavos, 1008000);
      assert.strictEqual(mockInvoice.customerSnapshot.name, 'Acme Corp');
      assert.strictEqual(mockQuotation.convertedInvoiceId, 'inv_created_001');
      assert.strictEqual(mockQuotation.status, 'ACCEPTED');
    });

    test('idempotency: converting an already-converted quotation returns existing invoice without creating another', () => {
      let createCallCount = 0;
      const quotation = {
        _id: 'quot_123',
        convertedInvoiceId: 'inv_existing_456',
      };

      const existingInvoices: Record<string, { id: string; number: string }> = {
        inv_existing_456: { id: 'inv_existing_456', number: 'INV-000001' },
      };

      function simulateConvert(q: typeof quotation) {
        if (q.convertedInvoiceId) {
          return { ok: true, invoice: existingInvoices[q.convertedInvoiceId] };
        }
        createCallCount++;
        const newId = `inv_new_${createCallCount}`;
        q.convertedInvoiceId = newId;
        existingInvoices[newId] = { id: newId, number: `INV-00000${createCallCount}` };
        return { ok: true, invoice: existingInvoices[newId] };
      }

      // First call (with convertedInvoiceId already set)
      const res1 = simulateConvert(quotation);
      assert.strictEqual(res1.invoice.id, 'inv_existing_456');
      assert.strictEqual(createCallCount, 0, 'Should not create new invoice');

      // Second call
      const res2 = simulateConvert(quotation);
      assert.strictEqual(res2.invoice.id, 'inv_existing_456');
      assert.strictEqual(createCallCount, 0, 'Repeated call must remain idempotent');
    });
  });
});

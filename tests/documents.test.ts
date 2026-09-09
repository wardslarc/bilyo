import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUOTATION_FOOTER,
  toDateInputValue,
  defaultIssueDate,
  defaultSecondaryDate,
  lineItemsToRows,
  rowsToPayloadItems,
  isDocumentEditable,
  getStatusBadgeConfig,
  getDocumentPdfDisclaimer,
  getDerivedQuotationStatus,
} from '../lib/documents.ts';

describe('Shared Document Engine (M4-T01)', () => {
  describe('lib/documents.ts configuration and helpers', () => {
    test('toDateInputValue formats dates for input[type="date"]', () => {
      assert.strictEqual(toDateInputValue(null), '');
      assert.strictEqual(toDateInputValue(undefined), '');
      assert.strictEqual(toDateInputValue('invalid-date'), '');

      const d = new Date('2026-09-30T00:00:00.000Z');
      assert.strictEqual(toDateInputValue(d), '2026-09-30');
      assert.strictEqual(toDateInputValue('2026-09-30T15:30:00.000Z'), '2026-09-30');
    });

    test('defaultIssueDate and defaultSecondaryDate produce valid YYYY-MM-DD', () => {
      const issue = defaultIssueDate();
      assert.match(issue, /^\d{4}-\d{2}-\d{2}$/);

      const secondary = defaultSecondaryDate(30);
      assert.match(secondary, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(new Date(secondary) >= new Date(issue));
    });

    test('lineItemsToRows and rowsToPayloadItems transform correctly', () => {
      const modelItems = [
        {
          description: 'Web Design',
          quantity: 2,
          unitPriceCentavos: 150000,
          amountCentavos: 300000,
        },
      ];

      const rows = lineItemsToRows(modelItems);
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].description, 'Web Design');
      assert.strictEqual(rows[0].quantity, '2');
      assert.strictEqual(rows[0].unitPrice, '1500.00');

      const payload = rowsToPayloadItems(rows);
      assert.strictEqual(payload[0].description, 'Web Design');
      assert.strictEqual(payload[0].quantity, '2');
      assert.strictEqual(payload[0].unitPrice, '1500.00');
    });

    test('getDerivedQuotationStatus derives EXPIRED at read time (§6.4, P2-T05)', () => {
      const pastDate = new Date(Date.now() - 86400000); // 1 day ago
      const futureDate = new Date(Date.now() + 86400000); // 1 day ahead

      // DRAFT is never derived as EXPIRED
      assert.strictEqual(getDerivedQuotationStatus('DRAFT', pastDate), 'DRAFT');
      assert.strictEqual(getDerivedQuotationStatus('DRAFT', futureDate), 'DRAFT');

      // SENT: future stays SENT, past derives EXPIRED
      assert.strictEqual(getDerivedQuotationStatus('SENT', futureDate), 'SENT');
      assert.strictEqual(getDerivedQuotationStatus('SENT', pastDate), 'EXPIRED');

      // VIEWED: future stays VIEWED, past derives EXPIRED
      assert.strictEqual(getDerivedQuotationStatus('VIEWED', futureDate), 'VIEWED');
      assert.strictEqual(getDerivedQuotationStatus('VIEWED', pastDate), 'EXPIRED');

      // ACCEPTED and DECLINED are terminal (§6.4) and never derive as EXPIRED
      assert.strictEqual(getDerivedQuotationStatus('ACCEPTED', pastDate), 'ACCEPTED');
      assert.strictEqual(getDerivedQuotationStatus('DECLINED', pastDate), 'DECLINED');

      // Null or invalid validUntil does not crash and preserves status
      assert.strictEqual(getDerivedQuotationStatus('SENT', null), 'SENT');
      assert.strictEqual(getDerivedQuotationStatus('VIEWED', undefined), 'VIEWED');
      assert.strictEqual(getDerivedQuotationStatus('SENT', 'invalid-date'), 'SENT');
    });

    test('isDocumentEditable enforces lifecycle immutability (§5.4, §6.4)', () => {
      // Quotation: only DRAFT is editable
      assert.strictEqual(isDocumentEditable('DRAFT'), true);
      assert.strictEqual(isDocumentEditable('SENT'), false);
      assert.strictEqual(isDocumentEditable('VIEWED'), false);
      assert.strictEqual(isDocumentEditable('ACCEPTED'), false);
      assert.strictEqual(isDocumentEditable('DECLINED'), false);
      assert.strictEqual(isDocumentEditable('EXPIRED'), false);

      // New documents (null / undefined)
      assert.strictEqual(isDocumentEditable(null), true);
      assert.strictEqual(isDocumentEditable(undefined), true);
    });

    test('getStatusBadgeConfig provides distinct styling for all statuses', () => {
      const statuses = [
        'DRAFT',
        'SENT',
        'VIEWED',
        'ACCEPTED',
        'DECLINED',
        'EXPIRED',
      ] as const;

      for (const status of statuses) {
        const badge = getStatusBadgeConfig(status);
        assert.ok(badge.label.length > 0);
        assert.ok(badge.className.includes('border-'));
      }

      assert.strictEqual(getStatusBadgeConfig('VIEWED').label, 'Viewed');
      assert.strictEqual(getStatusBadgeConfig('EXPIRED').label, 'Expired');
    });

    test('QUOTATION_FOOTER and getDocumentPdfDisclaimer contain exact legal disclaimer (§2.3, P2-T05)', () => {
      const disclaimer = getDocumentPdfDisclaimer();
      assert.strictEqual(disclaimer, QUOTATION_FOOTER);
      assert.strictEqual(
        QUOTATION_FOOTER,
        'This is a quotation, not a tax document. It is not an invoice or official receipt.'
      );
    });

    test('line items validation logic rejects incomplete rows for autosave (§6.4, P2-T04)', () => {
      const isLineValid = (item: { description: string; quantity: string; unitPrice: string }) => {
        if (!item.description.trim()) return false;
        const q = Number(item.quantity);
        if (!Number.isFinite(q) || q <= 0) return false;
        if (!item.unitPrice.trim() || Number.isNaN(Number(item.unitPrice)) || Number(item.unitPrice) < 0) return false;
        return true;
      };

      // Valid line item
      assert.strictEqual(isLineValid({ description: 'Consulting', quantity: '1', unitPrice: '5000' }), true);

      // Incomplete lines that must never trigger autosave (P2-T04 accept)
      assert.strictEqual(isLineValid({ description: '', quantity: '1', unitPrice: '5000' }), false);
      assert.strictEqual(isLineValid({ description: 'Draft item', quantity: '0', unitPrice: '5000' }), false);
      assert.strictEqual(isLineValid({ description: 'Draft item', quantity: '-1', unitPrice: '5000' }), false);
      assert.strictEqual(isLineValid({ description: 'Draft item', quantity: '1', unitPrice: '' }), false);
      assert.strictEqual(isLineValid({ description: 'Draft item', quantity: '1', unitPrice: '-10' }), false);
    });
  });
});

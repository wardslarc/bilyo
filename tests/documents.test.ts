import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DOCUMENT_CONFIG,
  toDateInputValue,
  defaultIssueDate,
  defaultSecondaryDate,
  lineItemsToRows,
  rowsToPayloadItems,
  isDocumentEditable,
  getStatusBadgeConfig,
  getDocumentPdfDisclaimer,
} from '../lib/documents.ts';

describe('Shared Document Engine (M4-T01)', () => {
  describe('lib/documents.ts configuration and helpers', () => {
    test('DOCUMENT_CONFIG defines metadata for quotation and invoice', () => {
      assert.strictEqual(DOCUMENT_CONFIG.quotation.title, 'Quotation');
      assert.strictEqual(DOCUMENT_CONFIG.quotation.numberPrefix, 'QUO');
      assert.strictEqual(DOCUMENT_CONFIG.quotation.secondaryDateLabel, 'Valid Until');
      assert.strictEqual(DOCUMENT_CONFIG.quotation.secondaryDateKey, 'validUntil');

      assert.strictEqual(DOCUMENT_CONFIG.invoice.title, 'Invoice');
      assert.strictEqual(DOCUMENT_CONFIG.invoice.numberPrefix, 'INV');
      assert.strictEqual(DOCUMENT_CONFIG.invoice.secondaryDateLabel, 'Due Date');
      assert.strictEqual(DOCUMENT_CONFIG.invoice.secondaryDateKey, 'dueDate');
    });

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

    test('isDocumentEditable enforces lifecycle immutability (§5.4)', () => {
      // Quotation: only DRAFT is editable
      assert.strictEqual(isDocumentEditable('quotation', 'DRAFT'), true);
      assert.strictEqual(isDocumentEditable('quotation', 'SENT'), false);
      assert.strictEqual(isDocumentEditable('quotation', 'ACCEPTED'), false);
      assert.strictEqual(isDocumentEditable('quotation', 'DECLINED'), false);
      assert.strictEqual(isDocumentEditable('quotation', 'EXPIRED'), false);

      // Invoice: PAID and CANCELLED are terminal and immutable
      assert.strictEqual(isDocumentEditable('invoice', 'DRAFT'), true);
      assert.strictEqual(isDocumentEditable('invoice', 'SENT'), true);
      assert.strictEqual(isDocumentEditable('invoice', 'PAID'), false);
      assert.strictEqual(isDocumentEditable('invoice', 'CANCELLED'), false);
      assert.strictEqual(isDocumentEditable('invoice', 'OVERDUE'), true);

      // New documents
      assert.strictEqual(isDocumentEditable('quotation', null), true);
      assert.strictEqual(isDocumentEditable('invoice', null), true);
    });

    test('getStatusBadgeConfig provides distinct styling for all statuses', () => {
      const statuses = [
        'DRAFT',
        'SENT',
        'ACCEPTED',
        'PAID',
        'OVERDUE',
        'DECLINED',
        'EXPIRED',
        'CANCELLED',
      ] as const;

      for (const status of statuses) {
        const badge = getStatusBadgeConfig(status);
        assert.ok(badge.label.length > 0);
        assert.ok(badge.className.includes('border-'));
      }
    });

    test('getDocumentPdfDisclaimer contains non-official disclaimer (AGENTS.md §4)', () => {
      const quoDisclaimer = getDocumentPdfDisclaimer('quotation');
      assert.ok(quoDisclaimer.includes('not an official sales invoice'));

      const invDisclaimer = getDocumentPdfDisclaimer('invoice');
      assert.ok(invDisclaimer.includes('not an official sales invoice'));
      assert.ok(invDisclaimer.includes('BIR regulations'));
    });
  });
});

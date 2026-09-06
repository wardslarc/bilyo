import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { styles, colors } from '../lib/pdf/shared/styles.ts';
import { formatMoney } from '../lib/money.ts';

describe('PDF Styles and Layout Rules (M3-T04)', () => {
  test('A4 page configuration and margins', () => {
    assert.strictEqual(styles.page.fontFamily, 'Helvetica');
    assert.strictEqual(styles.page.fontSize, 9);
    assert.strictEqual(styles.page.paddingTop, 40);
    assert.strictEqual(styles.page.paddingBottom, 60);
    assert.strictEqual(styles.page.paddingHorizontal, 40);
  });

  test('Table columns add up to 100% width', () => {
    const colNumWidth = Number.parseInt(styles.colNum.width.replace('%', ''), 10);
    const colDescWidth = Number.parseInt(styles.colDescription.width.replace('%', ''), 10);
    const colQtyWidth = Number.parseInt(styles.colQty.width.replace('%', ''), 10);
    const colUnitPriceWidth = Number.parseInt(styles.colUnitPrice.width.replace('%', ''), 10);
    const colAmountWidth = Number.parseInt(styles.colAmount.width.replace('%', ''), 10);

    const totalWidth = colNumWidth + colDescWidth + colQtyWidth + colUnitPriceWidth + colAmountWidth;
    assert.strictEqual(totalWidth, 100, 'Table column percentages must sum to 100%');
  });

  test('Decimal alignment: money columns and totals values are right-aligned', () => {
    // Both unit price and total amount cells in the table must be right-aligned
    assert.strictEqual(styles.colUnitPrice.textAlign, 'right');
    assert.strictEqual(styles.colAmount.textAlign, 'right');
    assert.strictEqual(styles.totalsValue.textAlign, 'right');
    assert.strictEqual(styles.totalsFinalValue.textAlign, 'right');

    // Verify that formatMoney outputs fixed 2-decimal strings so right-align lines up decimal points
    const sampleAmounts = [0, 50, 100, 123450, 999999900];
    for (const centavos of sampleAmounts) {
      const formatted = formatMoney(centavos);
      const dotIndex = formatted.indexOf('.');
      assert.ok(dotIndex !== -1, 'Formatted money must contain decimal point');
      assert.strictEqual(formatted.length - dotIndex - 1, 2, 'Must have exactly 2 decimal digits');
    }
  });

  test('Missing logo renders clean gap with defined dimensions', () => {
    assert.ok(styles.logoPlaceholder, 'logoPlaceholder style must exist');
    assert.ok(styles.logoPlaceholder.height > 0, 'Clean gap height must be greater than 0');
    assert.ok(styles.logoPlaceholder.marginBottom > 0, 'Clean gap must have bottom spacing');
  });

  test('Footer disclaimer styling is fixed and positioned at the bottom', () => {
    assert.strictEqual(styles.footer.position, 'absolute');
    assert.strictEqual(styles.footer.bottom, 20);
    assert.strictEqual(styles.footerDisclaimer.fontStyle, 'italic');
    assert.ok(styles.footerDisclaimer.fontSize <= 7, 'Disclaimer text should be subtle and small');
  });

  test('Brand palette is consistent and defined in hex', () => {
    assert.ok(colors.ink.startsWith('#'));
    assert.ok(colors.brass.startsWith('#'));
    assert.ok(colors.paper.startsWith('#'));
    assert.ok(colors.line.startsWith('#'));
  });
});

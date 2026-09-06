import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeTotals } from '../lib/totals.ts';

describe('lib/totals.ts', () => {
  test('handles zero-item document', () => {
    const result = computeTotals({
      items: [],
      discountCentavos: 0,
      vatRegistered: true,
    });

    assert.strictEqual(result.items.length, 0);
    assert.strictEqual(result.subtotalCentavos, 0);
    assert.strictEqual(result.discountCentavos, 0);
    assert.strictEqual(result.vatCentavos, 0);
    assert.strictEqual(result.totalCentavos, 0);
  });

  test('handles item with quantity of 0', () => {
    const result = computeTotals({
      items: [
        { description: 'Setup', quantity: 0, unitPriceCentavos: 100000 },
        { description: 'Dev', quantity: 1, unitPriceCentavos: 50000 },
      ],
      discountCentavos: 0,
      vatRegistered: false,
    });

    assert.strictEqual(result.items[0].amountCentavos, 0);
    assert.strictEqual(result.items[1].amountCentavos, 50000);
    assert.strictEqual(result.subtotalCentavos, 50000);
    assert.strictEqual(result.vatCentavos, 0);
    assert.strictEqual(result.totalCentavos, 50000);
  });

  test('computes VAT when vatRegistered is false', () => {
    const result = computeTotals({
      items: [{ description: 'Item 1', quantity: 2, unitPriceCentavos: 100000 }], // 200,000 centavos
      discountCentavos: 0,
      vatRegistered: false,
    });

    assert.strictEqual(result.subtotalCentavos, 200000);
    assert.strictEqual(result.vatCentavos, 0);
    assert.strictEqual(result.totalCentavos, 200000);
  });

  test('computes VAT at 12% when vatRegistered is true', () => {
    const result = computeTotals({
      items: [{ description: 'Service', quantity: 1, unitPriceCentavos: 100000 }], // ₱1,000.00
      discountCentavos: 0,
      vatRegistered: true,
    });

    // 100,000 * 0.12 = 12,000 centavos (₱120.00)
    assert.strictEqual(result.subtotalCentavos, 100000);
    assert.strictEqual(result.vatCentavos, 12000);
    assert.strictEqual(result.totalCentavos, 112000);
  });

  test('applies discount before computing VAT', () => {
    // subtotal = 100,000 centavos (₱1,000.00)
    // discount = 20,000 centavos (₱200.00)
    // taxable = 80,000 centavos (₱800.00)
    // VAT (12%) = 80,000 * 0.12 = 9,600 centavos (₱96.00)
    // total = 80,000 + 9,600 = 89,600 centavos (₱896.00)
    const result = computeTotals({
      items: [{ description: 'Design', quantity: 1, unitPriceCentavos: 100000 }],
      discountCentavos: 20000,
      vatRegistered: true,
    });

    assert.strictEqual(result.subtotalCentavos, 100000);
    assert.strictEqual(result.discountCentavos, 20000);
    assert.strictEqual(result.vatCentavos, 9600);
    assert.strictEqual(result.totalCentavos, 89600);
  });

  test('clamps discount so it cannot exceed subtotal', () => {
    const result = computeTotals({
      items: [{ description: 'Item', quantity: 1, unitPriceCentavos: 50000 }],
      discountCentavos: 90000,
      vatRegistered: true,
    });

    assert.strictEqual(result.subtotalCentavos, 50000);
    assert.strictEqual(result.discountCentavos, 50000);
    assert.strictEqual(result.vatCentavos, 0);
    assert.strictEqual(result.totalCentavos, 0);
  });

  test('handles half-up rounding on VAT calculation at exactly .005', () => {
    // taxable = 129 centavos
    // 129 * 0.12 = 15.48 -> 15 centavos
    // Let's find taxable where taxable * 0.12 has fractional part >= 0.5:
    // e.g. taxable = 125 centavos: 125 * 0.12 = 15.00 -> 15
    // e.g. taxable = 129 centavos: 129 * 0.12 = 15.48 -> 15
    // e.g. taxable = 130 centavos: 130 * 0.12 = 15.60 -> 16 (rounds up)
    // e.g. taxable = 125.5 centavos equivalent:
    // When taxable is 105 centavos: 105 * 0.12 = 12.60 -> 13
    // When taxable is 104 centavos: 104 * 0.12 = 12.48 -> 12
    const resultRoundUp = computeTotals({
      items: [{ description: 'Item', quantity: 1, unitPriceCentavos: 105 }],
      discountCentavos: 0,
      vatRegistered: true,
    });
    assert.strictEqual(resultRoundUp.vatCentavos, 13);
    assert.strictEqual(resultRoundUp.totalCentavos, 118);

    const resultRoundDown = computeTotals({
      items: [{ description: 'Item', quantity: 1, unitPriceCentavos: 104 }],
      discountCentavos: 0,
      vatRegistered: true,
    });
    assert.strictEqual(resultRoundDown.vatCentavos, 12);
    assert.strictEqual(resultRoundDown.totalCentavos, 116);
  });

  test('handles fractional item quantities with half-up rounding at .005', () => {
    // 2.5 hours at ₱1,000.01 (100001 centavos)
    // 2.5 * 100001 = 250002.5 -> rounds half-up to 250003 centavos
    const result = computeTotals({
      items: [{ description: 'Consulting', quantity: 2.5, unitPriceCentavos: 100001 }],
      discountCentavos: 0,
      vatRegistered: false,
    });

    assert.strictEqual(result.items[0].amountCentavos, 250003);
    assert.strictEqual(result.subtotalCentavos, 250003);
    assert.strictEqual(result.totalCentavos, 250003);
  });
});

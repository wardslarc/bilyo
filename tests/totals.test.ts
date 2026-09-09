import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeTotals } from '../lib/totals.ts';

describe('lib/totals.ts', () => {
  test('handles zero-item document', () => {
    const result = computeTotals({
      items: [],
      discountCentavos: 0,
    });

    assert.strictEqual(result.items.length, 0);
    assert.strictEqual(result.subtotalCentavos, 0);
    assert.strictEqual(result.discountCentavos, 0);
    assert.strictEqual(result.totalCentavos, 0);
  });

  test('handles item with quantity of 0', () => {
    const result = computeTotals({
      items: [
        { description: 'Setup', quantity: 0, unitPriceCentavos: 100000 },
        { description: 'Dev', quantity: 1, unitPriceCentavos: 50000 },
      ],
      discountCentavos: 0,
    });

    assert.strictEqual(result.items[0].amountCentavos, 0);
    assert.strictEqual(result.items[1].amountCentavos, 50000);
    assert.strictEqual(result.subtotalCentavos, 50000);
    assert.strictEqual(result.discountCentavos, 0);
    assert.strictEqual(result.totalCentavos, 50000);
  });

  test('computes subtotal and total without discount', () => {
    const result = computeTotals({
      items: [{ description: 'Item 1', quantity: 2, unitPriceCentavos: 100000 }], // 200,000 centavos
      discountCentavos: 0,
    });

    assert.strictEqual(result.subtotalCentavos, 200000);
    assert.strictEqual(result.discountCentavos, 0);
    assert.strictEqual(result.totalCentavos, 200000);
  });

  test('applies discount directly to compute total: subtotal -> discount -> total', () => {
    // subtotal = 100,000 centavos (₱1,000.00)
    // discount = 20,000 centavos (₱200.00)
    // total = 100,000 - 20,000 = 80,000 centavos (₱800.00)
    const result = computeTotals({
      items: [{ description: 'Design', quantity: 1, unitPriceCentavos: 100000 }],
      discountCentavos: 20000,
    });

    assert.strictEqual(result.subtotalCentavos, 100000);
    assert.strictEqual(result.discountCentavos, 20000);
    assert.strictEqual(result.totalCentavos, 80000);
  });

  test('clamps discount so it cannot exceed subtotal', () => {
    const result = computeTotals({
      items: [{ description: 'Item', quantity: 1, unitPriceCentavos: 50000 }],
      discountCentavos: 90000,
    });

    assert.strictEqual(result.subtotalCentavos, 50000);
    assert.strictEqual(result.discountCentavos, 50000);
    assert.strictEqual(result.totalCentavos, 0);
  });

  test('clamps negative discount to 0', () => {
    const result = computeTotals({
      items: [{ description: 'Item', quantity: 1, unitPriceCentavos: 50000 }],
      discountCentavos: -5000,
    });

    assert.strictEqual(result.subtotalCentavos, 50000);
    assert.strictEqual(result.discountCentavos, 0);
    assert.strictEqual(result.totalCentavos, 50000);
  });

  test('handles fractional item quantities with half-up rounding at .5', () => {
    // 2.5 hours at ₱1,000.01 (100001 centavos)
    // 2.5 * 100001 = 250002.5 -> rounds half-up to 250003 centavos
    const result = computeTotals({
      items: [{ description: 'Consulting', quantity: 2.5, unitPriceCentavos: 100001 }],
      discountCentavos: 0,
    });

    assert.strictEqual(result.items[0].amountCentavos, 250003);
    assert.strictEqual(result.subtotalCentavos, 250003);
    assert.strictEqual(result.totalCentavos, 250003);
  });

  test('handles fractional item quantities with half-up rounding down at < .5', () => {
    // 2.25 hours at ₱1,000.01 (100001 centavos)
    // 2.25 * 100001 = 225002.25 -> rounds to 225002 centavos
    const result = computeTotals({
      items: [{ description: 'Consulting', quantity: 2.25, unitPriceCentavos: 100001 }],
      discountCentavos: 0,
    });

    assert.strictEqual(result.items[0].amountCentavos, 225002);
    assert.strictEqual(result.subtotalCentavos, 225002);
    assert.strictEqual(result.totalCentavos, 225002);
  });
});

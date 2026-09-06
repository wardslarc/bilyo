import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  pesosToCentavos,
  centavosToPesos,
  formatMoney,
  roundHalfUp,
} from '../lib/money.ts';

describe('lib/money.ts', () => {
  describe('roundHalfUp', () => {
    test('rounds half-up at exactly .5 and .005 equivalent', () => {
      assert.strictEqual(roundHalfUp(0.5), 1);
      assert.strictEqual(roundHalfUp(0.499), 0);
      assert.strictEqual(roundHalfUp(1.5), 2);
      assert.strictEqual(roundHalfUp(2500000.5), 2500001);
      assert.strictEqual(roundHalfUp(2500000.4), 2500000);
      assert.strictEqual(roundHalfUp(0), 0);
    });
  });

  describe('pesosToCentavos', () => {
    test('parses peso strings without parseFloat', () => {
      assert.strictEqual(pesosToCentavos('25000.00'), 2500000);
      assert.strictEqual(pesosToCentavos('₱25,000.00'), 2500000);
      assert.strictEqual(pesosToCentavos('PHP 1,234.56'), 123456);
      assert.strictEqual(pesosToCentavos('  ₱ 500  '), 50000);
      assert.strictEqual(pesosToCentavos('100'), 10000);
      assert.strictEqual(pesosToCentavos('0'), 0);
      assert.strictEqual(pesosToCentavos(''), 0);
    });

    test('handles single decimal place', () => {
      assert.strictEqual(pesosToCentavos('10.5'), 1050);
      assert.strictEqual(pesosToCentavos('0.5'), 50);
    });

    test('rounds half-up at exactly .005', () => {
      // 25000.005 -> 25000.01 -> 2500001 centavos
      assert.strictEqual(pesosToCentavos('25000.005'), 2500001);
      assert.strictEqual(pesosToCentavos('25000.004'), 2500000);
      assert.strictEqual(pesosToCentavos('0.005'), 1);
      assert.strictEqual(pesosToCentavos('0.004'), 0);
      assert.strictEqual(pesosToCentavos('12.345'), 1235);
      assert.strictEqual(pesosToCentavos('12.344'), 1234);
    });

    test('handles number inputs safely', () => {
      assert.strictEqual(pesosToCentavos(25000), 2500000);
      assert.strictEqual(pesosToCentavos(1234.56), 123456);
      assert.strictEqual(pesosToCentavos(0), 0);
    });

    test('throws on invalid input', () => {
      assert.throws(() => pesosToCentavos('abc'), /Invalid peso amount/);
      assert.throws(() => pesosToCentavos('12.34.56'), /Invalid peso amount/);
    });
  });

  describe('centavosToPesos', () => {
    test('converts centavos to pesos', () => {
      assert.strictEqual(centavosToPesos(2500000), 25000);
      assert.strictEqual(centavosToPesos(123456), 1234.56);
      assert.strictEqual(centavosToPesos(50), 0.5);
      assert.strictEqual(centavosToPesos(0), 0);
    });
  });

  describe('formatMoney', () => {
    test('formats centavos with peso symbol and thousands commas', () => {
      assert.strictEqual(formatMoney(2500000), '₱25,000.00');
      assert.strictEqual(formatMoney(123456), '₱1,234.56');
      assert.strictEqual(formatMoney(50), '₱0.50');
      assert.strictEqual(formatMoney(5), '₱0.05');
      assert.strictEqual(formatMoney(0), '₱0.00');
      assert.strictEqual(formatMoney(-50000), '-₱500.00');
    });
  });
});

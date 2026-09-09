import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { markPaidInputSchema } from '../lib/validation/quotation.ts';

describe('Mark as Paid Validation & Domain Rules (§6.8, P4-T04)', () => {
  it('validates paid: true without custom amount (defaults handled server-side)', () => {
    const result = markPaidInputSchema.safeParse({ paid: true });
    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.paid, true);
      assert.strictEqual(result.data.amount, undefined);
    }
  });

  it('validates and converts peso amount to integer centavos', () => {
    const result1 = markPaidInputSchema.safeParse({ paid: true, amount: '25000.50' });
    assert.strictEqual(result1.success, true);
    if (result1.success) {
      assert.strictEqual(result1.data.amount, 2500050);
    }

    const result2 = markPaidInputSchema.safeParse({ paid: true, amount: '₱1,500.00' });
    assert.strictEqual(result2.success, true);
    if (result2.success) {
      assert.strictEqual(result2.data.amount, 150000);
    }

    const result3 = markPaidInputSchema.safeParse({ paid: true, amount: 500 });
    assert.strictEqual(result3.success, true);
    if (result3.success) {
      assert.strictEqual(result3.data.amount, 50000);
    }
  });

  it('rejects invalid, negative, or zero payment amounts', () => {
    const neg = markPaidInputSchema.safeParse({ paid: true, amount: '-100' });
    assert.strictEqual(neg.success, false);

    const zero = markPaidInputSchema.safeParse({ paid: true, amount: '0' });
    assert.strictEqual(zero.success, false);

    const invalid = markPaidInputSchema.safeParse({ paid: true, amount: 'abc' });
    assert.strictEqual(invalid.success, false);
  });

  it('validates paid: false for clearing payment status', () => {
    const result = markPaidInputSchema.safeParse({ paid: false });
    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.paid, false);
    }
  });

  it('ensures markQuotationPaid strictly checks for ACCEPTED status (§6.8)', () => {
    const actionsSource = fs.readFileSync(
      path.resolve(process.cwd(), 'actions/quotations.ts'),
      'utf-8'
    );

    // Verify check for quote.status !== 'ACCEPTED'
    assert.match(
      actionsSource,
      /quote\.status\s*!==\s*['"]ACCEPTED['"]/
    );
  });

  it('ensures markQuotationPaid produces MARKED_PAID and UNMARKED_PAID events (§6.8)', () => {
    const actionsSource = fs.readFileSync(
      path.resolve(process.cwd(), 'actions/quotations.ts'),
      'utf-8'
    );

    // Verify recordEvent with MARKED_PAID
    assert.match(actionsSource, /type:\s*['"]MARKED_PAID['"]/);
    // Verify recordEvent with UNMARKED_PAID
    assert.match(actionsSource, /type:\s*['"]UNMARKED_PAID['"]/);
    // Verify owner actor
    assert.match(actionsSource, /actor:\s*['"]OWNER['"]/);
  });

  it('ensures markQuotationPaid query is strictly userId-scoped (AGENTS.md §4.1)', () => {
    const actionsSource = fs.readFileSync(
      path.resolve(process.cwd(), 'actions/quotations.ts'),
      'utf-8'
    );

    assert.match(
      actionsSource,
      /Quotation\.findOne\(\{\s*_id:\s*id,\s*userId:\s*user\.id\s*\}\)/
    );
  });

  it('ensures public projection does not leak paidAt or paidAmountCentavos', () => {
    const projectionSource = fs.readFileSync(
      path.resolve(process.cwd(), 'lib/public-projection.ts'),
      'utf-8'
    );

    assert.doesNotMatch(projectionSource, /paidAt\s*:/);
    assert.doesNotMatch(projectionSource, /paidAmountCentavos\s*:/);
  });
});

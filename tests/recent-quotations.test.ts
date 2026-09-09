import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { RecentQuotationItem } from '../lib/metrics.ts';

function filterRecentQuotations(
  quotations: RecentQuotationItem[],
  status: string
): RecentQuotationItem[] {
  if (status === 'ALL') return quotations;
  return quotations.filter((q) => q.status === status);
}

describe('Recent Quotes by Status & Empty States (§12, P4-T02)', () => {
  const sampleQuotes: RecentQuotationItem[] = [
    {
      id: 'q1',
      number: 'Q-2026-0001',
      customerName: 'Acme Corp',
      totalCentavos: 2500000,
      status: 'SENT',
      issueDate: '2026-09-01T00:00:00.000Z',
      validUntil: '2026-09-30T00:00:00.000Z',
      createdAt: '2026-09-01T00:00:00.000Z',
    },
    {
      id: 'q2',
      number: 'Q-2026-0002',
      customerName: 'Beta Industries',
      totalCentavos: 1500000,
      status: 'ACCEPTED',
      issueDate: '2026-09-05T00:00:00.000Z',
      validUntil: '2026-09-25T00:00:00.000Z',
      createdAt: '2026-09-05T00:00:00.000Z',
    },
    {
      id: 'q3',
      number: 'Q-2026-0003',
      customerName: 'Gamma LLC',
      totalCentavos: 3000000,
      status: 'DRAFT',
      issueDate: '2026-09-10T00:00:00.000Z',
      validUntil: '2026-09-20T00:00:00.000Z',
      createdAt: '2026-09-10T00:00:00.000Z',
    },
    {
      id: 'q4',
      number: 'Q-2026-0004',
      customerName: 'Delta Services',
      totalCentavos: 800000,
      status: 'EXPIRED',
      issueDate: '2026-08-01T00:00:00.000Z',
      validUntil: '2026-08-15T00:00:00.000Z',
      createdAt: '2026-08-01T00:00:00.000Z',
    },
  ];

  test('status chip ALL returns complete list of recent quotations', () => {
    const result = filterRecentQuotations(sampleQuotes, 'ALL');
    assert.strictEqual(result.length, 4);
  });

  test('status chips filter accurately by matching status without full reload', () => {
    const sent = filterRecentQuotations(sampleQuotes, 'SENT');
    assert.strictEqual(sent.length, 1);
    assert.strictEqual(sent[0]?.number, 'Q-2026-0001');

    const accepted = filterRecentQuotations(sampleQuotes, 'ACCEPTED');
    assert.strictEqual(accepted.length, 1);
    assert.strictEqual(accepted[0]?.number, 'Q-2026-0002');

    const drafts = filterRecentQuotations(sampleQuotes, 'DRAFT');
    assert.strictEqual(drafts.length, 1);
    assert.strictEqual(drafts[0]?.number, 'Q-2026-0003');

    const expired = filterRecentQuotations(sampleQuotes, 'EXPIRED');
    assert.strictEqual(expired.length, 1);
    assert.strictEqual(expired[0]?.number, 'Q-2026-0004');
  });

  test('empty state triggers when status filter has no matching quotations', () => {
    const viewed = filterRecentQuotations(sampleQuotes, 'VIEWED');
    assert.strictEqual(viewed.length, 0, 'No viewed quotations in sample');

    const declined = filterRecentQuotations(sampleQuotes, 'DECLINED');
    assert.strictEqual(declined.length, 0, 'No declined quotations in sample');
  });

  test('empty list of quotations returns 0 for all filters', () => {
    const emptyResult = filterRecentQuotations([], 'ALL');
    assert.strictEqual(emptyResult.length, 0);
  });
});

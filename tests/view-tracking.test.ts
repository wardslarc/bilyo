import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Quotation View Tracking & State Machine (§6.4, P3-T03)', () => {
  // Pure domain simulation of recordQuotationView rules
  interface MockQuotation {
    _id: string;
    userId: string;
    status: string;
    viewedAt: Date | null;
    publicCodeRevokedAt?: Date | null;
  }

  function simulateRecordView(
    quote: MockQuotation,
    viewerUserId?: string | null
  ): { updated: boolean; newStatus: string; eventAppended: boolean } {
    if (quote.publicCodeRevokedAt) {
      return { updated: false, newStatus: quote.status, eventAppended: false };
    }

    // Guard: owner previewing their own link does not count
    if (viewerUserId && quote.userId === viewerUserId) {
      return { updated: false, newStatus: quote.status, eventAppended: false };
    }

    // If already viewed, or not in SENT status (e.g. ACCEPTED, DECLINED, DRAFT)
    if (quote.viewedAt || quote.status !== 'SENT') {
      return { updated: false, newStatus: quote.status, eventAppended: false };
    }

    // First public client view: transitions SENT -> VIEWED
    quote.status = 'VIEWED';
    quote.viewedAt = new Date();
    return { updated: true, newStatus: 'VIEWED', eventAppended: true };
  }

  test('first public render by client sets viewedAt, moves SENT → VIEWED, appends event (P3-T03 accept)', () => {
    const quote: MockQuotation = {
      _id: 'q1',
      userId: 'owner1',
      status: 'SENT',
      viewedAt: null,
    };

    const res = simulateRecordView(quote, null); // anonymous client
    assert.strictEqual(res.updated, true);
    assert.strictEqual(res.newStatus, 'VIEWED');
    assert.strictEqual(res.eventAppended, true);
    assert.ok(quote.viewedAt instanceof Date);
  });

  test('second view by client appends nothing and does not overwrite timestamp (P3-T03 accept)', () => {
    const initialTimestamp = new Date('2026-09-08T12:00:00Z');
    const quote: MockQuotation = {
      _id: 'q1',
      userId: 'owner1',
      status: 'VIEWED',
      viewedAt: initialTimestamp,
    };

    const res = simulateRecordView(quote, null);
    assert.strictEqual(res.updated, false);
    assert.strictEqual(res.eventAppended, false);
    assert.strictEqual(quote.status, 'VIEWED');
    assert.strictEqual(quote.viewedAt, initialTimestamp);
  });

  test('owner previewing their own quote does NOT count and appends no event (P3-T03 accept)', () => {
    const quote: MockQuotation = {
      _id: 'q1',
      userId: 'owner1',
      status: 'SENT',
      viewedAt: null,
    };

    const res = simulateRecordView(quote, 'owner1'); // logged-in owner
    assert.strictEqual(res.updated, false);
    assert.strictEqual(res.eventAppended, false);
    assert.strictEqual(quote.status, 'SENT');
    assert.strictEqual(quote.viewedAt, null);
  });

  test('ACCEPTED quotation opened again does NOT regress to VIEWED (P3-T03 accept)', () => {
    const quote: MockQuotation = {
      _id: 'q1',
      userId: 'owner1',
      status: 'ACCEPTED',
      viewedAt: new Date('2026-09-08T10:00:00Z'),
    };

    const res = simulateRecordView(quote, null);
    assert.strictEqual(res.updated, false);
    assert.strictEqual(res.eventAppended, false);
    assert.strictEqual(quote.status, 'ACCEPTED');
  });

  test('DECLINED quotation opened again does NOT regress to VIEWED (P3-T03 accept)', () => {
    const quote: MockQuotation = {
      _id: 'q1',
      userId: 'owner1',
      status: 'DECLINED',
      viewedAt: new Date('2026-09-08T10:00:00Z'),
    };

    const res = simulateRecordView(quote, null);
    assert.strictEqual(res.updated, false);
    assert.strictEqual(res.eventAppended, false);
    assert.strictEqual(quote.status, 'DECLINED');
  });

  test('DRAFT quotation link access does not trigger view tracking', () => {
    const quote: MockQuotation = {
      _id: 'q1',
      userId: 'owner1',
      status: 'DRAFT',
      viewedAt: null,
    };

    const res = simulateRecordView(quote, null);
    assert.strictEqual(res.updated, false);
    assert.strictEqual(res.eventAppended, false);
    assert.strictEqual(quote.status, 'DRAFT');
  });

  test('revoked quotation code does not track view', () => {
    const quote: MockQuotation = {
      _id: 'q1',
      userId: 'owner1',
      status: 'SENT',
      viewedAt: null,
      publicCodeRevokedAt: new Date(),
    };

    const res = simulateRecordView(quote, null);
    assert.strictEqual(res.updated, false);
    assert.strictEqual(res.eventAppended, false);
    assert.strictEqual(quote.status, 'SENT');
  });
});

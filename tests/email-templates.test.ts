import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { QUOTATION_FOOTER } from '../lib/documents.ts';
import { renderQuotationSentEmail } from '../lib/email/templates/quotation-sent.ts';
import { renderQuotationRespondedEmail } from '../lib/email/templates/quotation-responded.ts';
import { renderPasswordResetEmail } from '../lib/email/templates/password-reset.ts';
import { renderAccessExpiringEmail } from '../lib/email/templates/access-expiring.ts';

describe('Email Templates (EMAIL_DELIVERY_PLAN.md §3, §8, §16)', () => {
  describe('E1: Quotation Sent Template', () => {
    test('renders subject, html, and text with mandatory §2.3 footer', () => {
      const email = renderQuotationSentEmail({
        quotationNumber: 'Q-2026-0001',
        businessName: 'Acme Design & Co',
        clientName: 'Juan Dela Cruz',
        totalFormatted: '₱15,000.00',
        validUntilFormatted: 'September 30, 2026',
        publicUrl: 'https://bilyoapp.com/q/samplecode12',
      });

      assert.strictEqual(
        email.subject,
        'Quotation Q-2026-0001 from Acme Design & Co — ₱15,000.00'
      );
      assert.ok(email.html.includes(QUOTATION_FOOTER), 'HTML must contain §2.3 mandatory footer');
      assert.ok(email.text.includes(QUOTATION_FOOTER), 'Plain text must contain §2.3 mandatory footer');
      assert.ok(email.html.includes('https://bilyoapp.com/q/samplecode12'));
      assert.ok(email.text.includes('https://bilyoapp.com/q/samplecode12'));
      assert.ok(email.html.includes('Acme Design &amp; Co'), 'Must escape HTML entities in business name');
    });
  });

  describe('E2: Quotation Responded Template', () => {
    test('renders accepted notification with details and mandatory footer', () => {
      const email = renderQuotationRespondedEmail({
        quotationNumber: 'Q-2026-0005',
        clientName: 'Maria Santos',
        respondedByName: 'Maria Santos',
        decision: 'ACCEPTED',
        totalFormatted: '₱42,000.00',
        detailUrl: 'https://bilyoapp.com/dashboard/quotations/quote123',
      });

      assert.strictEqual(
        email.subject,
        'Quotation Q-2026-0005 accepted by Maria Santos — ₱42,000.00'
      );
      assert.ok(email.html.includes(QUOTATION_FOOTER));
      assert.ok(email.text.includes(QUOTATION_FOOTER));
      assert.ok(email.html.includes('ACCEPTED'));
      assert.ok(email.html.includes('https://bilyoapp.com/dashboard/quotations/quote123'));
    });

    test('renders declined notification with correct subject', () => {
      const email = renderQuotationRespondedEmail({
        quotationNumber: 'Q-2026-0005',
        clientName: 'Maria Santos',
        respondedByName: 'Maria Santos',
        decision: 'DECLINED',
        totalFormatted: '₱42,000.00',
        detailUrl: 'https://bilyoapp.com/dashboard/quotations/quote123',
      });

      assert.strictEqual(email.subject, 'Quotation Q-2026-0005 was declined by Maria Santos');
      assert.ok(email.html.includes('DECLINED'));
    });
  });

  describe('E3: Password Reset Template', () => {
    test('renders password reset instructions with secure link and footer', () => {
      const email = renderPasswordResetEmail({
        userName: 'Carlos',
        resetUrl: 'https://bilyoapp.com/reset-password?token=secrettoken123',
      });

      assert.strictEqual(email.subject, 'Reset your Bilyo password');
      assert.ok(email.html.includes('Hello Carlos,'));
      assert.ok(email.html.includes('https://bilyoapp.com/reset-password?token=secrettoken123'));
      assert.ok(email.text.includes('https://bilyoapp.com/reset-password?token=secrettoken123'));
      assert.ok(email.html.includes(QUOTATION_FOOTER));
      assert.ok(email.text.includes(QUOTATION_FOOTER));
    });
  });

  describe('E4: Access Expiring Template', () => {
    test('renders access expiring reminder with days left, reassurance, and footer', () => {
      const email = renderAccessExpiringEmail({
        daysLeft: 7,
        accessUntilFormatted: 'September 16, 2026',
        topUpUrl: 'https://bilyoapp.com/dashboard/access',
        userName: 'Elena',
      });

      assert.strictEqual(email.subject, 'Your Bilyo access expires in 7 days');
      assert.ok(email.html.includes('September 16, 2026'));
      assert.ok(email.html.includes('You will <strong>never</strong> lose your quotations'));
      assert.ok(email.html.includes(QUOTATION_FOOTER));
      assert.ok(email.text.includes(QUOTATION_FOOTER));
    });
  });
});

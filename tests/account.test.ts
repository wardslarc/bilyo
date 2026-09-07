import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  changePasswordSchema,
  changeEmailSchema,
  closeAccountSchema,
} from '../lib/validation/account.ts';
import {
  sanitizeUserExport,
  escapeCsvField,
  formatInvoicesCsv,
  formatQuotationsCsv,
  formatCustomersCsv,
} from '../lib/export.ts';

describe('Account Settings & Data Portability (M6-T05)', () => {
  describe('Validation Schemas (lib/validation/account.ts)', () => {
    test('changePasswordSchema: rejects empty current password', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: '',
        newPassword: 'newpassword123',
        confirmNewPassword: 'newpassword123',
      });
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.ok(result.error.issues.some((i) => i.path.includes('currentPassword')));
      }
    });

    test('changePasswordSchema: rejects new password under 8 characters', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'oldpassword123',
        newPassword: 'short',
        confirmNewPassword: 'short',
      });
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.ok(result.error.issues.some((i) => i.path.includes('newPassword')));
      }
    });

    test('changePasswordSchema: rejects mismatched confirmation password', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'oldpassword123',
        newPassword: 'newpassword123',
        confirmNewPassword: 'differentpassword123',
      });
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.ok(result.error.issues.some((i) => i.path.includes('confirmNewPassword')));
      }
    });

    test('changePasswordSchema: rejects new password identical to current password', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'samepassword123',
        newPassword: 'samepassword123',
        confirmNewPassword: 'samepassword123',
      });
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.ok(result.error.issues.some((i) => i.path.includes('newPassword')));
      }
    });

    test('changePasswordSchema: accepts valid change password payload', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'oldpassword123',
        newPassword: 'newpassword456',
        confirmNewPassword: 'newpassword456',
      });
      assert.strictEqual(result.success, true);
    });

    test('changeEmailSchema: validates email format and trims', () => {
      const invalid = changeEmailSchema.safeParse({ email: 'not-an-email' });
      assert.strictEqual(invalid.success, false);

      const valid = changeEmailSchema.safeParse({ email: '  User@Example.Com  ' });
      assert.strictEqual(valid.success, true);
      if (valid.success) {
        assert.strictEqual(valid.data.email, 'user@example.com');
      }
    });

    test('closeAccountSchema: requires exact CLOSE confirmation and password', () => {
      const missingClose = closeAccountSchema.safeParse({
        confirmation: 'NO',
        password: 'validpassword123',
      });
      assert.strictEqual(missingClose.success, false);

      const missingPassword = closeAccountSchema.safeParse({
        confirmation: 'CLOSE',
        password: '',
      });
      assert.strictEqual(missingPassword.success, false);

      const valid = closeAccountSchema.safeParse({
        confirmation: 'CLOSE',
        password: 'validpassword123',
      });
      assert.strictEqual(valid.success, true);
    });
  });

  describe('PH Data Privacy Act Portability & Sanitization (lib/export.ts)', () => {
    test('sanitizeUserExport: strips passwordHash and all MFA radioactive secrets', () => {
      const sensitiveDbUser = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Maria Santos',
        email: 'maria@example.ph',
        role: 'USER',
        plan: 'FREE',
        planSource: 'DEFAULT',
        passwordHash: '$2a$10$e8K7...SECRET_PASSWORD_HASH',
        mfaSecretEncrypted: 'aes:gcm:RADIOACTIVE_MFA_SECRET',
        mfaPendingSecretEncrypted: 'aes:gcm:RADIOACTIVE_PENDING',
        mfaRecoveryCodeHashes: ['$2a$10$CODE1', '$2a$10$CODE2'],
        mfaLastUsedStep: 1234567,
        mfaFailedAttempts: 0,
        mfaLockedUntil: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      };

      const sanitized = sanitizeUserExport(sensitiveDbUser as unknown as Record<string, unknown>);

      // Must have safe fields
      assert.strictEqual(sanitized.id, '507f1f77bcf86cd799439011');
      assert.strictEqual(sanitized.name, 'Maria Santos');
      assert.strictEqual(sanitized.email, 'maria@example.ph');
      assert.strictEqual(sanitized.plan, 'FREE');

      // CRITICAL: Must NEVER leak password hashes or MFA secrets
      const exportedKeys = Object.keys(sanitized);
      assert.strictEqual(exportedKeys.includes('passwordHash'), false);
      assert.strictEqual(exportedKeys.includes('mfaSecretEncrypted'), false);
      assert.strictEqual(exportedKeys.includes('mfaPendingSecretEncrypted'), false);
      assert.strictEqual(exportedKeys.includes('mfaRecoveryCodeHashes'), false);
      assert.strictEqual(exportedKeys.includes('mfaLastUsedStep'), false);
      assert.strictEqual(JSON.stringify(sanitized).includes('SECRET_PASSWORD_HASH'), false);
      assert.strictEqual(JSON.stringify(sanitized).includes('RADIOACTIVE'), false);
    });

    test('escapeCsvField: correctly quotes commas, newlines, and quotes (RFC 4180)', () => {
      assert.strictEqual(escapeCsvField('normal text'), 'normal text');
      assert.strictEqual(escapeCsvField('comma, text'), '"comma, text"');
      assert.strictEqual(escapeCsvField('quote " text'), '"quote "" text"');
      assert.strictEqual(escapeCsvField('line\nbreak'), '"line\nbreak"');
      assert.strictEqual(escapeCsvField(null), '');
      assert.strictEqual(escapeCsvField(undefined), '');
    });

    test('formatInvoicesCsv: formats headers, converts centavos to pesos, and maps fields', () => {
      const invoices = [
        {
          invoiceNumber: 'INV-000001',
          customerSnapshot: { name: 'Acme Corp, Inc.' },
          issueDate: new Date('2026-03-01T00:00:00Z'),
          dueDate: new Date('2026-03-15T00:00:00Z'),
          status: 'SENT',
          subtotalCentavos: 1000000, // 10,000.00
          discountCentavos: 100000,  // 1,000.00
          vatCentavos: 108000,       // 1,080.00
          totalCentavos: 1008000,    // 10,080.00
          paidAt: null,
          notes: 'Standard 15 days terms',
        },
      ];

      const csv = formatInvoicesCsv(invoices as unknown as Record<string, unknown>[]);
      const lines = csv.split('\r\n');

      assert.strictEqual(
        lines[0],
        'Invoice Number,Customer,Issue Date,Due Date,Status,Subtotal (PHP),Discount (PHP),VAT (PHP),Total (PHP),Paid Date,Notes'
      );
      assert.ok(lines[1].includes('INV-000001'));
      assert.ok(lines[1].includes('"Acme Corp, Inc."'));
      assert.ok(lines[1].includes('10000.00'));
      assert.ok(lines[1].includes('10080.00'));
    });

    test('formatQuotationsCsv: generates correct columns and peso amounts', () => {
      const quotations = [
        {
          quotationNumber: 'QUO-000001',
          customerSnapshot: { name: 'Juan Dela Cruz' },
          issueDate: new Date('2026-03-01T00:00:00Z'),
          validUntil: new Date('2026-03-31T00:00:00Z'),
          status: 'DRAFT',
          subtotalCentavos: 2500000,
          discountCentavos: 0,
          vatCentavos: 300000,
          totalCentavos: 2800000,
          notes: 'Valid for 30 days',
        },
      ];

      const csv = formatQuotationsCsv(quotations as unknown as Record<string, unknown>[]);
      const lines = csv.split('\r\n');

      assert.strictEqual(
        lines[0],
        'Quotation Number,Customer,Issue Date,Valid Until,Status,Subtotal (PHP),Discount (PHP),VAT (PHP),Total (PHP),Notes'
      );
      assert.ok(lines[1].includes('QUO-000001'));
      assert.ok(lines[1].includes('25000.00'));
      assert.ok(lines[1].includes('28000.00'));
    });

    test('formatCustomersCsv: formats customer rows properly', () => {
      const customers = [
        {
          name: 'Maria Clara',
          company: 'Clara Essentials',
          email: 'maria@clara.ph',
          phone: '09171234567',
          taxId: '123-456-789-000',
          address: 'Makati City, Metro Manila',
          archivedAt: null,
        },
      ];

      const csv = formatCustomersCsv(customers as unknown as Record<string, unknown>[]);
      const lines = csv.split('\r\n');

      assert.strictEqual(lines[0], 'Name,Company,Email,Phone,Tax ID,Address,Archived');
      assert.ok(lines[1].includes('"Makati City, Metro Manila"'));
      assert.ok(lines[1].includes('maria@clara.ph'));
      assert.ok(lines[1].endsWith('No'));
    });
  });
});

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AdminGuardError } from '../lib/admin/guard.ts';
import { AdminAuditLog } from '../models/admin-audit-log.ts';
import * as auditModule from '../lib/admin/audit.ts';

describe('Admin Shell & Audit Primitive (M7-T01)', () => {
  describe('Admin Guard 404 Concealment (lib/admin/guard.ts)', () => {
    test('AdminGuardError uses code ADMIN_NOT_FOUND and message Not found (never 403/Forbidden)', () => {
      const err = new AdminGuardError();
      assert.strictEqual(err.code, 'ADMIN_NOT_FOUND');
      assert.strictEqual(err.message, 'Not found');
      // Must not leak that an admin console exists
      assert.strictEqual(err.message.toLowerCase().includes('forbidden'), false);
      assert.strictEqual(err.message.toLowerCase().includes('unauthorized'), false);
    });
  });

  describe('Append-Only Audit Primitive (lib/admin/audit.ts)', () => {
    test('audit.ts exports recordAudit and NO update or delete helpers (AGENTS.md §4)', () => {
      const exports = Object.keys(auditModule);

      assert.ok(exports.includes('recordAudit'));

      // Strict check: No update or delete methods must exist
      for (const exp of exports) {
        const lower = exp.toLowerCase();
        assert.strictEqual(
          lower.includes('update') || lower.includes('delete') || lower.includes('remove') || lower.includes('clear'),
          false,
          `Illegal mutation export found in audit module: ${exp}`
        );
      }
    });

    test('AdminAuditLog model has timestamps configured with updatedAt disabled', () => {
      // Mongoose schema options check: updatedAt must be false (append-only)
      const schemaOptions = (AdminAuditLog.schema as unknown as { options: { timestamps: { createdAt: boolean; updatedAt: boolean } } }).options;
      assert.strictEqual(schemaOptions.timestamps?.createdAt, true);
      assert.strictEqual(schemaOptions.timestamps?.updatedAt, false);
    });

    test('validates audit action enum values', () => {
      const validActions = [
        'USER_VIEW',
        'DOCUMENT_VIEW',
        'USER_SUSPEND',
        'USER_UNSUSPEND',
        'PLAN_OVERRIDE_SET',
        'PLAN_OVERRIDE_CLEAR',
        'PUBLIC_LINK_REVOKE',
        'PUBLIC_LINKS_DISABLE',
        'PUBLIC_LINKS_ENABLE',
        'MFA_RESET',
      ];

      const schemaType = AdminAuditLog.schema.path('action') as unknown as { enumValues: string[] };
      assert.ok(schemaType);
      assert.strictEqual(schemaType.enumValues.length, validActions.length);
      for (const act of validActions) {
        assert.ok(schemaType.enumValues.includes(act));
      }
    });
  });
});

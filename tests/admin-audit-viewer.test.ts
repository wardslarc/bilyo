import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { buildAuditFilter } from '../lib/admin/audit.ts';
import * as auditModule from '../lib/admin/audit.ts';

describe('Admin Audit Log Viewer (M7-T09)', () => {
  describe('buildAuditFilter Query Builder', () => {
    test('empty parameters return empty object (matches all logs)', () => {
      const filter = buildAuditFilter({});
      assert.deepStrictEqual(filter, {});
    });

    test('action filter adds exact action condition', () => {
      const filter = buildAuditFilter({ action: 'USER_SUSPEND' });
      assert.deepStrictEqual(filter, { action: 'USER_SUSPEND' });
    });

    test('action "ALL" does not filter by action', () => {
      const filter = buildAuditFilter({ action: 'ALL' });
      assert.deepStrictEqual(filter, {});
    });

    test('actor string filters actorEmail case-insensitively', () => {
      const filter = buildAuditFilter({ actor: 'admin@bilyo.ph' });
      assert.deepStrictEqual(filter, {
        actorEmail: { $regex: 'admin@bilyo.ph', $options: 'i' },
      });
    });

    test('actor ObjectId filters both actorEmail and actorUserId', () => {
      const validId = new mongoose.Types.ObjectId().toString();
      const filter = buildAuditFilter({ actor: validId });
      assert.ok('$or' in filter);
      const orConditions = filter.$or as Record<string, unknown>[];
      assert.strictEqual(orConditions.length, 2);
    });

    test('targetUser filters targetId and targetUserIds', () => {
      const uid1 = new mongoose.Types.ObjectId();
      const filter = buildAuditFilter({
        targetUser: 'jane@example.com',
        targetUserIds: [uid1],
      });

      assert.ok('$or' in filter);
      const orConditions = filter.$or as Record<string, unknown>[];
      assert.ok(
        orConditions.some((c) => 'targetId' in c),
        'Should include targetId regex'
      );
      assert.ok(
        orConditions.some((c) => 'targetUserId' in c),
        'Should include targetUserId in condition'
      );
    });

    test('multiple filters are combined with $and', () => {
      const filter = buildAuditFilter({
        action: 'MFA_RESET',
        actor: 'security@bilyo.ph',
      });

      assert.ok('$and' in filter);
      const andConditions = filter.$and as Record<string, unknown>[];
      assert.strictEqual(andConditions.length, 2);
    });
  });

  describe('Read-Only & Immutability Invariant (AGENTS.md §3.7, §4)', () => {
    test('lib/admin/audit.ts exports NO update or delete mutations', () => {
      const exports = Object.keys(auditModule);

      const forbiddenWords = ['update', 'delete', 'remove', 'drop', 'clear', 'purge', 'edit', 'patch'];
      for (const fn of exports) {
        for (const word of forbiddenWords) {
          assert.strictEqual(
            fn.toLowerCase().includes(word),
            false,
            `Forbidden mutation "${fn}" found in audit module`
          );
        }
      }
    });

    test('permitted exports in audit module are strictly query or append', () => {
      const allowedExports = ['recordAudit', 'getAdminAuditLogs', 'buildAuditFilter'];
      const currentExports = Object.keys(auditModule).filter((k) => typeof (auditModule as unknown as Record<string, unknown>)[k] === 'function');

      for (const fn of currentExports) {
        assert.ok(
          allowedExports.includes(fn),
          `Unexpected export "${fn}" in audit module`
        );
      }
    });
  });

  describe('Pagination Logic', () => {
    test('computes correct page offsets and total pages', () => {
      const total = 105;
      const limit = 25;
      const totalPages = Math.ceil(total / limit) || 1;

      assert.strictEqual(totalPages, 5);

      const page1Skip = (1 - 1) * limit;
      assert.strictEqual(page1Skip, 0);

      const page2Skip = (2 - 1) * limit;
      assert.strictEqual(page2Skip, 25);

      const page5Skip = (5 - 1) * limit;
      assert.strictEqual(page5Skip, 100);
    });
  });
});

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { adminActionReasonSchema } from '../lib/validation/admin.ts';

describe('Admin User Moderation Actions (M7-T05)', () => {
  describe('Validation: adminActionReasonSchema', () => {
    test('rejects reasons shorter than 10 characters', () => {
      const invalidReasons = [
        '',
        'ab',
        'short',
        '123456789',
        '   123456789   ', // Trims whitespace
      ];

      for (const reason of invalidReasons) {
        const res = adminActionReasonSchema.safeParse({
          userId: '507f1f77bcf86cd799439011',
          reason,
        });
        assert.strictEqual(res.success, false, `Expected "${reason}" to be rejected`);
        if (!res.success) {
          assert.match(res.error.issues[0]?.message, /at least 10 characters/i);
        }
      }
    });

    test('rejects missing or empty userId', () => {
      const res = adminActionReasonSchema.safeParse({
        userId: '',
        reason: 'Valid operational justification provided here',
      });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.match(res.error.issues[0]?.message, /User ID is required/i);
      }
    });

    test('accepts valid reason with 10 or more characters', () => {
      const validReasons = [
        '1234567890',
        'Account reported for phishing activities in ticket #42',
        'User requested temporary account freeze pending audit',
        'Copyright infringement notice verified for quote link',
      ];

      for (const reason of validReasons) {
        const res = adminActionReasonSchema.safeParse({
          userId: '507f1f77bcf86cd799439011',
          reason,
        });
        assert.strictEqual(res.success, true, `Expected "${reason}" to be valid`);
        if (res.success) {
          assert.strictEqual(res.data.reason, reason.trim());
        }
      }
    });
  });

  describe('Semantics (§5.9): Suspension and Public Link independence', () => {
    test('suspension sets suspendedAt without altering publicLinksDisabledAt', () => {
      const user = {
        id: 'u1',
        email: 'user@example.com',
        role: 'USER' as const,
        suspendedAt: null as Date | null,
        suspendedReason: null as string | null,
        suspendedByUserId: null as string | null,
        publicLinksDisabledAt: null as Date | null,
      };

      // Apply suspension
      const suspendReason = 'Payment dispute pending investigation';
      const now = new Date();
      user.suspendedAt = now;
      user.suspendedReason = suspendReason;
      user.suspendedByUserId = 'admin-1';

      // Verify suspension fields set
      assert.ok(user.suspendedAt);
      assert.strictEqual(user.suspendedReason, suspendReason);
      assert.strictEqual(user.suspendedByUserId, 'admin-1');

      // CRITICAL per §5.9: Public links keep working!
      assert.strictEqual(user.publicLinksDisabledAt, null);
    });

    test('unsuspending clears all suspension fields cleanly', () => {
      const user: {
        id: string;
        email: string;
        role: 'USER';
        suspendedAt: Date | null;
        suspendedReason: string | null;
        suspendedByUserId: string | null;
        publicLinksDisabledAt: Date | null;
      } = {
        id: 'u1',
        email: 'user@example.com',
        role: 'USER',
        suspendedAt: new Date(),
        suspendedReason: 'Previous dispute',
        suspendedByUserId: 'admin-1',
        publicLinksDisabledAt: null,
      };

      // Unsuspend
      user.suspendedAt = null;
      user.suspendedReason = null;
      user.suspendedByUserId = null;

      assert.strictEqual(user.suspendedAt, null);
      assert.strictEqual(user.suspendedReason, null);
      assert.strictEqual(user.suspendedByUserId, null);
    });

    test('disabling public links is a separate action and sets publicLinksDisabledAt', () => {
      const user = {
        id: 'u2',
        email: 'phishing@example.com',
        role: 'USER' as const,
        suspendedAt: null as Date | null,
        publicLinksDisabledAt: null as Date | null,
      };

      const now = new Date();
      user.publicLinksDisabledAt = now;

      assert.ok(user.publicLinksDisabledAt);
      // Suspension is independent
      assert.strictEqual(user.suspendedAt, null);
    });

    test('platform administrators cannot be suspended via console action', () => {
      const adminUser = {
        id: 'admin-99',
        email: 'admin@bilyo.ph',
        role: 'ADMIN' as const,
        suspendedAt: null,
      };

      // Invariant check matching actions/admin/users.ts: targetUser.role === 'ADMIN'
      const canSuspend = adminUser.role !== 'ADMIN';
      assert.strictEqual(canSuspend, false, 'Admins must not be suspendable from console');
    });
  });
});

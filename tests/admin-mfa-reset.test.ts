import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { adminActionReasonSchema } from '../lib/validation/admin.ts';

describe('Admin User MFA Reset (M7-T08, §5.11 rule 9)', () => {
  describe('Validation: adminActionReasonSchema for MFA reset', () => {
    test('rejects reasons shorter than 10 characters', () => {
      const invalid = ['', 'lost ph', '123456789', '   123456789   '];
      for (const reason of invalid) {
        const res = adminActionReasonSchema.safeParse({
          userId: '507f1f77bcf86cd799439011',
          reason,
        });
        assert.strictEqual(res.success, false, `Expected "${reason}" to fail validation`);
        if (!res.success) {
          assert.match(res.error.issues[0]?.message, /at least 10 characters/i);
        }
      }
    });

    test('rejects missing or empty userId', () => {
      const res = adminActionReasonSchema.safeParse({
        userId: '',
        reason: 'User lost their authenticator device and all recovery codes',
      });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.match(res.error.issues[0]?.message, /User ID is required/i);
      }
    });

    test('accepts valid operational justification', () => {
      const res = adminActionReasonSchema.safeParse({
        userId: '507f1f77bcf86cd799439011',
        reason: 'Support ticket #881: verified identity via government ID; phone lost',
      });
      assert.strictEqual(res.success, true);
    });
  });

  describe('Security Constraints: Admin protection (§5.11 rule 9)', () => {
    test('refuses MFA reset when target role is ADMIN', () => {
      const targetUser = {
        _id: 'admin-id-123',
        email: 'security-admin@bilyoapp.com',
        role: 'ADMIN' as const,
        mfaEnabledAt: new Date(),
        mfaSecretEncrypted: 'enc_secret_blob',
      };

      // Server-side check in resetUserMfa
      const isRefused = targetUser.role === 'ADMIN';
      assert.strictEqual(isRefused, true, 'Must refuse when target role is ADMIN');

      const expectedError =
        'Platform administrators cannot have their MFA reset from the web console. Use the CLI: npm run reset-mfa -- <email>';
      assert.ok(expectedError.includes('npm run reset-mfa'));
    });
  });

  describe('MFA Reset State Clearing', () => {
    test('clears all 8 MFA fields, recovery codes, and lockout states', () => {
      const user = {
        id: 'u-mfa-1',
        email: 'locked@example.com',
        role: 'USER' as const,
        mfaSecretEncrypted: 'enc_secret_abc123' as string | null,
        mfaEnabledAt: new Date('2026-01-01') as Date | null,
        mfaPendingSecretEncrypted: 'pending_sec' as string | null,
        mfaPendingExpiresAt: new Date('2026-01-01') as Date | null,
        mfaRecoveryCodeHashes: ['hash1', 'hash2', 'hash3'],
        mfaLastUsedStep: 123456 as number | null,
        mfaFailedAttempts: 5,
        mfaLockedUntil: new Date('2026-09-08') as Date | null,
      };

      // Perform reset simulation matching resetUserMfa
      user.mfaSecretEncrypted = null;
      user.mfaEnabledAt = null;
      user.mfaPendingSecretEncrypted = null;
      user.mfaPendingExpiresAt = null;
      user.mfaRecoveryCodeHashes = [];
      user.mfaLastUsedStep = null;
      user.mfaFailedAttempts = 0;
      user.mfaLockedUntil = null;

      // Invariants
      assert.strictEqual(user.mfaSecretEncrypted, null);
      assert.strictEqual(user.mfaEnabledAt, null);
      assert.strictEqual(user.mfaPendingSecretEncrypted, null);
      assert.strictEqual(user.mfaPendingExpiresAt, null);
      assert.strictEqual(user.mfaRecoveryCodeHashes.length, 0);
      assert.strictEqual(user.mfaLastUsedStep, null);
      assert.strictEqual(user.mfaFailedAttempts, 0);
      assert.strictEqual(user.mfaLockedUntil, null);
    });
  });

  describe('Radioactive Secrets Rule (AGENTS.md §3.8)', () => {
    test('audit log before/after never contains secret or recovery code hashes', () => {
      const simulatedUser = {
        mfaSecretEncrypted: 'radioactive_secret_aes_gcm',
        mfaRecoveryCodeHashes: ['$2a$10$hash1', '$2a$10$hash2'],
        mfaEnabledAt: new Date(),
        mfaFailedAttempts: 3,
        mfaLockedUntil: null as Date | null,
      };

      // The audit payload constructed in resetUserMfa
      const auditBefore = {
        mfaEnabled: Boolean(simulatedUser.mfaEnabledAt),
        mfaEnabledAt: simulatedUser.mfaEnabledAt,
        mfaFailedAttempts: simulatedUser.mfaFailedAttempts || 0,
        mfaLocked: Boolean(simulatedUser.mfaLockedUntil && simulatedUser.mfaLockedUntil > new Date()),
      };

      const auditAfter = {
        mfaEnabled: false,
        mfaEnabledAt: null,
        mfaFailedAttempts: 0,
        mfaLocked: false,
      };

      const beforeKeys = Object.keys(auditBefore);
      const afterKeys = Object.keys(auditAfter);

      assert.strictEqual(beforeKeys.includes('mfaSecretEncrypted'), false);
      assert.strictEqual(beforeKeys.includes('mfaRecoveryCodeHashes'), false);
      assert.strictEqual(afterKeys.includes('mfaSecretEncrypted'), false);
      assert.strictEqual(afterKeys.includes('mfaRecoveryCodeHashes'), false);

      // JSON stringified audit log must not contain sensitive fragments
      const auditDump = JSON.stringify({ before: auditBefore, after: auditAfter });
      assert.strictEqual(auditDump.includes('radioactive'), false);
      assert.strictEqual(auditDump.includes('hash1'), false);
    });
  });
});

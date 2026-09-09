import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb.ts';
import { User } from '../models/user.ts';
import { encrypt } from '../lib/crypto.ts';
import {
  generateSecret,
  generateRecoveryCodes,
} from '../lib/mfa.ts';
import {
  signChallengePayload,
  verifyChallengeToken,
  signMfaSessionToken,
  verifyMfaSessionToken,
} from '../lib/mfa-challenge.ts';
import { requireAdmin, AdminGuardError } from '../lib/admin/guard.ts';
import { setAuthGetter } from '../lib/auth-guards.ts';

const execAsync = promisify(exec);

describe('Two-Step Sign-In & MFA Enforcement (M1-T09)', () => {
  const plainPassword = 'Password123!';
  const testUserEmail = `mfa-flow-${Date.now()}@example.com`;
  const adminEmail = `mfa-admin-${Date.now()}@example.com`;
  let userId: string;
  let adminUserId: string;
  let userTotpSecret: string;

  before(async () => {
    await dbConnect();
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    userTotpSecret = generateSecret();
    const encryptedSecret = encrypt(userTotpSecret);

    const { hashedCodes } = await generateRecoveryCodes();

    // 1. Normal user with MFA enabled
    const user = await User.create({
      email: testUserEmail,
      passwordHash,
      name: 'MFA Target User',
      role: 'USER',
      mfaEnabledAt: new Date(),
      mfaSecretEncrypted: encryptedSecret,
      mfaRecoveryCodeHashes: hashedCodes,
    });
    userId = user._id.toString();

    // 2. Admin user with MFA enabled
    const admin = await User.create({
      email: adminEmail,
      passwordHash,
      name: 'MFA Admin User',
      role: 'ADMIN',
      mfaEnabledAt: new Date(),
      mfaSecretEncrypted: encryptedSecret,
      mfaRecoveryCodeHashes: hashedCodes,
    });
    adminUserId = admin._id.toString();
  });

  after(async () => {
    await User.deleteMany({ _id: { $in: [userId, adminUserId] } });
    await mongoose.disconnect();
  });

  test('challenge token: signed token verifies and detects tampering or expiry', () => {
    const payload = {
      userId,
      email: testUserEmail,
      nonce: 'nonce-12345',
      expiresAt: Date.now() + 300000,
      attempts: 0,
    };

    const token = signChallengePayload(payload);
    const verified = verifyChallengeToken(token);
    assert.ok(verified);
    assert.strictEqual(verified.userId, userId);
    assert.strictEqual(verified.email, testUserEmail);

    // Tampered token fails
    const tampered = token.slice(0, -5) + 'abcde';
    assert.strictEqual(verifyChallengeToken(tampered), null);

    // Expired token fails
    const expiredToken = signChallengePayload({
      ...payload,
      expiresAt: Date.now() - 1000,
    });
    assert.strictEqual(verifyChallengeToken(expiredToken), null);

    // Exceeded attempts fails
    const exceededToken = signChallengePayload({
      ...payload,
      attempts: 5,
    });
    assert.strictEqual(verifyChallengeToken(exceededToken), null);
  });

  test('session token: signed mfaSessionToken verifies and detects tampering', () => {
    const mfaVerifiedAt = new Date().toISOString();
    const token = signMfaSessionToken(userId, mfaVerifiedAt);
    const verified = verifyMfaSessionToken(token);

    assert.ok(verified);
    assert.strictEqual(verified.userId, userId);
    assert.strictEqual(verified.mfaVerifiedAt, mfaVerifiedAt);

    // Tampered fails
    assert.strictEqual(verifyMfaSessionToken(token + 'tamper'), null);
  });

  test('requireAdmin: rejects admin session if mfaVerifiedAt is missing or null', async () => {
    process.env.ADMIN_EMAILS = adminEmail;

    // Session predating MFA (no mfaVerifiedAt)
    setAuthGetter(async () => ({
      user: {
        id: adminUserId,
        email: adminEmail,
        name: 'MFA Admin User',
        role: 'ADMIN',
        mfaVerifiedAt: null, // missing third factor (§5.8 rule 2)
      },
    }));

    await assert.rejects(
      async () => {
        await requireAdmin();
      },
      (err: unknown) => {
        assert.ok(err instanceof AdminGuardError);
        assert.strictEqual(err.code, 'ADMIN_NOT_FOUND');
        return true;
      }
    );
  });

  test('requireAdmin: accepts admin session with valid mfaVerifiedAt, role, and allowlist', async () => {
    process.env.ADMIN_EMAILS = adminEmail;

    setAuthGetter(async () => ({
      user: {
        id: adminUserId,
        email: adminEmail,
        name: 'MFA Admin User',
        role: 'ADMIN',
        mfaVerifiedAt: new Date().toISOString(), // Valid third factor
      },
    }));

    const admin = await requireAdmin();
    assert.ok(admin);
    assert.strictEqual(admin.id, adminUserId);
    assert.strictEqual(admin.email, adminEmail);
    assert.strictEqual(admin.role, 'ADMIN');
  });

  test('reset-mfa CLI: successfully clears MFA fields on target account', async () => {
    // Confirm account has MFA enabled before reset
    const beforeUser = await User.findById(userId);
    assert.ok(beforeUser?.mfaEnabledAt);
    assert.ok(beforeUser?.mfaSecretEncrypted);

    // Run reset-mfa script
    const { stdout } = await execAsync(`node --env-file=.env.local scripts/reset-mfa.ts ${testUserEmail}`);
    assert.ok(stdout.includes(`Successfully reset MFA for "${testUserEmail}"`));

    // Confirm DB record has MFA cleared
    const afterUser = await User.findById(userId);
    assert.strictEqual(afterUser?.mfaEnabledAt, null);
    assert.strictEqual(afterUser?.mfaSecretEncrypted, null);
    assert.strictEqual(afterUser?.mfaPendingSecretEncrypted, null);
    assert.strictEqual(afterUser?.mfaRecoveryCodeHashes.length, 0);
  });
});

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb.ts';
import { User } from '../models/user.ts';
import { PasswordResetToken } from '../models/password-reset-token.ts';
import { requestPasswordReset, resetPassword } from '../actions/auth.ts';

describe('Password Reset Flow (M1-T06)', () => {
  const initialPassword = 'InitialPassword123!';
  const newPassword = 'NewPassword456!';
  const knownEmail = `pwd-reset-${Date.now()}@example.com`;
  let userId: string;

  before(async () => {
    await dbConnect();
    const passwordHash = await bcrypt.hash(initialPassword, 10);
    const user = await User.create({
      email: knownEmail,
      passwordHash,
      name: 'Reset Test User',
      role: 'USER',
      plan: 'FREE',
      planSource: 'DEFAULT',
    });
    userId = user._id.toString();
  });

  after(async () => {
    await User.deleteOne({ _id: userId });
    await PasswordResetToken.deleteMany({ userId });
    await mongoose.disconnect();
  });

  test('requestPasswordReset: invalid email returns field error', async () => {
    const res = await requestPasswordReset({ email: 'not-an-email' });
    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.ok(res.fieldErrors?.email);
    }
  });

  test('requestPasswordReset: unknown email returns identical confirmation (anti-enumeration)', async () => {
    const unknownEmail = `unknown-${Date.now()}@example.com`;
    const res = await requestPasswordReset({ email: unknownEmail });
    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(
        res.data.message,
        'If an account exists with this email, a reset link has been sent.'
      );
    }

    // Ensure no token was created for the unknown email
    const tokens = await PasswordResetToken.find({});
    assert.strictEqual(tokens.filter((t) => t.userId.toString() === userId).length, 0);
  });

  test('requestPasswordReset: known email creates hashed single-use token with 1-hour expiry', async () => {
    const res = await requestPasswordReset({ email: knownEmail });
    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(
        res.data.message,
        'If an account exists with this email, a reset link has been sent.'
      );
    }

    const tokenDoc = await PasswordResetToken.findOne({ userId });
    assert.ok(tokenDoc);
    assert.ok(tokenDoc.tokenHash);
    assert.strictEqual(tokenDoc.usedAt, null);

    // Verify expiry is ~1 hour from now
    const now = Date.now();
    const expiryDiff = tokenDoc.expiresAt.getTime() - now;
    assert.ok(expiryDiff > 3500000 && expiryDiff <= 3600000);
  });

  test('resetPassword: short password (< 8 chars) returns field error', async () => {
    const res = await resetPassword({ token: 'some-token', password: 'short' });
    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.ok(res.fieldErrors?.password);
    }
  });

  test('resetPassword: unknown or tampered token returns error', async () => {
    const res = await resetPassword({
      token: 'tampered-random-token-1234567890',
      password: newPassword,
    });
    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.ok(res.error.includes('Invalid or expired'));
    }
  });

  test('resetPassword: valid token updates password hash and marks token as used', async () => {
    // Generate fresh test token for the user
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 3600000);

    const createdToken = await PasswordResetToken.create({
      userId,
      tokenHash,
      expiresAt,
    });

    // Reset password
    const res = await resetPassword({ token: rawToken, password: newPassword });
    assert.strictEqual(res.ok, true);

    // Verify user password hash was updated
    const updatedUser = await User.findById(userId);
    assert.ok(updatedUser);
    const matchesNew = await bcrypt.compare(newPassword, updatedUser.passwordHash);
    const matchesOld = await bcrypt.compare(initialPassword, updatedUser.passwordHash);
    assert.strictEqual(matchesNew, true);
    assert.strictEqual(matchesOld, false);

    // Verify token was marked as used
    const refreshedToken = await PasswordResetToken.findById(createdToken._id);
    assert.ok(refreshedToken?.usedAt);
  });

  test('resetPassword: used token fails on reuse', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 3600000);

    // Create an already-used token
    await PasswordResetToken.create({
      userId,
      tokenHash,
      expiresAt,
      usedAt: new Date(),
    });

    const res = await resetPassword({ token: rawToken, password: 'AnotherPassword789!' });
    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.ok(res.error.includes('already been used'));
    }
  });

  test('resetPassword: expired token fails', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() - 10000); // 10 seconds ago

    await PasswordResetToken.create({
      userId,
      tokenHash,
      expiresAt,
    });

    const res = await resetPassword({ token: rawToken, password: 'AnotherPassword789!' });
    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.ok(res.error.includes('expired'));
    }
  });
});

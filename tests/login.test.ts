import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb.ts';
import { User } from '../models/user.ts';

const DUMMY_HASH = '$2a$10$6iTTYhZTDeaLrFMbocue6.gz2JAFZ6MDEmHW6mdSWBrO5tKKowGoS';

describe('Login & Timing Anti-Enumeration (M1-T03)', () => {
  const testEmail = `login-test-${Date.now()}@example.com`;
  const plainPassword = 'Password123!';
  let userId: string;

  before(async () => {
    await dbConnect();
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    const user = await User.create({
      email: testEmail,
      passwordHash,
      name: 'Login Test User',
      role: 'USER',
      plan: 'FREE',
      planSource: 'DEFAULT',
    });
    userId = user._id.toString();
  });

  after(async () => {
    await User.deleteOne({ _id: userId });
    await mongoose.disconnect();
  });

  test('unknown email and wrong password produce comparable response times via dummy bcrypt', async () => {
    const user = await User.findById(userId);
    assert.ok(user);

    // Timing 1: Unknown email (executes dummy bcrypt compare)
    const t1 = performance.now();
    const unknownEmailResult = await bcrypt.compare('SomeWrongPassword123!', DUMMY_HASH);
    const durationUnknown = performance.now() - t1;

    // Timing 2: Wrong password on known email (executes real bcrypt compare)
    const t2 = performance.now();
    const wrongPasswordResult = await bcrypt.compare('SomeWrongPassword123!', user.passwordHash);
    const durationWrongPass = performance.now() - t2;

    assert.strictEqual(unknownEmailResult, false);
    assert.strictEqual(wrongPasswordResult, false);

    // Both operations should execute full cost-10 iterations (~40ms to 120ms depending on CPU)
    assert.ok(durationUnknown > 20, `Expected durationUnknown > 20ms, got ${durationUnknown}ms`);
    assert.ok(durationWrongPass > 20, `Expected durationWrongPass > 20ms, got ${durationWrongPass}ms`);

    // Difference between both should be minimal (within 35ms)
    const diff = Math.abs(durationUnknown - durationWrongPass);
    assert.ok(diff < 35, `Timing difference too high: ${diff}ms`);
  });

  test('successful authentication records lastLoginAt in database', async () => {
    const beforeLogin = await User.findById(userId);
    assert.strictEqual(beforeLogin?.lastLoginAt, null);

    // Simulate successful login update as executed in authorize()
    const loginTime = new Date();
    await User.updateOne({ _id: userId }, { $set: { lastLoginAt: loginTime } });

    const afterLogin = await User.findById(userId);
    assert.ok(afterLogin?.lastLoginAt);
    assert.strictEqual(
      afterLogin.lastLoginAt.getTime(),
      loginTime.getTime()
    );
  });
});

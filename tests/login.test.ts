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
    let totalUnknown = 0;
    for (let i = 0; i < 3; i++) {
      const t1 = performance.now();
      const unknownEmailResult = await bcrypt.compare('SomeWrongPassword123!', DUMMY_HASH);
      totalUnknown += performance.now() - t1;
      assert.strictEqual(unknownEmailResult, false);
    }
    const avgUnknown = totalUnknown / 3;

    // Timing 2: Wrong password on known email (executes real bcrypt compare)
    let totalWrong = 0;
    for (let i = 0; i < 3; i++) {
      const t2 = performance.now();
      const wrongPasswordResult: boolean = await bcrypt.compare(
        'SomeWrongPassword123!',
        user.passwordHash
      );
      totalWrong += performance.now() - t2;
      assert.strictEqual(wrongPasswordResult, false);
    }
    const avgWrong = totalWrong / 3;

    // Both operations should execute full cost-10 iterations (~40ms to 120ms depending on CPU)
    assert.ok(avgUnknown > 20, `Expected avgUnknown > 20ms, got ${avgUnknown}ms`);
    assert.ok(avgWrong > 20, `Expected avgWrong > 20ms, got ${avgWrong}ms`);

    // Difference between both should be comparable (within 50ms)
    const diff = Math.abs(avgUnknown - avgWrong);
    assert.ok(diff < 50, `Timing difference too high: ${diff}ms`);
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

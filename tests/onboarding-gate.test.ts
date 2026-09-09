import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb.ts';
import { User } from '../models/user.ts';
import { Business } from '../models/business.ts';
import { checkOnboardingGate } from '../lib/onboarding-gate.ts';

describe('Onboarding Gate (M2-T02)', () => {
  const userNoBizEmail = `nobiz-${Date.now()}@example.com`;
  const userWithBizEmail = `withbiz-${Date.now()}@example.com`;

  let userNoBizId: string;
  let userWithBizId: string;

  before(async () => {
    await dbConnect();
    const hash = await bcrypt.hash('Password123!', 10);

    const userNoBiz = await User.create({
      email: userNoBizEmail,
      passwordHash: hash,
      name: 'No Biz User',
      role: 'USER',
    });
    userNoBizId = userNoBiz._id.toString();

    const userWithBiz = await User.create({
      email: userWithBizEmail,
      passwordHash: hash,
      name: 'With Biz User',
      role: 'USER',
    });
    userWithBizId = userWithBiz._id.toString();

    await Business.create({
      userId: userWithBiz._id,
      businessName: 'Existing Company Inc.',
    });
  });

  after(async () => {
    await Business.deleteMany({ userId: { $in: [userNoBizId, userWithBizId] } });
    await User.deleteMany({ _id: { $in: [userNoBizId, userWithBizId] } });
    await mongoose.disconnect();
  });

  test('redirects signed-in user with no Business when hitting /dashboard', async () => {
    const res = await checkOnboardingGate(userNoBizId, '/dashboard');
    assert.strictEqual(res.shouldRedirect, true);
    assert.strictEqual(res.targetUrl, '/dashboard/settings?onboarding=1');
  });

  test('redirects signed-in user with no Business when hitting other dashboard routes like /dashboard/quotations', async () => {
    const res = await checkOnboardingGate(userNoBizId, '/dashboard/quotations');
    assert.strictEqual(res.shouldRedirect, true);
    assert.strictEqual(res.targetUrl, '/dashboard/settings?onboarding=1');
  });

  test('does NOT redirect when user is already on /dashboard/settings (prevents loop)', async () => {
    const resSettings = await checkOnboardingGate(userNoBizId, '/dashboard/settings');
    assert.strictEqual(resSettings.shouldRedirect, false);

    const resOnboardingParam = await checkOnboardingGate(
      userNoBizId,
      '/dashboard/settings?onboarding=1'
    );
    assert.strictEqual(resOnboardingParam.shouldRedirect, false);
  });

  test('does NOT redirect when user already has a Business profile', async () => {
    const resDashboard = await checkOnboardingGate(userWithBizId, '/dashboard');
    assert.strictEqual(resDashboard.shouldRedirect, false);

    const resQuotations = await checkOnboardingGate(userWithBizId, '/dashboard/quotations');
    assert.strictEqual(resQuotations.shouldRedirect, false);
  });

  test('saving business profile unblocks the user immediately without looping', async () => {
    // Before saving: blocked
    const before = await checkOnboardingGate(userNoBizId, '/dashboard');
    assert.strictEqual(before.shouldRedirect, true);

    // Save business profile
    await Business.create({
      userId: userNoBizId,
      businessName: 'Newly Formed Agency',
    });

    // After saving: no redirect
    const after = await checkOnboardingGate(userNoBizId, '/dashboard');
    assert.strictEqual(after.shouldRedirect, false);
  });
});

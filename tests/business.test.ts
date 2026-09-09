import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb.ts';
import { User } from '../models/user.ts';
import { Business } from '../models/business.ts';
import { businessProfileSchema } from '../lib/validation/business.ts';
import { getBusinessProfile, saveBusinessProfile } from '../actions/business.ts';
import { setAuthGetter } from '../lib/auth-guards.ts';

describe('Business Profile (M2-T01)', () => {
  const userAEmail = `biz-a-${Date.now()}@example.com`;
  const userBEmail = `biz-b-${Date.now()}@example.com`;
  const suspendedEmail = `biz-susp-${Date.now()}@example.com`;

  let userAId: string;
  let userBId: string;
  let suspendedUserId: string;

  before(async () => {
    await dbConnect();
    const hash = await bcrypt.hash('Password123!', 10);

    const userA = await User.create({
      email: userAEmail,
      passwordHash: hash,
      name: 'User A',
      role: 'USER',
    });
    userAId = userA._id.toString();

    const userB = await User.create({
      email: userBEmail,
      passwordHash: hash,
      name: 'User B',
      role: 'USER',
    });
    userBId = userB._id.toString();

    const suspendedUser = await User.create({
      email: suspendedEmail,
      passwordHash: hash,
      name: 'Suspended User',
      role: 'USER',
      suspendedAt: new Date(),
      suspendedReason: 'Terms violation',
    });
    suspendedUserId = suspendedUser._id.toString();
  });

  after(async () => {
    await Business.deleteMany({ userId: { $in: [userAId, userBId, suspendedUserId] } });
    await User.deleteMany({ _id: { $in: [userAId, userBId, suspendedUserId] } });
    await mongoose.disconnect();
  });

  describe('Validation Schema (lib/validation/business.ts)', () => {
    test('requires businessName', () => {
      const res = businessProfileSchema.safeParse({
        businessName: '',
      });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error.issues.some((i) => i.path[0] === 'businessName'));
      }
    });

    test('validates email format or empty string', () => {
      const validEmpty = businessProfileSchema.safeParse({
        businessName: 'Biz',
        email: '',
      });
      assert.strictEqual(validEmpty.success, true);

      const validEmail = businessProfileSchema.safeParse({
        businessName: 'Biz',
        email: 'billing@example.com',
      });
      assert.strictEqual(validEmail.success, true);

      const invalidEmail = businessProfileSchema.safeParse({
        businessName: 'Biz',
        email: 'not-an-email',
      });
      assert.strictEqual(invalidEmail.success, false);
    });

    test('validates logoUrl format or empty string / null', () => {
      const validEmpty = businessProfileSchema.safeParse({
        businessName: 'Biz',
        logoUrl: '',
      });
      assert.strictEqual(validEmpty.success, true);
      if (validEmpty.success) {
        assert.strictEqual(validEmpty.data.logoUrl, null);
      }

      const validUrl = businessProfileSchema.safeParse({
        businessName: 'Biz',
        logoUrl: 'https://example.com/logo.png',
      });
      assert.strictEqual(validUrl.success, true);

      const invalidUrl = businessProfileSchema.safeParse({
        businessName: 'Biz',
        logoUrl: 'invalid-url',
      });
      assert.strictEqual(invalidUrl.success, false);
    });
  });

  describe('Server Actions (actions/business.ts)', () => {
    test('saveBusinessProfile: rejects unauthenticated caller', async () => {
      setAuthGetter(async () => null);

      const res = await saveBusinessProfile({
        businessName: 'Unauthorized Biz',
      });

      assert.strictEqual(res.ok, false);
      assert.match(res.error, /Unauthorized/i);
    });

    test('saveBusinessProfile: rejects suspended user', async () => {
      setAuthGetter(async () => ({
        user: { id: suspendedUserId, email: suspendedEmail, role: 'USER' },
      }));

      const res = await saveBusinessProfile({
        businessName: 'Suspended Biz',
      });

      assert.strictEqual(res.ok, false);
      assert.match(res.error, /suspended/i);
    });

    test('saveBusinessProfile: creates business profile for user A', async () => {
      setAuthGetter(async () => ({
        user: { id: userAId, email: userAEmail, role: 'USER' },
      }));

      const res = await saveBusinessProfile({
        businessName: 'Acme PH Studios',
        address: '123 Ayala Ave, Makati',
        email: 'billing@acme.ph',
        phone: '09171234567',
        logoUrl: 'https://acme.ph/logo.png',
      });

      assert.strictEqual(res.ok, true);
      if (res.ok) {
        assert.strictEqual(res.data.businessName, 'Acme PH Studios');
        assert.strictEqual(res.data.userId, userAId);
      }

      const count = await Business.countDocuments({ userId: userAId });
      assert.strictEqual(count, 1);
    });

    test('saveBusinessProfile: saving twice updates rather than creating a second business', async () => {
      setAuthGetter(async () => ({
        user: { id: userAId, email: userAEmail, role: 'USER' },
      }));

      const res = await saveBusinessProfile({
        businessName: 'Acme PH Studios Updated',
        address: '456 BGC, Taguig',
        email: 'invoicing@acme.ph',
        phone: '09189876543',
        logoUrl: '',
      });

      assert.strictEqual(res.ok, true);
      if (res.ok) {
        assert.strictEqual(res.data.businessName, 'Acme PH Studios Updated');
        assert.strictEqual(res.data.address, '456 BGC, Taguig');
        assert.strictEqual(res.data.logoUrl, null);
      }

      // Must remain exactly 1 document for user A
      const count = await Business.countDocuments({ userId: userAId });
      assert.strictEqual(count, 1);
    });

    test('getBusinessProfile: returns profile for authenticated user', async () => {
      setAuthGetter(async () => ({
        user: { id: userAId, email: userAEmail, role: 'USER' },
      }));

      const res = await getBusinessProfile();
      assert.strictEqual(res.ok, true);
      if (res.ok) {
        assert.ok(res.data);
        assert.strictEqual(res.data.businessName, 'Acme PH Studios Updated');
        assert.strictEqual(res.data.userId, userAId);
      }
    });

    test('getBusinessProfile: returns null when user has no profile yet', async () => {
      setAuthGetter(async () => ({
        user: { id: userBId, email: userBEmail, role: 'USER' },
      }));

      const res = await getBusinessProfile();
      assert.strictEqual(res.ok, true);
      if (res.ok) {
        assert.strictEqual(res.data, null);
      }
    });
  });
});

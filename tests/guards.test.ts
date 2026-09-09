import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb.ts';
import { User } from '../models/user.ts';
import { assertNotSuspended, AuthGuardError, requireUser, setAuthGetter } from '../lib/auth-guards.ts';
import { requireAdmin, AdminGuardError } from '../lib/admin/guard.ts';

describe('Suspension & Admin Guards (M1-T05)', () => {
  let activeUserId: string;
  let suspendedUserId: string;
  let deletionUserId: string;
  let adminUserId: string;
  let suspendedAdminUserId: string;
  const adminEmail = `admin-${Date.now()}@example.com`;
  const suspendedAdminEmail = `suspended-admin-${Date.now()}@example.com`;

  before(async () => {
    await dbConnect();

    // 1. Active normal user
    const active = await User.create({
      email: `active-${Date.now()}@example.com`,
      passwordHash: 'dummy_hash',
      name: 'Active User',
      role: 'USER',
    });
    activeUserId = active._id.toString();

    // 2. Suspended user
    const suspended = await User.create({
      email: `suspended-${Date.now()}@example.com`,
      passwordHash: 'dummy_hash',
      name: 'Suspended User',
      role: 'USER',
      suspendedAt: new Date(),
    });
    suspendedUserId = suspended._id.toString();

    // 3. User with deletion requested
    const deletion = await User.create({
      email: `deletion-${Date.now()}@example.com`,
      passwordHash: 'dummy_hash',
      name: 'Deletion User',
      role: 'USER',
      deletionRequestedAt: new Date(),
    });
    deletionUserId = deletion._id.toString();

    // 4. Active admin user
    const admin = await User.create({
      email: adminEmail,
      passwordHash: 'dummy_hash',
      name: 'Admin User',
      role: 'ADMIN',
    });
    adminUserId = admin._id.toString();

    // 5. Suspended admin user
    const suspendedAdmin = await User.create({
      email: suspendedAdminEmail,
      passwordHash: 'dummy_hash',
      name: 'Suspended Admin User',
      role: 'ADMIN',
      suspendedAt: new Date(),
    });
    suspendedAdminUserId = suspendedAdmin._id.toString();
  });

  after(async () => {
    await User.deleteMany({
      _id: { $in: [activeUserId, suspendedUserId, deletionUserId, adminUserId, suspendedAdminUserId] },
    });
    await mongoose.disconnect();
  });

  test('assertNotSuspended: passes for an active user', async () => {
    const user = await assertNotSuspended(activeUserId);
    assert.ok(user);
    assert.strictEqual(user._id.toString(), activeUserId);
  });

  test('assertNotSuspended: throws ACCOUNT_SUSPENDED when user is suspended', async () => {
    await assert.rejects(
      async () => {
        await assertNotSuspended(suspendedUserId);
      },
      (err: unknown) => {
        assert.ok(err instanceof AuthGuardError);
        assert.strictEqual(err.code, 'ACCOUNT_SUSPENDED');
        return true;
      }
    );
  });

  test('assertNotSuspended: throws ACCOUNT_SUSPENDED when deletion is requested', async () => {
    await assert.rejects(
      async () => {
        await assertNotSuspended(deletionUserId);
      },
      (err: unknown) => {
        assert.ok(err instanceof AuthGuardError);
        assert.strictEqual(err.code, 'ACCOUNT_SUSPENDED');
        return true;
      }
    );
  });

  test('assertNotSuspended: throws UNAUTHORIZED when user id does not exist', async () => {
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    await assert.rejects(
      async () => {
        await assertNotSuspended(nonExistentId);
      },
      (err: unknown) => {
        assert.ok(err instanceof AuthGuardError);
        assert.strictEqual(err.code, 'UNAUTHORIZED');
        return true;
      }
    );
  });

  test('requireUser: throws UNAUTHORIZED when no session exists', async () => {
    setAuthGetter(async () => null);
    await assert.rejects(
      async () => {
        await requireUser();
      },
      (err: unknown) => {
        assert.ok(err instanceof AuthGuardError);
        assert.strictEqual(err.code, 'UNAUTHORIZED');
        return true;
      }
    );
  });

  test('requireUser: returns user info when session is valid', async () => {
    setAuthGetter(async () => ({
      user: {
        id: activeUserId,
        email: 'active@example.com',
        name: 'Active User',
        role: 'USER',
      },
    }));

    const user = await requireUser();
    assert.strictEqual(user.id, activeUserId);
    assert.strictEqual(user.email, 'active@example.com');
    assert.strictEqual(user.role, 'USER');
  });

  test('requireAdmin: unauthenticated session throws ADMIN_NOT_FOUND (404-equivalent)', async () => {
    setAuthGetter(async () => null);
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

  test('requireAdmin: non-admin role throws ADMIN_NOT_FOUND', async () => {
    process.env.ADMIN_EMAILS = adminEmail;
    setAuthGetter(async () => ({
      user: {
        id: activeUserId,
        email: adminEmail, // email matches but role is USER
        name: 'Active User',
        role: 'USER',
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

  test('requireAdmin: admin role not in ADMIN_EMAILS throws ADMIN_NOT_FOUND', async () => {
    process.env.ADMIN_EMAILS = 'other-admin@example.com';
    setAuthGetter(async () => ({
      user: {
        id: adminUserId,
        email: adminEmail, // not in ADMIN_EMAILS
        name: 'Admin User',
        role: 'ADMIN',
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

  test('requireAdmin: suspended admin in DB throws ADMIN_NOT_FOUND', async () => {
    process.env.ADMIN_EMAILS = suspendedAdminEmail;
    setAuthGetter(async () => ({
      user: {
        id: suspendedAdminUserId,
        email: suspendedAdminEmail,
        name: 'Suspended Admin',
        role: 'ADMIN',
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

  test('requireAdmin: succeeds when session, role, allowlist, and active DB record align', async () => {
    process.env.ADMIN_EMAILS = `other@example.com,${adminEmail}`;
    setAuthGetter(async () => ({
      user: {
        id: adminUserId,
        email: adminEmail,
        name: 'Admin User',
        role: 'ADMIN',
        mfaVerifiedAt: new Date().toISOString(),
      },
    }));

    const admin = await requireAdmin();
    assert.ok(admin);
    assert.strictEqual(admin.id, adminUserId);
    assert.strictEqual(admin.email, adminEmail);
    assert.strictEqual(admin.role, 'ADMIN');
  });
});

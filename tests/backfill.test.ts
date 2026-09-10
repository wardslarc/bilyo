import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb.ts';
import { User } from '../models/user.ts';
import { runBackfill } from '../scripts/backfill-email-verified.ts';

describe('Backfill Migration Script (SIGNUP_VERIFICATION_PLAN.md §4.11)', () => {
  const createdUserIds: mongoose.Types.ObjectId[] = [];
  let dbAvailable = false;

  after(async () => {
    if (dbAvailable) {
      try {
        await User.deleteMany({ _id: { $in: createdUserIds } });
        await mongoose.disconnect();
      } catch {
        // ignore
      }
    }
  });

  test('backfills emailVerifiedAt with createdAt for users with emailVerifiedAt: null', async () => {
    try {
      await dbConnect();
      dbAvailable = true;
    } catch (err) {
      console.warn('MongoDB not available, skipping live DB test:', (err as Error).message);
      return;
    }

    const testUser = await User.create({
      name: 'Beta User',
      email: `beta.${Date.now()}@example.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      role: 'USER',
      emailVerifiedAt: null,
    });
    createdUserIds.push(testUser._id);

    assert.equal(testUser.emailVerifiedAt, null);

    // Run backfill
    const res = await runBackfill();
    assert.ok(res.modifiedCount >= 1);

    const updated = await User.findById(testUser._id);
    assert.ok(updated?.emailVerifiedAt);
    assert.equal(
      updated?.emailVerifiedAt?.getTime(),
      updated?.createdAt.getTime()
    );

    // Second run is idempotent (0 modified)
    const secondRes = await runBackfill();
    assert.equal(secondRes.modifiedCount, 0);
  });
});

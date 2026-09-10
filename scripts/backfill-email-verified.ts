/**
 * Backfill Migration Script: Grandfather existing beta accounts with emailVerifiedAt
 * (SIGNUP_VERIFICATION_PLAN.md §4.11)
 *
 * Updates all users with emailVerifiedAt: null to have emailVerifiedAt = createdAt.
 * Ensures existing users are never locked out when the login verification gate goes live.
 *
 * Run:
 *   npm run backfill-email-verified
 *   (or node --env-file=.env.local scripts/backfill-email-verified.ts)
 */

import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb.ts';
import { User } from '../models/user.ts';

export async function runBackfill(): Promise<{ modifiedCount: number }> {
  await dbConnect();

  const result = await User.updateMany(
    { emailVerifiedAt: null },
    [{ $set: { emailVerifiedAt: '$createdAt' } }]
  );

  return { modifiedCount: result.modifiedCount };
}

async function main() {
  console.log('--- Backfill emailVerifiedAt for Existing Beta Accounts ---');

  try {
    const { modifiedCount } = await runBackfill();
    console.log(`✓ Backfilled emailVerifiedAt on ${modifiedCount} existing user account(s).`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\nBackfill failed with error:', error);
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
    process.exit(1);
  }
}

if (
  process.argv[1] &&
  (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/')) ||
    process.argv[1].includes('backfill-email-verified'))
) {
  main();
}

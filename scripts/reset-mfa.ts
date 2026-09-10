import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb.ts';
import { User } from '../models/user.ts';

async function main() {
  const emailArg = process.argv[2];

  if (!emailArg || !emailArg.trim()) {
    console.error('Usage: npm run reset-mfa -- <email>');
    process.exit(1);
  }

  const email = emailArg.toLowerCase().trim();

  try {
    await dbConnect();

    const user = await User.findOne({ email });
    if (!user) {
      console.error(`Error: User with email "${email}" not found.`);
      await mongoose.disconnect();
      process.exit(1);
    }

    user.mfaSecretEncrypted = null;
    user.mfaEnabledAt = null;
    user.mfaPendingSecretEncrypted = null;
    user.mfaPendingExpiresAt = null;
    user.mfaRecoveryCodeHashes = [];
    user.mfaLastUsedStep = null;
    user.mfaFailedAttempts = 0;
    user.mfaLockedUntil = null;
    user.sessionsValidFrom = new Date();

    await user.save();

    console.log(`Successfully reset MFA for "${email}".`);
    console.log('The user will be required to complete MFA enrolment on their next sign-in.');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Failed to reset MFA:', (error as Error).message);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
}

main();

import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb.ts';
import { User } from '../models/user.ts';

async function main() {
  const emailArg = process.argv[2];

  if (!emailArg || !emailArg.trim()) {
    console.error('Usage: npm run grant-admin -- <email>');
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

    if (user.role === 'ADMIN') {
      console.log(`User "${email}" already has role ADMIN.`);
    } else {
      user.role = 'ADMIN';
      await user.save();
      console.log(`Successfully granted ADMIN role to "${email}".`);
    }

    console.log(
      `IMPORTANT: To access /admin/*, "${email}" must also be added to the ADMIN_EMAILS environment variable allowlist.`
    );

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Failed to grant admin role:', (error as Error).message);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
}

main();

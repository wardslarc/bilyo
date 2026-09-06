import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import dbConnect from './mongodb';
import { User } from '../models/user';
import { authConfig } from '@/auth.config';

export class AccountSuspendedError extends CredentialsSignin {
  code = 'account_suspended';
}

// Valid cost-10 dummy hash for timing attack mitigation when email is unknown (§8.10, M1-T03)
const DUMMY_HASH = '$2a$10$6iTTYhZTDeaLrFMbocue6.gz2JAFZ6MDEmHW6mdSWBrO5tKKowGoS';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = String(credentials.email).toLowerCase().trim();
        const password = String(credentials.password);

        await dbConnect();
        const user = await User.findOne({ email });
        if (!user || !user.passwordHash) {
          // Compare against dummy hash to equalize response time (§8.10, M1-T03)
          await bcrypt.compare(password, DUMMY_HASH);
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        // Reject suspended or deletion-requested accounts (§5.8, M1-T05)
        if (user.suspendedAt || user.deletionRequestedAt) {
          throw new AccountSuspendedError();
        }

        // Set lastLoginAt (§6, M1-T03)
        await User.updateOne(
          { _id: user._id },
          { $set: { lastLoginAt: new Date() } }
        );

        // Return user info with DB-sourced role (never from client input)
        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
});

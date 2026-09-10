import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import dbConnect from './mongodb';
import { User } from '../models/user';
import { authConfig } from '@/auth.config';
import type { UserRole } from '@/types';

export class AccountSuspendedError extends CredentialsSignin {
  code = 'account_suspended';
}

export class MfaRequiredError extends CredentialsSignin {
  code = 'mfa_required';
}

export class EmailNotVerifiedError extends CredentialsSignin {
  code = 'email_not_verified';
}

// Valid cost-10 dummy hash for timing attack mitigation when email is unknown (§8.10, M1-T03)
const DUMMY_HASH = '$2a$10$6iTTYhZTDeaLrFMbocue6.gz2JAFZ6MDEmHW6mdSWBrO5tKKowGoS';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role as UserRole;
        token.mfaVerifiedAt = user.mfaVerifiedAt || null;
        token.mfaEnabled = Boolean(user.mfaEnabled);
        token.authTime = Math.floor(Date.now() / 1000);
      }

      if (token?.id) {
        await dbConnect();
        const dbUser = await User.findById(token.id).select('sessionsValidFrom suspendedAt deletionRequestedAt');
        if (!dbUser || dbUser.suspendedAt || dbUser.deletionRequestedAt) {
          delete token.id;
          delete token.role;
          delete token.email;
          delete token.name;
          return token;
        }
        if (dbUser.sessionsValidFrom) {
          const authSec = (token.authTime as number) || (token.iat as number) || 0;
          const validFromSec = Math.floor(dbUser.sessionsValidFrom.getTime() / 1000);
          if (authSec < validFromSec) {
            delete token.id;
            delete token.role;
            delete token.email;
            delete token.name;
            return token;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (!token?.id) {
        return {
          ...session,
          user: {
            id: '',
            role: 'USER' as UserRole,
            email: '',
          },
        };
      }
      session.user.id = token.id as string;
      session.user.role = (token.role as UserRole) || 'USER';
      session.user.mfaVerifiedAt = (token.mfaVerifiedAt as string) || null;
      session.user.mfaEnabled = Boolean(token.mfaEnabled);
      session.user.authTime = (token.authTime as number) || (token.iat as number) || null;
      return session;
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        mfaSessionToken: { label: 'MFA Token', type: 'text' },
        signupSessionToken: { label: 'Signup Token', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials) {
          return null;
        }

        const { verifyMfaSessionToken } = await import('./mfa-challenge');

        // Path A: Authenticating after successful MFA challenge verification (§8.10)
        if (credentials.mfaSessionToken) {
          const verified = verifyMfaSessionToken(String(credentials.mfaSessionToken));
          if (!verified) {
            return null;
          }

          await dbConnect();
          const user = await User.findById(verified.userId);
          if (!user || user.suspendedAt || user.deletionRequestedAt || !user.emailVerifiedAt) {
            return null;
          }

          await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
            mfaVerifiedAt: verified.mfaVerifiedAt,
            mfaEnabled: true,
          };
        }

        // Path C: Authenticating after successful signup code verification (SIGNUP_VERIFICATION_PLAN.md §4.5)
        if (credentials.signupSessionToken) {
          const { verifySignupSessionToken } = await import('./signup-challenge');
          const verified = verifySignupSessionToken(String(credentials.signupSessionToken));
          if (!verified) {
            return null;
          }

          await dbConnect();
          const { VerificationToken } = await import('../models/verification-token');

          // Atomically require and consume grantedAt on the token doc (single-use constraint §4.5)
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          const tokenDoc = await VerificationToken.findOneAndUpdate(
            {
              _id: verified.tokenId,
              userId: verified.userId,
              purpose: 'EMAIL_VERIFY',
              usedAt: { $gte: fiveMinutesAgo },
              grantedAt: null,
            },
            { $set: { grantedAt: new Date() } },
            { returnDocument: 'after' }
          );

          if (!tokenDoc) {
            return null;
          }

          const user = await User.findById(verified.userId);
          if (!user || user.suspendedAt || user.deletionRequestedAt) {
            return null;
          }

          await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

          // Note: issued with mfaVerifiedAt: null, mfaEnabled: false (§4.5)
          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
            mfaVerifiedAt: null,
            mfaEnabled: false,
          };
        }

        // Path B: Standard email + password authentication
        if (!credentials.email || !credentials.password) {
          return null;
        }

        const email = String(credentials.email).toLowerCase().trim();
        const password = String(credentials.password);

        const { getClientIp, enforceRateLimits } = await import('./rate-limit.ts');
        const ip = await getClientIp();
        const rateCheck = await enforceRateLimits([
          {
            key: `rate:login:ip:${ip}`,
            limit: 10,
            windowSeconds: 60,
          },
          {
            key: `rate:login:email:${email}`,
            limit: 5,
            windowSeconds: 900,
          },
        ]);

        if (!rateCheck.allowed) {
          return null;
        }

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

        // Reject unverified email addresses (SIGNUP_VERIFICATION_PLAN.md §4.8)
        if (!user.emailVerifiedAt) {
          throw new EmailNotVerifiedError();
        }

        // Reject suspended or deletion-requested accounts (§5.8, M1-T05)
        if (user.suspendedAt || user.deletionRequestedAt) {
          throw new AccountSuspendedError();
        }

        // If user has MFA enabled, they must NOT obtain a session without verifying MFA (§8.10)
        if (user.mfaEnabledAt) {
          throw new MfaRequiredError();
        }

        // Non-MFA user login
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
          mfaVerifiedAt: null,
          mfaEnabled: false,
        };
      },
    }),
  ],
});

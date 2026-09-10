import type { NextAuthConfig } from 'next-auth';
import type { UserRole } from '@/types';

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET environment variable is missing.');
  }
  return secret;
}

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: 'jwt' },
  secret: getAuthSecret(),
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role as UserRole;
        token.mfaVerifiedAt = user.mfaVerifiedAt || null;
        token.mfaEnabled = Boolean(user.mfaEnabled);
        token.authTime = Math.floor(Date.now() / 1000);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = (token.role as UserRole) || 'USER';
        session.user.mfaVerifiedAt = (token.mfaVerifiedAt as string) || null;
        session.user.mfaEnabled = Boolean(token.mfaEnabled);
        session.user.authTime = (token.authTime as number) || (token.iat as number) || null;
      }
      return session;
    },
  },
  providers: [],
};

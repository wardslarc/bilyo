import type { NextAuthConfig } from 'next-auth';
import type { UserRole } from '@/types';

export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' },
  secret:
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'bilyo-dev-secret-key-32-chars-long!',
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role as UserRole;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = (token.role as UserRole) || 'USER';
      }
      return session;
    },
  },
  providers: [],
};

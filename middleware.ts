import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';
import { NextResponse } from 'next/server';

const { auth } = NextAuth(authConfig);

/**
 * Route protection middleware (§2, §5.8 rule 7, M1-T04).
 * - /dashboard/*: requires active session, unauthenticated redirects to /login?callbackUrl=...
 * - /admin/*: requires session + role === 'ADMIN'. Non-admins and unauthenticated visitors
 *   receive HTTP 404 (Not Found), never 403, to conceal admin console existence.
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth?.user;
  const userRole = req.auth?.user?.role;

  // Guard /dashboard/*
  if (pathname.startsWith('/dashboard')) {
    if (!isLoggedIn) {
      const loginUrl = new URL('/login', req.nextUrl.origin);
      loginUrl.searchParams.set(
        'callbackUrl',
        req.nextUrl.pathname + req.nextUrl.search
      );
      return NextResponse.redirect(loginUrl);
    }
  }

  // Guard /admin/* (§5.8 rule 7: 404, not 403)
  if (pathname.startsWith('/admin')) {
    if (!isLoggedIn || userRole !== 'ADMIN') {
      return new NextResponse(null, { status: 404 });
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};

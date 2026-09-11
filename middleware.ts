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
  const isLoggedIn = Boolean(req.auth?.user?.id);
  const userRole = req.auth?.user?.role;

  // Redirect authenticated users away from auth pages to /dashboard
  if (isLoggedIn && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl.origin));
  }

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

  // Guard /admin/* (AGENTS.md §4.9: 404, not 403)
  if (pathname.startsWith('/admin')) {
    if (!isLoggedIn || userRole !== 'ADMIN' || !req.auth?.user?.mfaVerifiedAt) {
      return new NextResponse(null, { status: 404 });
    }
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
});

export const config = {
  matcher: [
    '/login',
    '/register',
    '/dashboard',
    '/dashboard/:path*',
    '/admin',
    '/admin/:path*',
  ],
};

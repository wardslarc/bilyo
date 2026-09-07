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

  // Guard /onboarding/*
  if (pathname.startsWith('/onboarding')) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL('/login', req.nextUrl.origin));
    }
    // If already enrolled in MFA, redirect away from /onboarding/mfa to /dashboard
    if (pathname === '/onboarding/mfa' && req.auth?.user?.mfaEnabled) {
      return NextResponse.redirect(new URL('/dashboard', req.nextUrl.origin));
    }
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

    // Mandatory MFA for all users (§5.11, M6-T06)
    if (!req.auth?.user?.mfaEnabled) {
      return NextResponse.redirect(new URL('/onboarding/mfa', req.nextUrl.origin));
    }
  }

  // Guard /admin/* (§5.8 rule 7: 404, not 403)
  if (pathname.startsWith('/admin')) {
    if (!isLoggedIn || userRole !== 'ADMIN') {
      return new NextResponse(null, { status: 404 });
    }

    // Require MFA enrolment and active MFA verification (§5.8 rule 2)
    if (!req.auth?.user?.mfaEnabled) {
      return NextResponse.redirect(new URL('/onboarding/mfa', req.nextUrl.origin));
    }

    if (!req.auth?.user?.mfaVerifiedAt) {
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
    '/dashboard',
    '/dashboard/:path*',
    '/admin',
    '/admin/:path*',
    '/onboarding',
    '/onboarding/:path*',
  ],
};

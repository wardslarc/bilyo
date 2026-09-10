import dbConnect from './mongodb.ts';
import { User } from '../models/user.ts';

export class AuthGuardError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'AuthGuardError';
    this.code = code;
  }
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string | null;
  role: 'USER' | 'ADMIN';
  mfaVerifiedAt?: string | null;
  mfaEnabled?: boolean;
  authTime?: number | null;
}

export type AuthSession = {
  user?: {
    id?: string;
    email?: string | null;
    name?: string | null;
    role?: string;
    mfaVerifiedAt?: string | null;
    mfaEnabled?: boolean;
    authTime?: number | null;
  } | null;
  expires?: string;
} | null;

// Session resolver: lazily imports auth to allow test runners without Next.js bundler
let authGetter: () => Promise<AuthSession> = async () => {
  const { auth } = await import('./auth.ts');
  return auth();
};

export function setAuthGetter(getter: () => Promise<AuthSession>) {
  authGetter = getter;
}

/**
 * Asserts a valid session with userId exists.
 * Throws 'UNAUTHORIZED' if missing or unauthenticated.
 */
export async function requireUser(): Promise<AuthenticatedUser> {
  const session = await authGetter();
  if (!session?.user?.id || !session?.user?.email) {
    throw new AuthGuardError('Unauthorized: No valid session', 'UNAUTHORIZED');
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: (session.user.role as 'USER' | 'ADMIN') || 'USER',
    mfaVerifiedAt: session.user.mfaVerifiedAt || null,
    mfaEnabled: Boolean(session.user.mfaEnabled),
    authTime: session.user.authTime ?? null,
  };
}

/**
 * Asserts that the specified user is not suspended or pending deletion.
 * Also verifies that the session was issued after sessionsValidFrom (password/MFA change revocation).
 * Always re-reads the database to catch suspensions mid-session.
 * Throws typed error 'ACCOUNT_SUSPENDED' if suspendedAt or deletionRequestedAt is set.
 */
export async function assertNotSuspended(userId: string, authTime?: number | null) {
  await dbConnect();
  const user = await User.findById(userId).select('suspendedAt deletionRequestedAt sessionsValidFrom');
  if (!user) {
    throw new AuthGuardError('User not found', 'UNAUTHORIZED');
  }

  if (user.suspendedAt || user.deletionRequestedAt) {
    throw new AuthGuardError(
      'Your account has been suspended or scheduled for deletion. Please contact support.',
      'ACCOUNT_SUSPENDED'
    );
  }

  if (user.sessionsValidFrom && authTime != null) {
    const validFromSec = Math.floor(user.sessionsValidFrom.getTime() / 1000);
    if (authTime < validFromSec) {
      throw new AuthGuardError('Session has been revoked. Please sign in again.', 'UNAUTHORIZED');
    }
  }

  return user;
}

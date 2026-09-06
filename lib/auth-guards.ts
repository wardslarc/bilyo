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
}

export type AuthSession = {
  user?: {
    id?: string;
    email?: string | null;
    name?: string | null;
    role?: string;
    mfaVerifiedAt?: string | null;
    mfaEnabled?: boolean;
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
  };
}

/**
 * Asserts that the specified user is not suspended or pending deletion.
 * Always re-reads the database to catch suspensions mid-session.
 * Throws typed error 'ACCOUNT_SUSPENDED' if suspendedAt or deletionRequestedAt is set.
 */
export async function assertNotSuspended(userId: string) {
  await dbConnect();
  const user = await User.findById(userId).select('suspendedAt deletionRequestedAt');
  if (!user) {
    throw new AuthGuardError('User not found', 'UNAUTHORIZED');
  }

  if (user.suspendedAt || user.deletionRequestedAt) {
    throw new AuthGuardError(
      'Your account has been suspended or scheduled for deletion. Please contact support.',
      'ACCOUNT_SUSPENDED'
    );
  }

  return user;
}

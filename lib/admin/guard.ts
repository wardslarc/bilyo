import { requireUser, type AuthenticatedUser } from '../auth-guards.ts';
import dbConnect from '../mongodb.ts';
import { User } from '../../models/user.ts';

export class AdminGuardError extends Error {
  code: string;

  constructor(message: string = 'Not found', code: string = 'ADMIN_NOT_FOUND') {
    super(message);
    this.name = 'AdminGuardError';
    this.code = code;
  }
}

/**
 * Platform admin guard (AGENTS.md §3.7, DEVELOPMENT_PLAN.md §5.8).
 * Requires BOTH session.user.role === 'ADMIN' AND email in ADMIN_EMAILS env allowlist.
 * Re-reads user from DB to verify role and ensure not suspended or deletion-requested.
 * Throws ADMIN_NOT_FOUND (never FORBIDDEN) so non-admins see 404, concealing the console's existence.
 */
export async function requireAdmin(): Promise<AuthenticatedUser> {
  let user: AuthenticatedUser;
  try {
    user = await requireUser();
  } catch {
    // Unauthenticated or invalid session -> throw 404-equivalent
    throw new AdminGuardError('Not found', 'ADMIN_NOT_FOUND');
  }

  // Check role and allowlist
  const allowlist = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const email = user.email.toLowerCase();
  if (user.role !== 'ADMIN' || !allowlist.includes(email)) {
    throw new AdminGuardError('Not found', 'ADMIN_NOT_FOUND');
  }

  // Re-read user from DB to verify role and active state
  await dbConnect();
  const dbUser = await User.findById(user.id).select('role suspendedAt deletionRequestedAt');
  if (
    !dbUser ||
    dbUser.role !== 'ADMIN' ||
    dbUser.suspendedAt ||
    dbUser.deletionRequestedAt
  ) {
    throw new AdminGuardError('Not found', 'ADMIN_NOT_FOUND');
  }

  return user;
}

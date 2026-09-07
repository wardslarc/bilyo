import dbConnect from '../mongodb.ts';
import { AdminAuditLog } from '../../models/admin-audit-log.ts';
import { requireAdmin } from './guard.ts';
import type { IAdminAuditLog } from '@/types';

export type AdminAuditAction =
  | 'USER_VIEW'
  | 'DOCUMENT_VIEW'
  | 'USER_SUSPEND'
  | 'USER_UNSUSPEND'
  | 'PLAN_OVERRIDE_SET'
  | 'PLAN_OVERRIDE_CLEAR'
  | 'PUBLIC_LINK_REVOKE'
  | 'PUBLIC_LINKS_DISABLE'
  | 'PUBLIC_LINKS_ENABLE'
  | 'MFA_RESET'
  | 'SUPPORT_LOOKUP';

export interface RecordAuditParams {
  action: AdminAuditAction;
  targetUserId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
  actor?: {
    id: string;
    email: string;
  };
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Append-only admin audit log primitive (AGENTS.md §3.7, §4, DEVELOPMENT_PLAN.md §5.8).
 * Captures IP and user agent from request headers.
 * CRITICAL RULE: This collection is strictly append-only.
 * There is NO update or delete helper in this file or anywhere in the repository.
 */
export async function recordAudit(
  params: RecordAuditParams
): Promise<IAdminAuditLog> {
  await dbConnect();

  // Resolve actor: use provided actor or query verified admin from session
  let actorId = params.actor?.id;
  let actorEmail = params.actor?.email;

  if (!actorId || !actorEmail) {
    const admin = await requireAdmin();
    actorId = admin.id;
    actorEmail = admin.email;
  }

  // Extract IP and user agent from request headers when available
  let ip = params.ip || null;
  let userAgent = params.userAgent || null;

  if (!ip || !userAgent) {
    try {
      const { headers } = await import('next/headers');
      const headerList = await headers();
      if (!ip) {
        ip =
          headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          headerList.get('x-real-ip') ||
          '127.0.0.1';
      }
      if (!userAgent) {
        userAgent = headerList.get('user-agent') || 'unknown';
      }
    } catch {
      // Fallback for non-request contexts (CLI scripts, unit tests)
      ip = ip || '127.0.0.1';
      userAgent = userAgent || 'internal/script';
    }
  }

  const logEntry = await AdminAuditLog.create({
    actorUserId: actorId,
    actorEmail: actorEmail.toLowerCase(),
    action: params.action,
    targetUserId: params.targetUserId || null,
    targetType: params.targetType || null,
    targetId: params.targetId || null,
    reason: params.reason || null,
    before: params.before || null,
    after: params.after || null,
    ip,
    userAgent,
  });

  return logEntry;
}

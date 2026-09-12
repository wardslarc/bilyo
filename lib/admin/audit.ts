import mongoose from 'mongoose';
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
  | 'SUPPORT_LOOKUP'
  // Donation QR (AGENTS.md §4.9) — platform content, no target user
  | 'DONATION_QR_SET'
  | 'DONATION_QR_CLEAR'
  | 'DONATION_TOGGLE';

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

export interface GetAdminAuditLogsParams {
  page?: number;
  limit?: number;
  actor?: string;
  targetUser?: string;
  action?: AdminAuditAction | 'ALL';
}

export interface AdminAuditLogViewerItem {
  id: string;
  actorUserId: string;
  actorEmail: string;
  action: AdminAuditAction;
  targetUserId: string | null;
  targetUserEmail?: string | null;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface AdminAuditLogsResult {
  logs: AdminAuditLogViewerItem[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

/**
 * Builds the MongoDB query filter for audit log listing.
 * Exported for pure unit testing without DB connection.
 */
export function buildAuditFilter(params: {
  action?: string;
  actor?: string;
  targetUser?: string;
  targetUserIds?: unknown[];
}): Record<string, unknown> {
  const conditions: Record<string, unknown>[] = [];

  if (params.action && params.action !== 'ALL') {
    conditions.push({ action: params.action });
  }

  const trimmedActor = params.actor?.trim();
  if (trimmedActor) {
    if (mongoose.isValidObjectId(trimmedActor)) {
      conditions.push({
        $or: [
          { actorEmail: { $regex: trimmedActor, $options: 'i' } },
          { actorUserId: new mongoose.Types.ObjectId(trimmedActor) },
        ],
      });
    } else {
      conditions.push({ actorEmail: { $regex: trimmedActor, $options: 'i' } });
    }
  }

  const trimmedTarget = params.targetUser?.trim();
  if (trimmedTarget) {
    const targetOr: Record<string, unknown>[] = [
      { targetId: { $regex: trimmedTarget, $options: 'i' } },
    ];

    if (mongoose.isValidObjectId(trimmedTarget)) {
      targetOr.push({ targetUserId: new mongoose.Types.ObjectId(trimmedTarget) });
    }

    if (params.targetUserIds && params.targetUserIds.length > 0) {
      targetOr.push({ targetUserId: { $in: params.targetUserIds } });
    }

    conditions.push({ $or: targetOr });
  }

  if (conditions.length === 0) {
    return {};
  }
  if (conditions.length === 1) {
    return conditions[0]!;
  }
  return { $and: conditions };
}

/**
 * Paginated query for audit logs, newest first, filterable by actor, target, and action.
 * Deliberately read-only — no update or delete control exists (AGENTS.md §3.7, M7-T09).
 */
export async function getAdminAuditLogs(
  params: GetAdminAuditLogsParams = {}
): Promise<AdminAuditLogsResult> {
  await requireAdmin();
  await dbConnect();

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 25));
  const skip = (page - 1) * limit;

  // Resolve target user IDs if searching by target name or email
  let targetUserIds: unknown[] = [];
  const trimmedTarget = params.targetUser?.trim();
  if (trimmedTarget) {
    const { User } = await import('../../models/user.ts');
    const matchedUsers = await User.find({
      $or: [
        { email: { $regex: trimmedTarget, $options: 'i' } },
        { name: { $regex: trimmedTarget, $options: 'i' } },
      ],
    })
      .select('_id')
      .lean();
    targetUserIds = matchedUsers.map((u) => u._id);
  }

  const filter = buildAuditFilter({
    action: params.action,
    actor: params.actor,
    targetUser: params.targetUser,
    targetUserIds,
  });

  const [rawLogs, total] = await Promise.all([
    AdminAuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AdminAuditLog.countDocuments(filter),
  ]);

  // Enrich with target user emails in a single batch query
  const distinctTargetUserIds = Array.from(
    new Set(
      rawLogs
        .map((l) => l.targetUserId?.toString())
        .filter((id): id is string => Boolean(id))
    )
  );

  const targetEmailMap = new Map<string, string>();
  if (distinctTargetUserIds.length > 0) {
    const { User } = await import('../../models/user.ts');
    const targetUsers = await User.find({
      _id: { $in: distinctTargetUserIds },
    })
      .select('_id email')
      .lean();
    for (const u of targetUsers) {
      targetEmailMap.set(u._id.toString(), u.email);
    }
  }

  const logs: AdminAuditLogViewerItem[] = rawLogs.map((log) => {
    const targetUid = log.targetUserId ? log.targetUserId.toString() : null;
    return {
      id: log._id.toString(),
      actorUserId: log.actorUserId.toString(),
      actorEmail: log.actorEmail,
      action: log.action,
      targetUserId: targetUid,
      targetUserEmail: targetUid ? targetEmailMap.get(targetUid) || null : null,
      targetType: log.targetType || null,
      targetId: log.targetId || null,
      reason: log.reason || null,
      before: (log.before as Record<string, unknown>) || null,
      after: (log.after as Record<string, unknown>) || null,
      ip: log.ip || null,
      userAgent: log.userAgent || null,
      createdAt: log.createdAt,
    };
  });

  return {
    logs,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
    limit,
  };
}

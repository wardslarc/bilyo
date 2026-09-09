import dbConnect from '../mongodb.ts';
import { Quotation } from '../../models/quotation.ts';
import { User } from '../../models/user.ts';
import { Business } from '../../models/business.ts';
import { Customer } from '../../models/customer.ts';
import { requireAdmin } from './guard.ts';
import { recordAudit } from './audit.ts';

export interface AdminLookupMatch {
  id: string;
  kind: 'quotation';
  number: string;
  status: string;
  userId: string;
  userEmail: string;
  businessName: string;
  customerName: string;
  issueDate: Date;
  validUntil?: Date | null;
  totalCentavos: number;
  publicToken?: string | null;
  publicTokenRevokedAt?: Date | null;
  createdAt: Date;
}

export type LookupValidationResult =
  | {
      valid: true;
      trimmed: string;
      candidateNumbers: string[];
    }
  | {
      valid: false;
      error: string;
    };

const BARE_PREFIXES = new Set(['QUO-', 'Q-']);

/**
 * Validates and normalizes quotation lookup queries.
 * Pure function suitable for unit testing without database connection.
 * - Requires query string >= 4 characters.
 * - Disallows bare prefixes like "QUO-" or "Q-" from dumping all quotations.
 * - Normalizes shorthand quotation numbers (e.g. QUO-42 -> QUO-000042, Q-2026-12 -> Q-2026-0012).
 */
export function validateLookupQuery(query: string): LookupValidationResult {
  const trimmed = query.trim();
  const upper = trimmed.toUpperCase();

  if (BARE_PREFIXES.has(upper)) {
    return {
      valid: false,
      error: 'Bare prefixes like "QUO-" or "Q-" are not allowed. Please enter a full quotation number (e.g. Q-2026-0001 or QUO-000042) or a public code.',
    };
  }

  if (trimmed.length < 4) {
    return {
      valid: false,
      error: 'Lookup query must be at least 4 characters long.',
    };
  }

  const candidateNumbers: string[] = [upper];

  // Shorthand formats:
  // 1. Old format "QUO-7" or "QUO7" -> "QUO-000007"
  const oldMatch = upper.match(/^QUO-?(\d{1,6})$/);
  if (oldMatch) {
    const paddedSeq = oldMatch[1].padStart(6, '0');
    const normalized = `QUO-${paddedSeq}`;
    if (!candidateNumbers.includes(normalized)) {
      candidateNumbers.push(normalized);
    }
  }

  // 2. New format "Q-2026-1" or "Q-2026-01" -> "Q-2026-0001"
  const newMatch = upper.match(/^Q-(\d{4})-(\d{1,4})$/);
  if (newMatch) {
    const year = newMatch[1];
    const paddedSeq = newMatch[2].padStart(4, '0');
    const normalized = `Q-${year}-${paddedSeq}`;
    if (!candidateNumbers.includes(normalized)) {
      candidateNumbers.push(normalized);
    }
  }

  return {
    valid: true,
    trimmed,
    candidateNumbers,
  };
}

export type LookupResult =
  | {
      ok: true;
      matches: AdminLookupMatch[];
      query: string;
    }
  | {
      ok: false;
      error: string;
      query: string;
    };

/**
 * Searches quotations across all users by quotation number or public token/code (P1-T06).
 * Cross-user query strictly guarded by requireAdmin() (AGENTS.md §4.9).
 * Audited via append-only AdminAuditLog.
 */
export async function lookupDocumentAcrossUsers(
  rawQuery: string
): Promise<LookupResult> {
  await requireAdmin();

  const validation = validateLookupQuery(rawQuery);
  if (!validation.valid) {
    return {
      ok: false,
      error: validation.error,
      query: rawQuery,
    };
  }

  const { trimmed, candidateNumbers } = validation;

  await dbConnect();

  // Search indexed fields: number ($in candidates) or publicToken / publicCode (exact trimmed)
  const filter = {
    $or: [
      { publicToken: trimmed },
      { publicCode: trimmed },
      { number: { $in: candidateNumbers } },
    ],
  };

  const quotations = await Quotation.find(filter).lean();

  // Collect distinct userIds and customerIds to resolve emails and names efficiently
  const userIds = Array.from(new Set(quotations.map((q) => q.userId.toString())));
  const customerIds = Array.from(
    new Set(quotations.map((q) => q.customerId?.toString()).filter(Boolean))
  );

  const [users, businesses, customers] = await Promise.all([
    User.find({ _id: { $in: userIds } }, { email: 1 }).lean(),
    Business.find({ userId: { $in: userIds } }, { userId: 1, businessName: 1 }).lean(),
    Customer.find({ _id: { $in: customerIds } }, { name: 1 }).lean(),
  ]);

  const userEmailMap = new Map(users.map((u) => [u._id.toString(), u.email]));
  const businessNameMap = new Map(businesses.map((b) => [b.userId.toString(), b.businessName]));
  const customerNameMap = new Map(customers.map((c) => [c._id.toString(), c.name]));

  const matches: AdminLookupMatch[] = quotations.map((doc) => {
    const uId = doc.userId.toString();
    const cId = doc.customerId?.toString();

    // Prefer frozen snapshots if available, fallback to live business / customer
    const bSnap = doc.businessSnapshot as { businessName?: string } | undefined;
    const cSnap = doc.customerSnapshot as { name?: string } | undefined;

    const businessName =
      bSnap?.businessName || businessNameMap.get(uId) || '—';
    const customerName =
      cSnap?.name || (cId ? customerNameMap.get(cId) : undefined) || '—';

    return {
      id: doc._id.toString(),
      kind: 'quotation',
      number: doc.number,
      status: doc.status,
      userId: uId,
      userEmail: userEmailMap.get(uId) || 'unknown@user',
      businessName,
      customerName,
      issueDate: doc.issueDate,
      validUntil: doc.validUntil || null,
      totalCentavos: doc.totalCentavos,
      publicToken: doc.publicToken || null,
      publicTokenRevokedAt: doc.publicTokenRevokedAt || null,
      createdAt: doc.createdAt,
    };
  });

  // Sort matches by newest first
  matches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Audited per AGENTS.md §4.9 & DEVELOPMENT_PLAN.md §3
  if (matches.length === 1) {
    const single = matches[0];
    await recordAudit({
      action: 'SUPPORT_LOOKUP',
      targetUserId: single.userId,
      targetType: 'Quotation',
      targetId: single.id,
      reason: `Support lookup query "${trimmed}" resolved to ${single.number} (quotation)`,
    });
  } else if (matches.length > 1) {
    await recordAudit({
      action: 'SUPPORT_LOOKUP',
      reason: `Support lookup query "${trimmed}" returned ${matches.length} matching quotations across users`,
    });
  } else {
    await recordAudit({
      action: 'SUPPORT_LOOKUP',
      reason: `Support lookup query "${trimmed}" returned not found`,
    });
  }

  return {
    ok: true,
    matches,
    query: trimmed,
  };
}


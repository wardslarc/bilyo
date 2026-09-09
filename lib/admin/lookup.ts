import dbConnect from '../mongodb.ts';
import { Quotation } from '../../models/quotation.ts';
import { User } from '../../models/user.ts';
import { Business } from '../../models/business.ts';
import { Customer } from '../../models/customer.ts';
import { requireAdmin } from './guard.ts';
import { recordAudit } from './audit.ts';

export interface AdminLookupMatch {
  id: string;
  kind: 'invoice' | 'quotation';
  number: string;
  status: string;
  userId: string;
  userEmail: string;
  businessName: string;
  customerName: string;
  issueDate: Date;
  dueDateOrValidUntil?: Date | null;
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

const BARE_PREFIXES = new Set(['INV', 'INV-', 'QUO', 'QUO-']);

/**
 * Validates and normalizes document lookup queries.
 * Pure function suitable for unit testing without database connection.
 * - Requires query string >= 4 characters.
 * - Disallows bare prefixes like "INV-" or "QUO-" from dumping all documents.
 * - Normalizes shorthand document numbers (e.g. INV-42 -> INV-000042).
 */
export function validateLookupQuery(query: string): LookupValidationResult {
  const trimmed = query.trim();

  if (trimmed.length < 4) {
    return {
      valid: false,
      error: 'Lookup query must be at least 4 characters long.',
    };
  }

  const upper = trimmed.toUpperCase();
  if (BARE_PREFIXES.has(upper)) {
    return {
      valid: false,
      error: 'Bare prefixes like "INV-" or "QUO-" are not allowed. Please enter a full document number (e.g. INV-000042) or a public token.',
    };
  }

  const candidateNumbers: string[] = [upper];

  // If user entered e.g. "INV-42" or "QUO-7", normalize with 6-digit zero-padding per §5.3
  const shorthandMatch = upper.match(/^(INV|QUO)-?(\d{1,6})$/);
  if (shorthandMatch) {
    const prefix = shorthandMatch[1] + '-';
    const paddedSeq = shorthandMatch[2].padStart(6, '0');
    const normalized = `${prefix}${paddedSeq}`;
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
 * Searches invoices and quotations across all users by document number or public token (M7-T04).
 * Cross-user query strictly guarded by requireAdmin() (AGENTS.md §3.7).
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

  // Search indexed fields: number ($in candidates) or publicToken (exact trimmed)
  const filter = {
    $or: [
      { publicToken: trimmed },
      { number: { $in: candidateNumbers } },
    ],
  };

  const quotations = await Quotation.find(filter).lean();

  const rawMatches: Array<{
    doc: typeof quotations[number];
    kind: 'quotation';
  }> = [
    ...quotations.map((doc) => ({ doc, kind: 'quotation' as const })),
  ];

  // Collect distinct userIds and customerIds to resolve emails and names efficiently
  const userIds = Array.from(new Set(rawMatches.map((m) => m.doc.userId.toString())));
  const customerIds = Array.from(
    new Set(rawMatches.map((m) => m.doc.customerId?.toString()).filter(Boolean))
  );

  const [users, businesses, customers] = await Promise.all([
    User.find({ _id: { $in: userIds } }, { email: 1 }).lean(),
    Business.find({ userId: { $in: userIds } }, { userId: 1, businessName: 1 }).lean(),
    Customer.find({ _id: { $in: customerIds } }, { name: 1 }).lean(),
  ]);

  const userEmailMap = new Map(users.map((u) => [u._id.toString(), u.email]));
  const businessNameMap = new Map(businesses.map((b) => [b.userId.toString(), b.businessName]));
  const customerNameMap = new Map(customers.map((c) => [c._id.toString(), c.name]));

  const matches: AdminLookupMatch[] = rawMatches.map(({ doc, kind }) => {
    const uId = doc.userId.toString();
    const cId = doc.customerId?.toString();

    // Prefer frozen snapshots if available, fallback to live business / customer
    const bSnap = doc.businessSnapshot as { businessName?: string } | undefined;
    const cSnap = doc.customerSnapshot as { name?: string } | undefined;

    const businessName =
      bSnap?.businessName || businessNameMap.get(uId) || '—';
    const customerName =
      cSnap?.name || (cId ? customerNameMap.get(cId) : undefined) || '—';

    const dueDateOrValidUntil = doc.validUntil;

    return {
      id: doc._id.toString(),
      kind,
      number: doc.number,
      status: doc.status,
      userId: uId,
      userEmail: userEmailMap.get(uId) || 'unknown@user',
      businessName,
      customerName,
      issueDate: doc.issueDate,
      dueDateOrValidUntil: dueDateOrValidUntil || null,
      totalCentavos: doc.totalCentavos,
      publicToken: doc.publicToken || null,
      publicTokenRevokedAt: doc.publicTokenRevokedAt || null,
      createdAt: doc.createdAt,
    };
  });

  // Sort matches by newest first
  matches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Audited per AGENTS.md §3.7 & DEVELOPMENT_PLAN.md §5.8
  if (matches.length === 1) {
    const single = matches[0];
    await recordAudit({
      action: 'SUPPORT_LOOKUP',
      targetUserId: single.userId,
      targetType: single.kind === 'invoice' ? 'Invoice' : 'Quotation',
      targetId: single.id,
      reason: `Support lookup query "${trimmed}" resolved to ${single.number} (${single.kind})`,
    });
  } else if (matches.length > 1) {
    await recordAudit({
      action: 'SUPPORT_LOOKUP',
      reason: `Support lookup query "${trimmed}" returned ${matches.length} matching documents across users`,
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

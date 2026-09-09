import dbConnect from '../mongodb.ts';
import { User } from '../../models/user.ts';
import { Business } from '../../models/business.ts';
import { Customer } from '../../models/customer.ts';
import { Quotation } from '../../models/quotation.ts';
import { AdminAuditLog } from '../../models/admin-audit-log.ts';
import { requireAdmin } from './guard.ts';

export interface GetAdminUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'ACTIVE' | 'SUSPENDED' | 'DELETION' | 'ALL';
  activeIn30Days?: boolean;
}

export interface AdminUserListItem {
  id: string;
  name: string;
  email: string;
  businessName: string;
  documentsCount: number;
  invoicesCount: number;
  quotationsCount: number;
  signedUpAt: Date;
  lastActiveAt: Date | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETION_REQUESTED';
}

export interface AdminUsersListResult {
  users: AdminUserListItem[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

/**
 * Builds the MongoDB filter query for admin users list.
 * Exported for pure unit testing without DB connection.
 */
export function buildUsersFilter(params: {
  search?: string;
  status?: string;
  activeIn30Days?: boolean;
  matchingBusinessUserIds?: unknown[];
}): Record<string, unknown> {
  const conditions: Record<string, unknown>[] = [];

  // Status filter
  if (params.status === 'SUSPENDED') {
    conditions.push({ suspendedAt: { $ne: null } });
  } else if (params.status === 'DELETION') {
    conditions.push({ deletionRequestedAt: { $ne: null } });
  } else if (params.status === 'ACTIVE') {
    conditions.push({ suspendedAt: null, deletionRequestedAt: null });
  }

  // Active in 30 days filter
  if (params.activeIn30Days) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    conditions.push({
      $or: [
        { lastActiveAt: { $gte: thirtyDaysAgo } },
        { lastLoginAt: { $gte: thirtyDaysAgo } },
      ],
    });
  }

  // Search filter (email or business name)
  const trimmedSearch = params.search?.trim();
  if (trimmedSearch) {
    const searchConditions: Record<string, unknown>[] = [
      { email: { $regex: trimmedSearch, $options: 'i' } },
      { name: { $regex: trimmedSearch, $options: 'i' } },
    ];

    if (params.matchingBusinessUserIds && params.matchingBusinessUserIds.length > 0) {
      searchConditions.push({ _id: { $in: params.matchingBusinessUserIds } });
    }

    conditions.push({ $or: searchConditions });
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
 * Server-side paginated user listing for platform admins (AGENTS.md §3.7, DEVELOPMENT_PLAN.md §5.8, M7-T02).
 * Database-level pagination via skip/limit and countDocuments, sub-second response on large datasets.
 */
export async function getAdminUsersList(
  params: GetAdminUsersParams = {}
): Promise<AdminUsersListResult> {
  await requireAdmin();
  await dbConnect();

  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 25));
  const skip = (page - 1) * limit;

  // If search query is present, check matching businesses to find their userIds
  let matchingBusinessUserIds: unknown[] = [];
  const search = params.search?.trim();
  if (search) {
    const matchingBusinesses = await Business.find({
      businessName: { $regex: search, $options: 'i' },
    })
      .select('userId')
      .lean();
    matchingBusinessUserIds = matchingBusinesses.map((b) => b.userId);
  }

  const query = buildUsersFilter({
    search,
    status: params.status,
    activeIn30Days: params.activeIn30Days,
    matchingBusinessUserIds,
  });

  const [total, rawUsers] = await Promise.all([
    User.countDocuments(query),
    User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        '_id name email role suspendedAt deletionRequestedAt createdAt lastLoginAt lastActiveAt'
      )
      .lean(),
  ]);

  const userIds = rawUsers.map((u) => u._id);

  // Fetch associated business names and document counts in batch parallel queries
  const [businesses, quotationCounts] = await Promise.all([
    Business.find({ userId: { $in: userIds } })
      .select('userId businessName')
      .lean(),
    Quotation.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]),
  ]);

  const businessMap = new Map<string, string>();
  for (const b of businesses) {
    businessMap.set(b.userId.toString(), b.businessName);
  }

  const quotationMap = new Map<string, number>();
  for (const quo of quotationCounts) {
    quotationMap.set(quo._id.toString(), quo.count);
  }

  const users: AdminUserListItem[] = rawUsers.map((u) => {
    const uid = u._id.toString();
    const invCount = 0;
    const quoCount = quotationMap.get(uid) || 0;

    let status: 'ACTIVE' | 'SUSPENDED' | 'DELETION_REQUESTED' = 'ACTIVE';
    if (u.suspendedAt) {
      status = 'SUSPENDED';
    } else if (u.deletionRequestedAt) {
      status = 'DELETION_REQUESTED';
    }

    return {
      id: uid,
      name: u.name,
      email: u.email,
      businessName: businessMap.get(uid) || '—',
      documentsCount: invCount + quoCount,
      invoicesCount: invCount,
      quotationsCount: quoCount,
      signedUpAt: u.createdAt,
      lastActiveAt: u.lastActiveAt || u.lastLoginAt || null,
      status,
    };
  });

  return {
    users,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
    limit,
  };
}

export interface AdminUserDetail {
  user: {
    id: string;
    name: string;
    email: string;
    role: 'USER' | 'ADMIN';
    suspendedAt: Date | null;
    suspendedReason: string | null;
    suspendedByUserId: string | null;
    deletionRequestedAt: Date | null;
    publicLinksDisabledAt: Date | null;
    mfaEnabled: boolean;
    mfaEnabledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt: Date | null;
    lastActiveAt: Date | null;
  };
  business: {
    businessName: string;
    address: string;
    email: string;
    phone: string;
    logoUrl: string | null;
    createdAt: Date;
  } | null;
  counts: {
    invoices: {
      total: number;
      draft: number;
      sent: number;
      paid: number;
      overdue: number;
      cancelled: number;
    };
    quotations: {
      total: number;
      draft: number;
      sent: number;
      accepted: number;
      declined: number;
      expired: number;
    };
  };
  recentAudits: Array<{
    id: string;
    action: string;
    actorEmail: string;
    reason: string | null;
    createdAt: Date;
  }>;
}

/**
 * Loads detailed account profile, business settings, document breakdown,
 * and recent audit logs for an identified user (AGENTS.md §3.7, M7-T03).
 */
export async function getAdminUserDetail(
  userId: string
): Promise<AdminUserDetail | null> {
  await requireAdmin();
  await dbConnect();

  const [dbUser, business, quotations, recentAudits] =
    await Promise.all([
      User.findById(userId).lean(),
      Business.findOne({ userId }).lean(),
      Quotation.find({ userId }).select('status validUntil').lean(),
      AdminAuditLog.find({ targetUserId: userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

  if (!dbUser) {
    return null;
  }

  // Calculate invoice counts (deprecated)
  const now = new Date();
  const invDraft = 0;
  const invSent = 0;
  const invPaid = 0;
  const invOverdue = 0;
  const invCancelled = 0;

  // Calculate quotation counts
  let quoDraft = 0;
  let quoSent = 0;
  let quoAccepted = 0;
  let quoDeclined = 0;
  let quoExpired = 0;

  for (const quo of quotations) {
    if (quo.status === 'ACCEPTED') quoAccepted++;
    else if (quo.status === 'DECLINED') quoDeclined++;
    else if (quo.status === 'EXPIRED' || (quo.validUntil && new Date(quo.validUntil) < now)) {
      quoExpired++;
    } else if (quo.status === 'SENT') quoSent++;
    else if (quo.status === 'DRAFT') quoDraft++;
  }

  return {
    user: {
      id: dbUser._id.toString(),
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role || 'USER',
      suspendedAt: dbUser.suspendedAt || null,
      suspendedReason: dbUser.suspendedReason || null,
      suspendedByUserId: dbUser.suspendedByUserId || null,
      deletionRequestedAt: dbUser.deletionRequestedAt || null,
      publicLinksDisabledAt: dbUser.publicLinksDisabledAt || null,
      mfaEnabled: Boolean(dbUser.mfaEnabledAt),
      mfaEnabledAt: dbUser.mfaEnabledAt || null,
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
      lastLoginAt: dbUser.lastLoginAt || null,
      lastActiveAt: dbUser.lastActiveAt || null,
    },
    business: business
      ? {
          businessName: business.businessName,
          address: business.address || '',
          email: business.email || '',
          phone: business.phone || '',
          logoUrl: business.logoUrl || null,
          createdAt: business.createdAt,
        }
      : null,
    counts: {
      invoices: {
        total: 0,
        draft: invDraft,
        sent: invSent,
        paid: invPaid,
        overdue: invOverdue,
        cancelled: invCancelled,
      },
      quotations: {
        total: quotations.length,
        draft: quoDraft,
        sent: quoSent,
        accepted: quoAccepted,
        declined: quoDeclined,
        expired: quoExpired,
      },
    },
    recentAudits: recentAudits.map((a) => ({
      id: a._id.toString(),
      action: a.action,
      actorEmail: a.actorEmail,
      reason: a.reason || null,
      createdAt: a.createdAt,
    })),
  };
}

export interface AdminUserDocumentListItem {
  id: string;
  number: string;
  kind: 'invoice' | 'quotation';
  customerName: string;
  issueDate: Date;
  dueDateOrValidUntil: Date | null;
  status: string;
  totalCentavos: number;
  publicToken: string;
  createdAt: Date;
}

/**
 * Loads all invoices and quotations for an identified user (AGENTS.md §3.7, M7-T03).
 */
export async function getAdminUserDocuments(
  userId: string
): Promise<{ user: { id: string; name: string; email: string }; documents: AdminUserDocumentListItem[] } | null> {
  await requireAdmin();
  await dbConnect();

  const user = await User.findById(userId).select('_id name email').lean();
  if (!user) {
    return null;
  }

  const quotations = await Quotation.find({ userId }).sort({ createdAt: -1 }).lean();

  // Collect customer IDs for documents without snapshot names
  const customerIds = new Set<string>();
  for (const quo of quotations) {
    if (!quo.customerSnapshot?.name && quo.customerId) {
      customerIds.add(quo.customerId.toString());
    }
  }

  const customerMap = new Map<string, string>();
  if (customerIds.size > 0) {
    const customers = await Customer.find({ _id: { $in: Array.from(customerIds) } })
      .select('_id name')
      .lean();
    for (const c of customers) {
      customerMap.set(c._id.toString(), c.name);
    }
  }

  const docList: AdminUserDocumentListItem[] = [];

  for (const quo of quotations) {
    const cust = quo.customerSnapshot as { name?: string } | undefined;
    const customerName = cust?.name || customerMap.get(quo.customerId?.toString()) || '—';
    docList.push({
      id: quo._id.toString(),
      number: quo.number,
      kind: 'quotation',
      customerName,
      issueDate: quo.issueDate,
      dueDateOrValidUntil: quo.validUntil || null,
      status: quo.status,
      totalCentavos: quo.totalCentavos,
      publicToken: quo.publicToken || '',
      createdAt: quo.createdAt,
    });
  }

  // Sort unified documents newest first
  docList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
    },
    documents: docList,
  };
}

export interface AdminDocumentDetail {
  id: string;
  kind: 'invoice' | 'quotation';
  number: string;
  status: string;
  issueDate: Date;
  dueDateOrValidUntil: Date | null;
  paidAt?: Date | null;
  userId: string;
  business: {
    businessName: string;
    address: string;
    email: string;
    phone: string;
    logoUrl: string | null;
  };
  customer: {
    name: string;
    company?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPriceCentavos: number;
    amountCentavos: number;
  }>;
  subtotalCentavos: number;
  discountCentavos: number;
  totalCentavos: number;
  notes?: string;
  terms?: string;
  publicToken: string;
  publicTokenRevokedAt?: Date | null;
  createdAt: Date;
}

/**
 * Loads full document content for platform staff inspection (AGENTS.md §3.7, M7-T03).
 * Crucially, displays document content even if public link is revoked or disabled.
 */
export async function getAdminDocument(
  kind: 'invoice' | 'quotation',
  id: string
): Promise<AdminDocumentDetail | null> {
  await requireAdmin();
  await dbConnect();

  if (kind === 'invoice') {
    return null;
  }

  if (kind === 'quotation') {
    const quotation = await Quotation.findById(id).lean();
    if (!quotation) return null;

    let bSnap = quotation.businessSnapshot as Record<string, unknown> | undefined;
    if (!bSnap?.businessName) {
      const liveBiz = await Business.findOne({ userId: quotation.userId }).lean();
      if (liveBiz) {
        bSnap = liveBiz as unknown as Record<string, unknown>;
      }
    }

    let cSnap = quotation.customerSnapshot as Record<string, unknown> | undefined;
    if (!cSnap?.name && quotation.customerId) {
      const liveCust = await Customer.findById(quotation.customerId).lean();
      if (liveCust) {
        cSnap = liveCust as unknown as Record<string, unknown>;
      }
    }

    return {
      id: quotation._id.toString(),
      kind: 'quotation',
      number: quotation.number,
      status: quotation.status,
      issueDate: quotation.issueDate,
      dueDateOrValidUntil: quotation.validUntil || null,
      userId: quotation.userId.toString(),
      business: {
        businessName: (bSnap?.businessName as string) || '—',
        address: (bSnap?.address as string) || '',
        email: (bSnap?.email as string) || '',
        phone: (bSnap?.phone as string) || '',
        logoUrl: (bSnap?.logoUrl as string) || null,
      },
      customer: {
        name: (cSnap?.name as string) || '—',
        company: (cSnap?.company as string) || undefined,
        email: (cSnap?.email as string) || undefined,
        phone: (cSnap?.phone as string) || undefined,
        address: (cSnap?.address as string) || undefined,
      },
      items: quotation.items.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unitPriceCentavos: it.unitPriceCentavos,
        amountCentavos: it.amountCentavos,
      })),
      subtotalCentavos: quotation.subtotalCentavos,
      discountCentavos: quotation.discountCentavos,
      totalCentavos: quotation.totalCentavos,
      notes: quotation.notes,
      terms: quotation.terms,
      publicToken: quotation.publicToken || '',
      publicTokenRevokedAt: quotation.publicTokenRevokedAt || null,
      createdAt: quotation.createdAt,
    };
  }

  return null;
}

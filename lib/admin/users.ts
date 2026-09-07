import dbConnect from '../mongodb.ts';
import { User } from '../../models/user.ts';
import { Business } from '../../models/business.ts';
import { Invoice } from '../../models/invoice.ts';
import { Quotation } from '../../models/quotation.ts';
import { requireAdmin } from './guard.ts';


export interface GetAdminUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  plan?: 'FREE' | 'FREELANCER' | 'BUSINESS' | 'ALL';
  status?: 'ACTIVE' | 'SUSPENDED' | 'DELETION' | 'ALL';
  activeIn30Days?: boolean;
}

export interface AdminUserListItem {
  id: string;
  name: string;
  email: string;
  businessName: string;
  plan: 'FREE' | 'FREELANCER' | 'BUSINESS';
  planSource: 'DEFAULT' | 'BILLING' | 'ADMIN';
  isPlanOverridden: boolean;
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
  plan?: string;
  status?: string;
  activeIn30Days?: boolean;
  matchingBusinessUserIds?: unknown[];
}): Record<string, unknown> {
  const conditions: Record<string, unknown>[] = [];

  // Plan filter
  if (params.plan && params.plan !== 'ALL') {
    conditions.push({ plan: params.plan });
  }

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
    plan: params.plan,
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
        '_id name email role plan planSource planOverrideExpiresAt suspendedAt deletionRequestedAt createdAt lastLoginAt lastActiveAt'
      )
      .lean(),
  ]);

  const userIds = rawUsers.map((u) => u._id);

  // Fetch associated business names and document counts in batch parallel queries
  const [businesses, invoiceCounts, quotationCounts] = await Promise.all([
    Business.find({ userId: { $in: userIds } })
      .select('userId businessName')
      .lean(),
    Invoice.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]),
    Quotation.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]),
  ]);

  const businessMap = new Map<string, string>();
  for (const b of businesses) {
    businessMap.set(b.userId.toString(), b.businessName);
  }

  const invoiceMap = new Map<string, number>();
  for (const inv of invoiceCounts) {
    invoiceMap.set(inv._id.toString(), inv.count);
  }

  const quotationMap = new Map<string, number>();
  for (const quo of quotationCounts) {
    quotationMap.set(quo._id.toString(), quo.count);
  }

  const users: AdminUserListItem[] = rawUsers.map((u) => {
    const uid = u._id.toString();
    const invCount = invoiceMap.get(uid) || 0;
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
      plan: u.plan || 'FREE',
      planSource: u.planSource || 'DEFAULT',
      isPlanOverridden: u.planSource === 'ADMIN',
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

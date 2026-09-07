import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/guard';
import { recordAudit } from '@/lib/admin/audit';
import { getAdminUserDetail } from '@/lib/admin/users';
import { formatDate } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'User Detail · Bilyo Admin',
  description: 'Inspect user profile, business setup, plan configuration, and document breakdown.',
};

interface AdminUserDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminUserDetailPage({
  params,
}: AdminUserDetailPageProps) {
  await requireAdmin();
  const { id } = await params;

  const data = await getAdminUserDetail(id);
  if (!data) {
    notFound();
  }

  // AGENTS.md §3.7: Every view of an identified user's data appends an audit log entry
  await recordAudit({
    action: 'USER_VIEW',
    targetUserId: id,
    targetType: 'User',
    targetId: id,
    reason: `Viewed account detail for ${data.user.email}`,
  });

  const { user, business, counts, recentAudits } = data;

  return (
    <div className="space-y-6">
      {/* Navigation and Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/admin/users"
            className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors mb-2"
          >
            <svg
              className="w-3.5 h-3.5 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to User Management
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {user.name}
            </h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                user.role === 'ADMIN'
                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {user.role}
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                user.suspendedAt
                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                  : user.deletionRequestedAt
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              {user.suspendedAt
                ? 'SUSPENDED'
                : user.deletionRequestedAt
                  ? 'DELETION PENDING'
                  : 'ACTIVE'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1 font-mono">{user.email}</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/admin/users/${id}/documents`}
            className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors"
          >
            <svg
              className="w-4 h-4 mr-2 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            View Documents ({counts.invoices.total + counts.quotations.total})
          </Link>
        </div>
      </div>

      {/* Suspension / Deletion Alerts */}
      {user.suspendedAt && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-3">
          <svg
            className="w-5 h-5 text-rose-600 shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div className="text-sm text-rose-800">
            <span className="font-semibold">Account Suspended:</span> Suspended on{' '}
            {formatDate(user.suspendedAt)}.
            {user.suspendedReason && (
              <p className="mt-1 text-rose-700">
                Reason: &ldquo;{user.suspendedReason}&rdquo;
              </p>
            )}
          </div>
        </div>
      )}

      {user.deletionRequestedAt && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
          <svg
            className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="text-sm text-amber-800">
            <span className="font-semibold">Deletion Requested:</span> User requested
            account deletion on {formatDate(user.deletionRequestedAt)}.
          </div>
        </div>
      )}

      {/* Read-only Invariant Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span>
            <strong>Read-Only Inspection:</strong> Platform staff view. User records,
            profile, and business settings cannot be mutated from this page.
          </span>
        </div>
        <span className="text-slate-400 font-mono text-[11px]">ID: {user.id}</span>
      </div>

      {/* 2-column Grid: User & Business Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Account Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <svg
              className="w-5 h-5 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <h2 className="font-semibold text-slate-900">User Account</h2>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium text-slate-500">Full Name</dt>
              <dd className="font-medium text-slate-900 mt-0.5">{user.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Email Address</dt>
              <dd className="font-medium text-slate-900 mt-0.5 font-mono text-xs">
                {user.email}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">MFA Status</dt>
              <dd className="font-medium text-slate-900 mt-0.5 flex items-center gap-1.5">
                {user.mfaEnabled ? (
                  <>
                    <svg
                      className="w-4 h-4 text-emerald-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="text-emerald-700">
                      Enrolled{' '}
                      {user.mfaEnabledAt
                        ? `(${formatDate(user.mfaEnabledAt)})`
                        : ''}
                    </span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4 text-amber-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="text-amber-700">Pending Setup</span>
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Signed Up</dt>
              <dd className="font-medium text-slate-900 mt-0.5">
                {formatDate(user.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Last Login</dt>
              <dd className="font-medium text-slate-900 mt-0.5">
                {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Last Active</dt>
              <dd className="font-medium text-slate-900 mt-0.5">
                {user.lastActiveAt ? formatDate(user.lastActiveAt) : 'None recorded'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Business Profile Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <svg
              className="w-5 h-5 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <h2 className="font-semibold text-slate-900">Business Profile</h2>
          </div>

          {business ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500">Business Name</dt>
                <dd className="font-medium text-slate-900 mt-0.5 text-base">
                  {business.businessName}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500">Address</dt>
                <dd className="text-slate-700 mt-0.5">
                  {business.address || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Email</dt>
                <dd className="text-slate-700 mt-0.5 font-mono text-xs">
                  {business.email || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Phone</dt>
                <dd className="text-slate-700 mt-0.5">
                  {business.phone || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">TIN</dt>
                <dd className="text-slate-700 mt-0.5 font-mono text-xs">
                  {business.tin || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">VAT Registered</dt>
                <dd className="mt-0.5">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      business.vatRegistered
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {business.vatRegistered ? 'VAT Registered (12%)' : 'Non-VAT'}
                  </span>
                </dd>
              </div>
            </dl>
          ) : (
            <div className="py-6 text-center text-sm text-slate-500">
              User has not configured a business profile yet.
            </div>
          )}
        </div>
      </div>

      {/* Plan & Subscription Configuration */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <svg
            className="w-5 h-5 text-slate-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <h2 className="font-semibold text-slate-900">Subscription & Plan Status</h2>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-xs font-medium text-slate-500">Assigned Plan</dt>
            <dd className="mt-1">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold ${
                  user.plan === 'BUSINESS'
                    ? 'bg-indigo-100 text-indigo-800'
                    : user.plan === 'FREELANCER'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-800'
                }`}
              >
                {user.plan}
              </span>
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium text-slate-500">Plan Origin / Source</dt>
            <dd className="mt-1 text-slate-800 font-medium flex items-center gap-1.5">
              <span>{user.planSource}</span>
              {user.isPlanOverridden && (
                <span className="text-[10px] font-semibold tracking-wide bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">
                  ADMIN OVERRIDE
                </span>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium text-slate-500">Override Expiration</dt>
            <dd className="mt-1 text-slate-700">
              {user.planOverrideExpiresAt
                ? formatDate(user.planOverrideExpiresAt)
                : 'Permanent / None'}
            </dd>
          </div>

          {user.planOverrideReason && (
            <div className="sm:col-span-3 bg-purple-50 p-3 rounded border border-purple-200 text-xs text-purple-900">
              <span className="font-semibold">Override Reason:</span>{' '}
              {user.planOverrideReason}
            </div>
          )}

          {user.billingCustomerId && (
            <div className="sm:col-span-3 text-xs text-slate-500">
              Billing Customer Reference:{' '}
              <span className="font-mono text-slate-700">
                {user.billingCustomerId}
              </span>
            </div>
          )}
        </dl>
      </div>

      {/* Document Metrics Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoices Breakdown */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h2 className="font-semibold text-slate-900">Invoices</h2>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {counts.invoices.total} Total
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 text-center">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-500 font-medium">Draft</span>
              <p className="text-lg font-bold text-slate-700 mt-1">
                {counts.invoices.draft}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-100">
              <span className="text-xs text-blue-600 font-medium">Sent</span>
              <p className="text-lg font-bold text-blue-800 mt-1">
                {counts.invoices.sent}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
              <span className="text-xs text-emerald-600 font-medium">Paid</span>
              <p className="text-lg font-bold text-emerald-800 mt-1">
                {counts.invoices.paid}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-100">
              <span className="text-xs text-rose-600 font-medium">Overdue</span>
              <p className="text-lg font-bold text-rose-800 mt-1">
                {counts.invoices.overdue}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-400 font-medium">Cancelled</span>
              <p className="text-lg font-bold text-slate-500 mt-1">
                {counts.invoices.cancelled}
              </p>
            </div>
          </div>
        </div>

        {/* Quotations Breakdown */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h2 className="font-semibold text-slate-900">Quotations</h2>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              {counts.quotations.total} Total
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 text-center">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-500 font-medium">Draft</span>
              <p className="text-lg font-bold text-slate-700 mt-1">
                {counts.quotations.draft}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-100">
              <span className="text-xs text-blue-600 font-medium">Sent</span>
              <p className="text-lg font-bold text-blue-800 mt-1">
                {counts.quotations.sent}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
              <span className="text-xs text-emerald-600 font-medium">Accepted</span>
              <p className="text-lg font-bold text-emerald-800 mt-1">
                {counts.quotations.accepted}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-100">
              <span className="text-xs text-rose-600 font-medium">Declined</span>
              <p className="text-lg font-bold text-rose-800 mt-1">
                {counts.quotations.declined}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-400 font-medium">Expired</span>
              <p className="text-lg font-bold text-slate-500 mt-1">
                {counts.quotations.expired}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Staff Audit History */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-slate-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <h2 className="font-semibold text-slate-900">
              Recent Staff Audit Activity
            </h2>
          </div>
          <span className="text-xs text-slate-500">Last 10 platform actions</span>
        </div>

        {recentAudits.length === 0 ? (
          <p className="text-sm text-slate-500 py-3">
            No audit log entries recorded for this account yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">
                    Timestamp
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">
                    Action
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">
                    Actor
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">
                    Reason / Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentAudits.map((audit) => (
                  <tr key={audit.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 whitespace-nowrap text-slate-500 font-mono">
                      {formatDate(audit.createdAt)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium text-slate-800">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[11px]">
                        {audit.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                      {audit.actorEmail}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {audit.reason || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

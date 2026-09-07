import React from 'react';
import Link from 'next/link';
import { requireUser } from '@/lib/auth-guards';
import { getDashboardMetrics, getRecentInvoices } from '@/lib/metrics';
import { formatMoney } from '@/lib/money';
import { RecentDocuments } from '@/components/dashboard/RecentDocuments';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard · Bilyo',
  description: 'Track revenue, outstanding payments, overdue invoices, and recent activity.',
};

export default async function DashboardPage() {
  const user = await requireUser();
  const metrics = await getDashboardMetrics(user.id);

  const hasInvoices = metrics.totalInvoiceCount > 0;
  const recentInvoices = hasInvoices ? await getRecentInvoices(user.id, 5) : [];

  return (
    <div className="py-6 px-4 sm:px-6 max-w-6xl mx-auto space-y-8">
      {/* Header with quick actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
            Dashboard
          </h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Track revenue, outstanding balances, and recent billing activity.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/quotations/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-[var(--color-line)] bg-white text-[var(--color-text)] hover:bg-[var(--color-paper-sunk)] transition-colors shadow-xs"
          >
            <svg className="w-4 h-4 text-[var(--color-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Quotation
          </Link>
          <Link
            href="/dashboard/invoices/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg text-white bg-[var(--color-brass)] hover:opacity-90 transition-opacity shadow-xs"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Invoice
          </Link>
        </div>
      </div>

      {/* When no invoices exist yet: guided empty state with clear CTA (M5-T02 requirement) */}
      {!hasInvoices ? (
        <div className="bg-white border border-[var(--color-line)] rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-xs space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-[var(--color-brass-wash)] flex items-center justify-center text-[var(--color-brass)]">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">No documents issued yet</h2>
            <p className="text-xs text-[var(--color-muted)] max-w-sm mx-auto">
              Ready to bill someone? Create your first quotation or invoice to get started.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/dashboard/quotations/new"
              className="w-full sm:w-auto px-5 py-2.5 bg-[var(--color-brass)] hover:opacity-90 text-white font-medium text-sm rounded-lg transition-opacity"
            >
              Create your first quotation
            </Link>
            <Link
              href="/dashboard/invoices/new"
              className="w-full sm:w-auto px-5 py-2.5 bg-[var(--color-paper-sunk)] hover:bg-[var(--color-line)] text-[var(--color-text)] font-medium text-sm rounded-lg transition-colors"
            >
              Create invoice
            </Link>
          </div>
        </div>
      ) : (
        /* 4 Key Metrics Cards (M5-T01) */
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Revenue this month */}
            <div className="bg-white border border-[var(--color-line)] rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-[var(--color-muted)]">
                  <span>Revenue this month</span>
                  <span className="p-1.5 rounded-md bg-emerald-50 text-emerald-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                </div>
                <div className="mt-3 text-2xl font-bold font-mono tracking-tight text-[var(--color-text)]">
                  {formatMoney(metrics.currentMonthRevenueCentavos)}
                </div>
              </div>
              <div className="mt-3 text-xs text-[var(--color-muted)]">
                {metrics.currentMonthPaidCount}{' '}
                {metrics.currentMonthPaidCount === 1 ? 'invoice' : 'invoices'} paid this month
              </div>
            </div>

            {/* Card 2: Outstanding */}
            <div className="bg-white border border-[var(--color-line)] rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-[var(--color-muted)]">
                  <span>Outstanding</span>
                  <span className="p-1.5 rounded-md bg-blue-50 text-blue-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                </div>
                <div className="mt-3 text-2xl font-bold font-mono tracking-tight text-[var(--color-text)]">
                  {formatMoney(metrics.outstandingCentavos)}
                </div>
              </div>
              <div className="mt-3 text-xs text-[var(--color-muted)]">
                {metrics.outstandingCount}{' '}
                {metrics.outstandingCount === 1 ? 'invoice' : 'invoices'} awaiting payment
              </div>
            </div>

            {/* Card 3: Overdue (§5.4 derived) */}
            <div
              className={`rounded-xl p-5 shadow-xs flex flex-col justify-between border ${
                metrics.overdueCount > 0
                  ? 'bg-rose-50/40 border-rose-200'
                  : 'bg-white border-[var(--color-line)]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-[var(--color-muted)]">
                  <span className={metrics.overdueCount > 0 ? 'text-rose-700 font-semibold' : ''}>
                    Overdue
                  </span>
                  <span
                    className={`p-1.5 rounded-md ${
                      metrics.overdueCount > 0
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </span>
                </div>
                <div
                  className={`mt-3 text-2xl font-bold font-mono tracking-tight ${
                    metrics.overdueCount > 0
                      ? 'text-rose-700'
                      : 'text-[var(--color-text)]'
                  }`}
                >
                  {formatMoney(metrics.overdueCentavos)}
                </div>
              </div>
              <div
                className={`mt-3 text-xs ${
                  metrics.overdueCount > 0
                    ? 'text-rose-600 font-medium'
                    : 'text-[var(--color-muted)]'
                }`}
              >
                {metrics.overdueCount > 0
                  ? `${metrics.overdueCount} ${metrics.overdueCount === 1 ? 'invoice' : 'invoices'} past due date`
                  : 'Zero overdue invoices'}
              </div>
            </div>

            {/* Card 4: Total Paid (All Time) */}
            <div className="bg-white border border-[var(--color-line)] rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-[var(--color-muted)]">
                  <span>Total Collected</span>
                  <span className="p-1.5 rounded-md bg-[var(--color-brass-wash)] text-[var(--color-brass)]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                </div>
                <div className="mt-3 text-2xl font-bold font-mono tracking-tight text-[var(--color-text)]">
                  {formatMoney(metrics.paidCentavos)}
                </div>
              </div>
              <div className="mt-3 text-xs text-[var(--color-muted)]">
                {metrics.paidCount}{' '}
                {metrics.paidCount === 1 ? 'invoice' : 'invoices'} paid all-time
              </div>
            </div>
          </div>

          {/* Draft banner / notice if any drafts exist */}
          {metrics.draftCount > 0 && (
            <div className="bg-[var(--color-paper-sunk)] border border-[var(--color-line)] rounded-xl p-4 flex items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-2.5 text-[var(--color-text)]">
                <span className="w-2 h-2 rounded-full bg-[var(--color-brass)]" />
                <span>
                  You have <strong>{metrics.draftCount}</strong> draft{' '}
                  {metrics.draftCount === 1 ? 'invoice' : 'invoices'} totaling{' '}
                  <strong>{formatMoney(metrics.draftCentavos)}</strong>.
                </span>
              </div>
              <Link
                href="/dashboard/invoices"
                className="font-medium text-[var(--color-brass)] hover:underline whitespace-nowrap"
              >
                View drafts →
              </Link>
            </div>
          )}

          {/* Recent Invoices list / activity feed (M5-T02) */}
          <RecentDocuments invoices={recentInvoices} />

          {/* Fast Navigation links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <Link
              href="/dashboard/invoices"
              className="bg-white border border-[var(--color-line)] hover:border-[var(--color-brass)]/60 rounded-xl p-4 transition-colors shadow-xs group"
            >
              <div className="font-semibold text-sm text-[var(--color-text)] group-hover:text-[var(--color-brass)] transition-colors">
                Manage Invoices →
              </div>
              <div className="text-xs text-[var(--color-muted)] mt-1">
                View all issued invoices, mark payments, and track statuses.
              </div>
            </Link>

            <Link
              href="/dashboard/quotations"
              className="bg-white border border-[var(--color-line)] hover:border-[var(--color-brass)]/60 rounded-xl p-4 transition-colors shadow-xs group"
            >
              <div className="font-semibold text-sm text-[var(--color-text)] group-hover:text-[var(--color-brass)] transition-colors">
                Manage Quotations →
              </div>
              <div className="text-xs text-[var(--color-muted)] mt-1">
                Send proposals, track customer approvals, and convert to invoices.
              </div>
            </Link>

            <Link
              href="/dashboard/customers"
              className="bg-white border border-[var(--color-line)] hover:border-[var(--color-brass)]/60 rounded-xl p-4 transition-colors shadow-xs group"
            >
              <div className="font-semibold text-sm text-[var(--color-text)] group-hover:text-[var(--color-brass)] transition-colors">
                Customer Directory →
              </div>
              <div className="text-xs text-[var(--color-muted)] mt-1">
                Maintain client details, addresses, and TIN for billing.
              </div>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

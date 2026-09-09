import React from 'react';
import Link from 'next/link';
import { requireUser } from '@/lib/auth-guards';
import { getDashboardMetrics, getRecentQuotations, getNeedsAttentionData } from '@/lib/metrics';
import { formatMoney } from '@/lib/money';
import { RecentDocuments } from '@/components/dashboard/RecentDocuments';
import { NeedsAttention } from '@/components/dashboard/NeedsAttention';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard · Bilyo',
  description: 'Track quotations, acceptances, and recent client activity.',
};

export default async function DashboardPage() {
  const user = await requireUser();
  const [metrics, attentionData] = await Promise.all([
    getDashboardMetrics(user.id),
    getNeedsAttentionData(user.id),
  ]);

  const hasQuotations = metrics.totalQuotationCount > 0;
  const recentQuotations = hasQuotations ? await getRecentQuotations(user.id, 5) : [];

  return (
    <div className="py-6 px-4 sm:px-6 max-w-6xl mx-auto space-y-6">
      {/* Needs your attention: client activities requiring review (§12, P3-T04) */}
      <NeedsAttention data={attentionData} />

      {/* Header with quick actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
            Dashboard
          </h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Track quotations, client acceptances, and sales pipeline.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/quotations/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg text-white bg-[var(--color-brass)] hover:opacity-90 transition-opacity shadow-xs"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Quotation
          </Link>
        </div>
      </div>

      {/* When no quotations exist yet: guided empty state */}
      {!hasQuotations ? (
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
            <h2 className="text-lg font-semibold text-[var(--color-text)]">No quotations created yet</h2>
            <p className="text-xs text-[var(--color-muted)] max-w-sm mx-auto">
              Ready to send a quote? Create your first quotation to get started.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-center">
            <Link
              href="/dashboard/quotations/new"
              className="px-5 py-2.5 bg-[var(--color-brass)] hover:opacity-90 text-white font-medium text-sm rounded-lg transition-opacity"
            >
              Create your first quotation
            </Link>
          </div>
        </div>
      ) : (
        /* Summary Metric Cards */
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Quoted */}
            <div className="bg-white border border-[var(--color-line)] rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-[var(--color-muted)]">
                  <span>Total Quoted</span>
                  <span className="p-1.5 rounded-md bg-blue-50 text-blue-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </span>
                </div>
                <div className="mt-3 text-2xl font-bold font-mono tracking-tight text-[var(--color-text)]">
                  {formatMoney(metrics.totalQuotedCentavos)}
                </div>
              </div>
              <div className="mt-3 text-xs text-[var(--color-muted)]">
                {metrics.sentCount} awaiting client response
              </div>
            </div>

            {/* Card 2: Accepted */}
            <div className="bg-white border border-[var(--color-line)] rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-[var(--color-muted)]">
                  <span>Accepted Value</span>
                  <span className="p-1.5 rounded-md bg-emerald-50 text-emerald-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                </div>
                <div className="mt-3 text-2xl font-bold font-mono tracking-tight text-[var(--color-text)]">
                  {formatMoney(metrics.acceptedCentavos)}
                </div>
              </div>
              <div className="mt-3 text-xs text-[var(--color-muted)]">
                {metrics.acceptedCount} confirmed {metrics.acceptedCount === 1 ? 'sale' : 'sales'}
              </div>
            </div>

            {/* Card 3: Drafts */}
            <div className="bg-white border border-[var(--color-line)] rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-[var(--color-muted)]">
                  <span>Drafts</span>
                  <span className="p-1.5 rounded-md bg-neutral-100 text-neutral-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </span>
                </div>
                <div className="mt-3 text-2xl font-bold font-mono tracking-tight text-[var(--color-text)]">
                  {metrics.draftCount}
                </div>
              </div>
              <div className="mt-3 text-xs text-[var(--color-muted)]">
                Unsent proposals
              </div>
            </div>

            {/* Card 4: Total Quotes */}
            <div className="bg-white border border-[var(--color-line)] rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-[var(--color-muted)]">
                  <span>Total Proposals</span>
                  <span className="p-1.5 rounded-md bg-[var(--color-brass-wash)] text-[var(--color-brass)]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </span>
                </div>
                <div className="mt-3 text-2xl font-bold font-mono tracking-tight text-[var(--color-text)]">
                  {metrics.totalQuotationCount}
                </div>
              </div>
              <div className="mt-3 text-xs text-[var(--color-muted)]">
                All-time quotations
              </div>
            </div>
          </div>

          {/* Recent Quotations list */}
          <RecentDocuments quotations={recentQuotations} />

          {/* Fast Navigation links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <Link
              href="/dashboard/quotations"
              className="bg-white border border-[var(--color-line)] hover:border-[var(--color-brass)]/60 rounded-xl p-4 transition-colors shadow-xs group"
            >
              <div className="font-semibold text-sm text-[var(--color-text)] group-hover:text-[var(--color-brass)] transition-colors">
                Manage Quotations →
              </div>
              <div className="text-xs text-[var(--color-muted)] mt-1">
                Send proposals and track client acceptances.
              </div>
            </Link>

            <Link
              href="/dashboard/customers"
              className="bg-white border border-[var(--color-line)] hover:border-[var(--color-brass)]/60 rounded-xl p-4 transition-colors shadow-xs group"
            >
              <div className="font-semibold text-sm text-[var(--color-text)] group-hover:text-[var(--color-brass)] transition-colors">
                Client Directory →
              </div>
              <div className="text-xs text-[var(--color-muted)] mt-1">
                Maintain client contact details and address book.
              </div>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { formatMoney } from '@/lib/money';
import type { DashboardMetrics } from '@/lib/metrics';

interface StatTilesProps {
  metrics: DashboardMetrics;
  currency?: string;
}

export function StatTiles({ metrics, currency = 'PHP' }: StatTilesProps) {
  const { quotedThisMonth, acceptedThisMonth, awaitingResponse } = metrics;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Tile 1: Quoted this month */}
      <div className="bg-white border border-[var(--color-line)] rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-neutral-300 transition-colors">
        <div>
          <div className="flex items-center justify-between text-xs font-medium text-[var(--color-muted)]">
            <span>Quoted this month</span>
            <span className="p-1.5 rounded-md bg-blue-50 text-blue-600">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </span>
          </div>
          <div className="mt-3 text-2xl font-bold font-mono tracking-tight text-[var(--color-text)]">
            {formatMoney(quotedThisMonth.totalCentavos, currency)}
          </div>
        </div>
        <div className="mt-3 text-xs text-[var(--color-muted)]">
          {quotedThisMonth.count} {quotedThisMonth.count === 1 ? 'quote' : 'quotes'} sent this month
        </div>
      </div>

      {/* Tile 2: Accepted this month */}
      <div className="bg-white border border-[var(--color-line)] rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-neutral-300 transition-colors">
        <div>
          <div className="flex items-center justify-between text-xs font-medium text-[var(--color-muted)]">
            <span>Accepted this month</span>
            <span className="p-1.5 rounded-md bg-emerald-50 text-emerald-600">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </span>
          </div>
          <div className="mt-3 text-2xl font-bold font-mono tracking-tight text-emerald-950">
            {formatMoney(acceptedThisMonth.totalCentavos, currency)}
          </div>
        </div>
        <div className="mt-3 text-xs text-[var(--color-muted)]">
          {acceptedThisMonth.count} confirmed {acceptedThisMonth.count === 1 ? 'sale' : 'sales'}
        </div>
      </div>

      {/* Tile 3: Awaiting response */}
      <div className="bg-white border border-[var(--color-line)] rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-neutral-300 transition-colors">
        <div>
          <div className="flex items-center justify-between text-xs font-medium text-[var(--color-muted)]">
            <span>Awaiting response</span>
            <span className="p-1.5 rounded-md bg-amber-50 text-amber-600">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </span>
          </div>
          <div className="mt-3 text-2xl font-bold font-mono tracking-tight text-[var(--color-text)]">
            {awaitingResponse.count}
          </div>
        </div>
        <div className="mt-3 text-xs text-[var(--color-muted)]">
          Unanswered, active proposals
        </div>
      </div>

      {/* Tile 4: Potential value */}
      <div className="bg-white border border-[var(--color-line)] rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-neutral-300 transition-colors">
        <div>
          <div className="flex items-center justify-between text-xs font-medium text-[var(--color-muted)]">
            <span>Potential value</span>
            <span className="p-1.5 rounded-md bg-[var(--color-brass-wash)] text-[var(--color-brass)]">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </span>
          </div>
          <div className="mt-3 text-2xl font-bold font-mono tracking-tight text-[var(--color-text)]">
            {formatMoney(awaitingResponse.totalCentavos, currency)}
          </div>
        </div>
        <div className="mt-3 text-xs text-[var(--color-muted)]">
          In active negotiation pipeline
        </div>
      </div>
    </div>
  );
}

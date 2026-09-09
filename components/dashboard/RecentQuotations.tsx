'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import { getStatusBadgeConfig, type DocumentStatus } from '@/lib/documents';
import type { RecentQuotationItem } from '@/lib/metrics';

export interface RecentQuotationsProps {
  quotations: RecentQuotationItem[];
}

const STATUS_CHIPS = [
  { value: 'ALL', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'VIEWED', label: 'Viewed' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'EXPIRED', label: 'Expired' },
] as const;

export function RecentQuotations({ quotations }: RecentQuotationsProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const filteredQuotations = useMemo(() => {
    if (selectedStatus === 'ALL') {
      return quotations;
    }
    return quotations.filter((q) => q.status === selectedStatus);
  }, [quotations, selectedStatus]);

  return (
    <div className="bg-white border border-[var(--color-line)] rounded-xl shadow-xs overflow-hidden">
      {/* Header and status filter toolbar (§12, P4-T02) */}
      <div className="px-5 py-4 border-b border-[var(--color-line-soft)] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text)]">Recent Quotations</h2>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              Filter proposals by status without leaving the dashboard.
            </p>
          </div>
          <Link
            href="/dashboard/quotations"
            className="text-xs font-semibold text-[var(--color-brass)] hover:underline inline-flex items-center gap-1"
          >
            Manage all quotations →
          </Link>
        </div>

        {/* Status filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {STATUS_CHIPS.map((chip) => {
            const isSelected = selectedStatus === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => setSelectedStatus(chip.value)}
                className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-[var(--color-brass)] text-white shadow-xs'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty State with Create CTA (§12, P4-T02) */}
      {filteredQuotations.length === 0 ? (
        <div className="py-10 px-4 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-[var(--color-brass-wash)] flex items-center justify-center text-[var(--color-brass)]">
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--color-text)]">
              {selectedStatus === 'ALL'
                ? 'No quotations created yet'
                : `No ${selectedStatus.toLowerCase()} quotations found`}
            </p>
            <p className="text-xs text-[var(--color-muted)] max-w-sm mx-auto">
              Create your quotation and send a link for fast client confirmation.
            </p>
          </div>
          <div className="pt-1">
            <Link
              href="/dashboard/quotations/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--color-brass)] hover:opacity-90 text-white font-medium text-xs rounded-lg transition-opacity shadow-xs"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Quotation
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-paper-sunk)] text-xs text-[var(--color-muted)] uppercase tracking-wider border-b border-[var(--color-line-soft)]">
                <tr>
                  <th className="py-3 px-5 font-semibold">Number</th>
                  <th className="py-3 px-5 font-semibold">Client</th>
                  <th className="py-3 px-5 font-semibold">Date</th>
                  <th className="py-3 px-5 font-semibold">Status</th>
                  <th className="py-3 px-5 font-semibold text-right">Amount</th>
                  <th className="py-3 px-5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line-soft)]">
                {filteredQuotations.map((q) => {
                  const badge = getStatusBadgeConfig(q.status as DocumentStatus);
                  return (
                    <tr key={q.id} className="hover:bg-[var(--color-paper)] transition-colors">
                      <td className="py-3.5 px-5 font-semibold text-[var(--color-text)] whitespace-nowrap">
                        <Link
                          href={`/dashboard/quotations/${q.id}`}
                          className="hover:text-[var(--color-brass)] transition-colors"
                        >
                          {q.number}
                        </Link>
                      </td>
                      <td className="py-3.5 px-5 text-[var(--color-text)] truncate max-w-[200px]">
                        {q.customerName}
                      </td>
                      <td className="py-3.5 px-5 text-xs text-[var(--color-muted)] whitespace-nowrap">
                        {formatDate(q.issueDate)}
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-bold text-[var(--color-text)] whitespace-nowrap">
                        {formatMoney(q.totalCentavos)}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <Link
                          href={`/dashboard/quotations/${q.id}`}
                          className="text-xs font-medium text-[var(--color-brass)] hover:underline"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View (usable at 390px) */}
          <div className="sm:hidden divide-y divide-[var(--color-line-soft)]">
            {filteredQuotations.map((q) => {
              const badge = getStatusBadgeConfig(q.status as DocumentStatus);
              return (
                <div key={q.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/dashboard/quotations/${q.id}`}
                      className="font-semibold text-sm text-[var(--color-text)] hover:text-[var(--color-brass)] transition-colors"
                    >
                      {q.number}
                    </Link>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
                    <span className="truncate max-w-[220px] text-[var(--color-text)]">
                      {q.customerName}
                    </span>
                    <span className="font-mono font-bold text-sm text-[var(--color-text)]">
                      {formatMoney(q.totalCentavos)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[var(--color-muted)] pt-1">
                    <span>Issued {formatDate(q.issueDate)}</span>
                    <Link
                      href={`/dashboard/quotations/${q.id}`}
                      className="text-xs font-semibold text-[var(--color-brass)] hover:underline"
                    >
                      View Details →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import { getStatusBadgeConfig, type DocumentStatus } from '@/lib/documents';
import type { RecentQuotationItem } from '@/lib/metrics';

interface RecentDocumentsProps {
  quotations: RecentQuotationItem[];
}

export function RecentDocuments({ quotations }: RecentDocumentsProps) {
  if (quotations.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-[var(--color-line)] rounded-xl shadow-xs overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--color-line-soft)] flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text)]">Recent Quotations</h2>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            Your most recently created and updated quotations.
          </p>
        </div>
        <Link
          href="/dashboard/quotations"
          className="text-xs font-semibold text-[var(--color-brass)] hover:underline flex items-center gap-1"
        >
          View all →
        </Link>
      </div>

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
            {quotations.map((q) => {
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
        {quotations.map((q) => {
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
    </div>
  );
}

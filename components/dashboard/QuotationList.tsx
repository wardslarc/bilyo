'use client';

import React, { useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  getQuotations,
  sendQuotation,
  acceptQuotation,
  declineQuotation,
  convertQuotationToInvoice,
  type SerializedQuotation,
} from '@/actions/quotations';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/dates';

// --- Status helpers ---

type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'DECLINED', label: 'Declined' },
];

function statusBadgeClasses(status: QuotationStatus): string {
  const base = 'inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full';
  switch (status) {
    case 'DRAFT':
      return `${base} bg-neutral-100 text-neutral-600 border border-neutral-200`;
    case 'SENT':
      return `${base} bg-blue-50 text-blue-700 border border-blue-200`;
    case 'ACCEPTED':
      return `${base} bg-emerald-50 text-emerald-700 border border-emerald-200`;
    case 'DECLINED':
      return `${base} bg-red-50 text-red-700 border border-red-200`;
    case 'EXPIRED':
      return `${base} bg-amber-50 text-amber-700 border border-amber-200`;
    default:
      return `${base} bg-neutral-100 text-neutral-600`;
  }
}

/**
 * Derive EXPIRED at read time (§5.4): validUntil < today and status is SENT
 */
function deriveStatus(q: SerializedQuotation): QuotationStatus {
  if (q.status === 'SENT') {
    const validUntil = new Date(q.validUntil);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (validUntil < today) {
      return 'EXPIRED';
    }
  }
  return q.status as QuotationStatus;
}

// --- Props ---

interface QuotationListProps {
  initialQuotations: SerializedQuotation[];
}

// --- Component ---

export function QuotationList({ initialQuotations }: QuotationListProps) {
  const router = useRouter();
  const [quotations, setQuotations] = useState<SerializedQuotation[]>(initialQuotations);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const refreshList = useCallback(
    (newStatus?: string, newSearch?: string) => {
      startTransition(async () => {
        const res = await getQuotations({
          status: newStatus ?? statusFilter,
          search: newSearch ?? search,
        });
        if (res.ok) {
          setQuotations(res.data);
        }
      });
    },
    [statusFilter, search]
  );

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    refreshList(status, search);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    // Debounce-like: refresh on transition
    refreshList(statusFilter, val);
  };

  const handleSend = (id: string) => {
    if (!confirm('Send this quotation? The customer and business details will be locked in.')) return;
    startTransition(async () => {
      const res = await sendQuotation(id);
      if (!res.ok) {
        setActionError(res.error);
        return;
      }
      setActionError(null);
      refreshList();
    });
  };

  const handleAccept = (id: string) => {
    startTransition(async () => {
      const res = await acceptQuotation(id);
      if (!res.ok) {
        setActionError(res.error);
        return;
      }
      setActionError(null);
      refreshList();
    });
  };

  const handleDecline = (id: string) => {
    if (!confirm('Decline this quotation?')) return;
    startTransition(async () => {
      const res = await declineQuotation(id);
      if (!res.ok) {
        setActionError(res.error);
        return;
      }
      setActionError(null);
      refreshList();
    });
  };

  const handleConvert = (id: string) => {
    startTransition(async () => {
      const res = await convertQuotationToInvoice(id);
      if (!res.ok) {
        setActionError(res.error);
        return;
      }
      setActionError(null);
      router.push(`/dashboard/invoices/${res.data.id}`);
    });
  };

  return (
    <div className="space-y-5">
      {/* Action error */}
      {actionError && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {actionError}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status filter pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => handleStatusFilter(f.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                statusFilter === f.value
                  ? 'bg-[var(--color-brass)] text-white'
                  : 'bg-[var(--color-paper-sunk)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <svg
            className="absolute left-3 top-2.5 w-4 h-4 text-[var(--color-faint)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={handleSearch}
            placeholder="Search quotations…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--color-line)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brass)]/40"
          />
        </div>
      </div>

      {/* Quotation list / empty state */}
      {quotations.length === 0 ? (
        <div className="border-2 border-dashed border-[var(--color-line)] rounded-xl py-12 px-6 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[var(--color-brass-wash)] flex items-center justify-center">
            <svg className="w-7 h-7 text-[var(--color-brass)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[var(--color-text)] mb-1">
            {statusFilter === 'ALL' ? 'No quotations yet' : `No ${statusFilter.toLowerCase()} quotations`}
          </p>
          <p className="text-xs text-[var(--color-muted)] mb-5">
            Create your first quotation to start sending proposals to your customers.
          </p>
          <Link
            href="/dashboard/quotations/new"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white bg-[var(--color-brass)] hover:opacity-90 rounded-lg transition-opacity"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Quotation
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {quotations.map((q) => {
            const displayStatus = deriveStatus(q);
            return (
              <div
                key={q.id}
                className={`bg-white border border-[var(--color-line)] rounded-lg p-4 sm:p-5 transition-shadow hover:shadow-sm ${
                  isPending ? 'opacity-60' : ''
                }`}
              >
                {/* Row: number + status + amount */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <Link
                      href={`/dashboard/quotations/${q.id}`}
                      className="text-sm font-semibold text-[var(--color-text)] hover:text-[var(--color-brass)] transition-colors"
                    >
                      {q.number}
                    </Link>
                    <span className={statusBadgeClasses(displayStatus)}>
                      {displayStatus}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-[var(--color-text)]">
                    {formatMoney(q.totalCentavos)}
                  </span>
                </div>

                {/* Details row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-[var(--color-muted)]">
                  <div className="flex items-center gap-3">
                    {q.customerSnapshot && (
                      <span>{q.customerSnapshot.name}</span>
                    )}
                    <span>Issued {formatDate(q.issueDate)}</span>
                    <span>Valid until {formatDate(q.validUntil)}</span>
                  </div>

                  {/* Inline actions */}
                  <div className="flex items-center gap-2 mt-2 sm:mt-0">
                    <Link
                      href={`/dashboard/quotations/${q.id}`}
                      className="text-xs font-medium text-[var(--color-brass)] hover:underline"
                    >
                      {q.status === 'DRAFT' ? 'Edit' : 'View'}
                    </Link>
                    <a
                      href={`/api/quotations/${q.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-neutral-600 hover:text-[var(--color-text)] hover:underline"
                    >
                      PDF
                    </a>
                    {q.status === 'DRAFT' && (
                      <button
                        type="button"
                        onClick={() => handleSend(q.id)}
                        disabled={isPending}
                        className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-40"
                      >
                        Send
                      </button>
                    )}
                    {q.status === 'SENT' && displayStatus !== 'EXPIRED' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAccept(q.id)}
                          disabled={isPending}
                          className="text-xs font-medium text-emerald-600 hover:underline disabled:opacity-40"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDecline(q.id)}
                          disabled={isPending}
                          className="text-xs font-medium text-red-600 hover:underline disabled:opacity-40"
                        >
                          Decline
                        </button>
                      </>
                    )}
                    {q.convertedInvoiceId ? (
                      <Link
                        href={`/dashboard/invoices/${q.convertedInvoiceId}`}
                        className="text-xs font-medium text-emerald-600 hover:underline flex items-center gap-0.5"
                      >
                        Invoice →
                      </Link>
                    ) : (
                      (q.status === 'SENT' || q.status === 'ACCEPTED') && (
                        <button
                          type="button"
                          onClick={() => handleConvert(q.id)}
                          disabled={isPending}
                          className="text-xs font-medium text-purple-600 hover:underline disabled:opacity-40"
                        >
                          Convert to Invoice
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

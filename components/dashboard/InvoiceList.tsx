'use client';

import React, { useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { getInvoices, sendInvoice, type SerializedInvoice } from '@/actions/invoices';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import { getStatusBadgeConfig, type DocumentStatus } from '@/lib/documents';

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

interface InvoiceListProps {
  initialInvoices: SerializedInvoice[];
}

export function InvoiceList({ initialInvoices }: InvoiceListProps) {
  const [invoices, setInvoices] = useState<SerializedInvoice[]>(initialInvoices);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const refreshList = useCallback(
    (newStatus?: string, newSearch?: string) => {
      startTransition(async () => {
        const res = await getInvoices({
          status: newStatus ?? statusFilter,
          search: newSearch ?? search,
        });
        if (res.ok) {
          setInvoices(res.data);
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
    refreshList(statusFilter, val);
  };

  const handleSend = (id: string) => {
    if (
      !confirm(
        'Send this invoice? The customer and business details will be locked into snapshots.'
      )
    )
      return;
    startTransition(async () => {
      const res = await sendInvoice(id);
      if (!res.ok) {
        setActionError(res.error);
      } else {
        setActionError(null);
        refreshList();
      }
    });
  };

  return (
    <div className="space-y-4">
      {actionError && (
        <div
          role="alert"
          className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg"
        >
          {actionError}
        </div>
      )}

      {/* Filters and search bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status filter pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => handleStatusFilter(f.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                statusFilter === f.value
                  ? 'bg-[var(--color-ink)] text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={handleSearch}
            placeholder="Search by invoice #…"
            className="w-full sm:w-64 px-3 py-1.5 text-xs rounded-lg border border-[var(--color-line)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brass)]/40 bg-white"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                refreshList(statusFilter, '');
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Invoice list */}
      {invoices.length === 0 ? (
        <div className="text-center py-16 bg-white border border-[var(--color-line)] rounded-xl">
          <svg
            className="w-10 h-10 mx-auto text-neutral-300 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          <p className="text-sm font-medium text-neutral-700">No invoices found</p>
          <p className="text-xs text-[var(--color-muted)] mt-1 max-w-sm mx-auto">
            {search || statusFilter !== 'ALL'
              ? 'Try changing the status filter or search query.'
              : 'Create your first invoice to start billing your customers.'}
          </p>
          {!search && statusFilter === 'ALL' && (
            <Link
              href="/dashboard/invoices/new"
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 text-xs font-medium text-white bg-[var(--color-brass)] hover:opacity-90 rounded-lg transition-opacity"
            >
              Create your first invoice
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white border border-[var(--color-line)] rounded-xl overflow-hidden shadow-sm">
          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--color-line-soft)] bg-neutral-50/60 text-neutral-500 font-medium">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Issue Date</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line-soft)]">
                {invoices.map((inv) => {
                  const badge = getStatusBadgeConfig(inv.status as DocumentStatus);
                  const customerName =
                    inv.customerSnapshot?.name || 'Customer';

                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-neutral-50/50 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-medium text-[var(--color-text)]">
                        <Link
                          href={`/dashboard/invoices/${inv.id}`}
                          className="hover:text-[var(--color-brass)] transition-colors font-mono"
                        >
                          {inv.number}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-neutral-700">
                        {customerName}
                      </td>
                      <td className="py-3.5 px-4 text-neutral-500">
                        {formatDate(inv.issueDate)}
                      </td>
                      <td className="py-3.5 px-4 text-neutral-500">
                        {formatDate(inv.dueDate)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-[var(--color-text)]">
                        {formatMoney(inv.totalCentavos)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full border ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.status === 'DRAFT' && (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleSend(inv.id)}
                              className="px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors disabled:opacity-50"
                            >
                              Send
                            </button>
                          )}
                          <a
                            href={`/api/invoices/${inv.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 text-[11px] font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded transition-colors"
                          >
                            PDF
                          </a>
                          <Link
                            href={`/dashboard/invoices/${inv.id}`}
                            className="px-2 py-1 text-[11px] font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
                          >
                            View →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards (≤ 390px friendly) */}
          <div className="sm:hidden divide-y divide-[var(--color-line-soft)]">
            {invoices.map((inv) => {
              const badge = getStatusBadgeConfig(inv.status as DocumentStatus);
              const customerName =
                inv.customerSnapshot?.name || 'Customer';

              return (
                <div key={inv.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/dashboard/invoices/${inv.id}`}
                      className="font-mono text-xs font-semibold text-[var(--color-text)] hover:text-[var(--color-brass)]"
                    >
                      {inv.number}
                    </Link>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full border ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-700 font-medium">
                    {customerName}
                  </div>
                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span>Due: {formatDate(inv.dueDate)}</span>
                    <span className="font-semibold text-[var(--color-text)]">
                      {formatMoney(inv.totalCentavos)}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-[var(--color-line-soft)]">
                    {inv.status === 'DRAFT' && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleSend(inv.id)}
                        className="px-2.5 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 rounded"
                      >
                        Send
                      </button>
                    )}
                    <a
                      href={`/api/invoices/${inv.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 text-[11px] font-medium text-neutral-600 bg-neutral-100 rounded"
                    >
                      PDF
                    </a>
                    <Link
                      href={`/dashboard/invoices/${inv.id}`}
                      className="px-2.5 py-1 text-[11px] font-medium text-[var(--color-brass)]"
                    >
                      Details →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import {
  getCustomers,
  archiveCustomer,
  type SerializedCustomer,
} from '@/actions/customers';

interface ClientListProps {
  initialCustomers: SerializedCustomer[];
}

export function ClientList({ initialCustomers }: ClientListProps) {
  const [clients, setClients] = useState<SerializedCustomer[]>(initialCustomers);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch whenever debouncedSearch or showArchived changes
  useEffect(() => {
    let isMounted = true;
    startTransition(async () => {
      try {
        const res = await getCustomers({
          search: debouncedSearch,
          includeArchived: showArchived,
        });
        if (!isMounted) return;
        if (res.ok) {
          setClients(res.data);
          setError(null);
        } else {
          setError(res.error);
        }
      } catch (err) {
        if (isMounted) setError((err as Error).message);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [debouncedSearch, showArchived]);

  const handleToggleArchive = (client: SerializedCustomer) => {
    const targetState = !client.archived;
    const msg = targetState
      ? `Archive "${client.name}"? They will be hidden from document pickers.`
      : `Restore "${client.name}"?`;

    if (!confirm(msg)) return;

    startTransition(async () => {
      const res = await archiveCustomer(client.id, targetState);
      if (res.ok) {
        setClients((prev) =>
          prev
            .map((c) => (c.id === client.id ? res.data : c))
            .filter((c) => (showArchived ? true : !c.archived))
        );
        setError(null);
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Search and filter controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[var(--color-line)] shadow-xs">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search clients by name or email..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-[var(--color-line)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          <svg
            className="w-4 h-4 text-neutral-400 absolute left-3 top-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-medium text-neutral-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="w-4 h-4 rounded border-neutral-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
            />
            Show archived
          </label>

          <Link
            href="/dashboard/clients/new"
            className="px-4 py-2 bg-[var(--color-primary)] hover:opacity-90 text-white font-medium text-xs sm:text-sm rounded-lg transition-opacity whitespace-nowrap text-center"
          >
            + Add Client
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 text-xs font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading state */}
      {isPending && clients.length === 0 && (
        <div className="bg-white border border-[var(--color-line)] rounded-xl p-8 text-center text-neutral-500 text-sm animate-pulse">
          Loading clients...
        </div>
      )}

      {/* Empty state */}
      {!isPending && !error && clients.length === 0 && (
        <div className="bg-white border border-[var(--color-line)] rounded-xl p-8 sm:p-12 text-center max-w-lg mx-auto space-y-3">
          <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-neutral-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-neutral-900">
            {searchTerm ? 'No matching clients' : 'No clients yet'}
          </h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            {searchTerm
              ? `No client matches "${searchTerm}". Try a different keyword.`
              : 'Add client contact details so you can issue quotations in seconds.'}
          </p>
          {!searchTerm && (
            <div className="pt-2">
              <Link
                href="/dashboard/clients/new"
                className="inline-block px-4 py-2 bg-[var(--color-primary)] hover:opacity-90 text-white font-medium text-xs rounded-lg transition-opacity"
              >
                Add your first client
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Client list: Desktop Table + Mobile Cards */}
      {!error && clients.length > 0 && (
        <>
          {/* Desktop view (hidden on small screens) */}
          <div className="hidden md:block bg-white border border-[var(--color-line)] rounded-xl shadow-xs overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 border-b border-[var(--color-line)] text-xs text-neutral-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Client</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {clients.map((c) => (
                  <tr
                    key={c.id}
                    className={`hover:bg-neutral-50/50 transition-colors ${
                      c.archived ? 'opacity-60 bg-neutral-50/30' : ''
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/clients/${c.id}`}
                          className="font-medium text-neutral-900 hover:text-[var(--color-primary)] hover:underline"
                        >
                          {c.name}
                        </Link>
                        {c.archived && (
                          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-neutral-200 text-neutral-700">
                            Archived
                          </span>
                        )}
                      </div>
                      {c.address && (
                        <p className="text-xs text-neutral-400 truncate max-w-xs">{c.address}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-neutral-600 text-xs">{c.email || '—'}</td>
                    <td className="px-5 py-3.5 text-neutral-600 text-xs">{c.phone || '—'}</td>
                    <td className="px-5 py-3.5 text-right space-x-3 text-xs">
                      <Link
                        href={`/dashboard/clients/${c.id}`}
                        className="text-[var(--color-primary)] hover:underline font-medium"
                      >
                        View
                      </Link>
                      <Link
                        href={`/dashboard/clients/${c.id}/edit`}
                        className="text-neutral-600 hover:text-neutral-900 font-medium"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleToggleArchive(c)}
                        disabled={isPending}
                        className="text-neutral-400 hover:text-red-600 font-medium"
                      >
                        {c.archived ? 'Restore' : 'Archive'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile view (390px responsive cards) */}
          <div className="md:hidden space-y-3">
            {clients.map((c) => (
              <div
                key={c.id}
                className={`bg-white border border-[var(--color-line)] rounded-xl p-4 shadow-xs space-y-2.5 ${
                  c.archived ? 'opacity-60 bg-neutral-50/50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/dashboard/clients/${c.id}`}
                      className="font-semibold text-neutral-900 hover:text-[var(--color-primary)] hover:underline text-sm"
                    >
                      {c.name}
                    </Link>
                    {c.address && (
                      <p className="text-xs text-neutral-500 mt-0.5">{c.address}</p>
                    )}
                  </div>
                  {c.archived && (
                    <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-neutral-200 text-neutral-700 shrink-0">
                      Archived
                    </span>
                  )}
                </div>

                <div className="text-xs text-neutral-600 space-y-1 pt-1 border-t border-neutral-100">
                  {c.email && (
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-400">Email:</span>
                      <span>{c.email}</span>
                    </div>
                  )}
                  {c.phone && (
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-400">Phone:</span>
                      <span>{c.phone}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-neutral-100 flex items-center justify-end gap-3 text-xs">
                  <Link
                    href={`/dashboard/clients/${c.id}`}
                    className="font-medium text-[var(--color-primary)] hover:underline"
                  >
                    View
                  </Link>
                  <Link
                    href={`/dashboard/clients/${c.id}/edit`}
                    className="font-medium text-neutral-700 hover:text-neutral-900"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleToggleArchive(c)}
                    disabled={isPending}
                    className="font-medium text-red-600 hover:text-red-700"
                  >
                    {c.archived ? 'Restore' : 'Archive'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { formatDate } from '@/lib/dates';
import type { AdminUserListItem } from '@/lib/admin/users';

interface AdminUserListProps {
  users: AdminUserListItem[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  currentSearch: string;
  currentPlan: string;
  currentStatus: string;
  currentActive30: boolean;
}

export function AdminUserList({
  users,
  total,
  page,
  totalPages,
  limit,
  currentSearch,
  currentPlan,
  currentStatus,
  currentActive30,
}: AdminUserListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(currentSearch);
  const [isPending, startTransition] = useTransition();

  const updateFilters = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '' || value === 'ALL') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    // Reset to page 1 whenever filters change unless page is explicitly updated
    if (!('page' in updates)) {
      params.delete('page');
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ q: searchInput.trim() || null });
  };

  const startRecord = total === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, total);

  return (
    <div className="space-y-6">
      {/* Search and Filters Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2 max-w-md">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search email or business name..."
                className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-600"
              />
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3 top-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    updateFilters({ q: null });
                  }}
                  className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Search
            </button>
          </form>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Plan Filter */}
            <div>
              <select
                value={currentPlan}
                onChange={(e) => updateFilters({ plan: e.target.value })}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="ALL">All Plans</option>
                <option value="FREE">Free</option>
                <option value="FREELANCER">Freelancer</option>
                <option value="BUSINESS">Business</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={currentStatus}
                onChange={(e) => updateFilters({ status: e.target.value })}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="DELETION">Deletion Requested</option>
              </select>
            </div>

            {/* Active in 30 Days Toggle */}
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-100">
              <input
                type="checkbox"
                checked={currentActive30}
                onChange={(e) =>
                  updateFilters({ active30: e.target.checked ? '1' : null })
                }
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Active in 30 days</span>
            </label>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200 tracking-wider">
              <tr>
                <th scope="col" className="py-3.5 px-4 sm:px-6">
                  User
                </th>
                <th scope="col" className="py-3.5 px-4">
                  Business
                </th>
                <th scope="col" className="py-3.5 px-4">
                  Plan
                </th>
                <th scope="col" className="py-3.5 px-4 text-center">
                  Docs
                </th>
                <th scope="col" className="py-3.5 px-4">
                  Signed Up
                </th>
                <th scope="col" className="py-3.5 px-4">
                  Last Active
                </th>
                <th scope="col" className="py-3.5 px-4">
                  Status
                </th>
                <th scope="col" className="py-3.5 px-4 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <p className="text-sm font-medium">No users found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try clearing search terms or changing your filters.
                    </p>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    {/* User Name & Email */}
                    <td className="py-3 px-4 sm:px-6">
                      <div className="font-medium text-slate-900">{user.name}</div>
                      <div className="text-xs text-slate-400 font-mono">
                        {user.email}
                      </div>
                    </td>

                    {/* Business Name */}
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {user.businessName}
                    </td>

                    {/* Plan + Override Badge */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800">
                          {user.plan}
                        </span>
                        {user.isPlanOverridden && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            ADMIN
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Documents Count */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className="font-semibold text-slate-900">
                        {user.documentsCount}
                      </span>
                      <span className="text-[11px] text-slate-400 ml-1">
                        ({user.invoicesCount}i / {user.quotationsCount}q)
                      </span>
                    </td>

                    {/* Signed Up */}
                    <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-500">
                      {formatDate(user.signedUpAt)}
                    </td>

                    {/* Last Active */}
                    <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-500">
                      {user.lastActiveAt ? formatDate(user.lastActiveAt) : 'Never'}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {user.status === 'ACTIVE' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      )}
                      {user.status === 'SUSPENDED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          Suspended
                        </span>
                      )}
                      {user.status === 'DELETION_REQUESTED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Closing
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-900 hover:underline"
                      >
                        View Details →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-700">{startRecord}</span> to{' '}
            <span className="font-semibold text-slate-700">{endRecord}</span> of{' '}
            <span className="font-semibold text-slate-700">{total}</span> accounts
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || isPending}
              onClick={() => updateFilters({ page: String(page - 1) })}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              ← Previous
            </button>

            <span className="px-2 font-medium text-slate-700">
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages || isPending}
              onClick={() => updateFilters({ page: String(page + 1) })}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

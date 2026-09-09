'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { formatDateTime } from '@/lib/dates';
import type { AdminAuditLogViewerItem, AdminAuditAction } from '@/lib/admin/audit';

interface AdminAuditLogViewerProps {
  logs: AdminAuditLogViewerItem[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  currentActor: string;
  currentTarget: string;
  currentAction: string;
}

const ACTION_LABELS: Record<AdminAuditAction, { label: string; color: string }> = {
  USER_VIEW: {
    label: 'User View',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  DOCUMENT_VIEW: {
    label: 'Document View',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  SUPPORT_LOOKUP: {
    label: 'Support Lookup',
    color: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
  USER_SUSPEND: {
    label: 'User Suspended',
    color: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  USER_UNSUSPEND: {
    label: 'User Unsuspended',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  PLAN_OVERRIDE_SET: {
    label: 'Plan Override Set',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  PLAN_OVERRIDE_CLEAR: {
    label: 'Plan Override Cleared',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  PUBLIC_LINKS_DISABLE: {
    label: 'Public Links Disabled',
    color: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  PUBLIC_LINKS_ENABLE: {
    label: 'Public Links Enabled',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  PUBLIC_LINK_REVOKE: {
    label: 'Link Revoked',
    color: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  MFA_RESET: {
    label: 'MFA Reset',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
  },
};

export function AdminAuditLogViewer({
  logs,
  total,
  page,
  totalPages,
  limit,
  currentActor,
  currentTarget,
  currentAction,
}: AdminAuditLogViewerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [actorInput, setActorInput] = useState(currentActor);
  const [targetInput, setTargetInput] = useState(currentTarget);
  const [expandedId, setExpandedId] = useState<string | null>(null);
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

    if (!('page' in updates)) {
      params.delete('page');
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({
      actor: actorInput.trim() || null,
      target: targetInput.trim() || null,
    });
  };

  const clearFilters = () => {
    setActorInput('');
    setTargetInput('');
    startTransition(() => {
      router.push(pathname);
    });
  };

  const hasActiveFilters = Boolean(currentActor || currentTarget || currentAction !== 'ALL');
  const startRecord = total === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, total);

  return (
    <div className="space-y-6">
      {/* Read-Only & Immutability Notice Banner (§5.8) */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <span>
            <strong>Immutable Security Log:</strong> Append-only administrative trail. Audit records cannot be modified or deleted.
          </span>
        </div>
        <span className="text-slate-400 font-mono text-[11px]">Database Paginated</span>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <form onSubmit={handleFilterSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Action Filter */}
          <div>
            <label htmlFor="select-action" className="block text-xs font-semibold text-slate-700 mb-1">
              Action Type
            </label>
            <select
              id="select-action"
              value={currentAction}
              onChange={(e) => updateFilters({ action: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
            >
              <option value="ALL">All Actions</option>
              <option value="USER_VIEW">User View (Support)</option>
              <option value="DOCUMENT_VIEW">Document View (Support)</option>
              <option value="SUPPORT_LOOKUP">Support Document Lookup</option>
              <option value="USER_SUSPEND">User Suspension</option>
              <option value="USER_UNSUSPEND">User Unsuspension</option>
              <option value="PLAN_OVERRIDE_SET">Plan Override Set</option>
              <option value="PLAN_OVERRIDE_CLEAR">Plan Override Cleared</option>
              <option value="PUBLIC_LINKS_DISABLE">Disable Public Links</option>
              <option value="PUBLIC_LINKS_ENABLE">Enable Public Links</option>
              <option value="PUBLIC_LINK_REVOKE">Revoke Public Link</option>
              <option value="MFA_RESET">MFA Reset</option>
            </select>
          </div>

          {/* Actor Filter */}
          <div>
            <label htmlFor="input-actor" className="block text-xs font-semibold text-slate-700 mb-1">
              Actor (Admin Email)
            </label>
            <input
              id="input-actor"
              type="text"
              value={actorInput}
              onChange={(e) => setActorInput(e.target.value)}
              placeholder="e.g. admin@bilyoapp.com"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>

          {/* Target Filter */}
          <div>
            <label htmlFor="input-target" className="block text-xs font-semibold text-slate-700 mb-1">
              Target (User / Doc ID)
            </label>
            <input
              id="input-target"
              type="text"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              placeholder="e.g. user@email or INV-000001"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-xs transition-colors disabled:opacity-50"
            >
              Filter Logs
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md border border-slate-200 transition-colors"
                title="Clear all active filters"
              >
                Reset
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Results Count and Pagination Summary */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          Showing <strong>{startRecord}</strong> to <strong>{endRecord}</strong> of{' '}
          <strong>{total}</strong> audit event{total === 1 ? '' : 's'}
        </span>
        {isPending && <span className="text-indigo-600 font-medium animate-pulse">Updating...</span>}
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 font-semibold text-slate-700">
              <tr>
                <th scope="col" className="px-4 py-3">Timestamp</th>
                <th scope="col" className="px-4 py-3">Actor</th>
                <th scope="col" className="px-4 py-3">Action</th>
                <th scope="col" className="px-4 py-3">Target</th>
                <th scope="col" className="px-4 py-3">Justification / Reason</th>
                <th scope="col" className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    <div className="max-w-xs mx-auto space-y-2">
                      <svg
                        className="w-8 h-8 text-slate-300 mx-auto"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <p className="text-sm font-medium text-slate-800">No audit logs found</p>
                      <p className="text-xs text-slate-400">
                        No events match the specified filters. Try clearing your search parameters.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const meta = ACTION_LABELS[log.action] || {
                    label: log.action,
                    color: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                  const isExpanded = expandedId === log.id;

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors group">
                      {/* Timestamp */}
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap align-top font-mono text-[11px]">
                        {formatDateTime(log.createdAt)}
                      </td>

                      {/* Actor */}
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <div className="font-medium text-slate-900">{log.actorEmail}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          ID: {log.actorUserId.slice(-6)}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${meta.color}`}
                        >
                          {meta.label}
                        </span>
                      </td>

                      {/* Target */}
                      <td className="px-4 py-3 align-top">
                        {log.targetUserId ? (
                          <div>
                            <Link
                              href={`/admin/users/${log.targetUserId}`}
                              className="font-medium text-indigo-600 hover:text-indigo-900 hover:underline"
                            >
                              {log.targetUserEmail || `User ${log.targetUserId.slice(-6)}`}
                            </Link>
                            {log.targetType && log.targetType !== 'User' && (
                              <div className="text-[10px] text-slate-400">
                                {log.targetType}: {log.targetId}
                              </div>
                            )}
                          </div>
                        ) : log.targetId ? (
                          <div className="font-mono text-slate-700 text-xs">
                            {log.targetType ? `${log.targetType}: ` : ''}
                            {log.targetId}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>

                      {/* Reason */}
                      <td className="px-4 py-3 align-top max-w-xs">
                        {log.reason ? (
                          <p className="text-slate-800 text-xs leading-relaxed">
                            {log.reason}
                          </p>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>

                      {/* Details Expand Toggle */}
                      <td className="px-4 py-3 text-right align-top whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 transition-colors"
                        >
                          <span>{isExpanded ? 'Hide' : 'Inspect'}</span>
                          <svg
                            className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Expanded Metadata Viewer Drawer / Inline Panel */}
        {expandedId && (
          (() => {
            const activeLog = logs.find((l) => l.id === expandedId);
            if (!activeLog) return null;

            return (
              <div className="bg-slate-900 text-slate-100 p-4 sm:p-6 border-t border-slate-800 space-y-4 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">Event Inspection:</span>
                    <span className="text-slate-300">{activeLog.action}</span>
                    <span className="text-slate-500 text-[10px]">({activeLog.id})</span>
                  </div>
                  <button
                    onClick={() => setExpandedId(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    ✕ Close
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px]">
                  <div>
                    <span className="text-slate-400">Actor:</span>{' '}
                    <span className="text-white">{activeLog.actorEmail}</span> ({activeLog.actorUserId})
                  </div>
                  <div>
                    <span className="text-slate-400">Timestamp:</span>{' '}
                    <span className="text-white">{formatDateTime(activeLog.createdAt)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Client IP:</span>{' '}
                    <span className="text-white">{activeLog.ip || '127.0.0.1'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">User Agent:</span>{' '}
                    <span className="text-slate-300 truncate inline-block max-w-xs align-bottom">
                      {activeLog.userAgent || 'unknown'}
                    </span>
                  </div>
                </div>

                {/* Before / After state display */}
                {(activeLog.before || activeLog.after) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {activeLog.before && (
                      <div className="space-y-1">
                        <span className="text-rose-400 text-[10px] uppercase tracking-wider font-bold">
                          State Before Action:
                        </span>
                        <pre className="bg-slate-950 p-3 rounded border border-slate-800 text-[10px] text-slate-300 overflow-x-auto">
                          {JSON.stringify(activeLog.before, null, 2)}
                        </pre>
                      </div>
                    )}
                    {activeLog.after && (
                      <div className="space-y-1">
                        <span className="text-emerald-400 text-[10px] uppercase tracking-wider font-bold">
                          State After Action:
                        </span>
                        <pre className="bg-slate-950 p-3 rounded border border-slate-800 text-[10px] text-slate-300 overflow-x-auto">
                          {JSON.stringify(activeLog.after, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()
        )}

        {/* Database Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-prev-page"
                onClick={() => updateFilters({ page: String(page - 1) })}
                disabled={page <= 1 || isPending}
                className="inline-flex items-center px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>

              <button
                type="button"
                id="btn-next-page"
                onClick={() => updateFilters({ page: String(page + 1) })}
                disabled={page >= totalPages || isPending}
                className="inline-flex items-center px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

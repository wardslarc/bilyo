'use client';

import Link from 'next/link';
import { formatDate } from '@/lib/dates';
import type { PlatformMetrics } from '@/lib/admin/metrics';

interface PlatformMetricsTilesProps {
  metrics: PlatformMetrics;
}

export function PlatformMetricsTiles({ metrics }: PlatformMetricsTilesProps) {
  const generatedDate = metrics.generatedAt ? new Date(metrics.generatedAt) : new Date();

  return (
    <div className="space-y-6">
      {/* Top 4 KPI Tiles per DEVELOPMENT_PLAN.md §12 P1-T06 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tile 1: Total Users */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Users
              </span>
              <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm font-bold">
                👥
              </span>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                {metrics.totalUsers.toLocaleString()}
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-slate-600">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold font-mono">
                  +{metrics.newUsers7d} 7d
                </span>
                <span className="text-slate-400">•</span>
                <span className="font-mono text-slate-500">
                  +{metrics.newUsers30d} 30d
                </span>
              </div>
            </div>
          </div>
          <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Platform Accounts</span>
            <Link href="/admin/users" className="text-indigo-600 hover:underline font-medium">
              View List →
            </Link>
          </div>
        </div>

        {/* Tile 2: Quotes Sent (30d) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Quotes Sent (30d)
              </span>
              <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold">
                📤
              </span>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-extrabold text-blue-900 tracking-tight font-mono">
                {metrics.quotesSent30d.toLocaleString()}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {metrics.activeUsers30d} active creator{metrics.activeUsers30d === 1 ? '' : 's'} in last 30 days
              </p>
            </div>
          </div>
          <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Commercial Pipeline</span>
            <Link href="/admin/lookup" className="text-blue-600 hover:underline font-medium">
              Lookup →
            </Link>
          </div>
        </div>

        {/* Tile 3: Quotes Accepted (30d) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Quotes Accepted (30d)
              </span>
              <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm font-bold">
                🤝
              </span>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-extrabold text-emerald-700 tracking-tight font-mono">
                {metrics.quotesAccepted30d.toLocaleString()}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Confirmed client acceptances in 30 days
              </p>
            </div>
          </div>
          <div className="pt-3 mt-4 border-t border-slate-100 text-[11px] text-slate-400">
            <span>Verified Conversions</span>
          </div>
        </div>

        {/* Tile 4: Acceptance Rate */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Acceptance Rate
              </span>
              <span className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-sm font-bold">
                📈
              </span>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-extrabold text-purple-900 tracking-tight font-mono">
                {metrics.acceptanceRate}%
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {metrics.quotesSent30d === 0
                  ? 'No quotations sent in 30 days.'
                  : `${metrics.quotesAccepted30d} of ${metrics.quotesSent30d} quotes converted`}
              </p>
            </div>
          </div>
          <div className="pt-3 mt-4 border-t border-slate-100 text-[11px] text-slate-400">
            <span>Client Conversion KPI</span>
          </div>
        </div>
      </div>

      {/* Moderation Status Banner */}
      {(metrics.suspendedCount > 0 || metrics.publicLinksDisabledCount > 0) && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <span className="font-bold text-rose-900">Platform Moderation Active:</span>
            <span>
              {metrics.suspendedCount} account{metrics.suspendedCount > 1 ? 's' : ''} suspended
              {metrics.publicLinksDisabledCount > 0 ? `, ${metrics.publicLinksDisabledCount} public links disabled` : ''}.
            </span>
          </div>
          <Link
            href="/admin/users?status=SUSPENDED"
            className="text-rose-700 hover:text-rose-900 font-semibold underline self-start sm:self-auto"
          >
            Review Suspended Users →
          </Link>
        </div>
      )}

      {/* Freshness & Cache Notice */}
      <div className="flex items-center justify-between text-xs text-slate-400 pt-2 px-1">
        <span>
          Metrics cached for 5 minutes (300s) · Generated at{' '}
          <span className="font-mono text-slate-500">{formatDate(generatedDate)}</span>
        </span>
        <span className="font-mono text-[11px]">Bilyo Platform Metrics</span>
      </div>
    </div>
  );
}

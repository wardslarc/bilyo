'use client';

import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import type { PlatformMetrics } from '@/lib/admin/metrics';

interface PlatformMetricsTilesProps {
  metrics: PlatformMetrics;
}

export function PlatformMetricsTiles({ metrics }: PlatformMetricsTilesProps) {
  const generatedDate = metrics.generatedAt ? new Date(metrics.generatedAt) : new Date();

  return (
    <div className="space-y-6">
      {/* Top Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tile 1: Total Users & Growth */}
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
            <span>Platform Signups</span>
            <Link href="/admin/users" className="text-indigo-600 hover:underline font-medium">
              View List →
            </Link>
          </div>
        </div>

        {/* Tile 2: Active Creators (30d) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Active Users (30d)
              </span>
              <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold">
                ⚡
              </span>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                {metrics.activeUsers30d.toLocaleString()}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {metrics.activeUsers30d === 0
                  ? 'No active document creators in last 30 days.'
                  : `${(metrics.totalUsers > 0 ? ((metrics.activeUsers30d / metrics.totalUsers) * 100).toFixed(1) : '0')}% of total accounts created documents.`}
              </p>
            </div>
          </div>
          <div className="pt-3 mt-4 border-t border-slate-100 text-[11px] text-slate-400">
            Created an invoice or quotation
          </div>
        </div>

        {/* Tile 3: Monthly Recurring Revenue (MRR) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Platform MRR
              </span>
              <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm font-bold">
                ₱
              </span>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-extrabold text-emerald-700 tracking-tight font-mono">
                {formatMoney(metrics.mrrCentavos)}
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-800 font-mono">
                  {metrics.paidAccounts.total}
                </span>
                <span className="text-slate-500">paying subscriptions</span>
              </div>
            </div>
          </div>
          <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>PayMongo Billing</span>
            {metrics.paidAccounts.comped > 0 && (
              <span className="text-purple-600 font-medium font-mono">
                +{metrics.paidAccounts.comped} comped
              </span>
            )}
          </div>
        </div>

        {/* Tile 4: Moderation & Suspensions */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Suspended Accounts
              </span>
              <span className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center text-sm font-bold">
                🛡️
              </span>
            </div>
            <div className="mt-3">
              <div
                className={`text-3xl font-extrabold tracking-tight font-mono ${
                  metrics.suspendedCount > 0 ? 'text-rose-600' : 'text-slate-900'
                }`}
              >
                {metrics.suspendedCount.toLocaleString()}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {metrics.suspendedCount === 0
                  ? 'All accounts in good standing.'
                  : `${metrics.suspendedCount} account${metrics.suspendedCount > 1 ? 's' : ''} currently blocked.`}
              </p>
            </div>
          </div>
          <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              {metrics.publicLinksDisabledCount > 0
                ? `${metrics.publicLinksDisabledCount} links disabled`
                : 'Zero link restrictions'}
            </span>
            <Link href="/admin/users?status=SUSPENDED" className="text-rose-600 hover:underline font-medium">
              Filter →
            </Link>
          </div>
        </div>
      </div>

      {/* 2-Column Deep Dive: Documents & Subscriptions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Document Creation 30d by Kind */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                Document Production (Last 30 Days)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Breakdown of commercial documents issued across the platform
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {metrics.documents30d.total} Total
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-blue-50/60 border border-blue-100">
              <div className="flex items-center justify-between text-xs font-semibold text-blue-900">
                <span>Invoices</span>
                <span className="font-mono text-[11px] bg-blue-100 px-1.5 py-0.5 rounded">
                  INV
                </span>
              </div>
              <div className="text-2xl font-extrabold text-blue-900 mt-2 font-mono">
                {metrics.documents30d.invoices.toLocaleString()}
              </div>
              <p className="text-[11px] text-blue-700 mt-1">
                {metrics.documents30d.total > 0
                  ? `${((metrics.documents30d.invoices / metrics.documents30d.total) * 100).toFixed(0)}% of documents`
                  : '0%'}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-purple-50/60 border border-purple-100">
              <div className="flex items-center justify-between text-xs font-semibold text-purple-900">
                <span>Quotations</span>
                <span className="font-mono text-[11px] bg-purple-100 px-1.5 py-0.5 rounded">
                  QUO
                </span>
              </div>
              <div className="text-2xl font-extrabold text-purple-900 mt-2 font-mono">
                {metrics.documents30d.quotations.toLocaleString()}
              </div>
              <p className="text-[11px] text-purple-700 mt-1">
                {metrics.documents30d.total > 0
                  ? `${((metrics.documents30d.quotations / metrics.documents30d.total) * 100).toFixed(0)}% of documents`
                  : '0%'}
              </p>
            </div>
          </div>
        </div>

        {/* Paid Subscription Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                Subscription & Tier Breakdown
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Distribution of paying customers and administrative comps
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {metrics.paidAccounts.total + metrics.paidAccounts.comped} Active Paid/Comp
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-semibold text-slate-600 uppercase">
                Freelancer
              </span>
              <p className="text-xl font-bold text-slate-900 mt-1 font-mono">
                {metrics.paidAccounts.freelancer}
              </p>
              <span className="text-[10px] text-slate-400 font-mono">₱299/mo</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-semibold text-slate-600 uppercase">
                Business
              </span>
              <p className="text-xl font-bold text-slate-900 mt-1 font-mono">
                {metrics.paidAccounts.business}
              </p>
              <span className="text-[10px] text-slate-400 font-mono">₱599/mo</span>
            </div>

            <div className="p-3 rounded-lg bg-purple-50/50 border border-purple-100">
              <span className="text-[11px] font-semibold text-purple-800 uppercase">
                Admin Comps
              </span>
              <p className="text-xl font-bold text-purple-900 mt-1 font-mono">
                {metrics.paidAccounts.comped}
              </p>
              <span className="text-[10px] text-purple-600">Active override</span>
            </div>
          </div>
        </div>
      </div>

      {/* Freshness & Cache Notice */}
      <div className="flex items-center justify-between text-xs text-slate-400 pt-2 px-1">
        <span>
          Metrics cached for 5 minutes (300s) · Generated at{' '}
          <span className="font-mono text-slate-500">{formatDate(generatedDate)}</span>
        </span>
        <span className="font-mono text-[11px]">Bilyo Platform Metrics v2</span>
      </div>
    </div>
  );
}

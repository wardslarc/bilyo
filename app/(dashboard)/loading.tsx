import React from 'react';

export default function DashboardLoading() {
  return (
    <div className="py-6 px-4 sm:px-6 max-w-6xl mx-auto space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-44 bg-[var(--color-line)] rounded-md" />
          <div className="h-4 w-72 bg-[var(--color-line-softer)] rounded-md" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-32 bg-[var(--color-line)] rounded-lg" />
          <div className="h-9 w-28 bg-[var(--color-line)] rounded-lg" />
        </div>
      </div>

      {/* 4 Metric Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white border border-[var(--color-line)] rounded-xl p-5 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 bg-[var(--color-line-soft)] rounded" />
              <div className="w-7 h-7 bg-[var(--color-line-soft)] rounded-md" />
            </div>
            <div className="h-8 w-32 bg-[var(--color-line)] rounded-md" />
            <div className="h-3 w-28 bg-[var(--color-line-soft)] rounded" />
          </div>
        ))}
      </div>

      {/* Content / Table Skeleton */}
      <div className="bg-white border border-[var(--color-line)] rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--color-line-soft)] pb-4">
          <div className="h-5 w-36 bg-[var(--color-line)] rounded" />
          <div className="h-4 w-20 bg-[var(--color-line-soft)] rounded" />
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 border-b border-[var(--color-line-softer)] last:border-0"
            >
              <div className="space-y-1.5">
                <div className="h-4 w-28 bg-[var(--color-line)] rounded" />
                <div className="h-3 w-40 bg-[var(--color-line-soft)] rounded" />
              </div>
              <div className="h-5 w-24 bg-[var(--color-line)] rounded font-mono" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

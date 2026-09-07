'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error('Dashboard error boundary caught error:', error.message);
  }, [error]);

  return (
    <div className="py-12 px-4 sm:px-6 max-w-xl mx-auto text-center space-y-6">
      <div className="bg-white border border-[var(--color-line)] rounded-2xl p-8 sm:p-10 shadow-xs space-y-5">
        <div className="w-14 h-14 mx-auto rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-[var(--color-text)]">Unable to load dashboard data</h2>
          <p className="text-xs text-[var(--color-muted)] leading-relaxed">
            We encountered a temporary problem retrieving your records. No changes were lost.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto px-5 py-2.5 bg-[var(--color-brass)] hover:opacity-90 text-white font-medium text-xs rounded-lg transition-opacity"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-5 py-2.5 bg-[var(--color-paper-sunk)] hover:bg-[var(--color-line)] text-[var(--color-text)] font-medium text-xs rounded-lg transition-colors"
          >
            Dashboard Home
          </Link>
        </div>
      </div>
    </div>
  );
}

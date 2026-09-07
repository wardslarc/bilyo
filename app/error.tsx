'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

interface RootErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: RootErrorProps) {
  useEffect(() => {
    // Log real error server/client console safely
    console.error('Unhandled application error:', error.message);
  }, [error]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-paper)] px-4 sm:px-6 text-center">
      <div className="max-w-md w-full space-y-6 bg-white border border-[var(--color-line)] rounded-2xl p-8 sm:p-10 shadow-xs">
        <div className="w-14 h-14 mx-auto rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-[var(--color-text)]">Something went wrong</h1>
          <p className="text-xs text-[var(--color-muted)] leading-relaxed">
            An unexpected problem occurred while loading this page. Our team has been notified.
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
            href="/"
            className="w-full sm:w-auto px-5 py-2.5 bg-[var(--color-paper-sunk)] hover:bg-[var(--color-line)] text-[var(--color-text)] font-medium text-xs rounded-lg transition-colors"
          >
            Go to Home
          </Link>
        </div>
      </div>
    </main>
  );
}

import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-paper)] px-4 sm:px-6 text-center">
      <div className="max-w-md w-full space-y-6 bg-white border border-[var(--color-line)] rounded-2xl p-8 sm:p-10 shadow-xs">
        <div className="w-16 h-16 mx-auto rounded-full bg-[var(--color-paper-sunk)] flex items-center justify-center text-[var(--color-muted)] font-mono text-2xl font-bold">
          404
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-[var(--color-text)]">Page not found</h1>
          <p className="text-xs text-[var(--color-muted)] leading-relaxed">
            The page or document you are looking for doesn&apos;t exist, was revoked, or has been moved.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-5 py-2.5 bg-[var(--color-brass)] hover:opacity-90 text-white font-medium text-xs rounded-lg transition-opacity"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="w-full sm:w-auto px-5 py-2.5 bg-[var(--color-paper-sunk)] hover:bg-[var(--color-line)] text-[var(--color-text)] font-medium text-xs rounded-lg transition-colors"
          >
            Home Page
          </Link>
        </div>
      </div>
    </main>
  );
}

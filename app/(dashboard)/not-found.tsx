import React from 'react';
import Link from 'next/link';

export default function DashboardNotFound() {
  return (
    <div className="py-16 px-4 sm:px-6 max-w-lg mx-auto text-center space-y-6">
      <div className="bg-white border border-[var(--color-line)] rounded-2xl p-8 sm:p-10 shadow-xs space-y-5">
        <div className="w-14 h-14 mx-auto rounded-full bg-[var(--color-paper-sunk)] flex items-center justify-center text-[var(--color-muted)] font-mono text-xl font-bold">
          404
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-[var(--color-text)]">Record not found</h2>
          <p className="text-xs text-[var(--color-muted)] leading-relaxed">
            The document, client, or quotation you requested does not exist or belongs to another account.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-5 py-2.5 bg-[var(--color-brass)] hover:opacity-90 text-white font-medium text-xs rounded-lg transition-opacity"
          >
            ← Back to Dashboard
          </Link>
          <Link
            href="/dashboard/quotations"
            className="w-full sm:w-auto px-5 py-2.5 bg-[var(--color-paper-sunk)] hover:bg-[var(--color-line)] text-[var(--color-text)] font-medium text-xs rounded-lg transition-colors"
          >
            View Quotations
          </Link>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard · Bilyo',
  description: 'Manage quotations, invoices, customers, and payments.',
};

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Dashboard</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Track quotations, invoices, and payments in one place.
        </p>
      </div>

      {/* Empty State / Quick actions */}
      <div className="bg-white border border-[var(--color-line)] rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-sm space-y-4">
        <div className="w-14 h-14 mx-auto rounded-full bg-neutral-100 flex items-center justify-center text-[var(--color-primary)]">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>

        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-neutral-900">No documents issued yet</h2>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            Ready to bill someone? Create your first quotation or invoice to get started.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/dashboard/quotations/new"
            className="w-full sm:w-auto px-5 py-2.5 bg-[var(--color-primary)] hover:opacity-90 text-white font-medium text-sm rounded-lg transition-opacity"
          >
            Create your first quotation
          </Link>
          <Link
            href="/dashboard/invoices/new"
            className="w-full sm:w-auto px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-medium text-sm rounded-lg transition-colors"
          >
            Create invoice
          </Link>
        </div>
      </div>
    </div>
  );
}

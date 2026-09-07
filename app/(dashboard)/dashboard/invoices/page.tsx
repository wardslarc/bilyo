import Link from 'next/link';
import { getInvoices } from '@/actions/invoices';
import { InvoiceList } from '@/components/dashboard/InvoiceList';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage() {
  const result = await getInvoices();

  const invoices = result.ok ? result.data : [];

  return (
    <div className="py-6 px-4 sm:px-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Invoices</h1>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            Create, track, and send invoices to your customers.
          </p>
        </div>
        <Link
          href="/dashboard/invoices/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[var(--color-brass)] hover:opacity-90 rounded-lg transition-opacity"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Invoice
        </Link>
      </div>

      {/* Error state */}
      {!result.ok && (
        <div
          role="alert"
          className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg mb-4"
        >
          {result.error}
        </div>
      )}

      <InvoiceList initialInvoices={invoices} />
    </div>
  );
}

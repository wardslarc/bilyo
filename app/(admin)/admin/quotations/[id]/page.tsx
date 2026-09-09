import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/guard';
import { recordAudit } from '@/lib/admin/audit';
import { getAdminQuotation } from '@/lib/admin/users';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { QUOTATION_FOOTER } from '@/lib/documents';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Quotation Inspection · Bilyo Admin',
  description: 'Inspect quotation in read-only platform staff audit mode.',
};

interface AdminQuotationPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AdminQuotationPage({
  params,
}: AdminQuotationPageProps) {
  await requireAdmin();
  const { id } = await params;

  const doc = await getAdminQuotation(id);
  if (!doc) {
    notFound();
  }

  // AGENTS.md §4.9: Every view of an identified user's data/quotation appends an audit log entry
  await recordAudit({
    action: 'DOCUMENT_VIEW',
    targetUserId: doc.userId,
    targetType: 'Quotation',
    targetId: id,
    reason: `Inspected quotation ${doc.number}`,
  });

  const publicCode = doc.publicCode || doc.publicToken;
  const publicPath = publicCode ? `/q/${publicCode}` : '#';

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Navigation Breadcrumb */}
      <div>
        <Link
          href={`/admin/users/${doc.userId}/quotations`}
          className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors mb-2"
        >
          <svg
            className="w-3.5 h-3.5 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to User Quotations
        </Link>
      </div>

      {/* Mandatory Top Banner — AGENTS.md §4.9, DEVELOPMENT_PLAN.md §3 */}
      <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 text-amber-900 shadow-sm flex items-start gap-3">
        <svg
          className="w-6 h-6 text-amber-700 shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <div className="text-sm">
          <p className="font-bold text-base tracking-wide text-amber-950">
            READ-ONLY — ADMIN VIEW
          </p>
          <p className="mt-0.5 text-amber-800">
            Platform staff audit mode. User records, status, and quotations are immutable
            from the administrative console. No edits or mutations permitted.
          </p>
        </div>
      </div>

      {/* Public Link Status Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">Public Link:</span>
          {(doc.publicCodeRevokedAt || doc.publicTokenRevokedAt) ? (
            <span className="inline-flex items-center gap-1 text-rose-700 font-medium">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              Revoked on {formatDate((doc.publicCodeRevokedAt || doc.publicTokenRevokedAt)!)} (Visible to Admins Only)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Active Public Code:{' '}
              <code className="font-mono text-[11px] bg-slate-200/70 px-1 py-0.5 rounded">
                {publicCode || 'None'}
              </code>
            </span>
          )}
        </div>
        {publicCode && (
          <a
            href={publicPath}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-medium"
          >
            <span>Inspect Public URL</span>
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        )}
      </div>

      {/* Quotation Sheet Layout */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-10 space-y-8">
        {/* Quotation Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-purple-100 text-purple-800">
                QUOTATION
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                  doc.status === 'ACCEPTED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : doc.status === 'SENT'
                      ? 'bg-blue-100 text-blue-800'
                      : doc.status === 'DECLINED'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-700'
                }`}
              >
                {doc.status}
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mt-2 font-mono">
              {doc.number}
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Created: {formatDate(doc.createdAt)}
            </p>
          </div>

          <div className="text-right sm:text-right space-y-1 text-sm text-slate-600">
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Issue Date:{' '}
              </span>
              <span className="font-semibold text-slate-900">
                {formatDate(doc.issueDate)}
              </span>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Valid Until:{' '}
              </span>
              <span className="font-semibold text-slate-900">
                {doc.validUntil ? formatDate(doc.validUntil) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Business and Customer Meta */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
          {/* Business Details (Issuer) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-400 uppercase tracking-wider text-xs font-bold">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              <span>Issuer Business</span>
            </div>
            <div className="text-base font-bold text-slate-900">
              {doc.business.businessName}
            </div>
            {doc.business.address && (
              <div className="text-slate-600 whitespace-pre-line text-xs">
                {doc.business.address}
              </div>
            )}
            <div className="text-xs text-slate-500 space-y-0.5">
              {doc.business.email && <div>Email: {doc.business.email}</div>}
              {doc.business.phone && <div>Phone: {doc.business.phone}</div>}
            </div>
          </div>

          {/* Customer Details */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-400 uppercase tracking-wider text-xs font-bold">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span>Quoted To</span>
            </div>
            <div className="text-base font-bold text-slate-900">
              {doc.customer.name}
            </div>
            {doc.customer.company && (
              <div className="text-slate-700 font-medium text-xs">
                {doc.customer.company}
              </div>
            )}
            {doc.customer.address && (
              <div className="text-slate-600 whitespace-pre-line text-xs">
                {doc.customer.address}
              </div>
            )}
            <div className="text-xs text-slate-500 space-y-0.5">
              {doc.customer.email && <div>Email: {doc.customer.email}</div>}
              {doc.customer.phone && <div>Phone: {doc.customer.phone}</div>}
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-right w-24">Qty</th>
                <th className="px-4 py-3 text-right w-36">Unit Price (PHP)</th>
                <th className="px-4 py-3 text-right w-36">Amount (PHP)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {doc.items.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900 font-medium">
                    {item.description}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">
                    {formatMoney(item.unitPriceCentavos)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                    {formatMoney(item.amountCentavos)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Breakdown */}
        <div className="flex flex-col sm:flex-row justify-between gap-6 pt-4 border-t border-slate-200">
          <div className="space-y-4 max-w-md text-xs text-slate-500">
            {doc.notes && (
              <div>
                <span className="font-semibold text-slate-700 block mb-1">
                  Notes:
                </span>
                <p className="whitespace-pre-line bg-slate-50 p-2.5 rounded border border-slate-100 text-slate-700">
                  {doc.notes}
                </p>
              </div>
            )}
            {doc.terms && (
              <div>
                <span className="font-semibold text-slate-700 block mb-1">
                  Terms & Conditions:
                </span>
                <p className="whitespace-pre-line bg-slate-50 p-2.5 rounded border border-slate-100 text-slate-700">
                  {doc.terms}
                </p>
              </div>
            )}
          </div>

          <div className="w-full sm:w-72 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-mono">{formatMoney(doc.subtotalCentavos)}</span>
            </div>
            {doc.discountCentavos > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Discount</span>
                <span className="font-mono">-{formatMoney(doc.discountCentavos)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
              <span>Total</span>
              <span className="font-mono text-emerald-700">
                {formatMoney(doc.totalCentavos)}
              </span>
            </div>
          </div>
        </div>

        {/* Required Non-tax disclaimer footer per §2.3 */}
        <div className="pt-4 border-t border-slate-200 text-center text-xs text-slate-500 italic">
          {QUOTATION_FOOTER}
        </div>

        {/* Audit footer indicator */}
        <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-400">
          Bilyo Platform Staff Inspection Mode · Quotation Owner User ID:{' '}
          <Link
            href={`/admin/users/${doc.userId}`}
            className="font-mono text-indigo-600 hover:underline"
          >
            {doc.userId}
          </Link>
        </div>
      </div>
    </div>
  );
}

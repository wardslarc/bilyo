import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/guard';
import { lookupDocumentAcrossUsers } from '@/lib/admin/lookup';
import { SupportLookupForm } from '@/components/admin/SupportLookupForm';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Support Document Lookup · Bilyo Admin',
  description: 'Locate any invoice or quotation across all platform accounts by document number or public token.',
};

interface AdminLookupPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminLookupPage({
  searchParams,
}: AdminLookupPageProps) {
  await requireAdmin();

  const resolvedParams = await searchParams;
  const rawQuery = typeof resolvedParams.q === 'string' ? resolvedParams.q.trim() : '';

  let lookupResult = null;
  if (rawQuery) {
    lookupResult = await lookupDocumentAcrossUsers(rawQuery);

    // M7-T04: Single match immediately jumps to read-only view
    if (lookupResult.ok && lookupResult.matches.length === 1) {
      const match = lookupResult.matches[0];
      redirect(`/admin/documents/${match.kind}/${match.id}`);
    }
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-1">
          <span>Support Operations</span>
          <span>•</span>
          <span>Cross-User Search</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Support Document Lookup
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Locate any invoice or quotation across all platform accounts by document number or public link token.
        </p>
      </div>

      {/* Search Input Box */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <SupportLookupForm initialQuery={rawQuery} />
      </div>

      {/* Search Results Area */}
      {lookupResult && (
        <div className="space-y-6">
          {/* Validation Error (e.g. bare prefix or < 4 chars) */}
          {!lookupResult.ok && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 text-amber-900 shadow-sm flex items-start gap-3">
              <svg
                className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <h3 className="font-semibold text-sm text-amber-950">
                  Search Query Rejected
                </h3>
                <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                  {lookupResult.error}
                </p>
              </div>
            </div>
          )}

          {/* Clean Not Found Result (AGENTS.md & DEVELOPMENT_PLAN.md: Clean not found, never an error) */}
          {lookupResult.ok && lookupResult.matches.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-slate-800">
                No document found
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Platform search across all active and archived accounts returned no records matching{' '}
                <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                  {lookupResult.query}
                </span>
                .
              </p>
              <div className="pt-2 text-xs text-slate-400">
                Tip: Ensure you entered the full sequential number (e.g.{' '}
                <span className="font-mono">INV-000042</span>) or unrevoked 12-char public token.
              </div>
            </div>
          )}

          {/* Multiple Matches (Disambiguation across accounts) */}
          {lookupResult.ok && lookupResult.matches.length > 1 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-900 flex items-center justify-between">
                <span>
                  Found <strong className="font-semibold">{lookupResult.matches.length}</strong> documents matching number{' '}
                  <code className="font-mono bg-blue-100 px-1 py-0.5 rounded">
                    {lookupResult.query}
                  </code>{' '}
                  across distinct accounts. Select the document to inspect:
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-4 py-3 text-left">Kind & Number</th>
                        <th className="px-4 py-3 text-left">Account Owner</th>
                        <th className="px-4 py-3 text-left">Customer</th>
                        <th className="px-4 py-3 text-left">Issue Date</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {lookupResult.matches.map((match) => (
                        <tr key={match.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded uppercase ${
                                  match.kind === 'invoice'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-purple-100 text-purple-700'
                                }`}
                              >
                                {match.kind}
                              </span>
                              <span className="font-mono font-bold text-slate-900">
                                {match.number}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">
                              {match.businessName}
                            </div>
                            <div className="text-slate-500 font-mono text-[11px]">
                              {match.userEmail}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {match.customerName}
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                            {formatDate(match.issueDate)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                            {formatMoney(match.totalCentavos)}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                                match.status === 'PAID' || match.status === 'ACCEPTED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : match.status === 'SENT'
                                    ? 'bg-blue-100 text-blue-800'
                                    : match.status === 'CANCELLED' || match.status === 'DECLINED'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {match.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <Link
                              href={`/admin/documents/${match.kind}/${match.id}`}
                              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold"
                            >
                              <span>Inspect</span>
                              <span>→</span>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Guidance Cards when no active query */}
      {!rawQuery && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              1
            </div>
            <h3 className="font-semibold text-sm text-slate-900">Direct Document Jump</h3>
            <p className="text-slate-500 leading-relaxed">
              Entering an exact document number or customer token resolves the target and immediately jumps to the immutable read-only view.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              2
            </div>
            <h3 className="font-semibold text-sm text-slate-900">Guarded Cross-User Scope</h3>
            <p className="text-slate-500 leading-relaxed">
              Lookup operates exclusively through indexed fields. Bare prefixes like &ldquo;INV-&rdquo; are explicitly barred to prevent dumping platform data.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              3
            </div>
            <h3 className="font-semibold text-sm text-slate-900">Immutable Audit Trail</h3>
            <p className="text-slate-500 leading-relaxed">
              Every search query — including unknown lookups and resolved targets — appends a permanent entry to the platform audit log.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

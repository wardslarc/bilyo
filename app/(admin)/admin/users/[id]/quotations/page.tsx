import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/guard';
import { getAdminUserQuotations } from '@/lib/admin/users';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'User Quotations · Bilyo Admin',
  description: 'Inspect all quotations issued by this account in read-only mode.',
};

interface AdminUserQuotationsPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminUserQuotationsPage({
  params,
}: AdminUserQuotationsPageProps) {
  await requireAdmin();
  const { id } = await params;

  const data = await getAdminUserQuotations(id);
  if (!data) {
    notFound();
  }

  const { user, quotations } = data;

  return (
    <div className="space-y-6">
      {/* Breadcrumb / Nav */}
      <div>
        <Link
          href={`/admin/users/${id}`}
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
          Back to User Profile ({user.name})
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Quotations for {user.name}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5 font-mono">{user.email}</p>
          </div>
          <div className="text-sm text-slate-500 font-medium bg-slate-100 px-3 py-1.5 rounded-md self-start sm:self-auto font-mono">
            Total Quotes: {quotations.length}
          </div>
        </div>
      </div>

      {/* Read-Only Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-slate-400"
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
          <span>
            <strong>READ-ONLY AUDIT VIEW:</strong> Platform admins cannot edit, send,
            or delete quotations belonging to this account.
          </span>
        </div>
        <span className="text-slate-400 font-mono text-[11px]">User ID: {user.id}</span>
      </div>

      {/* Quotations Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {quotations.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            <svg
              className="w-10 h-10 mx-auto text-slate-300 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            No quotations created by this user yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3 text-left">Quote Number</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Issue Date</th>
                  <th className="px-4 py-3 text-left">Valid Until</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Amount (PHP)</th>
                  <th className="px-4 py-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {quotations.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-slate-900">
                      {doc.number}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700 font-medium">
                      {doc.customerName}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                      {formatDate(doc.issueDate)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                      {doc.validUntil ? formatDate(doc.validUntil) : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
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
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right font-mono font-semibold text-slate-900">
                      {formatMoney(doc.totalCentavos)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <Link
                        href={`/admin/quotations/${doc.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-sm transition-colors"
                      >
                        <svg
                          className="w-3.5 h-3.5 text-slate-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

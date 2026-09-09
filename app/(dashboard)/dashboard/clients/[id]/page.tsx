import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getClientWithHistory } from '@/actions/customers';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import { getDerivedQuotationStatus, getStatusBadgeConfig } from '@/lib/documents';

export const dynamic = 'force-dynamic';

interface ClientDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ClientDetailPageProps) {
  const { id } = await params;
  const res = await getClientWithHistory(id);
  if (!res.ok || !res.data) {
    return { title: 'Client Not Found · Bilyo' };
  }
  return {
    title: `${res.data.client.name} · Clients · Bilyo`,
    description: `Contact information and quotation history for ${res.data.client.name}.`,
  };
}

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const { id } = await params;
  const res = await getClientWithHistory(id);

  if (!res.ok || !res.data) {
    notFound();
  }

  const { client, quotations, stats } = res.data;

  return (
    <div className="space-y-6">
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <Link href="/dashboard/clients" className="hover:underline">
          Clients
        </Link>
        <span>/</span>
        <span className="text-neutral-900 font-medium">{client.name}</span>
      </div>

      {/* Header section with actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              {client.name}
            </h1>
            {client.archived && (
              <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-neutral-200 text-neutral-700">
                Archived
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Client details and quotation history.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href={`/dashboard/clients/${client.id}/edit`}
            className="px-3.5 py-2 text-sm font-medium rounded-lg text-neutral-700 bg-white border border-[var(--color-line)] hover:bg-neutral-50 transition-colors"
          >
            Edit Client
          </Link>
          <Link
            href={`/dashboard/quotations/new?customerId=${client.id}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg text-white bg-[var(--color-brass)] hover:opacity-90 transition-opacity shadow-xs"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Quotation
          </Link>
        </div>
      </div>

      {/* Client Overview Card & Stat Tiles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info Card */}
        <div className="bg-white border border-[var(--color-line)] rounded-xl p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-semibold text-neutral-900 border-b border-neutral-100 pb-2">
            Contact Information
          </h2>

          <dl className="space-y-3 text-xs">
            <div>
              <dt className="text-neutral-400 font-medium">Email</dt>
              <dd className="text-neutral-800 mt-0.5 font-medium">
                {client.email ? (
                  <a href={`mailto:${client.email}`} className="text-[var(--color-primary)] hover:underline">
                    {client.email}
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </div>

            <div>
              <dt className="text-neutral-400 font-medium">Phone</dt>
              <dd className="text-neutral-800 mt-0.5">
                {client.phone ? (
                  <a href={`tel:${client.phone}`} className="hover:underline">
                    {client.phone}
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </div>

            <div>
              <dt className="text-neutral-400 font-medium">Billing Address</dt>
              <dd className="text-neutral-800 mt-0.5 whitespace-pre-line">
                {client.address || '—'}
              </dd>
            </div>

            {client.notes && (
              <div>
                <dt className="text-neutral-400 font-medium">Internal Notes</dt>
                <dd className="text-neutral-700 mt-0.5 whitespace-pre-line bg-neutral-50 p-2.5 rounded-lg border border-neutral-100 text-xs">
                  {client.notes}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* 4 Summary Stat Tiles */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-[var(--color-line)] rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <span className="text-xs font-medium text-neutral-500">Total Quoted</span>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-bold text-neutral-900">
                {formatMoney(stats.totalQuotedCentavos)}
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Lifetime proposals issued
              </p>
            </div>
          </div>

          <div className="bg-white border border-[var(--color-line)] rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <span className="text-xs font-medium text-neutral-500">Total Accepted</span>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-bold text-emerald-700">
                {formatMoney(stats.totalAcceptedCentavos)}
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Confirmed business
              </p>
            </div>
          </div>

          <div className="bg-white border border-[var(--color-line)] rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <span className="text-xs font-medium text-neutral-500">Quotations</span>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-bold text-neutral-900">
                {stats.quotationCount}
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Total quotation documents
              </p>
            </div>
          </div>

          <div className="bg-white border border-[var(--color-line)] rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <span className="text-xs font-medium text-neutral-500">Accepted Quotes</span>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-bold text-emerald-700">
                {stats.acceptedCount}
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                {stats.quotationCount > 0
                  ? `${Math.round((stats.acceptedCount / stats.quotationCount) * 100)}% conversion rate`
                  : 'No quotes yet'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quotation History List */}
      <div className="bg-white border border-[var(--color-line)] rounded-xl shadow-xs overflow-hidden space-y-0">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Quotation History</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              History of all quotations issued to {client.name}.
            </p>
          </div>
        </div>

        {quotations.length === 0 ? (
          <div className="p-8 sm:p-12 text-center max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-neutral-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-neutral-900">
              No quotations for this client yet
            </h3>
            <p className="text-xs text-neutral-500">
              Create and send your first quotation to start tracking proposals.
            </p>
            <div className="pt-2">
              <Link
                href={`/dashboard/quotations/new?customerId=${client.id}`}
                className="inline-block px-4 py-2 bg-[var(--color-brass)] hover:opacity-90 text-white font-medium text-xs rounded-lg transition-opacity"
              >
                Create quotation for {client.name}
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50 border-b border-[var(--color-line)] text-xs text-neutral-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Quotation #</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Issue Date</th>
                    <th className="px-5 py-3 font-medium">Valid Until</th>
                    <th className="px-5 py-3 font-medium text-right">Total</th>
                    <th className="px-5 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line)]">
                  {quotations.map((q) => {
                    const derivedStatus = getDerivedQuotationStatus(q.status, q.validUntil);
                    const badge = getStatusBadgeConfig(derivedStatus);
                    return (
                      <tr key={q.id} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-neutral-900">
                          <Link
                            href={`/dashboard/quotations/${q.id}`}
                            className="text-[var(--color-primary)] hover:underline font-mono text-xs"
                          >
                            {q.number}
                          </Link>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-neutral-600">
                          {formatDate(q.issueDate)}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-neutral-600">
                          {formatDate(q.validUntil)}
                        </td>
                        <td className="px-5 py-3.5 text-xs font-semibold text-neutral-900 text-right">
                          {formatMoney(q.totalCentavos)}
                        </td>
                        <td className="px-5 py-3.5 text-right text-xs">
                          <Link
                            href={`/dashboard/quotations/${q.id}`}
                            className="font-medium text-[var(--color-brass)] hover:underline"
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View (390px responsive) */}
            <div className="md:hidden divide-y divide-[var(--color-line)]">
              {quotations.map((q) => {
                const derivedStatus = getDerivedQuotationStatus(q.status, q.validUntil);
                const badge = getStatusBadgeConfig(derivedStatus);
                return (
                  <div key={q.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/dashboard/quotations/${q.id}`}
                        className="font-mono text-xs font-bold text-[var(--color-primary)] hover:underline"
                      >
                        {q.number}
                      </Link>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-neutral-500">Issued {formatDate(q.issueDate)}</span>
                      <span className="font-semibold text-neutral-900">{formatMoney(q.totalCentavos)}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-neutral-400 pt-1 border-t border-neutral-100">
                      <span>Valid until: {formatDate(q.validUntil)}</span>
                      <Link
                        href={`/dashboard/quotations/${q.id}`}
                        className="font-medium text-[var(--color-brass)] hover:underline"
                      >
                        View quote →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

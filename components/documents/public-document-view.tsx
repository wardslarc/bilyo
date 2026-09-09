import React from 'react';
import Image from 'next/image';
import type { PublicDocumentProjection } from '@/lib/public-projection';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import { getStatusBadgeConfig, getDocumentPdfDisclaimer } from '@/lib/documents';

interface PublicDocumentViewProps {
  document: PublicDocumentProjection;
  pdfDownloadUrl: string;
}

export function PublicDocumentView({
  document: doc,
  pdfDownloadUrl,
}: PublicDocumentViewProps) {
  const badge = getStatusBadgeConfig(doc.status);
  const title = 'QUOTATION';
  const disclaimer = getDocumentPdfDisclaimer();

  return (
    <div className="min-h-screen bg-neutral-100/70 py-8 px-4 sm:px-6 lg:px-8 font-sans antialiased text-neutral-800">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Top Action Bar: Clean, standalone, Download PDF CTA */}
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-full border ${badge.className}`}
          >
            {badge.label}
          </span>
          <a
            href={pdfDownloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[var(--color-ink)] hover:opacity-90 rounded-lg shadow-sm transition-opacity"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            Download PDF
          </a>
        </div>

        {/* Main Document Paper */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl shadow-sm p-6 sm:p-10 space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-neutral-100 pb-8">
            <div className="space-y-2">
              {doc.business.logoUrl ? (
                <div className="relative w-24 h-16 mb-2">
                  <Image
                    src={doc.business.logoUrl}
                    alt={doc.business.businessName}
                    fill
                    sizes="96px"
                    className="object-contain object-left"
                    priority
                  />
                </div>
              ) : null}
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
                {doc.business.businessName}
              </h1>
              {doc.business.address && (
                <p className="text-xs text-neutral-500 whitespace-pre-line max-w-xs">
                  {doc.business.address}
                </p>
              )}
              {doc.business.email && (
                <p className="text-xs text-neutral-500">{doc.business.email}</p>
              )}
              {doc.business.phone && (
                <p className="text-xs text-neutral-500">{doc.business.phone}</p>
              )}
            </div>

            <div className="sm:text-right space-y-1">
              <span className="text-2xl font-bold text-[var(--color-brass)] tracking-tight block">
                {title}
              </span>
              <span className="font-mono text-xs text-neutral-500 block">
                {doc.number}
              </span>
            </div>
          </div>

          {/* Details Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs border-b border-neutral-100 pb-8">
            <div className="space-y-1.5">
              <span className="font-semibold text-neutral-400 uppercase tracking-wider text-[10px] block">
                Prepared For
              </span>
              <p className="font-bold text-sm text-neutral-900">
                {doc.customer.name}
              </p>
              {doc.customer.address && (
                <p className="text-neutral-600 whitespace-pre-line">
                  {doc.customer.address}
                </p>
              )}
              {doc.customer.email && (
                <p className="text-neutral-500">{doc.customer.email}</p>
              )}
              {doc.customer.phone && (
                <p className="text-neutral-500">{doc.customer.phone}</p>
              )}
            </div>

            <div className="sm:text-right space-y-1.5">
              <span className="font-semibold text-neutral-400 uppercase tracking-wider text-[10px] block">
                Document Dates
              </span>
              <p className="text-neutral-700">
                <span className="text-neutral-500">Issue Date: </span>
                <span className="font-medium">{formatDate(doc.issueDate)}</span>
              </p>
              <p className="text-neutral-700">
                <span className="text-neutral-500">
                  {doc.secondaryDateLabel}:{' '}
                </span>
                <span className="font-medium">
                  {formatDate(doc.secondaryDate)}
                </span>
              </p>
              {doc.paidAt && (
                <p className="text-emerald-700">
                  <span className="font-medium">Paid on: </span>
                  {formatDate(doc.paidAt)}
                </p>
              )}
            </div>
          </div>

          {/* Line Items Table (Desktop) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 pr-2 w-8">#</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right w-16">Qty</th>
                  <th className="py-2.5 px-3 text-right w-28">Unit Price</th>
                  <th className="py-2.5 pl-3 text-right w-28">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {doc.items.map((item, index) => (
                  <tr key={index} className="text-neutral-700">
                    <td className="py-3 pr-2 text-neutral-400">{index + 1}</td>
                    <td className="py-3 px-3 font-medium text-neutral-900">
                      {item.description}
                    </td>
                    <td className="py-3 px-3 text-right">{item.quantity}</td>
                    <td className="py-3 px-3 text-right font-mono">
                      {formatMoney(item.unitPriceCentavos)}
                    </td>
                    <td className="py-3 pl-3 text-right font-mono font-medium text-neutral-900">
                      {formatMoney(item.amountCentavos)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Line Items Cards (Mobile ≤ 390px) */}
          <div className="sm:hidden divide-y divide-neutral-100">
            {doc.items.map((item, index) => (
              <div key={index} className="py-3 space-y-1 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-neutral-900">
                    {item.description}
                  </span>
                  <span className="font-mono font-semibold text-neutral-900 shrink-0">
                    {formatMoney(item.amountCentavos)}
                  </span>
                </div>
                <div className="text-neutral-500 text-[11px]">
                  {item.quantity} × {formatMoney(item.unitPriceCentavos)}
                </div>
              </div>
            ))}
          </div>

          {/* Totals Section */}
          <div className="flex justify-end border-t border-neutral-200 pt-6">
            <div className="w-full sm:w-64 space-y-2 text-xs">
              <div className="flex justify-between text-neutral-600">
                <span>Subtotal</span>
                <span className="font-mono font-medium">
                  {formatMoney(doc.subtotalCentavos)}
                </span>
              </div>

              {doc.discountCentavos > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount</span>
                  <span className="font-mono font-medium">
                    -{formatMoney(doc.discountCentavos)}
                  </span>
                </div>
              )}

              <div className="border-t border-neutral-200 pt-2 flex justify-between text-sm font-bold text-neutral-900">
                <span>Total</span>
                <span className="font-mono text-base text-[var(--color-brass)]">
                  {formatMoney(doc.totalCentavos)}
                </span>
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          {(doc.notes || doc.terms) && (
            <div className="border-t border-neutral-100 pt-6 space-y-4 text-xs">
              {doc.notes && (
                <div>
                  <span className="font-semibold text-neutral-700 block mb-1">
                    Notes
                  </span>
                  <p className="text-neutral-600 whitespace-pre-line leading-relaxed">
                    {doc.notes}
                  </p>
                </div>
              )}
              {doc.terms && (
                <div>
                  <span className="font-semibold text-neutral-700 block mb-1">
                    Terms & Conditions
                  </span>
                  <p className="text-neutral-600 whitespace-pre-line leading-relaxed">
                    {doc.terms}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Disclaimer Footer */}
          <div className="border-t border-neutral-100 pt-6 text-center">
            <p className="text-[11px] text-neutral-400 italic">{disclaimer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

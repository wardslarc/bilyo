import React from 'react';
import type { PublicDocumentProjection } from '@/lib/public-projection';
import { formatMoney } from '@/lib/money';
import { QUOTATION_FOOTER } from '@/lib/documents';
import { QuoteHeader } from './quote-header';
import { ResponseForm } from './response-form';

interface QuotePageProps {
  document: PublicDocumentProjection;
  code: string;
}

export function QuotePage({ document: doc, code }: QuotePageProps) {
  const pdfDownloadUrl = `/api/public/q/${code}/pdf`;
  const currency = doc.currency || 'PHP';

  return (
    <div className="min-h-screen bg-neutral-100/70 py-6 sm:py-12 px-3 sm:px-6 lg:px-8 font-sans antialiased text-neutral-800">
      <main className="max-w-3xl mx-auto space-y-6">
        {/* Main Paper Document Container */}
        <article className="bg-white border border-neutral-200/80 rounded-2xl shadow-sm p-4 sm:p-8 md:p-10 space-y-8">
          {/* Document Header */}
          <QuoteHeader document={doc} pdfDownloadUrl={pdfDownloadUrl} />

          {/* Line Items Section */}
          <section aria-labelledby="line-items-heading" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2
                id="line-items-heading"
                className="text-xs font-bold uppercase tracking-wider text-neutral-500"
              >
                Line Items
              </h2>
              <span className="text-xs text-neutral-400">
                {doc.items.length} {doc.items.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {/* Desktop Table View (sm and up) */}
            <div className="hidden sm:block overflow-x-auto border border-neutral-200/70 rounded-xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50/80 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider border-b border-neutral-200/70">
                  <tr>
                    <th scope="col" className="py-3 px-4 w-12 text-center text-neutral-400 font-mono">
                      #
                    </th>
                    <th scope="col" className="py-3 px-4">
                      Description
                    </th>
                    <th scope="col" className="py-3 px-4 text-center w-20">
                      Qty
                    </th>
                    <th scope="col" className="py-3 px-4 text-right w-32">
                      Unit Price
                    </th>
                    <th scope="col" className="py-3 px-4 text-right w-36">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {doc.items.map((item, index) => (
                    <tr
                      key={index}
                      className="hover:bg-neutral-50/50 transition-colors"
                    >
                      <td className="py-3.5 px-4 text-center text-xs font-mono text-neutral-400">
                        {index + 1}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-neutral-900 leading-snug break-words">
                        {item.description}
                      </td>
                      <td className="py-3.5 px-4 text-center text-neutral-600 font-mono">
                        {item.quantity}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-neutral-600">
                        {formatMoney(item.unitPriceCentavos, currency)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-neutral-900">
                        {formatMoney(item.amountCentavos, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (phone-first, optimized for 390px) */}
            <div className="sm:hidden space-y-2.5">
              {doc.items.map((item, index) => (
                <div
                  key={index}
                  className="bg-neutral-50/50 border border-neutral-200/70 rounded-xl p-3.5 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-sm text-neutral-900 leading-snug break-words flex-1">
                      {item.description}
                    </span>
                    <span className="font-mono font-bold text-sm text-neutral-900 shrink-0">
                      {formatMoney(item.amountCentavos, currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-neutral-500 pt-1 border-t border-neutral-200/40 font-mono">
                    <span>
                      {item.quantity} × {formatMoney(item.unitPriceCentavos, currency)}
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      #{index + 1}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Totals Section */}
          <section
            aria-label="Quotation Totals"
            className="flex flex-col items-end border-t border-neutral-200/80 pt-6"
          >
            <div className="w-full sm:w-80 space-y-3 bg-neutral-50/60 p-4 sm:p-5 rounded-xl border border-neutral-200/60">
              <div className="flex justify-between text-sm text-neutral-600">
                <span>Subtotal</span>
                <span className="font-mono font-medium text-neutral-900">
                  {formatMoney(doc.subtotalCentavos, currency)}
                </span>
              </div>

              {doc.discountCentavos > 0 && (
                <div className="flex justify-between text-sm text-rose-600">
                  <span>Discount</span>
                  <span className="font-mono font-medium">
                    -{formatMoney(doc.discountCentavos, currency)}
                  </span>
                </div>
              )}

              {/* Total: Unmissable Brass/Ink Headline */}
              <div className="border-t border-neutral-200/80 pt-3 flex items-baseline justify-between">
                <span className="text-base font-bold text-neutral-900 uppercase tracking-wide">
                  Total
                </span>
                <span className="font-mono text-2xl sm:text-3xl font-extrabold text-[var(--color-brass)] tracking-tight">
                  {formatMoney(doc.totalCentavos, currency)}
                </span>
              </div>
            </div>
          </section>

          {/* Notes and Terms & Conditions */}
          {(doc.notes || doc.terms) && (
            <section aria-label="Additional Details" className="border-t border-neutral-100 pt-6 space-y-4">
              {doc.notes && (
                <div className="bg-neutral-50/40 rounded-xl p-4 border border-neutral-100">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5">
                    Notes
                  </h3>
                  <p className="text-sm text-neutral-600 whitespace-pre-line leading-relaxed break-words">
                    {doc.notes}
                  </p>
                </div>
              )}
              {doc.terms && (
                <div className="bg-neutral-50/40 rounded-xl p-4 border border-neutral-100">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5">
                    Terms & Conditions
                  </h3>
                  <p className="text-sm text-neutral-600 whitespace-pre-line leading-relaxed break-words">
                    {doc.terms}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Client Response Form: Accept / Decline (§6.7, P3-T02) */}
          <section aria-label="Respond to Quotation" className="border-t border-neutral-200/80 pt-6">
            <ResponseForm
              code={code}
              quotationNumber={doc.number}
              businessName={doc.business.businessName}
              status={doc.status}
              validUntil={doc.secondaryDate}
              respondedAt={doc.respondedAt}
              respondedByName={doc.respondedByName}
            />
          </section>

          {/* Secondary PDF Download & Action Footer */}
          <div className="border-t border-neutral-200/80 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <a
              href={pdfDownloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200/80 rounded-xl shadow-sm transition-colors border border-neutral-200/80"
            >
              <svg
                className="w-4 h-4 text-neutral-500"
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
              Download PDF Copy
            </a>

            <span className="text-xs text-neutral-400 font-mono">
              Reference: {doc.number}
            </span>
          </div>

          {/* Required Quotation Disclaimer Footer (§2.3, AGENTS.md §3) */}
          <footer className="border-t border-neutral-100 pt-6 text-center">
            <p className="text-[11px] text-neutral-400 italic leading-relaxed">
              {QUOTATION_FOOTER}
            </p>
          </footer>
        </article>
      </main>
    </div>
  );
}

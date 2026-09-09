import React from 'react';
import Image from 'next/image';
import type { PublicDocumentProjection } from '@/lib/public-projection';
import { formatDate } from '@/lib/dates';
import { getStatusBadgeConfig } from '@/lib/documents';

interface QuoteHeaderProps {
  document: PublicDocumentProjection;
  pdfDownloadUrl?: string;
}

export function QuoteHeader({ document: doc, pdfDownloadUrl }: QuoteHeaderProps) {
  const badge = getStatusBadgeConfig(doc.status);

  // Fallback initial for logo
  const businessInitials = doc.business.businessName
    ? doc.business.businessName
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : 'Q';

  return (
    <header className="space-y-6">
      {/* Top Bar: Status + Action */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-neutral-200/60">
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-mono tracking-widest text-neutral-400 uppercase">
            Quotation
          </span>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-full border ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>

        {pdfDownloadUrl && (
          <a
            href={pdfDownloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200/80 rounded-lg transition-colors border border-neutral-200/80 shrink-0"
          >
            <svg
              className="w-3.5 h-3.5 text-neutral-500"
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
        )}
      </div>

      {/* Main Branding & Quote Reference Block */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
        {/* Business Branding */}
        <div className="space-y-2 max-w-sm">
          {doc.business.logoUrl ? (
            <div className="relative w-28 h-16 mb-2">
              <Image
                src={doc.business.logoUrl}
                alt={doc.business.businessName}
                fill
                sizes="112px"
                className="object-contain object-left"
                priority
              />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-600 to-amber-700 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              {businessInitials}
            </div>
          )}

          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight break-words">
            {doc.business.businessName}
          </h1>

          {(doc.business.address || doc.business.email || doc.business.phone) && (
            <div className="text-xs text-neutral-500 space-y-0.5 leading-relaxed">
              {doc.business.address && (
                <p className="whitespace-pre-line">{doc.business.address}</p>
              )}
              {doc.business.email && <p>{doc.business.email}</p>}
              {doc.business.phone && <p>{doc.business.phone}</p>}
            </div>
          )}
        </div>

        {/* Quotation Metadata Card */}
        <div className="sm:text-right space-y-1 sm:self-start bg-neutral-50/80 sm:bg-transparent p-4 sm:p-0 rounded-xl sm:rounded-none border sm:border-0 border-neutral-100">
          <p className="text-xs text-neutral-400 uppercase tracking-wider font-medium">
            Quotation Reference
          </p>
          <p className="text-xl sm:text-2xl font-mono font-bold text-neutral-900 tracking-tight">
            {doc.number}
          </p>
          <div className="text-xs text-neutral-500 pt-1 space-y-0.5">
            <p>
              <span className="text-neutral-400">Issued: </span>
              {formatDate(doc.issueDate)}
            </p>
            <p>
              <span className="text-neutral-400">Valid Until: </span>
              <span className="font-semibold text-neutral-700">
                {formatDate(doc.secondaryDate)}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Recipient Details: Prepared For */}
      <div className="bg-neutral-50/60 rounded-xl p-4 sm:p-5 border border-neutral-200/60">
        <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
          Prepared For
        </span>
        <p className="text-base font-semibold text-neutral-900 break-words">
          {doc.customer.name}
        </p>
        {(doc.customer.email || doc.customer.phone || doc.customer.address) && (
          <div className="text-xs text-neutral-600 mt-1 space-y-0.5">
            {doc.customer.email && <p>{doc.customer.email}</p>}
            {doc.customer.phone && <p>{doc.customer.phone}</p>}
            {doc.customer.address && (
              <p className="whitespace-pre-line">{doc.customer.address}</p>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

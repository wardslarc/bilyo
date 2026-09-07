'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  createQuotation,
  updateQuotation,
  convertQuotationToInvoice,
  type SerializedQuotation,
} from '@/actions/quotations';
import { type SerializedBusiness } from '@/actions/business';
import {
  DocumentForm,
  type DocumentFormPayload,
} from '@/components/documents/document-form';
import type { DocumentStatus } from '@/lib/documents';

export interface QuotationFormProps {
  /** Pass for editing an existing quotation */
  initialQuotation?: SerializedQuotation | null;
  /** Pre-loaded business profile (for VAT status) */
  business: SerializedBusiness;
}

export function QuotationForm({ initialQuotation, business }: QuotationFormProps) {
  const router = useRouter();
  const isEditing = Boolean(initialQuotation?.id);
  const [isConverting, setIsConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  const initialData = initialQuotation
    ? {
        id: initialQuotation.id,
        number: initialQuotation.number,
        status: initialQuotation.status as DocumentStatus,
        customerId: initialQuotation.customerId,
        items: initialQuotation.items,
        discountCentavos: initialQuotation.discountCentavos,
        issueDate: initialQuotation.issueDate,
        secondaryDate: initialQuotation.validUntil,
        notes: initialQuotation.notes,
        terms: initialQuotation.terms,
      }
    : null;

  const handleSubmit = async (payload: DocumentFormPayload) => {
    const quotationPayload = {
      customerId: payload.customerId,
      items: payload.items,
      discount: payload.discount,
      issueDate: payload.issueDate,
      validUntil: payload.secondaryDate,
      notes: payload.notes,
      terms: payload.terms,
    };

    if (isEditing && initialQuotation) {
      return await updateQuotation(initialQuotation.id, quotationPayload);
    }
    return await createQuotation(quotationPayload);
  };

  const handleSuccess = (savedId: string) => {
    if (!isEditing) {
      router.push(`/dashboard/quotations/${savedId}`);
      router.refresh();
    }
  };

  const handleConvert = async () => {
    if (!initialQuotation?.id) return;
    setIsConverting(true);
    setConvertError(null);
    const res = await convertQuotationToInvoice(initialQuotation.id);
    if (!res.ok) {
      setConvertError(res.error);
      setIsConverting(false);
      return;
    }
    router.push(`/dashboard/invoices/${res.data.id}`);
  };

  const headerBanner = (
    <>
      {convertError && (
        <div
          role="alert"
          className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg"
        >
          {convertError}
        </div>
      )}
      {initialQuotation?.convertedInvoiceId && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg flex items-center justify-between gap-2">
          <span>This quotation has been converted to an invoice.</span>
          <Link
            href={`/dashboard/invoices/${initialQuotation.convertedInvoiceId}`}
            className="font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
          >
            View Invoice →
          </Link>
        </div>
      )}
    </>
  );

  const canConvert =
    Boolean(initialQuotation?.id) &&
    !initialQuotation?.convertedInvoiceId &&
    (initialQuotation?.status === 'SENT' || initialQuotation?.status === 'ACCEPTED');

  const extraActions = canConvert ? (
    <button
      type="button"
      onClick={handleConvert}
      disabled={isConverting}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-40"
    >
      {isConverting ? 'Converting…' : 'Convert to Invoice'}
    </button>
  ) : null;

  return (
    <DocumentForm
      kind="quotation"
      initialData={initialData}
      business={business}
      onSubmit={handleSubmit}
      pdfUrl={
        isEditing && initialQuotation
          ? `/api/quotations/${initialQuotation.id}/pdf`
          : undefined
      }
      backHref="/dashboard/quotations"
      onSuccess={handleSuccess}
      headerBanner={headerBanner}
      extraActions={extraActions}
    />
  );
}

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  createQuotation,
  updateQuotation,
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
    />
  );
}

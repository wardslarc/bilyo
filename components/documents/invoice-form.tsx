'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  createInvoice,
  updateInvoice,
  type SerializedInvoice,
} from '@/actions/invoices';
import { type SerializedBusiness } from '@/actions/business';
import {
  DocumentForm,
  type DocumentFormPayload,
} from '@/components/documents/document-form';
import type { DocumentStatus } from '@/lib/documents';

export interface InvoiceFormProps {
  /** Pass for editing an existing invoice */
  initialInvoice?: SerializedInvoice | null;
  /** Pre-loaded business profile (for VAT status) */
  business: SerializedBusiness;
}

export function InvoiceForm({ initialInvoice, business }: InvoiceFormProps) {
  const router = useRouter();
  const isEditing = Boolean(initialInvoice?.id);

  const initialData = initialInvoice
    ? {
        id: initialInvoice.id,
        number: initialInvoice.number,
        status: initialInvoice.status as DocumentStatus,
        customerId: initialInvoice.customerId,
        items: initialInvoice.items,
        discountCentavos: initialInvoice.discountCentavos,
        issueDate: initialInvoice.issueDate,
        secondaryDate: initialInvoice.dueDate,
        notes: initialInvoice.notes,
        terms: initialInvoice.terms,
      }
    : null;

  const handleSubmit = async (payload: DocumentFormPayload) => {
    const invoicePayload = {
      customerId: payload.customerId,
      items: payload.items,
      discount: payload.discount,
      issueDate: payload.issueDate,
      dueDate: payload.secondaryDate,
      notes: payload.notes,
      terms: payload.terms,
    };

    if (isEditing && initialInvoice) {
      return await updateInvoice(initialInvoice.id, invoicePayload);
    }
    return await createInvoice(invoicePayload);
  };

  const handleSuccess = (savedId: string) => {
    if (!isEditing) {
      router.push(`/dashboard/invoices/${savedId}`);
      router.refresh();
    }
  };

  return (
    <DocumentForm
      kind="invoice"
      initialData={initialData}
      business={business}
      onSubmit={handleSubmit}
      pdfUrl={
        isEditing && initialInvoice
          ? `/api/invoices/${initialInvoice.id}/pdf`
          : undefined
      }
      backHref="/dashboard/invoices"
      onSuccess={handleSuccess}
    />
  );
}

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  createInvoice,
  updateInvoice,
  sendInvoice,
  markInvoicePaid,
  cancelInvoice,
  type SerializedInvoice,
} from '@/actions/invoices';
import { type SerializedBusiness } from '@/actions/business';
import {
  DocumentForm,
  type DocumentFormPayload,
} from '@/components/documents/document-form';
import type { DocumentStatus } from '@/lib/documents';
import { formatDate } from '@/lib/dates';

export interface InvoiceFormProps {
  /** Pass for editing an existing invoice */
  initialInvoice?: SerializedInvoice | null;
  /** Pre-loaded business profile (for VAT status) */
  business: SerializedBusiness;
}

export function InvoiceForm({ initialInvoice, business }: InvoiceFormProps) {
  const router = useRouter();
  const isEditing = Boolean(initialInvoice?.id);
  const [isActionPending, startActionTransition] = React.useTransition();
  const [actionError, setActionError] = React.useState<string | null>(null);

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

  const handleSend = () => {
    if (!initialInvoice) return;
    if (
      !confirm(
        'Send this invoice? Customer and business details will be locked into snapshots.'
      )
    )
      return;
    startActionTransition(async () => {
      const res = await sendInvoice(initialInvoice.id);
      if (!res.ok) {
        setActionError(res.error);
      } else {
        setActionError(null);
        router.refresh();
      }
    });
  };

  const handleMarkPaid = () => {
    if (!initialInvoice) return;
    if (
      !confirm(
        'Mark this invoice as paid? Line items and totals will be permanently locked.'
      )
    )
      return;
    startActionTransition(async () => {
      const res = await markInvoicePaid(initialInvoice.id);
      if (!res.ok) {
        setActionError(res.error);
      } else {
        setActionError(null);
        router.refresh();
      }
    });
  };

  const handleCancel = () => {
    if (!initialInvoice) return;
    if (!confirm('Cancel this invoice? This action is permanent.')) return;
    startActionTransition(async () => {
      const res = await cancelInvoice(initialInvoice.id);
      if (!res.ok) {
        setActionError(res.error);
      } else {
        setActionError(null);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      {actionError && (
        <div
          role="alert"
          className="max-w-4xl mx-auto p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg"
        >
          {actionError}
        </div>
      )}

      {isEditing && initialInvoice && (
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3 p-4 bg-white border border-[var(--color-line)] rounded-xl shadow-sm">
          <div>
            <span className="text-xs text-neutral-500 font-medium">
              Invoice Status:
            </span>{' '}
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-800">
              {initialInvoice.status}
            </span>
            {initialInvoice.paidAt && (
              <p className="text-xs text-emerald-700 mt-0.5">
                Paid on {formatDate(initialInvoice.paidAt)}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {initialInvoice.status === 'DRAFT' && (
              <button
                type="button"
                disabled={isActionPending}
                onClick={handleSend}
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Send Invoice
              </button>
            )}

            {(initialInvoice.status === 'SENT' ||
              initialInvoice.status === 'OVERDUE') && (
              <button
                type="button"
                disabled={isActionPending}
                onClick={handleMarkPaid}
                className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Mark as Paid
              </button>
            )}

            {(initialInvoice.status === 'DRAFT' ||
              initialInvoice.status === 'SENT' ||
              initialInvoice.status === 'OVERDUE') && (
              <button
                type="button"
                disabled={isActionPending}
                onClick={handleCancel}
                className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel Invoice
              </button>
            )}
          </div>
        </div>
      )}

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
    </div>
  );
}

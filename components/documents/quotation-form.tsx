'use client';

import React, { useState, useTransition, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCustomers, type SerializedCustomer } from '@/actions/customers';
import { type SerializedBusiness } from '@/actions/business';
import {
  createQuotation,
  updateQuotation,
  type SerializedQuotation,
} from '@/actions/quotations';
import {
  LineItemBuilder,
  createEmptyRow,
  type LineItemRow,
} from '@/components/documents/line-item-builder';
import { TotalsPanel } from '@/components/documents/totals-panel';
import { PlanLimitAlert } from '@/components/dashboard/PlanLimitAlert';
import { centavosToPesos } from '@/lib/money';
import type { ComputedTotals } from '@/lib/totals';
import {
  type DocumentStatus,
  toDateInputValue,
  defaultIssueDate,
  defaultSecondaryDate,
  isDocumentEditable,
} from '@/lib/documents';

export interface QuotationFormProps {
  /** Pass for editing an existing quotation */
  initialQuotation?: SerializedQuotation | null;
  /** Pre-loaded business profile (for VAT status) */
  business: SerializedBusiness;
}

export function QuotationForm({ initialQuotation, business }: QuotationFormProps) {
  const router = useRouter();
  const isEditing = Boolean(initialQuotation?.id);
  const [isPending, startTransition] = useTransition();

  // Customer picker state
  const [customers, setCustomers] = useState<SerializedCustomer[]>([]);
  const [customerId, setCustomerId] = useState(initialQuotation?.customerId || '');

  // Line items state
  const [items, setItems] = useState<LineItemRow[]>(() => {
    if (initialQuotation?.items && initialQuotation.items.length > 0) {
      return initialQuotation.items.map((item, i) => ({
        id: `existing-${i}-${Date.now()}`,
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: centavosToPesos(item.unitPriceCentavos).toFixed(2),
      }));
    }
    return [createEmptyRow()];
  });

  // Discount in pesos
  const [discountInput, setDiscountInput] = useState(() => {
    if (initialQuotation && initialQuotation.discountCentavos && initialQuotation.discountCentavos > 0) {
      return centavosToPesos(initialQuotation.discountCentavos).toFixed(2);
    }
    return '';
  });

  // Dates state
  const [issueDate, setIssueDate] = useState(() =>
    initialQuotation?.issueDate ? toDateInputValue(initialQuotation.issueDate) : defaultIssueDate()
  );
  const [validUntil, setValidUntil] = useState(() =>
    initialQuotation?.validUntil
      ? toDateInputValue(initialQuotation.validUntil)
      : defaultSecondaryDate(30)
  );

  // Notes & Terms state
  const [notes, setNotes] = useState(initialQuotation?.notes || '');
  const [terms, setTerms] = useState(initialQuotation?.terms || '');

  // Server totals after save (§3.3)
  const [serverTotals, setServerTotals] = useState<ComputedTotals | null>(null);

  // Errors state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Load active customers
  useEffect(() => {
    let cancelled = false;
    getCustomers({ includeArchived: false }).then((res) => {
      if (!cancelled && res.ok) {
        setCustomers(res.data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isEditable = isDocumentEditable(initialQuotation?.status as DocumentStatus);
  const isLocked = isEditing && !isEditable;

  // Clear server totals when user continues editing
  const handleItemsChange = useCallback((newItems: LineItemRow[]) => {
    setItems(newItems);
    setServerTotals(null);
  }, []);

  const handleDiscountChange = useCallback((value: string) => {
    setDiscountInput(value);
    setServerTotals(null);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});

    startTransition(async () => {
      const payload = {
        customerId,
        items: items.map((row) => ({
          description: row.description,
          quantity: row.quantity,
          unitPrice: row.unitPrice,
        })),
        discount: discountInput || '0',
        issueDate,
        validUntil,
        notes,
        terms,
      };

      const res = isEditing && initialQuotation
        ? await updateQuotation(initialQuotation.id, payload)
        : await createQuotation(payload);

      if (!res.ok) {
        setGeneralError(res.error || 'Failed to save quotation');
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        return;
      }

      if (res.data) {
        const saved = res.data;
        setServerTotals({
          items: saved.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPriceCentavos: i.unitPriceCentavos,
            amountCentavos: i.amountCentavos,
          })),
          subtotalCentavos: saved.subtotalCentavos,
          discountCentavos: saved.discountCentavos,
          vatRatePercent: saved.vatRatePercent,
          vatCentavos: saved.vatCentavos,
          totalCentavos: saved.totalCentavos,
        });

        if (!isEditing) {
          router.push(`/dashboard/quotations/${saved.id}`);
          router.refresh();
        }
      }
    });
  };

  const pdfUrl = initialQuotation?.id ? `/api/quotations/${initialQuotation.id}/pdf` : undefined;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">
            {isEditing
              ? `Edit ${initialQuotation?.number ?? 'Quotation'}`
              : 'New Quotation'}
          </h1>
          {isEditing && initialQuotation?.status && (
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              Status:{' '}
              <span className="font-medium capitalize">
                {initialQuotation.status.toLowerCase()}
              </span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {isEditing && pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors border border-neutral-200"
            >
              <svg
                className="w-3.5 h-3.5"
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
          <Link
            href="/dashboard/quotations"
            className="min-h-[44px] inline-flex items-center px-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            ← Back to quotations
          </Link>
        </div>
      </div>

      {/* Locked banner */}
      {isLocked && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg">
          This quotation is{' '}
          <strong>{initialQuotation?.status?.toLowerCase()}</strong> and cannot be edited.
        </div>
      )}

      {/* General error / Plan limit upgrade prompt */}
      {generalError && (
        <PlanLimitAlert
          error={generalError}
          onDismiss={() => setGeneralError(null)}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer + Dates card */}
        <div className="bg-white border border-[var(--color-line)] rounded-xl shadow-sm p-5 sm:p-6 space-y-5">
          <h2 className="text-sm font-semibold text-[var(--color-text)] border-b border-[var(--color-line-soft)] pb-3">
            Details
          </h2>

          {/* Customer */}
          <div>
            <label
              htmlFor="customerId"
              className="block text-xs font-medium text-neutral-700 mb-1"
            >
              Client <span className="text-red-500">*</span>
            </label>
            <select
              id="customerId"
              value={customerId}
              disabled={isLocked || isPending}
              onChange={(e) => {
                setCustomerId(e.target.value);
                if (fieldErrors.customerId)
                  setFieldErrors((p) => ({ ...p, customerId: '' }));
              }}
              className={`w-full px-3.5 py-2.5 text-sm rounded-lg border ${
                fieldErrors.customerId
                  ? 'border-red-500 bg-red-50/20'
                  : 'border-[var(--color-line)]'
              } focus:outline-none focus:ring-2 focus:ring-[var(--color-brass)]/40 bg-white disabled:bg-[var(--color-paper-sunk)] disabled:cursor-not-allowed`}
            >
              <option value="">Select a client…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.email ? ` (${c.email})` : ''}
                </option>
              ))}
            </select>
            {fieldErrors.customerId && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.customerId}</p>
            )}
            {customers.length === 0 && (
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                No clients yet.{' '}
                <Link
                  href="/dashboard/customers/new"
                  className="text-[var(--color-brass)] hover:underline"
                >
                  Create one
                </Link>
              </p>
            )}
          </div>

          {/* Date grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="issueDate"
                className="block text-xs font-medium text-neutral-700 mb-1"
              >
                Issue Date <span className="text-red-500">*</span>
              </label>
              <input
                id="issueDate"
                type="date"
                value={issueDate}
                disabled={isLocked || isPending}
                onChange={(e) => setIssueDate(e.target.value)}
                className={`w-full px-3.5 py-2.5 text-sm rounded-lg border ${
                  fieldErrors.issueDate
                    ? 'border-red-500 bg-red-50/20'
                    : 'border-[var(--color-line)]'
                } focus:outline-none focus:ring-2 focus:ring-[var(--color-brass)]/40 disabled:bg-[var(--color-paper-sunk)] disabled:cursor-not-allowed`}
              />
              {fieldErrors.issueDate && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.issueDate}</p>
              )}
            </div>
            <div>
              <label
                htmlFor="validUntil"
                className="block text-xs font-medium text-neutral-700 mb-1"
              >
                Valid Until <span className="text-red-500">*</span>
              </label>
              <input
                id="validUntil"
                type="date"
                value={validUntil}
                disabled={isLocked || isPending}
                onChange={(e) => setValidUntil(e.target.value)}
                className={`w-full px-3.5 py-2.5 text-sm rounded-lg border ${
                  fieldErrors.validUntil
                    ? 'border-red-500 bg-red-50/20'
                    : 'border-[var(--color-line)]'
                } focus:outline-none focus:ring-2 focus:ring-[var(--color-brass)]/40 disabled:bg-[var(--color-paper-sunk)] disabled:cursor-not-allowed`}
              />
              {fieldErrors.validUntil && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors.validUntil}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white border border-[var(--color-line)] rounded-xl shadow-sm p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--color-text)] border-b border-[var(--color-line-soft)] pb-3">
            Line Items
          </h2>
          {fieldErrors.items && (
            <p className="text-xs text-red-600">{fieldErrors.items}</p>
          )}
          <LineItemBuilder
            items={items}
            onChange={handleItemsChange}
            disabled={isLocked || isPending}
          />
        </div>

        {/* Totals */}
        <TotalsPanel
          items={items}
          discountInput={discountInput}
          onDiscountChange={handleDiscountChange}
          vatRegistered={business.vatRegistered}
          serverTotals={serverTotals}
          disabled={isLocked || isPending}
        />

        {/* Notes & Terms */}
        <div className="bg-white border border-[var(--color-line)] rounded-xl shadow-sm p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--color-text)] border-b border-[var(--color-line-soft)] pb-3">
            Notes & Terms
          </h2>

          <div>
            <label
              htmlFor="notes"
              className="block text-xs font-medium text-neutral-700 mb-1"
            >
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              disabled={isLocked || isPending}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes for the client…"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--color-line)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brass)]/40 disabled:bg-[var(--color-paper-sunk)] disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label
              htmlFor="terms"
              className="block text-xs font-medium text-neutral-700 mb-1"
            >
              Terms & Conditions (Optional)
            </label>
            <textarea
              id="terms"
              rows={3}
              value={terms}
              disabled={isLocked || isPending}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="Payment terms, delivery schedule, etc.…"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--color-line)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brass)]/40 disabled:bg-[var(--color-paper-sunk)] disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Actions */}
        {!isLocked && (
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
            <Link
              href="/dashboard/quotations"
              className="min-h-[44px] flex items-center justify-center px-4 py-2.5 text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-text)] rounded-lg transition-colors border border-[var(--color-line)] sm:border-transparent"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isPending}
              className="min-h-[44px] flex items-center justify-center px-6 py-2.5 bg-[var(--color-brass)] hover:opacity-90 text-white font-medium text-sm rounded-lg transition-opacity disabled:opacity-50"
            >
              {isPending
                ? 'Saving…'
                : isEditing
                  ? 'Save Changes'
                  : 'Create Quotation'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

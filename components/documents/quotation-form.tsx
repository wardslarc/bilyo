'use client';

import React, { useState, useTransition, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCustomers, createCustomer, type SerializedCustomer } from '@/actions/customers';
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
import { centavosToPesos, pesosToCentavos } from '@/lib/money';
import type { ComputedTotals } from '@/lib/totals';
import type { CurrencyCode } from '@/types';
import {
  type DocumentStatus,
  toDateInputValue,
  defaultIssueDate,
  defaultSecondaryDate,
  isDocumentEditable,
  getDerivedQuotationStatus,
  getStatusBadgeConfig,
  QUOTATION_FOOTER,
} from '@/lib/documents';

export interface QuotationFormProps {
  /** Pass for editing an existing quotation */
  initialQuotation?: SerializedQuotation | null;
  /** Pre-loaded business profile */
  business: SerializedBusiness;
}

export function QuotationForm({ initialQuotation, business }: QuotationFormProps) {
  const router = useRouter();
  const [currentId, setCurrentId] = useState<string | null>(initialQuotation?.id || null);
  const isEditing = Boolean(currentId);
  const [isPending, startTransition] = useTransition();

  // Customer picker & inline client create state
  const [customers, setCustomers] = useState<SerializedCustomer[]>([]);
  const [customerId, setCustomerId] = useState(initialQuotation?.customerId || '');
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientError, setNewClientError] = useState<string | null>(null);

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

  // Dates state (default validity +30 days)
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
  const [detailsOpen, setDetailsOpen] = useState(Boolean(initialQuotation?.notes || initialQuotation?.terms));

  // Quotation Currency (§5.1 multi-currency)
  const [currency, setCurrency] = useState<CurrencyCode>(() => {
    return (initialQuotation?.currency as CurrencyCode) || (business?.currency as CurrencyCode) || 'PHP';
  });

  // Server totals after save (§3.3)
  const [serverTotals, setServerTotals] = useState<ComputedTotals | null>(null);

  // Errors state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Autosave status & debounce tracking
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'unsaved'>('idle');
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedJsonRef = useRef<string>('');

  // Status check
  const isEditable = isDocumentEditable((initialQuotation?.status as DocumentStatus) || 'DRAFT');
  const isLocked = isEditing && !isEditable;

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

  // Set initial saved payload if editing
  useEffect(() => {
    if (initialQuotation) {
      lastSavedJsonRef.current = JSON.stringify({
        customerId: initialQuotation.customerId,
        items: initialQuotation.items.map((i) => ({
          description: i.description,
          quantity: String(i.quantity),
          unitPrice: centavosToPesos(i.unitPriceCentavos).toFixed(2),
        })),
        discount: initialQuotation.discountCentavos ? centavosToPesos(initialQuotation.discountCentavos).toFixed(2) : '0',
        issueDate: toDateInputValue(initialQuotation.issueDate),
        validUntil: toDateInputValue(initialQuotation.validUntil),
        notes: initialQuotation.notes || '',
        terms: initialQuotation.terms || '',
      });
    }
  }, [initialQuotation]);

  // Clear server totals when user edits lines
  const handleItemsChange = useCallback((newItems: LineItemRow[]) => {
    setItems(newItems);
    setServerTotals(null);
  }, []);

  const handleDiscountChange = useCallback((value: string) => {
    setDiscountInput(value);
    setServerTotals(null);
  }, []);

  // Validation checker for autosave: never fires on invalid or incomplete lines
  const isPayloadValidForAutosave = useCallback((): boolean => {
    if (isLocked) return false;
    if (!customerId.trim()) return false;
    if (items.length === 0) return false;

    for (const item of items) {
      if (!item.description.trim()) return false;
      const q = Number(item.quantity);
      if (!Number.isFinite(q) || q <= 0) return false;
      try {
        if (!item.unitPrice.trim()) return false;
        const c = pesosToCentavos(item.unitPrice);
        if (!Number.isInteger(c) || c < 0) return false;
      } catch {
        return false;
      }
    }

    if (!issueDate || isNaN(Date.parse(issueDate))) return false;
    if (!validUntil || isNaN(Date.parse(validUntil))) return false;

    return true;
  }, [isLocked, customerId, items, issueDate, validUntil]);

  // Execute background autosave
  const performAutosave = useCallback(async () => {
    if (!isPayloadValidForAutosave()) return;

    const payload = {
      customerId,
      currency,
      items: items.map((row) => ({
        description: row.description.trim(),
        quantity: row.quantity.trim(),
        unitPrice: row.unitPrice.trim(),
      })),
      discount: discountInput || '0',
      issueDate,
      validUntil,
      notes,
      terms,
    };

    const payloadJson = JSON.stringify(payload);
    if (payloadJson === lastSavedJsonRef.current) {
      return;
    }

    setAutosaveStatus('saving');

    try {
      const res = currentId
        ? await updateQuotation(currentId, payload)
        : await createQuotation(payload);

      if (res.ok && res.data) {
        lastSavedJsonRef.current = payloadJson;
        setAutosaveStatus('saved');
        setServerTotals({
          items: res.data.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPriceCentavos: i.unitPriceCentavos,
            amountCentavos: i.amountCentavos,
          })),
          subtotalCentavos: res.data.subtotalCentavos,
          discountCentavos: res.data.discountCentavos,
          totalCentavos: res.data.totalCentavos,
        });

        if (!currentId && res.data.id) {
          setCurrentId(res.data.id);
          window.history.replaceState(null, '', `/dashboard/quotations/${res.data.id}`);
        }
      } else {
        setAutosaveStatus('unsaved');
      }
    } catch {
      setAutosaveStatus('unsaved');
    }
  }, [
    isPayloadValidForAutosave,
    customerId,
    currency,
    items,
    discountInput,
    issueDate,
    validUntil,
    notes,
    terms,
    currentId,
  ]);

  // 2-second idle debounce autosave effect
  useEffect(() => {
    if (isLocked) return;

    if (!isPayloadValidForAutosave()) {
      return;
    }

    const currentJson = JSON.stringify({
      customerId,
      currency,
      items: items.map((row) => ({
        description: row.description.trim(),
        quantity: row.quantity.trim(),
        unitPrice: row.unitPrice.trim(),
      })),
      discount: discountInput || '0',
      issueDate,
      validUntil,
      notes,
      terms,
    });

    if (currentJson === lastSavedJsonRef.current) {
      return;
    }

    setAutosaveStatus('unsaved');

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      performAutosave();
    }, 2000);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [
    customerId,
    currency,
    items,
    discountInput,
    issueDate,
    validUntil,
    notes,
    terms,
    isLocked,
    isPayloadValidForAutosave,
    performAutosave,
  ]);

  // Inline client creation handler
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) {
      setNewClientError('Client name is required');
      return;
    }
    setNewClientError(null);
    setIsCreatingClient(true);

    try {
      const res = await createCustomer({
        name: newClientName.trim(),
        email: newClientEmail.trim(),
        phone: newClientPhone.trim(),
        address: newClientAddress.trim(),
      });

      if (!res.ok) {
        setNewClientError(res.error || 'Failed to create client');
        setIsCreatingClient(false);
        return;
      }

      const created = res.data;
      setCustomers((prev) => [created, ...prev]);
      setCustomerId(created.id);
      setNewClientName('');
      setNewClientEmail('');
      setNewClientPhone('');
      setNewClientAddress('');
      setShowNewClientForm(false);
      setIsCreatingClient(false);
    } catch {
      setNewClientError('Failed to create client');
      setIsCreatingClient(false);
    }
  };

  // Explicit Save / Submit handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});

    startTransition(async () => {
      const payload = {
        customerId,
        currency,
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

      const res = currentId
        ? await updateQuotation(currentId, payload)
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
        lastSavedJsonRef.current = JSON.stringify(payload);
        setAutosaveStatus('saved');
        setServerTotals({
          items: saved.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPriceCentavos: i.unitPriceCentavos,
            amountCentavos: i.amountCentavos,
          })),
          subtotalCentavos: saved.subtotalCentavos,
          discountCentavos: saved.discountCentavos,
          totalCentavos: saved.totalCentavos,
        });

        if (!currentId) {
          router.push(`/dashboard/quotations/${saved.id}`);
          router.refresh();
        }
      }
    });
  };

  const pdfUrl = currentId ? `/api/quotations/${currentId}/pdf` : undefined;
  const displayStatus = initialQuotation
    ? getDerivedQuotationStatus(initialQuotation.status, initialQuotation.validUntil)
    : 'DRAFT';
  const statusBadge = getStatusBadgeConfig(displayStatus);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header with Title and Autosave Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-line-soft)] pb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-[var(--color-text)]">
            {isEditing
              ? `Edit ${initialQuotation?.number ?? 'Quotation'}`
              : 'New Quotation'}
          </h1>

          {/* Status Badge (§6.4, P2-T05) */}
          {isEditing && (
            <span
              className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-full border ${statusBadge.className}`}
            >
              {statusBadge.label}
            </span>
          )}

          {/* Visible Autosave Indicator (§10, P2-T04) */}
          {!isLocked && autosaveStatus !== 'idle' && (
            <div className="transition-opacity">
              {autosaveStatus === 'saving' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium bg-amber-50 text-amber-800 rounded-full border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Saving…
                </span>
              )}
              {autosaveStatus === 'saved' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  Saved
                </span>
              )}
              {autosaveStatus === 'unsaved' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  Unsaved changes
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isEditing && pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors border border-neutral-200"
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
            className="min-h-[40px] inline-flex items-center px-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
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

      {generalError && (
        <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <span>{generalError}</span>
          <button
            type="button"
            onClick={() => setGeneralError(null)}
            className="text-red-500 hover:text-red-700 text-xs font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client & Dates Card */}
        <div className="bg-white border border-[var(--color-line)] rounded-xl shadow-sm p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[var(--color-line-soft)] pb-3">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              Quotation Details
            </h2>
            <span className="text-xs text-[var(--color-muted)]">
              From: <strong className="text-[var(--color-text)]">{business.businessName}</strong>
            </span>
          </div>

          {/* Client Selection & Inline Create */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="customerId"
                className="block text-xs font-medium text-neutral-700"
              >
                Client <span className="text-red-500">*</span>
              </label>
              {!isLocked && !showNewClientForm && (
                <button
                  type="button"
                  onClick={() => setShowNewClientForm(true)}
                  className="text-xs font-medium text-[var(--color-brass)] hover:underline flex items-center gap-1"
                >
                  <span>+ New Client</span>
                </button>
              )}
            </div>

            {/* Inline New Client Card */}
            {showNewClientForm && !isLocked && (
              <div className="mb-3 p-4 bg-neutral-50 border border-neutral-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-neutral-800">Create New Client</h3>
                  <button
                    type="button"
                    onClick={() => setShowNewClientForm(false)}
                    className="text-neutral-400 hover:text-neutral-600 text-xs"
                  >
                    ✕ Cancel
                  </button>
                </div>

                {newClientError && (
                  <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{newClientError}</p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    placeholder="Client Name *"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-[var(--color-brass)]"
                    autoFocus
                  />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-[var(--color-brass)]"
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-[var(--color-brass)]"
                  />
                  <input
                    type="text"
                    placeholder="Address / Location"
                    value={newClientAddress}
                    onChange={(e) => setNewClientAddress(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-[var(--color-brass)]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowNewClientForm(false)}
                    className="px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-200 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateClient}
                    disabled={isCreatingClient}
                    className="px-3 py-1 text-xs text-white bg-[var(--color-brass)] hover:opacity-90 rounded font-medium disabled:opacity-50"
                  >
                    {isCreatingClient ? 'Saving…' : 'Save & Select Client'}
                  </button>
                </div>
              </div>
            )}

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
            {customers.length === 0 && !showNewClientForm && (
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                No clients yet.{' '}
                <button
                  type="button"
                  onClick={() => setShowNewClientForm(true)}
                  className="text-[var(--color-brass)] hover:underline font-medium"
                >
                  Create one now
                </button>
              </p>
            )}
          </div>

          {/* Date & Currency Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <div>
              <label
                htmlFor="currency"
                className="block text-xs font-medium text-neutral-700 mb-1"
              >
                Currency
              </label>
              <select
                id="currency"
                value={currency}
                disabled={isLocked || isPending}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--color-line)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brass)]/40 disabled:bg-[var(--color-paper-sunk)] disabled:cursor-not-allowed text-neutral-900"
              >
                <option value="PHP">₱ PHP (Philippine Peso)</option>
                <option value="USD">$ USD (US Dollar)</option>
                <option value="EUR">€ EUR (Euro)</option>
                <option value="GBP">£ GBP (British Pound)</option>
                <option value="AUD">A$ AUD (Australian Dollar)</option>
                <option value="SGD">S$ SGD (Singapore Dollar)</option>
                <option value="CAD">C$ CAD (Canadian Dollar)</option>
              </select>
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
            currency={currency}
          />
        </div>

        {/* Totals Panel */}
        <TotalsPanel
          items={items}
          discountInput={discountInput}
          onDiscountChange={handleDiscountChange}
          serverTotals={serverTotals}
          disabled={isLocked || isPending}
          currency={currency}
        />

        {/* Collapsed Notes & Terms Disclosure (§10, P2-T04) */}
        <details
          className="group bg-white border border-[var(--color-line)] rounded-xl shadow-sm overflow-hidden"
          open={detailsOpen}
          onToggle={(e) => setDetailsOpen(e.currentTarget.open)}
        >
          <summary className="flex items-center justify-between p-4 sm:p-5 cursor-pointer font-semibold text-sm text-[var(--color-text)] hover:bg-neutral-50/70 transition-colors select-none">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-[var(--color-muted)] group-open:rotate-90 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span>Notes & Terms (Optional)</span>
            </div>
            <span className="text-xs text-[var(--color-muted)] font-normal">
              {notes || terms ? 'Has notes/terms' : 'Collapsed'}
            </span>
          </summary>

          <div className="p-5 sm:p-6 pt-2 border-t border-[var(--color-line-soft)] space-y-4">
            <div>
              <label
                htmlFor="notes"
                className="block text-xs font-medium text-neutral-700 mb-1"
              >
                Notes for Client
              </label>
              <textarea
                id="notes"
                rows={3}
                value={notes}
                disabled={isLocked || isPending}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Scope description, inclusions, or client notes…"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--color-line)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brass)]/40 disabled:bg-[var(--color-paper-sunk)] disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label
                htmlFor="terms"
                className="block text-xs font-medium text-neutral-700 mb-1"
              >
                Terms & Conditions
              </label>
              <textarea
                id="terms"
                rows={3}
                value={terms}
                disabled={isLocked || isPending}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Payment terms, turnaround, deposit requirements…"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--color-line)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brass)]/40 disabled:bg-[var(--color-paper-sunk)] disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </details>

        {/* Form Action Controls */}
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
        {/* Required Quotation Disclaimer Footer (§2.3, P2-T05) */}
        <div className="border-t border-[var(--color-line-soft)] pt-6 pb-2 text-center">
          <p className="text-xs text-[var(--color-muted)] italic">
            {QUOTATION_FOOTER}
          </p>
        </div>
      </form>
    </div>
  );
}

'use client';

import React, { useState, useTransition, useRef, useEffect } from 'react';
import { respondToQuotation } from '@/actions/public-response';
import { formatDate } from '@/lib/dates';
import type { DocumentStatus } from '@/lib/documents';

interface ResponseFormProps {
  code: string;
  quotationNumber: string;
  businessName: string;
  status: DocumentStatus;
  validUntil: string;
  respondedAt?: string | null;
  respondedByName?: string | null;
}

export function ResponseForm({
  code,
  quotationNumber,
  businessName,
  status: initialStatus,
  validUntil,
  respondedAt: initialRespondedAt,
  respondedByName: initialRespondedByName,
}: ResponseFormProps) {
  const [currentStatus, setCurrentStatus] = useState<DocumentStatus>(initialStatus);
  const [respondedAt, setRespondedAt] = useState<string | null>(initialRespondedAt || null);
  const [respondedByName, setRespondedByName] = useState<string | null>(
    initialRespondedByName || null
  );

  const [dialogAction, setDialogAction] = useState<'ACCEPT' | 'DECLINE' | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpenDialog = (action: 'ACCEPT' | 'DECLINE') => {
    setError(null);
    setDialogAction(action);
  };

  // Focus input when dialog opens
  useEffect(() => {
    if (dialogAction) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [dialogAction]);

  // Check if expired at read time
  const isExpired =
    currentStatus === 'EXPIRED' ||
    ((currentStatus === 'SENT' || currentStatus === 'VIEWED') &&
      new Date(validUntil).getTime() < new Date().setHours(0, 0, 0, 0));

  // If already answered, render permanent confirmation banner
  if (currentStatus === 'ACCEPTED' || currentStatus === 'DECLINED') {
    const isAccepted = currentStatus === 'ACCEPTED';
    const dateStr = respondedAt ? formatDate(respondedAt) : '';

    return (
      <div
        className={`rounded-2xl p-5 sm:p-6 border text-center space-y-2 transition-all ${
          isAccepted
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
            : 'bg-rose-50/80 border-rose-200 text-rose-950'
        }`}
      >
        <div
          className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center ${
            isAccepted ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}
        >
          {isAccepted ? (
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>

        <h3 className="text-base sm:text-lg font-bold">
          {isAccepted ? 'Quotation Accepted' : 'Quotation Declined'}
        </h3>

        <p className="text-xs sm:text-sm text-neutral-600 max-w-md mx-auto leading-relaxed">
          {isAccepted
            ? `This quotation was confirmed and accepted by ${respondedByName || 'the client'}${
                dateStr ? ` on ${dateStr}` : ''
              }.`
            : `This quotation was declined by ${respondedByName || 'the client'}${
                dateStr ? ` on ${dateStr}` : ''
              }.`}
        </p>

        <p className="text-[11px] text-neutral-400 font-mono pt-1">
          Reference: {quotationNumber}
        </p>
      </div>
    );
  }

  // If expired, show expired alert (no action buttons)
  if (isExpired) {
    return (
      <div className="rounded-2xl p-5 sm:p-6 border border-amber-200 bg-amber-50/80 text-amber-950 text-center space-y-1.5">
        <div className="w-10 h-10 mx-auto rounded-full bg-amber-200/80 text-amber-800 flex items-center justify-center mb-1">
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>
        <h3 className="text-base font-bold">This Quotation Has Expired</h3>
        <p className="text-xs sm:text-sm text-neutral-600 max-w-md mx-auto">
          The validity period for this quotation ended on {formatDate(validUntil)}. Please contact{' '}
          <span className="font-semibold text-neutral-800">{businessName}</span> if you need an updated
          quotation.
        </p>
      </div>
    );
  }

  // Action submission handler
  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dialogAction) return;

    if (!name.trim()) {
      setError('Please enter your full name to confirm.');
      return;
    }

    setError(null);

    startTransition(async () => {
      const res = await respondToQuotation({
        code,
        action: dialogAction,
        name: name.trim(),
      });

      if (!res.ok) {
        setError(res.error || 'Failed to submit response.');
        return;
      }

      // Success: update state to render permanent banner
      setCurrentStatus(res.data.status);
      setRespondedAt(res.data.respondedAt);
      setRespondedByName(res.data.respondedByName);
      setDialogAction(null);
    });
  };

  return (
    <div className="space-y-4 pt-2">
      {/* Action Prompt */}
      <div className="text-center space-y-1">
        <h3 className="text-sm font-semibold text-neutral-900">
          Ready to respond to this quotation?
        </h3>
        <p className="text-xs text-neutral-500">
          Accepting confirms your approval of the scope and pricing outlined above.
        </p>
      </div>

      {/* Two Large Phone-Friendly Buttons (§10, P3-T02) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => handleOpenDialog('ACCEPT')}
          className="min-h-[52px] w-full sm:w-60 inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-sm transition-all focus:outline-none focus:ring-4 focus:ring-emerald-600/30"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Accept Quotation
        </button>

        <button
          type="button"
          onClick={() => handleOpenDialog('DECLINE')}
          className="min-h-[52px] w-full sm:w-44 inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-neutral-700 hover:text-rose-700 bg-neutral-100 hover:bg-rose-50 border border-neutral-200/80 hover:border-rose-200 rounded-xl transition-all focus:outline-none focus:ring-4 focus:ring-rose-500/20"
        >
          Decline
        </button>
      </div>

      {/* Confirmation Modal Dialog */}
      {dialogAction && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-neutral-200 p-6 space-y-5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3
                  id="confirm-dialog-title"
                  className="text-lg font-bold text-neutral-900"
                >
                  {dialogAction === 'ACCEPT' ? 'Accept Quotation' : 'Decline Quotation'}
                </h3>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  {dialogAction === 'ACCEPT'
                    ? `Please enter your full name to confirm acceptance of ${quotationNumber} from ${businessName}.`
                    : `Please enter your full name to record your decision to decline ${quotationNumber}.`}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDialogAction(null)}
                disabled={isPending}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg hover:bg-neutral-100 transition-colors"
                aria-label="Close dialog"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleConfirm} className="space-y-4">
              <div>
                <label
                  htmlFor="responder-name"
                  className="block text-xs font-semibold text-neutral-700 mb-1.5"
                >
                  Your Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={inputRef}
                  id="responder-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Maria Clara Santos"
                  disabled={isPending}
                  className="w-full min-h-[46px] px-3.5 py-2.5 text-sm rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 disabled:bg-neutral-50 disabled:cursor-not-allowed"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDialogAction(null)}
                  disabled={isPending}
                  className="min-h-[44px] px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isPending || !name.trim()}
                  className={`min-h-[44px] px-5 py-2 text-sm font-bold text-white rounded-xl shadow-sm transition-opacity disabled:opacity-50 ${
                    dialogAction === 'ACCEPT'
                      ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
                      : 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
                  }`}
                >
                  {isPending
                    ? 'Submitting…'
                    : dialogAction === 'ACCEPT'
                    ? 'Confirm & Accept'
                    : 'Confirm & Decline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

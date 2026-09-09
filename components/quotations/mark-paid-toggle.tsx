'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { markQuotationPaid, type SerializedQuotation } from '@/actions/quotations';
import { formatMoney, centavosToPesos } from '@/lib/money';
import { formatDate } from '@/lib/dates';

interface MarkPaidToggleProps {
  quotation: SerializedQuotation;
}

export function MarkPaidToggle({ quotation }: MarkPaidToggleProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isPaid = Boolean(quotation.paidAt);
  const isAccepted = quotation.status === 'ACCEPTED';

  const defaultPesos = (
    centavosToPesos(quotation.paidAmountCentavos ?? quotation.totalCentavos)
  ).toFixed(2);

  const [isEditing, setIsEditing] = useState(false);
  const [amountValue, setAmountValue] = useState(defaultPesos);
  const [error, setError] = useState<string | null>(null);

  // Available only on ACCEPTED quotations (§6.8)
  if (!isAccepted) {
    return null;
  }

  const handleMarkPaid = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await markQuotationPaid(quotation.id, {
        paid: true,
        amount: amountValue.trim() ? amountValue : undefined,
      });

      if (!res.ok) {
        setError(res.error);
        return;
      }

      setIsEditing(false);
      router.refresh();
    });
  };

  const handleUnmarkPaid = () => {
    if (!confirm('Clear payment status for this quotation?')) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await markQuotationPaid(quotation.id, {
        paid: false,
      });

      if (!res.ok) {
        setError(res.error);
        return;
      }

      setIsEditing(false);
      setAmountValue((centavosToPesos(quotation.totalCentavos)).toFixed(2));
      router.refresh();
    });
  };

  const paidAmountCentavos = quotation.paidAmountCentavos ?? quotation.totalCentavos;
  const isPartial = paidAmountCentavos < quotation.totalCentavos;

  return (
    <div className="bg-white border border-[var(--color-line)] rounded-xl shadow-xs overflow-hidden">
      <div className="p-4 sm:p-5 space-y-4">
        {error && (
          <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {isPaid && !isEditing ? (
          /* State: Marked as Paid */
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Marked as Paid
                </span>
                <span className="text-sm font-bold text-neutral-900">
                  {formatMoney(paidAmountCentavos)}
                </span>
                {isPartial && (
                  <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Partial ({formatMoney(paidAmountCentavos)} of {formatMoney(quotation.totalCentavos)})
                  </span>
                )}
              </div>

              <p className="text-xs text-neutral-500">
                Recorded on {quotation.paidAt ? formatDate(quotation.paidAt) : 'today'} · Private note to owner
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setAmountValue((centavosToPesos(paidAmountCentavos)).toFixed(2));
                  setIsEditing(true);
                }}
                disabled={isPending}
                className="px-3 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
              >
                Edit Amount
              </button>
              <button
                type="button"
                onClick={handleUnmarkPaid}
                disabled={isPending}
                className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
              >
                {isPending ? 'Updating...' : 'Clear Payment'}
              </button>
            </div>
          </div>
        ) : isEditing || !isPaid ? (
          /* State: Editing or Not Paid Yet */
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">
                  {isPaid ? 'Edit Recorded Payment' : 'Payment Tracking'}
                </h3>
                <p className="text-xs text-neutral-500">
                  {isPaid
                    ? 'Adjust the payment amount recorded for this quotation.'
                    : 'Record payment when received from client. Internal note only — no receipt or tax document is generated.'}
                </p>
              </div>

              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="self-start sm:self-auto px-3.5 py-1.5 text-xs font-semibold rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                >
                  + Mark as Paid
                </button>
              )}
            </div>

            {isEditing && (
              <form onSubmit={handleMarkPaid} className="pt-2 border-t border-neutral-100 space-y-3">
                <div className="max-w-xs space-y-1">
                  <label htmlFor="paidAmount" className="block text-xs font-medium text-neutral-700">
                    Payment Amount (₱)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-semibold text-neutral-400">
                      ₱
                    </span>
                    <input
                      id="paidAmount"
                      type="text"
                      value={amountValue}
                      onChange={(e) => setAmountValue(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2 text-sm border border-[var(--color-line)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-brass)]/50"
                    />
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Defaults to quote total ({formatMoney(quotation.totalCentavos)}). Enter a lower amount for partial payments.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs disabled:opacity-50"
                  >
                    {isPending ? 'Saving...' : 'Confirm Paid'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setAmountValue(defaultPesos);
                    }}
                    disabled={isPending}
                    className="px-3 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

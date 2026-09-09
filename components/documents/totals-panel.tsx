'use client';

import React, { useMemo } from 'react';
import { computeTotals, type ComputedTotals } from '@/lib/totals';
import { formatMoney, pesosToCentavos } from '@/lib/money';
import type { LineItemRow } from './line-item-builder';

// --- Types ---

export interface TotalsPanelProps {
  /** The current line items from the builder */
  items: LineItemRow[];
  /** Discount typed in pesos — converted to centavos internally */
  discountInput: string;
  /** Callback when the user changes the discount */
  onDiscountChange: (value: string) => void;
  /**
   * After a server save, the server's recomputed totals replace the client preview.
   * A mismatch is never resolved in the client's favour (§3.3).
   */
  serverTotals?: ComputedTotals | null;
  /** Read-only mode */
  disabled?: boolean;
}

/**
 * Parse a row into the shape computeTotals expects, returning 0 for invalid inputs.
 * Client-side feedback only — the server recomputes from the raw row data on save.
 */
function parseRowForTotals(row: LineItemRow) {
  let unitPriceCentavos = 0;
  try {
    if (row.unitPrice.trim()) {
      unitPriceCentavos = pesosToCentavos(row.unitPrice);
    }
  } catch {
    // Invalid input — treat as 0 for the preview
  }

  const qty = Number(row.quantity);
  const quantity = Number.isFinite(qty) && qty >= 0 ? qty : 0;

  return {
    description: row.description,
    quantity,
    unitPriceCentavos,
  };
}

function parseDiscountCentavos(input: string): number {
  try {
    if (!input.trim()) return 0;
    const c = pesosToCentavos(input);
    return Math.max(0, c);
  } catch {
    return 0;
  }
}

// --- Component ---

export function TotalsPanel({
  items,
  discountInput,
  onDiscountChange,
  serverTotals,
  disabled,
}: TotalsPanelProps) {
  // Compute client-side totals for live feedback
  const clientTotals = useMemo<ComputedTotals>(() => {
    const parsedItems = items.map(parseRowForTotals);
    const discountCentavos = parseDiscountCentavos(discountInput);

    return computeTotals({
      items: parsedItems,
      discountCentavos,
    });
  }, [items, discountInput]);

  // Use server totals when available, otherwise client preview
  const totals = serverTotals ?? clientTotals;
  const isServerOverride = serverTotals != null;

  // Format the discount for preview feedback
  let discountPreview = '';
  try {
    if (discountInput.trim()) {
      discountPreview = formatMoney(pesosToCentavos(discountInput));
    }
  } catch {
    // leave blank
  }

  return (
    <div className="bg-white border border-[var(--color-line)] rounded-xl p-4 sm:p-5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-line-soft)] pb-3">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">
          Document Totals
        </h3>
        {!isServerOverride && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-brass-ink)] bg-[var(--color-brass-wash)] rounded-full">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview
          </span>
        )}
        {isServerOverride && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-jade)] bg-emerald-50 rounded-full">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Saved
          </span>
        )}
      </div>

      {/* Rows */}
      <div className="space-y-3">
        {/* Subtotal */}
        <div className="flex items-center justify-between text-sm gap-2">
          <span className="text-[var(--color-muted)] shrink-0">Subtotal</span>
          <span className="font-medium font-mono text-[var(--color-text)] text-right truncate">
            {formatMoney(totals.subtotalCentavos)}
          </span>
        </div>

        {/* Discount (editable) */}
        <div className="flex items-center justify-between text-sm gap-3">
          <label htmlFor="totals-discount" className="text-[var(--color-muted)] shrink-0 whitespace-nowrap">
            Discount
          </label>
          <div className="flex items-center gap-2">
            {isServerOverride ? (
              <span className="font-medium font-mono text-[var(--color-text)] text-right truncate">
                {totals.discountCentavos > 0 ? `−${formatMoney(totals.discountCentavos)}` : formatMoney(0)}
              </span>
            ) : (
              <div className="relative w-36 sm:w-40">
                <span className="absolute left-2.5 top-2.5 text-[var(--color-faint)] text-sm">₱</span>
                <input
                  id="totals-discount"
                  type="text"
                  inputMode="decimal"
                  value={discountInput}
                  disabled={disabled}
                  onChange={(e) => onDiscountChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 min-h-[44px] text-sm text-right rounded-lg border border-[var(--color-line)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brass)]/40 disabled:bg-[var(--color-paper-sunk)] disabled:cursor-not-allowed"
                />
              </div>
            )}
          </div>
        </div>

        {/* Applied discount preview (only in edit mode when there's a valid discount) */}
        {!isServerOverride && totals.discountCentavos > 0 && (
          <div className="flex items-center justify-between text-xs gap-2 pl-4">
            <span className="text-[var(--color-faint)] shrink-0 truncate">
              Applied{discountPreview ? ` (${discountPreview})` : ''}
            </span>
            <span className="text-red-600 font-medium font-mono text-right shrink-0">
              −{formatMoney(totals.discountCentavos)}
            </span>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-[var(--color-line)]" />

        {/* Total */}
        <div className="flex items-center justify-between gap-3 pt-0.5">
          <span className="text-sm sm:text-base font-semibold text-[var(--color-text)] shrink-0">Total</span>
          <span className="text-lg sm:text-xl font-bold font-mono text-[var(--color-text)] text-right truncate">
            {formatMoney(totals.totalCentavos)}
          </span>
        </div>
      </div>

      {/* Info note */}
      {!isServerOverride && (
        <p className="text-[10px] text-[var(--color-faint)] leading-relaxed pt-1">
          These totals are a preview. The server will recompute them when you save.
        </p>
      )}
    </div>
  );
}

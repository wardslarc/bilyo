'use client';

import React, { useCallback } from 'react';
import { formatMoney, pesosToCentavos, getCurrencySymbol } from '@/lib/money';
import { type LineItemRow } from '@/lib/documents';

// Re-export for backward compatibility
export type { LineItemRow };

export interface LineItemBuilderProps {
  /** Controlled value */
  items: LineItemRow[];
  /** Called on every edit so the parent can recompute totals */
  onChange: (items: LineItemRow[]) => void;
  /** Whether the form is in a read-only / disabled state */
  disabled?: boolean;
  /** Currency code for display */
  currency?: string;
}

// --- Helpers ---

let rowCounter = 0;
function newRowId(): string {
  rowCounter += 1;
  return `row-${Date.now()}-${rowCounter}`;
}

export function createEmptyRow(): LineItemRow {
  return {
    id: newRowId(),
    description: '',
    quantity: '1',
    unitPrice: '',
  };
}

/**
 * Parse a row's unitPrice string into centavos, returning 0 on failure.
 * Used only for client-side preview — the server recomputes on save.
 */
export function rowUnitPriceCentavos(row: LineItemRow): number {
  try {
    if (!row.unitPrice.trim()) return 0;
    return pesosToCentavos(row.unitPrice);
  } catch {
    return 0;
  }
}

export function rowQuantity(row: LineItemRow): number {
  const n = Number(row.quantity);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// --- Single Line Item Row ---

interface RowProps {
  row: LineItemRow;
  index: number;
  total: number;
  disabled?: boolean;
  currency?: string;
  onUpdate: (id: string, field: keyof LineItemRow, value: string) => void;
  onRemove: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onAddNext?: () => void;
}

function LineItemRowCard({
  row,
  index,
  total,
  disabled,
  currency = 'PHP',
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onAddNext,
}: RowProps) {
  const qty = rowQuantity(row);
  const unitCentavos = rowUnitPriceCentavos(row);
  const symbol = getCurrencySymbol(currency);
  const lineAmount = formatMoney(Math.round(qty * unitCentavos), currency);

  return (
    <div className="group bg-white border border-[var(--color-line)] rounded-lg p-3 sm:p-4 transition-shadow hover:shadow-sm">
      {/* Row header: index + actions */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="w-6 h-6 rounded-full bg-[var(--color-paper-sunk)] text-[var(--color-muted)] text-xs font-semibold flex items-center justify-center">
          {index + 1}
        </span>

        <div className="flex items-center gap-1">
          {/* Reorder buttons */}
          <button
            type="button"
            disabled={disabled || index === 0}
            onClick={() => onMoveUp(index)}
            className="min-w-[44px] min-h-[44px] p-2 flex items-center justify-center rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-paper-sunk)] disabled:opacity-30 transition-colors"
            aria-label="Move up"
            title="Move up"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            disabled={disabled || index === total - 1}
            onClick={() => onMoveDown(index)}
            className="min-w-[44px] min-h-[44px] p-2 flex items-center justify-center rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-paper-sunk)] disabled:opacity-30 transition-colors"
            aria-label="Move down"
            title="Move down"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Remove */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRemove(row.id)}
            className="min-w-[44px] min-h-[44px] p-2 flex items-center justify-center rounded-lg text-[var(--color-muted)] hover:text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors ml-1"
            aria-label="Remove line item"
            title="Remove"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Description — always full width */}
      <div className="mb-3">
        <label className="sr-only">Description</label>
        <input
          type="text"
          value={row.description}
          disabled={disabled}
          onChange={(e) => onUpdate(row.id, 'description', e.target.value)}
          placeholder="Item description"
          className="w-full px-3.5 py-2.5 min-h-[44px] text-sm rounded-lg border border-[var(--color-line)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brass)]/40 disabled:bg-[var(--color-paper-sunk)] disabled:cursor-not-allowed"
        />
      </div>

      {/* Qty / Price / Amount — responsive grid, stacked on 390px mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div>
          <label className="block text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-1">
            Qty
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={row.quantity}
            disabled={disabled}
            onChange={(e) => onUpdate(row.id, 'quantity', e.target.value)}
            placeholder="1"
            className="w-full px-3 py-2 min-h-[44px] text-sm text-right rounded-lg border border-[var(--color-line)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brass)]/40 disabled:bg-[var(--color-paper-sunk)] disabled:cursor-not-allowed"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-1">
            Unit Price
          </label>
          <div className="relative">
            <span className="absolute left-2.5 top-2.5 text-[var(--color-faint)] text-sm">{symbol}</span>
            <input
              type="text"
              inputMode="decimal"
              value={row.unitPrice}
              disabled={disabled}
              onChange={(e) => onUpdate(row.id, 'unitPrice', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (onAddNext && index === total - 1) {
                    onAddNext();
                  }
                }
              }}
              placeholder="0.00"
              className="w-full pl-7 pr-3 py-2 min-h-[44px] text-sm text-right rounded-lg border border-[var(--color-line)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brass)]/40 disabled:bg-[var(--color-paper-sunk)] disabled:cursor-not-allowed"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-1">
            Amount
          </label>
          <div className="px-3 py-2 min-h-[44px] text-sm text-right rounded-lg bg-[var(--color-paper-sunk)] border border-[var(--color-line-soft)] text-[var(--color-text)] font-mono font-medium flex items-center justify-end">
            {lineAmount}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Empty State ---

function EmptyState({ onAdd, disabled }: { onAdd: () => void; disabled?: boolean }) {
  return (
    <div className="border-2 border-dashed border-[var(--color-line)] rounded-xl py-10 px-6 text-center">
      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-brass-wash)] flex items-center justify-center">
        <svg className="w-6 h-6 text-[var(--color-brass)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-[var(--color-text)] mb-1">
        No line items yet
      </p>
      <p className="text-xs text-[var(--color-muted)] mb-4">
        Add your first line item to start building this quotation.
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={onAdd}
        className="min-h-[44px] inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white bg-[var(--color-brass)] hover:opacity-90 rounded-lg transition-opacity disabled:opacity-40"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add line item
      </button>
    </div>
  );
}

// --- Main Component ---

export function LineItemBuilder({ items, onChange, disabled, currency = 'PHP' }: LineItemBuilderProps) {
  const handleUpdate = useCallback(
    (id: string, field: keyof LineItemRow, value: string) => {
      const next = items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      );
      onChange(next);
    },
    [items, onChange]
  );

  const handleRemove = useCallback(
    (id: string) => {
      onChange(items.filter((item) => item.id !== id));
    },
    [items, onChange]
  );

  const handleAdd = useCallback(() => {
    onChange([...items, createEmptyRow()]);
  }, [items, onChange]);

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) return;
      const next = [...items];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      onChange(next);
    },
    [items, onChange]
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= items.length - 1) return;
      const next = [...items];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      onChange(next);
    },
    [items, onChange]
  );

  if (items.length === 0) {
    return <EmptyState onAdd={handleAdd} disabled={disabled} />;
  }

  return (
    <div className="space-y-3">
      {/* Column headers — visible on sm+ only */}
      <div className="hidden sm:grid sm:grid-cols-[2rem_1fr_5rem_7rem_7rem_4.5rem] gap-2 px-4 text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
        <span>#</span>
        <span>Description</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Unit Price</span>
        <span className="text-right">Amount</span>
        <span />
      </div>

      {/* Item cards */}
      <div className="space-y-2">
        {items.map((row, index) => (
          <LineItemRowCard
            key={row.id}
            row={row}
            index={index}
            total={items.length}
            disabled={disabled}
            currency={currency}
            onUpdate={handleUpdate}
            onRemove={handleRemove}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            onAddNext={handleAdd}
          />
        ))}
      </div>

      {/* Add row button */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleAdd}
        className="w-full min-h-[44px] flex items-center justify-center gap-1.5 py-3 px-4 text-sm font-medium text-[var(--color-brass)] border border-dashed border-[var(--color-line)] rounded-lg hover:bg-[var(--color-brass-wash)]/40 hover:border-[var(--color-brass)] transition-colors disabled:opacity-40"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add line item
      </button>
    </div>
  );
}

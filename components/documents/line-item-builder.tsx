'use client';

import React, { useState, useCallback, useEffect, useId } from 'react';
import { type SerializedProduct, getProducts } from '@/actions/products';
import { centavosToPesos, formatMoney, pesosToCentavos } from '@/lib/money';

// --- Types ---

export interface LineItemRow {
  /** Client-side key for React reconciliation */
  id: string;
  description: string;
  /** Raw string from the input — converted to number only at compute time */
  quantity: string;
  /** Raw peso string from the input — converted to centavos only at compute time */
  unitPrice: string;
  /** If prefilled from a product, track it for UX but not for storage */
  productId?: string;
}

export interface LineItemBuilderProps {
  /** Controlled value */
  items: LineItemRow[];
  /** Called on every edit so the parent can recompute totals */
  onChange: (items: LineItemRow[]) => void;
  /** Whether the form is in a read-only / disabled state (e.g. PAID invoice) */
  disabled?: boolean;
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

// --- Product Picker (inline dropdown) ---

function ProductPicker({
  products,
  onSelect,
  disabled,
}: {
  products: SerializedProduct[];
  onSelect: (product: SerializedProduct) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const pickerId = useId();

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
  );

  if (products.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-brass)] hover:text-[var(--color-brass-ink)] transition-colors disabled:opacity-40"
        aria-expanded={open}
        aria-controls={pickerId}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        Pick item
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            id={pickerId}
            className="absolute left-0 top-full mt-1 z-40 w-72 max-h-64 bg-white border border-[var(--color-line)] rounded-lg shadow-lg overflow-hidden"
          >
            <div className="p-2 border-b border-[var(--color-line)]">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items…"
                className="w-full px-2.5 py-1.5 text-xs rounded-md border border-[var(--color-line)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brass)]"
                autoFocus
              />
            </div>
            <ul className="overflow-y-auto max-h-48">
              {filtered.length === 0 && (
                <li className="px-3 py-4 text-xs text-[var(--color-muted)] text-center">
                  No items found
                </li>
              )}
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-paper-sunk)] transition-colors flex items-center justify-between gap-2"
                    onClick={() => {
                      onSelect(p);
                      setOpen(false);
                      setSearch('');
                    }}
                  >
                    <span className="truncate font-medium text-[var(--color-text)]">{p.name}</span>
                    <span className="text-xs text-[var(--color-muted)] whitespace-nowrap">
                      {formatMoney(p.unitPriceCentavos)}
                      {p.unit ? `/${p.unit}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

// --- Single Line Item Row ---

interface RowProps {
  row: LineItemRow;
  index: number;
  total: number;
  products: SerializedProduct[];
  disabled?: boolean;
  onUpdate: (id: string, field: keyof LineItemRow, value: string) => void;
  onRemove: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onProductSelect: (id: string, product: SerializedProduct) => void;
}

function LineItemRowCard({
  row,
  index,
  total,
  products,
  disabled,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onProductSelect,
}: RowProps) {
  const qty = rowQuantity(row);
  const unitCentavos = rowUnitPriceCentavos(row);
  const lineAmount = formatMoney(Math.round(qty * unitCentavos));

  return (
    <div className="group bg-white border border-[var(--color-line)] rounded-lg p-3 sm:p-4 transition-shadow hover:shadow-sm">
      {/* Row header: index + actions */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-[var(--color-paper-sunk)] text-[var(--color-muted)] text-xs font-semibold flex items-center justify-center">
            {index + 1}
          </span>
          <ProductPicker
            products={products}
            onSelect={(p) => onProductSelect(row.id, p)}
            disabled={disabled}
          />
        </div>

        <div className="flex items-center gap-0.5">
          {/* Reorder buttons */}
          <button
            type="button"
            disabled={disabled || index === 0}
            onClick={() => onMoveUp(index)}
            className="p-1 rounded text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-paper-sunk)] disabled:opacity-30 transition-colors"
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
            className="p-1 rounded text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-paper-sunk)] disabled:opacity-30 transition-colors"
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
            className="p-1 rounded text-[var(--color-muted)] hover:text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors ml-1"
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
          className="w-full px-3 py-2 text-sm rounded-md border border-[var(--color-line)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brass)]/40 disabled:bg-[var(--color-paper-sunk)] disabled:cursor-not-allowed"
        />
      </div>

      {/* Qty / Price / Amount — responsive grid */}
      <div className="grid grid-cols-3 gap-2">
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
            className="w-full px-2.5 py-1.5 text-sm text-right rounded-md border border-[var(--color-line)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brass)]/40 disabled:bg-[var(--color-paper-sunk)] disabled:cursor-not-allowed"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-1">
            Unit Price
          </label>
          <div className="relative">
            <span className="absolute left-2 top-1.5 text-[var(--color-faint)] text-sm">₱</span>
            <input
              type="text"
              inputMode="decimal"
              value={row.unitPrice}
              disabled={disabled}
              onChange={(e) => onUpdate(row.id, 'unitPrice', e.target.value)}
              placeholder="0.00"
              className="w-full pl-6 pr-2 py-1.5 text-sm text-right rounded-md border border-[var(--color-line)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brass)]/40 disabled:bg-[var(--color-paper-sunk)] disabled:cursor-not-allowed"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-1">
            Amount
          </label>
          <div className="px-2.5 py-1.5 text-sm text-right rounded-md bg-[var(--color-paper-sunk)] border border-[var(--color-line-soft)] text-[var(--color-text)] font-medium">
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
        Add your first line item to start building this document.
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[var(--color-brass)] hover:opacity-90 rounded-lg transition-opacity disabled:opacity-40"
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

export function LineItemBuilder({ items, onChange, disabled }: LineItemBuilderProps) {
  const [products, setProducts] = useState<SerializedProduct[]>([]);

  // Fetch active products on mount for the picker
  useEffect(() => {
    let cancelled = false;
    getProducts({ includeArchived: false }).then((res) => {
      if (!cancelled && res.ok) {
        setProducts(res.data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const handleProductSelect = useCallback(
    (rowId: string, product: SerializedProduct) => {
      const next = items.map((item) =>
        item.id === rowId
          ? {
              ...item,
              description: product.name + (product.description ? ` — ${product.description}` : ''),
              unitPrice: centavosToPesos(product.unitPriceCentavos).toFixed(2),
              quantity: item.quantity || '1',
              productId: product.id,
            }
          : item
      );
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
            products={products}
            disabled={disabled}
            onUpdate={handleUpdate}
            onRemove={handleRemove}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            onProductSelect={handleProductSelect}
          />
        ))}
      </div>

      {/* Add row button */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleAdd}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-[var(--color-brass)] border border-dashed border-[var(--color-line)] rounded-lg hover:bg-[var(--color-brass-wash)]/40 hover:border-[var(--color-brass)] transition-colors disabled:opacity-40"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add line item
      </button>
    </div>
  );
}

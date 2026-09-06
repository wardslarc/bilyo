'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import {
  getProducts,
  archiveProduct,
  type SerializedProduct,
} from '@/actions/products';
import { formatMoney } from '@/lib/money';

interface ProductListProps {
  initialProducts: SerializedProduct[];
}

export function ProductList({ initialProducts }: ProductListProps) {
  const [products, setProducts] = useState<SerializedProduct[]>(initialProducts);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch whenever debouncedSearch or showArchived changes
  useEffect(() => {
    let isMounted = true;
    startTransition(async () => {
      try {
        const res = await getProducts({
          search: debouncedSearch,
          includeArchived: showArchived,
        });
        if (!isMounted) return;
        if (res.ok) {
          setProducts(res.data);
          setError(null);
        } else {
          setError(res.error);
        }
      } catch (err) {
        if (isMounted) setError((err as Error).message);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [debouncedSearch, showArchived]);

  const handleToggleArchive = (product: SerializedProduct) => {
    const targetState = !product.archived;
    const msg = targetState
      ? `Archive "${product.name}"? It will be hidden from document pickers.`
      : `Restore "${product.name}"?`;

    if (!confirm(msg)) return;

    startTransition(async () => {
      const res = await archiveProduct(product.id, targetState);
      if (res.ok) {
        setProducts((prev) =>
          prev
            .map((p) => (p.id === product.id ? res.data : p))
            .filter((p) => (showArchived ? true : !p.archived))
        );
      } else {
        alert(res.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Search and filter controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[var(--color-line)] shadow-sm">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search items by name or description..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-[var(--color-line)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          <svg
            className="w-4 h-4 text-neutral-400 absolute left-3 top-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-medium text-neutral-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="w-4 h-4 rounded border-neutral-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
            />
            Show archived
          </label>

          <Link
            href="/dashboard/products/new"
            className="px-4 py-2 bg-[var(--color-primary)] hover:opacity-90 text-white font-medium text-xs sm:text-sm rounded-lg transition-opacity whitespace-nowrap text-center"
          >
            + Add Item
          </Link>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl"
        >
          {error}
        </div>
      )}

      {/* Loading state (when no products loaded yet) */}
      {isPending && products.length === 0 && (
        <div className="bg-white border border-[var(--color-line)] rounded-xl p-8 text-center text-neutral-500 text-sm animate-pulse">
          Loading items...
        </div>
      )}

      {/* Empty state */}
      {!isPending && !error && products.length === 0 && (
        <div className="bg-white border border-[var(--color-line)] rounded-xl p-8 sm:p-12 text-center max-w-lg mx-auto space-y-3">
          <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-neutral-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-neutral-900">
            {searchTerm ? 'No matching items' : 'No items added yet'}
          </h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            {searchTerm
              ? `No item matches "${searchTerm}". Try a different keyword.`
              : 'Add your regular services, standard packages, or physical products to quickly pick them on documents.'}
          </p>
          {!searchTerm && (
            <div className="pt-2">
              <Link
                href="/dashboard/products/new"
                className="inline-block px-4 py-2 bg-[var(--color-primary)] hover:opacity-90 text-white font-medium text-xs rounded-lg transition-opacity"
              >
                Add your first item
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Products list: Desktop Table + Mobile Cards */}
      {!error && products.length > 0 && (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white border border-[var(--color-line)] rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 border-b border-[var(--color-line)] text-xs text-neutral-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Item / Service</th>
                  <th className="px-5 py-3 font-medium">Unit</th>
                  <th className="px-5 py-3 font-medium text-right">Unit Price</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {products.map((p) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-neutral-50/50 transition-colors ${
                      p.archived ? 'opacity-60 bg-neutral-50/30' : ''
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/products/${p.id}/edit`}
                          className="font-medium text-neutral-900 hover:underline"
                        >
                          {p.name}
                        </Link>
                        {p.archived && (
                          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-neutral-200 text-neutral-700">
                            Archived
                          </span>
                        )}
                      </div>
                      {p.description && (
                        <p className="text-xs text-neutral-400 truncate max-w-sm">{p.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-neutral-600 text-xs">{p.unit || '—'}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-neutral-900 text-xs">
                      {formatMoney(p.unitPriceCentavos)}
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2 text-xs">
                      <Link
                        href={`/dashboard/products/${p.id}/edit`}
                        className="text-neutral-600 hover:text-neutral-900 font-medium"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleToggleArchive(p)}
                        disabled={isPending}
                        className="text-neutral-400 hover:text-red-600 font-medium ml-2"
                      >
                        {p.archived ? 'Restore' : 'Archive'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile view (390px cards) */}
          <div className="md:hidden space-y-3">
            {products.map((p) => (
              <div
                key={p.id}
                className={`bg-white border border-[var(--color-line)] rounded-xl p-4 shadow-sm space-y-2 ${
                  p.archived ? 'opacity-60 bg-neutral-50/50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/dashboard/products/${p.id}/edit`}
                      className="font-semibold text-neutral-900 hover:underline text-sm"
                    >
                      {p.name}
                    </Link>
                    {p.description && (
                      <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{p.description}</p>
                    )}
                  </div>
                  {p.archived && (
                    <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-neutral-200 text-neutral-700 shrink-0">
                      Archived
                    </span>
                  )}
                </div>

                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
                  <div className="text-xs">
                    <span className="font-bold text-neutral-900">
                      {formatMoney(p.unitPriceCentavos)}
                    </span>
                    {p.unit && <span className="text-neutral-400 ml-1">/ {p.unit}</span>}
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <Link
                      href={`/dashboard/products/${p.id}/edit`}
                      className="font-medium text-neutral-700 hover:text-neutral-900"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleToggleArchive(p)}
                      disabled={isPending}
                      className="font-medium text-red-600 hover:text-red-700"
                    >
                      {p.archived ? 'Restore' : 'Archive'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

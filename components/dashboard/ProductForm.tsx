'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  createProduct,
  updateProduct,
  archiveProduct,
  type SerializedProduct,
} from '@/actions/products';
import { centavosToPesos, formatMoney, pesosToCentavos } from '@/lib/money';

interface ProductFormProps {
  initialProduct?: SerializedProduct | null;
}

export function ProductForm({ initialProduct }: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isEditing = Boolean(initialProduct?.id);

  const [name, setName] = useState(initialProduct?.name || '');
  const [description, setDescription] = useState(initialProduct?.description || '');
  const [priceInput, setPriceInput] = useState<string>(
    initialProduct ? centavosToPesos(initialProduct.unitPriceCentavos).toFixed(2) : ''
  );
  const [unit, setUnit] = useState(initialProduct?.unit || '');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Derive preview of formatted money
  let formattedPreview = '';
  try {
    if (priceInput.trim()) {
      const centavos = pesosToCentavos(priceInput);
      formattedPreview = formatMoney(centavos);
    }
  } catch {
    // Leave blank if invalid
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});

    startTransition(async () => {
      const payload = {
        name,
        description,
        unitPrice: priceInput,
        unit,
      };

      let res;
      if (isEditing && initialProduct) {
        res = await updateProduct(initialProduct.id, payload);
      } else {
        res = await createProduct(payload);
      }

      if (!res.ok) {
        setGeneralError(res.error);
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        return;
      }

      router.push('/dashboard/products');
      router.refresh();
    });
  };

  const handleToggleArchive = () => {
    if (!initialProduct) return;
    const targetState = !initialProduct.archived;
    const confirmMessage = targetState
      ? 'Archive this item? It will be hidden from new quotation pickers.'
      : 'Restore this item?';

    if (!confirm(confirmMessage)) return;

    startTransition(async () => {
      const res = await archiveProduct(initialProduct.id, targetState);
      if (!res.ok) {
        setGeneralError(res.error);
        return;
      }
      router.push('/dashboard/products');
      router.refresh();
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {generalError && (
        <div
          role="alert"
          className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg"
        >
          {generalError}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-[var(--color-line)] rounded-xl shadow-sm p-6 sm:p-8 space-y-5"
      >
        <div className="border-b border-[var(--color-line)] pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              {isEditing ? 'Edit Item' : 'Add Item'}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Standard products, services, or hourly packages for quick line-item additions.
            </p>
          </div>
          {isEditing && initialProduct?.archived && (
            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
              Archived
            </span>
          )}
        </div>

        {/* Item Name */}
        <div>
          <label htmlFor="name" className="block text-xs font-medium text-neutral-700 mb-1">
            Item / Service Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: '' }));
            }}
            placeholder="e.g. Web Development, Brand Identity, Monthly Retainer"
            className={`w-full px-3.5 py-2.5 text-sm rounded-lg border ${
              fieldErrors.name ? 'border-red-500 bg-red-50/20' : 'border-[var(--color-line)]'
            } focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]`}
          />
          {fieldErrors.name && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-xs font-medium text-neutral-700 mb-1">
            Description (Optional)
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed scope or description of deliverables"
            className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--color-line)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          {fieldErrors.description && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.description}</p>
          )}
        </div>

        {/* Unit Price & Unit grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="unitPrice" className="block text-xs font-medium text-neutral-700 mb-1">
              Unit Price (PHP) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-neutral-400 text-sm">₱</span>
              <input
                id="unitPrice"
                name="unitPrice"
                type="text"
                required
                value={priceInput}
                onChange={(e) => {
                  setPriceInput(e.target.value);
                  if (fieldErrors.unitPrice) setFieldErrors((p) => ({ ...p, unitPrice: '' }));
                }}
                placeholder="1,234.56"
                className={`w-full pl-8 pr-3.5 py-2.5 text-sm rounded-lg border ${
                  fieldErrors.unitPrice ? 'border-red-500 bg-red-50/20' : 'border-[var(--color-line)]'
                } focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]`}
              />
            </div>
            {formattedPreview && (
              <p className="mt-1 text-xs text-neutral-500">
                Preview: <span className="font-medium text-neutral-900">{formattedPreview}</span>
              </p>
            )}
            {fieldErrors.unitPrice && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.unitPrice}</p>
            )}
          </div>

          <div>
            <label htmlFor="unit" className="block text-xs font-medium text-neutral-700 mb-1">
              Unit of Measure (Optional)
            </label>
            <input
              id="unit"
              name="unit"
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g. hr, project, month, pcs"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--color-line)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
            {fieldErrors.unit && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.unit}</p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="pt-4 border-t border-[var(--color-line)] flex items-center justify-between">
          <div>
            {isEditing && (
              <button
                type="button"
                onClick={handleToggleArchive}
                disabled={isPending}
                className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline disabled:opacity-50"
              >
                {initialProduct?.archived ? 'Restore item' : 'Archive item'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/products"
              className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 rounded-lg transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 bg-[var(--color-primary)] hover:opacity-90 text-white font-medium text-sm rounded-lg transition-opacity disabled:opacity-50"
            >
              {isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Item'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

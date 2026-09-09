'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  createCustomer,
  updateCustomer,
  archiveCustomer,
  type SerializedCustomer,
} from '@/actions/customers';
import type { CustomerInput } from '@/lib/validation/customer';
import { PlanLimitAlert } from '@/components/dashboard/PlanLimitAlert';

interface CustomerFormProps {
  initialCustomer?: SerializedCustomer | null;
}

export function CustomerForm({ initialCustomer }: CustomerFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isEditing = Boolean(initialCustomer?.id);

  const [formData, setFormData] = useState<CustomerInput>({
    name: initialCustomer?.name || '',
    email: initialCustomer?.email || '',
    phone: initialCustomer?.phone || '',
    address: initialCustomer?.address || '',
    tin: initialCustomer?.tin || '',
    notes: initialCustomer?.notes || '',
    archived: initialCustomer?.archived || false,
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});

    startTransition(async () => {
      let res;
      if (isEditing && initialCustomer) {
        res = await updateCustomer(initialCustomer.id, formData);
      } else {
        res = await createCustomer(formData);
      }

      if (!res.ok) {
        setGeneralError(res.error);
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        return;
      }

      router.push('/dashboard/customers');
      router.refresh();
    });
  };

  const handleToggleArchive = () => {
    if (!initialCustomer) return;
    const targetState = !initialCustomer.archived;
    const confirmMessage = targetState
      ? 'Archive this customer? They will be hidden from new quotation pickers.'
      : 'Restore this customer?';

    if (!confirm(confirmMessage)) return;

    startTransition(async () => {
      const res = await archiveCustomer(initialCustomer.id, targetState);
      if (!res.ok) {
        setGeneralError(res.error);
        return;
      }
      router.push('/dashboard/customers');
      router.refresh();
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {generalError && (
        <PlanLimitAlert
          error={generalError}
          onDismiss={() => setGeneralError(null)}
        />
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-[var(--color-line)] rounded-xl shadow-sm p-6 sm:p-8 space-y-5"
      >
        <div className="border-b border-[var(--color-line)] pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              {isEditing ? 'Edit Customer' : 'Add New Customer'}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Customer details can be selected when creating quotations.
            </p>
          </div>
          {isEditing && initialCustomer?.archived && (
            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
              Archived
            </span>
          )}
        </div>

        {/* Customer Name */}
        <div>
          <label htmlFor="name" className="block text-xs font-medium text-neutral-700 mb-1">
            Customer / Company Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g. San Miguel Corp or Maria Santos"
            className={`w-full px-3.5 py-2.5 text-sm rounded-lg border ${
              fieldErrors.name ? 'border-red-500 bg-red-50/20' : 'border-[var(--color-line)]'
            } focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]`}
          />
          {fieldErrors.name && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
          )}
        </div>

        {/* Email & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-neutral-700 mb-1">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email || ''}
              onChange={handleChange}
              placeholder="client@example.com"
              className={`w-full px-3.5 py-2.5 text-sm rounded-lg border ${
                fieldErrors.email ? 'border-red-500 bg-red-50/20' : 'border-[var(--color-line)]'
              } focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]`}
            />
            {fieldErrors.email && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="phone" className="block text-xs font-medium text-neutral-700 mb-1">
              Phone Number
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone || ''}
              onChange={handleChange}
              placeholder="0917 123 4567"
              className={`w-full px-3.5 py-2.5 text-sm rounded-lg border ${
                fieldErrors.phone ? 'border-red-500 bg-red-50/20' : 'border-[var(--color-line)]'
              } focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]`}
            />
            {fieldErrors.phone && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>
            )}
          </div>
        </div>

        {/* Address */}
        <div>
          <label htmlFor="address" className="block text-xs font-medium text-neutral-700 mb-1">
            Billing Address
          </label>
          <textarea
            id="address"
            name="address"
            rows={2}
            value={formData.address || ''}
            onChange={handleChange}
            placeholder="Street address, City, Province, Postal Code"
            className={`w-full px-3.5 py-2.5 text-sm rounded-lg border ${
              fieldErrors.address ? 'border-red-500 bg-red-50/20' : 'border-[var(--color-line)]'
            } focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]`}
          />
          {fieldErrors.address && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.address}</p>
          )}
        </div>

        {/* TIN */}
        <div>
          <label htmlFor="tin" className="block text-xs font-medium text-neutral-700 mb-1">
            Tax Identification Number (TIN)
          </label>
          <input
            id="tin"
            name="tin"
            type="text"
            value={formData.tin || ''}
            onChange={handleChange}
            placeholder="000-000-000-000"
            className={`w-full px-3.5 py-2.5 text-sm rounded-lg border ${
              fieldErrors.tin ? 'border-red-500 bg-red-50/20' : 'border-[var(--color-line)]'
            } focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]`}
          />
          <p className="mt-1 text-xs text-neutral-400">
            Accepts PH standard 000-000-000 or 000-000-000-000 format.
          </p>
          {fieldErrors.tin && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.tin}</p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-xs font-medium text-neutral-700 mb-1">
            Internal Notes (Optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            value={formData.notes || ''}
            onChange={handleChange}
            placeholder="Payment preferences, contact person, or other internal notes"
            className={`w-full px-3.5 py-2.5 text-sm rounded-lg border ${
              fieldErrors.notes ? 'border-red-500 bg-red-50/20' : 'border-[var(--color-line)]'
            } focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]`}
          />
          {fieldErrors.notes && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.notes}</p>
          )}
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
                {initialCustomer?.archived ? 'Restore customer' : 'Archive customer'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/customers"
              className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 rounded-lg transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 bg-[var(--color-primary)] hover:opacity-90 text-white font-medium text-sm rounded-lg transition-opacity disabled:opacity-50"
            >
              {isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Customer'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

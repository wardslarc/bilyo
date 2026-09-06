'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveBusinessProfile, type SerializedBusiness } from '@/actions/business';
import type { BusinessProfileInput } from '@/lib/validation/business';

interface BusinessProfileFormProps {
  initialBusiness: SerializedBusiness | null;
  isOnboarding?: boolean;
}

export function BusinessProfileForm({
  initialBusiness,
  isOnboarding = false,
}: BusinessProfileFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState<BusinessProfileInput>({
    businessName: initialBusiness?.businessName || '',
    address: initialBusiness?.address || '',
    email: initialBusiness?.email || '',
    phone: initialBusiness?.phone || '',
    tin: initialBusiness?.tin || '',
    vatRegistered: initialBusiness?.vatRegistered ?? false,
    logoUrl: initialBusiness?.logoUrl || '',
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setSuccessMessage(null);
    setFieldErrors({});

    startTransition(async () => {
      const res = await saveBusinessProfile(formData);

      if (!res.ok) {
        setGeneralError(res.error);
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        return;
      }

      setSuccessMessage('Business profile saved successfully.');

      if (isOnboarding) {
        // Redirect to dashboard overview once initial profile is set up
        router.push('/dashboard');
        router.refresh();
      }
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {isOnboarding && (
        <div
          role="status"
          className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900"
        >
          <svg
            className="w-5 h-5 text-amber-600 mt-0.5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h4 className="font-semibold text-sm">Welcome to Bilyo!</h4>
            <p className="text-xs text-amber-800 mt-0.5">
              Please complete your business profile before creating invoices or quotations. These details will appear on your generated documents.
            </p>
          </div>
        </div>
      )}

      {generalError && (
        <div
          role="alert"
          className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg"
        >
          {generalError}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg flex items-center gap-2"
        >
          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          {successMessage}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-[var(--color-line)] rounded-xl shadow-sm p-6 sm:p-8 space-y-6"
      >
        <div className="border-b border-[var(--color-line)] pb-4">
          <h2 className="text-lg font-semibold text-neutral-900">Business Details</h2>
          <p className="text-xs text-neutral-500 mt-1">
            This information will be stamped on your outgoing quotations and invoices.
          </p>
        </div>

        {/* Business Name */}
        <div>
          <label htmlFor="businessName" className="block text-xs font-medium text-neutral-700 mb-1">
            Business / Freelancer Name <span className="text-red-500">*</span>
          </label>
          <input
            id="businessName"
            name="businessName"
            type="text"
            required
            value={formData.businessName}
            onChange={handleChange}
            placeholder="e.g. Acme Creative Studio or Juan dela Cruz"
            className={`w-full px-3.5 py-2.5 text-sm rounded-lg border ${
              fieldErrors.businessName ? 'border-red-500 bg-red-50/20' : 'border-[var(--color-line)]'
            } focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]`}
          />
          {fieldErrors.businessName && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.businessName}</p>
          )}
        </div>

        {/* Address */}
        <div>
          <label htmlFor="address" className="block text-xs font-medium text-neutral-700 mb-1">
            Business Address
          </label>
          <textarea
            id="address"
            name="address"
            rows={2}
            value={formData.address || ''}
            onChange={handleChange}
            placeholder="Unit, Building, Street, Barangay, City, Province, ZIP"
            className={`w-full px-3.5 py-2.5 text-sm rounded-lg border ${
              fieldErrors.address ? 'border-red-500 bg-red-50/20' : 'border-[var(--color-line)]'
            } focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]`}
          />
          {fieldErrors.address && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.address}</p>
          )}
        </div>

        {/* Contact info: Email & Phone grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-neutral-700 mb-1">
              Billing / Contact Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email || ''}
              onChange={handleChange}
              placeholder="billing@example.com"
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
              Contact Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone || ''}
              onChange={handleChange}
              placeholder="0917 123 4567 or (02) 8123 4567"
              className={`w-full px-3.5 py-2.5 text-sm rounded-lg border ${
                fieldErrors.phone ? 'border-red-500 bg-red-50/20' : 'border-[var(--color-line)]'
              } focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]`}
            />
            {fieldErrors.phone && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>
            )}
          </div>
        </div>

        {/* Tax Identification Number (TIN) */}
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
            Standard format: 000-000-000 or 000-000-000-000. Leave blank if not registered.
          </p>
          {fieldErrors.tin && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.tin}</p>
          )}
        </div>

        {/* VAT Registered Toggle */}
        <div className="p-4 rounded-xl border border-[var(--color-line)] bg-neutral-50/50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="pr-4">
              <label htmlFor="vatRegistered" className="text-sm font-medium text-neutral-900 cursor-pointer">
                VAT Registered Entity
              </label>
              <p className="text-xs text-neutral-500 mt-0.5">
                When enabled, documents calculate a 12% Value-Added Tax (VAT) rate on taxable totals; when disabled, documents show 0% VAT.
              </p>
            </div>
            <input
              id="vatRegistered"
              name="vatRegistered"
              type="checkbox"
              checked={formData.vatRegistered}
              onChange={handleChange}
              className="w-5 h-5 rounded border-neutral-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
            />
          </div>
          {fieldErrors.vatRegistered && (
            <p className="text-xs text-red-600">{fieldErrors.vatRegistered}</p>
          )}
        </div>

        {/* Logo URL */}
        <div>
          <label htmlFor="logoUrl" className="block text-xs font-medium text-neutral-700 mb-1">
            Business Logo Image URL
          </label>
          <input
            id="logoUrl"
            name="logoUrl"
            type="url"
            value={formData.logoUrl || ''}
            onChange={handleChange}
            placeholder="https://example.com/logo.png"
            className={`w-full px-3.5 py-2.5 text-sm rounded-lg border ${
              fieldErrors.logoUrl ? 'border-red-500 bg-red-50/20' : 'border-[var(--color-line)]'
            } focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]`}
          />
          <p className="mt-1 text-xs text-neutral-400">
            Direct web link to your business logo (PNG, JPG, or WebP). Cloud file upload will be added in M6.
          </p>
          {fieldErrors.logoUrl && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.logoUrl}</p>
          )}
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="w-full sm:w-auto px-6 py-2.5 bg-[var(--color-primary)] hover:opacity-90 text-white font-medium text-sm rounded-lg transition-opacity disabled:opacity-50"
          >
            {isPending ? 'Saving profile...' : initialBusiness ? 'Update Profile' : 'Save & Continue'}
          </button>
        </div>
      </form>
    </div>
  );
}

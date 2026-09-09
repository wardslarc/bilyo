'use client';

import React, { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  saveBusinessProfile,
  uploadLogo,
  removeLogo,
  type SerializedBusiness,
} from '@/actions/business';
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

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoFile = async (file: File) => {
    setLogoUploadError(null);
    setGeneralError(null);

    // Client-side quick checks
    if (file.size > 2 * 1024 * 1024) {
      setLogoUploadError(`File exceeds the 2MB limit (selected ${(file.size / (1024 * 1024)).toFixed(2)}MB).`);
      return;
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setLogoUploadError('Only PNG, JPG, and WebP images are allowed.');
      return;
    }

    setIsUploadingLogo(true);
    try {
      const data = new FormData();
      data.append('file', file);

      const res = await uploadLogo(data);
      if (!res.ok) {
        setLogoUploadError(res.error);
        return;
      }

      setFormData((prev) => ({ ...prev, logoUrl: res.data.logoUrl }));
      setSuccessMessage('Logo uploaded and saved successfully.');
    } catch {
      setLogoUploadError('Failed to upload image. Please try again.');
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = async () => {
    setLogoUploadError(null);
    setGeneralError(null);
    setIsUploadingLogo(true);
    try {
      const res = await removeLogo();
      if (!res.ok) {
        setLogoUploadError(res.error);
        return;
      }
      setFormData((prev) => ({ ...prev, logoUrl: '' }));
      setSuccessMessage('Logo removed successfully.');
    } catch {
      setLogoUploadError('Failed to remove logo.');
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleLogoFile(droppedFile);
      }
    }
  };

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
              Please complete your business profile before creating quotations. These details will appear on your generated documents.
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
            This information will be stamped on your outgoing quotations.
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
            } focus:outline-none focus:ring-2 focus:ring-[var(--color-brass)]/40 focus:border-[var(--color-brass)]`}
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
            } focus:outline-none focus:ring-2 focus:ring-[var(--color-brass)]/40 focus:border-[var(--color-brass)]`}
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
              } focus:outline-none focus:ring-2 focus:ring-[var(--color-brass)]/40 focus:border-[var(--color-brass)]`}
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
              } focus:outline-none focus:ring-2 focus:ring-[var(--color-brass)]/40 focus:border-[var(--color-brass)]`}
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
            } focus:outline-none focus:ring-2 focus:ring-[var(--color-brass)]/40 focus:border-[var(--color-brass)]`}
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
              className="w-5 h-5 rounded border-neutral-300 text-[var(--color-brass)] focus:ring-[var(--color-brass)] cursor-pointer"
            />
          </div>
          {fieldErrors.vatRegistered && (
            <p className="text-xs text-red-600">{fieldErrors.vatRegistered}</p>
          )}
        </div>

        {/* Business Logo Upload */}
        <div className="space-y-3 pt-2">
          <div>
            <label className="block text-sm font-medium text-neutral-900">
              Business Logo
            </label>
            <p className="text-xs text-neutral-500 mt-0.5">
              Upload your company logo to appear on outgoing quotations and downloadable PDFs.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                const file = e.target.files[0];
                if (file) handleLogoFile(file);
              }
            }}
          />

          {logoUploadError && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{logoUploadError}</span>
            </div>
          )}

          {formData.logoUrl ? (
            <div className="p-4 border border-[var(--color-line)] rounded-xl bg-neutral-50/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-lg border border-[var(--color-line)] bg-white p-2 flex items-center justify-center overflow-hidden shadow-xs shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={formData.logoUrl}
                    alt="Uploaded business logo"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 mb-1">
                    Active Logo
                  </span>
                  <p className="text-xs text-neutral-500 max-w-xs break-all truncate">
                    {formData.logoUrl}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Renders on headers of outgoing documents and PDFs.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={isUploadingLogo || isPending}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 sm:flex-none px-3.5 py-2 text-xs font-medium text-neutral-700 bg-white border border-[var(--color-line)] hover:bg-neutral-50 rounded-lg transition-colors disabled:opacity-50 min-h-[44px] inline-flex items-center justify-center gap-1.5"
                >
                  <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  {isUploadingLogo ? 'Uploading...' : 'Replace'}
                </button>
                <button
                  type="button"
                  disabled={isUploadingLogo || isPending}
                  onClick={handleRemoveLogo}
                  className="flex-1 sm:flex-none px-3.5 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-50 min-h-[44px] inline-flex items-center justify-center gap-1.5"
                >
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 border-2 border-dashed rounded-xl cursor-pointer text-center transition-all ${
                isDragging
                  ? 'border-[var(--color-brass)] bg-[var(--color-brass)]/5 scale-[0.99]'
                  : 'border-[var(--color-line)] bg-neutral-50/50 hover:bg-neutral-50 hover:border-neutral-400'
              }`}
            >
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600">
                  {isUploadingLogo ? (
                    <svg className="animate-spin w-5 h-5 text-[var(--color-brass)]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
                <div className="text-sm font-medium text-neutral-800">
                  {isUploadingLogo ? 'Uploading and validating image...' : 'Click to upload or drag & drop'}
                </div>
                <p className="text-xs text-neutral-500">
                  PNG, JPG, or WebP only (up to 2MB). Magic bytes verified server-side.
                </p>
              </div>
            </div>
          )}

          {fieldErrors.logoUrl && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.logoUrl}</p>
          )}
        </div>

        <div className="pt-4 border-t border-[var(--color-line)] flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-xs text-neutral-400">
            Fields marked with <span className="text-red-500 font-semibold">*</span> are required.
          </p>
          <button
            type="submit"
            disabled={isPending}
            className="w-full sm:w-auto px-6 py-2.5 min-h-[44px] bg-[var(--color-brass)] hover:opacity-90 text-white font-medium text-sm rounded-lg shadow-sm transition-opacity disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <svg className="animate-spin -ml-0.5 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                Saving profile...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                {initialBusiness ? 'Update Profile' : 'Save & Continue'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  changePassword,
  changeEmail,
  exportUserData,
  closeAccount,
} from '@/actions/account';
import { formatDate } from '@/lib/dates';
import type { SanitizedUserData } from '@/lib/export';

interface AccountSettingsProps {
  user: SanitizedUserData;
}

export function AccountSettings({ user: initialUser }: AccountSettingsProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(initialUser);

  // Change Email State
  const [emailFormData, setEmailFormData] = useState({ email: '' });
  const [emailErrors, setEmailErrors] = useState<Record<string, string>>({});
  const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isEmailPending, startEmailTransition] = useTransition();

  // Change Password State
  const [passwordFormData, setPasswordFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isPasswordPending, startPasswordTransition] = useTransition();

  // Export State
  const [isExportPending, startExportTransition] = useTransition();
  const [exportError, setExportError] = useState<string | null>(null);

  // Close Account State
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeFormData, setCloseFormData] = useState({ confirmation: '', password: '' });
  const [closeErrors, setCloseErrors] = useState<Record<string, string>>({});
  const [closeError, setCloseError] = useState<string | null>(null);
  const [isClosePending, startCloseTransition] = useTransition();

  // Download helper for browser
  const triggerDownload = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    setExportError(null);
    startExportTransition(async () => {
      const res = await exportUserData();
      if (!res.ok) {
        setExportError(res.error || 'Failed to generate data export');
        return;
      }

      const dateStr = new Date().toISOString().split('T')[0];
      // Download Complete JSON
      triggerDownload(
        `bilyo-data-export-${dateStr}.json`,
        res.data.jsonString,
        'application/json'
      );

      // Download Invoices CSV
      triggerDownload(
        `bilyo-invoices-${dateStr}.csv`,
        res.data.invoicesCsv,
        'text/csv;charset=utf-8;'
      );

      // Download Quotations CSV
      triggerDownload(
        `bilyo-quotations-${dateStr}.csv`,
        res.data.quotationsCsv,
        'text/csv;charset=utf-8;'
      );

      // Download Customers CSV
      triggerDownload(
        `bilyo-customers-${dateStr}.csv`,
        res.data.customersCsv,
        'text/csv;charset=utf-8;'
      );
    });
  };

  const handleChangeEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailStatus(null);
    setEmailErrors({});

    startEmailTransition(async () => {
      const res = await changeEmail(emailFormData);
      if (!res.ok) {
        if (res.fieldErrors) {
          setEmailErrors(res.fieldErrors);
        }
        setEmailStatus({
          type: 'error',
          message: res.error || 'Failed to update email address',
        });
        return;
      }

      setCurrentUser((prev) => ({ ...prev, email: res.data.email }));
      setEmailFormData({ email: '' });
      setEmailStatus({
        type: 'success',
        message: `Email updated to ${res.data.email}. Please use this address for future sign-ins.`,
      });
      router.refresh();
    });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);
    setPasswordErrors({});

    startPasswordTransition(async () => {
      const res = await changePassword(passwordFormData);
      if (!res.ok) {
        if (res.fieldErrors) {
          setPasswordErrors(res.fieldErrors);
        }
        setPasswordStatus({
          type: 'error',
          message: res.error || 'Failed to update password',
        });
        return;
      }

      setPasswordFormData({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
      setPasswordStatus({
        type: 'success',
        message: 'Password updated successfully.',
      });
    });
  };

  const handleCloseAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setCloseError(null);
    setCloseErrors({});

    startCloseTransition(async () => {
      const res = await closeAccount(closeFormData);
      if (!res.ok) {
        if (res.fieldErrors) {
          setCloseErrors(res.fieldErrors);
        }
        setCloseError(res.error || 'Failed to close account');
        return;
      }

      // Account marked for deletion -> sign out to /login?closed=1
      await signOut({ callbackUrl: '/login?closed=1' });
    });
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-12">
      {/* Page Title & Profile Overview */}
      <div className="bg-white border border-[var(--color-line)] rounded-xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Account Settings
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Manage your credentials, data portability, and account security.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {currentUser.plan} Plan
            </span>
            {currentUser.role === 'ADMIN' && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                ADMIN
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 text-sm">
          <div>
            <span className="block text-xs font-medium text-neutral-400 uppercase tracking-wider">
              Full Name
            </span>
            <span className="font-medium text-neutral-900 mt-1 block">
              {currentUser.name || 'Not provided'}
            </span>
          </div>
          <div>
            <span className="block text-xs font-medium text-neutral-400 uppercase tracking-wider">
              Primary Email
            </span>
            <span className="font-medium text-neutral-900 mt-1 block">
              {currentUser.email}
            </span>
          </div>
          <div>
            <span className="block text-xs font-medium text-neutral-400 uppercase tracking-wider">
              Member Since
            </span>
            <span className="font-medium text-neutral-900 mt-1 block">
              {currentUser.createdAt ? formatDate(currentUser.createdAt) : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Change Email Section */}
      <div className="bg-white border border-[var(--color-line)] rounded-xl p-6 sm:p-8 shadow-sm">
        <div className="border-b border-neutral-100 pb-4 mb-6">
          <h2 className="text-lg font-semibold text-neutral-900">Change Email Address</h2>
          <p className="text-xs text-neutral-500 mt-1">
            Update the primary email address used to access your Bilyo account.
          </p>
        </div>

        {emailStatus && (
          <div
            className={`mb-5 p-3.5 text-sm rounded-lg border ${
              emailStatus.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {emailStatus.message}
          </div>
        )}

        <form onSubmit={handleChangeEmail} className="space-y-4 max-w-md">
          <div>
            <label htmlFor="new-email" className="block text-xs font-medium text-neutral-700 mb-1">
              New Email Address
            </label>
            <input
              id="new-email"
              type="email"
              required
              value={emailFormData.email}
              onChange={(e) => {
                setEmailFormData({ email: e.target.value });
                if (emailErrors.email) setEmailErrors({});
              }}
              placeholder="name@example.com"
              className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 transition-colors ${
                emailErrors.email
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                  : 'border-neutral-300 focus:border-neutral-900 focus:ring-neutral-100'
              }`}
            />
            {emailErrors.email && (
              <p className="text-xs text-red-600 mt-1">{emailErrors.email}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isEmailPending || !emailFormData.email}
            className="px-4 py-2 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {isEmailPending ? 'Updating Email...' : 'Update Email'}
          </button>
        </form>
      </div>

      {/* Change Password Section */}
      <div className="bg-white border border-[var(--color-line)] rounded-xl p-6 sm:p-8 shadow-sm">
        <div className="border-b border-neutral-100 pb-4 mb-6">
          <h2 className="text-lg font-semibold text-neutral-900">Change Password</h2>
          <p className="text-xs text-neutral-500 mt-1">
            Choose a strong password with at least 8 characters.
          </p>
        </div>

        {passwordStatus && (
          <div
            className={`mb-5 p-3.5 text-sm rounded-lg border ${
              passwordStatus.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {passwordStatus.message}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <div>
            <label
              htmlFor="current-password"
              className="block text-xs font-medium text-neutral-700 mb-1"
            >
              Current Password
            </label>
            <input
              id="current-password"
              type="password"
              required
              value={passwordFormData.currentPassword}
              onChange={(e) => {
                setPasswordFormData((prev) => ({ ...prev, currentPassword: e.target.value }));
                if (passwordErrors.currentPassword) setPasswordErrors({});
              }}
              className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 transition-colors ${
                passwordErrors.currentPassword
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                  : 'border-neutral-300 focus:border-neutral-900 focus:ring-neutral-100'
              }`}
            />
            {passwordErrors.currentPassword && (
              <p className="text-xs text-red-600 mt-1">{passwordErrors.currentPassword}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="new-password"
              className="block text-xs font-medium text-neutral-700 mb-1"
            >
              New Password (min 8 characters)
            </label>
            <input
              id="new-password"
              type="password"
              required
              value={passwordFormData.newPassword}
              onChange={(e) => {
                setPasswordFormData((prev) => ({ ...prev, newPassword: e.target.value }));
                if (passwordErrors.newPassword) setPasswordErrors({});
              }}
              className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 transition-colors ${
                passwordErrors.newPassword
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                  : 'border-neutral-300 focus:border-neutral-900 focus:ring-neutral-100'
              }`}
            />
            {passwordErrors.newPassword && (
              <p className="text-xs text-red-600 mt-1">{passwordErrors.newPassword}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirm-new-password"
              className="block text-xs font-medium text-neutral-700 mb-1"
            >
              Confirm New Password
            </label>
            <input
              id="confirm-new-password"
              type="password"
              required
              value={passwordFormData.confirmNewPassword}
              onChange={(e) => {
                setPasswordFormData((prev) => ({ ...prev, confirmNewPassword: e.target.value }));
                if (passwordErrors.confirmNewPassword) setPasswordErrors({});
              }}
              className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 transition-colors ${
                passwordErrors.confirmNewPassword
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                  : 'border-neutral-300 focus:border-neutral-900 focus:ring-neutral-100'
              }`}
            />
            {passwordErrors.confirmNewPassword && (
              <p className="text-xs text-red-600 mt-1">{passwordErrors.confirmNewPassword}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isPasswordPending}
            className="px-4 py-2 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {isPasswordPending ? 'Updating Password...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Export My Data Section (PH Data Privacy Act) */}
      <div className="bg-white border border-[var(--color-line)] rounded-xl p-6 sm:p-8 shadow-sm">
        <div className="border-b border-neutral-100 pb-4 mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-neutral-900">Data Portability</h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
              PH RA 10173
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Export a full copy of your account data, business profile, customers, products,
            quotations, and invoices in portable formats (JSON and CSV).
          </p>
        </div>

        {exportError && (
          <div className="mb-5 p-3.5 text-sm rounded-lg bg-red-50 border border-red-200 text-red-800">
            {exportError}
          </div>
        )}

        <div className="space-y-4">
          <p className="text-sm text-neutral-600 leading-relaxed">
            In compliance with the <strong>Philippine Data Privacy Act of 2012</strong>, you have
            the statutory right to data portability. Your export contains complete records
            strictly scoped to your account, with sensitive authentication tokens securely excluded.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleExport}
              disabled={isExportPending}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {isExportPending ? 'Generating Export Files...' : 'Export My Data (JSON & CSV)'}
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone / Close Account */}
      <div className="bg-white border border-red-200 rounded-xl p-6 sm:p-8 shadow-sm">
        <div className="border-b border-red-100 pb-4 mb-6">
          <h2 className="text-lg font-semibold text-red-900">Danger Zone</h2>
          <p className="text-xs text-red-600/80 mt-1">
            Permanently close your account. Please proceed with caution.
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-neutral-600 leading-relaxed">
            Closing your account will set a formal deletion request, sign you out immediately, and
            block any future sign-in. To honor tax recordkeeping and preserve customer access,
            existing sent documents and public links remain accessible during the statutory
            retention window. Nothing is hard-deleted.
          </p>

          {!showCloseModal ? (
            <button
              type="button"
              onClick={() => setShowCloseModal(true)}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer"
            >
              Close My Account
            </button>
          ) : (
            <div className="p-4 sm:p-5 bg-red-50/60 border border-red-200 rounded-xl space-y-4 max-w-lg mt-4">
              <h3 className="text-sm font-semibold text-red-950">
                Confirm Account Closure
              </h3>
              <p className="text-xs text-red-800">
                To confirm closure, please enter your password and type{' '}
                <strong className="font-mono text-red-900">CLOSE</strong> below.
              </p>

              {closeError && (
                <div className="p-3 text-xs rounded-lg bg-red-100 text-red-900 border border-red-300">
                  {closeError}
                </div>
              )}

              <form onSubmit={handleCloseAccount} className="space-y-3">
                <div>
                  <label
                    htmlFor="close-password"
                    className="block text-xs font-medium text-red-900 mb-1"
                  >
                    Your Password
                  </label>
                  <input
                    id="close-password"
                    type="password"
                    required
                    value={closeFormData.password}
                    onChange={(e) =>
                      setCloseFormData((prev) => ({ ...prev, password: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-red-300 bg-white focus:outline-none focus:ring-2 focus:ring-red-200"
                  />
                  {closeErrors.password && (
                    <p className="text-xs text-red-700 mt-1">{closeErrors.password}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="close-confirmation"
                    className="block text-xs font-medium text-red-900 mb-1"
                  >
                    Type CLOSE to confirm
                  </label>
                  <input
                    id="close-confirmation"
                    type="text"
                    required
                    value={closeFormData.confirmation}
                    onChange={(e) =>
                      setCloseFormData((prev) => ({ ...prev, confirmation: e.target.value }))
                    }
                    placeholder="CLOSE"
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-red-300 bg-white focus:outline-none focus:ring-2 focus:ring-red-200"
                  />
                  {closeErrors.confirmation && (
                    <p className="text-xs text-red-700 mt-1">{closeErrors.confirmation}</p>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={
                      isClosePending ||
                      closeFormData.confirmation !== 'CLOSE' ||
                      !closeFormData.password
                    }
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    {isClosePending ? 'Closing Account...' : 'Permanently Request Account Closure'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCloseModal(false);
                      setCloseFormData({ confirmation: '', password: '' });
                      setCloseError(null);
                      setCloseErrors({});
                    }}
                    className="px-3 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

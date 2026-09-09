'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  suspendUser,
  unsuspendUser,
  disableUserPublicLinks,
  enableUserPublicLinks,
  resetUserMfa,
} from '@/actions/admin/users';
import { formatDate } from '@/lib/dates';

interface AdminUserControlsProps {
  user: {
    id: string;
    email: string;
    name: string;
    role: 'USER' | 'ADMIN';
    suspendedAt: Date | null;
    suspendedReason?: string | null;
    publicLinksDisabledAt?: Date | null;
    mfaEnabled?: boolean;
    mfaEnabledAt?: Date | null;
  };
}

type ModalType =
  | 'suspend'
  | 'unsuspend'
  | 'disable-links'
  | 'enable-links'
  | 'mfa-reset'
  | null;

export function AdminUserControls({ user }: AdminUserControlsProps) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const isSuspended = !!user.suspendedAt;
  const isPublicLinksDisabled = !!user.publicLinksDisabledAt;
  const isAdmin = user.role === 'ADMIN';

  const openModal = (type: ModalType) => {
    setActiveModal(type);
    setReason('');
    setError(null);
  };

  const closeModal = () => {
    if (isPending) return;
    setActiveModal(null);
    setReason('');
    setError(null);
  };

  const handleConfirm = () => {
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      setError('A reason of at least 10 characters is required.');
      return;
    }

    setError(null);
    startTransition(async () => {
      let res;
      if (activeModal === 'suspend') {
        res = await suspendUser({ userId: user.id, reason: trimmed });
      } else if (activeModal === 'unsuspend') {
        res = await unsuspendUser({ userId: user.id, reason: trimmed });
      } else if (activeModal === 'disable-links') {
        res = await disableUserPublicLinks({ userId: user.id, reason: trimmed });
      } else if (activeModal === 'enable-links') {
        res = await enableUserPublicLinks({ userId: user.id, reason: trimmed });
      } else if (activeModal === 'mfa-reset') {
        res = await resetUserMfa({ userId: user.id, reason: trimmed });
      }

      if (res && !res.ok) {
        setError(res.error);
      } else {
        closeModal();
        setSuccess(
          activeModal === 'suspend'
            ? 'Account has been suspended.'
            : activeModal === 'unsuspend'
              ? 'Account has been unsuspended.'
              : activeModal === 'disable-links'
                ? 'Public links have been disabled for this user.'
                : activeModal === 'enable-links'
                  ? 'Public links have been re-enabled for this user.'
                  : 'MFA has been reset. The user must enrol a new authenticator device on next sign-in.'
        );
        router.refresh();
      }
    });
  };

  const isReasonValid = reason.trim().length >= 10;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-slate-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
            />
          </svg>
          <h2 className="font-semibold text-slate-900">Administrative Controls</h2>
        </div>
        <span className="text-xs text-slate-400">Audited Mutations</span>
      </div>

      {/* Success banner */}
      {success && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center justify-between">
          <span>{success}</span>
          <button
            onClick={() => setSuccess(null)}
            className="text-emerald-600 hover:text-emerald-900 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* Control Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Account Suspension Box (§5.9) */}
        <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Account Status
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                {isSuspended
                  ? `Suspended: "${user.suspendedReason || 'No reason provided'}"`
                  : 'Account is active and permitted to sign in.'}
              </p>
            </div>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                isSuspended
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {isSuspended ? 'SUSPENDED' : 'ACTIVE'}
            </span>
          </div>

          {isAdmin ? (
            <p className="text-xs text-slate-400 italic">
              Platform administrators cannot be suspended from the console.
            </p>
          ) : isSuspended ? (
            <button
              id="btn-unsuspend-user"
              onClick={() => openModal('unsuspend')}
              className="w-full sm:w-auto inline-flex items-center justify-center px-3.5 py-1.5 text-xs font-semibold rounded-md shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
            >
              Unsuspend Account
            </button>
          ) : (
            <button
              id="btn-suspend-user"
              onClick={() => openModal('suspend')}
              className="w-full sm:w-auto inline-flex items-center justify-center px-3.5 py-1.5 text-xs font-semibold rounded-md shadow-xs bg-rose-600 hover:bg-rose-700 text-white transition-colors"
            >
              Suspend Account...
            </button>
          )}
        </div>

        {/* Public Link Control Box (§5.9) */}
        <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Public Document Links
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                {isPublicLinksDisabled && user.publicLinksDisabledAt
                  ? `Public links disabled on ${formatDate(user.publicLinksDisabledAt)} (returning 404)`
                  : 'Customer quotation links (/q/*) are active and resolving.'}
              </p>
            </div>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                isPublicLinksDisabled
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {isPublicLinksDisabled ? 'DISABLED (404)' : 'ACTIVE'}
            </span>
          </div>

          {isPublicLinksDisabled ? (
            <button
              id="btn-enable-links"
              onClick={() => openModal('enable-links')}
              className="w-full sm:w-auto inline-flex items-center justify-center px-3.5 py-1.5 text-xs font-semibold rounded-md shadow-xs bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            >
              Re-enable Public Links
            </button>
          ) : (
            <button
              id="btn-disable-links"
              onClick={() => openModal('disable-links')}
              className="w-full sm:w-auto inline-flex items-center justify-center px-3.5 py-1.5 text-xs font-semibold rounded-md shadow-xs bg-amber-600 hover:bg-amber-700 text-white transition-colors"
            >
              Disable All Public Links...
            </button>
          )}
        </div>

        {/* Multi-Factor Authentication Card (§5.11, M7-T08) */}
        <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Multi-Factor Auth (MFA)
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                {user.mfaEnabled
                  ? user.mfaEnabledAt
                    ? `Enrolled on ${formatDate(user.mfaEnabledAt)}`
                    : 'TOTP 2FA active on account.'
                  : 'MFA not enrolled or reset. Required at next login.'}
              </p>
            </div>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                user.mfaEnabled
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {user.mfaEnabled ? 'ENROLLED' : 'NOT ENROLLED'}
            </span>
          </div>

          {isAdmin ? (
            <p className="text-xs text-slate-400 italic">
              Admin MFA cannot be reset from console (CLI: npm run reset-mfa).
            </p>
          ) : user.mfaEnabled ? (
            <button
              id="btn-reset-mfa"
              onClick={() => openModal('mfa-reset')}
              className="w-full sm:w-auto inline-flex items-center justify-center px-3.5 py-1.5 text-xs font-semibold rounded-md shadow-xs bg-amber-600 hover:bg-amber-700 text-white transition-colors"
            >
              Reset MFA...
            </button>
          ) : (
            <span className="text-xs text-slate-400 italic">
              User will enrol upon next sign-in.
            </span>
          )}
        </div>
      </div>

      {/* Confirmation Modals */}
      {activeModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scaleUp">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    activeModal === 'suspend'
                      ? 'bg-rose-100 text-rose-700'
                      : activeModal === 'unsuspend'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {activeModal === 'suspend' && 'Confirm Account Suspension'}
                    {activeModal === 'unsuspend' && 'Confirm Account Unsuspension'}
                    {activeModal === 'disable-links' && 'Disable All Public Links (Abuse Containment)'}
                    {activeModal === 'enable-links' && 'Re-enable Public Document Links'}
                    {activeModal === 'mfa-reset' && 'Reset Multi-Factor Authentication (MFA)'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Target account:{' '}
                    <strong className="font-mono text-slate-800">{user.email}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                disabled={isPending}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Explanatory notice */}
            <div className="text-xs text-slate-600 bg-slate-50 p-3.5 rounded-lg border border-slate-200 leading-relaxed">
              {activeModal === 'suspend' && (
                <span>
                  Suspending this account immediately blocks future sign-ins and prevents mutating
                  actions. <strong>Existing public links stay alive</strong> so issued quotations
                  remain accessible to customers (§5.9).
                </span>
              )}
              {activeModal === 'unsuspend' && (
                <span>
                  Unsuspending this account clears suspension flags and immediately restores login and
                  document mutation capabilities for <strong className="font-mono">{user.email}</strong>.
                </span>
              )}
              {activeModal === 'disable-links' && (
                <span>
                  <strong>Abuse & fraud containment:</strong> Setting{' '}
                  <code className="font-mono bg-slate-200 px-1 py-0.5 rounded">publicLinksDisabledAt</code>{' '}
                  makes every public quotation link (<code className="font-mono">/q/*</code>) for this account immediately return 404.
                </span>
              )}
              {activeModal === 'enable-links' && (
                <span>
                  Re-enabling public links clears the link disabled restriction. Customer-facing quotation
                  views will resolve normally again.
                </span>
              )}
              {activeModal === 'mfa-reset' && (
                <span>
                  <strong>Locked-out account recovery (§5.11 rule 9):</strong> Resetting MFA for{' '}
                  <strong className="font-mono">{user.email}</strong> will immediately clear all enrolled
                  secrets, replay counters, and recovery codes. The user will be required to configure a new
                  authenticator app from scratch upon their next sign-in.
                </span>
              )}
            </div>

            {/* Mandatory Reason Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Mandatory Operational Justification (Audit Log)
                </label>
                <span
                  className={`text-[11px] font-mono ${
                    isReasonValid ? 'text-slate-400' : 'text-amber-600 font-semibold'
                  }`}
                >
                  {reason.trim().length}/10 chars min
                </span>
              </div>
              <textarea
                id="input-admin-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe the verified operational justification or support ticket ID (min 10 chars)..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 disabled:bg-slate-50"
                disabled={isPending}
                autoFocus
              />
              <p className="text-[11px] text-slate-400">
                This entry will be permanently recorded in the immutable platform audit log with your admin identity.
              </p>
            </div>

            {/* Error banner */}
            {error && (
              <div className="p-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-md">
                {error}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={closeModal}
                disabled={isPending}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-admin-action"
                onClick={handleConfirm}
                disabled={!isReasonValid || isPending}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs ${
                  activeModal === 'suspend'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : activeModal === 'unsuspend'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {isPending ? 'Processing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

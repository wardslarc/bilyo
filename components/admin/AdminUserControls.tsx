'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  suspendUser,
  unsuspendUser,
  disableUserPublicLinks,
  enableUserPublicLinks,
  setPlanOverride,
  clearPlanOverride,
} from '@/actions/admin/users';
import { formatDate } from '@/lib/dates';
import type { Plan } from '@/types';

interface AdminUserControlsProps {
  user: {
    id: string;
    email: string;
    name: string;
    role: 'USER' | 'ADMIN';
    plan: 'FREE' | 'FREELANCER' | 'BUSINESS';
    planSource: 'DEFAULT' | 'BILLING' | 'ADMIN';
    isPlanOverridden: boolean;
    planOverrideExpiresAt?: Date | null;
    planOverrideReason?: string | null;
    billingPlan?: 'FREE' | 'FREELANCER' | 'BUSINESS' | null;
    suspendedAt: Date | null;
    suspendedReason?: string | null;
    publicLinksDisabledAt?: Date | null;
  };
}

type ModalType =
  | 'suspend'
  | 'unsuspend'
  | 'disable-links'
  | 'enable-links'
  | 'set-plan'
  | 'clear-plan'
  | null;

export function AdminUserControls({ user }: AdminUserControlsProps) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [reason, setReason] = useState('');
  const [overridePlan, setOverridePlan] = useState<Plan>('BUSINESS');
  const [overrideDays, setOverrideDays] = useState<number>(90);
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
    if (type === 'set-plan') {
      setOverridePlan(user.plan === 'FREE' ? 'BUSINESS' : user.plan);
      setOverrideDays(90);
    }
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
      } else if (activeModal === 'set-plan') {
        res = await setPlanOverride({
          userId: user.id,
          plan: overridePlan,
          reason: trimmed,
          days: overrideDays,
        });
      } else if (activeModal === 'clear-plan') {
        res = await clearPlanOverride({ userId: user.id, reason: trimmed });
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
                  : activeModal === 'set-plan'
                    ? `Plan override to ${overridePlan} set for ${overrideDays} days.`
                    : 'Plan override has been cleared.'
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
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <h2 className="font-semibold text-slate-900">
            Account & Security Controls
          </h2>
        </div>
        <span className="text-xs text-slate-400 font-medium">Audited Actions (§5.8, §5.9, §5.10)</span>
      </div>

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{success}</span>
          </div>
          <button
            onClick={() => setSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Plan & Subscription Card (§5.10) */}
        <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Subscription Tier
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono font-bold text-sm text-slate-900">
                  {user.plan}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                    user.isPlanOverridden
                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                      : user.planSource === 'BILLING'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {user.isPlanOverridden
                    ? 'ADMIN OVERRIDE'
                    : user.planSource === 'BILLING'
                      ? 'BILLING'
                      : 'DEFAULT'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {user.isPlanOverridden && user.planOverrideExpiresAt
                  ? `Override expires ${formatDate(user.planOverrideExpiresAt)}`
                  : user.billingPlan
                    ? `Billing plan: ${user.billingPlan}`
                    : 'Standard free tier.'}
              </p>
              {user.isPlanOverridden && user.planOverrideReason && (
                <p className="text-[11px] text-purple-700 mt-0.5 italic">
                  &ldquo;{user.planOverrideReason}&rdquo;
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              id="btn-override-plan"
              onClick={() => openModal('set-plan')}
              className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold rounded-md shadow-xs bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            >
              {user.isPlanOverridden ? 'Update Override...' : 'Override Plan...'}
            </button>
            {user.isPlanOverridden && (
              <button
                id="btn-clear-plan-override"
                onClick={() => openModal('clear-plan')}
                className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
              >
                Clear Override
              </button>
            )}
          </div>
        </div>

        {/* Suspension Control Box (§5.9) */}
        <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Account Access
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                {isSuspended && user.suspendedAt
                  ? `Suspended on ${formatDate(user.suspendedAt)}`
                  : 'Account is active. Sign-in and document mutations enabled.'}
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
                  : 'Customer links (/i/*, /q/*) are active and resolving.'}
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
                        : activeModal === 'disable-links'
                          ? 'bg-amber-100 text-amber-700'
                          : activeModal === 'enable-links'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-purple-100 text-purple-700'
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
                    {activeModal === 'set-plan' && 'Set Administrative Plan Override'}
                    {activeModal === 'clear-plan' && 'Clear Administrative Plan Override'}
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

            {/* Plan override specific fields */}
            {activeModal === 'set-plan' && (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Override Plan Tier
                    </label>
                    <select
                      id="select-override-plan"
                      value={overridePlan}
                      onChange={(e) => setOverridePlan(e.target.value as Plan)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-semibold"
                    >
                      <option value="FREELANCER">FREELANCER (₱299/mo)</option>
                      <option value="BUSINESS">BUSINESS (₱599/mo)</option>
                      <option value="FREE">FREE</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Duration (Days)
                    </label>
                    <select
                      id="select-override-days"
                      value={overrideDays}
                      onChange={(e) => setOverrideDays(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                    >
                      <option value={30}>30 Days (1 Month)</option>
                      <option value={60}>60 Days (2 Months)</option>
                      <option value={90}>90 Days (Default / Quarter)</option>
                      <option value={180}>180 Days (Half Year)</option>
                      <option value={365}>365 Days (1 Year)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Explanatory notice */}
            <div className="text-xs text-slate-600 bg-slate-50 p-3.5 rounded-lg border border-slate-200 leading-relaxed">
              {activeModal === 'suspend' && (
                <span>
                  Suspending this account immediately blocks future sign-ins and prevents mutating
                  actions. <strong>Existing public links stay alive</strong> so issued invoices
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
                  makes every public invoice and quotation link (<code className="font-mono">/i/*</code>,{' '}
                  <code className="font-mono">/q/*</code>) for this account immediately return 404.
                </span>
              )}
              {activeModal === 'enable-links' && (
                <span>
                  Re-enabling public links clears the link disabled restriction. Customer-facing invoice
                  and quotation views will resolve normally again.
                </span>
              )}
              {activeModal === 'set-plan' && (
                <span>
                  An administrative override takes effect immediately and lifts plan limits instantly (§5.10).
                  When the duration expires, the account falls back gracefully to billing or FREE with zero
                  background cleanup jobs.
                </span>
              )}
              {activeModal === 'clear-plan' && (
                <span>
                  Clearing the override restores the user to their underlying billing plan (or FREE default)
                  immediately.
                </span>
              )}
            </div>

            {/* Error banner */}
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Reason Textarea (M7-T06: requires min 10 chars before button enables) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="action-reason-input" className="font-semibold text-slate-700">
                  Justification / Reason (Audited)
                </label>
                <span
                  className={`font-mono text-[11px] ${
                    isReasonValid ? 'text-emerald-600 font-bold' : 'text-slate-400'
                  }`}
                >
                  {reason.trim().length} / 10 characters min
                </span>
              </div>
              <textarea
                id="action-reason-input"
                rows={3}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isPending}
                placeholder="Specify the operational or support justification for this action..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                autoFocus
              />
              <p className="text-[11px] text-slate-400">
                This justification will be permanently recorded in the append-only admin audit log.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={isPending}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-action"
                type="button"
                onClick={handleConfirm}
                disabled={!isReasonValid || isPending}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-md shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  activeModal === 'suspend'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : activeModal === 'unsuspend'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : activeModal === 'disable-links'
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : activeModal === 'set-plan'
                          ? 'bg-purple-600 hover:bg-purple-700'
                          : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isPending && (
                  <svg className="animate-spin w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                <span>
                  {activeModal === 'suspend' && 'Confirm Suspension'}
                  {activeModal === 'unsuspend' && 'Confirm Unsuspension'}
                  {activeModal === 'disable-links' && 'Confirm Link Disablement'}
                  {activeModal === 'enable-links' && 'Confirm Link Re-enablement'}
                  {activeModal === 'set-plan' && 'Apply Plan Override'}
                  {activeModal === 'clear-plan' && 'Clear Plan Override'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

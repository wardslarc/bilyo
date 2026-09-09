'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { signIn } from 'next-auth/react';
import {
  regenerateRecoveryCodes,
  initiateDeviceReplacement,
  confirmDeviceReplacement,
} from '@/actions/account';
import { initiateMfaEnrolment, confirmMfaEnrolment } from '@/actions/mfa';
import { formatDate } from '@/lib/dates';

interface AccountSecuritySettingsProps {
  initialStatus: {
    mfaEnabled: boolean;
    mfaEnabledAt: Date | string | null;
    remainingRecoveryCodes: number;
  };
}

export function AccountSecuritySettings({ initialStatus }: AccountSecuritySettingsProps) {
  const [status, setStatus] = useState(initialStatus);

  // Opt-in enrolment state (when !status.mfaEnabled)
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrolLoadingQr, setEnrolLoadingQr] = useState(false);
  const [enrolQrDataUrl, setEnrolQrDataUrl] = useState<string | null>(null);
  const [enrolSecretBase32, setEnrolSecretBase32] = useState<string | null>(null);
  const [enrolCode, setEnrolCode] = useState('');
  const [enrolError, setEnrolError] = useState<string | null>(null);
  const [copiedEnrolKey, setCopiedEnrolKey] = useState(false);
  const [enrolRecoveryCodes, setEnrolRecoveryCodes] = useState<string[] | null>(null);
  const [copiedEnrolCodes, setCopiedEnrolCodes] = useState(false);
  const [isEnrolPending, startEnrolTransition] = useTransition();

  // Recovery codes regeneration state (when status.mfaEnabled)
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [regenPassword, setRegenPassword] = useState('');
  const [regenError, setRegenError] = useState<string | null>(null);
  const [newRecoveryCodes, setNewRecoveryCodes] = useState<string[] | null>(null);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [isRegenPending, startRegenTransition] = useTransition();

  // Device replacement state (when status.mfaEnabled)
  const [isReplacingDevice, setIsReplacingDevice] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secretBase32, setSecretBase32] = useState<string | null>(null);
  const [replacementCode, setReplacementCode] = useState('');
  const [replacementError, setReplacementError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [replacementCodes, setReplacementCodes] = useState<string[] | null>(null);
  const [isReplacePending, startReplaceTransition] = useTransition();

  // --------------------------------------------------------------------------
  // Enrolment Handlers
  // --------------------------------------------------------------------------
  const handleStartEnrolment = () => {
    setIsEnrolling(true);
    setEnrolLoadingQr(true);
    setEnrolError(null);
    setEnrolCode('');
    setEnrolRecoveryCodes(null);

    startEnrolTransition(async () => {
      const res = await initiateMfaEnrolment();
      setEnrolLoadingQr(false);
      if (!res.ok) {
        setEnrolError(res.error || 'Failed to initiate MFA setup');
        return;
      }
      setEnrolQrDataUrl(res.data.qrDataUrl);
      setEnrolSecretBase32(res.data.secretBase32);
    });
  };

  const handleCopyEnrolKey = () => {
    if (!enrolSecretBase32) return;
    navigator.clipboard.writeText(enrolSecretBase32);
    setCopiedEnrolKey(true);
    setTimeout(() => setCopiedEnrolKey(false), 2000);
  };

  const handleConfirmEnrolment = (e: React.FormEvent) => {
    e.preventDefault();
    setEnrolError(null);

    const clean = enrolCode.trim();
    if (clean.length !== 6) {
      setEnrolError('Please enter a 6-digit verification code');
      return;
    }

    startEnrolTransition(async () => {
      const res = await confirmMfaEnrolment(clean);
      if (!res.ok) {
        setEnrolError(res.error || 'Failed to verify code');
        return;
      }

      setEnrolRecoveryCodes(res.data.recoveryCodes);

      // Eagerly refresh session so JWT token has mfaEnabled: true
      if (res.data.mfaSessionToken) {
        signIn('credentials', {
          mfaSessionToken: res.data.mfaSessionToken,
          redirect: false,
        }).catch((err) => {
          console.error('Failed to eagerly refresh session:', err);
        });
      }
    });
  };

  const handleFinishEnrolment = () => {
    setStatus({
      mfaEnabled: true,
      mfaEnabledAt: new Date(),
      remainingRecoveryCodes: 10,
    });
    setIsEnrolling(false);
    setEnrolRecoveryCodes(null);
    setEnrolCode('');
  };

  // --------------------------------------------------------------------------
  // Recovery Codes & Replacement Handlers
  // --------------------------------------------------------------------------
  const handleCopyKey = () => {
    if (!secretBase32) return;
    navigator.clipboard.writeText(secretBase32);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleDownloadCodes = (codes: string[]) => {
    const text = [
      'Bilyo Account Recovery Codes',
      `Generated: ${new Date().toISOString()}`,
      '',
      'Each recovery code can be used once to sign in if you lose access to your authenticator app.',
      'All previous recovery codes have been invalidated.',
      '',
      ...codes,
    ].join('\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bilyo-recovery-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyAll = (codes: string[]) => {
    navigator.clipboard.writeText(codes.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  const handleRegenerateCodes = (e: React.FormEvent) => {
    e.preventDefault();
    setRegenError(null);

    startRegenTransition(async () => {
      const res = await regenerateRecoveryCodes({ password: regenPassword });
      if (!res.ok) {
        setRegenError(res.error || 'Failed to regenerate recovery codes');
        return;
      }

      setNewRecoveryCodes(res.data.recoveryCodes);
      setStatus((prev) => ({
        ...prev,
        remainingRecoveryCodes: res.data.remainingRecoveryCodes,
      }));
      setRegenPassword('');
    });
  };

  const handleStartDeviceReplacement = () => {
    setIsReplacingDevice(true);
    setLoadingQr(true);
    setReplacementError(null);
    setReplacementCode('');
    setReplacementCodes(null);

    startReplaceTransition(async () => {
      const res = await initiateDeviceReplacement();
      setLoadingQr(false);
      if (!res.ok) {
        setReplacementError(res.error || 'Failed to initiate device replacement');
        return;
      }

      setQrDataUrl(res.data.qrDataUrl);
      setSecretBase32(res.data.secretBase32);
    });
  };

  const handleConfirmReplacement = (e: React.FormEvent) => {
    e.preventDefault();
    setReplacementError(null);

    if (replacementCode.length !== 6) {
      setReplacementError('Please enter a 6-digit verification code');
      return;
    }

    startReplaceTransition(async () => {
      const res = await confirmDeviceReplacement({ code: replacementCode });
      if (!res.ok) {
        setReplacementError(res.error || 'Failed to verify new device');
        return;
      }

      setReplacementCodes(res.data.recoveryCodes);
      setStatus((prev) => ({
        ...prev,
        remainingRecoveryCodes: res.data.remainingRecoveryCodes,
      }));
    });
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-12">
      {/* Navigation Breadcrumb */}
      <div>
        <Link
          href="/dashboard/account"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <span>←</span> Back to Account Settings
        </Link>
      </div>

      {/* Security Overview Header */}
      <div className="bg-white border border-[var(--color-line)] rounded-xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Two-Factor Authentication
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              {status.mfaEnabled
                ? 'TOTP protection, recovery codes, and authenticator device management.'
                : 'Add an extra layer of protection to your account using an authenticator app.'}
            </p>
          </div>
          <div>
            {status.mfaEnabled ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                ● Active & Enforced
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
                ○ Optional · Not Enabled
              </span>
            )}
          </div>
        </div>

        {status.mfaEnabled ? (
          <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
            <div>
              <span className="block text-xs font-medium text-neutral-400 uppercase tracking-wider">
                Verification Method
              </span>
              <span className="font-medium text-neutral-900 mt-1 block">
                Authenticator App (RFC 6238 TOTP)
              </span>
            </div>
            <div>
              <span className="block text-xs font-medium text-neutral-400 uppercase tracking-wider">
                Enrolled Since
              </span>
              <span className="font-medium text-neutral-900 mt-1 block">
                {status.mfaEnabledAt ? formatDate(status.mfaEnabledAt) : 'Active'}
              </span>
            </div>
          </div>
        ) : (
          <div className="pt-6 text-sm text-neutral-600">
            Two-factor authentication is optional. Enabling it protects your quotations and customer data by requiring a 6-digit code from your phone whenever you sign in.
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* Enrolment Section (when not enrolled)                                */}
      {/* ==================================================================== */}
      {!status.mfaEnabled && (
        <div className="bg-white border border-[var(--color-line)] rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
          {!isEnrolling ? (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-700 shrink-0 text-lg">
                  🛡️
                </div>
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-neutral-900">
                    Set up an Authenticator App
                  </h2>
                  <p className="text-sm text-neutral-600 leading-relaxed max-w-xl">
                    Works with Google Authenticator, 1Password, Microsoft Authenticator, Authy, or any standard RFC 6238 TOTP application.
                  </p>
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleStartEnrolment}
                  className="min-h-[44px] px-5 text-sm font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-sm transition-colors cursor-pointer inline-flex items-center gap-2"
                >
                  <span>Enable Two-Factor Authentication</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          ) : !enrolRecoveryCodes ? (
            /* Step 1: Scan QR & verify code */
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">Set Up Authenticator</h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Scan the QR code with your authenticator app, then enter the 6-digit verification code.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEnrolling(false)}
                  className="text-xs text-neutral-500 hover:text-neutral-800 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {enrolError && (
                <div className="p-3 text-xs rounded-lg bg-red-50 text-red-800 border border-red-200">
                  {enrolError}
                </div>
              )}

              {enrolLoadingQr ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="animate-spin h-8 w-8 border-2 border-neutral-900 border-t-transparent rounded-full" />
                  <p className="text-xs text-neutral-500">Generating secure QR code...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                  {/* QR code and manual key */}
                  <div className="flex flex-col items-center gap-3">
                    {enrolQrDataUrl && (
                      <div className="p-3 bg-white border border-neutral-200 rounded-xl shadow-xs">
                        <Image
                          src={enrolQrDataUrl}
                          alt="MFA QR Code"
                          width={192}
                          height={192}
                          className="rounded"
                        />
                      </div>
                    )}
                    <p className="text-xs text-neutral-500 text-center max-w-xs">
                      Scan with <strong>Google Authenticator</strong> or your preferred TOTP app.
                    </p>

                    {enrolSecretBase32 && (
                      <div className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-center">
                        <span className="block text-[11px] text-neutral-500 mb-1">
                          Can&apos;t scan? Enter this key manually:
                        </span>
                        <code className="text-xs font-mono font-bold text-neutral-900 select-all break-all block">
                          {enrolSecretBase32}
                        </code>
                        <button
                          type="button"
                          onClick={handleCopyEnrolKey}
                          className="mt-1.5 text-xs text-neutral-700 hover:underline cursor-pointer"
                        >
                          {copiedEnrolKey ? '✓ Copied!' : 'Copy Key'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Verification Form */}
                  <form onSubmit={handleConfirmEnrolment} className="space-y-4">
                    <h3 className="text-sm font-semibold text-neutral-900">
                      Verify & Activate
                    </h3>
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      Enter the 6-digit code shown in your authenticator app to complete setup.
                    </p>

                    <div>
                      <label
                        htmlFor="enrol-code"
                        className="block text-xs font-medium text-neutral-700 mb-1"
                      >
                        6-Digit Security Code
                      </label>
                      <input
                        id="enrol-code"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        required
                        autoFocus
                        placeholder="000000"
                        value={enrolCode}
                        onChange={(e) =>
                          setEnrolCode(e.target.value.replace(/\D/g, ''))
                        }
                        className="w-full px-3 py-2.5 text-center text-xl font-mono tracking-widest rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-200"
                      />
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={isEnrolPending || enrolCode.trim().length !== 6}
                        className="min-h-[44px] px-5 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center"
                      >
                        {isEnrolPending ? 'Verifying...' : 'Verify and Enable'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEnrolling(false)}
                        className="min-h-[44px] px-3 text-sm font-medium text-neutral-600 hover:text-neutral-900 cursor-pointer flex items-center justify-center"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          ) : (
            /* Step 2: Show generated recovery codes */
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <span>✓</span> Two-Factor Authentication Activated!
                </h3>
                <p className="text-xs text-emerald-800 mt-1">
                  Save these 10 recovery codes now. They are displayed <strong>only once</strong> and allow you to sign in if you lose access to your phone.
                </p>
              </div>

              <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl">
                <div className="grid grid-cols-2 gap-2 font-mono text-xs font-semibold text-neutral-900 mb-4">
                  {enrolRecoveryCodes.map((c, i) => (
                    <div key={i} className="p-2 bg-white rounded border border-neutral-200 text-center select-all">
                      {c}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(enrolRecoveryCodes.join('\n'));
                      setCopiedEnrolCodes(true);
                      setTimeout(() => setCopiedEnrolCodes(false), 2000);
                    }}
                    className="min-h-[40px] px-3 text-xs font-medium text-neutral-800 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>📋</span>
                    <span>{copiedEnrolCodes ? 'Copied to Clipboard!' : 'Copy All Codes'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadCodes(enrolRecoveryCodes)}
                    className="min-h-[40px] px-3 text-xs font-medium text-neutral-800 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>💾</span>
                    <span>Download (.txt)</span>
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleFinishEnrolment}
                  className="min-h-[44px] px-6 text-sm font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center justify-center"
                >
                  I have saved my recovery codes
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* Active MFA Management Sections (when status.mfaEnabled)              */}
      {/* ==================================================================== */}
      {status.mfaEnabled && (
        <>
          {/* Low Recovery Codes Warning Banner */}
          {status.remainingRecoveryCodes < 3 && (
            <div className="p-4 sm:p-5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-start gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <h3 className="text-sm font-semibold">
                    Low Recovery Codes: {status.remainingRecoveryCodes} Remaining
                  </h3>
                  <p className="text-xs text-amber-800 mt-0.5">
                    You have fewer than 3 single-use recovery codes left. If you lose your phone, you
                    could be locked out. Regenerate a fresh set of codes now.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowRegenModal(true);
                  setNewRecoveryCodes(null);
                }}
                className="shrink-0 min-h-[44px] px-4 text-xs font-semibold text-amber-950 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center justify-center"
              >
                Regenerate Codes
              </button>
            </div>
          )}

          {/* Recovery Codes Card */}
          <div className="bg-white border border-[var(--color-line)] rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Recovery Codes</h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Single-use backup codes for signing in when your authenticator app is unavailable.
                </p>
              </div>
              <div className="text-sm font-medium text-neutral-700 bg-neutral-100 px-3 py-1 rounded-lg self-start sm:self-auto">
                {status.remainingRecoveryCodes} of 10 available
              </div>
            </div>

            {!newRecoveryCodes ? (
              <div className="space-y-4">
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Recovery codes are displayed <strong>exactly once</strong> upon generation. Each code
                  can be used a single time. Generating a new set immediately invalidates all ten
                  previous recovery codes.
                </p>

                {!showRegenModal ? (
                  <button
                    type="button"
                    onClick={() => setShowRegenModal(true)}
                    className="min-h-[44px] px-4 text-sm font-medium text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                  >
                    Regenerate 10 New Recovery Codes
                  </button>
                ) : (
                  <form
                    onSubmit={handleRegenerateCodes}
                    className="p-4 sm:p-5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-4 max-w-md"
                  >
                    <h3 className="text-sm font-semibold text-neutral-900">
                      Confirm Password to Regenerate Codes
                    </h3>
                    <p className="text-xs text-neutral-600">
                      Enter your account password to confirm. All existing recovery codes will become
                      invalid.
                    </p>

                    {regenError && (
                      <div className="p-3 text-xs rounded-lg bg-red-50 text-red-800 border border-red-200">
                        {regenError}
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="regen-password"
                        className="block text-xs font-medium text-neutral-700 mb-1"
                      >
                        Account Password
                      </label>
                      <input
                        id="regen-password"
                        type="password"
                        required
                        value={regenPassword}
                        onChange={(e) => setRegenPassword(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-neutral-200"
                      />
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <button
                        type="submit"
                        disabled={isRegenPending || !regenPassword}
                        className="min-h-[44px] px-4 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center"
                      >
                        {isRegenPending ? 'Generating Codes...' : 'Generate New Codes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowRegenModal(false);
                          setRegenPassword('');
                          setRegenError(null);
                        }}
                        className="min-h-[44px] px-3 text-sm font-medium text-neutral-600 hover:text-neutral-900 cursor-pointer flex items-center justify-center"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <div className="space-y-4 p-4 sm:p-5 bg-neutral-50 border border-neutral-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    Your 10 New Recovery Codes
                  </h3>
                  <span className="text-xs text-emerald-600 font-medium">✓ Generated</span>
                </div>
                <p className="text-xs text-neutral-600">
                  Save these codes now in a safe place. You will not be able to view them again after
                  navigating away.
                </p>

                <div className="grid grid-cols-2 gap-2 font-mono text-xs font-semibold text-neutral-900 py-2">
                  {newRecoveryCodes.map((code, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-white rounded border border-neutral-200 text-center select-all"
                    >
                      {code}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleCopyAll(newRecoveryCodes)}
                    className="min-h-[40px] px-3 text-xs font-medium text-neutral-800 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>📋</span>
                    <span>{copiedCodes ? 'Copied to Clipboard!' : 'Copy All Codes'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadCodes(newRecoveryCodes)}
                    className="min-h-[40px] px-3 text-xs font-medium text-neutral-800 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>💾</span>
                    <span>Download (.txt)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRecoveryCodes(null)}
                    className="min-h-[40px] px-3 text-xs font-medium text-neutral-600 hover:text-neutral-900 cursor-pointer ml-auto flex items-center justify-center"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Authenticator Device Replacement Card */}
          <div className="bg-white border border-[var(--color-line)] rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="border-b border-neutral-100 pb-4">
              <h2 className="text-lg font-semibold text-neutral-900">Replace Authenticator Device</h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Switch to a new phone or authenticator app. Old devices will be immediately invalidated.
              </p>
            </div>

            {!isReplacingDevice ? (
              <div className="space-y-4">
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Lost your old phone or upgrading to a new device? Re-scan a fresh QR code with your new
                  app. Once verified with a 6-digit code, the previous device secret is permanently
                  overwritten, and 10 fresh recovery codes will be issued.
                </p>
                <button
                  type="button"
                  onClick={handleStartDeviceReplacement}
                  className="min-h-[44px] px-4 text-sm font-medium text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                >
                  Set Up New Device
                </button>
              </div>
            ) : replacementCodes ? (
              /* Success view showing fresh recovery codes issued */
              <div className="space-y-4 p-4 sm:p-5 bg-neutral-50 border border-neutral-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    Device Successfully Replaced!
                  </h3>
                  <span className="text-xs text-emerald-600 font-medium">✓ Active</span>
                </div>
                <p className="text-xs text-neutral-600">
                  Your new authenticator app is now active. Here are 10 fresh recovery codes. Previous
                  recovery codes are now invalid.
                </p>

                <div className="grid grid-cols-2 gap-2 font-mono text-xs font-semibold text-neutral-900 py-2">
                  {replacementCodes.map((code, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-white rounded border border-neutral-200 text-center select-all"
                    >
                      {code}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleCopyAll(replacementCodes)}
                    className="min-h-[40px] px-3 text-xs font-medium text-neutral-800 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>📋</span>
                    <span>{copiedCodes ? 'Copied to Clipboard!' : 'Copy All Codes'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadCodes(replacementCodes)}
                    className="min-h-[40px] px-3 text-xs font-medium text-neutral-800 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>💾</span>
                    <span>Download (.txt)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsReplacingDevice(false);
                      setReplacementCodes(null);
                    }}
                    className="min-h-[40px] px-3 text-xs font-medium text-neutral-600 hover:text-neutral-900 cursor-pointer ml-auto flex items-center justify-center"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Two-step device replacement modal */
              <div className="p-4 sm:p-5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-neutral-900">
                      Step 1: Scan QR Code with New Device
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsReplacingDevice(false)}
                      className="text-xs text-neutral-500 hover:text-neutral-800 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  {loadingQr ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-2">
                      <div className="animate-spin h-6 w-6 border-2 border-neutral-900 border-t-transparent rounded-full" />
                      <p className="text-xs text-neutral-500">Generating QR code...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      {qrDataUrl && (
                        <div className="p-2 bg-white border border-neutral-200 rounded-xl shadow-xs">
                          <Image
                            src={qrDataUrl}
                            alt="New Device QR Code"
                            width={180}
                            height={180}
                            className="rounded"
                          />
                        </div>
                      )}
                      <p className="text-xs text-neutral-500 text-center max-w-xs">
                        Scan with <strong>Google Authenticator</strong> on your new device.
                      </p>

                      {secretBase32 && (
                        <div className="w-full p-2.5 bg-white border border-neutral-200 rounded-lg text-center">
                          <span className="block text-[11px] text-neutral-500 mb-1">
                            Manual entry key:
                          </span>
                          <code className="text-xs font-mono font-bold text-neutral-900 select-all break-all block">
                            {secretBase32}
                          </code>
                          <button
                            type="button"
                            onClick={handleCopyKey}
                            className="mt-1.5 text-xs text-neutral-700 hover:underline cursor-pointer"
                          >
                            {copiedKey ? '✓ Copied!' : 'Copy Key'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <form onSubmit={handleConfirmReplacement} className="space-y-4">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    Step 2: Verify Code from New Device
                  </h3>

                  {replacementError && (
                    <div className="p-3 text-xs rounded-lg bg-red-50 text-red-800 border border-red-200">
                      {replacementError}
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="replacement-code"
                      className="block text-xs font-medium text-neutral-700 mb-1"
                    >
                      Enter 6-Digit Code from New App
                    </label>
                    <input
                      id="replacement-code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      placeholder="000000"
                      value={replacementCode}
                      onChange={(e) =>
                        setReplacementCode(e.target.value.replace(/\D/g, ''))
                      }
                      className="w-full px-3 py-2.5 text-center text-xl font-mono tracking-widest rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-200"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={isReplacePending || replacementCode.length !== 6}
                      className="min-h-[44px] px-4 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center"
                    >
                      {isReplacePending ? 'Verifying New Device...' : 'Confirm & Switch Device'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsReplacingDevice(false)}
                      className="min-h-[44px] px-3 text-sm font-medium text-neutral-600 hover:text-neutral-900 cursor-pointer flex items-center justify-center"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

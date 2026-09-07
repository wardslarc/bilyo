'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  regenerateRecoveryCodes,
  initiateDeviceReplacement,
  confirmDeviceReplacement,
} from '@/actions/account';
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

  // Recovery codes regeneration state
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [regenPassword, setRegenPassword] = useState('');
  const [regenError, setRegenError] = useState<string | null>(null);
  const [newRecoveryCodes, setNewRecoveryCodes] = useState<string[] | null>(null);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [isRegenPending, startRegenTransition] = useTransition();

  // Device replacement state
  const [isReplacingDevice, setIsReplacingDevice] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secretBase32, setSecretBase32] = useState<string | null>(null);
  const [replacementCode, setReplacementCode] = useState('');
  const [replacementError, setReplacementError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [replacementCodes, setReplacementCodes] = useState<string[] | null>(null);
  const [isReplacePending, startReplaceTransition] = useTransition();

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
              Mandatory TOTP protection, recovery codes, and authenticator device management.
            </p>
          </div>
          <div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              ● Active & Enforced
            </span>
          </div>
        </div>

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
      </div>

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
          <div className="space-y-4 p-5 bg-emerald-50/50 border border-emerald-200 rounded-xl">
            <div className="text-center">
              <span className="inline-block p-1.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-sm mb-1">
                ✓
              </span>
              <h3 className="text-base font-bold text-neutral-900">
                10 Fresh Recovery Codes Generated
              </h3>
              <p className="text-xs text-neutral-600 mt-1 max-w-md mx-auto">
                Save these codes immediately in a secure place. Previous recovery codes are now
                inactive.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center font-mono text-xs font-semibold text-neutral-900 p-4 bg-white border border-neutral-200 rounded-xl">
              {newRecoveryCodes.map((code, idx) => (
                <div key={idx} className="py-1.5 px-2 rounded bg-neutral-50 select-all">
                  {code}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleDownloadCodes(newRecoveryCodes)}
                className="flex-1 min-h-[44px] py-2 px-3 text-xs font-medium text-neutral-900 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg transition-colors cursor-pointer text-center flex items-center justify-center"
              >
                Download (.txt)
              </button>
              <button
                type="button"
                onClick={() => handleCopyAll(newRecoveryCodes)}
                className="flex-1 min-h-[44px] py-2 px-3 text-xs font-medium text-neutral-900 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg transition-colors cursor-pointer text-center flex items-center justify-center"
              >
                {copiedCodes ? '✓ Copied All Codes!' : 'Copy All Codes'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewRecoveryCodes(null);
                  setShowRegenModal(false);
                }}
                className="w-full min-h-[44px] py-2 text-xs font-medium text-neutral-700 hover:text-neutral-900 cursor-pointer flex items-center justify-center"
              >
                Done / Hide Codes
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Replace Device Card */}
      <div className="bg-white border border-[var(--color-line)] rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="border-b border-neutral-100 pb-4">
          <h2 className="text-lg font-semibold text-neutral-900">Replace Authenticator Device</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Switch your 2FA authentication to a new smartphone or authenticator app.
          </p>
        </div>

        {!isReplacingDevice ? (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600 leading-relaxed">
              When replacing your authenticator device, your existing device remains fully active
              until you verify a 6-digit code generated by the <strong>new</strong> device. This
              prevents accidental lockout.
            </p>

            <button
              type="button"
              onClick={handleStartDeviceReplacement}
              className="min-h-[44px] px-4 text-sm font-medium text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
            >
              Replace My Authenticator Device
            </button>
          </div>
        ) : replacementCodes ? (
          <div className="space-y-4 p-5 bg-emerald-50/50 border border-emerald-200 rounded-xl">
            <div className="text-center">
              <span className="inline-block p-1.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-sm mb-1">
                ✓
              </span>
              <h3 className="text-base font-bold text-neutral-900">
                New Authenticator Device Successfully Linked!
              </h3>
              <p className="text-xs text-neutral-600 mt-1 max-w-md mx-auto">
                Your old device has been disconnected. Here are 10 fresh recovery codes for your new
                setup:
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center font-mono text-xs font-semibold text-neutral-900 p-4 bg-white border border-neutral-200 rounded-xl">
              {replacementCodes.map((code, idx) => (
                <div key={idx} className="py-1.5 px-2 rounded bg-neutral-50 select-all">
                  {code}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleDownloadCodes(replacementCodes)}
                className="flex-1 min-h-[44px] py-2 px-3 text-xs font-medium text-neutral-900 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg transition-colors cursor-pointer text-center flex items-center justify-center"
              >
                Download (.txt)
              </button>
              <button
                type="button"
                onClick={() => handleCopyAll(replacementCodes)}
                className="flex-1 min-h-[44px] py-2 px-3 text-xs font-medium text-neutral-900 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg transition-colors cursor-pointer text-center flex items-center justify-center"
              >
                {copiedCodes ? '✓ Copied All Codes!' : 'Copy All Codes'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsReplacingDevice(false);
                  setReplacementCodes(null);
                }}
                className="w-full min-h-[44px] py-2 text-xs font-medium text-neutral-700 hover:text-neutral-900 cursor-pointer flex items-center justify-center"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 max-w-md">
            <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-900">
                  Step 1: Scan with New Device
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
    </div>
  );
}

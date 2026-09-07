'use client';

import { useState, useEffect, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { initiateMfaEnrolment, confirmMfaEnrolment } from '@/actions/mfa';

export default function MfaEnrolmentFlow() {
  const router = useRouter();

  // Phase 1 states
  const [loadingQr, setLoadingQr] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secretBase32, setSecretBase32] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Phase 2 states
  const [isCompleted, setIsCompleted] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [hasSavedCodes, setHasSavedCodes] = useState(false);
  const [copiedAllCodes, setCopiedAllCodes] = useState(false);

  const [isPending, startTransition] = useTransition();

  // Load QR code on mount
  useEffect(() => {
    let isMounted = true;

    async function loadSetup() {
      setLoadingQr(true);
      setError(null);
      const res = await initiateMfaEnrolment();
      if (!isMounted) return;

      if (!res.ok) {
        setError(res.error);
        setLoadingQr(false);
        return;
      }

      setQrDataUrl(res.data.qrDataUrl);
      setSecretBase32(res.data.secretBase32);
      setLoadingQr(false);
    }

    loadSetup();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopyKey = () => {
    if (!secretBase32) return;
    navigator.clipboard.writeText(secretBase32);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyAllCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCopiedAllCodes(true);
    setTimeout(() => setCopiedAllCodes(false), 2000);
  };

  const handleDownloadCodes = () => {
    const text = [
      'Bilyo Account Recovery Codes',
      'Generated: ' + new Date().toISOString(),
      '',
      'Each recovery code can be used once to access your account if you lose your authenticator device.',
      'Keep these codes strictly confidential.',
      '',
      ...recoveryCodes,
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

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!code || !/^\d{6}$/.test(code.trim())) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    startTransition(async () => {
      const res = await confirmMfaEnrolment(code.trim());
      if (!res.ok) {
        setError(res.error);
        return;
      }

      setRecoveryCodes(res.data.recoveryCodes);
      setIsCompleted(true);
    });
  };

  const handleFinish = () => {
    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="bg-white border border-[var(--color-line)] rounded-xl shadow-sm p-6 sm:p-8 max-w-lg mx-auto">
      {!isCompleted ? (
        <>
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)]">
              Set Up Two-Factor Authentication
            </h1>
            <p className="text-sm text-[var(--color-muted)] mt-2 max-w-sm mx-auto leading-relaxed">
              To protect your business invoicing and customer data, two-factor authentication is required for all accounts.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 text-sm rounded-lg bg-red-50 border border-red-200 text-red-700">
              {error}
            </div>
          )}

          {loadingQr ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="animate-spin h-8 w-8 border-2 border-[var(--color-brass)] border-t-transparent rounded-full" />
              <p className="text-xs text-[var(--color-muted)]">Generating secure QR code...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col items-center">
                {qrDataUrl && (
                  <div className="p-3 bg-white border border-[var(--color-line)] rounded-xl shadow-sm">
                    <Image
                      src={qrDataUrl}
                      alt="MFA QR Code"
                      width={192}
                      height={192}
                      className="rounded"
                    />
                  </div>
                )}
                <p className="text-xs text-[var(--color-muted)] mt-2.5 text-center max-w-xs leading-normal">
                  Scan this QR code using <strong>Google Authenticator</strong> (or another RFC 6238 app like 1Password or Authy).
                </p>
              </div>

              {secretBase32 && (
                <div className="p-3.5 bg-[var(--color-paper-edge)] border border-[var(--color-line)] rounded-lg text-center">
                  <span className="block text-xs font-medium text-[var(--color-muted)] mb-1.5">
                    Can&apos;t scan? Enter this key manually into Google Authenticator:
                  </span>
                  <code className="text-xs font-mono font-bold text-[var(--color-ink)] tracking-wider select-all break-all px-2 py-1 bg-white border border-[var(--color-line)] rounded block">
                    {secretBase32}
                  </code>
                  <div className="mt-2.5">
                    <button
                      type="button"
                      onClick={handleCopyKey}
                      className="inline-flex items-center gap-1.5 min-h-[44px] px-4 text-xs text-[var(--color-ink)] bg-white border border-[var(--color-line)] rounded-lg hover:bg-neutral-50 active:bg-neutral-100 transition-colors cursor-pointer font-medium shadow-xs"
                    >
                      {copiedKey ? '✓ Copied to clipboard!' : 'Copy Secret Key'}
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleVerify} noValidate className="space-y-4">
                <div>
                  <label
                    htmlFor="enrolCode"
                    className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5"
                  >
                    Enter 6-Digit Code from App
                  </label>
                  <input
                    id="enrolCode"
                    name="enrolCode"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoComplete="one-time-code"
                    required
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.replace(/\D/g, ''));
                      if (error) setError(null);
                    }}
                    placeholder="000000"
                    className="w-full px-4 py-3 rounded-lg border border-[var(--color-line)] text-center text-2xl font-mono tracking-widest text-[var(--color-ink)] bg-[var(--color-paper-edge)] focus:bg-white focus:border-[var(--color-brass)] focus:ring-1 focus:ring-[var(--color-brass)] focus:outline-none transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending || code.length !== 6}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-lg bg-[var(--color-ink)] hover:bg-[var(--color-ink-raised)] text-white text-sm font-medium transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isPending ? 'Verifying...' : 'Enable Two-Factor Authentication'}
                </button>
              </form>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-green-50 border border-green-200 text-green-700 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
              ✓
            </div>
            <h2 className="text-xl font-bold tracking-tight text-[var(--color-ink)]">
              Two-Factor Authentication Enabled
            </h2>
            <p className="text-sm text-[var(--color-muted)] mt-1">
              Save your recovery codes now. They are displayed{' '}
              <strong className="text-[var(--color-ink)]">exactly once</strong> and will not be shown
              again.
            </p>
          </div>

          <div className="p-4 bg-[var(--color-paper-edge)] border border-[var(--color-line)] rounded-xl">
            <div className="grid grid-cols-2 gap-2 text-center font-mono text-xs font-semibold text-[var(--color-ink)]">
              {recoveryCodes.map((c, i) => (
                <div
                  key={i}
                  className="py-1.5 px-2 rounded bg-white border border-[var(--color-line)]/50 select-all"
                >
                  {c}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDownloadCodes}
              className="flex-1 min-h-[44px] py-2 px-3 rounded-lg border border-[var(--color-line)] text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-edge)] transition-colors cursor-pointer text-center flex items-center justify-center"
            >
              Download (.txt)
            </button>
            <button
              type="button"
              onClick={handleCopyAllCodes}
              className="flex-1 min-h-[44px] py-2 px-3 rounded-lg border border-[var(--color-line)] text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-edge)] transition-colors cursor-pointer text-center flex items-center justify-center"
            >
              {copiedAllCodes ? 'Copied!' : 'Copy all codes'}
            </button>
          </div>

          <div className="pt-2">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasSavedCodes}
                onChange={(e) => setHasSavedCodes(e.target.checked)}
                className="mt-0.5 rounded border-[var(--color-line)] text-[var(--color-brass)] focus:ring-[var(--color-brass)] cursor-pointer"
              />
              <span className="text-xs text-[var(--color-ink)] font-medium leading-relaxed">
                I have safely saved these 10 recovery codes and understand I cannot view them again.
              </span>
            </label>
          </div>

          <button
            type="button"
            disabled={!hasSavedCodes}
            onClick={handleFinish}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-lg bg-[var(--color-ink)] hover:bg-[var(--color-ink-raised)] text-white text-sm font-medium transition-colors shadow-sm disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center"
          >
            Continue to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}

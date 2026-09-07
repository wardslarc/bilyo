'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { verifyMfaChallenge } from '@/actions/mfa';

export default function MfaChallengeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  const [useRecovery, setUseRecovery] = useState(false);
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!useRecovery && (!code.trim() || !/^\d{6}$/.test(code.trim()))) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    if (useRecovery && !recoveryCode.trim()) {
      setError('Please enter your recovery code');
      return;
    }

    startTransition(async () => {
      const payload = useRecovery
        ? { recoveryCode: recoveryCode.trim() }
        : { code: code.trim() };

      const res = await verifyMfaChallenge(payload);

      if (!res.ok) {
        setError(res.error);
        if ('challengeDestroyed' in res && res.challengeDestroyed) {
          setTimeout(() => {
            router.push('/login');
          }, 2500);
        }
        return;
      }

      // Establish the real session with mfaVerifiedAt using the single-use token (§8.10)
      const signInRes = await signIn('credentials', {
        mfaSessionToken: res.data.mfaSessionToken,
        redirect: false,
        callbackUrl,
      });

      if (!signInRes || signInRes.error) {
        setError('Failed to establish session. Please try signing in again.');
        return;
      }

      const destUrl =
        signInRes?.url && !signInRes.url.startsWith('http://localhost')
          ? signInRes.url
          : callbackUrl;
      router.push(destUrl);
      router.refresh();
    });
  };

  return (
    <div className="bg-white border border-[var(--color-line)] rounded-xl shadow-sm p-6 sm:p-8">
      <div className="mb-6 text-center">
        <div className="w-12 h-12 rounded-full bg-[var(--color-brass-wash)] border border-[var(--color-brass)]/30 flex items-center justify-center mx-auto mb-3 text-[var(--color-brass-ink)] font-semibold text-lg">
          MFA
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)]">
          {useRecovery ? 'Use a Recovery Code' : 'Two-Factor Verification'}
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          {useRecovery
            ? 'Enter one of your 12-character emergency recovery codes'
            : 'Enter the 6-digit code from your authenticator app'}
        </p>
      </div>

      {error && (
        <div className="mb-5 p-3.5 text-sm rounded-lg bg-red-50 border border-red-200 text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {!useRecovery ? (
          <div>
            <label
              htmlFor="mfaCode"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5"
            >
              6-Digit Authenticator Code
            </label>
            <input
              id="mfaCode"
              name="mfaCode"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="one-time-code"
              autoFocus
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
        ) : (
          <div>
            <label
              htmlFor="recoveryCode"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5"
            >
              Recovery Code
            </label>
            <input
              id="recoveryCode"
              name="recoveryCode"
              type="text"
              autoFocus
              required
              value={recoveryCode}
              onChange={(e) => {
                setRecoveryCode(e.target.value);
                if (error) setError(null);
              }}
              placeholder="xxxx-xxxx-xxxx"
              className="w-full px-4 py-3 rounded-lg border border-[var(--color-line)] text-center text-lg font-mono tracking-wider text-[var(--color-ink)] bg-[var(--color-paper-edge)] focus:bg-white focus:border-[var(--color-brass)] focus:ring-1 focus:ring-[var(--color-brass)] focus:outline-none transition-colors"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full mt-2 py-2.5 px-4 rounded-lg bg-[var(--color-ink)] hover:bg-[var(--color-ink-raised)] text-white text-sm font-medium transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <svg
                className="animate-spin h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Verifying...</span>
            </>
          ) : (
            'Verify and continue'
          )}
        </button>
      </form>

      <div className="mt-6 pt-4 border-t border-[var(--color-line-softer)] flex flex-col items-center gap-2 text-xs text-[var(--color-muted)]">
        <button
          type="button"
          onClick={() => {
            setUseRecovery(!useRecovery);
            setError(null);
          }}
          className="font-medium text-[var(--color-ink)] hover:text-[var(--color-brass)] transition-colors underline cursor-pointer"
        >
          {useRecovery
            ? 'Use authenticator app code instead'
            : 'Lost your device? Use a recovery code'}
        </button>
        <Link
          href="/login"
          className="hover:text-[var(--color-ink)] transition-colors"
        >
          Cancel and return to sign in
        </Link>
      </div>
    </div>
  );
}

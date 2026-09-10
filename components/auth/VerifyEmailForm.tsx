'use client';

import { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { verifySignupCode, resendVerification } from '@/actions/auth';

export default function VerifyEmailForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [isResending, startResendTransition] = useTransition();

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusMessage(null);

    const trimmed = code.trim();
    if (!trimmed || !/^\d{6}$/.test(trimmed)) {
      setError('Please enter a valid 6-digit verification code');
      return;
    }

    startTransition(async () => {
      const res = await verifySignupCode(trimmed);

      if (!res.ok) {
        setError(res.error);
        return;
      }

      if (res.data.alreadyVerified) {
        setStatusMessage('Email already verified! Redirecting...');
        setTimeout(() => {
          router.push('/login?verified=1');
        }, 1200);
        return;
      }

      // If signupSessionToken is present (Path C), establish session in-tab
      if (res.data.signupSessionToken) {
        try {
          const signInRes = await signIn('credentials', {
            signupSessionToken: res.data.signupSessionToken,
            redirect: false,
          });

          if (signInRes && !signInRes.error) {
            router.replace('/dashboard/settings?onboarding=1');
            router.refresh();
            return;
          }
        } catch {
          // Fall through to login redirect if session minting isn't configured yet
        }
      }

      setStatusMessage('Email verified successfully! Redirecting to sign in...');
      setTimeout(() => {
        router.push('/login?verified=1');
      }, 1500);
    });
  };

  const handleResend = () => {
    if (cooldown > 0 || isResending) return;
    setError(null);
    setStatusMessage(null);

    startResendTransition(async () => {
      const res = await resendVerification();
      if (!res.ok) {
        setError(res.error);
        return;
      }

      setStatusMessage('A fresh verification code has been sent to your email.');
      setCooldown(60); // 60s cooldown per §4.7
    });
  };

  return (
    <div className="bg-white border border-[var(--color-line)] rounded-xl shadow-sm p-6 sm:p-8">
      <div className="mb-6 text-center">
        <div className="w-12 h-12 rounded-full bg-[var(--color-brass-wash)] border border-[var(--color-brass)]/30 flex items-center justify-center mx-auto mb-3 text-[var(--color-brass-ink)] font-semibold text-lg">
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.75"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)]">
          Check your email
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-1.5 leading-relaxed">
          We sent a 6-digit code and a verification link to your email address.
        </p>
      </div>

      {statusMessage && (
        <div className="mb-5 p-3.5 text-sm rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
          {statusMessage}
        </div>
      )}

      {error && (
        <div className="mb-5 p-3.5 text-sm rounded-lg bg-red-50 border border-red-200 text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="verificationCode"
            className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5 text-center"
          >
            6-Digit Verification Code
          </label>
          <input
            id="verificationCode"
            name="verificationCode"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="one-time-code"
            autoFocus
            required
            value={code}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 6);
              setCode(val);
              if (error) setError(null);
            }}
            placeholder="· · · · · ·"
            className="w-full text-center text-2xl tracking-[0.4em] font-mono py-3 px-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-edge)] focus:bg-white focus:border-[var(--color-brass)] focus:ring-1 focus:ring-[var(--color-brass)] focus:outline-none transition-colors"
          />
          <p className="mt-1.5 text-xs text-center text-[var(--color-faint)]">
            Codes expire in 15 minutes
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending || code.length !== 6}
          className="w-full mt-2 py-2.5 px-4 rounded-lg bg-[var(--color-ink)] hover:bg-[var(--color-ink-raised)] text-white text-sm font-medium transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
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
            'Verify code'
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-[var(--color-line)] text-center text-xs text-[var(--color-muted)] space-y-2">
        <div>
          Didn&apos;t receive the email?{' '}
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || isResending}
            className="font-medium text-[var(--color-ink)] hover:text-[var(--color-brass)] underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed transition-colors"
          >
            {isResending
              ? 'Sending...'
              : cooldown > 0
                ? `Resend code in ${cooldown}s`
                : 'Resend code'}
          </button>
        </div>

        <div>
          Wrong email address?{' '}
          <Link
            href="/register"
            className="font-medium text-[var(--color-ink)] hover:text-[var(--color-brass)] underline transition-colors"
          >
            Register again
          </Link>
        </div>
      </div>
    </div>
  );
}

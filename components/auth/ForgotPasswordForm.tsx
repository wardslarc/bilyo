'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { forgotPasswordSchema } from '@/lib/validation/auth';
import { requestPasswordReset } from '@/actions/auth';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const validation = forgotPasswordSchema.safeParse({ email });
    if (!validation.success) {
      const errors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const key = issue.path[0];
        if (key && !errors[String(key)]) {
          errors[String(key)] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    startTransition(async () => {
      const res = await requestPasswordReset({ email });
      if (!res.ok) {
        setServerError(res.error);
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        return;
      }

      setSuccessMessage(res.data.message);
    });
  };

  return (
    <div className="bg-white border border-[var(--color-line)] rounded-xl shadow-sm p-6 sm:p-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)]">
          Reset password
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Enter your email and we&apos;ll send you a recovery link
        </p>
      </div>

      {successMessage ? (
        <div className="space-y-5">
          <div className="p-4 text-sm rounded-lg bg-[var(--color-brass-wash)] border border-[var(--color-brass)]/30 text-[var(--color-brass-ink)] leading-relaxed">
            {successMessage}
          </div>
          <div className="text-center pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center py-2.5 px-4 rounded-lg bg-[var(--color-ink)] hover:bg-[var(--color-ink-raised)] text-white text-sm font-medium transition-colors shadow-sm"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      ) : (
        <>
          {serverError && (
            <div className="mb-5 p-3.5 text-sm rounded-lg bg-red-50 border border-red-200 text-red-700">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5"
              >
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.email;
                      return next;
                    });
                  }
                }}
                placeholder="you@example.com"
                className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-[var(--color-ink)] bg-[var(--color-paper-edge)] focus:bg-white focus:outline-none transition-colors ${
                  fieldErrors.email
                    ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                    : 'border-[var(--color-line)] focus:border-[var(--color-brass)] focus:ring-1 focus:ring-[var(--color-brass)]'
                }`}
              />
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-600 font-medium">
                  {fieldErrors.email}
                </p>
              )}
            </div>

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
                  <span>Sending reset link...</span>
                </>
              ) : (
                'Send reset link'
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-[var(--color-muted)]">
            Remember your password?{' '}
            <Link
              href="/login"
              className="font-medium text-[var(--color-ink)] hover:text-[var(--color-brass)] underline transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

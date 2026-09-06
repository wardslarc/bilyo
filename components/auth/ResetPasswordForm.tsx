'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { resetPasswordSchema } from '@/lib/validation/auth';
import { resetPassword } from '@/actions/auth';

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!token) {
      setServerError('Missing or invalid reset token. Please request a new password reset link.');
      return;
    }

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    const validation = resetPasswordSchema.safeParse({ token, password });
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
      const res = await resetPassword({ token, password });
      if (!res.ok) {
        setServerError(res.error);
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        return;
      }

      setIsSuccess(true);
    });
  };

  return (
    <div className="bg-white border border-[var(--color-line)] rounded-xl shadow-sm p-6 sm:p-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)]">
          Create new password
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Choose a new, strong password for your account
        </p>
      </div>

      {!token && (
        <div className="space-y-4">
          <div className="p-3.5 text-sm rounded-lg bg-red-50 border border-red-200 text-red-700">
            This reset link is missing a valid token. Please request a new one.
          </div>
          <div className="text-center pt-2">
            <Link
              href="/forgot-password"
              className="inline-flex items-center justify-center py-2.5 px-4 rounded-lg bg-[var(--color-ink)] hover:bg-[var(--color-ink-raised)] text-white text-sm font-medium transition-colors shadow-sm"
            >
              Request new link
            </Link>
          </div>
        </div>
      )}

      {token && isSuccess && (
        <div className="space-y-5 text-center">
          <div className="p-4 text-sm rounded-lg bg-[var(--color-brass-wash)] border border-[var(--color-brass)]/30 text-[var(--color-brass-ink)] leading-relaxed">
            Your password has been reset successfully! You can now sign in with your new password.
          </div>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center py-2.5 px-4 rounded-lg bg-[var(--color-ink)] hover:bg-[var(--color-ink-raised)] text-white text-sm font-medium transition-colors shadow-sm"
            >
              Sign in to your account
            </Link>
          </div>
        </div>
      )}

      {token && !isSuccess && (
        <>
          {serverError && (
            <div className="mb-5 p-3.5 text-sm rounded-lg bg-red-50 border border-red-200 text-red-700">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5"
              >
                New Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.password;
                      return next;
                    });
                  }
                }}
                placeholder="At least 8 characters"
                className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-[var(--color-ink)] bg-[var(--color-paper-edge)] focus:bg-white focus:outline-none transition-colors ${
                  fieldErrors.password
                    ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                    : 'border-[var(--color-line)] focus:border-[var(--color-brass)] focus:ring-1 focus:ring-[var(--color-brass)]'
                }`}
              />
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-600 font-medium">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5"
              >
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (fieldErrors.confirmPassword) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.confirmPassword;
                      return next;
                    });
                  }
                }}
                placeholder="Repeat your password"
                className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-[var(--color-ink)] bg-[var(--color-paper-edge)] focus:bg-white focus:outline-none transition-colors ${
                  fieldErrors.confirmPassword
                    ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                    : 'border-[var(--color-line)] focus:border-[var(--color-brass)] focus:ring-1 focus:ring-[var(--color-brass)]'
                }`}
              />
              {fieldErrors.confirmPassword && (
                <p className="mt-1 text-xs text-red-600 font-medium">
                  {fieldErrors.confirmPassword}
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
                  <span>Resetting password...</span>
                </>
              ) : (
                'Save new password'
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-[var(--color-muted)]">
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

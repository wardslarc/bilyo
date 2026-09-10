'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { registerUser } from '@/actions/auth';
import { registerSchema } from '@/lib/validation/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Client-side validation using the same Zod schema
    const validation = registerSchema.safeParse(formData);
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
      const result = await registerUser(formData);

      if (!result.ok) {
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        setFormError(result.error);
        return;
      }

      // Registration successful -> route to email verification (SIGNUP_VERIFICATION_PLAN.md §4.3, §8 Task 8)
      router.push('/verify-email');
    });
  };

  return (
    <div className="bg-white border border-[var(--color-line)] rounded-xl shadow-sm p-6 sm:p-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)]">
          Create your account
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Start sending quotations and closing sales in minutes
        </p>
      </div>

      {formError && !Object.keys(fieldErrors).length && (
        <div className="mb-5 p-3.5 text-sm rounded-lg bg-red-50 border border-red-200 text-red-700">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="name"
            className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5"
          >
            Full Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g. Maria Santos"
            className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-[var(--color-ink)] bg-[var(--color-paper-edge)] focus:bg-white focus:outline-none transition-colors ${
              fieldErrors.name
                ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                : 'border-[var(--color-line)] focus:border-[var(--color-brass)] focus:ring-1 focus:ring-[var(--color-brass)]'
            }`}
          />
          {fieldErrors.name && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {fieldErrors.name}
            </p>
          )}
        </div>

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
            value={formData.email}
            onChange={handleChange}
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

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={formData.password}
            onChange={handleChange}
            placeholder="At least 8 characters"
            className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-[var(--color-ink)] bg-[var(--color-paper-edge)] focus:bg-white focus:outline-none transition-colors ${
              fieldErrors.password
                ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                : 'border-[var(--color-line)] focus:border-[var(--color-brass)] focus:ring-1 focus:ring-[var(--color-brass)]'
            }`}
          />
          {fieldErrors.password ? (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {fieldErrors.password}
            </p>
          ) : (
            <p className="mt-1 text-xs text-[var(--color-faint)]">
              Must be at least 8 characters
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
              <span>Creating account...</span>
            </>
          ) : (
            'Create account'
          )}
        </button>
      </form>

      {/* Consent at signup — this is what makes the Terms binding (Terms §1). */}
      <p className="mt-5 text-center text-xs leading-relaxed text-[var(--color-muted)]">
        By creating an account you agree to our{' '}
        <Link
          href="/terms"
          className="font-medium text-[var(--color-ink)] underline transition-colors hover:text-[var(--color-brass)]"
        >
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link
          href="/privacy"
          className="font-medium text-[var(--color-ink)] underline transition-colors hover:text-[var(--color-brass)]"
        >
          Privacy Policy
        </Link>
        .
      </p>

      <div className="mt-5 border-t border-[var(--color-line)] pt-5 text-center text-xs text-[var(--color-muted)]">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-[var(--color-ink)] hover:text-[var(--color-brass)] underline transition-colors"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

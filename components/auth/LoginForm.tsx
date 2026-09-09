'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { loginSchema } from '@/lib/validation/auth';
import { verifyPasswordStep } from '@/actions/mfa';

/**
 * Reduces any destination to a same-origin relative path, or null.
 * Auth.js returns an absolute URL built from AUTH_URL/host and `callbackUrl`
 * arrives from the query string: following either blindly can send the user to
 * another origin (where the session cookie does not exist, so the app renders a
 * blank signed-out page) or off-site entirely.
 */
function toSafePath(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const isRegistered = searchParams.get('registered') === '1';

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [authError, setAuthError] = useState<string | null>(null);
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
    setAuthError(null);

    // Validate using shared Zod schema
    const validation = loginSchema.safeParse(formData);
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
      const stepRes = await verifyPasswordStep({
        email: formData.email.toLowerCase().trim(),
        password: formData.password,
      });

      if (!stepRes.ok) {
        setAuthError(stepRes.error);
        return;
      }

      // If user has MFA enabled, challenge cookie was set -> redirect to code challenge step (§8.10)
      if (stepRes.data.requiresMfa) {
        const mfaDest = toSafePath(callbackUrl) ?? '/dashboard';
        router.push(`/login/mfa?callbackUrl=${encodeURIComponent(mfaDest)}`);
        return;
      }

      // Otherwise, establish credentials session directly
      const res = await signIn('credentials', {
        email: formData.email.toLowerCase().trim(),
        password: formData.password,
        redirect: false,
        callbackUrl,
      });

      if (!res || res.error) {
        if (res?.code === 'account_suspended' || res?.error?.includes('account_suspended')) {
          setAuthError('Your account has been suspended. Please contact support at support@bilyoapp.com');
        } else {
          setAuthError('Invalid email or password');
        }
        return;
      }

      // Successful login -> stay on this origin. res.url is built from AUTH_URL and
      // may point at a different deployment; the callbackUrl query param is
      // user-controlled. Both are reduced to a local path, with /dashboard as the
      // final fallback.
      const destUrl = toSafePath(res?.url) ?? toSafePath(callbackUrl) ?? '/dashboard';
      router.push(destUrl);
      router.refresh();
    });
  };

  return (
    <div className="bg-white border border-[var(--color-line)] rounded-xl shadow-sm p-6 sm:p-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)]">
          Welcome back
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Sign in to your Bilyo account
        </p>
      </div>

      {isRegistered && (
        <div className="mb-5 p-3.5 text-sm rounded-lg bg-[var(--color-brass-wash)] border border-[var(--color-brass)]/30 text-[var(--color-brass-ink)]">
          Account created successfully. Please sign in with your credentials.
        </div>
      )}

      {authError && (
        <div className="mb-5 p-3.5 text-sm rounded-lg bg-red-50 border border-red-200 text-red-700">
          {authError}
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
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-[var(--color-muted)] hover:text-[var(--color-brass)] transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={formData.password}
            onChange={handleChange}
            placeholder="Your password"
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
              <span>Signing in...</span>
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-xs text-[var(--color-muted)]">
        Don&apos;t have an account yet?{' '}
        <Link
          href="/register"
          className="font-medium text-[var(--color-ink)] hover:text-[var(--color-brass)] underline transition-colors"
        >
          Create one now
        </Link>
      </div>
    </div>
  );
}

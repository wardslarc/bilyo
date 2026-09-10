import { Suspense } from 'react';
import Link from 'next/link';
import LoginForm from '@/components/auth/LoginForm';

function LoginFormFallback() {
  return (
    <div className="bg-white border border-[var(--color-line)] rounded-xl shadow-sm p-6 sm:p-8 animate-pulse">
      <div className="h-8 bg-[var(--color-line-softer)] rounded w-48 mx-auto mb-3" />
      <div className="h-4 bg-[var(--color-line-softer)] rounded w-64 mx-auto mb-8" />
      <div className="space-y-4">
        <div className="h-10 bg-[var(--color-line-softer)] rounded" />
        <div className="h-10 bg-[var(--color-line-softer)] rounded" />
        <div className="h-10 bg-[var(--color-line-softer)] rounded mt-4" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="space-y-3">
      <div className="flex items-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors group"
        >
          <svg
            className="w-3.5 h-3.5 text-[var(--color-muted)] group-hover:text-[var(--color-ink)] transition-transform group-hover:-translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <span>Back to landing page</span>
        </Link>
      </div>

      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

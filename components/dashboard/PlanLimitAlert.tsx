'use client';

import Link from 'next/link';

interface PlanLimitAlertProps {
  error: string | null;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Upgrade prompt & plan limit alert component (M8-T02).
 * When an action is blocked by a plan limit:
 * - Explains which limit was hit
 * - Shows current usage
 * - Links to /pricing
 */
export function PlanLimitAlert({ error, onDismiss, className = '' }: PlanLimitAlertProps) {
  if (!error) return null;

  const isLimitError =
    error.toLowerCase().includes('limit') ||
    error.toLowerCase().includes('upgrade') ||
    error.toLowerCase().includes('plan');

  if (!isLimitError) {
    return (
      <div
        role="alert"
        className={`p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center justify-between ${className}`}
      >
        <span>{error}</span>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-red-500 hover:text-red-700 font-bold ml-2 text-base leading-none"
            title="Dismiss error"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={`p-4 bg-amber-50 border border-amber-200 text-amber-950 rounded-xl shadow-xs ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5 text-amber-700 border border-amber-200">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded">
                Plan Limit Reached
              </span>
            </div>
            <p className="text-xs text-amber-900 mt-1.5 leading-relaxed font-medium">
              {error}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg shadow-xs bg-amber-600 hover:bg-amber-700 text-white transition-colors"
          >
            <span>Upgrade Plan</span>
            <span aria-hidden="true">&rarr;</span>
          </Link>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-amber-600 hover:text-amber-900 p-1.5 rounded-md hover:bg-amber-100 transition-colors"
              title="Dismiss prompt"
            >
              <span className="sr-only">Dismiss</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

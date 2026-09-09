'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SupportLookupFormProps {
  initialQuery?: string;
}

const BARE_PREFIXES = ['QUO', 'QUO-', 'Q', 'Q-'];

export function SupportLookupForm({ initialQuery = '' }: SupportLookupFormProps) {
  const [query, setQuery] = useState(initialQuery);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();

    if (trimmed.length < 4) {
      setError('Lookup query must be at least 4 characters long.');
      return;
    }

    if (BARE_PREFIXES.includes(trimmed.toUpperCase())) {
      setError('Bare prefixes like "QUO-" or "Q-" are not allowed. Enter a full quotation number (e.g. Q-2026-0001 or QUO-000042) or a public code.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    router.push(`/admin/lookup?q=${encodeURIComponent(trimmed)}`);
  };

  const handleClear = () => {
    setQuery('');
    setError(null);
    router.push('/admin/lookup');
  };

  return (
    <div className="w-full space-y-3">
      <form onSubmit={handleSubmit} className="relative flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            id="lookup-query-input"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Quotation number (e.g. Q-2026-0001, QUO-000042) or public code..."
            className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-mono"
            disabled={isSubmitting}
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              title="Clear search"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <button
          id="lookup-submit-btn"
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap gap-2"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Resolving...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Resolve Document</span>
            </>
          )}
        </button>
      </form>

      {/* Inline validation alert */}
      {error && (
        <div className="flex items-center gap-2 p-3 text-xs bg-rose-50 border border-rose-200 text-rose-800 rounded-lg animate-fadeIn">
          <svg className="w-4 h-4 shrink-0 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Search Guidance Badges */}
      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500">
        <span className="font-medium text-slate-600">Accepted formats:</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[11px] text-slate-700">
          INV-000042
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[11px] text-slate-700">
          QUO-000010
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[11px] text-slate-700">
          12-char public token
        </span>
        <span className="text-slate-400 text-[11px]">
          (≥ 4 chars · single match auto-redirects)
        </span>
      </div>
    </div>
  );
}

import React from 'react';

export default function AuthLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-[var(--color-line)] rounded-2xl p-8 sm:p-10 shadow-xs space-y-6 animate-pulse">
        <div className="space-y-2 text-center">
          <div className="h-6 w-36 bg-[var(--color-line)] rounded mx-auto" />
          <div className="h-3 w-48 bg-[var(--color-line-soft)] rounded mx-auto" />
        </div>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <div className="h-3 w-16 bg-[var(--color-line-soft)] rounded" />
            <div className="h-10 w-full bg-[var(--color-line-softer)] rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-16 bg-[var(--color-line-soft)] rounded" />
            <div className="h-10 w-full bg-[var(--color-line-softer)] rounded-lg" />
          </div>
          <div className="h-10 w-full bg-[var(--color-line)] rounded-lg pt-2" />
        </div>
      </div>
    </div>
  );
}

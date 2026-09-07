import React from 'react';

export default function RootLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-paper)]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--color-line)] border-t-[var(--color-brass)] animate-spin" />
        <span className="text-xs font-medium text-[var(--color-muted)]">Loading…</span>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import {
  getEventTitle,
  getActorLabel,
  formatTimelineUrl,
  sortEventsChronological,
  type TimelineEvent,
} from '@/lib/timeline';

export type { TimelineEvent };

export interface QuotationTimelineProps {
  events: TimelineEvent[];
  publicCode?: string | null;
  currency?: string;
}

export function QuotationTimeline({ events, publicCode, currency = 'PHP' }: QuotationTimelineProps) {
  const [copied, setCopied] = useState(false);
  const sortedEvents = sortEventsChronological(events);

  const handleCopy = async () => {
    if (!publicCode) return;
    try {
      const fullUrl = formatTimelineUrl(publicCode);
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy public quotation URL:', err);
    }
  };

  return (
    <div className="bg-white border border-[var(--color-line)] rounded-xl p-5 shadow-xs space-y-4">
      {/* Header with Copy Link Button Beside It (§12, P3-T05) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--color-line)]">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-[var(--color-brass-wash)] text-[var(--color-brass)]">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </span>
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              Activity Timeline
            </h2>
            <p className="text-xs text-[var(--color-muted)]">
              Full lifecycle tracking for this quotation
            </p>
          </div>
        </div>

        {/* Copy-link button beside the timeline */}
        {publicCode ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              id="copy-public-link-button"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all shadow-xs ${
                copied
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-1 ring-emerald-300'
                  : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50 hover:border-neutral-400'
              }`}
            >
              {copied ? (
                <>
                  <svg
                    className="w-3.5 h-3.5 text-emerald-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-3.5 h-3.5 text-neutral-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  <span>Copy Public Link</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <span className="text-xs text-[var(--color-muted)] italic">
            Public link generated upon sending
          </span>
        )}
      </div>

      {/* Timeline List (Oldest First) */}
      {sortedEvents.length === 0 ? (
        <div className="py-4 text-center text-xs text-[var(--color-muted)]">
          No activity events recorded yet.
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:bottom-2 before:top-2 before:left-[11px] before:w-[2px] before:bg-neutral-200">
          {sortedEvents.map((event) => {
            const isAccepted = event.type === 'ACCEPTED';
            const isDeclined = event.type === 'DECLINED';
            const isViewed = event.type === 'VIEWED';
            const isSent = event.type === 'SENT';
            const isPaid = event.type === 'MARKED_PAID';

            let dotColor = 'bg-neutral-400';
            if (isAccepted) dotColor = 'bg-emerald-500';
            else if (isDeclined) dotColor = 'bg-rose-500';
            else if (isViewed) dotColor = 'bg-sky-500';
            else if (isSent) dotColor = 'bg-amber-500';
            else if (isPaid) dotColor = 'bg-green-600';

            const actorLabel = getActorLabel(event.actor, event.metadata);
            const title = getEventTitle(event.type);

            return (
              <div key={event.id} className="relative group text-xs">
                {/* Step indicator dot */}
                <div
                  className={`absolute -left-6 top-1 w-2.5 h-2.5 rounded-full ring-4 ring-white ${dotColor}`}
                />

                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-neutral-900">
                      {title}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-neutral-100 text-neutral-600">
                      {actorLabel}
                    </span>
                  </div>

                  {/* Manila timestamp (§5.7, §12 P3-T05) */}
                  <time className="text-neutral-500 text-[11px] font-mono">
                    {formatDateTime(event.createdAt)}
                  </time>
                </div>

                {/* Optional metadata context */}
                {Boolean(isDeclined && event.metadata?.reason) && (
                  <div className="mt-1.5 p-2 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs italic">
                    Reason: &ldquo;{String(event.metadata?.reason)}&rdquo;
                  </div>
                )}

                {Boolean(isAccepted && event.metadata?.respondedByName) && (
                  <div className="mt-1 text-emerald-800 text-[11px]">
                    Confirmed by: <span className="font-medium">{String(event.metadata?.respondedByName)}</span>
                  </div>
                )}

                {Boolean(isPaid && event.metadata?.amountCentavos) && (
                  <div className="mt-1 text-neutral-700 text-[11px]">
                    Recorded payment: <span className="font-mono font-medium">{formatMoney(Number(event.metadata?.amountCentavos), currency)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

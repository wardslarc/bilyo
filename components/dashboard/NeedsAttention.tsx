'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDateTime } from '@/lib/dates';
import { markEventsSeen } from '@/actions/account';
import type { NeedsAttentionData, NeedsAttentionItem } from '@/lib/metrics';

interface NeedsAttentionProps {
  data: NeedsAttentionData;
}

export function NeedsAttention({ data }: NeedsAttentionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<NeedsAttentionItem[]>(data.items);
  const [unseenCount, setUnseenCount] = useState<number>(data.unseenCount);
  const [isOpen, setIsOpen] = useState<boolean>(data.unseenCount > 0);

  if (!items || items.length === 0) {
    return null;
  }

  const handleMarkAsSeen = () => {
    if (unseenCount === 0) return;

    startTransition(async () => {
      const res = await markEventsSeen();
      if (res.ok) {
        setUnseenCount(0);
        setItems((prev) => prev.map((item) => ({ ...item, isUnread: false })));
        router.refresh();
      }
    });
  };

  const handleToggleOpen = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    // Opening the list clears the badge per acceptance criteria (§12, P3-T04)
    if (nextOpen && unseenCount > 0) {
      handleMarkAsSeen();
    }
  };

  return (
    <section
      aria-label="Needs your attention"
      className={`rounded-xl border transition-all ${
        unseenCount > 0
          ? 'bg-amber-50/50 border-amber-200/80 shadow-xs'
          : 'bg-white border-[var(--color-line)]'
      }`}
    >
      {/* Header bar */}
      <div className="px-4 py-3 sm:px-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              unseenCount > 0
                ? 'bg-amber-100 text-amber-700'
                : 'bg-neutral-100 text-neutral-600'
            }`}
          >
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
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </div>

          <div className="truncate">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">
                Needs your attention
              </h2>
              {unseenCount > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500 text-white animate-pulse">
                  {unseenCount} new
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--color-muted)] truncate">
              {unseenCount > 0
                ? `${unseenCount} recent client ${
                    unseenCount === 1 ? 'activity requires' : 'activities require'
                  } your review`
                : 'Recent client actions on your quotations'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {unseenCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAsSeen}
              disabled={isPending}
              className="hidden sm:inline-flex text-xs font-medium text-amber-800 hover:text-amber-950 px-2.5 py-1 rounded hover:bg-amber-100/70 transition-colors"
            >
              {isPending ? 'Updating…' : 'Mark read'}
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleOpen}
            aria-expanded={isOpen}
            className="inline-flex items-center gap-1 text-xs font-medium text-neutral-700 hover:text-neutral-900 px-2.5 py-1.5 rounded-md hover:bg-neutral-100 transition-colors"
          >
            <span>{isOpen ? 'Hide' : 'Open list'}</span>
            <svg
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded list */}
      {isOpen && (
        <div className="border-t border-[var(--color-line)] divide-y divide-[var(--color-line)] bg-white/70 rounded-b-xl overflow-hidden">
          {items.map((item) => {
            const isAccepted = item.type === 'ACCEPTED';
            const isDeclined = item.type === 'DECLINED';
            const isViewed = item.type === 'VIEWED';

            const declineReason =
              isDeclined && item.metadata?.reason
                ? String(item.metadata.reason)
                : null;

            return (
              <div
                key={item.id}
                className={`p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors ${
                  item.isUnread ? 'bg-amber-50/30' : 'hover:bg-neutral-50/50'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  {/* Status badge */}
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${
                      isAccepted
                        ? 'bg-emerald-100 text-emerald-800'
                        : isDeclined
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-sky-100 text-sky-800'
                    }`}
                  >
                    {isAccepted && (
                      <svg
                        className="w-3 h-3"
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
                    )}
                    {isDeclined && (
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    )}
                    {isViewed && (
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                    <span>{item.type}</span>
                  </span>

                  {/* Message content */}
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-[var(--color-text)] leading-relaxed">
                      <span className="font-semibold text-neutral-900">
                        {item.clientName}
                      </span>{' '}
                      {isAccepted && 'accepted'}
                      {isDeclined && 'declined'}
                      {isViewed && 'viewed'}{' '}
                      <span className="font-mono font-medium text-neutral-800">
                        {item.quotationNumber}
                      </span>
                    </div>

                    {declineReason && (
                      <p className="text-rose-700 italic">
                        &ldquo;{declineReason}&rdquo;
                      </p>
                    )}

                    <div className="text-neutral-400 text-[11px]">
                      {formatDateTime(item.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                  {item.isUnread && (
                    <span className="w-2 h-2 rounded-full bg-amber-500" title="Unread" />
                  )}

                  <Link
                    href={`/dashboard/quotations/${item.quotationId}`}
                    className="inline-flex items-center gap-1 font-medium text-[var(--color-brass)] hover:text-amber-800 transition-colors"
                  >
                    View quotation →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

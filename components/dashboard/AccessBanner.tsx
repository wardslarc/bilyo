'use client';

import React, { useSyncExternalStore } from 'react';
import Link from 'next/link';
import type { AccessStatus } from '@/types';
import { formatDate } from '@/lib/dates';

export interface AccessBannerProps {
  status: AccessStatus;
  accessUntil: string | null;
  daysLeft: number;
  betaEndsAt?: string | null;
}

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getSnapshot() {
  return sessionStorage.getItem('bilyo_access_banner_dismissed') === '1';
}

function getServerSnapshot() {
  return false;
}

export function AccessBanner({
  status,
  accessUntil,
  daysLeft,
  betaEndsAt,
}: AccessBannerProps) {
  const isDismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const handleDismiss = () => {
    sessionStorage.setItem('bilyo_access_banner_dismissed', '1');
    window.dispatchEvent(new Event('storage'));
  };

  if (isDismissed) {
    return null;
  }

  const formattedAccessUntil = accessUntil ? formatDate(accessUntil) : null;
  const formattedBetaEnds = betaEndsAt ? formatDate(betaEndsAt) : null;

  // Banner appearance based on status
  let bgClass = 'bg-indigo-50 border-indigo-200 text-indigo-900';
  let badgeClass = 'bg-indigo-100 text-indigo-700';
  let badgeText = 'Beta';
  let message = (
    <>
      Bilyo is free during beta{formattedBetaEnds ? ` until ${formattedBetaEnds}` : ''}. Beta accounts get 50% off their first pass.
    </>
  );
  let ctaHref = '/pricing';
  let ctaText = 'View plans →';

  if (status === 'TRIAL') {
    bgClass = 'bg-amber-50 border-amber-200 text-amber-900';
    badgeClass = 'bg-amber-100 text-amber-800';
    badgeText = 'Trial';
    message = (
      <>
        {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left in your trial. Quotations are unlimited.
      </>
    );
    ctaHref = '/pricing';
    ctaText = 'View passes →';
  } else if (status === 'ACTIVE') {
    bgClass = 'bg-emerald-50 border-emerald-200 text-emerald-900';
    badgeClass = 'bg-emerald-100 text-emerald-800';
    badgeText = 'Active';
    message = (
      <>
        Access until {formattedAccessUntil}.
      </>
    );
    ctaHref = '/pricing';
    ctaText = 'Manage access →';
  } else if (status === 'EXPIRED_TRIAL') {
    bgClass = 'bg-rose-50 border-rose-200 text-rose-900';
    badgeClass = 'bg-rose-100 text-rose-800';
    badgeText = 'Trial Expired';
    message = (
      <>
        Your 14-day trial has ended. Creating and sending quotations is paused.
      </>
    );
    ctaHref = '/pricing';
    ctaText = 'Choose a pass →';
  } else if (status === 'EXPIRED_PAID') {
    bgClass = 'bg-rose-50 border-rose-200 text-rose-900';
    badgeClass = 'bg-rose-100 text-rose-800';
    badgeText = 'Access Expired';
    message = (
      <>
        Your quotation access expired on {formattedAccessUntil}.
      </>
    );
    ctaHref = '/pricing';
    ctaText = 'Renew pass →';
  }

  return (
    <div
      role="region"
      aria-label="Access status banner"
      className={`w-full border-b px-4 py-2.5 sm:px-6 transition-all ${bgClass}`}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center flex-wrap gap-2">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${badgeClass}`}
          >
            {badgeText}
          </span>
          <span className="font-medium leading-relaxed">{message}</span>
          <Link
            href={ctaHref}
            className="font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity ml-1"
          >
            {ctaText}
          </Link>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 rounded hover:bg-black/5 text-current opacity-70 hover:opacity-100 transition-opacity cursor-pointer shrink-0"
          aria-label="Dismiss banner for this session"
          title="Dismiss banner"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default AccessBanner;

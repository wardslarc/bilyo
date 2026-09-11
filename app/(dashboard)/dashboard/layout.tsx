import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser, assertNotSuspended, AuthGuardError } from '@/lib/auth-guards';
import { getUnseenAttentionCount } from '@/lib/metrics';
import { accessState } from '@/lib/access';
import SignOutButton from '@/components/auth/SignOutButton';
import { AccessBanner } from '@/components/dashboard/AccessBanner';
import { TrialWallOverlay } from '@/components/dashboard/TrialWallOverlay';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { getUserUsageSnapshot } from '@/actions/notify-interest';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  let userDoc;
  try {
    user = await requireUser();
    userDoc = await assertNotSuspended(user.id);
  } catch (error) {
    if (error instanceof AuthGuardError) {
      if (error.code === 'ACCOUNT_SUSPENDED') {
        redirect('/login?error=suspended');
      }
      redirect('/login');
    }
    throw error;
  }

  // Decorative badge only: never let it take the whole dashboard shell down.
  let unseenCount = 0;
  try {
    unseenCount = await getUnseenAttentionCount(user.id);
  } catch (error) {
    console.error('Dashboard nav: unseen event count failed:', (error as Error).message);
  }

  const isAdmin = user.role === 'ADMIN';
  const access = accessState(userDoc);
  const betaEndsAt = process.env.BETA_ENDS_AT || null;

  let usageSnapshot = { quotationsSent: 0, quotationsAccepted: 0, acceptedValueCentavos: 0 };
  if (access.status === 'EXPIRED_TRIAL') {
    try {
      usageSnapshot = await getUserUsageSnapshot(user.id);
    } catch (err) {
      console.error('Usage snapshot query failed:', (err as Error).message);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col">
      {/* Top navigation bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-[var(--color-line)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2" title="Bilyo Home">
              <span className="font-bold text-xl tracking-tight text-neutral-900">
                Bilyo<span className="text-[var(--color-primary)]">app.com</span>
              </span>
            </Link>

            <DashboardNav unseenCount={unseenCount} isAdmin={isAdmin} />
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {unseenCount > 0 && (
              <Link
                href="/dashboard"
                title={`${unseenCount} unread client update${unseenCount === 1 ? '' : 's'}`}
                className="relative p-1.5 rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
              >
                <svg
                  className="w-5 h-5"
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
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
              </Link>
            )}

            <Link
              href="/dashboard/account"
              className="hidden sm:block text-right hover:opacity-80 transition-opacity"
            >
              <p className="text-xs font-medium text-neutral-900 leading-tight">
                {user.name || user.email}
              </p>
              <p className="text-[11px] text-neutral-500 leading-tight">{user.email}</p>
            </Link>
            <div className="h-6 w-px bg-neutral-200 hidden sm:block" />
            <SignOutButton className="text-xs font-medium text-neutral-500 hover:text-neutral-900 px-2.5 py-1.5 rounded-md hover:bg-neutral-100 transition-colors" />
          </div>
        </div>
      </header>

      <AccessBanner
        status={access.status}
        accessUntil={access.accessUntil ? access.accessUntil.toISOString() : null}
        daysLeft={access.daysLeft}
        betaEndsAt={betaEndsAt}
      />

      {access.status === 'EXPIRED_TRIAL' && (
        <TrialWallOverlay
          status={access.status}
          quotationsSent={usageSnapshot.quotationsSent}
          quotationsAccepted={usageSnapshot.quotationsAccepted}
          acceptedValueCentavos={usageSnapshot.acceptedValueCentavos}
        />
      )}

      {/* Main content body */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}

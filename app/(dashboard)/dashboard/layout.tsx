import React from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireUser, assertNotSuspended, AuthGuardError } from '@/lib/auth-guards';
import { checkOnboardingGate } from '@/lib/onboarding-gate';
import SignOutButton from '@/components/auth/SignOutButton';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  try {
    user = await requireUser();
    await assertNotSuspended(user.id);
  } catch (error) {
    if (error instanceof AuthGuardError) {
      if (error.code === 'ACCOUNT_SUSPENDED') {
        redirect('/login?error=suspended');
      }
      redirect('/login');
    }
    throw error;
  }

  // Mandatory MFA gate (§5.11, M6-T06)
  if (!user.mfaEnabled) {
    redirect('/onboarding/mfa');
  }

  // Onboarding gate (DEVELOPMENT_PLAN.md M2-T02):
  // Signed-in user with no Business is redirected to /dashboard/settings?onboarding=1
  // If already on /dashboard/settings, do not redirect to prevent infinite loop.
  const headerList = await headers();
  const currentPath =
    headerList.get('x-pathname') ||
    headerList.get('next-url') ||
    headerList.get('x-invoke-path') ||
    headerList.get('x-matched-path') ||
    '';

  const gate = await checkOnboardingGate(user.id, currentPath);
  if (gate.shouldRedirect && gate.targetUrl) {
    redirect(gate.targetUrl);
  }

  const navItems = [
    { label: 'Quotations', href: '/dashboard/quotations' },
    { label: 'Customers', href: '/dashboard/customers' },
    { label: 'Settings', href: '/dashboard/settings' },
    { label: 'Account', href: '/dashboard/account' },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col">
      {/* Top navigation bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-[var(--color-line)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="font-bold text-xl tracking-tight text-neutral-900">
                Bilyo<span className="text-[var(--color-primary)]">.ph</span>
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
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

        {/* Mobile secondary navigation */}
        <div className="md:hidden border-t border-[var(--color-line)] px-4 py-2 flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-2.5 py-1 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md whitespace-nowrap transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </header>

      {/* Main content body */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}

import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser, assertNotSuspended, AuthGuardError } from '@/lib/auth-guards';
import { getUnseenAttentionCount } from '@/lib/metrics';
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

  const unseenCount = await getUnseenAttentionCount(user.id);

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', badge: unseenCount },
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
                  className="px-3 py-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors inline-flex items-center"
                >
                  <span>{item.label}</span>
                  {item.badge && item.badge > 0 ? (
                    <span className="ml-1.5 px-1.5 py-0.5 text-[11px] font-bold rounded-full bg-amber-500 text-white min-w-4 text-center leading-none">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              ))}
            </nav>
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

        {/* Mobile secondary navigation */}
        <div className="md:hidden border-t border-[var(--color-line)] px-4 py-2 flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-2.5 py-1 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md whitespace-nowrap transition-colors inline-flex items-center"
            >
              <span>{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-amber-500 text-white min-w-4 text-center leading-none">
                  {item.badge}
                </span>
              ) : null}
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

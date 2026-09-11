'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface DashboardNavProps {
  unseenCount: number;
  isAdmin?: boolean;
}

export function DashboardNav({ unseenCount, isAdmin }: DashboardNavProps) {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Home',
      href: '/dashboard',
      badge: unseenCount,
      isHome: true,
    },
    { label: 'Quotations', href: '/dashboard/quotations' },
    { label: 'Clients', href: '/dashboard/clients' },
    { label: 'Access', href: '/dashboard/access' },
    { label: 'Settings', href: '/dashboard/settings' },
    { label: 'Account', href: '/dashboard/account' },
  ];

  const isItemActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center gap-1">
        {navItems.map((item) => {
          const active = isItemActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors inline-flex items-center ${
                active
                  ? 'bg-neutral-100 text-neutral-950 font-semibold'
                  : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-50'
              }`}
            >
              {item.isHome && (
                <svg
                  className={`w-4 h-4 mr-1.5 ${
                    active ? 'text-[var(--color-primary)]' : 'text-neutral-500'
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
              )}
              <span>{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span className="ml-1.5 px-1.5 py-0.5 text-[11px] font-bold rounded-full bg-amber-500 text-white min-w-4 text-center leading-none">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}

        {isAdmin && (
          <Link
            href="/admin"
            className="ml-2 px-2.5 py-1 text-xs font-semibold rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors inline-flex items-center gap-1"
            title="Open Admin Console"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            Admin
          </Link>
        )}
      </nav>

      {/* Mobile Navigation bar */}
      <div className="md:hidden border-t border-[var(--color-line)] px-4 py-2 flex items-center justify-between gap-1 bg-white">
        <div className="flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const active = isItemActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors inline-flex items-center ${
                  active
                    ? 'bg-neutral-100 text-neutral-950 font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
              >
                {item.isHome && (
                  <svg
                    className={`w-3.5 h-3.5 mr-1 ${
                      active ? 'text-[var(--color-primary)]' : 'text-neutral-500'
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  </svg>
                )}
                <span>{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-amber-500 text-white min-w-4 text-center leading-none">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>

        {isAdmin && (
          <Link
            href="/admin"
            className="px-2 py-1 text-xs font-semibold rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 whitespace-nowrap shrink-0 inline-flex items-center gap-1"
            title="Open Admin Console"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            Admin
          </Link>
        )}
      </div>
    </>
  );
}

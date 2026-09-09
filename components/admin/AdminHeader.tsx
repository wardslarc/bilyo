'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SignOutButton from '@/components/auth/SignOutButton';

interface AdminHeaderProps {
  adminEmail: string;
}

export function AdminHeader({ adminEmail }: AdminHeaderProps) {
  const pathname = usePathname();

  const navItems = [
    { label: 'Users', href: '/admin/users' },
    { label: 'Lookup', href: '/admin/lookup' },
    { label: 'Audit Log', href: '/admin/audit' },
  ];

  const isActive = (href: string) => {
    if (href === '/admin/users' && (pathname === '/admin' || pathname === '/admin/users')) {
      return true;
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950 border-b border-slate-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Left branding and nav */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5">
            <Link href="/admin/users" className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight text-white">
                Bilyo<span className="text-indigo-400">app.com</span>
              </span>
            </Link>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              ADMIN CONSOLE
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    active
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right user & exit controls */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <svg
                className="w-3.5 h-3.5 text-indigo-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              {adminEmail}
            </span>
            <span className="text-[10px] text-slate-400">Staff MFA Verified</span>
          </div>

          <div className="h-6 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="text-xs font-medium text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Exit to App →
            </Link>
            <SignOutButton className="text-xs font-medium text-slate-400 hover:text-white px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors" />
          </div>
        </div>
      </div>

      {/* Mobile navigation */}
      <div className="md:hidden border-t border-slate-800 px-4 py-2 flex items-center gap-2 overflow-x-auto bg-slate-900">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                active
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}

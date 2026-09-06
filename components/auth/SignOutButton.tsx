'use client';

import { useTransition } from 'react';
import { signOut } from 'next-auth/react';

interface SignOutButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export default function SignOutButton({
  className = 'text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors cursor-pointer',
  children = 'Sign out',
}: SignOutButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      await signOut({ callbackUrl: '/login' });
    });
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isPending}
      className={className}
    >
      {isPending ? 'Signing out...' : children}
    </button>
  );
}

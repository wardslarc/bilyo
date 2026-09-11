import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import LoginForm from '@/components/auth/LoginForm';
import BackToBilyo from '@/components/auth/BackToBilyo';

function LoginFormFallback() {
  return (
    <div className="bg-white border border-[var(--color-line)] rounded-xl shadow-sm p-6 sm:p-8 animate-pulse">
      <div className="h-8 bg-[var(--color-line-softer)] rounded w-48 mx-auto mb-3" />
      <div className="h-4 bg-[var(--color-line-softer)] rounded w-64 mx-auto mb-8" />
      <div className="space-y-4">
        <div className="h-10 bg-[var(--color-line-softer)] rounded" />
        <div className="h-10 bg-[var(--color-line-softer)] rounded" />
        <div className="h-10 bg-[var(--color-line-softer)] rounded mt-4" />
      </div>
    </div>
  );
}

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-3">
      <BackToBilyo />

      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

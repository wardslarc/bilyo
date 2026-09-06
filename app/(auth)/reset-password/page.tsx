import { Metadata } from 'next';
import { Suspense } from 'react';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Set New Password | Bilyo',
  description: 'Create a new password for your Bilyo account',
};

function ResetPasswordFallback() {
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

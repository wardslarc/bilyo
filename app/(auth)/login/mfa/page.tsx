import { Metadata } from 'next';
import { Suspense } from 'react';
import MfaChallengeForm from '@/components/auth/MfaChallengeForm';

export const metadata: Metadata = {
  title: 'Two-Factor Authentication | Bilyo',
  description: 'Enter your verification code to complete sign-in',
};

function MfaFallback() {
  return (
    <div className="bg-white border border-[var(--color-line)] rounded-xl shadow-sm p-6 sm:p-8 animate-pulse">
      <div className="w-12 h-12 rounded-full bg-[var(--color-line-softer)] mx-auto mb-3" />
      <div className="h-8 bg-[var(--color-line-softer)] rounded w-48 mx-auto mb-3" />
      <div className="h-4 bg-[var(--color-line-softer)] rounded w-64 mx-auto mb-8" />
      <div className="h-12 bg-[var(--color-line-softer)] rounded mb-4" />
      <div className="h-10 bg-[var(--color-line-softer)] rounded" />
    </div>
  );
}

export default function MfaChallengePage() {
  return (
    <Suspense fallback={<MfaFallback />}>
      <MfaChallengeForm />
    </Suspense>
  );
}

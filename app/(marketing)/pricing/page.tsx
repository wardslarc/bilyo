import Link from 'next/link';
import { HeaderBand } from '@/components/marketing/header-band';
import { PricingSection } from '@/components/marketing/pricing-section';

import { auth } from '@/lib/auth';

export const metadata = {
  title: 'Quotation Access Plan · Bilyo',
  description: 'Simple, transparent quotation access for Philippine service businesses. Free during beta.',
};

export default async function PricingPage() {
  const session = await auth();
  const isLoggedIn = Boolean(session?.user?.id);

  return (
    <>
      <HeaderBand isLoggedIn={isLoggedIn} />

      <main className="flex-1 py-12 lg:py-16">
        <div className="mx-auto w-full max-w-360 px-5 lg:px-30">
          <div className="mb-6">
            <Link
              href={isLoggedIn ? '/dashboard' : '/'}
              className="text-muted hover:text-text inline-flex items-center text-xs transition-colors"
            >
              &larr; {isLoggedIn ? 'Back to Dashboard' : 'Back to Home'}
            </Link>
          </div>
          <PricingSection userEmail={session?.user?.email} isLoggedIn={isLoggedIn} />
        </div>
      </main>
    </>
  );
}

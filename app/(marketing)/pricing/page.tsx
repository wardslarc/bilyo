import Link from 'next/link';
import { HeaderBand } from '@/components/marketing/header-band';
import { PricingSection } from '@/components/marketing/pricing-section';

export const metadata = {
  title: 'Quotation Access Plan · Bilyo',
  description: 'Simple, transparent quotation access for Philippine service businesses. Free during beta.',
};

export default function PricingPage() {
  return (
    <>
      <HeaderBand />

      <main className="flex-1 py-12 lg:py-16">
        <div className="mx-auto w-full max-w-360 px-5 lg:px-30">
          <div className="mb-6">
            <Link
              href="/"
              className="text-muted hover:text-text inline-flex items-center text-xs transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
          <PricingSection />
        </div>
      </main>
    </>
  );
}

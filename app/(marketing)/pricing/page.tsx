import Link from 'next/link';
import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';
import { PricingSection } from '@/components/marketing/pricing-section';

export const metadata = {
  title: 'Pricing · Bilyo',
  description: 'Simple, transparent pricing for Philippine freelancers and businesses. Free forever tier available.',
};

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      <div className="bg-ink">
        <div className="mx-auto w-full max-w-360 px-5 lg:px-30">
          <SiteHeader />
        </div>
      </div>

      <main className="flex-1 py-12 lg:py-16">
        <div className="mx-auto w-full max-w-360 px-5 lg:px-30">
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
          <PricingSection />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

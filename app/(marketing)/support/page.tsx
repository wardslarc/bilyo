import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { HeaderBand } from '@/components/marketing/header-band';
import { getDonationState } from '@/lib/donation';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Support Bilyo · Bilyo',
  description:
    'Bilyo is free while it is in beta. If it has been useful, you can show support with a voluntary contribution — it buys nothing and unlocks nothing.',
};

export default async function SupportPage() {
  const [session, donation] = await Promise.all([auth(), getDonationState()]);

  // The ask is off, or no QR has been uploaded: there is nothing here to show,
  // and a page explaining that we are not taking contributions is worse than
  // no page at all (AGENTS.md §4.9).
  if (!donation.enabled || !donation.qrUrl) {
    notFound();
  }

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

          <div className="mx-auto max-w-2xl">
            <h1 className="font-display text-text text-3xl font-bold tracking-tight lg:text-4xl">
              Support Bilyo
            </h1>

            <div className="text-muted mt-6 space-y-4 text-[15px] leading-relaxed lg:text-base">
              <p>
                Bilyo is free, and it stays free while it&rsquo;s in beta.
                There&rsquo;s no paid plan running yet, and nothing on this page
                unlocks anything.
              </p>
              <p>
                Bilyo runs on free infrastructure today, so there&rsquo;s no
                hosting bill to cover. Anything you send goes to me, the
                developer, and helps me keep spending evenings on this.
              </p>
              <p>
                If it&rsquo;s been useful and you&rsquo;d like to show support,
                scan the QR below and send whatever you like. The QR has no
                amount attached &mdash; the number isn&rsquo;t the point, the
                gesture is.
              </p>
            </div>

            <figure className="border-line bg-paper-edge mt-8 flex flex-col items-center gap-4 rounded-xl border p-6 lg:p-8">
              {/* Plain <img>: this project configures no next/image remote
                  patterns, and the CSP already allows the Blob host. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={donation.qrUrl}
                alt="GCash QR code for sending a voluntary contribution to Bilyo"
                className="h-64 w-64 max-w-full rounded-lg bg-white object-contain p-3 sm:h-72 sm:w-72"
              />
              <figcaption className="text-muted text-center text-xs">
                Scan with GCash. Enter any amount you like.
              </figcaption>
            </figure>

            <div className="border-line mt-8 border-t pt-6">
              <h2 className="text-text text-sm font-semibold">
                To be plain about it
              </h2>
              <p className="text-muted mt-3 text-sm leading-relaxed">
                This is a gift, not a payment. Nothing in your account changes
                whether you send anything or not, no feature depends on it, and
                there&rsquo;s no supporter tier, badge or perk behind it. We
                don&rsquo;t see who sends what &mdash; the transfer happens
                entirely inside GCash, and nothing about it reaches Bilyo.
              </p>
              <p className="text-muted mt-3 text-sm leading-relaxed">
                Contributions are non-refundable, and we may stop accepting them
                at any time. See{' '}
                <Link
                  href="/terms#donations"
                  className="text-brass-ink underline decoration-1 underline-offset-2"
                >
                  section 10 of the Terms
                </Link>{' '}
                for the full wording.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

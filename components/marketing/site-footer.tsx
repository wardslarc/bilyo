import Link from "next/link";
import { BilyoMark } from "@/components/marketing/bilyo-mark";
import { SUPPORT_EMAIL } from "@/lib/site";
import { getDonationState } from "@/lib/donation";

const FOOTER_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "/login", label: "Log in" },
  { href: "/register", label: "Create an account" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

/**
 * The donation row renders only while the ask is live (AGENTS.md §4.9), so a
 * footer link never points at a /support page that would 404. Reading the
 * state here makes every marketing page dynamic; `getDonationState` swallows
 * its own errors so a database hiccup can never take the footer down with it.
 */
export async function SiteFooter() {
  const donation = await getDonationState();

  return (
    <footer className="bg-ink-deep text-paper/55">
      <div className="mx-auto w-full max-w-360 px-5 py-8 lg:px-30 lg:py-11">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
          <Link href="/" className="text-brass flex items-center gap-2.5">
            <BilyoMark className="size-5.5 lg:size-6" />
            <span className="font-display text-paper text-[17px] font-bold tracking-tight lg:text-lg">
              Bilyo
            </span>
          </Link>

          <nav className="grid grid-cols-2 gap-3.5 text-[15px] lg:flex lg:items-center lg:gap-7.5">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-brass transition-colors"
              >
                {link.label}
              </Link>
            ))}
            {donation.enabled && (
              <Link
                href="/support"
                className="hover:text-brass transition-colors"
              >
                Support
              </Link>
            )}
          </nav>
        </div>

        {donation.enabled && (
          <p className="border-paper/10 mt-6 border-t pt-5 text-sm lg:mt-7 lg:pt-6">
            Bilyo is free. If it&rsquo;s been useful, you can{" "}
            <Link
              href="/support"
              className="text-paper hover:text-brass underline decoration-1 underline-offset-2 transition-colors"
            >
              help keep it running
            </Link>
            .
          </p>
        )}

        <div className="border-paper/10 mt-6 flex flex-col gap-2 border-t pt-5 text-sm lg:mt-7 lg:flex-row lg:items-center lg:justify-between lg:pt-6">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="hover:text-brass transition-colors"
          >
            {SUPPORT_EMAIL}
          </a>
          <span>
            © {new Date().getFullYear()} Bilyo · Built in the Philippines
          </span>
        </div>
      </div>
    </footer>
  );
}

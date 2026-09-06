import Link from "next/link";
import { BilyoMark } from "@/components/marketing/bilyo-mark";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
];

/**
 * Sits inside the dark hero band, so it is styled for an ink ground.
 * The small-screen menu is a native <details> disclosure — no client JS.
 */
export function SiteHeader() {
  return (
    <header className="flex h-17 items-center justify-between lg:h-21">
      <Link href="/" className="text-brass flex items-center gap-2">
        <BilyoMark className="size-6.5 lg:size-7.5" />
        <span className="font-display text-paper text-xl font-bold tracking-tight lg:text-[22px]">
          Bilyo
        </span>
      </Link>

      {/* Desktop nav */}
      <nav className="hidden items-center gap-8.5 lg:flex">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-paper/70 hover:text-paper text-base transition-colors"
          >
            {link.label}
          </Link>
        ))}
        <Link
          href="/login"
          className="text-paper/70 hover:text-paper text-base transition-colors"
        >
          Log in
        </Link>
        <Link
          href="/register"
          className="bg-brass font-display text-ink flex h-11.5 items-center justify-center rounded-md px-5.5 text-base font-semibold transition-opacity hover:opacity-90"
        >
          Start free
        </Link>
      </nav>

      {/* Small-screen nav */}
      <div className="flex items-center gap-3.5 lg:hidden">
        <Link
          href="/login"
          className="text-paper/70 flex h-11 items-center text-base"
        >
          Log in
        </Link>
        <details className="relative">
          <summary className="border-paper/20 text-paper flex size-11 cursor-pointer list-none items-center justify-center rounded-md border [&::-webkit-details-marker]:hidden">
            <span className="sr-only">Open menu</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              className="size-5"
              aria-hidden="true"
            >
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </svg>
          </summary>
          <div className="border-paper/12 bg-ink-raised shadow-document absolute right-0 z-10 mt-2 flex w-56 flex-col gap-1 rounded-lg border p-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-paper/80 flex h-11 items-center rounded-md px-3 text-base"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/register"
              className="bg-brass font-display text-ink flex h-11 items-center justify-center rounded-md px-3 text-base font-semibold"
            >
              Start free
            </Link>
          </div>
        </details>
      </div>
    </header>
  );
}

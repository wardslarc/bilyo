import Link from 'next/link';

/**
 * The single way out of any auth screen, back to the marketing site.
 *
 * Sits above the card, never inside it — one exit per screen. The arrow slides
 * left on hover to reinforce the direction. Used by /login and /register; the
 * 2FA screen deliberately does not use it, because mid-sign-in the correct exit
 * is "Cancel and return to sign in", and two competing ways out is the problem
 * this component was made to fix.
 */
export default function BackToBilyo() {
  return (
    <Link
      href="/"
      className="group inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
    >
      <svg
        className="h-3.5 w-3.5 text-[var(--color-muted)] transition-transform group-hover:-translate-x-0.5 group-hover:text-[var(--color-ink)]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
        />
      </svg>
      <span>Back to Bilyo</span>
    </Link>
  );
}

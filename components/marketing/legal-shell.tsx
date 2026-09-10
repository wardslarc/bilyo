import Link from "next/link";
import { HeaderBand } from "@/components/marketing/header-band";

/**
 * Primitives for long-form legal documents (Terms, Privacy Policy).
 *
 * These are documents, not marketing pages: the job is sustained reading and
 * Ctrl+F, so the type is set to a ~68ch measure, clauses are numbered because
 * the numbering is genuinely referenced ("see section 9"), and every section
 * gets a stable id so a clause can be linked to directly.
 *
 * All colour comes from the @theme tokens in app/globals.css. No hex here.
 */

/* ------------------------------------------------------------------ hero */

export interface LegalHeroProps {
  title: string;
  standfirst: string;
  effective: string;
  version: string;
  jurisdiction: string;
}

export function LegalHero({
  title,
  standfirst,
  effective,
  version,
  jurisdiction,
}: LegalHeroProps) {
  return (
    <HeaderBand>
      <div className="pt-8 pb-12 lg:pt-12 lg:pb-18">
        <div className="flex items-center gap-2.5 pb-4 lg:gap-3">
          <span className="bg-brass h-0.5 w-6 lg:w-8" />
          <span className="font-display text-brass text-[13px] font-semibold tracking-[0.12em] uppercase lg:text-sm lg:tracking-[0.14em]">
            Legal
          </span>
        </div>

        <h1 className="font-display max-w-[20ch] text-[34px] leading-[1.06] font-bold tracking-tight text-balance lg:text-[54px] lg:leading-[1.04]">
          {title}
        </h1>

        <p className="text-paper/72 mt-4.5 max-w-[62ch] text-[17px] leading-relaxed lg:mt-5">
          {standfirst}
        </p>

        <div className="text-paper/45 font-mono mt-6 flex flex-wrap gap-x-6 gap-y-1 text-[13px] lg:mt-7">
          <span>Effective {effective}</span>
          <span>Version {version}</span>
          <span>{jurisdiction}</span>
        </div>
      </div>
    </HeaderBand>
  );
}

/* -------------------------------------------------------------- page body */

/**
 * Two-column reading layout: a sticky contents rail on desktop, the document
 * itself capped at a comfortable measure. Collapses to one column below lg.
 */
export function LegalBody({
  contents,
  children,
}: {
  contents: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid w-full max-w-360 items-start gap-11 px-5 pb-18 lg:grid-cols-[224px_minmax(0,1fr)] lg:gap-16 lg:px-30 lg:pb-26">
      <aside className="pt-10 lg:sticky lg:top-7 lg:pt-12">{contents}</aside>
      <article className="max-w-[68ch] pt-2 lg:pt-12">{children}</article>
    </div>
  );
}

export function Contents({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string }[];
}) {
  return (
    <nav aria-label={`${label} contents`}>
      <h2 className="font-display text-faint mb-3.5 text-xs font-semibold tracking-[0.13em] uppercase">
        On this page
      </h2>
      <ol className="border-line flex list-none flex-col gap-1.75 border-l pl-4">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="text-muted hover:text-brass-ink block text-[14.5px] leading-snug transition-colors"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* ---------------------------------------------------------------- clauses */

/** Opening paragraph of a document — set in muted grey, above clause 01. */
export function Lede({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted mb-2 text-[17px] leading-relaxed">{children}</p>
  );
}

/**
 * A numbered clause. `n` is the printed number and `id` the anchor, kept
 * separate so anchors stay stable if a clause is ever renumbered.
 */
export function Clause({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="font-display mt-10 mb-3 flex items-baseline gap-3 text-xl leading-tight font-semibold tracking-tight text-balance lg:text-[22px]">
        <span className="font-mono text-brass-ink shrink-0 pt-0.5 text-[13px] font-medium tabular-nums">
          {n}
        </span>
        {title}
      </h2>
      <div className="flex flex-col gap-3.5 sm:pl-8.5">{children}</div>
    </section>
  );
}

/** A callout for something the reader must not miss. Used sparingly. */
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-line bg-paper-sunk flex items-start gap-4 rounded-xl border p-5 lg:p-5.5">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-muted mt-0.5 size-5 shrink-0"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5.5" />
        <path d="M12 7.6v.4" />
      </svg>
      <div className="text-muted flex flex-col gap-2 text-[15px] leading-relaxed">
        {children}
      </div>
    </div>
  );
}

/** Bulleted list, spaced for reading rather than for scanning. */
export function List({ children }: { children: React.ReactNode }) {
  return (
    <ul className="flex list-disc flex-col gap-1.75 pl-5">{children}</ul>
  );
}

/**
 * Data table with its own horizontal scroll container, so a wide table never
 * makes the page body scroll sideways on a phone.
 */
export function LegalTable({
  caption,
  head,
  children,
}: {
  caption: string;
  head: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-120 border-collapse text-left text-[14.5px]">
        <caption className="font-display text-faint pb-2.5 text-left text-[13px] font-semibold tracking-[0.1em] uppercase">
          {caption}
        </caption>
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                scope="col"
                className="font-display border-line text-muted border-b py-2.5 pr-4 align-top text-[13px] font-semibold tracking-wide uppercase"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return <tr>{children}</tr>;
}

export function Cell({
  children,
  lead = false,
}: {
  children: React.ReactNode;
  lead?: boolean;
}) {
  return (
    <td
      className={`border-line-soft border-b py-2.75 pr-5 align-top ${
        lead ? "font-medium" : ""
      }`}
    >
      {children}
    </td>
  );
}

/** Secondary line inside a table cell. */
export function Sub({ children }: { children: React.ReactNode }) {
  return <span className="text-muted mt-0.75 block text-[13.5px]">{children}</span>;
}

/** Definition row used for the data-subject rights list. */
export function Definition({
  term,
  children,
}: {
  term: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-line-soft grid gap-0.5 border-b py-3 sm:grid-cols-[168px_minmax(0,1fr)] sm:gap-5">
      <span className="font-display text-[15px] font-semibold">{term}</span>
      <span className="text-muted text-[15px]">{children}</span>
    </div>
  );
}

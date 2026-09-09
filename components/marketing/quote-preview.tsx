import { QUOTATION_FOOTER } from "@/lib/documents";

/**
 * Marketing artwork: a static picture of a sent quotation.
 *
 * The amounts below are sample *display copy*, not domain money — nothing here
 * is computed, stored, or round-tripped. Real money stays integer centavos and
 * is formatted through lib/money.ts (DEVELOPMENT_PLAN.md §6.1).
 */
const SAMPLE_ITEMS = [
  { description: "Brand identity design", quantity: "1", amount: "25,000.00" },
  {
    description: "Packaging labels (6 SKUs)",
    quantity: "6",
    amount: "15,000.00",
  },
  { description: "Photo retouching", quantity: "12", amount: "4,200.00" },
];

const SAMPLE_TOTALS = [
  { label: "Subtotal", amount: "44,200.00" },
  { label: "Discount", amount: "−2,000.00" },
];

export function QuotePreview() {
  return (
    <div className="relative w-full lg:w-140 lg:pt-6.5">
      {/* Floating client confirmation chip — desktop only. */}
      <div className="border-paper/10 bg-ink-raised absolute top-0 left-2 hidden w-75 -rotate-4 items-center justify-between gap-3 rounded-xl border p-4 px-4.5 lg:flex">
        <div className="flex flex-col gap-1">
          <span className="text-paper/60 font-mono text-[13px]">
            Q-2026-0031
          </span>
          <span className="text-paper/85 text-sm">Kasiglahan Coffee Co.</span>
        </div>
        <span className="bg-jade/20 font-display text-jade-light rounded px-2.5 py-1.5 text-[11px] font-semibold tracking-wider">
          ACCEPTED
        </span>
      </div>

      <article className="text-text shadow-document relative overflow-hidden rounded-xl bg-white lg:mt-18.5 lg:ml-10 lg:w-130 lg:rounded-2xl">
        <header className="border-line-soft flex items-start justify-between gap-3 border-b p-4.5 pb-3.5 lg:p-7 lg:pb-5">
          <div className="flex flex-col gap-1.5">
            <span className="font-display text-faint text-[10px] font-semibold tracking-[0.16em] lg:text-[11px]">
              QUOTATION
            </span>
            <span className="font-mono text-[17px] font-medium lg:text-xl">
              Q-2026-0012
            </span>
          </div>
          <div className="flex flex-col items-end gap-1.5 lg:gap-2">
            <span className="bg-brass-wash font-display text-brass-ink rounded px-2.5 py-1.5 text-[10px] font-semibold tracking-[0.1em] lg:px-3">
              SENT
            </span>
            <span className="text-muted text-xs lg:text-[13px]">
              Valid until September 30, 2026
            </span>
          </div>
        </header>

        <div className="grid gap-4 p-4.5 pb-3 lg:grid-cols-2 lg:gap-6 lg:p-7 lg:py-5.5">
          <div className="hidden flex-col gap-1.5 lg:flex">
            <span className="text-faint text-[11px] font-semibold tracking-[0.12em]">
              FROM
            </span>
            <span className="text-[15px] font-semibold">
              Escalo Design Studio
            </span>
            <span className="text-muted text-[13px] leading-relaxed">
              Quezon City · hello@escalo.ph
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-faint text-[10px] font-semibold tracking-[0.12em] lg:text-[11px]">
              QUOTED TO
            </span>
            <span className="text-[15px] font-semibold">
              Kasiglahan Coffee Co.
            </span>
            <span className="text-muted text-[13px] leading-relaxed">
              Marikina City · ana@kasiglahan.ph
            </span>
          </div>
        </div>

        <div className="px-4.5 lg:px-7">
          <div className="border-line-soft grid grid-cols-[1fr_96px] gap-2.5 border-y py-2.5 lg:grid-cols-[1fr_56px_110px] lg:gap-3">
            <span className="text-faint text-[10px] font-semibold tracking-[0.1em] lg:text-[11px]">
              DESCRIPTION
            </span>
            <span className="text-faint hidden text-right text-[11px] font-semibold tracking-[0.1em] lg:block">
              QTY
            </span>
            <span className="text-faint text-right text-[10px] font-semibold tracking-[0.1em] lg:text-[11px]">
              AMOUNT
            </span>
          </div>
          {SAMPLE_ITEMS.map((item, index) => (
            <div
              key={item.description}
              className={`grid grid-cols-[1fr_96px] gap-2.5 py-2.75 lg:grid-cols-[1fr_56px_110px] lg:gap-3 lg:py-3.25 ${
                index === SAMPLE_ITEMS.length - 1
                  ? ""
                  : "border-line-softer border-b"
              }`}
            >
              <span className="text-sm">{item.description}</span>
              <span className="text-muted hidden text-right font-mono text-sm lg:block">
                {item.quantity}
              </span>
              <span className="text-right font-mono text-sm">
                {item.amount}
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-end p-4.5 pt-1.5 lg:px-7 lg:pt-1 lg:pb-5.5">
          <div className="flex w-full flex-col gap-2 lg:w-67">
            {SAMPLE_TOTALS.map((total) => (
              <div key={total.label} className="flex justify-between">
                <span className="text-muted text-[13px] lg:text-sm">
                  {total.label}
                </span>
                <span className="font-mono text-[13px] lg:text-sm">
                  {total.amount}
                </span>
              </div>
            ))}
            <div className="border-line-soft flex items-baseline justify-between border-t pt-2.5">
              <span className="font-display text-sm font-semibold lg:text-[15px]">
                Total
              </span>
              <span className="font-mono text-xl font-medium lg:text-[22px]">
                ₱42,200.00
              </span>
            </div>
          </div>
        </div>

        <div className="border-line-soft border-t px-4.5 py-2.5 text-center text-[11px] text-slate-400 italic lg:px-7">
          {QUOTATION_FOOTER}
        </div>

        <footer className="border-line-soft bg-paper-edge flex items-center justify-between gap-3 border-t px-4.5 py-3.25 lg:px-7 lg:py-4">
          <div className="flex items-center gap-2.25">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted hidden size-4 lg:block"
              aria-hidden="true"
            >
              <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
              <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
            </svg>
            <span className="text-muted font-mono text-xs lg:text-[13px]">
              bilyoapp.com/q/8fk2q1xz9v
            </span>
          </div>
          <span className="border-line font-display flex items-center gap-1.5 rounded-md border bg-white px-3 py-2 text-xs font-medium lg:text-[13px]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-3.5 lg:size-3.75"
              aria-hidden="true"
            >
              <path d="M12 4v11" />
              <path d="M7.5 11l4.5 4.5 4.5-4.5" />
              <path d="M5 19h14" />
            </svg>
            PDF
          </span>
        </footer>
      </article>
    </div>
  );
}

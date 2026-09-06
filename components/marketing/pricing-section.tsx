import Link from "next/link";

type Plan = {
  name: string;
  blurb: string;
  price: string;
  features: string[];
  /** Copy the plan doesn't decide yet — rendered as a visible placeholder. */
  placeholder?: string;
  cta: string;
  featured?: boolean;
};

/**
 * Prices and the free-tier limits come from DEVELOPMENT_PLAN.md §7 (M7-T01, M8-T01).
 * What separates Freelancer from Business is not decided there, so it is a
 * bracketed placeholder rather than an invented feature.
 */
const PLANS: Plan[] = [
  {
    name: "Free",
    blurb: "For your first few clients.",
    price: "₱0",
    features: [
      "5 invoices per month",
      "5 quotations per month",
      "Up to 10 saved clients",
      "PDF download and public link",
    ],
    cta: "Start free",
  },
  {
    name: "Freelancer",
    blurb: "For steady, repeat billing.",
    price: "₱299",
    features: [
      "Unlimited invoices and quotations",
      "Unlimited saved clients and services",
    ],
    placeholder: "[WHAT ELSE FREELANCER ADDS — 2 LINES]",
    cta: "Start free, upgrade later",
    featured: true,
  },
  {
    name: "Business",
    blurb: "For a shop with volume.",
    price: "₱599",
    features: ["Everything in Freelancer"],
    placeholder: "[WHAT BUSINESS ADDS — 3 LINES]",
    cta: "Start free, upgrade later",
  },
];

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-brass mt-0.75 size-4.25 shrink-0 lg:size-4.5"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="mx-auto w-full max-w-360 px-5 py-14 lg:px-30 lg:py-25"
    >
      <div className="flex flex-col gap-3.5 lg:items-center lg:gap-4 lg:pb-13 lg:text-center">
        <h2 className="font-display text-3xl leading-tight font-bold tracking-tight text-balance lg:text-[42px]">
          Start free. Pay when billing becomes a habit.
        </h2>
        <p className="text-muted max-w-140 text-base leading-relaxed lg:text-[17px]">
          Every plan includes the PDF, the public link and centavo-accurate
          totals. Billed monthly, in pesos.
        </p>
      </div>

      <div className="mt-3.5 grid gap-3.5 lg:mt-0 lg:grid-cols-3 lg:gap-6">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`flex flex-col gap-4.5 rounded-xl p-5.5 pb-7 lg:gap-5.5 lg:p-8 lg:pb-9 ${
              plan.featured
                ? "bg-ink text-paper order-first lg:order-none"
                : "border-line border bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex flex-col gap-1.5">
                <span className="font-display text-[17px] font-semibold lg:text-lg">
                  {plan.name}
                </span>
                <span
                  className={`text-sm lg:text-[15px] ${plan.featured ? "text-paper/60" : "text-muted"}`}
                >
                  {plan.blurb}
                </span>
              </div>
              {plan.featured ? (
                <span className="bg-brass font-display text-ink rounded px-2.25 py-1.25 text-[10px] font-semibold tracking-wider lg:px-2.75 lg:py-1.5 lg:text-[11px]">
                  MOST LIKELY FIT
                </span>
              ) : null}
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-[38px] font-bold tracking-tight lg:text-[44px]">
                {plan.price}
              </span>
              <span
                className={`text-[15px] lg:text-base ${plan.featured ? "text-paper/60" : "text-muted"}`}
              >
                /month
              </span>
            </div>

            <ul className="flex flex-col gap-2.5 lg:gap-3">
              {plan.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2.25 lg:gap-2.5"
                >
                  <CheckIcon />
                  <span className="text-[15px] leading-normal lg:text-base">
                    {feature}
                  </span>
                </li>
              ))}
              {plan.placeholder ? (
                <li
                  className={`font-mono text-[13px] leading-relaxed lg:text-sm ${
                    plan.featured ? "text-brass" : "text-brass-ink"
                  }`}
                >
                  {plan.placeholder}
                </li>
              ) : null}
            </ul>

            <Link
              href="/register"
              className={`font-display mt-auto flex h-13 items-center justify-center rounded-md text-base font-semibold transition-opacity hover:opacity-90 ${
                plan.featured
                  ? "bg-brass text-ink"
                  : "border-text text-text border"
              }`}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

'use client';

import { useState } from "react";
import Link from "next/link";

type Pass = {
  name: string;
  blurb: string;
  price: string;
  period: string;
  features: string[];
  featured?: boolean;
};

const PASSES: Pass[] = [
  {
    name: "30-Day Access",
    blurb: "For occasional quotes and short projects.",
    price: "₱199",
    period: "30 days",
    features: [
      "Unlimited quotations",
      "Client one-tap accept or decline",
      "Private mobile links and PDF downloads",
      "Track when clients view and decide",
    ],
  },
  {
    name: "90-Day Access",
    blurb: "For steady freelancers and consultants.",
    price: "₱499",
    period: "90 days",
    features: [
      "Everything in 30-Day Access",
      "Save regular clients and service rates",
      "Full quotation history and pipeline",
      "Stackable renewals",
    ],
    featured: true,
  },
  {
    name: "1-Year Access",
    blurb: "For established service businesses.",
    price: "₱1,499",
    period: "365 days",
    features: [
      "Everything in 90-Day Access",
      "Best value per month",
      "Priority customer support",
      "Export client and quotation data anytime",
    ],
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
  const [notified, setNotified] = useState(false);

  return (
    <section
      id="pricing"
      className="mx-auto w-full max-w-360 px-5 py-14 lg:px-30 lg:py-25"
    >
      {/* Beta Announcement Banner per §6.10 */}
      <div className="mb-10 rounded-xl border border-brass/30 bg-brass/10 p-4 text-center lg:mb-14">
        <p className="font-display text-sm font-semibold text-ink lg:text-base">
          ✨ Bilyo is free during beta. Paid access starts soon. Beta users get 50% off their first pass.
        </p>
      </div>

      <div className="flex flex-col gap-3.5 lg:items-center lg:gap-4 lg:pb-13 lg:text-center">
        <h2 className="font-display text-3xl leading-tight font-bold tracking-tight text-balance lg:text-[42px]">
          Quotation Access Plan
        </h2>
        <p className="text-muted max-w-140 text-base leading-relaxed lg:text-[17px]">
          Prepaid access, no auto-renewals, no credit cards. Quotes are never metered.
        </p>
      </div>

      <div className="mt-3.5 grid gap-3.5 lg:mt-0 lg:grid-cols-3 lg:gap-6">
        {PASSES.map((pass) => (
          <div
            key={pass.name}
            className={`flex flex-col gap-4.5 rounded-xl p-5.5 pb-7 lg:gap-5.5 lg:p-8 lg:pb-9 ${
              pass.featured
                ? "bg-ink text-paper order-first lg:order-none"
                : "border-line border bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex flex-col gap-1.5">
                <span className="font-display text-[17px] font-semibold lg:text-lg">
                  {pass.name}
                </span>
                <span
                  className={`text-sm lg:text-[15px] ${pass.featured ? "text-paper/60" : "text-muted"}`}
                >
                  {pass.blurb}
                </span>
              </div>
              {pass.featured ? (
                <span className="bg-brass font-display text-ink rounded px-2.25 py-1.25 text-[10px] font-semibold tracking-wider lg:px-2.75 lg:py-1.5 lg:text-[11px]">
                  POPULAR
                </span>
              ) : null}
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-[38px] font-bold tracking-tight lg:text-[44px]">
                {pass.price}
              </span>
              <span
                className={`text-[15px] lg:text-base ${pass.featured ? "text-paper/60" : "text-muted"}`}
              >
                / {pass.period}
              </span>
            </div>

            <ul className="flex flex-col gap-2.5 lg:gap-3">
              {pass.features.map((feature) => (
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
            </ul>

            <div className="mt-auto pt-2">
              {notified ? (
                <div className="rounded-md bg-emerald-50 py-2.5 text-center text-xs font-semibold text-emerald-700">
                  We will let you know when paid passes open!
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    href="/register"
                    className={`font-display flex h-11.5 items-center justify-center rounded-md px-5 text-sm font-semibold transition-opacity hover:opacity-90 ${
                      pass.featured
                        ? "bg-brass text-ink"
                        : "border-line text-ink hover:border-ink/40 border bg-white"
                    }`}
                  >
                    Start free in beta
                  </Link>
                  <button
                    type="button"
                    onClick={() => setNotified(true)}
                    className="text-xs text-muted hover:text-ink transition-colors cursor-pointer py-1"
                  >
                    Notify me when passes launch →
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

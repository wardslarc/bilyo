import Link from "next/link";
import { QuotePreview } from "@/components/marketing/quote-preview";
import { PricingSection } from "@/components/marketing/pricing-section";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { QUOTATION_FOOTER } from "@/lib/documents";

const TRUST_POINTS = [
  {
    title: "Centavo-exact",
    body: "Amounts are stored as whole centavos, never floats.",
  },
  {
    title: "Straightforward totals",
    body: "Line items, clean discounts, and clear totals without hidden formulas.",
  },
  {
    title: "Sequential numbering",
    body: "Q-2026-0001 — per user, per year, never reused.",
  },
  {
    title: "Manila time, peso first",
    body: "Dates read September 30, 2026 — not 09/30 or 30/09.",
  },
];

const FEATURES = [
  {
    title: "One-tap client response",
    body: "Your client opens the link on their phone and accepts or declines in seconds. No account needed, no app to install, and your pipeline updates immediately.",
    icon: (
      <>
        <path d="M4 8h11" />
        <path d="M11 4l4 4-4 4" />
        <path d="M20 16H9" />
        <path d="M13 12l-4 4 4 4" />
      </>
    ),
  },
  {
    title: "A link, not an attachment",
    body: "Every quotation gets a private link your client opens in any browser — no sign-up, no app, readable on a phone. The PDF is one tap away from that page. Revoke the link whenever you want.",
    icon: (
      <>
        <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
        <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
      </>
    ),
  },
  {
    title: "A sent quotation stays sent",
    body: "The moment you send, Bilyo freezes your business details and your client's onto the document. Update your profile later and quotes already sent remain untouched.",
    icon: (
      <>
        <path d="M12 3l7.5 3.4v5c0 4.3-3.1 8-7.5 9.6-4.4-1.6-7.5-5.3-7.5-9.6v-5z" />
        <path d="M9 12l2.2 2.2L15.5 10" />
      </>
    ),
  },
];

const STEPS = [
  {
    number: "01",
    title: "Add your business",
    body: "Business name, address, and contact details. Save your regular clients so you stop retyping them.",
  },
  {
    number: "02",
    title: "Build the quotation",
    body: "Pick a client, add line items and quantities. Subtotal and discount compute as you type, and are verified server-side when you save.",
  },
  {
    number: "03",
    title: "Send it and get confirmed",
    body: "Share the link via Messenger or email, or download the PDF. See when your client views it and track confirmed sales on your dashboard.",
  },
];

export default function LandingPage() {
  return (
    <>
      {/* ---------- Ink band: header + hero ---------- */}
      <div className="bg-ink text-paper">
        <div className="mx-auto w-full max-w-360 px-5 pb-12 lg:px-30 lg:pb-22">
          <SiteHeader />

          <div className="flex flex-col items-start gap-8 pt-8.5 lg:flex-row lg:justify-between lg:gap-16 lg:pt-18">
            <div className="flex w-full flex-col gap-5 lg:w-150 lg:gap-7 lg:pt-6">
              <div className="flex items-center gap-2.5 lg:gap-3">
                <span className="bg-brass h-0.5 w-6 lg:w-8" />
                <span className="font-display text-brass text-[13px] font-semibold tracking-[0.12em] uppercase lg:text-sm lg:tracking-[0.14em]">
                  <span className="lg:hidden">PH freelancers &amp; MSMEs</span>
                  <span className="hidden lg:inline">
                    For Philippine freelancers &amp; MSMEs
                  </span>
                </span>
              </div>

              <h1 className="font-display text-[40px] leading-[1.06] font-bold tracking-tight text-balance lg:text-[62px] lg:leading-[1.04]">
                Quotations your clients can accept with one tap.
              </h1>

              <p className="text-paper/75 max-w-135 text-[17px] leading-relaxed lg:text-xl">
                Build a quotation and send it as a link your client opens on their
                phone — or a clean PDF. Fast approvals, clear confirmations, and
                a pipeline you can track.
              </p>

              <div className="flex w-full flex-col gap-3 pt-1 lg:w-auto lg:flex-row lg:items-center lg:gap-4 lg:pt-2">
                <Link
                  href="/register"
                  className="bg-brass font-display text-ink flex h-13.5 items-center justify-center rounded-md px-7.5 text-[17px] font-semibold transition-opacity hover:opacity-90 lg:h-14"
                >
                  Start free
                </Link>
                <Link
                  href="#sample"
                  className="border-paper/25 font-display text-paper hover:border-paper/50 flex h-13.5 items-center justify-center gap-2 rounded-md border px-6.5 text-[17px] font-medium transition-colors lg:h-14"
                >
                  See a sample quote
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-4.25 lg:size-4.5"
                    aria-hidden="true"
                  >
                    <path d="M5 12h13" />
                    <path d="M13 6l6 6-6 6" />
                  </svg>
                </Link>
              </div>

              <p className="text-paper/50 text-sm lg:text-[15px]">
                Free and unlimited during beta. No card required.
              </p>
            </div>

            <div id="sample" className="w-full scroll-mt-8 lg:w-auto">
              <QuotePreview />
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Trust strip ---------- */}
      <div className="mx-auto w-full max-w-360 px-5 lg:px-30">
        <div className="grid lg:grid-cols-4">
          {TRUST_POINTS.map((point, index) => (
            <div
              key={point.title}
              className={`border-line flex flex-col gap-1.5 border-b py-5.5 lg:gap-1.75 lg:py-8.5 ${
                index === 0 ? "lg:pr-8" : "lg:border-l lg:px-8"
              } ${index === TRUST_POINTS.length - 1 ? "lg:pr-0" : ""}`}
            >
              <span className="font-display text-base font-semibold lg:text-[17px]">
                {point.title}
              </span>
              <span className="text-muted text-[15px] leading-normal">
                {point.body}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- Features ---------- */}
      <section
        id="features"
        className="mx-auto w-full max-w-360 scroll-mt-4 px-5 py-14 lg:px-30 lg:py-25"
      >
        <div className="flex flex-col gap-4 pb-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12 lg:pb-14">
          <h2 className="font-display max-w-155 text-3xl leading-tight font-bold tracking-tight text-balance lg:text-[42px]">
            Everything a quotation needs to turn into a confirmed sale.
          </h2>
          <p className="text-muted text-base leading-relaxed lg:mb-1.5 lg:w-82.5">
            Bilyo does one job: getting the quotation from you to your client and closing it smoothly.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-3 lg:gap-6">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="border-line flex flex-col gap-3 rounded-xl border bg-white p-5.5 pb-6.5 lg:gap-4 lg:p-7.5 lg:pb-9"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-brass size-6 lg:size-6.5"
                aria-hidden="true"
              >
                {feature.icon}
              </svg>
              <h3 className="font-display text-xl font-semibold tracking-tight lg:text-[22px]">
                {feature.title}
              </h3>
              <p className="text-muted text-base leading-relaxed">
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section
        id="how-it-works"
        className="border-line bg-paper-sunk scroll-mt-4 border-y"
      >
        <div className="mx-auto w-full max-w-360 px-5 py-13 lg:px-30 lg:py-23">
          <div className="flex items-center gap-2.5 pb-4 lg:gap-3 lg:pb-5">
            <span className="bg-brass h-0.5 w-6 lg:w-8" />
            <span className="font-display text-brass-ink text-[13px] font-semibold tracking-[0.12em] uppercase lg:text-sm lg:tracking-[0.14em]">
              How it works
            </span>
          </div>
          <h2 className="font-display max-w-175 text-3xl leading-tight font-bold tracking-tight text-balance lg:text-[42px]">
            Set up once. Every quotation after that takes a minute.
          </h2>

          <div className="mt-8 grid gap-6.5 lg:mt-14 lg:grid-cols-3 lg:gap-10">
            {STEPS.map((step, index) => (
              <div
                key={step.number}
                className={`flex flex-col gap-2.5 border-t-2 pt-4.5 lg:gap-3.5 lg:pt-5.5 ${
                  index === 0 ? "border-brass" : "border-line"
                }`}
              >
                <span
                  className={`font-mono text-[13px] font-medium lg:text-sm ${
                    index === 0 ? "text-brass-ink" : "text-faint"
                  }`}
                >
                  {step.number}
                </span>
                <h3 className="font-display text-[21px] font-semibold tracking-tight lg:text-2xl">
                  {step.title}
                </h3>
                <p className="text-muted text-base leading-relaxed">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Pricing ---------- */}
      <PricingSection />

      {/* ---------- Required Legal Notice (§2.3) ---------- */}
      <div className="mx-auto w-full max-w-360 px-5 pb-13 lg:px-30 lg:pb-24">
        <div className="border-line bg-paper-sunk flex flex-col gap-2 rounded-xl border p-5.5 lg:flex-row lg:items-center lg:gap-4.5 lg:p-6">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted size-5 shrink-0 lg:size-5.5"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5.5" />
            <path d="M12 7.6v.4" />
          </svg>
          <p className="text-muted text-sm leading-relaxed lg:text-[15px]">
            {QUOTATION_FOOTER}
          </p>
        </div>
      </div>

      {/* ---------- Final call to action ---------- */}
      <div className="bg-ink text-paper">
        <div className="mx-auto flex w-full max-w-360 flex-col gap-4.5 px-5 py-13 lg:flex-row lg:items-center lg:justify-between lg:gap-14 lg:px-30 lg:py-21">
          <div className="flex flex-col gap-3 lg:gap-3.5">
            <h2 className="font-display max-w-155 text-3xl leading-tight font-bold tracking-tight text-balance lg:text-[40px]">
              Your next quotation takes about a minute.
            </h2>
            <p className="text-paper/70 text-base lg:text-[17px]">
              Free during beta, no credit card required. Bring one client and see how fast they confirm.
            </p>
          </div>
          <Link
            href="/register"
            className="bg-brass font-display text-ink flex h-14 shrink-0 items-center justify-center rounded-md px-8.5 text-[17px] font-semibold transition-opacity hover:opacity-90 lg:h-14.5 lg:text-lg"
          >
            Create your first quotation
          </Link>
        </div>
      </div>

      <SiteFooter />
    </>
  );
}

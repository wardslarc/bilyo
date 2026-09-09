import Link from "next/link";
import { InvoicePreview } from "@/components/marketing/invoice-preview";
import { PricingSection } from "@/components/marketing/pricing-section";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

const TRUST_POINTS = [
  {
    title: "Centavo-exact",
    body: "Amounts are stored as whole centavos, never floats.",
  },
  {
    title: "12% VAT, when it applies",
    body: "Not VAT-registered? The line simply doesn't print.",
  },
  {
    title: "Sequential numbering",
    body: "QUO-000001, INV-000001 — never reused, never renumbered.",
  },
  {
    title: "Manila time, peso first",
    body: "Dates read September 30, 2026 — not 09/30 or 30/09.",
  },
];

const FEATURES = [
  {
    title: "Accepted quote, instant invoice",
    body: "One click carries the line items, discount, VAT and client details across. The quotation stays on file as accepted, linked to the invoice it became. Nothing is retyped, nothing drifts.",
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
    body: "Every document gets a private link your client opens in any browser — no sign-up, no app, readable on a phone. The PDF is one tap away from that page. Revoke the link whenever you want.",
    icon: (
      <>
        <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
        <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
      </>
    ),
  },
  {
    title: "A sent document stays sent",
    body: "The moment you send, Bilyo freezes your business details and your client's onto the document. Update an address next month and the invoice they already received is untouched.",
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
    body: "Business name, address, TIN, and whether you're VAT-registered. Save your regular clients and the services you sell so you stop typing them.",
  },
  {
    number: "02",
    title: "Build the document",
    body: "Pick a client, add line items from your saved services or type them fresh. Subtotal, discount and VAT compute as you go — and are checked again on the server when you save.",
  },
  {
    number: "03",
    title: "Send it and watch it",
    body: "Share the link or download the PDF, then mark it paid when the money lands. Anything past its due date shows up as overdue without you tagging it.",
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
                Quotation to invoice to paid — in one place.
              </h1>

              <p className="text-paper/75 max-w-135 text-[17px] leading-relaxed lg:text-xl">
                Build a quotation, turn it into an invoice, and send it as a
                link your client opens in a browser — or a PDF. Peso-exact, 12%
                VAT handled, and you can see what is still unpaid.
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
                  See a sample invoice
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
                Free for 5 invoices and 5 quotations a month. No card required.
              </p>
            </div>

            <div id="sample" className="w-full scroll-mt-8 lg:w-auto">
              <InvoicePreview />
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
            Everything a small invoice needs, and nothing that belongs in an
            accounting system.
          </h2>
          <p className="text-muted text-base leading-relaxed lg:mb-1.5 lg:w-82.5">
            Bilyo does one job: getting the document from you to your client,
            correctly.
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
            Set up once. Every document after that takes a minute.
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

      {/* ---------- What Bilyo is not ----------
          Required honesty, not decoration: AGENTS.md §4 forbids fabricated BIR
          compliance claims anywhere in the application, marketing copy included. */}
      <div className="mx-auto w-full max-w-360 px-5 pb-13 lg:px-30 lg:pb-24">
        <div className="border-line bg-paper-sunk flex flex-col gap-2 rounded-xl border p-5.5 lg:flex-row lg:items-start lg:gap-4.5 lg:p-8">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted size-5 shrink-0 lg:mt-0.5 lg:size-5.5"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5.5" />
            <path d="M12 7.6v.4" />
          </svg>
          <div className="flex flex-col gap-1.5">
            <span className="font-display text-base font-semibold lg:text-[17px]">
              What Bilyo is not
            </span>
            <span className="text-muted max-w-220 text-[15px] leading-relaxed lg:text-base">
              Bilyo is a billing tool, not an accounting system and not a
              BIR-accredited CAS. The documents it produces are not official
              sales invoices or official receipts — every PDF says so in its
              footer. Keep issuing your BIR-registered receipts as you do today.
            </span>
          </div>
        </div>
      </div>

      {/* ---------- Final call to action ---------- */}
      <div className="bg-ink text-paper">
        <div className="mx-auto flex w-full max-w-360 flex-col gap-4.5 px-5 py-13 lg:flex-row lg:items-center lg:justify-between lg:gap-14 lg:px-30 lg:py-21">
          <div className="flex flex-col gap-3 lg:gap-3.5">
            <h2 className="font-display max-w-155 text-3xl leading-tight font-bold tracking-tight text-balance lg:text-[40px]">
              Your next invoice takes about a minute.
            </h2>
            <p className="text-paper/70 text-base lg:text-[17px]">
              Free plan, no card. Bring one client and see how it feels.
            </p>
          </div>
          <Link
            href="/register"
            className="bg-brass font-display text-ink flex h-14 shrink-0 items-center justify-center rounded-md px-8.5 text-[17px] font-semibold transition-opacity hover:opacity-90 lg:h-14.5 lg:text-lg"
          >
            Create your first invoice
          </Link>
        </div>
      </div>

      <SiteFooter />
    </>
  );
}

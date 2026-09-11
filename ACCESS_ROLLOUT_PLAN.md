# Bilyo — Access & GCash Rollout: step-by-step

**Companion to `ACCESS_BILLING_PLAN.md`** (the design) and `DEVELOPMENT_PLAN.md` (the milestones).
This file is the running order: who does what, in what sequence, and what blocks what.

**Payment rail: GCash. Decided.** PayPal was evaluated and rejected — 3.4% + ₱15 is 10.9% of a
₱200 pass, and your buyers have GCash, not credit cards.

Legend: **👤 YOU** = only a human can do it · **🤖 AGENT** = hand to a coding agent

---

## The order matters more than the tasks

Your own `DEVELOPMENT_PLAN.md` blocks P7 behind Gate 3, and that discipline is the most valuable
thing in this plan. **Stages 1–2 cost you ~10 agent-hours and tell you whether anyone will pay.
Stages 3–5 cost ~13 hours and only make sense if the answer was yes.**

Do not set up GCash, generate QR codes, or build the top-up queue before Stage 2 answers the
question. Building billing for a product nobody pays for is the single most common way a solo
project dies with working code and no users.

```
STAGE 1  🤖  Trial + access rails            ~10 h    ← start now, no dependencies
STAGE 2  👤  Turn it on, run it, read Gate 3  2-4 weeks elapsed
             │
             ├── Gate 3 fails ──► stop. Fix the product, not the billing.
             │
STAGE 3  👤  GCash prep                       ~2 h    ← only past Gate 3
STAGE 4  🤖  Payment plumbing                ~11 h
STAGE 5  👤🤖 Go live                          ~2 h
```

---

## Current state (verified in the repo, 10 Sep 2026)

**Shipped:** auth · email verification · optional MFA · quotations · clients · public quote page ·
PDF · admin (users, lookup, audit, quotations) · Resend + webhook · rate limiting · Vercel Blob ·
one cron at `/api/cron/purge`.

**Missing — all of P5 and all of P7:**

| Thing | State |
|---|---|
| `user.accessUntil`, `user.firstPaidAt` | do not exist |
| `lib/access.ts` | does not exist |
| `models/interest.ts` | does not exist |
| `models/access-plan.ts`, `models/top-up.ts` | do not exist |
| `/dashboard/access`, `/admin/plans`, `/admin/topups` | do not exist |
| `(marketing)/pricing/page.tsx` | 875-byte stub, no plans, no Notify me |
| `lib/email/templates/access-expiring.ts` | **exists**, but nothing drives it |

That last row is a small gift — the reminder email is already written.

---

# STAGE 1 🤖 — Trial + access rails

**Goal:** the 14-day trial actually ends, and the wall asks people whether they'd pay.
**No GCash involvement at all.** Nothing here takes money.

> ⚠ One correction to `ACCESS_BILLING_PLAN.md` §10: I originally put enforcement in P7 behind
> `ACCESS_ENFORCED`. That's wrong for the trial — **a trial that never blocks anything is not a
> trial, and the survey behind it never fires.** Enforcement ships here, in Stage 1. It blocks
> create and send only; reading, PDFs and export stay open forever.

### 🤖 A1 · `accessUntil` + `firstPaidAt` + `lib/access.ts` · 1.5 h
*Files:* `models/user.ts` · `types/index.ts` · `lib/access.ts` · `tests/access.test.ts`
*Do:* two nullable `Date` fields on `users`. A pure, synchronous
`accessState(user): { status, accessUntil, daysLeft }` with the five statuses from
`ACCESS_BILLING_PLAN.md` §3.3 — `BETA` · `TRIAL` · `ACTIVE` · `EXPIRED_TRIAL` · `EXPIRED_PAID`.
No DB read, no `await`. Nothing calls it to block anything yet.
*Accept:* `accessUntil: null` → `BETA`; one second past → `EXPIRED_TRIAL` with no job having run;
`firstPaidAt` set flips `TRIAL`→`ACTIVE` and `EXPIRED_TRIAL`→`EXPIRED_PAID`; Manila day-boundary
case is tested; `grep -c await lib/access.ts` returns 0.

### 🤖 A2 · Trial assignment · 1 h · *blocked by A1*
*Files:* the email-verification action · `.env.example`
*Do:* when `TRIAL_ENABLED`, set `accessUntil = now + TRIAL_DAYS` (default 14).
**Start the trial at email verification, not at registration** — you already have junk signups from
non-existent addresses, and starting at registration burns trial days on accounts that never open
the app and poisons your conversion number.
*Accept:* flag off → `accessUntil` stays `null`; flag on → a newly verified account has 14 days;
an account that verifies twice does not get 28; existing accounts are untouched.

### 🤖 A3 · Access status in the dashboard · 1 h · *blocked by A1*
*Files:* `app/(dashboard)/dashboard/layout.tsx` · `components/dashboard/access-banner.tsx`
*Do:* one status line driven by `accessState()`. `TRIAL` → "12 days left in your trial".
`ACTIVE` → "Access until 14 Oct 2026". `BETA` → the existing beta-banner text with the date from
`BETA_ENDS_AT`. Dismissible per session, not permanently.
*Accept:* long-form Manila date; renders at 390px; never covers the primary CTA.

### 🤖 A4 · Enforcement · 1.5 h · *blocked by A1*
*Files:* `actions/quotations.ts` · `lib/auth-guards.ts` · `lib/access.ts`
*Do:* `EXPIRED_TRIAL` and `EXPIRED_PAID` block **`createQuotation` and `sendQuotation` only**.
Reading quotations, the client list, PDF download and export stay open forever
(`ACCESS_BILLING_PLAN.md` §3.2, `AGENTS.md` §5). Behind `ACCESS_ENFORCED` so it's one env change to
switch off.
*Accept:* an expired user opens every existing quote, downloads its PDF and exports their data; the
same user cannot create or send; **a draft in progress is saved, not discarded**, when the gate
trips; a `BETA` user is never blocked.

### 🤖 A5 · `interests` model + real pricing page · 2 h
*Files:* `models/interest.ts` · `models/index.ts` · `lib/validation/interest.ts` ·
`actions/notify-interest.ts` · `app/(marketing)/pricing/page.tsx` ·
`components/marketing/pricing-section.tsx`
*Do:* the §3.4 collection shape, with the `source` discriminator so the trial wall reuses it.
Replace the pricing stub: heading **Quotation Access Plan**, three passes at **₱200 / 30 days ·
₱500 / 90 days · ₱1,700 / 365 days**, "free during beta" stated plainly, a **Notify me** button.
*Accept:* a signed-in user's click records without retyping their email; a duplicate click is
idempotent; the count is visible in `/admin`; **no VAT line anywhere** (`AGENTS.md` §3).

### 🤖 A6 · Trial wall + willingness-to-pay survey · 2 h · *blocked by A4, A5* · ⭐ **the Gate 3 instrument**
*Files:* `components/dashboard/trial-wall.tsx` · `actions/notify-interest.ts`
*Do:* the wall from `ACCESS_BILLING_PLAN.md` §3.4 — their real numbers ("You sent 7 quotations,
3 were accepted, ₱48,500 in confirmed work"), the three passes, and the honest question with the
three answers. Record every answer with the usage snapshot **at the moment they answered**.
*Accept:* shows only for `EXPIRED_TRIAL`; the answer stores with `quotationsSent`,
`quotationsAccepted` and `acceptedValueCentavos`; dismissible but re-shown on the next blocked
action; a user who answers can still read and export everything.

**Build this one properly.** It is the only thing in Stage 1 that produces information rather than
code, and you cannot collect it retroactively once you've already decided.

### 🤖 A7 · Expiry reminder emails · 1 h · *blocked by A1*
*Files:* `app/api/cron/access-reminders/route.ts` · `vercel.json` · `lib/email/send.ts`
*Do:* 7-days-left and 1-day-left, once each, idempotent by `{ userId, accessUntil, kind }`. The
template `lib/email/templates/access-expiring.ts` already exists — wire it, don't rewrite it.
Guard with `CRON_SECRET` exactly like `/api/cron/purge`, and add the schedule to `vercel.json`.
*Accept:* re-running the job the same day sends nothing; a suspended account is skipped; inert
while every `accessUntil` is `null`.

### 🤖 A8 · Env hygiene · 15 min
*Files:* `.env.example`
*Do:* add `TRIAL_ENABLED=false`, `TRIAL_DAYS=14`, `ACCESS_ENFORCED=false`. **Remove
`PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET`** — PayMongo is out of the plan and stale keys
in `.env.example` are how a future agent decides to "restore" an integration.

**Stage 1 total: ~10 hours.** Every task ends with the `AGENTS.md` §8 checklist and its own commit.

---

# STAGE 2 👤 — Turn it on and find out

Nothing here is code. This is the part that decides whether Stages 3–5 happen at all.

- [ ] **👤 S2-1 · Decide the migration.** Do your existing beta accounts get a trial, or stay
  `accessUntil: null` forever as a thank-you? §6.10 already promises them 50% off their first pass.
  Grandfathering your first handful of users entirely is cheap and buys goodwill from exactly the
  people who'll refer you. **Write the decision into `DEVELOPMENT_PLAN.md` §6.10** — an agent will
  need it and will otherwise guess.
- [ ] **👤 S2-2 · Set the env vars in Vercel.** `TRIAL_ENABLED=true`, `TRIAL_DAYS=14`,
  `ACCESS_ENFORCED=true`. This is the moment the trial becomes real.
- [ ] **👤 S2-3 · Register a throwaway account and let it expire.** Set `TRIAL_DAYS=0` on preview,
  or edit one `accessUntil` in Atlas. Confirm with your own eyes: the wall appears, create and send
  are blocked, and **you can still open an old quote, download its PDF, and export.** That last
  half is the promise in §6.10 and the easiest thing for an agent to quietly break.
- [ ] **👤 S2-4 · Wait.** Two to four weeks. The trial has to actually end for anyone.
- [ ] **👤 S2-5 · Read the survey.** Filter to users who **sent ≥3 quotations** before expiring —
  everyone else is noise. Of those, what share said they'd pay, and what did the refusers write?
- [ ] **👤 S2-6 · Write the Gate 3 answer into `DEVELOPMENT_PLAN.md` §13**, pass or fail, dated.

### 🚦 Gate 3

| Signal | Read |
|---|---|
| ≥30% of engaged trials say they'd pay at ₱200 | **Go.** Stage 3. |
| They'd pay, but say ₱200 is wrong | **Go**, at their number. The flow is identical; only `accessPlans` rows change. |
| They'd pay "not right now" | **Wait.** Ask what changes their mind. Usually onboarding, not price. |
| They wouldn't pay, and name what's missing | **Stop.** Build that. Billing can wait; a product nobody pays for cannot be fixed with a payment page. |

---

# STAGE 3 👤 — GCash prep

**Only past Gate 3.** ~2 hours of your time, no code.

- [ ] **👤 S3-1 · Decide the account type.** Personal GCash is free to receive and caps at ₱100,000
  wallet. GCash for Business lifts that to ₱5M but charges **1% MDR on QRPH** and its higher tiers
  want government registration. At ₱18k/month you are nowhere near the personal cap — starting
  personal and migrating later is defensible, and it's what §6.10's "use a business account" advice
  was written before knowing the 1% cost. Your call; write it down.
- [ ] **👤 S3-2 · Generate three QR codes with the amount baked in** — ₱200, ₱500, ₱1,700. A QR Ph
  code can carry a fixed amount, and that single detail removes the biggest reconciliation failure
  (someone sending ₱50 for a ₱500 pass). Export as PNG. Name them `d30.png`, `d90.png`, `y1.png`.
- [ ] **👤 S3-3 · Test each QR yourself.** Scan all three with a second phone and confirm the amount
  and recipient name are pre-filled and correct. **Do not skip this.** A wrong QR is the one bug in
  this whole plan that costs your users money rather than your time.
- [ ] **👤 S3-4 · Note the display strings** an agent will need: the recipient name as GCash shows
  it, and the masked mobile number.
- [ ] **👤 S3-5 · Re-read your Terms for paid access.** Your refund policy is already written — full
  refund within 7 days of activating a pass if no quotation was sent on it, none after. Confirm the
  page says the passes and prices you're actually about to charge.
- [ ] **👤 S3-6 · Decide on business registration.** Not a design question, but it gates S5-2 and
  it's the one item here with a real lead time. *Not legal advice — get a real answer.*

---

# STAGE 4 🤖 — Payment plumbing

**Blocked by Stage 3.** An agent cannot start B2 without your QR files.

### 🤖 B1 · `accessPlans` + `TopUp` models · 2 h
*Files:* `models/access-plan.ts` · `models/top-up.ts` · `models/index.ts` ·
`lib/access/passes.ts` · `lib/validation/topup.ts` · `scripts/seed-plans.ts` · `tests/topup.test.ts`
*Do:* the §4.1 and §6 schemas. `lib/access/passes.ts` becomes a **reader of the collection**, not
the source of truth. Two things that must be right the first time:
  - **Reference normalization.** Store `referenceRaw` and `referenceNormalized` (uppercase, strip
    every non-alphanumeric). Unique index on the normalized field only.
  - **Partial unique index**, not a plain one:
    `{ unique: true, partialFilterExpression: { status: { $in: ['PENDING','APPROVED'] } } }`
    so a rejected reference is released and the user can resubmit a correction.
*Accept:* `"0091 2345 6789"` and `"009123456789"` collide; a `REJECTED` row's reference can be
reused; an `APPROVED` one cannot; `daysGranted` and `amountCentavos` are stored on the top-up, not
read from the plan at approval time (§4.2).

### 🤖 B2 · `/admin/plans` · 2 h · *blocked by B1 + your QR files*
*Files:* `app/(admin)/admin/plans/page.tsx` · `actions/admin/plans.ts` · `lib/admin/audit.ts`
*Do:* edit price, days and name; upload or replace a QR image; activate/deactivate; reorder. Behind
`requireAdmin()`, **404 for non-admins**, every write appends `AdminAuditLog`. A price change writes
`PLAN_PRICE_CHANGE` with before and after. No delete — deactivate, because approved top-ups
reference the row.
*Accept:* `AGENTS.md` §8 admin checklist; changing a price does not alter any existing top-up.

### 🤖 B3 · `/dashboard/access` — submission · 2.5 h · *blocked by B1*
*Files:* `app/(dashboard)/dashboard/access/page.tsx` · `actions/topups.ts` ·
`components/dashboard/topup-form.tsx`
*Do:* the §5.1 flow. Pick a pass → `DRAFT` row with the price/days/code snapshotted → show the QR
via a short-lived signed blob URL, with the exact amount stated large → user pays → enters reference
+ uploads screenshot → `PENDING`. Screenshot handling per §5.4: magic-number MIME check
(jpeg/png/webp only), 5 MB cap, EXIF stripped, private blob.
*Accept:* a duplicate reference returns a readable *"This reference has already been submitted"* —
the E11000 is caught and translated, never a 500; **an upload failure still records the top-up**
with `screenshotBlobKey: null`; status reads *Pending — access added within 24 hours*; renders at
390px.

### 🤖 B4 · `/admin/topups` — approval queue · 2.5 h · *blocked by B1*
*Files:* `app/(admin)/admin/topups/page.tsx` · `actions/admin/topups.ts`
*Do:* pending queue, screenshot preview, approve or reject with a note. Approval extends
`accessUntil = max(now, accessUntil) + daysGranted`, sets `firstPaidAt` if null, records
`accessUntilBefore` / `accessUntilAfter`, appends `TOPUP_APPROVE` to the audit log and
`TOPUP_APPROVED` to events.
Two non-negotiables:
  - **Idempotent approve.** Conditional update `{_id, status:'PENDING'}`; act only if
    `modifiedCount === 1`. A double-click must never grant two passes.
  - **The §5.5 verification checkbox.** *"I verified reference `…` for ₱500.00 in my GCash
    history"*, and Approve stays disabled until it's ticked. A screenshot is trivially forged and is
    not evidence — your GCash app is the only source of truth.
*Accept:* double-click grants once; stacking adds to the end of an unexpired window, never resets
from today; rejecting releases the reference; a non-admin gets 404.

### 🤖 B5 · Operator notification · 1 h · *blocked by B3*
*Files:* `lib/email/templates/topup-submitted.ts` · `actions/topups.ts` ·
`app/api/cron/topup-digest/route.ts` · `vercel.json` · `app/(admin)/admin/page.tsx`
*Do:* email to `TOPUP_NOTIFY_EMAIL` on submission — **after** the write, failure-tolerant, a dead
mailer must never roll back a submission. A pending-count badge on `/admin`. A 09:00 Manila digest
if anything has been pending over 12 hours.
*Accept:* a failing mailer leaves the top-up `PENDING` and the user sees success; the digest sends
nothing when the queue is empty.

### 🤖 B6 · Confirmation email · 45 min · *blocked by B4*
*Files:* `lib/email/templates/access-active.ts` · `actions/admin/topups.ts`
*Do:* on approval, email the user the pass, the amount, the reference and the new access date.
> ⚠ **Title it "Your Bilyo Access is active". Never "Receipt", "Payment Receipt" or "Official
> Receipt".** `AGENTS.md` §3 forbids that word, and this is the one screen in the entire app where
> reaching for it feels natural. Flagging it because it is a one-word slip from a rule violation.
*Accept:* no VAT line; no sequential document number; the word "receipt" appears nowhere in the
template.

### 🤖 B7 · Screenshot retention purge · 30 min
*Files:* `app/api/cron/purge/route.ts`
*Do:* extend the existing purge job — delete blobs for top-ups terminal longer than
`SCREENSHOT_RETENTION_DAYS` (365), null the key, set `screenshotPurgedAt`, **leave the TopUp row
intact**.
*Accept:* the row and its reference survive; re-running purges nothing twice.

**Stage 4 total: ~11 hours.**

---

# STAGE 5 👤🤖 — Go live

- [ ] **👤 S5-1 · Seed the three plans** through `/admin/plans` and upload the QR files from S3-2.
- [ ] **👤 S5-2 · Buy a pass from yourself.** Real money, second phone, full path: pick → scan →
  pay → submit reference → approve in `/admin` → confirm `accessUntil` moved and the email arrived
  and does not say "receipt". **This is the only test that counts.**
- [ ] **👤 S5-3 · Test the ugly paths too** — a duplicate reference, a rejection, a resubmission
  after rejection, and a double-click on Approve.
- [ ] **👤 S5-4 · Replace the beta banner** with the real pricing date and honour the 50%-off first
  pass for beta users.
- [ ] **🤖 S5-5 · Tick the boxes** in `DEVELOPMENT_PLAN.md` §12 and fold this plan's decisions back
  into §6.10 so the plan and the code agree again.
- [ ] **👤 S5-6 · Set the calendar reminder** — check `/admin/topups` every morning. The 24-hour
  promise is on your own status line, and breaking it silently is worse than the delay itself.

---

## Handing a task to an agent

Each 🤖 task above is already in the shape `AGENTS.md` §11 expects. Paste it as-is plus:

> Read `AGENTS.md` and `ACCESS_BILLING_PLAN.md` first. Work only task **A4**. State the files you
> intend to touch before you start. Finish with the `AGENTS.md` §8 checklist, run it honestly, and
> report in the §9 format. One task, one commit.

Three rules worth restating to any agent that touches this area, because each is a rule it will be
tempted to break:

1. **Never meter quotations.** No daily or monthly counter, ever (`AGENTS.md` §5).
2. **An expired user never loses read access** to their quotes, clients, PDFs or export.
3. **Nothing in this flow is called an invoice or a receipt** (`AGENTS.md` §3).

---

## Time budget

| Stage | Who | Effort |
|---|---|---|
| 1 · Trial + rails | 🤖 | ~10 h |
| 2 · Run it, Gate 3 | 👤 | ~1 h + 2–4 weeks elapsed |
| 3 · GCash prep | 👤 | ~2 h |
| 4 · Payment plumbing | 🤖 | ~11 h |
| 5 · Go live | 👤🤖 | ~2 h |

**~21 agent-hours and ~5 of yours** — but only ~10 agent-hours before you find out whether the
other 11 are worth building.

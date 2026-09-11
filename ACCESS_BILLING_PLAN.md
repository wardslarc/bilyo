# Bilyo — Access & Payment Plan (GCash)

**Status:** design, approved decisions marked ✅ · **Date:** 10 Sep 2026 · **Owner:** Carls Dale Escalo

Companion to `DEVELOPMENT_PLAN.md`. This document specifies §6.10 (Access model) in full and
replaces the sketch in P7. Where the two disagree, this file wins on the access and payment design;
`AGENTS.md` §3 still outranks everything.

**Nothing in this document creates an invoice, a receipt, or a tax figure.** See §9.

---

## 1. Decisions

| # | Decision | Status |
|---|---|---|
| D1 | Free tier is a **14-day full-access trial**, not a quota | ✅ approved |
| D2 | The 10-quotations/day cap is **dropped**. Quotations are never metered | ✅ approved |
| D3 | Ladder: **₱200 / 30d · ₱500 / 90d · ₱1,700 / 365d** | ✅ approved |
| D4 | Trial expiry wall doubles as a **willingness-to-pay survey** | ✅ approved |
| D5 | Prices, day counts and QR images are **DB rows editable from `/admin`**, not constants | proposed |
| D6 | Payment is **manual GCash**: per-plan QR → reference + screenshot → operator approves | proposed |

---

## 2. Pricing — evaluation

### 2.1 The ladder as you first proposed it was broken

| Pass | Price | Per day | vs monthly |
|---|---|---|---|
| 30 days | ₱200 | ₱6.67 | — |
| 90 days | ₱500 | ₱5.56 | −17% |
| 365 days | **₱2,400** | **₱6.58** | **−1.4%** |

The year was **strictly dominated**: four 90-day passes cost ₱2,000 and cover 360 days — ₱400 less
than the annual for one fewer working week. A user who does the arithmetic never buys the year, and
the year is the pass you most want sold, because it is cash upfront and it collapses your manual
approval work by 12×.

### 2.2 Approved ladder

| Pass | Code | Price | Days | Per day | Discount | You approve |
|---|---|---|---|---|---|---|
| 30-Day Access | `D30` | ₱200 | 30 | ₱6.67 | — | 12×/year |
| 90-Day Access | `D90` | ₱500 | 90 | ₱5.56 | −17% | 4×/year |
| 1-Year Access | `Y1` | **₱1,700** | 365 | ₱4.66 | **−30%** | 1×/year |

Now monotonic: ₱6.67 → ₱5.56 → ₱4.66. The year beats stacking quarterlies by ₱300 (15%), so the
ladder finally rewards the commitment you actually want. ₱1,700 is 8.5 months' price for 12 months —
the standard SaaS annual anchor.

### 2.3 Is ₱200/month feasible?

**Yes, with one caveat that is about labour, not price.**

₱200/month is ~US$3.50 — very low for a B2B tool, and deliberately so. PH MSME willingness to pay
for software is genuinely low, you have no card rails, and the buyer is a solo operator deciding
against "I'll just keep using Word." Undershooting on the first ladder is the cheap mistake; you can
raise prices later and grandfather beta users. Starting at ₱500/month and hearing silence teaches
you nothing, because you can't tell refusal from indifference.

The constraint that actually binds is **operator minutes per peso**. At ~3 minutes to match a
reference against your GCash history and approve:

| Payers | Mix (mo/qtr/yr) | Revenue/month | Approvals/month | Your time |
|---|---|---|---|---|
| 50 | 60/30/10 | ₱9,200 | ~36 | ~1.8 h/mo |
| 100 | 60/30/10 | ₱18,400 | ~71 | ~3.5 h/mo |
| 200 | 60/30/10 | ₱36,800 | ~142 | ~7 h/mo |
| 200 | 20/30/50 | ₱35,800 | ~78 | ~4 h/mo |

`DEVELOPMENT_PLAN` §6.10 puts the manual break point at 20–30 top-ups/week — that is **80–130 per
month**, so manual approval holds to roughly **150–200 payers**, or ~₱35,000/month. That is a long
way from where you are and a good problem to have. Note the last row: shifting the mix toward annual
buys you almost as much headroom as automating does. Another reason ₱1,700 matters.

### 2.4 Two external ceilings to know about

- **A fully verified *personal* GCash wallet caps at ₱100,000** (upgradeable to ₱500,000 for
  accounts meeting extra criteria). At ₱18,400/month you are at ~18% — fine for a long time, but
  cash out regularly rather than letting a balance accumulate against the cap.
- **GCash for Business** Tier 1 is aimed at small business owners and lifts the monthly wallet
  ceiling to ₱5,000,000. §6.10 already says to use a business account rather than a personal one.
  Confirm what Tier 1 actually requires before you rely on it — you have **no registered entity yet**
  (`/areas/invoiceflow-ph` and your legal pages both say the contracting party is you as an
  individual), and the business tiers above Tier 1 explicitly want government registration.

**Not legal or tax advice, and I'm not a lawyer:** taking recurring payment for software as an
unregistered individual has DTI/BIR implications that are separate from anything Bilyo does as a
product. Worth a real answer before go-live, not before the design is settled.

---

## 3. Free tier — the 14-day trial (D1, D2)

### 3.1 Why the daily cap was dropped

Three reasons, in order of weight:

1. **It doesn't bind.** Your buyer — aircon servicing, printing, catering, event styling, a
   construction sub — sends 10–30 quotations *a month*. A 10/day ceiling is 300/month. No free user
   would ever touch it, so it creates exactly zero purchase pressure while costing you a counter, a
   Manila-midnight reset, and enforcement code on the create path.
2. **The one user it does catch is your best customer**, throttled on their busiest day. That is the
   worst possible moment to introduce friction.
3. **It contradicts your own hard rules** — `AGENTS.md` §5 ("❌ Meter quotations, count them against
   a quota") and §6.10 ("Not credits. Quotes are never metered"). Those rules exist for a stated
   reason: metering teaches users to ration and route only big clients through Bilyo, which empties
   the dashboard, which is the product.

**No counter is built. `quotationsToday` does not exist. The metering rule stands unamended.**

### 3.2 What replaces it

`accessUntil = signup + 14 days`. That is the entire mechanism — the same nullable field, the same
one comparison, the same expiry state P5/P7 already specify. Nothing new is built to gate the free
tier; the trial *is* the access model with a different starting value.

```
signup ──► accessUntil = now + 14d
           │
           ├─ inside window ──► TRIAL     — everything unlimited
           │
           └─ past window   ──► EXPIRED_TRIAL
                                 blocked:  create quotation, send quotation
                                 open:     read every quote, client list, PDF, export
                                           — forever, per §6.10
```

Fourteen days is chosen against Gate 1: ten real sent quotes two weeks after deploy. The trial and
the validation gate measure the same fortnight, so a trial that converts and a gate that passes are
the same event.

### 3.3 `accessState()` — revised

P5-T01 specifies a pure, synchronous `accessState(user)`. It stays pure and synchronous. It gains
one field on `users` and two statuses:

```ts
// models/user.ts — additions
accessUntil: Date | null   // P5-T01, unchanged
firstPaidAt: Date | null   // NEW — set once, on the first approved top-up

// lib/access.ts
type AccessStatus =
  | 'BETA'            // accessUntil === null   — beta accounts, unlimited, no expiry
  | 'TRIAL'           // in window,  firstPaidAt === null
  | 'ACTIVE'          // in window,  firstPaidAt !== null
  | 'EXPIRED_TRIAL'   // past window, firstPaidAt === null
  | 'EXPIRED_PAID';   // past window, firstPaidAt !== null

accessState(user): { status, accessUntil, daysLeft }
```

`firstPaidAt` is stored rather than derived so the function needs no DB read. The trial/paid split
matters because **the two expiry walls say different things**: a trial user is being asked to buy
for the first time, a lapsed payer is being asked to renew. Same block, different copy, different
instrument (§3.4).

Existing beta accounts keep `accessUntil = null` and are untouched. The trial applies to signups
after the switch — one migration decision, called out in §10.

### 3.4 The trial wall as a willingness-to-pay instrument (D4)

Your addition, and the most valuable thing in this document. When `EXPIRED_TRIAL` blocks a create or
send, the wall shows the three passes **and one question**:

> **Your 14 days are up.**
> You sent **7 quotations** and **3 were accepted** — ₱48,500 in confirmed work.
> Bilyo Access keeps you sending. Pick a pass below.
>
> — or —
>
> **Not ready to pay?** Tell us honestly, it helps more than silence:
> ○ I'd pay, but not at this price → *what would you pay?* `[____]`
> ○ I'd pay, just not right now
> ○ I wouldn't pay for this → *what's missing?* `[__________]`

Every answer is recorded whether or not they buy, alongside their actual usage
(`quotationsSent`, `quotationsAccepted`, `acceptedValueCentavos`) at the moment they answered. That
join is the point: "would you pay?" from someone who sent nine quotes and closed four is evidence;
the same answer from someone who sent zero is noise, and you can now tell them apart.

This is a better Gate 3 instrument than the P5-T03 "Notify me" button, because it asks people who
have used the product rather than people who have read a pricing page. Keep both — same collection,
different `source`.

```
interests
  _id, userId?, email, source: 'PRICING_NOTIFY' | 'TRIAL_WALL',
  passType?: 'D30'|'D90'|'Y1',
  answer?: 'WOULD_PAY_LOWER' | 'NOT_NOW' | 'WOULD_NOT_PAY',
  suggestedPriceCentavos?, comment?,
  usageSnapshot: { quotationsSent, quotationsAccepted, acceptedValueCentavos },
  createdAt
Index: { userId, source } unique-ish — one answer per user per source, editable
```

**Gate 3 reads:** of users who finished a trial having sent ≥3 quotations, what share bought within
14 days, and what did the non-buyers say. That number decides whether P7 enforcement ships.

---

## 4. Backend-controlled plans (D5)

You want to change prices without a deploy. P7-T01 currently puts them in
`lib/access/passes.ts` as constants. Replace that with a collection.

### 4.1 `accessPlans` — new

```
_id
code           'D30' | 'D90' | 'Y1'        unique
name           '30-Day Access'
days           30
priceCentavos  20000                        integer centavos, §4.2
currency       'PHP'                        fixed — GCash is peso-only
qrBlobKey      'plans/d30-qr-v2.png'        private blob key, not a URL
gcashName      'CARLS DALE E.'              the name payers will see, so they can sanity-check
gcashNumber    '0917•••1234'                display-masked; full value in env, never in the DB
isActive       true
sortOrder      1
updatedAt, updatedByUserId
```

**Currency note.** Quotations are multi-currency (a business picks PHP/USD/EUR/… and each quotation
snapshots its own). **Access plans are not.** GCash settles in pesos; `currency` is `'PHP'` and the
field exists only so the money helpers don't special-case it.

### 4.2 The rule that makes editable prices safe

> **A top-up snapshots `planCode`, `priceCentavos` and `days` at submission time.**
> Changing an `accessPlan` row never alters a pending or an approved top-up.

This is the same rule as `businessSnapshot` / `customerSnapshot` in `AGENTS.md` §4.11, for the same
reason: a record of what someone agreed to must not move under them. Without it, editing D90 from
₱500 to ₱600 would silently re-price every pending submission and make your approval queue disagree
with your GCash history.

Corollary: **never edit a plan's price to run a promotion.** Deactivate and create a new row, or the
audit trail loses the ability to say what a given month's price was.

### 4.3 `/admin/plans` — new admin surface

Behind `requireAdmin()`, 404 for non-admins, every write appends `AdminAuditLog` — the §4.9 rules
apply unchanged. Operations: edit price/days/name, upload or replace a QR image, activate/deactivate,
reorder. Deleting a plan is not offered; deactivate instead, because approved top-ups reference it.

A price change writes `PLAN_PRICE_CHANGE` with before and after values. When you later ask "why did
March look odd," this is the row that answers.

---

## 5. The payment flow (D6)

### 5.1 Sequence

```
USER                          BILYO                          YOU (operator)
 │                              │                                  │
 │ /dashboard/access            │                                  │
 │─────────────────────────────►│ reads accessPlans (isActive)     │
 │                              │                                  │
 │ picks 90-Day Access          │                                  │
 │─────────────────────────────►│ creates TopUp: DRAFT             │
 │                              │ snapshots code/price/days        │
 │◄─────────────────────────────│ shows QR (₱500 baked in),        │
 │   QR + exact amount +        │ GCash name, exact amount,        │
 │   "pay, then come back"      │ signed 30-min blob URL           │
 │                              │                                  │
 │ pays in GCash app            │                                  │
 │ (outside Bilyo entirely)     │                                  │
 │                              │                                  │
 │ enters reference no.         │                                  │
 │ + uploads screenshot         │                                  │
 │─────────────────────────────►│ normalize ref → unique check     │
 │                              │ scan MIME, cap 5 MB, private blob│
 │                              │ TopUp: DRAFT → PENDING           │
 │                              │ recordEvent(TOPUP_SUBMITTED)     │
 │                              │                                  │
 │◄─────────────────────────────│ "Pending — access added          │
 │                              │  within 24 hours"                │
 │                              │                                  │
 │                              │ email → support@bilyoapp.com ───►│  ping
 │                              │ /admin badge count +1            │
 │                              │                                  │
 │                              │◄─── opens /admin/topups          │
 │                              │     checks ref in GCash app ◄────│  ⚠ §5.5
 │                              │◄─── Approve                      │
 │                              │                                  │
 │                              │ accessUntil = max(now, accessUntil) + days
 │                              │ firstPaidAt ??= now              │
 │                              │ TopUp → APPROVED                 │
 │                              │ AdminAuditLog(TOPUP_APPROVE)     │
 │                              │ recordEvent(TOPUP_APPROVED)      │
 │                              │                                  │
 │◄─────────────────────────────│ email: "Access until 9 Dec 2026" │
 │                              │        (NOT called a receipt §9) │
```

### 5.2 State machine

```
        submit ref          approve
DRAFT ──────────────► PENDING ──────────► APPROVED  (terminal)
  │                     │
  │ abandon             │ reject(note)
  ▼                     ▼
DISCARDED           REJECTED ──── user corrects ──► new PENDING row
                                  (old ref released)
```

- `DRAFT` exists so the QR view has a row to attach to and you can see abandonment — how many people
  reach the QR and never pay is your single best funnel number.
- **`APPROVED` is terminal and idempotent.** Re-clicking Approve is a no-op returning the same
  result, never a second grant of days. Guard on a conditional update
  (`updateOne({_id, status:'PENDING'}, {$set:{status:'APPROVED'}})`) and act only if `modifiedCount === 1`.
- There is no un-approve. A mistaken grant is corrected by a compensating admin action with its own
  audit row, not by rewinding this one.

### 5.3 Reference numbers — two bugs to avoid

**Bug 1 — normalization.** `gcashReference` carries a unique index (§7). Without normalization,
`"0091 2345 6789"` and `"009123456789"` both insert cleanly and you approve the same payment twice.
Normalize before insert and store both:

```ts
referenceRaw:        '0091 2345 6789'   // what they typed, for display
referenceNormalized: '009123456789'     // uppercase, strip all non-alphanumerics
```

Unique index on `referenceNormalized`.

**Bug 2 — the rejected reference is stuck.** A plain unique index means a user who typo'd their
reference can never resubmit the corrected one if the rejected row still holds a value — and worse,
a user whose *correct* reference was rejected in error is permanently locked out of that payment.
Use a **partial unique index** so only live rows compete:

```js
{ referenceNormalized: 1 },
{ unique: true, partialFilterExpression: { status: { $in: ['PENDING', 'APPROVED'] } } }
```

Rejecting releases the reference. Approving locks it forever.

The user-facing error on a duplicate must be a clear *"This reference has already been submitted"* —
not a 500. Catch the E11000 and translate it; the `ActionResult` discriminated union in §6 of
`AGENTS.md` is the shape.

### 5.4 The screenshot — handling and retention

What the user uploads is the GCash **send-money confirmation screen**: the amount, the reference
number, the timestamp, and the recipient — you — with the name and mobile number partially masked.
It is not a balance screen, not a transaction history, and the only party it identifies in full is
the sender, who is your own signed-in user. The exposure is much smaller than a generic
"user-uploaded financial screenshot" implies, and it should be handled as ordinary uploaded media,
not as a sensitive record.

What still applies, because it is upload hygiene rather than a privacy measure:

- **Sniff the bytes, don't trust the extension.** Accept `image/jpeg`, `image/png`, `image/webp`
  only, verified by magic number. Cap at 5 MB. Reject PDFs — people will try. An endpoint that
  trusts the extension is a hole regardless of how innocuous the file is.
- **Private blob, not a public URL.** Not because the contents are secret, but because a
  guessable public URL per payment is a needless enumeration surface. `lib/blob.ts` already exists;
  store the key and serve it to `/admin` through a short-lived signed URL generated inside
  `requireAdmin()`.
- **Strip EXIF anyway.** Near-pointless for a true screenshot, but people photograph their screens
  with another phone, and it is one line in the same pipeline.

What I had wrong and am dropping:

- ~~Auto-purge at 90 days.~~ **Retain for 12 months instead.** The purge was justified by holding
  sensitive data; without that justification, the image is simply your fastest way back into a
  dispute half a year later, and it costs cents to keep. Purging still happens — just late, and as
  a housekeeping job rather than a privacy obligation.
- ~~A separate `AdminAuditLog` row for viewing the image.~~ §4.9 already appends an audit row when
  you view an identified user's data, which the top-up view is. A second row on the image adds
  noise to the log without adding accountability.

**Revised recommendation: keep the upload required.** My earlier argument for making it optional was
"hold less sensitive data," and that argument doesn't survive your correction. What remains is that
the screenshot is genuinely *useful to you* — amount, reference and timestamp in one glance, so you
can find the row in your GCash history in seconds instead of scrolling. That is worth one tap at
checkout.

One caveat: **never let an upload failure block the submission.** If the blob write fails, take the
reference number and record the top-up anyway with `screenshotBlobKey` null. Someone who has already
sent you money must always be able to finish telling you so.

### 5.5 ⚠ The screenshot is not proof of payment

A screenshot is trivially faked — a phone screenshot is a picture, and there are apps whose entire
purpose is producing convincing fake GCash confirmations. Philippine sari-sari stores get hit with
this weekly. The fact that the confirmation screen is a simple, standard, partially-masked layout
(§5.4) makes it *easier* to forge convincingly, not harder — there is very little on it that a
faker could get wrong.

**The only source of truth is your GCash transaction history.** The approval screen must therefore
present the reference, the exact amount, and the submission timestamp as *things to look up*, and the
Approve button must be the last step of a check you performed in the GCash app — never a reaction to
the image. Word the UI so it stays true a year from now when you're approving on autopilot:

> Matched in GCash?  ☐ I verified reference `00912345678` for ₱500.00 in my GCash history
> `[ Approve — adds 90 days ]`  (disabled until ticked)

A checkbox you can tick without looking is still a checkbox you'll skip. But it reliably slows the
one click that costs you money, and it puts your attestation in the audit row.

### 5.6 Amount matching

Bake the exact amount into each plan's QR. A QR Ph code can carry a fixed amount, which removes the
single largest source of reconciliation pain: someone typing ₱50 for a ₱500 pass. If your QR can't
carry an amount, display the amount enormous and unmissable next to it, and add an
`amountPaidCentavos` field to the approval screen so a short payment is recorded as
`REJECTED — underpaid ₱450` rather than silently approved.

Partial payments are refused, not part-credited. Time-based access has no partial state, and
inventing one recreates the ledger §6.10 exists to avoid.

### 5.7 Notification (the "notify me on each sale" piece)

Do not build a new channel. You already have a verified Resend domain and a working mailer:

- **Email to `support@bilyoapp.com`** from the same transport, subject
  `[Bilyo] Top-up ₱500 · 90-Day · pending` with reference, user email, amount, and a deep link to
  `/admin/topups/<id>`. Send **after** the write, failure-tolerant — a dead mailer must never roll
  back a submission, exactly as P6-T03 handles acceptances.
- **A badge count on `/admin`** showing pending top-ups, because email fails and you check the
  dashboard anyway.
- **A daily digest at 09:00 Manila** if any top-up has been pending >12 hours. This is what actually
  protects the 24-hour promise on your own status line; a single notification at submission time
  fails the moment you're asleep or on the road.

Push/Telegram is a nice upgrade later. Email plus badge is enough for 3–5 approvals a day, and it
adds no new dependency (`AGENTS.md` §5).

---

## 6. Data model — full delta

```
users            + firstPaidAt: Date | null          ← NEW
                 (accessUntil already planned in P5-T01)

accessPlans      NEW — §4.1

topUps           REVISED from DEVELOPMENT_PLAN §7:
  _id, userId,
  planCode: 'D30'|'D90'|'Y1',            ┐
  amountCentavos,                        ├ snapshotted at submit, §4.2
  daysGranted,                           ┘
  referenceRaw, referenceNormalized (partial-unique, §5.3),
  amountPaidCentavos?,                    ← operator-entered on mismatch
  screenshotBlobKey?, screenshotPurgedAt?,   ← purge at 12 months, §5.4
  status: 'DRAFT'|'PENDING'|'APPROVED'|'REJECTED'|'DISCARDED',
  submittedAt, reviewedAt, reviewedByUserId, reviewNote,
  accessUntilBefore, accessUntilAfter     ← NEW, makes disputes answerable

interests        NEW/EXTENDED — §3.4

events           + TOPUP_SUBMITTED, TOPUP_APPROVED, TOPUP_REJECTED
adminAuditLogs   + TOPUP_APPROVE, TOPUP_REJECT, PLAN_PRICE_CHANGE,
                   PLAN_QR_REPLACE, TOPUP_SCREENSHOT_VIEW
```

`accessUntilBefore` / `accessUntilAfter` cost two fields and answer the only support question this
flow ever generates — "I paid but my date didn't change" — without reading logs.

---

## 7. Failure modes

| # | What happens | Handling |
|---|---|---|
| 1 | Pays, never returns to enter the reference | `DRAFT` row is visible in `/admin`; email nudge at 24 h. Your most common failure — the QR screen must say "come back and enter your reference" twice |
| 2 | Enters a reference for a payment never made | Fails your GCash check → `REJECTED` with note. Reference released (§5.3) |
| 3 | Enters someone else's real reference | Same check catches it — the amount or timestamp won't match this user's submission. Repeat offenders: suspend |
| 4 | Underpays | `REJECTED — underpaid`, `amountPaidCentavos` recorded, user told the exact shortfall and asked to pay the difference as a fresh top-up |
| 5 | Overpays | Approve the pass; refund the difference manually. Never auto-credit extra days — that's a ledger |
| 6 | Duplicate reference submitted twice | Partial unique index rejects at the database, translated to a readable error (§5.3) |
| 7 | You double-click Approve | Conditional update, `modifiedCount === 1` guard (§5.2). Days granted once |
| 8 | You approve the wrong row | Compensating action with its own audit row. `accessUntilBefore` tells you exactly what to restore |
| 9 | Refund requested | Your stated policy: full refund within 7 days of activating a pass if no quotation was sent on it, none after. Enforceable directly — `quotationsSentSince(accessUntilBefore)` |
| 10 | You're unreachable for 3 days | Daily digest (§5.7) plus, if pending >48 h, an apology email to the user. The 24-hour promise is on your own screen; breaking it silently is worse than the delay |
| 11 | Access expires mid-quotation-draft | Draft is saved, send is blocked, wall shown. Never discard work at the gate |

---

## 8. Trade-off analysis

**Manual approval vs. a payment gateway.** Manual costs ~3 minutes per sale, delays access up to
24 hours, and breaks at ~150–200 payers. It also costs ₱0 in fees, needs no registered entity, and
ships in a weekend. At your stage the delay is the lesser problem — but it is a *conversion* problem
too, and worth measuring: track submit→approve latency and the share of `DRAFT` rows that never
become `PENDING`. When either number gets ugly, that's the automation signal, not a revenue
threshold.

**Prices in the DB vs. in code.** DB rows let you change prices without a deploy — what you asked
for — at the cost of a new admin surface, an audit obligation, and the snapshot rule in §4.2 to keep
history honest. Worth it: pricing is the variable you will iterate most, and a deploy per experiment
is a tax on the thing you most need to learn.

**One QR vs. per-plan QRs.** Per-plan with a baked amount removes the wrong-amount failure mode
entirely and costs three image uploads. Clear win.

**14-day trial vs. free-forever with branding.** A trial creates a real deadline and a real
conversion moment; free-forever-with-branding creates distribution but almost no urgency. The trial
is right for Gate 3, because a gate needs people to actually decide. Revisit if trial-end conversion
comes in under ~10% *and* the survey says the product is wanted but the deadline felt hostile.

### What I'd revisit as this grows

| Trigger | Change |
|---|---|
| >20 top-ups/week sustained | PayMongo or Xendit for auto-confirmation. Needs the registered entity |
| Trial conversion <10% at Gate 3 | The problem is the product or the price, not the flow. Read the §3.4 survey before touching either |
| Annual buyers >30% of revenue | Add a 2-year pass; your approval labour is already the scarce resource |
| A dispute lands past the retention window | Extend `SCREENSHOT_RETENTION_DAYS` before ever shortening it — the image is cheap and it is your fastest way back into an old payment |
| Approving on autopilot, mismatch slips through | Auto-match against a CSV export of GCash history instead of eyeballing |

---

## 9. §3 compliance check

The hard constraints in `AGENTS.md` §3 apply to this flow and are satisfied:

- **No document produced by this flow is called an Invoice, Official Receipt, or Statement of
  Account.** The post-approval email is titled **"Your Bilyo Access is active"** and states the pass,
  the amount, the reference, and the new access date. It must **not** be titled *Receipt*,
  *Payment Receipt*, or *Official Receipt* — that word is exactly what §3 forbids, and this is the
  one place in the app where it would feel natural to reach for it. Flagging it now because it is a
  one-word slip away.
- **No VAT line** anywhere in the pricing page, the QR screen, or the confirmation email. Prices are
  stated as flat peso amounts.
- **No sequential serial numbering** on top-ups. `_id` is an ObjectId and is never displayed as a
  document number.
- **Quotations remain unmetered** (§3.1) — the metering rule in §5 of `AGENTS.md` stands.
- Admin remains read-only over user content: approving a top-up writes `users.accessUntil` and
  `users.firstPaidAt`, which are **access fields, not user content** — the same class as suspend.
  It does not touch a quotation, a client, or a line item.

---

## 10. Milestone changes

> **Sequencing and the human/agent split live in `ACCESS_ROLLOUT_PLAN.md`.** One correction made
> there: enforcement moves out of P7 and into the trial stage — a trial that never blocks anything
> is not a trial, and the §3.4 survey behind it never fires.

### P5 (ships with P4, still mostly dormant)

- **P5-T01 · revised** — `accessState()` gains `firstPaidAt` and the five statuses in §3.3. Still
  pure, still synchronous, still blocks nothing.
- **P5-T03 · revised** — the `interests` collection takes the §3.4 shape now, so the trial wall can
  reuse it without a migration.
- **P5-T04 · NEW (1h)** — trial assignment behind `TRIAL_ENABLED`. New signups get
  `accessUntil = now + TRIAL_DAYS` (env, default 14). Existing accounts keep `null`. Off by default.

### P7 (blocked by Gate 3, unchanged)

- **P7-T01 · revised** — `accessPlans` collection + `TopUp` model with the §6 fields, partial unique
  index, normalization helper. Seed the three plans. `lib/access/passes.ts` becomes a reader, not a
  source of truth.
- **P7-T01b · NEW (2h)** — `/admin/plans`: edit price/days/name, upload QR, activate/deactivate.
  `requireAdmin()`, audited, 404 for non-admins.
- **P7-T02 · revised** — DRAFT→PENDING submission, QR display with signed URL, reference
  normalization, required screenshot with the §5.4 handling — and a submit path that still succeeds
  if the upload fails.
- **P7-T03 · revised** — approval queue with the §5.5 verification checkbox, conditional-update
  idempotency, `accessUntilBefore/After`, reject-with-note releasing the reference.
- **P7-T03b · NEW (1h)** — operator notification: submission email, `/admin` badge, 09:00 Manila
  stale-pending digest.
- **P7-T04 · revised** — enforcement covers `EXPIRED_TRIAL` and `EXPIRED_PAID` identically (create
  and send blocked; read, PDF, export open forever). Behind `ACCESS_ENFORCED`.
- **P7-T06 · NEW (1.5h)** — the trial wall + willingness-to-pay survey (§3.4). **Ship this one
  early, with P5** — it is the Gate 3 instrument, and it is worthless collected after you've already
  decided.

### Environment

```
TRIAL_ENABLED=false
TRIAL_DAYS=14
ACCESS_ENFORCED=false
GCASH_ACCOUNT_NAME=
GCASH_ACCOUNT_NUMBER=          # full value; the DB stores only a masked display string
TOPUP_NOTIFY_EMAIL=support@bilyoapp.com
SCREENSHOT_RETENTION_DAYS=365
```

---

## 11. Open questions for you

1. **Migration:** do existing beta accounts get a trial when enforcement turns on, or stay `null`
   forever as a thank-you? §6.10 already promises them 50% off their first pass — grandfathering
   them entirely may be cheaper than it looks and buys goodwill from your first ten users.
2. ~~Screenshot: required or optional?~~ **Settled — required.** The confirmation screen is masked
   and low-exposure (§5.4), so the privacy argument for skipping it doesn't hold, and it saves you
   real time at the approval step. Retention moves to 12 months.
3. **GCash account type** — personal now and migrate later, or wait for registration? Affects the
   ₱100k ceiling and what name payers see on the QR.
4. **Business registration** before charging (§2.4). Not a design question, but it gates P7-T05.

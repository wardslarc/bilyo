# Bilyo Web App — Development Plan

> **Status:** v3.0 · Living document. Agents tick checkboxes here as tasks complete.
> **Read with:** `AGENTS.md` (rules of engagement — *how*) and `GEMINI.md`.
> **This file wins on *what* to build. `AGENTS.md` wins on *how*.**
>
> ### v3.0 — the pivot, in one paragraph
>
> Bilyo is no longer an invoicing app. It is a **quotation app that turns quotations into confirmed
> sales**. Invoices, official-receipt semantics, VAT lines, TIN fields and the product catalogue are
> removed from the product — not hidden, removed — because generating anything that reads as a tax
> document is the single legal risk this project cannot carry. What replaces them is small: a public
> quote link the client can **accept or decline**, an event trail, and a dashboard that answers one
> question. Monetisation changes from PayMongo subscriptions to **prepaid time-based access** with
> manual GCash top-ups. Mandatory TOTP becomes optional. Everything is gated behind **validation
> gates** (§13) so the build stops and talks to users instead of growing.
>
> **What v3.0 deletes from v2.2:** M4 (invoices), M8 (plan limits), M9 (PayMongo monetisation), §5.2
> (VAT), §17 (PayMongo checklist), the products surface, and the mandatory-MFA gate.
> **What v3.0 keeps:** the monolith, MongoDB + Mongoose, centavos, `userId` scoping, the public-token
> projection, the admin console, the PDF pipeline, and every domain rule that still applies.
> **What v3.0 adds:** §2 hard constraints, the `VIEWED` status, the `Event` collection, accept /
> decline, the four-number dashboard, the access model (§6.10), and validation gates (§13).
>
> **Milestone IDs restart at `P` (pivot).** The old `M0`–`M10` IDs are history, recorded in §12.0.
> Do not create new `M` tasks.

---

## 1. Product

**Bilyo** — a self-serve web app where a Philippine service business sends a quotation as a link,
the client accepts or declines it on their phone, and the owner sees what they quoted and what
closed.

**Positioning:** Bilyo turns quotations into confirmed sales for Philippine service businesses.
**Not:** an invoicing app, an accounting system, or a BIR compliance tool.
**Status:** free public beta. Paid access begins on an announced date.

### 1.1 The one-line test

> If a user cannot answer *"how much have I quoted this month, and how much of it was accepted?"*
> faster in Bilyo than in their current setup, the product has failed.

Every scope decision in this document serves that sentence. A feature that does not is out, however
good it is. When a task feels ambiguous, resolve it toward that sentence.

### 1.2 Non-goals (v1)

- **No invoices, receipts, statements of account, or anything that reads as one.** See §2. This is a
  legal boundary, not a roadmap position.
- No accounting, bookkeeping, BIR e-filing, or CAS accreditation claims.
- No payment processing. "Mark as paid" is a manual toggle, not a payment rail.
- No automated client-chasing reminders, contracts, e-signature, or time tracking.
- No teams or multi-user businesses. One user = one business.
- No product catalogue, expense tracking, custom branding beyond a logo, or mobile app.
- No admin impersonation.
- No Express server, no separate API service, no monorepo.

Several of these are good ideas. They are v2 ideas (§14). Adding one to v1 delays the only thing
that matters now, which is finding out whether anyone sends quotes through Bilyo at all.

---

## 2. Hard constraints (non-negotiable)

These are legal boundaries, not preferences. They are duplicated verbatim in `AGENTS.md` §3 so a
coding agent that never opens this file still cannot drift past them.

### 2.1 Never build

- Any document labeled **Invoice, Sales Invoice, Billing Invoice, Service Invoice, Official Receipt,
  Statement of Account, or Billing Statement**.
- Sequential serial numbering that resembles a BIR-registered series.
- Any claim, in UI or marketing, that Bilyo is "BIR-compliant", "BIR-ready", or "BIR-registered".
- VAT computation presented as a tax filing figure.

### 2.2 Quotation numbering

Use a visibly non-tax format: **`Q-2026-0012`** — a `Q`, the calendar year, and a per-user sequence
that resets each year. It is a reference for the user's own tracking, nothing more. See §6.3.

### 2.3 Required footer

Every quotation view — the owner's detail page, the public page, and the PDF — carries this line
verbatim:

> This is a quotation, not a tax document. It is not an invoice or official receipt.

It lives in exactly one constant (`lib/documents.ts → QUOTATION_FOOTER`) and is rendered from there
in all three places. A second copy of this string anywhere is a bug.

### 2.4 Agent instruction, stated in the negative

When asked to improve billing, payments, or documents, **do not add invoice generation**. If a task
appears to require an invoice, an official receipt, or a tax figure — stop and flag it to the human
rather than implement it. There is no version of "just a simple invoice PDF" that is acceptable here.

---

## 3. Actors and surfaces

Three surfaces. Every route, action and query belongs to one, and the security rule differs per
surface. Getting this wrong is the only mistake in this project that can leak one user's data to
another.

| # | Surface | Who | Entry | Auth check | Query scoping rule |
|---|---|---|---|---|---|
| 1 | **User app** | The service business owner | `/dashboard/*` | signed-in session (password; TOTP optional) | **Every query filtered by `userId` from the session.** No exceptions. |
| 2 | **Public quote page** | The user's *client* — never signed in | `/q/[code]` | none | Lookup **by `publicCode` only**, hand-written minimal projection. Can write exactly one thing: an accept/decline response. |
| 3 | **Platform admin** | You / Bilyo staff | `/admin/*` | session **+ role ADMIN + email in `ADMIN_EMAILS`** | Deliberately **cross-user**. Allowed *only* inside `actions/admin/**` and `lib/admin/**`, only through `requireAdmin()`, every access audited. |

### 3.1 Permissions matrix

| Capability | User (own data) | Admin | Public visitor |
|---|---|---|---|
| Create / edit / send a quotation | ✅ | ❌ | ❌ |
| View a quotation | ✅ own | ✅ read-only, audited | ✅ by code only |
| **Accept or decline a quotation** | ❌ | ❌ | ✅ **once**, by code |
| Mark a quotation paid | ✅ | ❌ | ❌ |
| Create / edit a client | ✅ | ❌ | ❌ |
| Revoke a public link | ✅ | ✅ audited | ❌ |
| Suspend an account | ❌ | ✅ audited | ❌ |
| Approve a top-up | ❌ | ✅ audited | ❌ |
| Grant access days | ❌ | ✅ audited, via top-up approval only | ❌ |

The public visitor's single write capability is new in v3.0 and is the whole product. It gets its
own rules in §6.7.

---

## 4. Architecture principle: monolith

One repo, one deployable, one database. Next.js App Router, Server Components by default, Server
Actions for mutations, Route Handlers only for auth, PDF streams, public reads and webhooks.

This was decided in v1 and the pivot does not reopen it. Do not introduce tRPC, GraphQL, a separate
API service, a monorepo, or a second database.

**On the "Postgres" line in the source plan:** the MVP Plan v2 brief assumed Next.js on Vercel with
hosted Postgres. This repo is already MongoDB + Mongoose with ~50 shipped tasks on top of it. The
data model in §7 is the brief's model expressed as Mongo collections. **Do not migrate to Postgres.**
A database swap buys nothing the one-line test can measure and costs the entire remaining budget.

### 4.1 Directory shape after the pivot

```
bilyo/
├── app/
│   ├── (marketing)/          # landing, pricing
│   ├── (auth)/               # login, register, forgot/reset password, optional MFA challenge
│   ├── (dashboard)/dashboard/
│   │   ├── quotations/  clients/  settings/  account/  access/
│   ├── (admin)/admin/        # users, lookup, audit, metrics, top-ups
│   ├── q/[code]/             # THE public quote page — accept / decline
│   └── api/                  # auth, PDF streams, public reads ONLY
├── components/
│   ├── ui/                   # button, input, dialog, badge — local, small
│   ├── quotations/           # editor, line items, totals, timeline
│   ├── public/               # the public quote page and its response form
│   └── dashboard/
├── lib/
│   ├── mongodb.ts  auth.ts  money.ts  totals.ts  numbering.ts
│   ├── dates.ts    access.ts  events.ts  validation/   pdf/
│   └── admin/                # guard.ts audit.ts metrics.ts — the ONLY cross-user reads
├── models/                   # Mongoose models, one per collection
├── actions/                  # Server Actions, grouped by entity
│   └── admin/                # the ONLY cross-user writes
├── types/
└── DEVELOPMENT_PLAN.md  AGENTS.md  GEMINI.md
```

Directories that disappear in P1: `app/(dashboard)/dashboard/invoices/`,
`app/(dashboard)/dashboard/products/`, `app/i/[token]/`, `app/api/invoices/`, `app/api/public/i/`.

---

## 5. Locked stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) + TypeScript | strict mode on |
| Runtime | Node.js (Vercel serverless) | not Edge — Mongoose needs Node |
| DB | MongoDB Atlas + Mongoose | one cluster, one database. **Not Postgres** — §4 |
| Auth | Auth.js (NextAuth v5), Credentials provider | JWT session strategy; `role` in the token |
| Password hashing | `bcryptjs` | pure JS, serverless-safe |
| MFA / TOTP | `otpauth` + `qrcode` | **kept, now opt-in** — §6.11 |
| Secret encryption | `node:crypto` AES-256-GCM | built in |
| Validation | `zod` | one schema per entity, shared client + server |
| UI | Tailwind CSS + a small local `components/ui` | no heavy component library |
| PDF | `@react-pdf/renderer` | rendered in a Route Handler; **no Puppeteer** |
| File upload (logo) | Vercel Blob | already shipped |
| Payments | **none in v1.** Manual GCash top-up, admin-approved | P7, and only past Gate 3 — §6.10 |
| Email | Resend | P6, not before |
| Deploy | Vercel | preview per branch, one prod env |

Removed from the locked stack in v3.0: PayMongo. Nothing was built against it, so this is a
documentation change only.

Adding anything not on this table requires explicit human approval.

---

## 6. Core domain rules

Product truths. Encode them once in `lib/`, test them, never re-derive them in a component.

### 6.1 Money
- **All money is stored as integer centavos.** Never floats. Field names end in `Centavos`.
- Formatting to `₱1,234.56` happens only at the display/PDF boundary, via `lib/money.ts`.
- Rounding: compute line amounts, sum to a subtotal, apply the discount, round **half-up to the
  nearest centavo** at each stored step.

### 6.2 No VAT, no TIN  ← changed in v3.0
- A quotation has `subtotalCentavos`, `discountCentavos`, `totalCentavos`. **There is no VAT field
  and no VAT line**, anywhere: not in the model, the editor, the PDF, or the public page.
- `business.tin`, `business.vatRegistered` and `client.tin` are removed. A quotation with a TIN on
  it looks like a tax document, and looking like one is the risk.
- If a user asks for VAT, the answer is that Bilyo quotes prices, and they can type a line item
  called "VAT (estimate)" themselves. Bilyo does not compute it.

### 6.3 Quotation numbering  ← changed in v3.0
- Format **`Q-YYYY-NNNN`**, e.g. `Q-2026-0012`. Sequence is **per user, per calendar year**, resets
  to 1 each January in `Asia/Manila`.
- Generated atomically from `counters` via
  `findOneAndUpdate({ userId, kind: 'QUOTATION', year }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' })`.
- Assigned when the quotation is **first saved**, including drafts.
- **Quotations issued under the old `QUO-000001` format keep their numbers.** Never renumber an
  existing document. The format change applies going forward only.

### 6.4 Statuses  ← changed in v3.0
```
Quotation:  DRAFT → SENT → VIEWED → ACCEPTED | DECLINED
                     └──────┴──────→ EXPIRED (derived)
```
- `VIEWED` is **stored**, set the first time the public page is opened. It never moves backward: a
  second view does not re-write it, and an `ACCEPTED` quote does not fall back to `VIEWED`.
- `EXPIRED` is **derived** at read time (`status ∈ {SENT, VIEWED} && validUntil < today`), never
  stored. No cron. An expired quote can still be accepted only if the owner extends `validUntil`.
- `ACCEPTED` and `DECLINED` are terminal. A responded quotation's line items are immutable.
- **Paid is not a status.** `paidAt` and `paidAmountCentavos` are independent fields set by the
  owner's manual toggle (§6.8). A quote can be accepted and unpaid, or accepted and paid. Nothing in
  the product treats "paid" as a document type.

### 6.5 Ownership — the one rule that matters
- Every quotation, client and event belongs to exactly one `userId`.
- **Every user-surface query is scoped by `userId` from the session** — never from the request body
  or URL. The only two exceptions are the public-code read (§6.7) and the admin surface (§6.9), both
  confined to named directories.

### 6.6 Events — the audit trail
- Every meaningful thing that happens to a quotation appends one row to `events`. It costs almost
  nothing now and makes the timeline, the dashboard, the notifications and any future analytics
  trivial. **Do not skip it.**
- Types: `CREATED`, `SENT`, `VIEWED`, `ACCEPTED`, `DECLINED`, `MARKED_PAID`, `UNMARKED_PAID`,
  `LINK_REVOKED`.
- Actors: `OWNER`, `CLIENT`, `ADMIN`, `SYSTEM`.
- Events are **append-only**. There is no update path and no delete path. Writing one is a single
  helper, `lib/events.ts → recordEvent()`, called from inside the action that caused it.
- `VIEWED` is recorded at most once per quotation. Later views do not append.

### 6.7 The public quote link
- Code: random **12-char URL-safe string**, unguessable, stored as `publicCode`, unique-indexed,
  never sequential. Anyone with the link can view and respond — that is the design, so the code is
  the only thing protecting it.
- The route reads **by code only** and returns a hand-written minimal projection: never the owner's
  account email, never internal ids, never another document.
- **The one public write:** an accept or decline, carrying a typed client name and a timestamp. It
  is allowed only when the quote is `SENT` or `VIEWED` and not expired. A second response on the
  same quotation is rejected — the first answer stands.
- The response also stores `respondedByName` (typed by the client), `respondedAt`, and a coarse
  `responseIp` for dispute support. It appends an `ACCEPTED` / `DECLINED` event with
  `actor: 'CLIENT'`.
- The owner can revoke a link (regenerate the code). An admin can revoke it for abuse (audited).
- Public pages are `noindex, nofollow`.
- **This page is opened on a phone, from a Messenger link.** It is the only screen the buyer's
  customer ever sees. Design it first and make it genuinely nice; everything else is admin.

### 6.8 Mark as paid
- A manual toggle on the quote detail page: `paidAt` (timestamp) and an optional
  `paidAmountCentavos`. Defaults to the quote total, editable for partial payments.
- Available only on an `ACCEPTED` quotation.
- Toggling on appends `MARKED_PAID`; toggling off appends `UNMARKED_PAID` and clears both fields.
- It never generates a document, a receipt, or a number. It is a private note to the owner.

### 6.9 Admin boundary
- `/admin/*` is for platform staff, never for users. Guarded by `lib/admin/guard.ts → requireAdmin()`
  which requires **both** `session.user.role === 'ADMIN'` **and** the email in the `ADMIN_EMAILS`
  allowlist. A non-admin gets **404, not 403**.
- Cross-user queries are allowed **only** inside `actions/admin/**` and `lib/admin/**`.
- Admin is **read-only over user content**. The complete list of admin writes: suspend, unsuspend,
  revoke a public code, disable/enable a user's public links, reset a user's MFA, **approve or reject
  a top-up**, and append an audit row.
- Every admin action *and* every view of an identified user's data appends an append-only
  `AdminAuditLog` row.
- `PLAN_OVERRIDE_SET` / `PLAN_OVERRIDE_CLEAR` are replaced by `ACCESS_GRANT` / `TOPUP_APPROVE` /
  `TOPUP_REJECT` in P5/P7. Existing audit rows keep their old action strings — the enum is additive,
  never rewritten.

### 6.10 Access model — Bilyo Access  ← new in v3.0

Prepaid, **time-based**, no recurring charge, no card.

| Pass | Price (example) | Days |
|---|---|---|
| 30-Day Access | ₱199 | 30 |
| 90-Day Access | ₱499 | 90 |
| 1-Year Access | ₱1,499 | 365 |

**Not credits.** Quotes are never metered. Credits would teach users that each quote costs money, so
they would ration and only run big clients through Bilyo — which breaks the dashboard, which is the
whole product. Access buys a window of time; inside it, everything is unlimited.

**Naming.** *Bilyo Access* in the UI. Passes named plainly ("30-Day Access"). The status line reads
"Access until 14 Oct 2026". The pricing page heading is *Quotation Access Plan*, where the extra
word earns its place.

**Mechanics.**
- One nullable field does the whole job: `user.accessUntil`. Gating is one comparison
  (`lib/access.ts → accessState(user)`), never a ledger. **Add the field in P5, leave it `null`
  through beta, enforce it in P7.** `null` means unlimited.
- **Stacking.** Topping up before expiry adds days to the **end of the current window**, never resets
  from today. Never punish early renewal.
- **Expiry reminders** at 7 days and 1 day remaining. With no auto-renew this *is* the retention
  mechanism — treat it as a core feature, not a nice-to-have.
- **Expired ≠ locked out.** On expiry the user cannot create or send new quotes. They can still open
  every existing quote, view their client list, and export their data. Their work is their data;
  holding it hostage kills referrals, and a user who can still see their pipeline is far likelier to
  top up than one already rebuilding it in Excel.

**Top-up flow — manual, deliberately.**
1. User picks a pass and sees the GCash details and the amount.
2. User pays, then enters the GCash reference number in Bilyo.
3. Status shows **Pending — access added within 24 hours**.
4. The operator checks the reference against GCash history and approves. Days are added.

`gcashReference` carries a **unique index**, so a duplicate reference is rejected by the database
rather than by a human. Use a **business** GCash account, not a personal one.

This breaks at roughly 20–30 top-ups a week. That is a long way off and a good problem to have.

**During beta.** Free and unlimited, no payment, no card. A persistent banner reads:
*"Bilyo is free during beta. Paid access starts [DATE]. Beta users get 50% off their first pass."*
Ship the pricing page now with a **Notify me** button — the clicks are the willingness-to-pay signal
and cost nothing to collect. Put a real date in the banner; a date you can move beats no date,
because no date means the conversation never happens.

### 6.11 Multi-factor authentication  ← changed in v3.0
- TOTP stays in the codebase and stays correct: SHA-1 / 6 digits / 30 seconds, AES-256-GCM at rest,
  decrypted only inside `lib/mfa.ts`, ±1-step window with the `mfaLastUsedStep` replay guard.
- **It is no longer mandatory.** Enrolment moves to Account → Security as opt-in. The onboarding gate
  and the forced redirect are removed in P1-T05.
- Rationale: Gate 1 asks ten strangers to send a real quote. Requiring an authenticator app before
  they have seen a single screen is the largest single threat to that number.
- A secret, a recovery code, or a submitted code must **never** reach a log line, an error message,
  an exception payload, or a data export — including on the failure path. That rule did not relax.
- Users who already enrolled keep MFA on. Nothing is disabled retroactively.
- **Open question (§21):** admin accounts read every user's data. Requiring TOTP for `role: 'ADMIN'`
  only is a two-line change inside `requireAdmin()` and costs a beta user nothing. Decide it before
  the account count is interesting.

### 6.12 Locale
- Currency `PHP`, formatted `₱1,234.56`. Dates stored UTC, displayed `Asia/Manila` via `lib/dates.ts`.
- Month boundaries for dashboard figures are **`Asia/Manila` calendar months**, not UTC.
- Copy is English. No i18n framework in v1.

---

## 7. Data model

Mongo collections. The MVP brief's entity list, expressed in what this repo already runs.

### `users`
```
_id, email (unique, lowercase), passwordHash, role: 'USER'|'ADMIN',
businessName, logoUrl, contactDetails { address, email, phone },
accessUntil: Date|null,            ← P5, null through beta
mfaEnabled, mfaSecretEncrypted, mfaLastUsedStep, mfaRecoveryCodeHashes,
suspendedAt, publicLinksDisabledAt, emailVerifiedAt,
createdAt, updatedAt
```
Removed in P1: `plan`, `planSource`, `planOverrideExpiresAt`, `planOverrideReason`, `billingPlan`.

### `businesses`
Kept as-is minus tax fields. Removed in P1: `tin`, `vatRegistered`.
```
_id, userId (unique), businessName, address, email, phone, logoUrl, createdAt, updatedAt
```

### `customers` — the **Client** in the UI
The brief calls this entity *Client*; the collection stays `customers` and the model stays
`Customer`. Renaming a live collection is a migration that buys nothing. **UI copy says "Client"
everywhere; code says `Customer`.** Removed in P1: `tin`.
```
_id, userId, name, email, phone, notes, archived, createdAt, updatedAt
```

### `quotations`
```
_id, userId, clientId (field name stays customerId), number, status,
currency: 'PHP', subtotalCentavos, discountCentavos, totalCentavos,
issueDate, validUntil, notes, terms,
publicCode (unique, sparse), publicCodeRevokedAt,
businessSnapshot, customerSnapshot,          ← frozen at SENT
sentAt, viewedAt, respondedAt, respondedByName, responseIp,
paidAt, paidAmountCentavos,
createdAt, updatedAt
```
Removed in P1: `vatRatePercent`, `vatCentavos`, `convertedInvoiceId`.
Renamed in P2: `publicToken` → `publicCode`, `publicTokenRevokedAt` → `publicCodeRevokedAt`.
Indexes: `{userId, createdAt:-1}`, `{userId, number}` unique, `{publicCode}` unique sparse,
`{userId, status, validUntil}`.

### `lineItems`
Embedded in the quotation, not a collection.
```
{ description, quantity, unitPriceCentavos, amountCentavos, sortOrder }
```

### `events`  ← new in v3.0
```
_id, quotationId, userId, type, actor, metadata, createdAt
```
Append-only. Indexes: `{quotationId, createdAt:1}`, `{userId, createdAt:-1}`.

### `counters`
```
_id, userId, kind: 'QUOTATION', year, seq
```
Index `{userId, kind, year}` unique. The `INVOICE` kind is removed in P1; the old `{userId, kind}`
unique index is replaced in P2-T01.

### `topUps`  ← new, P7 only
```
_id, userId, passType: 'D30'|'D90'|'Y1', amountCentavos, daysGranted,
gcashReference (unique), status: 'PENDING'|'APPROVED'|'REJECTED',
submittedAt, reviewedAt, reviewedByUserId, reviewNote
```

### `adminAuditLogs`, `passwordResetTokens`
Unchanged.

### Collections that stop being written
`invoices` and `products`. **Do not drop them.** The code that reads and writes them is deleted in
P1; the collections stay in Atlas untouched as a record. Dropping a collection needs explicit human
approval (`AGENTS.md` §5).

---

## 8. Route map

### 8.1 User and public surface

| Route | Type | Notes |
|---|---|---|
| `/` | public | landing — quotation positioning, beta banner |
| `/pricing` | public | Quotation Access Plan + **Notify me** |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | public | |
| `/login/mfa` | conditional | only when the account has MFA enabled |
| `/dashboard` | user | four numbers + recent quotes |
| `/dashboard/quotations` | user | list, filtered by status |
| `/dashboard/quotations/new` | user | the editor |
| `/dashboard/quotations/[id]` | user | detail, timeline, copy link, mark paid |
| `/dashboard/clients`, `/dashboard/clients/new`, `/dashboard/clients/[id]` | user | |
| `/dashboard/settings` | user | business profile + logo |
| `/dashboard/account`, `/dashboard/account/security` | user | export, close, optional MFA |
| `/dashboard/access` | user | access status, passes, top-up form (P5 shell, P7 live) |
| `/q/[code]` | **public** | the quote page — view + accept/decline |
| `/api/quotations/[id]/pdf` | user | PDF stream |
| `/api/public/q/[code]/pdf` | public | PDF stream by code |
| `/api/health` | public | |

Deleted in P1: `/dashboard/invoices/*`, `/dashboard/products/*`, `/i/[token]`,
`/api/invoices/[id]/pdf`, `/api/public/i/[token]/pdf`, `/onboarding/mfa`.

### 8.2 Admin surface

| Route | Notes |
|---|---|
| `/admin` | platform metrics |
| `/admin/users`, `/admin/users/[id]` | list, detail |
| `/admin/users/[id]/quotations` | read-only quote list (was `/documents`) |
| `/admin/quotations/[id]` | read-only quote view (was `/documents/[kind]/[id]`) |
| `/admin/lookup` | cross-user support lookup by number or code |
| `/admin/audit` | append-only audit viewer |
| `/admin/topups` | **new, P7** — pending queue, approve/reject |

---

## 9. End-to-end flows

### 9.1 Owner: first run → first sent quote
Register → straight to the dashboard (no MFA gate, no onboarding wizard) → empty state says
"Create your first quotation" → editor: pick or type a client, add line items, set validity → Save
(number assigned, `CREATED` event) → **Send** freezes the snapshots, assigns the public code, sets
`sentAt`, appends `SENT`, and shows a **copy-link** button with the link already selected.
The success state's primary action is copying the link, not viewing the PDF. The link is the product.

### 9.2 Client: receiving a quote (the flow that matters)
Owner pastes the link into Messenger → client taps it on a phone → `/q/[code]` renders the business
name, logo, line items, total, validity, and the §2.3 footer → first open sets `viewedAt`, moves
`SENT` → `VIEWED`, appends `VIEWED` → client taps **Accept** or **Decline** → a small dialog asks
for their name → response stored, event appended, owner notified → the page re-renders as a receipt
of the decision ("You accepted this quotation on 8 Sep 2026").
No login, no account, no app. Two taps.

### 9.3 Owner: closing the loop
Dashboard shows the accepted quote moved into "Accepted this month" → owner opens the detail page →
the timeline reads Created · Sent · Viewed · Accepted with timestamps → when the client pays, the
owner flips **Mark as paid**. Bilyo produces no document at this step, by design.

### 9.4 Owner: the expired quote
A quote past `validUntil` displays `EXPIRED` on both the dashboard and the public page, and the
public page hides the Accept/Decline buttons and shows "This quotation expired on …, please contact
[business] for an updated quote." The owner can extend `validUntil` from the detail page, which
re-opens the response window and appends no new status.

### 9.5 Admin: the support ticket
User emails "my client says the link is broken" → `/admin/lookup` by quote number → read-only view
shows status, code, revoked-at, and the owner's `publicLinksDisabledAt` → the view itself appends a
`DOCUMENT_VIEW` audit row → the operator answers without ever touching the user's data.

### 9.6 Owner: topping up (P7, past Gate 3)
`/dashboard/access` shows "Access until 14 Oct 2026" → user picks a pass → sees the GCash number and
the exact amount → pays in the GCash app → types the reference number → row inserted `PENDING`,
status reads "Pending — access added within 24 hours" → operator matches it in `/admin/topups` and
approves → `accessUntil` extends **from its current value if in the future, otherwise from today** →
audit row, and the user sees the new date.

---

## 10. Screen inventory and required UI states

Every screen ships with all five states. A screen missing its empty state is not done.

| Screen | Empty | Loading | Error | Success | Notes |
|---|---|---|---|---|---|
| Dashboard | "No quotes yet" + primary CTA | skeleton tiles | retry | — | four numbers, then recent quotes |
| Quotation list | "No quotations" | skeleton rows | retry | — | status filter chips |
| Quote editor | one blank line item | — | field errors + a top summary | "Saved" toast, autosave indicator | autosave drafts |
| Quote detail | — | skeleton | retry | copy-link confirmation | timeline, mark-paid |
| **Public quote page** | — | server-rendered, no spinner | friendly 404 for a bad/revoked code | decision receipt | **phone-first, build first** |
| Clients list / detail | "No clients yet" | skeleton | retry | — | quote history per client |
| Access page | "Free during beta" | — | duplicate-reference error | "Pending" state | P5 shell, P7 live |
| Pricing | — | — | — | "We'll let you know" | Notify me |
| Admin top-ups | "Nothing pending" | skeleton | retry | approved confirmation | P7 |

**Design budget goes to the public quote page.** It renders at 390px first and desktop second. Every
other screen is admin furniture and can be plain.

---

## 11. How an agent works a task

1. Read §2 (hard constraints), §6 (domain rules), and this section.
2. Take the **first unchecked task** in §12 unless the human named another. The order encodes
   dependencies.
3. State the task ID, the files you intend to touch, and anything ambiguous. Then start.
4. Build the smallest change that satisfies *Accept*. One task = one commit.
5. Run the §15 checklist honestly. Tick the box. Commit as
   `<type>(<scope>): <summary> [<task-id>]`.
6. If a task seems to require an invoice, a receipt, or a tax figure — **stop and flag it** (§2.4).

---

## 12. Milestones

### 12.0 History — what shipped under v2.x

Do not re-do these, and do not create new `M` task IDs. Recorded so an agent reading a commit
message like `[M7-T04]` knows what it refers to.

| Milestone | Outcome | Fate under v3.0 |
|---|---|---|
| M0 Foundation | repo, Tailwind, Mongo, money/totals libs | kept |
| M1 Authentication | Auth.js, register/login, reset, TOTP | kept; TOTP becomes optional (P1-T05) |
| M2 Business profile & contacts | business profile, customers | kept, minus tax fields (P1-T04) |
| M3 Quotations + PDF | editor, list, detail, PDF | kept, reworked in P2–P4 |
| M4 Invoices + public links | invoices, `/i/[token]`, conversion | **removed (P1-T01)**; the public-link machinery survives |
| M5 Dashboard & polish | dashboard shell, recent documents | rebuilt in P4 |
| M6 Ship it | Vercel deploy, export, account closure, MFA gate | kept; MFA gate removed (P1-T05) |
| M7 Admin console | users, lookup, audit, metrics | kept, de-invoiced (P1-T06) |
| M8 Plan limits | FREE tier counting | **removed (P1-T03)** |
| M9 Monetization (PayMongo) | never started | **cancelled**; replaced by §6.10 / P7 |
| M10 Transactional email | never started | **superseded by P6** |

---

### P1 — The strip (8–10 hrs) · *do this first, do it completely*

The pivot is not real until the invoice code is gone. Half-removed features are how an agent
"helpfully" restores an invoice PDF three weeks from now. Every task here is a deletion, and each
one ends with a green build.

Order matters: leaves first (routes and components), then the shared libs, then the models.

- [x] **P1-T00 · Normalise line endings first** (0.5h, *do this before anything else*)
  *Files:* `.gitattributes` (new)
  *Do:* the working tree currently shows **112 modified files, ~31,000 changed lines, of which only
  3 files have a real change** — the rest is CRLF/LF churn from editing on Windows with no
  `.gitattributes` and `core.autocrlf` unset. Add `* text=auto eol=lf` (plus `*.png binary` and
  friends), run `git add --renormalize .`, and commit that **alone** as
  `chore(repo): normalise line endings`.
  *Why first:* `AGENTS.md` §1 says start from a clean tree, and every P1 deletion commit would
  otherwise be buried in tens of thousands of invisible EOL lines — which is exactly how a review
  misses that an invoice route survived.
  *Accept:* `git status --short` is empty afterwards; `git diff --shortstat` and
  `git diff --shortstat -w` agree on the next commit.

- [x] **P1-T01 · Delete the invoice surface** (3.5h)
  **The grep is the spec.** `grep -rlniE "\binvoice" app actions components lib models types tests middleware.ts`
  returns **74 files** today. The task is done when it returns zero. Work the list; do not guess at it.
  *Files (delete):* `app/(dashboard)/dashboard/invoices/**` · `app/i/[token]/**` ·
  `app/api/invoices/**` · `app/api/public/i/**` · `actions/invoices.ts` ·
  `lib/pdf/invoice-document.tsx` · `lib/validation/invoice.ts` ·
  `components/dashboard/InvoiceList.tsx` · `components/documents/invoice-form.tsx` ·
  `models/invoice.ts` · `tests/invoices.test.ts`
  *Files (edit), the non-obvious ones:*
  - `components/documents/document-form.tsx` — this is the shared invoice+quotation abstraction.
    **Collapse it into the quotation form** rather than keeping a one-kind generic: fold it into
    `components/documents/quotation-form.tsx`, drop `DocumentKind`, `DOCUMENT_CONFIG`,
    `secondaryDate`, and `isDocumentEditable`'s invoice branch.
  - `lib/documents.ts` — drop `DocumentKind`, the invoice entry in `DOCUMENT_CONFIG`,
    `serializeInvoice`, `SerializedInvoice`, and the invoice disclaimer.
  - `lib/dates.ts` — drop `isInvoiceOverdue()`.
  - `lib/numbering.ts` + `models/counter.ts` — drop the `INVOICE` kind (the format change itself is
    P2-T01).
  - `lib/public-projection.ts` — drop `getPublicInvoiceByToken` and the invoice branch of the
    projection type.
  - `lib/metrics.ts`, `lib/export.ts`, `actions/account.ts` — drop invoices from the dashboard
    counts and the data export.
  - `models/quotation.ts` (`convertedInvoiceId`) · `actions/quotations.ts` (the convert-to-invoice
    action) · `models/index.ts` · `types/index.ts` (`IInvoice`, `InvoiceStatus`) · `middleware.ts`
    (invoice matchers) · nav in `app/(dashboard)/dashboard/layout.tsx` · copy in
    `app/(dashboard)/not-found.tsx`, `app/layout.tsx` metadata, `app/(auth)/register/page.tsx`.
  - Tests: `documents.test.ts`, `metrics.test.ts`, `numbering.test.ts`, `public-projection.test.ts`,
    `account.test.ts`, `admin-*.test.ts` all assert on invoices. Update, don't skip.
  - Admin files are P1-T06; leave them until then.
  *Do:* delete, do not comment out and do not feature-flag. Leave the `invoices` **collection** in
  Atlas untouched — no migration, no drop.
  *Accept:* the grep above returns zero (admin files excepted until P1-T06 lands); `npm run build`
  and `npm run test` pass; the dashboard nav has no invoice entry; `/dashboard/invoices` and
  `/i/anything` 404.

- [x] **P1-T02 · Delete the products catalogue** (1h)
  *Files (delete):* `app/(dashboard)/dashboard/products/**` · `actions/products.ts` ·
  `models/product.ts` · `lib/validation/product.ts` · `components/dashboard/ProductForm.tsx` ·
  `components/dashboard/ProductList.tsx` · `tests/products.test.ts`
  *Files (edit):* `components/documents/line-item-builder.tsx` (drop the product picker and the
  `productId` field on `LineItemRow`) · `lib/documents.ts` · `lib/export.ts` ·
  `actions/account.ts` · `components/dashboard/AccountSettings.tsx` ·
  `components/admin/PlatformMetricsTiles.tsx` · `models/index.ts` · `types/index.ts` ·
  dashboard nav · `app/(marketing)/page.tsx`
  *Accept:* line items are typed free-hand; `grep -rlniE "\bproducts?\b" app actions components lib models types tests`
  returns nothing; build and tests pass.

- [x] **P1-T03 · Delete plan limits** (1.5h)
  *Files (delete):* `lib/plan.ts` · `components/dashboard/PlanLimitAlert.tsx` · `tests/plan.test.ts` ·
  `tests/plan-limits.test.ts`
  *Files (edit):* every create action that called a limit check (`actions/quotations.ts`,
  `actions/customers.ts`) · the `PlanLimitAlert` usage in the quotation form ·
  `models/user.ts` (drop `plan`, `planSource`, `planOverrideExpiresAt`, `planOverrideReason`,
  `billingPlan`) · `lib/admin/users.ts` and `actions/admin/users.ts` (drop the plan-override
  controls) · `components/admin/AdminUserControls.tsx` · `components/admin/AdminUserList.tsx` ·
  `types/index.ts`
  *Do:* quotes are **never** metered (§6.10). Nothing replaces this until P5 adds `accessUntil`, and
  that stays inert until P7.
  *Accept:* a user can create 100 quotations and 100 clients in a month with no gate; no
  `PLAN_LIMITS` or `effectivePlan` symbol survives; existing `PLAN_OVERRIDE_*` **audit rows are
  untouched** (the enum keeps the strings, the UI stops producing them).

- [x] **P1-T04 · Remove VAT and TIN** (2h)
  *Files:* `lib/totals.ts` · `models/quotation.ts` · `models/business.ts` · `models/customer.ts` ·
  `lib/validation/business.ts` · `lib/validation/customer.ts` · `lib/validation/quotation.ts` ·
  `components/documents/totals-panel.tsx` · `components/documents/quotation-form.tsx` ·
  `components/dashboard/BusinessProfileForm.tsx` · `components/dashboard/CustomerForm.tsx` ·
  `components/dashboard/CustomerList.tsx` · `lib/pdf/quotation-document.tsx` ·
  `lib/pdf/shared/document-layout.tsx` · `lib/public-projection.ts` · `lib/export.ts` ·
  `lib/admin/users.ts` · `app/(dashboard)/dashboard/settings/page.tsx` ·
  `app/(marketing)/page.tsx` · `app/layout.tsx` (metadata copy) · `types/index.ts` ·
  `tests/totals.test.ts`, `tests/business.test.ts`, `tests/customers.test.ts`
  *Do:* totals become `subtotal → discount → total`. Delete `vatRatePercent`, `vatCentavos`,
  `business.tin`, `business.vatRegistered`, `customer.tin` from models, schemas, forms, snapshots,
  the PDF and the public projection. Existing documents keep whatever is stored; nothing reads it.
  *Accept:* `lib/totals.ts` has no VAT branch and its test covers discount-only rounding; no PDF or
  page renders a VAT row or a TIN; `grep -rlniE "\bvat\b|\btin\b" app components lib models types`
  returns nothing.

- [x] **P1-T05 · Make MFA optional** (1.5h)
  *Files (delete):* `app/(onboarding)/**` · `lib/onboarding-gate.ts` ·
  `tests/onboarding-gate.test.ts` · `components/onboarding/MfaEnrolmentFlow.tsx` (move its
  enrolment UI into the security page first)
  *Files (edit):* `middleware.ts` (drop the onboarding redirect) · `lib/auth.ts` / `auth.config.ts`
  (the MFA challenge fires only when `user.mfaEnabled`) · `app/(dashboard)/dashboard/account/security/page.tsx`
  (becomes the enrolment entry point) · `components/dashboard/AccountSecuritySettings.tsx`
  *Do:* register → dashboard, no interstitial. Enrolment and device replacement stay exactly as
  built, just opt-in. **Do not touch `lib/mfa.ts`** — the crypto, the ±1 step window and the replay
  guard are correct and stay correct (§6.11).
  *Accept:* a brand-new account reaches `/dashboard` in one hop with no authenticator; a user who
  enrols is still challenged at `/login/mfa` on the next sign-in; an already-enrolled account is not
  disabled by this change; no secret or code appears in any log or error.

- [x] **P1-T06 · De-invoice the admin console** (1h)
  *Files:* `app/(admin)/admin/documents/[kind]/[id]/page.tsx` → `app/(admin)/admin/quotations/[id]/page.tsx` ·
  `app/(admin)/admin/users/[id]/documents/page.tsx` → `.../quotations/page.tsx` · `lib/admin/lookup.ts` ·
  `lib/admin/metrics.ts` · `components/admin/PlatformMetricsTiles.tsx`
  *Do:* one document kind now, so the `[kind]` segment goes. Metrics tiles become: users, quotes
  sent (30d), quotes accepted (30d), acceptance rate.
  *Accept:* admin lookup finds a quote by number **or** public code; every admin read still appends
  an audit row; no admin path references an invoice.

- [x] **P1-T07 · Marketing copy pass** (1h)
  *Files:* `app/(marketing)/page.tsx` · `app/(marketing)/pricing/page.tsx` ·
  `components/marketing/*` (`invoice-preview.tsx` → `quote-preview.tsx`) · `README.md` ·
  `package.json` (`name: "bilyo"`)
  *Do:* the landing page sells "quotations your clients can accept with one tap", never invoicing.
  Scrub every BIR-adjacent claim.
  *Accept:* `grep -rniE "invoice|BIR|official receipt|tax" app/\(marketing\) components/marketing README.md`
  returns nothing but the §2.3 footer sentence.

---

### P2 — Quotation core (6–8 hrs) · *Weekend 1 in the brief*

- [x] **P2-T01 · New numbering** (2h)
  *Files:* `lib/numbering.ts` · `models/counter.ts` · `tests/numbering.test.ts`
  *Do:* `Q-YYYY-NNNN`, per user per `Asia/Manila` year (§6.3). Drop the `INVOICE` kind. Replace the
  `{userId, kind}` unique index with `{userId, kind, year}`; write the index change as a documented
  one-off script in `scripts/`, run by a human.
  *Accept:* two concurrent creates never collide (test with `Promise.all` on 20 creates); the first
  quote of 2027 is `Q-2027-0001`; **existing `QUO-000001` documents are unchanged and still open**.

- [x] **P2-T02 · `publicToken` → `publicCode`** (1h)
  *Files:* `models/quotation.ts` · `lib/public-projection.ts` · `app/q/[token]` → `app/q/[code]` ·
  `app/api/public/q/[token]` → `[code]` · `actions/quotations.ts`
  *Do:* rename the field and the route segment; keep the 12-char generator and the unique sparse
  index. Add a one-off `scripts/rename-public-token.ts` that copies `publicToken` → `publicCode` for
  existing rows, run by a human before deploy.
  *Accept:* links already sent to clients still resolve after the script runs; a 13-char or malformed
  code 404s; the code is not sequential and not derived from the id.

- [x] **P2-T03 · The `Event` collection** (2h)
  *Files:* `models/event.ts` · `lib/events.ts` · `types/index.ts` · `models/index.ts`
  *Do:* the §7 schema and `recordEvent({ quotationId, userId, type, actor, metadata })`. Wire
  `CREATED` and `SENT` into `actions/quotations.ts` now; the rest land with their features. Append
  the event **in the same action** that made the change, after the write succeeds.
  *Accept:* creating and sending a quote produces exactly two rows in order; there is no update or
  delete path on `events`; a failed quotation write leaves no orphan event.

- [x] **P2-T04 · Editor simplification + autosave** (2h)
  *Files:* `components/documents/quotation-form.tsx` · `components/documents/line-item-builder.tsx` ·
  `components/documents/totals-panel.tsx` · `actions/quotations.ts`
  *Do:* one page: client picker with inline create, line items with drag-free `sortOrder`, discount,
  validity date, notes. Autosave a `DRAFT` on a 2-second idle debounce, with a visible
  "Saving…/Saved" indicator. Totals recomputed server-side on every save (`AGENTS.md` §4.3).
  *Accept:* a refresh mid-edit loses nothing; autosave never fires on an invalid line; the server's
  stored total is recomputed from items, never trusted from the client.

- [x] **P2-T05 · Footer constant and status pipeline** (1h)
  *Files:* `lib/documents.ts` · `models/quotation.ts` · `lib/pdf/quotation-document.tsx`
  *Do:* `QUOTATION_FOOTER` as the single source of the §2.3 sentence, rendered on the detail page,
  the public page and the PDF. Add `VIEWED` to the status enum and to the badge config; keep
  `EXPIRED` derived (§6.4).
  *Accept:* the exact sentence appears in all three places and exists once in the source; a quote
  past `validUntil` shows Expired in the list, the detail page and the public page without any
  stored change.

---

### P3 — The public quote page (8–10 hrs) · *Weekend 2 · the most important screen*

Build this one properly. It is the only screen the buyer's customer ever sees and the only reason a
user would pick Bilyo over a Word template.

- [x] **P3-T01 · Redesign the public page, phone-first** (3h)
  *Files:* `app/q/[code]/page.tsx` · `components/public/quote-page.tsx` (new, replacing the shared
  `public-document-view.tsx`) · `components/public/quote-header.tsx`
  *Do:* logo and business name, the client's name, line items that stay readable at 390px, a total
  that is unmissable, validity, notes, the §2.3 footer, and a secondary "Download PDF" link.
  Server-rendered, no client JS for the read path, no layout shift. Open Graph tags so a Messenger
  paste shows the business name and total.
  *Accept:* renders correctly at 390px with a 6-item quote and a long business name; Lighthouse
  mobile performance ≥ 90; nothing in the payload contains the owner's account email or any ObjectId.

- [x] **P3-T02 · Accept / Decline** (3h)
  *Files:* `components/public/response-form.tsx` · `actions/public-response.ts` (new) ·
  `lib/validation/response.ts` · `models/quotation.ts`
  *Do:* two large buttons. Either opens a small dialog asking for the responder's name, then
  confirms. The Server Action takes the **code**, never an id; re-reads the quotation; rejects unless
  status ∈ {`SENT`,`VIEWED`} and `validUntil >= today` and `respondedAt` is null; writes
  `status`, `respondedAt`, `respondedByName`, `responseIp`; appends the event with `actor: 'CLIENT'`.
  Rate-limit by code.
  *Accept:* a double-submit or a second device produces "This quotation was already accepted on …",
  not a second write; an expired quote shows no buttons and its action is rejected server-side even
  if called directly; an accepted quote's items can no longer be edited by the owner.

- [x] **P3-T03 · View tracking** (1h)
  *Files:* `app/q/[code]/page.tsx` · `lib/events.ts` · `actions/quotations.ts`
  *Do:* first public render sets `viewedAt`, moves `SENT` → `VIEWED`, appends one `VIEWED` event.
  Guard so the owner previewing their own link does not count, and so a second view appends nothing.
  *Accept:* opening the link twice yields one `VIEWED` event and one timestamp; an `ACCEPTED` quote
  opened again does not regress to `VIEWED`.

- [ ] **P3-T04 · Owner notification, in-app** (2h)
  *Files:* `components/dashboard/NeedsAttention.tsx` (new) · `lib/metrics.ts` ·
  `app/(dashboard)/dashboard/page.tsx` · `app/(dashboard)/dashboard/layout.tsx`
  *Do:* a "Needs your attention" list at the top of the dashboard, plus a count badge in the nav,
  sourced from `events` since the owner's `lastSeenEventsAt`. **Email notification is P6** — the
  brief puts email domain setup out of v1, and in-app closes the loop without blocking on DNS.
  *Accept:* an accept or decline appears in the owner's dashboard within one refresh; the badge
  clears when the list is opened; the query is `userId`-scoped.

- [ ] **P3-T05 · Timeline on the quote detail page** (1h)
  *Files:* `app/(dashboard)/dashboard/quotations/[id]/page.tsx` · `components/quotations/timeline.tsx`
  *Do:* read `events` for the quotation, render Created · Sent · Viewed · Accepted/Declined ·
  Marked paid with `Asia/Manila` timestamps and the actor. Copy-link button beside it.
  *Accept:* the timeline matches the event rows exactly, oldest first; the copy button puts the full
  `https://…/q/<code>` URL on the clipboard and confirms visibly.

---

### P4 — Dashboard, clients, PDF, mark-paid (6–8 hrs) · *Weekend 3 · then deploy*

- [ ] **P4-T01 · The four numbers** (2.5h)
  *Files:* `lib/metrics.ts` · `app/(dashboard)/dashboard/page.tsx` ·
  `components/dashboard/StatTiles.tsx` · `tests/metrics.test.ts`
  *Do:* **Quoted this month** (count + peso total of quotations with `sentAt` in the current
  `Asia/Manila` month) · **Accepted this month** (count + total) · **Awaiting response**
  (`SENT`+`VIEWED`, not expired) · **Potential value** (peso total of that awaiting set). One
  aggregation, `userId`-scoped.
  *Accept:* a quote sent at 23:30 on 31 August (Manila) counts in August, not September; the tiles
  answer §1.1 in under two seconds on a 200-quote account; drafts are excluded from every figure.

- [ ] **P4-T02 · Recent quotes by status** (1h)
  *Files:* `components/dashboard/RecentDocuments.tsx` → `RecentQuotations.tsx` ·
  `components/dashboard/QuotationList.tsx`
  *Accept:* status chips filter without a full page load; the empty state offers the create CTA.

- [ ] **P4-T03 · Clients list and detail** (1.5h)
  *Files:* `app/(dashboard)/dashboard/clients/**` (renamed from `customers`) ·
  `components/dashboard/CustomerList.tsx` → `ClientList.tsx` ·
  `components/dashboard/CustomerForm.tsx` → `ClientForm.tsx` · `actions/customers.ts`
  *Do:* rename the route and all UI copy to **Client**; the model stays `Customer` (§7). Detail page
  shows the client's quote history with statuses and totals.
  *Accept:* `/dashboard/customers` redirects to `/dashboard/clients`; no user-visible string says
  "customer"; the history list is `userId`-scoped, not just `clientId`-scoped.

- [ ] **P4-T04 · Mark as paid** (1h)
  *Files:* `actions/quotations.ts` · `components/quotations/mark-paid-toggle.tsx` ·
  `models/quotation.ts` · `lib/validation/quotation.ts`
  *Do:* §6.8. Available only on `ACCEPTED`. Optional amount, defaulting to the total.
  *Accept:* toggling produces `MARKED_PAID` / `UNMARKED_PAID` events; a partial amount is stored in
  centavos; **no document, number, or receipt is generated**; the public page does not show payment
  status.

- [ ] **P4-T05 · PDF and print view** (1.5h)
  *Files:* `lib/pdf/quotation-document.tsx` · `lib/pdf/shared/document-layout.tsx` ·
  `app/api/quotations/[id]/pdf/route.ts` · `app/api/public/q/[code]/pdf/route.ts`
  *Do:* A4, logo, business block, client block, items, subtotal/discount/total, validity, notes, and
  the §2.3 footer. The title block says **QUOTATION** and the number is `Q-2026-0012`.
  *Accept:* no VAT row, no TIN, no word "invoice" anywhere in the output; the footer is present; the
  public PDF route is code-scoped and 404s on a revoked code.

- [ ] **P4-T06 · Deploy and smoke** (1h)
  *Files:* `scripts/seed.ts` · `.env.example` · `app/api/health/route.ts`
  *Do:* run the two one-off migration scripts (P2-T01, P2-T02) against production, deploy, then walk
  §9.1 → §9.2 end to end on a real phone with a real Messenger paste.
  *Accept:* a quote created on desktop is opened, viewed and accepted from a phone, and the owner
  sees it on the dashboard. **Then stop building and go find users.**

---

### P5 — Access rails, dormant (3–4 hrs) · *ship with P4, enforces nothing*

Add the plumbing while it is cheap, leave it inert. `accessUntil` is one nullable timestamp and one
comparison; a credit ledger retrofitted onto live data is a weekend you do not have.

- [ ] **P5-T01 · `accessUntil` + `lib/access.ts`** (1.5h)
  *Files:* `models/user.ts` · `lib/access.ts` · `tests/access.test.ts`
  *Do:* nullable `accessUntil`, and a pure synchronous
  `accessState(user): { status: 'BETA'|'ACTIVE'|'EXPIRED', accessUntil, daysLeft }` — no DB, no
  `await`. `null` → `BETA`. **Nothing calls it to block anything yet.**
  *Accept:* `null` is unlimited; an `accessUntil` one second in the past reads `EXPIRED` with no job
  having run; the function is covered by tests including the Manila day boundary.

- [ ] **P5-T02 · Beta banner** (0.5h)
  *Files:* `app/(dashboard)/layout.tsx` · `components/dashboard/BetaBanner.tsx`
  *Do:* the §6.10 banner text, with the date from `BETA_ENDS_AT` in env so moving it is a config
  change. Dismissible per session, not permanently.
  *Accept:* the date renders in `Asia/Manila` long form; the banner never covers the primary CTA on
  a 390px screen.

- [ ] **P5-T03 · Pricing page + Notify me** (1.5h)
  *Files:* `app/(marketing)/pricing/page.tsx` · `components/marketing/pricing-section.tsx` ·
  `actions/notify-interest.ts` · `models/interest.ts`
  *Do:* heading **Quotation Access Plan**, the three passes, "free during beta" stated plainly, and
  a **Notify me** button that stores `{ email, passType, createdAt }`. This is the Gate 3
  instrument — the clicks *are* the data.
  *Accept:* a signed-in user's click records without retyping their email; a duplicate click is
  idempotent; the count is visible in `/admin`.

---

### P6 — Notifications and reminders (5–7 hrs) · *only after Gate 1 passes*

- [ ] **P6-T01 · Resend setup** (1h, *human, not an agent*) — domain, SPF/DKIM, `RESEND_API_KEY`,
  a verified `from` address.
- [ ] **P6-T02 · Mailer** (1.5h) — `lib/email/`, one send function, plain-text fallback, a
  no-op transport in dev unless `RESEND_API_KEY` is set. Never send to a suspended account.
- [ ] **P6-T03 · "Your quotation was accepted"** (1.5h) — fires from the same action that writes
  the response, after the write, failure-tolerant: a dead mailer must never roll back an acceptance.
- [ ] **P6-T04 · Password reset by email** (1h) — the existing token flow finally emails its link.
- [ ] **P6-T05 · Access expiry reminders** (2h) — 7 days and 1 day before `accessUntil`, once each,
  idempotent by `{userId, accessUntil, kind}`. **This is the retention mechanism** (§6.10), not a
  nice-to-have. Inert while every `accessUntil` is null.

---

### P7 — Turn billing on (8–10 hrs) · *blocked by Gate 3 — do not start early*

- [ ] **P7-T01 · `TopUp` model + pass table** (2h) — §7 schema, `gcashReference` **unique**, and
  `lib/access/passes.ts` as the only place a price or a day count appears.
- [ ] **P7-T02 · Top-up submission** (2h) — `/dashboard/access`: pick a pass, see the GCash details
  and amount, submit a reference. Duplicate reference → a clear "already submitted" error from the
  index, not a crash. Status reads *Pending — access added within 24 hours*.
- [ ] **P7-T03 · Admin approval queue** (2.5h) — `/admin/topups`, approve/reject with a note.
  Approval extends `accessUntil` **from its current value when in the future, else from today**
  (stacking, §6.10), appends `TOPUP_APPROVE` to the audit log, and is idempotent on re-click.
- [ ] **P7-T04 · Enforcement** (1.5h) — `accessState()` blocks **create and send only**. Reading
  quotes, the client list, PDFs and export stay open forever (§6.10). Behind `ACCESS_ENFORCED=true`
  so it can be switched off in one env change.
- [ ] **P7-T05 · Go live** (1h, *human*) — business GCash account confirmed, the beta banner replaced
  with real dates, the 50%-off first pass honoured for beta users.

---

## 13. Validation gates

Do not build past a gate until it is met. This is the part that keeps the project from becoming an
endless build. A gate is checked by the human, not by an agent, and the answer is written into this
section with a date.

**Gate 0 — before P1.** Talk to five service businesses or freelancers. One question above all:
*do you send a written quotation, or do you just say a price in chat?* If four out of five say "just
chat", **stop and redesign** — the accept-link has nothing to attach to, and two months were saved.
> Result: _______________ (date, 5 names, the answer count)

**Gate 1 — two weeks after the P4 deploy.** Ten people have created and **sent** at least one real
quote to a real client. Not signups. Sent quotes.
> Result: _______________

**Gate 2 — four weeks after deploy.** At least three of those users have sent a second and third
quote **without being reminded**. Repeat use is the only honest measure of whether Bilyo beat their
Word template.
> Result: _______________

**Gate 3 — before P7.** At least five users click **Notify me** on pricing, or say unprompted that
they would pay.
> Result: _______________

If Gate 1 fails, the problem is distribution, or the product is not solving a real pain. If Gate 1
passes and Gate 2 fails, the product is a novelty. Either way you learn something that another month
of building would not have told you.

---

## 14. Backlog (do not start without human approval)

Payment processing · automated client reminders · contracts and e-signature · time tracking · teams
and multi-user · product catalogue · expense tracking · CSV/Excel export and reports · custom
branding beyond a logo · mobile app · quote templates · deposit/milestone terms · client portal ·
admin impersonation · Viber/Messenger send integration.

Several of these are good. They are all v2. Anything that would require generating an invoice or a
receipt is not backlog — it is §2, and it is never built.

---

## 15. Definition of done

### 15.1 Every task
- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run lint` — 0 new warnings
- [ ] `npm run build` — succeeds
- [ ] `npm run test` — passes; new domain logic has a test
- [ ] Every new query is `userId`-scoped, or is a documented public-code read
- [ ] Money is centavos end to end
- [ ] Renders at 390px
- [ ] Nothing added that §2 forbids
- [ ] `.env.example` updated if a new variable appeared
- [ ] The checkbox in §12 is ticked and the work is committed as
      `<type>(<scope>): <summary> [<task-id>]`

### 15.2 Every deletion task in P1, additionally
- [ ] The grep in *Accept* returns zero matches
- [ ] No code was commented out or feature-flagged instead of deleted
- [ ] No collection was dropped

### 15.3 Every admin task, additionally
- [ ] Behind `requireAdmin()`, audited, 404s for non-admins, writes nothing a user owns

### 15.4 Every task touching the public page, additionally
- [ ] The projection leaks no account email and no ObjectId
- [ ] The response path is idempotent and rejects a second answer
- [ ] The §2.3 footer is present

---

## 16. Testing strategy

Unit tests where the money and the dates are — `lib/totals.ts`, `lib/money.ts`, `lib/numbering.ts`,
`lib/access.ts`, `lib/metrics.ts`. These are pure functions and there is no excuse.

Integration tests for the three paths where a bug is expensive:
1. **The accept path** — double submit, expired quote, already-responded quote, revoked code.
2. **Ownership scoping** — user A cannot read, edit, or respond to user B's quotation by id.
3. **Numbering under concurrency** — 20 parallel creates produce 20 distinct numbers.

Manual before every deploy: the §9.2 flow on a real phone, from a real Messenger link.

---

## 17. Environment variables

```
MONGODB_URI=
AUTH_SECRET=
APP_URL=
ADMIN_EMAILS=                  # comma-separated allowlist
MFA_ENCRYPTION_KEY=            # 32-byte hex, AES-256-GCM
BLOB_READ_WRITE_TOKEN=         # Vercel Blob, logos
BETA_ENDS_AT=                  # ISO date shown in the beta banner        (P5)
RESEND_API_KEY=                # optional; absent = no-op mailer          (P6)
GCASH_ACCOUNT_NAME=            #                                          (P7)
GCASH_ACCOUNT_NUMBER=          #                                          (P7)
ACCESS_ENFORCED=false          # gate create/send on accessUntil          (P7)
```
Removed in v3.0: every `PAYMONGO_*` variable.

---

## 18. Operations runbook

**Someone says a link is broken.** `/admin/lookup` by number or code → check `publicCodeRevokedAt`
and the owner's `publicLinksDisabledAt` → if neither, the client has an old link from before a
regenerate; tell the owner to copy it again.

**A client disputes an acceptance.** The `events` row carries the timestamp, the typed name and the
coarse IP. Read it in the admin quote view. Bilyo records what happened; it does not adjudicate.

**Approving a top-up (P7).** Open `/admin/topups` → match the reference in the GCash business
account → approve. Never approve from a screenshot alone. A duplicate reference is rejected by the
index before it reaches you.

**A user is abusing public links.** Disable their public links (audited), then suspend if needed.
Suspension stops sign-in; it does not delete anything.

**Rollback.** Vercel instant rollback to the previous deployment. The two one-off scripts in P2 are
additive (new index, copied field) and safe to leave in place after a rollback.

---

## 19. Migration notes

Three one-off scripts, all run by a human, all reversible:

1. **`scripts/reindex-counters.ts`** (P2-T01) — drop `{userId, kind}`, create `{userId, kind, year}`,
   backfill `year` on existing counter rows from `updatedAt`.
2. **`scripts/rename-public-token.ts`** (P2-T02) — copy `publicToken` → `publicCode` and
   `publicTokenRevokedAt` → `publicCodeRevokedAt` for every quotation. Run **before** the P2-T02
   deploy so links already in clients' hands keep working.
3. **No script for invoices or products.** Their collections stay in Atlas, unread, as a record.

Fields removed from schemas (`vatCentavos`, `plan`, `tin`, …) are left in existing documents. Mongo
does not care, and an `$unset` sweep is risk with no reward.

---

## 20. Sequencing rationale

**Why the strip comes first.** Every hour spent building on top of an invoice surface is an hour that
has to be unpicked, and every agent session that sees `actions/invoices.ts` is one that might extend
it. P1 is not cleanup, it is the pivot.

**Why the public page comes before the dashboard.** The dashboard is worth nothing until quotes are
being accepted, and quotes are accepted on the public page. It is also the only screen a stranger
judges, which makes it the only screen where design time converts into Gate 1.

**Why the access model is plumbed but inert.** One nullable column and one comparison added now cost
half an hour. The same thing retrofitted onto live paying users costs a weekend and risks the data.
Meanwhile nothing about beta changes.

**Why billing is last and gated.** Charging before Gate 3 answers a question nobody asked. The
manual GCash flow is deliberately unscalable because it breaks at 20–30 top-ups a week, and reaching
that number would be the best news this project has ever had.

**Why the build stops after P4.** Because the honest bottleneck after deploy is distribution, not
features — and every gate in §13 exists to make that fact impossible to ignore.

---

## 21. Open items

Each of these is a decision a human owes this document. None of them blocks P1.

- [ ] **Tax accountant opinion, in writing.** Confirm that a quotation-only tool sits outside the
  registration requirements, and that Bilyo as vendor takes on no obligation under RMC 72-2025 while
  it generates no invoices. One paid hour. **Do this in parallel with P1; do not let it block the
  build.** Paste the opinion, or its summary and date, here when it arrives.
- [ ] **Niche for Gate 0.** The plan works for any service business; the marketing cannot. Pick one
  group to talk to first — freelance developers and designers are the group you understand best and
  can reach without cold outreach. Write the five names into §13 Gate 0.
- [ ] **Beta end date.** `BETA_ENDS_AT` needs a real date before P5-T02 ships. A date you can move
  beats no date.
- [ ] **Admin MFA.** §6.11 — require TOTP for `role: 'ADMIN'` only, or leave it fully optional?
- [ ] **GCash business account.** Required before P7-T05, not before. Personal wallets have monthly
  limits and business use sits awkwardly with the terms.
- [ ] **Repo and package name.** The directory is still `invoicetopdf` and `package.json` still says
  `invoiceflow-ph`. P1-T07 fixes the package name; renaming the repo and the local folder is a
  human's call.

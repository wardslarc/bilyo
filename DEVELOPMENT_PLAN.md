# Bilyo Web App — Development Plan

> **Status:** v2.2 · Living document. Agents tick checkboxes here as tasks complete.
> **Read with:** `AGENTS.md` (rules of engagement — *how*) and `GEMINI.md`.
> **This file wins on *what* to build. `AGENTS.md` wins on *how*.**
>
> **v2.2 changes:** M9 rewritten as a full monetization design — prepaid 30-day terms bought through
> PayMongo Checkout Sessions (§5.12), a seven-day grace period, two new collections
> (`billingCheckouts`, `billingEvents`), a reconcile job, and a hard rule that the webhook is the
> only writer of billing fields. Resend split out of the payment path. Nothing already ticked moved.
>
> **v2.1 changes:** mandatory TOTP two-factor auth for every account (§5.11), admin MFA landing in
> M1 as a hard prerequisite of the admin console, user enrolment gate at M6, `MFA_RESET` added to the
> admin action list, and `otpauth` + `qrcode` added to the locked stack.
>
> **v2.0 changes:** added the full platform admin side (§2, §5, §7, §8, §11 M7), added end-to-end
> actor flows (§8) and a screen inventory with required UI states (§9), gave every task explicit
> *Files / Do / Accept* so an agent can pick it up cold, added a testing strategy (§13) and an
> operations runbook (§15). Milestones renumbered: admin console is now **M7**, plan limits **M8**,
> monetization **M9**. Nothing that was already ticked moved.

---

## 1. Product

**Bilyo** — a self-serve web app where Philippine freelancers and MSMEs create quotations and
invoices, send them as a public link or PDF, and track payment status.

**One-sentence scope test (user side):** if a feature doesn't help a user get *from "I need to bill
someone" to "the customer has the document"*, it is out of scope for v1.

**One-sentence scope test (admin side):** if a feature doesn't help the operator *answer a support
ticket, stop an abuser, or see whether the business is growing*, it is out of scope for v1.

### Non-goals (v1)
- No accounting/bookkeeping, no BIR e-filing, no CAS accreditation claims.
- No inventory, payroll, expenses, or time tracking.
- No mobile app. Responsive web only.
- No multi-user businesses. One user = one business. (Team roles are backlog, §12.)
- No Express server, no separate API service, no monorepo. See §3.
- **No admin impersonation ("log in as user") in v1.** Support reads the read-only admin document
  view instead. Impersonation needs its own consent + audit design; it is backlog.

---

## 2. Actors and surfaces

The app has exactly **three surfaces**. Every route, action, and query belongs to one of them, and
the security rule differs per surface. Getting this wrong is the only mistake in this project that
can leak one customer's data to another.

| # | Surface | Who | Entry | Auth check | Query scoping rule |
|---|---|---|---|---|---|
| 1 | **User app** | The freelancer / MSME owner | `/dashboard/*` | signed-in session (password **+ TOTP**) | **Every query filtered by `userId` from the session.** No exceptions. |
| 2 | **Public document view** | The user's *customer* — never signed in | `/i/[token]`, `/q/[token]` | none | Lookup **by `publicToken` only**, hand-written minimal projection. |
| 3 | **Platform admin** | You / Bilyo staff | `/admin/*` | session **+ role ADMIN + email in `ADMIN_EMAILS` + MFA verified this session** | Deliberately **cross-user**. Allowed *only* inside `actions/admin/**` and `lib/admin/**`, only through `requireAdmin()`, and every access is audited. |

### 2.1 Permissions matrix

| Capability | User (own data) | Admin | Public visitor |
|---|---|---|---|
| Create / edit / send quotations, invoices | ✅ | ❌ never | ❌ |
| Read own documents | ✅ | — | ❌ |
| Read **any** user's documents | ❌ | ✅ read-only, audited | ❌ |
| Read a document by public token | ✅ (own) | ✅ | ✅ (that document only) |
| Edit customers / products / business profile | ✅ | ❌ | ❌ |
| Change own password / email | ✅ | ❌ | ❌ |
| Enrol / replace own authenticator device | ✅ | ✅ (own) | ❌ |
| Read anyone's TOTP secret or recovery codes | ❌ | ❌ **impossible by design** | ❌ |
| Reset a **user's** MFA (lost phone, no codes) | ❌ | ✅ audited | ❌ |
| Reset **another admin's** MFA | ❌ | ❌ CLI only, never from the console | ❌ |
| Suspend / unsuspend a user | ❌ | ✅ audited | ❌ |
| Override a user's plan | ❌ | ✅ audited, expiring | ❌ |
| Revoke a document's public link | ✅ (own) | ✅ audited (abuse only) | ❌ |
| See platform-wide metrics | ❌ | ✅ | ❌ |
| Read the audit log | ❌ | ✅ read-only | ❌ |
| Grant someone the ADMIN role | ❌ | ❌ **no UI at all** — DB + env only | ❌ |
| Delete anything permanently | ❌ | ❌ | ❌ |

**Read the last two rows twice.** There is no in-app path to becoming an admin, and there is no
hard delete anywhere in this product.

---

## 3. Architecture principle: monolith

Everything lives in **one Next.js application, in one repository, deployed as one Vercel project**.
The admin console is a route group inside that same app — not a second app, not a second deploy.

```
                    ┌───────────────────────────────────────────┐
                    │        Next.js app (single repo)          │
   Customer  ──────▶│  app/(public)   /i/[token] /q/[token]     │
   (no login)       │      └─ token lookup, minimal projection  │
                    │                                           │
   User      ──────▶│  app/(dashboard)/dashboard/*              │
   (session)        │      └─ actions/*  ── userId-scoped       │
                    │                                           │
   Admin     ──────▶│  app/(admin)/admin/*                      │
   (session+role)   │      └─ actions/admin/* ── requireAdmin() │
                    │         lib/admin/audit.ts (append-only)  │
                    │                                           │
                    │  lib/ (domain logic) · models/ (Mongoose) │
                    └────────────────────┬──────────────────────┘
                                         ▼
                              MongoDB Atlas (one cluster)
```

**Rules that follow:**
1. No separate backend process. Next.js *is* the backend.
2. Domain logic lives in `lib/`, never in components, never duplicated in a route handler.
3. A feature is "done" when its UI, its server logic, and its data model ship together in one PR.
4. Admin is a **route group and a guard**, not a service. Do not spin up a second deployment for it.
5. Splitting into services is a future decision, not a v1 decision. Do not pre-abstract for it.

### 3.1 Directory shape (extends `AGENTS.md` §2)

```
app/
├── (marketing)/              # landing, pricing
├── (auth)/                   # login, register, forgot/reset password
├── (dashboard)/dashboard/    # USER SURFACE
│   ├── invoices/ quotations/ customers/ products/ settings/ account/
├── (admin)/admin/            # ADMIN SURFACE  ← new in v2
│   ├── page.tsx              # metrics
│   ├── users/ [id]/
│   ├── lookup/               # find a document by number or token
│   ├── documents/[kind]/[id] # read-only document view
│   └── audit/
├── i/[token]/  q/[token]/    # PUBLIC SURFACE
└── api/                      # auth, PDF streams, public reads, webhooks ONLY
actions/
├── customers.ts products.ts quotations.ts invoices.ts business.ts account.ts
└── admin/  users.ts  documents.ts        # the only cross-user writes
lib/
├── mongodb.ts auth.ts money.ts totals.ts numbering.ts dates.ts plan.ts
├── validation/  pdf/
└── admin/  guard.ts  audit.ts  metrics.ts   # the only cross-user reads
models/  types/  components/
```

---

## 4. Locked stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | strict mode on |
| Runtime | Node.js (Vercel serverless) | not Edge — Mongoose needs Node |
| DB | MongoDB Atlas + Mongoose | one cluster, one database |
| Auth | Auth.js (NextAuth v5), Credentials provider | JWT session strategy; `role` in the token |
| Password hashing | `bcryptjs` | pure JS, serverless-safe |
| MFA / TOTP | `otpauth` | RFC 6238, ~12KB, zero deps, serverless-safe. Approved v2.1 |
| Enrolment QR | `qrcode` | rendered **server-side** to a data URL; the secret never reaches a CDN |
| Secret encryption | `node:crypto` AES-256-GCM | built in — no dependency |
| Validation | `zod` | one schema per entity, shared client+server |
| UI | Tailwind CSS + a small local `components/ui` | no heavy component library |
| PDF | `@react-pdf/renderer` | rendered in a Route Handler; **no Puppeteer** |
| File upload (logo) | Vercel Blob | M6, not before |
| Payments | PayMongo Checkout Sessions (hosted, no SDK) | M9, not before — see §5.12 |
| Email | Resend | M10, not before |
| Rate limiting | in-memory per-instance counter in v1 | good enough at this scale; note the limitation |
| Deploy | Vercel | preview per branch, one prod env |

Adding anything not on this table requires explicit human approval. See `AGENTS.md` §4.

---

## 5. Core domain rules

These are product truths. Encode them once in `lib/`, test them, never re-derive them in a component.

### 5.1 Money
- **All money is stored as integer centavos.** Never floats. Field names end in `Centavos`.
- Formatting to `₱1,234.56` happens only at the display/PDF boundary, via `lib/money.ts`.
- Rounding: compute line amounts first, sum, then apply discount, then VAT. Round **half-up to the
  nearest centavo** at each stored step.

### 5.2 VAT
- VAT rate is **12%**, stored per document as `vatRatePercent` so historical documents stay correct
  if the rate ever changes.
- If the business is **not** VAT-registered, `vatCentavos = 0` and the document must not print a
  VAT line.
- VAT is computed on `subtotal − discount`.

### 5.3 Document numbering
- Format `QUO-000001` / `INV-000001`, **sequential per user**, never reused, never renumbered.
- Generated atomically from `counters` via
  `findOneAndUpdate({ userId, kind }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' })`.
- A number is assigned when a document is **first saved**, including drafts.

### 5.4 Statuses
```
Quotation:  DRAFT → SENT → ACCEPTED | DECLINED | EXPIRED
Invoice:    DRAFT → SENT → PAID | OVERDUE | CANCELLED
```
- `OVERDUE` is **derived** at read time (`status === 'SENT' && dueDate < today`), not stored. No cron
  in v1.
- `PAID` and `CANCELLED` are terminal. A `PAID` invoice's line items are immutable.
- Converting a quotation to an invoice sets `quotation.convertedInvoiceId` and leaves the quotation
  `ACCEPTED`.

### 5.5 Ownership — the one rule that matters
- Every document belongs to exactly one `userId`.
- **Every user-surface query is scoped by `userId` from the session** — never from the request body
  or URL. The only two exceptions are the public-token read (§5.6) and the admin surface (§5.8), and
  both are confined to named directories.

### 5.6 Public links
- Token: random 12-char URL-safe string, unguessable, stored as `publicToken`, unique-indexed.
- Public route reads **by token only** and returns a hand-written minimal projection: never the
  user's email, never internal ids, never another document.
- The user can revoke a link (regenerate token). An admin can revoke it for abuse (audited).
- Public pages are `noindex, nofollow` and excluded from the sitemap.

### 5.7 Locale
- Currency PHP. Timezone `Asia/Manila`. Dates displayed as `September 30, 2026`.
- Store all dates as UTC `Date`; convert at the boundary only, via `lib/dates.ts`.

### 5.8 Admin boundary  ← new in v2

1. **Role.** `user.role: 'USER' | 'ADMIN'`, default `'USER'`. **No UI anywhere sets this field.**
   It is set by `npm run grant-admin -- <email>` or by a human in Atlas.
2. **Three independent factors.** `requireAdmin()` grants access only if
   `session.user.role === 'ADMIN'` **AND** `session.user.email` is in the `ADMIN_EMAILS` env
   allowlist **AND** the session carries a fresh `mfaVerifiedAt` (§5.11). A compromised database
   alone must not create an admin; neither must a leaked env file; neither must a stolen password.
3. **One gate.** Every cross-user read or write goes through `lib/admin/guard.ts → requireAdmin()`.
   Cross-user queries may exist **only** in `actions/admin/**` and `lib/admin/**`. An unscoped query
   found anywhere else is a bug, not a style issue.
4. **Admin is read-only over customer content.** Admin may never create, edit, send, or delete a
   quotation, invoice, customer, product, or business profile. The complete list of admin writes is:
   suspend, unsuspend, set plan override, clear plan override, revoke a public token, reset a
   **non-admin** user's MFA, and append an audit entry. Nothing else.
5. **Everything is audited.** Every admin action *and* every read of an identified user's data
   appends an `AdminAuditLog` entry. The log is append-only: no update path, no delete path, no admin
   UI that edits it.
6. **No impersonation in v1.**
7. `/admin/*` is `noindex`, is excluded from the sitemap, and returns **404, not 403**, to a
   non-admin — an admin console should not confirm its own existence to a signed-in stranger.

### 5.9 Suspension semantics
- Fields: `suspendedAt`, `suspendedReason`, `suspendedByUserId`.
- A suspended user **cannot sign in**; the login form shows a neutral message plus a support email.
- Every mutating server action calls `assertNotSuspended()` — a suspension must bite even on a
  session issued before it.
- **Existing public links keep working.** The user's customers did nothing wrong and may still need
  the invoice they were sent.
- For abuse (phishing, illegal content) there is a separate, harsher action: `publicLinksDisabledAt`,
  which makes every public link for that user return 404. It is a distinct audited action, never a
  side effect of suspension.
- Unsuspending clears the fields and writes its own audit entry.

### 5.10 Plan resolution
- Fields: `plan`, `planSource: 'DEFAULT' | 'BILLING' | 'ADMIN'`, `planOverrideExpiresAt`,
  `planOverrideReason`.
- `lib/plan.ts → effectivePlan(user)` resolves in this order: an unexpired `ADMIN` override wins,
  else a **billing term that has not passed its grace date**, else `FREE`. A paid plan is never
  open-ended — see §5.12.
- **The PayMongo webhook must never clobber an active admin override.** The webhook writes billing
  fields; `effectivePlan()` decides. This is what lets you comp a user without billing undoing it
  on the next renewal.
- **Both expiries are self-clearing.** An override ends at `planOverrideExpiresAt`, a paid term at
  `billingGraceUntil`. Neither needs a cron job to demote anyone, and `effectivePlan()` stays a pure
  synchronous function of one user document — which is what makes it cheap to unit-test.
- An admin override always requires a reason and an expiry (default 90 days). Comps that never
  expire become invisible revenue leaks.

### 5.11 Multi-factor authentication (TOTP)  ← new in v2.1

Every account signs in with a password **and** a 6-digit code from an authenticator app (Google
Authenticator, Authy, 1Password — anything implementing RFC 6238). MFA is **mandatory for every user
and every admin**. There is no "disable MFA" action anywhere in the product; there is only "replace
my device".

1. **Fixed parameters: SHA-1, 6 digits, 30-second period.** Google Authenticator silently ignores
   SHA-256 and 8-digit configurations in the enrolment URI and then generates codes that never match,
   producing a bug that looks like a clock problem and isn't. Do not "improve" these values.
2. **The secret is 20 random bytes**, base32-encoded, and **encrypted at rest** with AES-256-GCM
   using `MFA_ENCRYPTION_KEY`. It is never logged, never sent to the client after enrolment, never
   readable by an admin, and never present in a data export. A code the user typed is never logged
   either — not even on failure, not even at debug level.
3. **Enrolment is two-phase.** Phase 1 generates a secret and stores it as *pending*. Phase 2
   requires one correct code before `mfaEnabledAt` is set and the pending secret is promoted. An
   unconfirmed secret expires after 15 minutes and is discarded. A half-finished enrolment must never
   be able to lock someone out.
4. **Verification window is ±1 step (±30s), and no wider.** A wide window is a workaround for server
   clock drift; fix the clock instead.
5. **One code, one use.** Store `mfaLastUsedStep`. A code whose step counter is ≤ the last accepted
   step is rejected even when otherwise valid — this is what stops a shoulder-surfed or
   phished-then-replayed code inside its own 30-second window.
6. **Recovery codes.** Ten single-use codes generated at enrolment, displayed **exactly once**,
   stored bcrypt-hashed like passwords. Using one consumes it and tells the user how many remain;
   below three remaining, a persistent banner offers regeneration. Regenerating invalidates all ten.
7. **Login is two-step, and the middle state is not a session.** After the password verifies, the
   server sets a signed, httpOnly, SameSite=Lax, 5-minute `mfa_challenge` cookie carrying only a
   userId and a nonce. It grants access to nothing except the code form. Auth.js issues the real
   session only after the code verifies. Two steps rather than one combined form because password
   managers autofill the first step and authenticator apps supply the second.
8. **Rate limits.** Five wrong codes invalidate the challenge and send the user back to the password
   step. Ten failures within an hour lock sign-in for 15 minutes. A recovery code shares the same
   budget.
9. **Reset paths differ by role, deliberately.**
   - *User*: a recovery code. Failing that, an audited admin `MFA_RESET` — which clears MFA and
     forces re-enrolment at the next sign-in. It never reveals or reuses the old secret.
   - *Admin*: a recovery code. Failing that, `npm run reset-mfa -- <email>` from the CLI.
     **An admin may never reset another admin's MFA from the console.** One click that removes a
     colleague's second factor is a privilege takeover, not a support tool.
10. **The session records `mfaVerifiedAt`.** `requireAdmin()` requires it (§5.8 rule 2). A session
    minted before MFA existed on that account does not satisfy it.
11. MFA state changes — enrolled, device replaced, recovery code used, codes regenerated, admin reset
    — are notable security events. Log them server-side from M1; email them to the account owner from
    M9 when Resend exists.

### 5.12 Billing semantics  ← new in v2.2

Bilyo sells **prepaid 30-day terms**, not auto-renewing subscriptions. PayMongo's Subscriptions API
is card-only and has to be enabled on the account by PayMongo on request; card-only billing would
shut out GCash and Maya, which is most of this market. So M9 charges through a **Checkout Session
per term** and the plan carries an expiry date. Auto-renewal is a later upgrade (§12), and the design
below is shaped so it can land without changing `lib/plan.ts` or the billing page.

1. **Prices live on the server, in one table.** `lib/billing/plans.ts` maps `FREELANCER → 29900` and
   `BUSINESS → 59900` centavos. The client sends a plan *name*; it never sends an amount. An amount
   that arrives from a form is a free upgrade waiting to happen.
2. **A term is `billingPlan` + `billingPaidUntil` + `billingGraceUntil`.** A paid checkout sets
   `billingPaidUntil = max(now, existing billingPaidUntil) + 30 days`, snapped to 23:59:59
   `Asia/Manila`, and `billingGraceUntil = billingPaidUntil + 7 days`. Renewing early **stacks** onto
   the remaining term; it never truncates it. Paying twice by accident buys two terms, not one.
3. **Grace is seven days and it is visible.** Between `billingPaidUntil` and `billingGraceUntil` the
   plan still works and the dashboard shows a renewal banner with the exact end date. After
   `billingGraceUntil`, `effectivePlan()` returns `FREE` on its own.
4. **Lapsing never destroys anything.** Documents, customers and public links stay exactly as they
   are. Only *new* creates meet the FREE limits again. A user who lapses holding 40 customers keeps
   all 40 and simply cannot add a 41st.
5. **There is nothing to cancel.** Nothing is ever charged automatically, so the billing page states
   when the plan ends instead of offering a cancel button. A cancel action appears only if
   auto-renewal is ever added.
6. **The redirect is not the payment.** `success_url` is a UI convenience and proves nothing — a user
   can type it. **The webhook is the only writer of billing fields.** The success page reads the
   checkout record and, while it is still pending, says "confirming your payment" and offers a
   re-check. Granting a plan because a browser reached a URL is the standard way to give this product
   away for free.
7. **The webhook writes an allowlist and nothing else:** `billingPlan`, `billingPaidUntil`,
   `billingGraceUntil`, `billingCustomerId`, `billingLastPaymentAt`. It must never write `plan`,
   `planSource`, `planOverrideExpiresAt` or `planOverrideReason`. That is §5.10 made mechanical: the
   update object is a literal with five keys, and a test asserts it.
8. **Idempotency is a unique index, not an `if`.** Every received event is inserted into
   `billingEvents` keyed by PayMongo's event id, and the duplicate-key error *is* the "already
   handled" branch. The grant is then a conditional update guarded on `status: 'PENDING'`, so two
   concurrent deliveries of the same event still grant exactly one term.
9. **Assume webhooks get lost.** PayMongo retries a failing endpoint 12 times and disables it after
   three events exhaust their retries, so a bad deploy can silently cost a day of payments. A daily
   reconcile job and a per-checkout "Re-check payment" button both re-fetch the session from PayMongo
   and run the same grant path. Because the grant is idempotent, replaying it is free. This is the
   fix behind the runbook's "I was charged but I'm still on FREE".
10. **Refunds happen in the PayMongo dashboard, never in Bilyo.** A `payment.refunded` event is
    recorded and surfaced to admin; it does **not** automatically revoke a term. Clawing back access
    is a judgement call, so it is an audited admin action, not a webhook side effect.
11. **Money is centavos, integers, everywhere** — same rule as `lib/money.ts`. The amount charged is
    stored on the checkout row, so a future price change never rewrites what someone actually paid.

---

## 6. Data model

One database. Seven collections plus `counters`, `adminAuditLogs` and the two billing collections.
Mongoose models in `models/`, one file per collection, `timestamps: true` on all of them.

```
users · businesses · customers · products · quotations · invoices
counters · passwordResetTokens · adminAuditLogs
billingCheckouts · billingEvents                      ← M9
```

```ts
// User  — carries both the user-side and the admin-side fields
{
  _id, email (lowercase, unique), passwordHash, name,
  emailVerifiedAt,                       // unused until M9

  // plan (§5.10)
  plan: 'FREE' | 'FREELANCER' | 'BUSINESS',
  planSource: 'DEFAULT' | 'BILLING' | 'ADMIN',
  planOverrideExpiresAt, planOverrideReason,

  // billing (§5.12) — written only by the webhook and the reconcile job, M9
  billingPlan,                           // the tier the term bought; null if never paid
  billingPaidUntil,                      // end of the paid term, 23:59:59 Asia/Manila
  billingGraceUntil,                     // = billingPaidUntil + 7d; this is the field effectivePlan() reads
  billingLastPaymentAt,
  billingCustomerId,                     // PayMongo customer id — reserved for the auto-renewal upgrade

  // MFA (§5.11) — mandatory for every account
  mfaEnabledAt,
  mfaSecretEncrypted,                    // AES-256-GCM; never logged, never exported, never shown to an admin
  mfaPendingSecretEncrypted, mfaPendingExpiresAt,
  mfaLastUsedStep,                       // replay guard
  mfaRecoveryCodeHashes: [String],       // bcrypt, single-use, spliced out when consumed
  mfaFailedAttempts, mfaLockedUntil,

  // admin (§5.8, §5.9)
  role: 'USER' | 'ADMIN',                // default 'USER', no UI sets it
  suspendedAt, suspendedReason, suspendedByUserId,
  publicLinksDisabledAt,
  deletionRequestedAt,                   // soft account closure, M6-T05

  // support signal — cheap, and the first thing you want in the admin list
  lastLoginAt, lastActiveAt,
  createdAt, updatedAt
}

// Business  (one per user in v1)
{ _id, userId (unique), businessName, address, email, phone, tin,
  vatRegistered: boolean, logoUrl, createdAt, updatedAt }

// Customer
{ _id, userId, name, email, phone, address, tin, notes,
  archived: boolean, createdAt, updatedAt }

// Product
{ _id, userId, name, description, unitPriceCentavos, unit,
  archived: boolean, createdAt, updatedAt }

// Invoice
{ _id, userId, customerId,
  number,                                 // "INV-000001"
  customerSnapshot: { name, email, phone, address, tin },      // frozen at first send
  businessSnapshot: { businessName, address, email, phone, tin, vatRegistered, logoUrl },
  items: [{ description, quantity, unitPriceCentavos, amountCentavos }],
  subtotalCentavos, discountCentavos, vatRatePercent, vatCentavos, totalCentavos,
  status, issueDate, dueDate, paidAt, notes, terms,
  publicToken, publicTokenRevokedAt, sourceQuotationId,
  createdAt, updatedAt }

// Quotation — identical to Invoice except:
//   number "QUO-000001", validUntil instead of dueDate,
//   no paidAt, plus convertedInvoiceId

// BillingCheckout  — one row per Checkout Session we create. The intent record. (§5.12, M9)
// This, not the webhook payload, is the authority on which plan a payment bought.
{ _id, userId,
  plan: 'FREELANCER' | 'BUSINESS',
  amountCentavos,                         // snapshot of the price at purchase time
  termDays,                               // 30 — snapshotted so changing the term never rewrites history
  checkoutSessionId,                      // PayMongo "cs_..."  — unique
  referenceNumber,                        // our own id, echoed to PayMongo — unique
  checkoutUrl,
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED',
  paidAt, paymentId,                      // PayMongo "pay_..."
  grantedTermStart, grantedTermEnd,       // what this payment actually bought, after stacking
  refundedAt,                             // set from payment.refunded; does NOT revoke the term (§5.12.10)
  createdAt, updatedAt }

// BillingEvent  — one row per webhook delivery. Append-only; the audit trail for money. (§5.12, M9)
// The unique index on eventId IS the idempotency mechanism — a duplicate key means "already done".
{ _id,
  eventId,                                // PayMongo event id — unique, this is the whole design
  type,                                   // 'checkout_session.payment.paid' | 'payment.paid' |
                                          // 'payment.failed' | 'payment.refunded'
  source: 'WEBHOOK' | 'RECONCILE' | 'MANUAL_RECHECK',
  checkoutId, userId,                     // resolved if we recognised the session; null otherwise
  outcome: 'GRANTED' | 'DUPLICATE' | 'UNKNOWN_SESSION' | 'IGNORED' | 'ERROR',
  outcomeNote,
  payload,                                // the event body, trimmed — never card data, never a raw key
  receivedAt, processedAt }

// Counter
{ _id, userId, kind: 'INVOICE' | 'QUOTATION', seq }

// PasswordResetToken
{ _id, userId, tokenHash, expiresAt, usedAt, createdAt }

// AdminAuditLog  — append-only (§5.8 rule 5)
{ _id,
  actorUserId,                            // which admin
  actorEmail,                             // denormalised: survives a later email change
  action,                                 // 'USER_VIEW' | 'DOCUMENT_VIEW' | 'USER_SUSPEND' |
                                          // 'USER_UNSUSPEND' | 'PLAN_OVERRIDE_SET' |
                                          // 'PLAN_OVERRIDE_CLEAR' | 'PUBLIC_LINK_REVOKE' |
                                          // 'PUBLIC_LINKS_DISABLE' | 'PUBLIC_LINKS_ENABLE' |
                                          // 'MFA_RESET'
  targetUserId, targetType, targetId,
  reason,                                 // required on every write action
  before, after,                          // small diffs only; never a whole document
  ip, userAgent,
  createdAt }
```

**Snapshots matter.** Once a document is `SENT`, editing the customer record or business profile must
not change what the customer already received. Snapshot on first send.

**Indexes** (declare them in the model files):

```
users:               { email: 1 } unique
                     { mfaPendingExpiresAt: 1 } TTL-ish sparse   // sweep abandoned enrolments
                     { role: 1 }
                     { createdAt: -1 }              // admin user list default sort
                     { suspendedAt: 1 } sparse
businesses:          { userId: 1 } unique
customers:           { userId: 1, name: 1 }
products:            { userId: 1, name: 1 }
invoices:            { userId: 1, createdAt: -1 }
                     { userId: 1, number: 1 } unique
                     { publicToken: 1 } unique sparse
                     { number: 1 }                  // admin support lookup, cross-user
quotations:          same shape as invoices
counters:            { userId: 1, kind: 1 } unique
passwordResetTokens: { tokenHash: 1 } unique, { expiresAt: 1 } TTL
adminAuditLogs:      { createdAt: -1 }, { targetUserId: 1, createdAt: -1 }, { actorUserId: 1, createdAt: -1 }
billingCheckouts:    { checkoutSessionId: 1 } unique
                     { referenceNumber: 1 } unique
                     { userId: 1, createdAt: -1 }   // billing page + admin billing view
                     { status: 1, createdAt: 1 }    // the reconcile job's only query
billingEvents:       { eventId: 1 } unique          // load-bearing: this is what makes replay a no-op
                     { userId: 1, receivedAt: -1 }
                     { receivedAt: -1 }
```

---

## 7. Route map

### 7.1 User surface and public surface

| Path | Type | Auth | Purpose |
|---|---|---|---|
| `/` | page | public | Landing + pricing |
| `/login` `/register` `/forgot-password` `/reset-password` | page | public | Auth |
| `/login/mfa` | page | challenge cookie | Step 2 — 6-digit code or a recovery code |
| `/onboarding/mfa` | page | session, pre-MFA | Mandatory enrolment gate — QR + confirm + recovery codes |
| `/dashboard/account/security` | page | user | Replace device, regenerate recovery codes |
| `/dashboard` | page | user | Metrics + recent documents |
| `/dashboard/customers` `/new` `/[id]` | page | user | Customer CRUD |
| `/dashboard/products` `/new` `/[id]` | page | user | Product CRUD |
| `/dashboard/quotations` `/new` `/[id]` | page | user | Quotation builder |
| `/dashboard/invoices` `/new` `/[id]` | page | user | Invoice builder |
| `/dashboard/settings` | page | user | Business profile |
| `/dashboard/account` | page | user | Password, email, export, close account |
| `/dashboard/billing` | page | user | Current term, end date, renew / upgrade, payment history (M9) |
| `/dashboard/billing/return` | page | user | PayMongo `success_url` — reads the checkout row, never grants (§5.12.6) |
| `/i/[token]` `/q/[token]` | page | public | Customer-facing document |
| `/api/auth/[...nextauth]` | handler | public | Auth.js |
| `/api/invoices/[id]/pdf` `/api/quotations/[id]/pdf` | handler | user | PDF stream, ownership-checked |
| `/api/public/i/[token]/pdf` `/api/public/q/[token]/pdf` | handler | public | PDF via token |
| `/api/webhooks/paymongo` | handler | **signature only, no session** | M9 — the only writer of billing fields |
| `/api/cron/billing-reconcile` | handler | `CRON_SECRET` bearer | M9 — daily sweep for lost webhooks (§5.12.9) |

### 7.2 Admin surface  ← new in v2

| Path | Type | Auth | Purpose |
|---|---|---|---|
| `/admin` | page | admin | Platform metrics |
| `/admin/users` | page | admin | Searchable, filterable user list |
| `/admin/users/[id]` | page | admin | One user: profile, plan, counts, actions, their audit trail |
| `/admin/users/[id]/documents` | page | admin | That user's documents, read-only |
| `/admin/lookup` | page | admin | Find a document by number or public token, across all users |
| `/admin/documents/[kind]/[id]` | page | admin | Read-only document view (the support view) |
| `/admin/audit` | page | admin | Audit log, newest first, filterable |

**No `/api/admin/*` route handlers.** Admin mutations are Server Actions in `actions/admin/`, exactly
like the rest of the app. Admin never gets a REST API "because it's internal".

**Mutations use Server Actions** everywhere. Route Handlers exist only for: auth, PDF streams, public
token reads, and webhooks.

---

## 8. End-to-end flows

An agent building a screen should be able to read the relevant flow here and know every state it has
to handle. `→` is a step, `⟂` is a failure branch that must be designed, not just caught.

### 8.1 User: first run (register → first PDF)

```
/register
  → zod validate → email lowercased, uniqueness checked → bcrypt hash (cost 10)
  → user created (role USER, plan FREE, planSource DEFAULT) → auto sign-in
  ⟂ email taken       → inline field error, no account enumeration difference in timing
  ⟂ weak password     → inline rule text, form keeps the typed values
→ middleware sees mfaEnabledAt unset → redirect /onboarding/mfa  (§8.9 — cannot be skipped)
→ middleware sees no Business for this user → redirect /dashboard/settings?onboarding=1
→ business profile saved (VAT toggle decides whether documents ever print a VAT line)
→ /dashboard/customers/new → first customer
→ /dashboard/quotations/new
     line items → live totals client-side (feedback only)
     → save → SERVER recomputes totals from items → number QUO-000001 assigned on first save
     ⟂ totals mismatch → server value wins silently, client re-renders from the server result
→ "Send" → status DRAFT→SENT → business + customer snapshots frozen → publicToken generated
→ Download PDF  /api/quotations/[id]/pdf  → QUO-000001.pdf
→ Copy link     /q/<token>
```
**Success condition for the whole product:** a brand-new user reaches a correct PDF in under ten
minutes without asking anyone a question.

### 8.2 User: quotation accepted → invoice paid

```
/dashboard/quotations/[id] → mark ACCEPTED
→ "Convert to invoice"
     copies items, totals, both snapshots → sets sourceQuotationId + convertedInvoiceId
     → new INV-000001 in DRAFT
     ⟂ converted already → open the existing invoice; never create a second one (idempotent)
→ edit dueDate → Send → SENT
→ time passes, dueDate < today → list and detail derive OVERDUE at read time (nothing stored)
→ "Mark as paid" → paidAt set → PAID → line items now immutable
     ⟂ user tries to edit a PAID invoice → fields disabled + one-line explanation, not a crash
→ "Cancel" (only from DRAFT/SENT/OVERDUE) → CANCELLED, terminal
```

### 8.3 Customer: receiving a document (no account, likely on a phone)

```
opens /i/<token>
  → token lookup only → minimal projection → read-only view, no app chrome, noindex
  → "Download PDF" → /api/public/i/<token>/pdf
  ⟂ token unknown / revoked / links disabled → a plain 404 page.
    Never "this invoice was revoked" — that confirms the token existed.
```

### 8.4 User: account lifecycle

```
/dashboard/account
  → change password (requires current password; all other sessions unaffected in v1 — JWT)
  → change email (uniqueness re-checked, lowercased; emailVerifiedAt cleared)
  → export my data (JSON + CSV of documents — PH Data Privacy Act portability)
  → close account → deletionRequestedAt set, sign-out, login blocked
    ⟂ nothing is hard-deleted; documents survive for the retention window
→ forgot password → single-use token, hashed at rest, 1-hour expiry
    (until M9 the link is printed to the server log instead of emailed)
```

### 8.5 Admin: the support ticket flow — *the one that matters*

> A user emails: "my customer says the link you sent is broken — invoice INV-000042."

```
/admin/lookup → paste "INV-000042" (or a public token)
  → cross-user search, requireAdmin(), AdminAuditLog { action: 'DOCUMENT_VIEW' } appended
  → /admin/documents/invoice/[id]: read-only render — same data the user sees, no edit affordances
  → shows: owner (link to /admin/users/[id]), status, token state (active / revoked / links disabled)
  → answer the ticket
  ⟂ the token is revoked → tell the user to re-issue the link from their own dashboard.
    The admin does NOT un-revoke it — reissuing is the user's action, not yours.
```

### 8.6 Admin: abuse report

```
/admin/users/[id]
  → read the account: signup date, doc counts, last active, plan
  → "Disable public links" → requires a reason → publicLinksDisabledAt set → audited
       effect: every /i/* and /q/* for that user now 404s. Their dashboard still works.
  → if the account itself is the problem: "Suspend" → reason required → audited
       effect: cannot sign in; every mutating action rejects; public links unaffected by this action
  → both are reversible, and the reversal is its own audit entry
  ⟂ never delete. Never edit their documents. Never "fix" their data by hand.
```

### 8.7 Admin: comping a user

```
/admin/users/[id] → "Override plan"
  → choose plan + reason + expiry (default 90 days) → planSource='ADMIN' → audited
  → effectivePlan() now returns the override; limit checks in lib/plan.ts follow it immediately
  → PayMongo events keep writing billing fields underneath and never win while the override is live
  → override expires on its own → effectivePlan() falls back to billing/FREE with no cleanup job
```

### 8.8 Admin: the weekly look

```
/admin → total users · new users 7d / 30d · active users 30d (created a document)
       · documents created 30d by kind · paid accounts · MRR · suspended count
  → each tile is one aggregation, cached 5 minutes. Never N queries in a loop.
```

### 8.9 Any account: MFA enrolment (mandatory, at first sign-in)

```
/onboarding/mfa  — reachable only with a session whose mfaEnabledAt is unset;
                   every other route redirects here until it is done
  → server generates 20 random bytes → base32 → stores as PENDING (15-min expiry, encrypted)
  → server renders the QR as a data URL from
      otpauth://totp/Bilyo:<email>?secret=…&issuer=Bilyo&algorithm=SHA1&digits=6&period=30
    and shows the base32 string too, for a user who can't scan
  → user scans in Google Authenticator → types the current code
  → server verifies (±1 step) → promotes PENDING to active → sets mfaEnabledAt
  → 10 recovery codes generated, shown ONCE, downloadable as .txt, bcrypt-hashed at rest
  → user must tick "I've saved these" before continuing
  ⟂ wrong code            → re-prompt, keep the same pending secret, 5 tries then regenerate
  ⟂ pending expired       → new secret, new QR, plain explanation
  ⟂ user closes the tab   → nothing was enabled; next sign-in starts enrolment clean
```
The secret is never shown again after this screen. Losing the device from here is a recovery-code
problem, and after that a §8.11 problem.

### 8.10 Any account: signing in with MFA

```
/login → email + password
  ⟂ wrong → same message and comparable timing for a bad password and an unknown email
  → password OK, account not suspended
  → signed httpOnly mfa_challenge cookie (5 min, userId + nonce). NOT a session.
  → redirect /login/mfa
/login/mfa → 6-digit code   (or "use a recovery code")
  → verify ±1 step AND step > mfaLastUsedStep  → store the step
  → Auth.js issues the session, carrying mfaVerifiedAt → callbackUrl
  ⟂ replayed code       → rejected, counted as a failure
  ⟂ 5 wrong codes       → challenge destroyed, back to the password step
  ⟂ 10 failures in 1 hr → sign-in locked 15 minutes, message says when it lifts
  ⟂ challenge expired   → back to the password step, no partial access at any point
  ⟂ recovery code used  → consumed, remaining count shown, banner if fewer than 3 left
```

### 8.11 Lost device

```
User, has recovery codes  → sign in with one → /dashboard/account/security → replace device
User, no recovery codes   → emails support → admin verifies identity out of band
                          → /admin/users/[id] → "Reset MFA" + typed reason → audited MFA_RESET
                          → user's next sign-in restarts enrolment (§8.9) with a NEW secret
Admin, has recovery codes → same as a user
Admin, no recovery codes  → npm run reset-mfa -- <email>, from a machine with DB access
                          ⟂ the console offers no button for this. Ever. (§5.11 rule 9)
```

### 8.12 User: buying and renewing a plan  ← new in v2.2

```
/dashboard/billing  (or an M8 upgrade prompt)  → "Freelancer ₱299 / 30 days"
  → startCheckout('FREELANCER')  → server prices it, writes a PENDING billingCheckouts row
  → PayMongo hosted page → GCash / Maya / GrabPay / card
  → PayMongo redirects to /dashboard/billing/return?ref=...
       this page GRANTS NOTHING — it reads the row (§5.12.6)
  → webhook checkout_session.payment.paid arrives (usually before the redirect, sometimes after)
       → billingEvents insert (unique eventId)
       → row PENDING→PAID  → billingPaidUntil += 30d, billingGraceUntil = +7d
  → return page now shows "Freelancer until 7 Oct 2026"
  ⟂ user closes the tab mid-payment  → row stays PENDING → reconcile grants it, or 24h → EXPIRED
  ⟂ payment fails in the simulator   → cancel_url → /dashboard/billing, plan unchanged, row FAILED
  ⟂ webhook never arrives            → return page still says "confirming" → Re-check payment
                                       → same grant path → granted. Nightly job is the backstop
  ⟂ webhook arrives twice            → duplicate eventId → 200, nothing changes (§5.12.8)
  ⟂ user renews on day 12 of 30      → new term stacks: ends day 42, not day 30 (§5.12.2)
  ⟂ user has a live admin override   → billing fields still update, effectivePlan() still returns
                                       the override, billing page says the plan is comped
  ⟂ term ends, nobody renews         → 7 days of grace with a banner → then FREE, no job ran
                                       → all existing documents and customers remain, intact
```
---

## 9. Screen inventory and required UI states

Every screen below must handle **all five** states. "It works when the data is there" is half a
screen. An agent that ships a list without an empty state has not finished the task.

`L` loading · `E` empty · `X` error · `D` denied/not-found · `M` mobile 390px

| Surface | Screen | L | E | X | D | M | Notes an agent must honour |
|---|---|---|---|---|---|---|---|
| User | Dashboard | ✓ | ✓ | ✓ | — | ✓ | Empty = "Create your first quotation" CTA, not zeroes |
| User | Customers / Products list | ✓ | ✓ | ✓ | — | ✓ | Search debounced; archived hidden by default |
| User | Document builder | ✓ | ✓ | ✓ | ✓ | ✓ | Mobile: line items become stacked cards, not a squeezed table |
| User | Document detail | ✓ | — | ✓ | ✓ | ✓ | Status-driven actions; PAID/CANCELLED disable editing with a reason |
| Auth | `/onboarding/mfa` enrolment | ✓ | — | ✓ | ✓ | ✓ | QR **and** the typable secret; recovery codes need a confirm tick |
| Auth | `/login/mfa` code entry | ✓ | — | ✓ | ✓ | ✓ | 6 single-char inputs or one field; `inputmode="numeric"`, `autocomplete="one-time-code"`, paste works |
| User | Account → Security | ✓ | — | ✓ | — | ✓ | Remaining recovery codes, replace device, regenerate |
| User | Settings / Account | ✓ | ✓ | ✓ | — | ✓ | Onboarding banner when arriving with `?onboarding=1` |
| Public | `/i/[token]` `/q/[token]` | ✓ | — | ✓ | ✓ | ✓ | No nav, no login prompt, no branding of the *platform* over the *business* |
| Admin | Metrics | ✓ | ✓ | ✓ | ✓ | — | Empty = "no data yet", never a broken chart. Desktop-first is fine |
| Admin | User list | ✓ | ✓ | ✓ | ✓ | — | Server-side pagination from day one; never load all users |
| Admin | User detail | ✓ | — | ✓ | ✓ | — | Destructive actions need a typed reason before the button enables |
| Admin | Lookup | ✓ | ✓ | ✓ | ✓ | — | Empty query ≠ "all documents". Require ≥ 4 characters |
| Admin | Document (read-only) | ✓ | — | ✓ | ✓ | — | Visibly read-only: banner + zero edit controls, not just disabled inputs |
| Admin | Audit log | ✓ | ✓ | ✓ | ✓ | — | Newest first, paginated, filter by actor / target / action |

**`D` on every admin screen is a 404, not a 403** (§5.8 rule 7).

---

## 10. How an agent works a task

Every task in §11 has the same three parts, and they are a contract:

- **Files** — what you create or touch. If you need a file that isn't listed, that's a signal to stop
  and say so, not to improvise a new architecture.
- **Do** — the work, in enough detail that you don't have to guess the domain rules.
- **Accept** — the acceptance criteria. **Tick the checkbox only when every line passes**, and tick it
  in the same commit as the work (`AGENTS.md` §7).

Work tasks **in order**. The order encodes dependencies; a task's prerequisites are always above it.
If you believe a task is already done, verify it against *Accept* before ticking — a file existing is
not the same as a criterion passing.

At the end of a task, report in the `AGENTS.md` §8 format: task ID, files, verification results, what
you did **not** do, decisions taken.

---

## 11. Milestones

Effort is in focused hours. At ~10 hrs/week: **M0–M4 ("first sellable slice") ≈ 7–9 weeks**,
**M0–M7 (live, with a support console) ≈ 13–16 weeks**.

| M | Name | Hours | Ships what |
|---|---|---|---|
| M0 | Foundation | 8–10 | connection, models (incl. admin fields), domain utils |
| M1 | Authentication | 16–18 | register, login, reset, guards, role + suspension, **admin TOTP** |
| M2 | Business profile & contacts | 8–10 | settings, customers, products |
| M3 | Quotations + PDF | 14–18 | the hard one — builder, totals, PDF |
| M4 | Invoices + public links | 12–14 | invoices, public views, conversion |
| M5 | Dashboard & polish | 8–10 | metrics, states, mobile |
| M6 | Ship it | 12–14 | logo upload, deploy, security pass, account page, **MFA for all users** |
| M7 | **Admin console** | 15–17 | support lookup, user list, suspend, plan override, audit |
| M8 | Plan limits | 5–6 | free-tier enforcement |
| M9 | Monetization | 20–25 | PayMongo checkout, webhook, reconcile, billing page |
| M10 | Transactional email | 5–7 | Resend, password reset, "invoice is ready", verification |

---

### M0 — Foundation (8–10 hrs)

- [x] **M0-T01 · Scaffold project** (1h)
  *Accept:* `npm run dev` serves a page; `npm run build` passes.

- [x] **M0-T02 · Repo hygiene** (1h)
  *Accept:* `npm run typecheck && npm run lint` both exit 0.

- [x] **M0-T03 · MongoDB connection** (2h)
  *Files:* `lib/mongodb.ts`, `app/api/health/route.ts`
  *Do:* global cached-connection pattern so a serverless re-invocation reuses the pool instead of
  opening a new one. Fail loudly at startup if `MONGODB_URI` is missing.
  *Accept:* `GET /api/health` returns `{ db: "ok" }` against a real Atlas cluster; hitting it ten
  times in a row does not grow the connection count in the Atlas metrics view.

- [x] **M0-T04 · Models + indexes** (3h)
  *Files:* `models/user.ts`, `business.ts`, `customer.ts`, `product.ts`, `quotation.ts`,
  `invoice.ts`, `counter.ts`, `password-reset-token.ts`, `admin-audit-log.ts`, `types/index.ts`
  *Do:* all nine models exactly per §6, `timestamps: true`, every index declared in the schema.
  **Include the admin fields on `User` now** (`role`, `suspendedAt`, `suspendedReason`,
  `publicLinksDisabledAt`, `planSource`, `planOverrideExpiresAt`, `planOverrideReason`,
  `lastLoginAt`, `lastActiveAt`) even though nothing reads them until M7 — retrofitting fields onto a
  live users collection is the one migration worth avoiding.
  *Accept:* `npm run typecheck` passes; a throwaway script inserts and reads one document of each
  type; `db.users.getIndexes()` shows every index from §6.

- [x] **M0-T05 · Domain utilities + tests** (3h)
  *Files:* `lib/money.ts`, `lib/totals.ts`, `lib/numbering.ts`, `lib/dates.ts` + tests
  *Do:* §5.1–5.3. `money.ts` converts centavos ⇄ display and parses peso input **without
  `parseFloat`**. `totals.ts` takes items + discount + vatRegistered and returns every stored field.
  `numbering.ts` wraps the atomic counter.
  *Accept:* unit tests cover VAT on and off, discount applied before VAT, half-up rounding at exactly
  `.005`, a zero-item document, a quantity of `0`, and 1,000 near-concurrent `nextNumber()` calls
  producing **zero duplicates**.

---

### M1 — Authentication (16–18 hrs)

- [x] **M1-T01 · Auth.js setup** (3h)
  *Files:* `lib/auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `types/next-auth.d.ts`
  *Do:* Credentials provider, JWT sessions. Put **`userId` and `role`** on the token and session —
  role must come from the DB at sign-in, never from client input. Export `auth()`, `signIn`,
  `signOut`.
  *Accept:* `await auth()` in a Server Component returns `{ user: { id, email, role } }`; a signed-in
  user's `role` cannot be changed by anything the browser sends.

- [x] **M1-T02 · Register** (2h)
  *Files:* `actions/auth.ts`, `lib/validation/auth.ts`, `app/(auth)/register/page.tsx`
  *Do:* zod-validated Server Action; email lowercased and uniqueness-checked; `bcryptjs` cost 10;
  new users get `role: 'USER'`, `plan: 'FREE'`, `planSource: 'DEFAULT'`; auto sign-in on success.
  *Accept:* duplicate email returns a field error, not a 500; the stored hash starts with `$2`; no
  password value ever appears in a log line.

- [x] **M1-T03 · Login / logout UI** (2h)
  *Files:* `app/(auth)/login/page.tsx`, `components/auth/*`
  *Do:* inline field errors, no raw error dumps, `callbackUrl` respected. Set `lastLoginAt`.
  *Accept:* a wrong password and an unknown email produce the **same** message and comparable
  response time.

- [x] **M1-T04 · Route protection** (2h)
  *Files:* `middleware.ts`
  *Do:* guard `/dashboard/*` (session required) **and** `/admin/*` (session + `role === 'ADMIN'`).
  Unauthenticated → `/login?callbackUrl=…`. Non-admin hitting `/admin/*` → **404**, per §5.8 rule 7.
  *Accept:* signed-out `/dashboard` redirects; a normal signed-in user gets a 404 body on `/admin`
  and on `/admin/users`; no admin string appears in the client bundle for a normal user.

- [x] **M1-T05 · Suspension + role guards** (2h)  ← new in v2
  *Files:* `lib/auth-guards.ts` (`requireUser()`, `assertNotSuspended()`), `lib/admin/guard.ts`
  (`requireAdmin()`)
  *Do:* `requireUser()` returns the session user or throws `UNAUTHORIZED`. `assertNotSuspended()`
  re-reads the user and throws if `suspendedAt` or `deletionRequestedAt` is set — a session issued
  before a suspension must stop working. `requireAdmin()` enforces **both** factors from §5.8 rule 2
  and returns the admin user. Sign-in rejects a suspended user with a neutral message plus
  `SUPPORT_EMAIL`.
  *Accept:* setting `suspendedAt` in the DB blocks the next sign-in **and** the next mutating action
  on an already-open session; `requireAdmin()` throws when the role is ADMIN but the email is absent
  from `ADMIN_EMAILS`, and when the email is present but the role is not ADMIN.

- [x] **M1-T06 · Password reset** (2h)
  *Files:* `actions/auth.ts`, `app/(auth)/forgot-password/`, `app/(auth)/reset-password/`
  *Do:* single-use token, hashed at rest, 1-hour expiry, TTL index. Until M9, print the link to the
  server log instead of emailing it.
  *Accept:* a used token fails on reuse; an expired token fails; requesting a reset for an unknown
  email returns the same confirmation as a known one.

- [x] **M1-T07 · Admin bootstrap script** (1h)  ← new in v2
  *Files:* `scripts/grant-admin.ts`, `package.json` script `grant-admin`
  *Do:* `npm run grant-admin -- someone@example.com` flips `role` to `ADMIN` and prints the reminder
  that the email must also be added to `ADMIN_EMAILS`. This is the **only** way an admin is created.
  *Accept:* running it on a non-existent email exits non-zero with a clear message; running it twice
  is idempotent; there is no code path anywhere in `app/` or `actions/` that writes `role`.

- [x] **M1-T08 · TOTP core** (3h)  ← new in v2.1
  *Files:* `lib/mfa.ts`, `lib/crypto.ts`, `lib/validation/mfa.ts`
  *Do:* `otpauth` wrappers per §5.11 — `generateSecret()`, `buildOtpauthUri(email, secret)` pinned to
  **SHA-1 / 6 digits / 30s**, `verifyCode(secret, code, lastStep)` returning the accepted step or
  null, `generateRecoveryCodes()` (10 codes, bcrypt-hashed), `consumeRecoveryCode()`.
  `lib/crypto.ts` does AES-256-GCM encrypt/decrypt against `MFA_ENCRYPTION_KEY` and throws loudly at
  boot if the key is missing or not 32 bytes.
  *Accept:* unit tests cover a valid code, a code one step early and one step late (both accepted), a
  code two steps out (rejected), a **replayed** code at or below `mfaLastUsedStep` (rejected), a
  malformed code, a consumed recovery code, and an encrypt→decrypt round trip. A generated URI pasted
  into a real Google Authenticator install produces codes this function accepts. `grep -ri "secret"`
  across the log statements in `lib/` returns nothing that prints one.

- [x] **M1-T09 · Two-step sign-in + admin enforcement** (3h)  ← new in v2.1
  *Files:* `lib/auth.ts`, `actions/auth.ts`, `app/(auth)/login/mfa/page.tsx`,
  `app/(onboarding)/onboarding/mfa/page.tsx`, `lib/admin/guard.ts`, `middleware.ts`,
  `scripts/reset-mfa.ts`
  *Do:* the §8.10 challenge flow — the `mfa_challenge` cookie is signed, httpOnly, SameSite=Lax and
  5-minute; Auth.js issues the session only after the code verifies, stamping `mfaVerifiedAt` on the
  token. Enrolment (§8.9) with a server-rendered QR data URL. `requireAdmin()` gains the third
  factor. Middleware forces an account with `mfaEnabledAt` unset to `/onboarding/mfa`. Ship the
  `reset-mfa` CLI in the same task — an admin who enrols and loses their phone before it exists is
  locked out of their own platform.
  *Do not:* apply the enrolment gate to non-admin users yet — that is M6-T06, after the rest of the
  product exists to be enrolled into.
  *Accept:* an admin cannot reach any `/admin/*` route with a session that predates MFA; the
  challenge cookie alone opens no page but `/login/mfa`; 5 wrong codes destroy the challenge; a
  correct code replayed immediately is rejected; the QR is generated server-side and no request for
  it leaves the origin; `npm run reset-mfa -- <email>` clears MFA and forces re-enrolment.

*Milestone accept:* a user can register, log out, log back in, and reset their password; cannot reach
`/dashboard` signed out; cannot reach `/admin` at all; a suspended user cannot sign in; you can make
yourself an admin only from the CLI plus an env change **plus enrolling an authenticator app — and
an admin session without a verified code reaches nothing**.

---

### M2 — Business profile & contacts (8–10 hrs)

- [x] **M2-T01 · Business profile form** (3h)
  *Files:* `app/(dashboard)/dashboard/settings/page.tsx`, `actions/business.ts`,
  `lib/validation/business.ts`
  *Do:* every §6 Business field; VAT-registered toggle with a one-line explanation of what it changes
  on documents. Logo is a plain URL text field until M6-T01.
  *Accept:* saving twice updates rather than creating a second business; TIN accepts the PH
  `000-000-000-000` shape and blanks.

- [x] **M2-T02 · Onboarding gate** (1h)
  *Files:* `app/(dashboard)/dashboard/layout.tsx`
  *Do:* a signed-in user with no Business is redirected to `/dashboard/settings?onboarding=1` with a
  one-line explainer banner.
  *Accept:* the redirect fires once and does not loop after the profile is saved.

- [x] **M2-T03 · Customers CRUD** (3h)
  *Files:* `app/(dashboard)/dashboard/customers/**`, `actions/customers.ts`,
  `lib/validation/customer.ts`
  *Do:* list with search, create, edit, **archive** (never hard-delete — `AGENTS.md` §4).
  *Accept:* archiving a customer referenced by a sent document leaves that document intact and still
  rendering the snapshot; archived customers are hidden from the picker but visible under a filter.

- [x] **M2-T04 · Products CRUD** (2h)
  *Files:* `app/(dashboard)/dashboard/products/**`, `actions/products.ts`
  *Do:* same shape as customers; price typed in pesos, stored in centavos through `lib/money.ts`.
  *Accept:* entering `1,234.56` stores `123456`; entering `1234.565` is rejected or rounded half-up
  deliberately, not silently truncated.

*Milestone accept:* profile, 3 customers, and 3 products survive a full reload and a re-login.

---

### M3 — Quotations + PDF (14–18 hrs) ← *the hard one*

- [x] **M3-T01 · Line-item builder component** (5h)
  *Files:* `components/documents/line-item-builder.tsx`, `components/documents/totals-panel.tsx`
  *Do:* add / remove / reorder rows; pick a product to prefill or type free text; live
  subtotal / discount / VAT / total via `lib/totals.ts`. Client totals are **feedback only** —
  the server recomputes on save (`AGENTS.md` §3.3).
  *Accept:* works at 390px as stacked cards; removing the last row leaves a valid empty state;
  a hand-tampered client total is discarded and the server value is rendered back.

- [x] **M3-T02 · Create / edit quotation** (3h)
  *Files:* `actions/quotations.ts`, `lib/validation/quotation.ts`,
  `app/(dashboard)/dashboard/quotations/new/page.tsx`, `[id]/page.tsx`
  *Do:* Server Action, zod at the boundary, number assigned on first save (§5.3), snapshots written
  on the first `SENT` (§5.4).
  *Accept:* saving a draft twice does not consume a second number; the snapshot does not change after
  the customer record is later edited.

- [x] **M3-T03 · Quotation list + detail** (2h)
  *Do:* filter by status, sort by date, status badges, derived `EXPIRED` when `validUntil < today`.
  *Accept:* the list issues one query, not one per row; empty state has a CTA.

- [x] **M3-T04 · PDF template** (5h)
  *Files:* `lib/pdf/quotation-document.tsx`, `lib/pdf/shared/*`
  *Do:* `@react-pdf/renderer`: logo, business block, customer block, items table, totals, notes and
  terms, and the footer disclaiming that this is not an official sales invoice/receipt
  (`AGENTS.md` §4). A4, not Letter. No VAT line when the business is not VAT-registered.
  *Accept:* a 30-line document paginates with a repeating header; a missing logo renders a clean gap,
  not a broken image; peso amounts align on the decimal.

- [x] **M3-T05 · PDF route** (2h)
  *Files:* `app/api/quotations/[id]/pdf/route.ts`
  *Do:* ownership-checked via the session, `Content-Disposition: attachment; filename="QUO-000001.pdf"`.
  *Accept:* requesting another user's document id returns 404 (not 403, not the PDF); the response
  streams rather than buffering the whole document in memory.

*Milestone accept:* **register → business → customer → quotation → a professional PDF that downloads
and opens correctly on desktop and on a phone.**

---

### M4 — Invoices + public links (12–14 hrs)

- [x] **M4-T01 · Extract the shared document engine** (4h)
  *Files:* `components/documents/*`, `lib/pdf/shared/*`, `lib/documents.ts`
  *Do:* factor the builder, totals, and PDF layout so invoices reuse them. Differences are
  `dueDate`, `paidAt`, and the status set. **No copy-paste of the M3 files.**
  *Accept:* a change to the totals panel shows up in both document types with one edit; the
  quotation flow still passes its M3 acceptance criteria afterwards.

- [x] **M4-T02 · Invoice CRUD + PDF** (3h)
  *Accept:* mirrors M3-T02 / T03 / T05 for invoices, including the numbering test.

- [x] **M4-T03 · Mark as paid / cancel** (2h)
  *Do:* `paidAt` set on payment; `PAID` and `CANCELLED` are terminal and lock line items and totals.
  *Accept:* a Server Action that tries to edit a `PAID` invoice's items is rejected server-side, not
  just hidden in the UI.

- [x] **M4-T04 · Public link pages** (4h)
  *Files:* `app/i/[token]/page.tsx`, `app/q/[token]/page.tsx`,
  `app/api/public/i/[token]/pdf/route.ts`, `lib/public-projection.ts`
  *Do:* clean read-only view, Download PDF, no app chrome, `noindex`. **Hand-written minimal
  projection** (§5.6). Honour `publicTokenRevokedAt` and the owner's `publicLinksDisabledAt`.
  *Accept:* the page HTML and the JSON payload contain **no** user email, no internal ids, and no
  other document; an unknown, revoked, or disabled token renders the same plain 404.

- [x] **M4-T05 · Convert quotation → invoice** (2h)
  *Do:* copy items, totals, and both snapshots; set `sourceQuotationId` and `convertedInvoiceId`;
  the quotation becomes `ACCEPTED`.
  *Accept:* converting twice opens the existing invoice and creates nothing — verify by calling the
  action twice in a row.

*Milestone accept:* a document link opened in an incognito window renders correctly and exposes
nothing beyond that one document.

---

### M5 — Dashboard & polish (8–10 hrs)

- [x] **M5-T01 · Metrics** (3h)
  *Files:* `lib/metrics.ts`, `app/(dashboard)/dashboard/page.tsx`
  *Do:* current-month revenue, outstanding, paid, overdue — **one aggregation pipeline**, not N
  queries. Overdue is derived (§5.4).
  *Accept:* the dashboard issues ≤ 3 database round-trips total; the numbers match a hand count on
  the seed data.

- [x] **M5-T02 · Recent documents + empty states** (2h)
  *Accept:* a brand-new account sees a guided empty state with one clear CTA, never a grid of zeroes.

- [x] **M5-T03 · Loading, error, and 404 boundaries** (2h)
  *Files:* `loading.tsx` / `error.tsx` / `not-found.tsx` per route group
  *Accept:* every screen in §9 shows its `L`, `X`, and `D` states; an error boundary shows a message
  a customer could read, with the real error logged server-side only.

- [x] **M5-T04 · Mobile pass** (2h)
  *Accept:* the builder is usable at 390px — no horizontal scroll, no tap target under 44px, no
  overlapped totals.

---

### M6 — Ship it (12–14 hrs)

- [x] **M6-T01 · Logo upload** (2h)
  *Do:* Vercel Blob, 2MB cap, png/jpg/webp only, validated server-side by content type **and** magic
  bytes, not just the file extension.
  *Accept:* a renamed `.exe` is rejected; the stored URL renders in both the app and the PDF.

- [x] **M6-T02 · Deploy to Vercel** (2h)
  *Do:* env vars set (§14), Atlas network access configured, custom domain, `ADMIN_EMAILS` set in
  production only.
  *Accept:* a preview deploy and production both boot; `/api/health` is green in production.

- [x] **M6-T03 · Security pass** (2h)
  *Do:* walk **every** Server Action and confirm session-derived `userId` scoping (§5.5); rate-limit
  login, register, and password reset; confirm no secret is imported into a client component;
  confirm `/admin/*` 404s for a normal user in the production build.
  *Accept:* a written checklist in the PR listing every action file and its scoping status. Grep for
  `findById(` and `findOne({ _id` outside `lib/admin/**` returns nothing unscoped.

- [ ] **M6-T04 · Seed + smoke script** (1h)
  *Files:* `scripts/seed.ts`
  *Do:* one command creates a demo account with realistic PH data — plus one suspended user and one
  admin — so the M7 screens have something to render.
  *Accept:* `npm run seed` twice is idempotent or clearly refuses.

- [x] **M6-T05 · Account page** (2h)  ← new in v2
  *Files:* `app/(dashboard)/dashboard/account/page.tsx`, `actions/account.ts`
  *Do:* change password (current password required), change email (uniqueness re-checked,
  `emailVerifiedAt` cleared), export my data (JSON + CSV — PH Data Privacy Act portability), close
  account (`deletionRequestedAt` set, sign-out, sign-in blocked; **nothing hard-deleted**).
  *Accept:* the export contains only that user's records — verified with a second seeded account; a
  closed account cannot sign in and its public links still resolve.

- [x] **M6-T06 · Mandatory MFA for all users** (4h)  ← new in v2.1
  *Files:* `middleware.ts`, `app/(onboarding)/onboarding/mfa/page.tsx`,
  `app/(dashboard)/dashboard/account/security/page.tsx`, `actions/account.ts`
  *Do:* extend the M1-T09 enrolment gate to every account (§5.11), and build the security page:
  remaining recovery-code count, regenerate (invalidates all ten), replace device (re-enrol with a
  new secret, confirmed by a code from the **new** device before the old one is dropped). Write the
  enrolment copy carefully — this is the first wall a new signup hits, and it needs to say *why* in
  one sentence, name Google Authenticator explicitly, and offer the typable secret for anyone who
  can't scan.
  *Do not:* build a "disable MFA" control. It does not exist in this product.
  *Accept:* a fresh signup cannot reach `/dashboard` until enrolled, and cannot route around it via a
  direct URL or a stale session; replacing a device requires a code from the new device; regenerating
  invalidates every old recovery code; recovery codes are absent from the M6-T05 data export; the
  whole enrolment works one-handed at 390px, since people scan with the phone they're holding.

**→ At the end of M6 the product is live and usable for free. Get 10 real users before M8.**

---

### M7 — Admin console (14–16 hrs)  ← new in v2

Build this **after** launch and **before** plan limits: the first real users generate the first
support tickets, and M8's plan overrides need somewhere to live. Every task here obeys §5.8.

- [x] **M7-T01 · Admin shell + audit primitive** (3h)
  *Files:* `app/(admin)/layout.tsx`, `lib/admin/guard.ts` (from M1-T05), `lib/admin/audit.ts`,
  `components/admin/*`
  *Do:* a visually distinct admin chrome (different accent, an "ADMIN" badge, the signed-in admin's
  email always visible — nobody should confuse this with the user app). `audit.ts` exports
  `recordAudit({ action, targetUserId, targetType, targetId, reason, before, after })`, capturing IP
  and user agent. Append-only: **do not write an update or delete helper**, not even a private one.
  *Accept:* every page under `(admin)` is 404 for a non-admin in a production build; `recordAudit`
  writes one document per call; `AdminAuditLog` has no update or delete code path anywhere in the
  repo.

- [x] **M7-T02 · User list** (3h)
  *Files:* `app/(admin)/admin/users/page.tsx`, `lib/admin/users.ts`
  *Do:* server-side pagination (25/page) and search by email or business name. Columns: email,
  business, plan (+ `ADMIN` badge when overridden), documents count, signed up, last active, status.
  Filters: plan, suspended, active-in-30-days. Sort by newest first.
  *Accept:* the query is paginated at the database (`skip`/`limit` + a count), never in JS; the page
  renders in under a second against 10,000 seeded users; searching `""` returns page 1, not
  everything.

- [x] **M7-T03 · User detail + read-only documents** (3h)
  *Files:* `app/(admin)/admin/users/[id]/page.tsx`, `[id]/documents/page.tsx`,
  `app/(admin)/admin/documents/[kind]/[id]/page.tsx`
  *Do:* profile, business, plan with its source and expiry, counts by document type and status,
  last login, suspension state, and that user's recent audit entries. The document view reuses the
  **same** render components as the user's detail page with every edit affordance removed, plus a
  visible "read-only — admin view" banner. Viewing a user or a document writes a `USER_VIEW` /
  `DOCUMENT_VIEW` audit entry.
  *Accept:* there is no button, form, or Server Action on any of these pages that writes to a
  quotation, invoice, customer, product, or business; opening the page appends exactly one audit
  entry, not one per component render.

- [x] **M7-T04 · Support lookup** (2h)
  *Files:* `app/(admin)/admin/lookup/page.tsx`, `lib/admin/lookup.ts`
  *Do:* one input that resolves a document **number** (`INV-000042`) or a **public token** across all
  users, and jumps to the read-only view. Require ≥ 4 characters.
  *Accept:* an unknown value returns a clean "not found", never an error; the lookup is audited; a
  bare `INV-` prefix does not dump every invoice in the platform.

- [x] **M7-T05 · Suspend / unsuspend + link controls** (2h)
  *Files:* `actions/admin/users.ts`
  *Do:* four audited actions per §5.9: suspend, unsuspend, disable public links, enable public links.
  Each requires a typed reason (min 10 characters) before its button enables, and each shows a
  confirmation dialog naming the user's email.
  *Accept:* suspending blocks the user's next sign-in and their next mutating action while leaving
  their public links alive; disabling links 404s `/i/*` and `/q/*` for that user only; all four
  actions appear in `/admin/audit` with the reason.

- [x] **M7-T06 · Plan override** (2h)
  *Files:* `actions/admin/users.ts`, `lib/plan.ts`
  *Do:* set and clear an override per §5.10 — plan, reason, expiry (default 90 days).
  `effectivePlan(user)` becomes the single source of truth and every limit check calls it.
  *Accept:* an override changes the user's effective plan immediately; an expired override falls back
  with no cleanup job; a simulated PayMongo billing update does **not** overwrite a live override.

- [x] **M7-T07 · Platform metrics** (2h)
  *Files:* `app/(admin)/admin/page.tsx`, `lib/admin/metrics.ts`
  *Do:* total users; new users 7d / 30d; active users 30d (created a document); documents created 30d
  by kind; paid accounts; MRR; suspended count. One aggregation per tile, cached 5 minutes.
  *Accept:* the page issues a bounded number of queries regardless of user count; every tile has an
  empty state; no tile does a per-user loop.

- [x] **M7-T08 · MFA reset for locked-out users** (1h)  ← new in v2.1
  *Files:* `actions/admin/users.ts`, `app/(admin)/admin/users/[id]/page.tsx`
  *Do:* an audited `MFA_RESET` per §5.11 rule 9 — typed reason required, confirmation names the
  user's email. It clears MFA and forces fresh enrolment; it never reveals, reuses, or regenerates
  the old secret. **The action must refuse when the target's role is `ADMIN`**, with a message
  pointing at the CLI.
  *Accept:* resetting a user forces enrolment with a genuinely new secret at their next sign-in;
  attempting it against an admin account is refused server-side, not merely hidden in the UI; the
  reset appears in `/admin/audit` with its reason; no admin screen ever renders a secret or a
  recovery code.

- [x] **M7-T09 · Audit log viewer** (1h)
  *Files:* `app/(admin)/admin/audit/page.tsx`
  *Do:* newest first, paginated, filter by actor, target user, and action.
  *Accept:* read-only — no edit or delete control exists; the page is paginated at the database.

*Milestone accept:* you can answer a real support ticket end to end — find the document by its
number, see its owner and state, explain the problem — **without opening Atlas**, and every step you
took is visible in `/admin/audit`.

---

### M8 — Plan limits (5–6 hrs)

- [x] **M8-T01 · Limit checks** (3h)
  *Files:* `lib/plan.ts`, called by every create action
  *Do:* FREE = 5 invoices/month, 5 quotations/month, 10 customers. Enforced **server-side in the
  action**, resolved through `effectivePlan()` so an admin override lifts limits instantly. Never
  enforce a limit only in the UI.
  *Accept:* an over-limit create is rejected by the Server Action even when the UI is bypassed; a
  user with an admin override is not limited; the month boundary uses `Asia/Manila`, not UTC.

- [x] **M8-T02 · Upgrade prompts** (2h)
  *Accept:* a blocked action explains which limit was hit, shows current usage, and links to pricing.

---

### M9 — Monetization (20–25 hrs)  ← rewritten in v2.2

Read §5.12 before writing a line of this. The whole milestone is one sentence: **a payment is a row
in `billingCheckouts` that a signed webhook flips to `PAID`, and nothing else in the app is allowed
to grant a plan.** Every task below exists to keep that sentence true.

Estimate went from 12–16 to 20–25 because the original bullets costed the happy path only. The extra
hours are the reconcile job, the return page, and the tests — which is exactly where a payment
integration either works at 2am or doesn't.

- [ ] **M9-T00 · PayMongo account + environment** (1h, *human, not an agent*)
  *Do:* the setup checklist in §17. **No other M9 task can start until `PAYMONGO_SECRET_KEY` and
  `PAYMONGO_WEBHOOK_SECRET` are in `.env.local` and a test webhook has reached a local tunnel.**
  *Accept:* `curl -u sk_test_xxx: https://api.paymongo.com/v1/webhooks` returns the registered hook;
  GCash, Maya, GrabPay and card all show as enabled in the dashboard.

- [ ] **M9-T01 · Billing primitives** (3h)
  *Files:* `lib/billing/plans.ts`, `lib/billing/paymongo.ts`, `models/billing-checkout.ts`,
  `models/billing-event.ts`, `types/index.ts`
  *Do:* the price table (`FREELANCER → 29900`, `BUSINESS → 59900`, `TERM_DAYS = 30`) and a thin
  PayMongo client: base64 basic auth on the secret key, `Idempotency-Key` on every POST, a typed
  error for non-2xx, and a hard 10-second timeout. Both models with the §6 indexes.
  *Do not* add an SDK dependency — three endpoints do not justify one, and the locked stack (§3)
  does not include it.
  *Accept:* the price table is the only place an amount appears; `grep -rn "29900\|59900" --include=*.ts`
  outside `lib/billing/plans.ts` and its test returns nothing.

- [ ] **M9-T02 · Term + grace in `effectivePlan()`** (2h)
  *Files:* `lib/plan.ts`, `models/user.ts`, `tests/plan.test.ts`
  *Do:* add the §6 billing fields. Change resolution to: unexpired `ADMIN` override → else
  `billingPlan` **while `billingGraceUntil > now`** → else `FREE`. Add
  `billingState(user): { status: 'NONE'|'ACTIVE'|'GRACE'|'LAPSED', plan, paidUntil, graceUntil, daysLeft }`
  — pure, synchronous, no DB, no `await`. Every banner, the billing page and the admin view read it.
  *Accept:* a user whose `billingGraceUntil` passed one second ago resolves to `FREE` with **no job
  having run**; an admin override still wins over a live paid term *and* over a lapsed one; the
  existing four override/billing combinations in `plan.test.ts` still pass unchanged.

- [ ] **M9-T03 · Create a checkout** (3h)
  *Files:* `actions/billing.ts`, `lib/validation/billing.ts`, `lib/billing/checkout.ts`
  *Do:* `startCheckout(plan)` — session required, `assertNotSuspended()`, Zod-parse the plan **name**
  (never an amount), look the price up server-side, insert a `PENDING` `billingCheckouts` row with a
  fresh `referenceNumber`, then create the PayMongo Checkout Session with
  `payment_method_types: ['card','gcash','paymaya','grab_pay']`, `success_url` =
  `${APP_URL}/dashboard/billing/return?ref=...`, `cancel_url` = `${APP_URL}/dashboard/billing`,
  `metadata: { userId, checkoutId, plan }`, and store `checkoutSessionId` + `checkoutUrl` back on the
  row. Reuse an existing `PENDING` row for the same plan if it is under an hour old rather than
  littering PayMongo with sessions.
  *Accept:* a request that posts `amount` or `plan: 'FREE'` is rejected by the action, not the UI; the
  stored `amountCentavos` matches the price table; a suspended user cannot start a checkout.

- [ ] **M9-T04 · Webhook handler** (5h) — *the task to get right*
  *Files:* `app/api/webhooks/paymongo/route.ts`, `lib/billing/webhook.ts`, `lib/billing/grant.ts`,
  `middleware.ts`
  *Do:* in this order, and the order is the design:
  1. `const raw = await req.text()` — **never `req.json()`**. The signature covers the raw bytes.
  2. Parse `Paymongo-Signature` (`t=`, `te=`, `li=`). HMAC-SHA256 over `` `${t}.${raw}` `` with
     `PAYMONGO_WEBHOOK_SECRET`; compare with `crypto.timingSafeEqual`. Pick `te` or `li` from **our
     own key prefix**, never from anything in the payload. Reject if `|now − t| > 5 min`.
     Invalid signature → `401`, and nothing is written.
  3. Insert `billingEvents` with the PayMongo event id. Duplicate key → `200 {"status":"duplicate"}`,
     stop. This is the idempotency guarantee; do not add a second one.
  4. Ignore any type that is not `checkout_session.payment.paid`, `payment.paid`, `payment.failed` or
     `payment.refunded` — record it, return `200`. An unrecognised type must never 4xx: three events
     exhausting their retries disables the endpoint.
  5. Resolve the `billingCheckouts` row by `checkoutSessionId`. Unknown → record `UNKNOWN_SESSION`,
     return `200`.
  6. Grant: `updateOne({ _id, status: 'PENDING' }, { $set: { status: 'PAID', ... } })`. If
     `modifiedCount === 0`, the term was already granted — stop.
  7. Extend the user with an update object whose keys are literally and only the five in §5.12.7.
  Add the route to the `middleware.ts` public matcher and confirm it needs no session.
  *Accept:* **replaying the same event body twice changes nothing the second time** — assert the
  user's `billingPaidUntil` is byte-identical after the replay; a body with one character changed is
  rejected `401`; an event 10 minutes old is rejected; a `payment.refunded` records but does **not**
  change `billingPlan`; a webhook arriving for a user with a live admin override leaves
  `plan`, `planSource`, `planOverrideExpiresAt` and `planOverrideReason` untouched (assert the exact
  key set of the update object).

- [ ] **M9-T05 · Return page** (1.5h)
  *Files:* `app/(dashboard)/dashboard/billing/return/page.tsx`, `actions/billing.ts`
  *Do:* read the checkout row by `ref`, **scoped to the session `userId`**. `PAID` → "You're on
  Freelancer until 7 Oct 2026". `PENDING` → "Confirming your payment…" with a **Re-check payment**
  button that calls the reconcile path for that one row. This page grants nothing (§5.12.6).
  *Accept:* hitting the return URL by hand with someone else's `ref` 404s; hitting it with an
  unpaid `ref` never upgrades the account no matter how many times it is reloaded.

- [ ] **M9-T06 · Reconcile job** (2.5h)
  *Files:* `app/api/cron/billing-reconcile/route.ts`, `lib/billing/reconcile.ts`, `vercel.json`
  *Do:* bearer-check `CRON_SECRET` (a missing or wrong header is a `404`, not a `401` — do not
  confirm the route exists). Find `PENDING` rows older than 15 minutes, `GET
  /v1/checkout_sessions/{id}`, and run the **same** `grant()` used by the webhook. Flip rows still
  unpaid after 24 hours to `EXPIRED`. Daily at 03:00 Manila. Every action writes a `billingEvents`
  row with `source: 'RECONCILE'`.
  *Accept:* deleting a webhook delivery and running the job produces the identical end state; running
  the job twice in a row grants nothing the second time; an already-`PAID` row is skipped without an
  API call.

- [ ] **M9-T07 · Billing page + renewal banner** (3h)
  *Files:* `app/(dashboard)/dashboard/billing/page.tsx`, `components/billing/*`,
  `app/(dashboard)/dashboard/layout.tsx`
  *Do:* current plan, the end date in words ("ends 7 Oct 2026 · 12 days left"), renew and upgrade
  buttons, and payment history from `billingCheckouts`. States: never paid / active / in grace /
  lapsed / **admin override live** — the override state says the plan is comped and shows no renew
  button, because charging someone for what you already gave them is the worst bug in this milestone.
  A dashboard-wide banner appears in `GRACE` only.
  *Accept:* all five states render from `billingState()` alone; the `FREE`-limit upgrade prompts from
  M8-T02 link here; no page anywhere computes a plan without `effectivePlan()`.

- [ ] **M9-T08 · Admin billing view** (1.5h)
  *Files:* `app/(admin)/admin/users/[id]/page.tsx`, `lib/admin/billing.ts`
  *Do:* on the user detail page — billing term, grace, last payment, the last ten checkouts with
  status, and **the billing-vs-override distinction stated in words**, not left to be inferred from
  two dates ("Paid: Freelancer to 7 Oct. Override: Business to 1 Dec — override is what applies").
  Read-only. Refunds happen in PayMongo.
  *Accept:* opening it writes a `USER_VIEW` audit entry like every other admin read; no action on
  this page can write a billing field.

- [ ] **M9-T09 · Go live** (1h, *human*)
  *Do:* §17 step 8 — live keys, a second webhook registered against the production URL with its own
  secret, one real ₱299 purchase from a real GCash account, then refund it in the dashboard.
  *Accept:* the real payment granted the term through the webhook, and the refund left the term in
  place while showing on the admin view (§5.12.10).

---

### M10 — Transactional email (5–7 hrs)

Split out of M9 in v2.2. Domain verification is DNS work with a lead time measured in hours, and
nothing about it should be able to block a payment shipping.

- [ ] **M10-T01 · Resend setup** (1h, *human*) — domain, SPF/DKIM records, `RESEND_API_KEY`, a
  verified `from` address on the real domain. `onboarding@resend.dev` is for testing only.
- [ ] **M10-T02 · Mailer + templates** (2h) — `lib/email/`, one send function, plain-text fallback on
  every template, and a `MAIL_DRY_RUN` mode that logs instead of sending so tests never send mail.
- [ ] **M10-T03 · Password reset by email** (1h) — the M2 token flow finally emails its link instead
  of printing it to the server log (§10). Delete the log line in the same commit.
- [ ] **M10-T04 · "Your invoice is ready"** (1.5h) — sends the public link to the customer, from the
  user's action, rate-limited per user. Never attaches the PDF; the link is the product.
- [ ] **M10-T05 · Email verification + security notices** (1.5h) — `emailVerifiedAt` gets written at
  last, and the §5.11 rule 11 security events (device replaced, recovery code used, admin MFA reset)
  are emailed to the account owner.
- [ ] **M10-T06 · Billing receipts** (1h) — a receipt on a granted term, sent from the grant path so
  reconcile-granted terms get one too. A failed send must never fail the grant.

---

## 12. Backlog (do not start without human approval)

**Auto-renewal via the PayMongo Subscriptions API** (card-only, needs PayMongo to enable key
configuration on the account; §5.12 is built so this slots in behind the same `billingState()`) ·
recurring invoices · multi-user businesses and team roles · admin impersonation (needs a consent and
audit design) · custom PDF templates · CSV/Xero export · payment reminders · multi-currency ·
public API · mobile app · admin-triggered emails · soft-delete purge job for closed accounts.

---

## 13. Definition of done

### 13.1 Every task
1. `npm run typecheck`, `npm run lint`, and `npm run build` pass with zero new warnings.
2. Domain logic touched → a unit test added or updated.
3. Every new query is scoped by session `userId`, **or** is a documented public-token read, **or**
   lives in `lib/admin/**` / `actions/admin/**` behind `requireAdmin()` and is audited. There is no
   fourth option.
4. Money is centavos end to end; no `parseFloat` on a peso amount.
5. Works at 390px (user and public surfaces; admin may be desktop-first).
6. The screen handles all five states from §9.
7. No new dependency without approval.
8. The §11 checkbox is ticked in the same commit as the work.

### 13.2 Every admin task, additionally
9. The action is behind `requireAdmin()` and writes an `AdminAuditLog` entry.
10. A destructive action requires a typed reason.
11. The page 404s — not 403s — for a non-admin.
12. Nothing in the change can create, edit, or delete a user's business content.

### 13.3 Any task touching auth or MFA, additionally
13. No TOTP secret, recovery code, or submitted code appears in any log, error message, exception
    payload, analytics event, or data export.
14. The secret is encrypted at rest and decrypted only inside `lib/mfa.ts`.
15. Every new verification path checks the replay guard, not just the time window.

---

## 14. Testing strategy

**Unit (`npm run test`) — the non-negotiable layer.** `lib/` is where the money lives:
`totals.ts` (VAT on/off, discount before VAT, half-up at `.005`, zero and negative guards),
`money.ts` (parse and format round-trip), `numbering.ts` (no duplicates under concurrency),
`dates.ts` (Manila boundaries — an invoice created 23:30 Manila belongs to that day, not UTC's),
`plan.ts` (`effectivePlan` across all four combinations of billing and override, **plus the term
and grace boundaries — one second before and one second after `billingGraceUntil`**),
`billing/plans.ts` (the price table is the only source of an amount),
`billing/grant.ts` (early renewal stacks onto the remaining term instead of truncating it; a term
granted at 23:30 Manila ends on the right Manila day),
`billing/webhook.ts` (signature verify against a known-good fixture, a one-character mutation, a
stale timestamp, and the `te`/`li` mode choice),
`public-projection.ts` (asserts the projection's key list exactly — this test is what stops a future
field from leaking).

`mfa.ts` gets its own block: the ±1-step window, the two-step rejection, the replay guard, recovery
code consumption, and a round-trip against a code generated by an independent TOTP implementation —
not by `lib/mfa.ts` itself, which would only prove it agrees with its own bug.

**Integration — the security tests. Write these once and never delete them.**
1. User A's session cannot read, edit, or PDF any of user B's documents (404 in every case).
2. A public token returns only its own document and only the projected fields.
3. A revoked token, a disabled-links owner, and an unknown token are indistinguishable to the caller.
4. A non-admin gets a 404 on every `/admin/*` route.
5. `requireAdmin()` fails with role-but-no-env and with env-but-no-role.
6. Every admin write leaves exactly one audit entry.
7. A suspended user's existing session cannot mutate anything.
8. A valid `mfa_challenge` cookie, on its own, opens no page but `/login/mfa` and no Server Action.
9. A session minted before an account enrolled in MFA does not satisfy `requireAdmin()`.
10. An account with `mfaEnabledAt` unset is redirected out of every `/dashboard/*` route.
11. `MFA_RESET` against an `ADMIN` target is refused server-side.
12. A correct code submitted twice succeeds once.
13. **The same webhook event delivered twice grants exactly one term** — assert `billingPaidUntil`
    is unchanged by the replay, not merely that the second call returned 200.
14. A webhook with a valid signature for a user who has a live admin override changes no field
    outside the §5.12.7 allowlist.
15. `/dashboard/billing/return` with another user's `ref` 404s, and with an unpaid `ref` never
    grants a plan however many times it is loaded.
16. `startCheckout` ignores any client-supplied amount and rejects `FREE`.
17. `/api/cron/billing-reconcile` without `CRON_SECRET` returns 404, and running it after a dropped
    webhook produces the same end state the webhook would have.
18. An unrecognised webhook event type returns 2xx (a 4xx here is what disables the endpoint).

**Manual before each milestone ships:** the §8 flow for that milestone, on a real phone, and one
failure branch (`⟂`) per flow.

---

## 15. Environment variables

```bash
MONGODB_URI=
MONGODB_DB=bilyo
AUTH_SECRET=              # openssl rand -base64 32
AUTH_URL=http://localhost:3000
APP_URL=http://localhost:3000
SUPPORT_EMAIL=            # shown to suspended users and on error pages
ADMIN_EMAILS=             # comma-separated allowlist — second admin factor (§5.8)
MFA_ENCRYPTION_KEY=       # 32 bytes base64: openssl rand -base64 32 — encrypts TOTP secrets (§5.11)
MFA_ISSUER=Bilyo          # the name shown in the authenticator app; changing it re-labels new enrolments only
BLOB_READ_WRITE_TOKEN=    # M6
PAYMONGO_SECRET_KEY=      # M9 — sk_test_... in dev, sk_live_... in prod. Server-only, never NEXT_PUBLIC_
PAYMONGO_WEBHOOK_SECRET=  # M9 — whsk_... Per environment: test and live webhooks have DIFFERENT secrets
CRON_SECRET=              # M9 — openssl rand -base64 32. Bearer token for /api/cron/*
RESEND_API_KEY=           # M10
EMAIL_FROM=               # M10 — a verified address on your own domain
MAIL_DRY_RUN=true         # M10 — log instead of send; true everywhere except production
```

**Never prefix a PayMongo key with `NEXT_PUBLIC_`.** `sk_` has full account access; in a
`NEXT_PUBLIC_` variable it is compiled into the client bundle and is public forever. The hosted
checkout flow (§5.12) needs no key in the browser at all, so if a PayMongo value ever appears in
client code, the design has gone wrong, not the naming.

**A test webhook secret in production silently rejects every real payment**, because the signature
will verify against `te` and never `li`. Register the two webhooks separately and keep their secrets
in the environment that matches their key prefix.

`.env.local` is git-ignored. `.env.example` is committed and must list every key above with empty
values. **`ADMIN_EMAILS` is empty in `.env.example` and in every preview environment** — an admin
allowlist that follows a branch deploy around is a back door.

**`MFA_ENCRYPTION_KEY` is unrecoverable.** Rotating or losing it makes every stored TOTP secret
undecryptable, which locks every account out and turns into a mass re-enrolment. Back it up where you
back up `AUTH_SECRET`, and never let a preview environment share production's value.

---

## 16. Operations runbook

| Situation | Do this |
|---|---|
| "My customer says the link is broken" | `/admin/lookup` → the number → check token state → if revoked, the **user** re-issues it from their dashboard |
| "I was charged but I'm still on FREE" | `/admin/users/[id]` → is there a `PENDING` checkout with a PayMongo payment against it? Then the webhook was lost: run `/api/cron/billing-reconcile` (or have the user press **Re-check payment**) and it self-heals. Only if reconcile also fails to grant is it a code bug — read `billingEvents` for that user before touching any data by hand |
| PayMongo shows the webhook as **disabled** | Three events exhausted their 12 retries — a deploy broke the handler. Fix the handler, re-enable in the dashboard, then run the reconcile job: **missed events are not replayed on re-enable**, so reconcile is the only thing that recovers them |
| A payment shows in PayMongo but no `billingEvents` row exists | The signature check is rejecting real events. Compare the key prefix (`sk_test_`/`sk_live_`) against which webhook secret that environment holds — mismatched modes is the cause almost every time |
| A user paid twice by accident | Both terms are real and stacked (§5.12.2). Refund one in PayMongo; the term stays — shorten it with an audited plan override if that is the fair outcome |
| A user is sending phishing invoices | Disable public links (reason logged) → then suspend if the account itself is the problem → never delete |
| A user asks for a refund or a comp | Refund in PayMongo — **Bilyo never issues refunds**. The refund is recorded but does not revoke the term (§5.12.10); shorten it with an audited override if it should end early. Comp with a plan override that has a reason and an expiry |
| A user asks to close their account | They do it at `/dashboard/account`. Admin does not close accounts in v1 |
| A user asks for their data | They export it at `/dashboard/account` |
| "I lost my phone" (user) | They sign in with a recovery code and replace the device at `/dashboard/account/security` |
| "I lost my phone and my recovery codes" (user) | Verify identity out of band, then `/admin/users/[id]` → Reset MFA with a reason. Never do it on an email request alone — this is the social-engineering path into an account |
| "I lost my phone" (admin) | Recovery code. Failing that, `npm run reset-mfa -- <email>` from a machine with DB access. No console button exists for this |
| "My codes are always rejected" | Almost always the *phone's* clock, not yours: have them enable automatic time in the authenticator app. Check the server clock second. Do not widen the verification window |
| You need a new admin | `npm run grant-admin -- email`, add the email to `ADMIN_EMAILS` in production, **and** have them enrol an authenticator. All three, or it doesn't work |
| An admin leaves | Remove the email from `ADMIN_EMAILS` first (takes effect immediately), then flip the role back. Their TOTP enrolment stays on their user record and is harmless without the role |

**Never** edit a user's documents in Atlas to "fix" something. If the data is wrong, the code is
wrong: find the bug, ship the fix, and let the user correct their own record.

---

## 17. PayMongo setup checklist  ← new in v2.2

**This is human work, not agent work, and M9 is blocked until it is done.** Every step below produces
something that ends up in an environment variable or a dashboard toggle. Nothing here is code.

### 1. Create and activate the merchant account
Sign up at `dashboard.paymongo.com`. A fresh account is in **test mode** and can call the whole API
immediately — you do **not** need activation to build M9. Activation is only needed to take real
money, so start it now in parallel because it is the long pole: PayMongo quotes **up to 14 business
days** and forwards your documents to their financial partners for onboarding.

**There is no unregistered-individual path.** PayMongo's activation requirements are published per
business type, and every one of them starts with a registration certificate:

| Type | Documents |
|---|---|
| Sole proprietor | DTI Business Name certificate + government ID (1 primary or 3 secondary) |
| Partnership | SEC certificate, Articles of Partnership, Partner's Resolution, ID |
| Corporation | SEC certificate, Articles + By-Laws, latest GIS, notarised Secretary's Certificate, IDs |

An unverified account sits at **Tier 1: QR Ph only, ₱10k/month cash-in** — 33 Freelancer
subscriptions, and no GCash, no cards, which is the whole reason PayMongo was chosen (§18). **Tier 2
is the only tier this product can run on.** For a solo founder that means a DTI Business Name
registration (₱200 barangay to ₱2,000 national scope, + ₱30 DST, online at `bnrs.dti.gov.ph`, valid
five years), then BIR registration, then the bank account in the business name.

A live site describing what you sell and your refund terms is part of what they review — `/pricing`
and a terms page should exist before you submit.

### 2. Enable payment methods
Card, GCash, GrabPay and Maya activate with the account. QRPh and BillEase need a separate request to
your account manager and are not part of M9. Confirm all four are enabled before M9-T09 — a
`payment_method_types` entry the account cannot process fails at checkout, not at create time.

### 3. Get the API keys
Dashboard → Developers → API Keys. In test mode you get `pk_test_...` and `sk_test_...`.
**Only the secret key is ever used by Bilyo** — the hosted checkout flow puts no key in the browser.
Put it in `.env.local` as `PAYMONGO_SECRET_KEY`. Never as `NEXT_PUBLIC_*`. Never in `.env.example`.

### 4. Stand up a tunnel so webhooks can reach your laptop
PayMongo pushes over the public internet to HTTPS only; `localhost:3000` is unreachable to it.

```bash
npx localtunnel --port 3000        # or: cloudflared tunnel --url http://localhost:3000
```

Keep the URL — it changes each run, and re-registering the webhook is part of your dev loop.

### 5. Register the test webhook
There is no dashboard button for this; the webhook is created through the API.

```bash
curl -X POST https://api.paymongo.com/v1/webhooks \
  -u "sk_test_YOURKEY:" \
  -H "Content-Type: application/json" \
  -d '{"data":{"attributes":{
        "url":"https://YOUR-TUNNEL.example/api/webhooks/paymongo",
        "events":["checkout_session.payment.paid","payment.paid","payment.failed","payment.refunded"]
      }}}'
```

The response contains `attributes.secret_key`, a `whsk_...` value. **It is shown once.** Copy it to
`.env.local` as `PAYMONGO_WEBHOOK_SECRET`. Losing it means deleting the webhook and creating another.

Useful during development: `GET /v1/webhooks` lists them, `POST /v1/webhooks/{id}/disable` and
`/enable` toggle one without deleting it, and `PUT /v1/webhooks/{id}` moves it to a new tunnel URL.
Note that **missed events are not replayed when a webhook is re-enabled** — that is precisely why
M9-T06 exists.

### 6. Fill in the rest of the environment

```bash
PAYMONGO_SECRET_KEY=sk_test_...
PAYMONGO_WEBHOOK_SECRET=whsk_...
CRON_SECRET=$(openssl rand -base64 32)
APP_URL=https://YOUR-TUNNEL.example      # success_url and cancel_url are built from this
```

`APP_URL` must be the tunnel while you are testing, or PayMongo will redirect the customer to a
`localhost` URL that only works on your own machine and looks fine to you and broken to everyone else.

### 7. Know your test instruments
Test mode never moves money. Cards: `4343 4343 4343 4345` succeeds, `4571 7360 0000 0014` triggers
3-D Secure, `5100 0000 0000 0198` is declined — any future expiry, any CVC. GCash, Maya and GrabPay
in test mode open a simulator page with **Authorize** and **Fail** buttons; click both at least once,
because the failure branch is the one that ships broken.

Walk the whole loop before writing M9-T07: create a session, pay it in the simulator, watch the
webhook arrive, confirm `billingPaidUntil` moved. Then re-post the exact same webhook body with the
same signature header and confirm **nothing** changes.

### 8. Going live (M9-T09)
Switch the dashboard to live mode and take `sk_live_...`. **Register a second webhook** against the
production URL — it gets its own `whsk_` secret, which is not the test one. Set both in the
production environment and nowhere else. Then buy one ₱299 term with a real GCash account, confirm
the term was granted by the webhook and not by the redirect, and refund it from the dashboard to see
the refund path end to end. Budget an hour and do it on a weekday, when PayMongo support answers.

---

## 18. Sequencing rationale

The order front-loads what a paying user actually needs — a document their customer receives — and
defers everything that only serves the operator.

**Quotations before invoices** because they are the same machine with fewer states: build the hard
shared pieces once in the simpler context, then reuse them.

**The admin console after launch (M7), not before.** Before you have users there are no support
tickets, no abuse, and no metrics worth looking at — an admin console built at M2 is a console built
against imagined problems. But the *fields* it needs (`role`, `suspendedAt`, `planSource`, the audit
model) go in at **M0**, because adding fields to a live users collection is the migration this plan
is designed to avoid. Cheap to add early, expensive to retrofit.

**Admin MFA at M1, user MFA at M6.** The admin console can read every customer's invoices, so its
password must never be the only thing between an attacker and all of your users' data — the second
factor is a prerequisite of M7, not a hardening pass after it. User MFA waits for M6 because the
enrolment screen is the first wall a signup hits, and it should be written and tested against the
real product rather than against an empty shell. The *fields* and the verification code arrive
together at M1, so M6 is a gate and a settings page, not a second implementation.

**Plan limits after launch (M8)** deliberately: the free tier is the acquisition channel, and
enforcing limits before anyone is using the product optimizes the wrong end of the funnel. And limits
depend on `effectivePlan()`, which M7 introduces — so an early comp doesn't require a code change.

**Monetization last (M9)** because a payment integration built before there is demand is the most
expensive way to learn what people won't pay for.

**Prepaid terms rather than auto-renewing subscriptions (§5.12)** because PayMongo's Subscriptions
API is card-only, and a Philippine invoicing product that cannot take GCash has picked its payment
architecture over its market. The cost is a renewal the user has to initiate; the benefit is that the
whole billing state is two dates on the user document, which is why `effectivePlan()` needs no cron
job and every one of its states can be unit-tested in milliseconds.

**Email after payments (M10)** because Resend needs DNS records verified on a real domain, and a
lead time you do not control should never sit on the critical path of the thing that earns money.

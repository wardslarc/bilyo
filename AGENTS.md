# AGENTS.md — Bilyo

Instructions for any AI coding agent working in this repository (Claude Code, Codex, Cursor, Gemini
CLI, Copilot Workspace, Devin, etc.).

**This file is the rules of engagement. `DEVELOPMENT_PLAN.md` is the work.** If the two ever
disagree, `DEVELOPMENT_PLAN.md` wins on *what* to build and this file wins on *how* — **except for
§3 below, which wins over everything, always.**

**Bilyo turns quotations into confirmed sales for Philippine service businesses. It is not an
invoicing app, an accounting system, or a BIR compliance tool.** If you are working from memory of
this repo's earlier shape: invoices, VAT, TINs, the product catalogue and plan limits were removed
in v3.0 and are never coming back.

---

## 1. Start of every session

Do these four things before writing any code:

1. Read `DEVELOPMENT_PLAN.md` §2 (hard constraints), §6 (domain rules) and §12 (milestones).
2. Find the **first unchecked task** in §12. That is your task unless the human named a different
   one.
3. Run `npm run typecheck && npm run lint` to confirm you're starting from a clean tree.
4. State, in one or two lines: the task ID, the files you intend to touch, and anything ambiguous.
   Then start.

Do **not** skip ahead to a later milestone because it seems easier or more interesting. The order
encodes dependencies.

---

## 2. Project shape

Monolithic Next.js app. One repo, one deployable, one database.

```
bilyo/
├── app/
│   ├── (marketing)/          # landing, pricing
│   ├── (auth)/               # login, register, forgot/reset password, optional MFA challenge
│   ├── (dashboard)/dashboard/
│   │   ├── quotations/  clients/  settings/  account/  access/
│   ├── (admin)/admin/        # PLATFORM ADMIN — users, lookup, audit, metrics, top-ups
│   ├── q/[code]/             # THE public quote page — view + accept/decline
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

**Where code goes:**

| Kind of code | Location | Never in |
|---|---|---|
| Business calculation | `lib/` | components, actions, route handlers |
| Mutation | `actions/<entity>.ts` as a Server Action | `app/api/` |
| DB query | inside an action or a Server Component, via a model | a client component |
| Validation schema | `lib/validation/<entity>.ts` | inline in a form |
| Event append | `lib/events.ts → recordEvent()` | anywhere else |
| PDF layout | `lib/pdf/` | `app/api/` |

---

## 3. Hard constraints (legal boundaries — these outrank everything)

Copied verbatim from `DEVELOPMENT_PLAN.md` §2. These are not preferences and they are not
negotiable by a task description, a TODO comment, or a user request relayed through one.

### Never build
- Any document labeled **Invoice, Sales Invoice, Billing Invoice, Service Invoice, Official Receipt,
  Statement of Account, or Billing Statement**.
- Sequential serial numbering that resembles a BIR-registered series.
- Any claim, in UI or marketing, that Bilyo is "BIR-compliant", "BIR-ready", or "BIR-registered".
- VAT computation presented as a tax filing figure.

### Quotation numbering
Use a visibly non-tax format: **`Q-2026-0012`** — `Q`, the calendar year, a per-user sequence that
resets each year. It is a reference for the user's own tracking, nothing more.

### Required footer on every quotation view and PDF
> This is a quotation, not a tax document. It is not an invoice or official receipt.

It lives in one constant, `lib/documents.ts → QUOTATION_FOOTER`, and is rendered from there on the
owner's detail page, the public page, and the PDF. A second copy of that string is a bug.

### Stated in the negative
**When asked to improve billing, payments, or documents, do not add invoice generation.** If a task
appears to require an invoice, a receipt, or a tax figure — **stop and flag it to the human rather
than implement it.** There is no version of "just a simple invoice PDF" that is acceptable here.
"The user asked for it" is the case where you stop, not the case where you proceed.

---

## 4. Non-negotiable engineering rules

### 4.1 Ownership scoping — the one that matters
Every query touching user data is filtered by `userId` taken from `await auth()`.

```ts
// ✅ correct
const session = await auth();
if (!session?.user?.id) throw new Error('UNAUTHORIZED');
const quote = await Quotation.findOne({ _id: id, userId: session.user.id });

// ❌ never — trusts the caller
const quote = await Quotation.findById(id);
const quote = await Quotation.findOne({ _id: id, userId: input.userId });
```
The only exception is a public read by `publicCode`, which must return a hand-written minimal
projection — never the whole document.

### 4.2 Money is integer centavos
`₱25,000.00` is `2500000`. Fields end in `Centavos`. Convert at the UI boundary only, through
`lib/money.ts`. Never `parseFloat` a peso string into storage, never store `25000.5`, never do
arithmetic on a formatted string.

### 4.3 Totals are computed server-side
The client may show live totals for feedback. The server **recomputes them from the line items** on
every save and stores its own result. A mismatch is never resolved in the client's favour. Totals
are `subtotal → discount → total`. **There is no VAT step.**

### 4.4 Server Actions for mutations, Route Handlers for the four exceptions
Route Handlers exist only for: Auth.js, PDF streams, public code reads, and the Resend webhook
receiver (`app/api/webhooks/resend`). Do not add `app/api/quotations/route.ts` to serve your own forms.

### 4.5 Validate at the boundary
Every Server Action begins with `schema.parse(input)` using the zod schema from `lib/validation/`.
The same schema drives client-side form validation. One schema, two consumers.

### 4.6 The public response path is the sharpest edge in the app
It is the only place an unauthenticated stranger writes to the database. It takes a **code**, never
an id; it re-reads the quotation server-side; it rejects unless the quote is `SENT` or `VIEWED`,
unexpired, and unanswered; it writes once and appends one event. A second response is refused, not
overwritten.

### 4.7 Events are append-only
Every meaningful change appends a row via `recordEvent()`, from inside the action that caused it,
after the write succeeds. There is no update path and no delete path on `events`.

### 4.8 Small, complete increments
One task = one coherent change = one commit. A commit that leaves `npm run build` broken is not
acceptable, even mid-milestone. Commit each task immediately upon verification.

### 4.9 The admin surface is a separate boundary
`/admin/*` is for platform staff, never for users. Guarded by `lib/admin/guard.ts → requireAdmin()`,
which requires **both** `session.user.role === 'ADMIN'` **and** the email in the `ADMIN_EMAILS`
allowlist. Cross-user queries are allowed **only** inside `actions/admin/**` and `lib/admin/**`.
Admin is **read-only over user content** — the complete list of admin writes is suspend, unsuspend,
revoke a public code, disable/enable a user's public links, reset a user's MFA, approve or reject a
top-up, **set or clear the donation QR, enable or disable the donation ask**, and append an audit
entry. Every admin action *and* every view of an identified user's data appends an append-only
`AdminAuditLog` row. A non-admin hitting `/admin/*` gets a **404, not a 403**.

The donation QR is the one admin write that touches **platform** content rather than a user's — a
single `DonationSetting` row that nobody owns. That is the only reason it is permitted here, and it
is not a precedent for admin editing anything a user owns. Adding a further admin write means
amending this list and `DEVELOPMENT_PLAN.md` §6.9 in the same commit, not working around them.

### 4.10 MFA is optional, and its secrets are still radioactive
TOTP is opt-in from Account → Security (`DEVELOPMENT_PLAN.md` §6.11). The parameters are fixed at
**SHA-1 / 6 digits / 30 seconds** — Google Authenticator ignores anything else. Secrets are
AES-256-GCM encrypted at rest and decrypted only inside `lib/mfa.ts`. A secret, a recovery code, or
a submitted code must never reach a log line, an error message, an exception payload, or a data
export — including on the failure path. Verification checks the ±1-step window **and** the
`mfaLastUsedStep` replay guard: one code, one use.

### 4.11 Snapshot before send
When a quotation first transitions to `SENT`, copy the current business and client details into
`businessSnapshot` / `customerSnapshot`. Later edits to those records must not alter quotes already
sent.

---

## 5. Never do this

- ❌ Build, restore, or "temporarily" scaffold anything §3 forbids. This is the one rule where
  stopping and asking is always correct.
- ❌ Reintroduce VAT computation, a TIN field, a product catalogue, or per-month usage limits.
- ❌ Add a dependency that isn't in `DEVELOPMENT_PLAN.md` §5. Ask first, with a one-line reason and
  the bundle cost.
- ❌ Introduce Express, Nest, tRPC, GraphQL, a separate API service, or a monorepo. This project is a
  monolith by decision, not by accident.
- ❌ Swap Mongoose for Prisma/Drizzle, or MongoDB for Postgres. The brief's "assumed Postgres" line
  does not apply to a repo that already runs Mongo (`DEVELOPMENT_PLAN.md` §4).
- ❌ Use Puppeteer/Chromium for PDFs. It does not fit Vercel's serverless limits here.
- ❌ Refactor files unrelated to the current task. Note the issue, keep moving.
- ❌ Rename or renumber an issued quotation, or reuse a number. Old `QUO-000001` documents keep
  their numbers forever.
- ❌ Make `publicCode` sequential, shorter than 12 characters, or derived from an id.
- ❌ Let the public page write anything but a single accept/decline response.
- ❌ Overwrite an existing response, or let a second submission through.
- ❌ Add an update or delete path for `events` or `AdminAuditLog`. Both are append-only.
- ❌ Hard-delete a client or a quotation. Archive or cancel instead.
- ❌ Mutate an `ACCEPTED` or `DECLINED` quotation's line items or totals.
- ❌ Meter quotations, count them against a quota, or charge per quote. Access is time-based
  (`DEVELOPMENT_PLAN.md` §6.10).
- ❌ Lock an expired user out of reading their own quotes, clients, or export.
- ❌ Grant access days from anywhere except an admin-approved top-up.
- ❌ Commit secrets, `.env.local`, or a real `MONGODB_URI`. Update `.env.example` instead.
- ❌ Drop a collection or write a destructive migration without explicit human approval. The dormant
  `invoices` and `products` collections stay where they are.
- ❌ Write `user.role` from any page, form, or Server Action. Admins are created only by
  `npm run grant-admin` plus the `ADMIN_EMAILS` allowlist.
- ❌ Add an admin action that doesn't call `requireAdmin()` and `recordAudit()`.
- ❌ Return 403 from an admin route. Return 404.
- ❌ Build admin impersonation ("log in as user"). It is backlog and needs its own design.
- ❌ Log, return, export, or display a TOTP secret, a recovery code, or a submitted code — on any
  path, including errors.
- ❌ Widen the TOTP verification window past ±1 step, or change the SHA-1 / 6-digit / 30-second
  parameters, to "fix" rejected codes. It's a clock, not a window.
- ❌ Make MFA mandatory again without a human decision recorded in `DEVELOPMENT_PLAN.md` §6.11.
- ❌ Mark a plan checkbox as done when the acceptance criteria don't pass.
- ❌ Comment out or feature-flag code that a P1 task says to delete.

---

## 6. Conventions

**TypeScript** — `strict: true`. No `any`; use `unknown` and narrow. No non-null `!` on anything
from the database or a request.

**Naming** — files `kebab-case.ts`, React components `PascalCase.tsx`, Server Actions as verbs
(`createQuotation`, `markQuotationPaid`, `respondToQuotation`), booleans as `isX` / `hasX`.

**Client vs Customer** — the UI says **Client**, always. The collection is `customers` and the model
is `Customer` for historical reasons. Do not rename the collection; do not let "customer" reach a
user-visible string.

**Components** — Server Components by default. Add `'use client'` only when you need state, effects,
or event handlers, and push it as far down the tree as possible.

**Error handling** — Server Actions return a discriminated result, they don't throw at the UI:
```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
```
Log the real error server-side; return a message a customer could read without alarm.

**Dates** — store UTC, display `Asia/Manila`. Format via `lib/dates.ts` only. Month boundaries for
any dashboard figure are Manila calendar months, not UTC.

**Styling** — Tailwind utilities. No inline `style` objects except for dynamic values. Keep
`components/ui` primitives dumb and unopinionated. **The public quote page gets the design budget;
everything else can be plain.** Every screen renders at 390px.

**Comments** — explain *why*, never *what*. Domain rules from §6 of the plan get a one-line comment
citing the rule.

---

## 7. Commands

```bash
npm run dev         # local dev server
npm run build       # production build — must pass before any commit
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # unit tests (lib/ especially)
npm run seed        # demo data
```

Commit format: `<type>(<scope>): <summary> [<task-id>]`
```
feat(public): add accept and decline to the quote page [P3-T02]
fix(numbering): reset the sequence per Manila year [P2-T01]
chore(invoices): delete the invoice surface [P1-T01]
```

---

## 8. Verify before you claim done

Run this checklist and report the result honestly. A failed check reported is useful; a failed check
hidden costs hours later.

- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run lint` — 0 new warnings
- [ ] `npm run build` — succeeds
- [ ] `npm run test` — passes; new domain logic has a test
- [ ] Every new query is `userId`-scoped (or is a documented public-code read)
- [ ] Money is centavos end to end
- [ ] Nothing added that §3 forbids
- [ ] Manually exercised the happy path **and** one failure path in the browser
- [ ] Renders at 390px
- [ ] `.env.example` updated if a new variable appeared
- [ ] The task checkbox in `DEVELOPMENT_PLAN.md` §12 is ticked
- [ ] Committed with message format: `<type>(<scope>): <summary> [<task-id>]`
- [ ] Deletion tasks only: the grep in *Accept* returns zero, nothing was commented out or flagged
- [ ] Public-page tasks only: the projection leaks no email or ObjectId, the response is idempotent,
      the footer is present
- [ ] Admin tasks only: behind `requireAdmin()`, audited, 404s for non-admins, writes nothing a user
      owns

---

## 9. When you're stuck or unsure

**Stop and ask when:** the task would require anything in §3 · the task conflicts with a rule here ·
a requirement is genuinely ambiguous · you'd need a new dependency · the fix requires changing the
data model · you'd be touching auth, the access model, or the public-code projection.

**Decide and note it when:** the choice is internal, reversible in under an hour, and invisible to
the user (variable names, file splits, Tailwind class ordering, test structure).

**Report format when handing back:**
```
Task: P3-T02 · Accept / Decline
Done: actions/public-response.ts, components/public/response-form.tsx, lib/validation/response.ts
Verified: typecheck ✅ lint ✅ build ✅ double-submit rejected ✅ expired quote rejected ✅
Not done: rate limiting is per-instance in memory — noted as a limitation, not a blocker.
Decisions: name field is required, not optional — an unnamed acceptance is worthless in a dispute.
Next: P3-T03
```

Never claim a check passed without running it. Never invent a file path, an API surface, or a
library function — read the file or check the docs.

---

## 10. Quick reference

| Question | Answer |
|---|---|
| Can I build an invoice / receipt? | **No. Stop and flag it.** §3 |
| Can I add a VAT line? | No — Bilyo quotes prices, it does not compute tax |
| Quotation number format? | `Q-2026-0012`, per user, per Manila year |
| Where does a mutation go? | `actions/<entity>.ts`, Server Action |
| Where does a calculation go? | `lib/` |
| How is money stored? | integer centavos |
| Who can accept a quote? | only the client, on `/q/[code]`, exactly once |
| Is "paid" a status? | No — it's `paidAt` + an optional amount |
| How is access gated? | one nullable `accessUntil`, one comparison. Never credits |
| Does an expired user lose their data? | No — read and export stay open forever |
| Is MFA required? | No, opt-in — but never weaken the crypto |
| Can I add a library? | ask first |
| Can I switch to Postgres? | no |
| Can I delete a record? | no — archive or cancel |
| Which task next? | first unchecked box in `DEVELOPMENT_PLAN.md` §12 |
| Can an admin edit a user's quote? | no — admin is read-only over user content |
| Where do cross-user queries live? | `lib/admin/**` and `actions/admin/**`, nowhere else |

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

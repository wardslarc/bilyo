# AGENTS.md — Bilyo

Instructions for any AI coding agent working in this repository (Claude Code, Codex, Cursor, Gemini CLI, Copilot Workspace, Devin, etc.).

**This file is the rules of engagement. `DEVELOPMENT_PLAN.md` is the work.** If the two ever disagree, `DEVELOPMENT_PLAN.md` wins on *what* to build and this file wins on *how*.

---

## 1. Start of every session

Do these four things before writing any code:

1. Read `DEVELOPMENT_PLAN.md` §2 (actors & surfaces), §5 (domain rules) and §11 (milestones).
2. Find the **first unchecked task** in §11. That is your task unless the human named a different one.
3. Run `npm run typecheck && npm run lint` to confirm you're starting from a clean tree.
4. State, in one or two lines: the task ID, the files you intend to touch, and anything ambiguous. Then start.

Do **not** skip ahead to a later milestone because it seems easier or more interesting. The order encodes dependencies.

---

## 2. Project shape

Monolithic Next.js app. One repo, one deployable, one database.

```
invoiceflow-ph/
├── app/
│   ├── (marketing)/          # landing, pricing
│   ├── (auth)/               # login, register, forgot/reset password
│   ├── (dashboard)/dashboard/
│   │   ├── invoices/  quotations/  customers/  products/  settings/  account/
│   ├── (admin)/admin/        # PLATFORM ADMIN — users, lookup, audit, metrics
│   ├── i/[token]/            # public invoice view
│   ├── q/[token]/            # public quotation view
│   └── api/                  # auth, PDF streams, public reads, webhooks ONLY
├── components/
│   ├── ui/                   # button, input, dialog, badge — local, small
│   ├── documents/            # shared invoice+quotation builder
│   └── dashboard/
├── lib/
│   ├── mongodb.ts  auth.ts  money.ts  totals.ts  numbering.ts
│   ├── dates.ts    plan.ts  validation/   pdf/
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
| PDF layout | `lib/pdf/` | `app/api/` |

---

## 3. Non-negotiable rules

### 3.1 Ownership scoping — the one that matters
Every query touching user data is filtered by `userId` taken from `await auth()`.

```ts
// ✅ correct
const session = await auth();
if (!session?.user?.id) throw new Error('UNAUTHORIZED');
const invoice = await Invoice.findOne({ _id: id, userId: session.user.id });

// ❌ never — trusts the caller
const invoice = await Invoice.findById(id);
const invoice = await Invoice.findOne({ _id: id, userId: input.userId });
```
The only exception is a public read by `publicToken`, which must return a hand-written minimal projection — never the whole document.

### 3.2 Money is integer centavos
`₱25,000.00` is `2500000`. Fields end in `Centavos`. Convert at the UI boundary only, through `lib/money.ts`. Never `parseFloat` a peso string into storage, never store `25000.5`, never do arithmetic on a formatted string.

### 3.3 Totals are computed server-side
The client may show live totals for feedback. The server **recomputes them from the line items** on every save and stores its own result. A mismatch is never resolved in the client's favour.

### 3.4 Server Actions for mutations, Route Handlers for the four exceptions
Route Handlers exist only for: Auth.js, PDF streams, public token reads, and webhooks. Do not add `app/api/invoices/route.ts` to serve your own forms.

### 3.5 Validate at the boundary
Every Server Action begins with `schema.parse(input)` using the zod schema from `lib/validation/`. The same schema drives client-side form validation. One schema, two consumers.

### 3.6 Small, complete increments
One task = one coherent change = one commit. A commit that leaves `npm run build` broken is not acceptable, even mid-milestone.

### 3.7 The admin surface is a separate boundary
`/admin/*` is for platform staff, never for users. It is guarded by `lib/admin/guard.ts →
requireAdmin()`, which requires **both** `session.user.role === 'ADMIN'` **and** the email in the
`ADMIN_EMAILS` env allowlist. Cross-user queries are allowed **only** inside `actions/admin/**` and
`lib/admin/**`; anywhere else an unscoped query is a bug. Admin is **read-only** over user content —
the complete list of admin writes is suspend, unsuspend, set/clear a plan override, revoke a public
token, and append an audit entry. Every admin action *and* every view of an identified user's data
appends an append-only `AdminAuditLog` row. A non-admin hitting `/admin/*` gets a **404, not a 403**.
See `DEVELOPMENT_PLAN.md` §5.8.

### 3.8 MFA is mandatory and its secrets are radioactive
Every account signs in with a password **and** a TOTP code (§5.11 of the plan). Fixed at
**SHA-1 / 6 digits / 30 seconds** — Google Authenticator ignores anything else and produces codes
that never match. Secrets are AES-256-GCM encrypted at rest and decrypted only inside `lib/mfa.ts`.
A secret, a recovery code, or a submitted code must never reach a log line, an error message, an
exception payload, or a data export — including on the failure path. Verification checks the ±1-step
window **and** the `mfaLastUsedStep` replay guard: one code, one use. There is no "disable MFA"
control in this product, only "replace my device".

### 3.9 Snapshot before send
When a document first transitions to `SENT`, copy the current business and customer details into `businessSnapshot` / `customerSnapshot`. Later edits to those records must not alter documents already sent.

---

## 4. Never do this

- ❌ Add a dependency that isn't in `DEVELOPMENT_PLAN.md` §4. Ask first, with a one-line reason and the bundle cost.
- ❌ Introduce Express, Nest, tRPC, GraphQL, a separate API service, or a monorepo. This project is a monolith by decision, not by accident.
- ❌ Swap Mongoose for Prisma/Drizzle, or MongoDB for Postgres.
- ❌ Use Puppeteer/Chromium for PDFs. It does not fit Vercel's serverless limits here.
- ❌ Refactor files unrelated to the current task. Note the issue, keep moving.
- ❌ Rename, renumber, or reuse an issued invoice or quotation number.
- ❌ Hard-delete a customer, product, invoice, or quotation. Archive or cancel instead.
- ❌ Mutate a `PAID` or `CANCELLED` invoice's line items or totals.
- ❌ Commit secrets, `.env.local`, or a real `MONGODB_URI`. Update `.env.example` instead.
- ❌ Write a database migration or drop a collection without explicit human approval.
- ❌ Write `user.role` from any page, form, or Server Action. Admins are created only by
  `npm run grant-admin` plus the `ADMIN_EMAILS` env allowlist.
- ❌ Let an admin path create, edit, send, or delete a user's quotation, invoice, customer, product,
  or business profile.
- ❌ Add an admin action that doesn't call `requireAdmin()` and `recordAudit()`.
- ❌ Add an update or delete path for `AdminAuditLog`. It is append-only.
- ❌ Build admin impersonation ("log in as user"). It is backlog and needs its own design.
- ❌ Return 403 from an admin route. Return 404.
- ❌ Log, return, export, or display a TOTP secret, a recovery code, or a submitted code — on any
  path, including errors.
- ❌ Store a TOTP secret unencrypted, or decrypt one outside `lib/mfa.ts`.
- ❌ Widen the TOTP verification window past ±1 step, or change the SHA-1 / 6-digit / 30-second
  parameters, to "fix" rejected codes. It's a clock, not a window.
- ❌ Verify a code without the replay guard.
- ❌ Build a "disable MFA" control, or let an admin reset another **admin's** MFA from the console.
- ❌ Treat the `mfa_challenge` cookie as a session, or let it authorize anything but `/login/mfa`.
- ❌ Mark a plan checkbox as done when the acceptance criteria don't pass.
- ❌ Fabricate BIR compliance claims in UI copy, PDFs, or marketing text. The PDF footer says the document is not an official sales invoice/receipt.

---

## 5. Conventions

**TypeScript** — `strict: true`. No `any`; use `unknown` and narrow. No non-null `!` on anything from the database or a request.

**Naming** — files `kebab-case.ts`, React components `PascalCase.tsx`, Server Actions as verbs (`createInvoice`, `markInvoicePaid`), booleans as `isX` / `hasX`.

**Components** — Server Components by default. Add `'use client'` only when you need state, effects, or event handlers, and push it as far down the tree as possible.

**Error handling** — Server Actions return a discriminated result, they don't throw at the UI:
```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
```
Log the real error server-side; return a message a customer could read without alarm.

**Dates** — store UTC, display `Asia/Manila`. Format via `lib/dates.ts` only.

**Styling** — Tailwind utilities. No inline `style` objects except for dynamic values. Keep `components/ui` primitives dumb and unopinionated.

**Comments** — explain *why*, never *what*. Domain rules from §5 of the plan get a one-line comment citing the rule.

---

## 6. Commands

```bash
npm run dev         # local dev server
npm run build       # production build — must pass before any commit
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # unit tests (lib/ especially)
npm run seed        # demo data (available from M6-T04)
```

Commit format: `<type>(<scope>): <summary> [<task-id>]`
```
feat(quotations): add line item builder [M3-T01]
fix(totals): round half-up at the centavo [M0-T05]
chore(deps): add @react-pdf/renderer [M3-T04]
```

---

## 7. Verify before you claim done

Run this checklist and report the result honestly. A failed check reported is useful; a failed check hidden costs hours later.

- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run lint` — 0 new warnings
- [ ] `npm run build` — succeeds
- [ ] `npm run test` — passes; new domain logic has a test
- [ ] Every new query is `userId`-scoped (or is a documented public-token read)
- [ ] Money is centavos end to end
- [ ] Manually exercised the happy path **and** one failure path in the browser
- [ ] Renders at 390px
- [ ] `.env.example` updated if a new variable appeared
- [ ] The task checkbox in `DEVELOPMENT_PLAN.md` §11 is ticked
- [ ] Admin work only: behind `requireAdmin()`, audited, 404s for non-admins, writes nothing a user owns

---

## 8. When you're stuck or unsure

**Ask instead of assuming when:** the task conflicts with a rule here · a requirement is genuinely ambiguous · you'd need a new dependency · the fix requires changing the data model · you'd be touching auth, payments, or the public-link projection.

**Decide and note it when:** the choice is internal, reversible in under an hour, and invisible to the user (variable names, file splits, Tailwind class ordering, test structure).

**Report format when handing back:**
```
Task: M3-T04 · PDF template
Done: lib/pdf/QuotationDocument.tsx, /api/quotations/[id]/pdf
Verified: typecheck ✅ lint ✅ build ✅ manual PDF download ✅
Not done: logo rendering — Blob storage isn't set up until M6-T01; using a placeholder box.
Decisions: A4 not Letter (PH standard).
Next: M3-T05
```

Never claim a check passed without running it. Never invent a file path, an API surface, or a library function — read the file or check the docs.

---

## 9. Quick reference

| Question | Answer |
|---|---|
| Where does a mutation go? | `actions/<entity>.ts`, Server Action |
| Where does a calculation go? | `lib/` |
| How is money stored? | integer centavos |
| VAT rate? | 12%, only if `business.vatRegistered` |
| Can I add a library? | ask first |
| TOTP parameters? | SHA-1, 6 digits, 30s — never change them |
| Can an admin reset an admin's MFA? | no — CLI only |
| Can I add an Express server? | no |
| Can I delete a record? | no — archive or cancel |
| Which task next? | first unchecked box in `DEVELOPMENT_PLAN.md` §11 |
| Can an admin edit a user's invoice? | no — admin is read-only over user content |
| Where do cross-user queries live? | `lib/admin/**` and `actions/admin/**`, nowhere else |
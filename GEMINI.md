# GEMINI.md — InvoiceFlow PH

Context file for Gemini CLI / Gemini Code Assist working in this repository.

## Source of truth

| File | Role |
|---|---|
| `DEVELOPMENT_PLAN.md` | **What** to build — domain rules, data model, milestones, task list |
| `AGENTS.md` | **How** to build it — conventions, prohibitions, verification checklist |
| `GEMINI.md` | This file — Gemini-specific workflow, plus the rules you must not violate even if you read nothing else |

**Read `AGENTS.md` in full at the start of every session.** It is short and it is binding. Everything in it applies to you identically; nothing below overrides it.

---

## Project in one paragraph

InvoiceFlow PH is a **monolithic Next.js (App Router) + TypeScript + MongoDB Atlas** application for Philippine freelancers and MSMEs to create quotations and invoices, share them by public link, export PDFs, and track payment. One repo, one deployable, one database, deployed on Vercel. Next.js *is* the backend — Server Actions for mutations, Route Handlers only for auth, PDF streams, public token reads, and webhooks.

---

## Session workflow

1. **Load context.** Read `AGENTS.md`, then `DEVELOPMENT_PLAN.md` §2 (actors & surfaces), §5 (domain rules), §6 (data model), and §11 (milestones).
2. **Pick the task.** The first unchecked box in §7, unless the human names another.
3. **Announce.** One or two lines: task ID, files you'll touch, open questions.
4. **Plan before editing.** For any task touching more than three files, outline the change and wait for a go-ahead.
5. **Implement.** Smallest complete increment that satisfies the acceptance criteria.
6. **Verify.** Run the §7 checklist in `AGENTS.md`. Report each result truthfully.
7. **Close out.** Tick the checkbox in `DEVELOPMENT_PLAN.md` in the same commit, and use the report format from `AGENTS.md` §8.

---

## Using your context window well

Gemini's large context is an advantage here — use it to read *before* writing, not to regenerate whole files.

- **Do** load the relevant model, action, and component files together before editing, so your change matches the existing patterns.
- **Do** grep for an existing helper before writing a new one. `lib/money.ts`, `lib/totals.ts`, `lib/dates.ts`, and `lib/numbering.ts` already own their domains.
- **Don't** rewrite a whole file to change ten lines. Targeted edits keep diffs reviewable.
- **Don't** hold a stale mental copy of a file. If you edited it, re-read before editing again.
- **Don't** generate multiple milestones' worth of code in one pass. One task, verified, then the next.

---

## The rules you must not violate

Full list in `AGENTS.md` §3 and §4. These are the ones where a mistake is expensive or invisible:

1. **Scope every query by `userId` from the session.**
   ```ts
   const session = await auth();
   if (!session?.user?.id) throw new Error('UNAUTHORIZED');
   await Invoice.findOne({ _id: id, userId: session.user.id });
   ```
   Never `findById(id)` on user data. Never take `userId` from the request body or URL. The only exception is a public read by `publicToken`, which returns a hand-written minimal projection.

2. **Money is integer centavos.** `₱25,000.00` → `2500000`. Fields end in `Centavos`. Format only at the display/PDF boundary via `lib/money.ts`.

3. **Totals are recomputed server-side** from line items on every save. The client's numbers are display-only.

4. **VAT is 12%**, applied to `subtotal − discount`, and only when `business.vatRegistered` is true. Store `vatRatePercent` on each document.

5. **Document numbers are sequential per user, atomic, and permanent.** `INV-000001`, `QUO-000001`. Never reuse, never renumber.

6. **Snapshot business and customer details when a document is first sent.** Later profile edits must not change what a customer already received.

7. **No architecture changes.** No Express, no separate API service, no tRPC/GraphQL, no monorepo, no Prisma, no Postgres, no Puppeteer. Monolith by decision.

8. **No new dependency** outside `DEVELOPMENT_PLAN.md` §4 without asking first.

9. **No hard deletes.** Archive or cancel.

10. **No unrequested refactors.** Note the issue, finish your task.

---

## Commands

```bash
npm run dev · npm run build · npm run typecheck · npm run lint · npm run test
```
Never report a check as passing without running it.

---

## Honesty requirements

- If a verification step fails, say so and stop. A reported failure is cheap; a hidden one is not.
- If you did not implement part of a task, list it explicitly under "Not done" with the reason.
- If you are unsure a file, function, or API exists, read it or search for it. Do not invent paths, exports, or library methods.
- If a task in the plan is ambiguous or contradicts a rule above, ask before proceeding.
- If you changed something outside the task's stated scope, call it out prominently.
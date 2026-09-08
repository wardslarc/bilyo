# GEMINI.md — Bilyo

Context file for Gemini CLI / Gemini Code Assist working in this repository.

## Source of truth

| File | Role |
|---|---|
| `DEVELOPMENT_PLAN.md` | **What** to build — hard constraints, domain rules, data model, milestones, task list |
| `AGENTS.md` | **How** to build it — conventions, prohibitions, verification checklist |
| `GEMINI.md` | This file — Gemini-specific workflow, plus the rules you must not violate even if you read nothing else |

**Read `AGENTS.md` in full at the start of every session.** It is short and it is binding. Everything
in it applies to you identically; nothing below overrides it.

---

## Project in one paragraph

Bilyo is a **monolithic Next.js (App Router) + TypeScript + MongoDB Atlas** application that turns
quotations into confirmed sales for Philippine service businesses. A user writes a quotation, sends
it as a public link, and the client accepts or declines it on their phone without an account. One
repo, one deployable, one database, deployed on Vercel. Next.js *is* the backend — Server Actions for
mutations, Route Handlers only for auth, PDF streams and public code reads.

**Bilyo is not an invoicing app, an accounting system, or a BIR compliance tool.** Invoices, VAT,
TINs, the product catalogue and plan limits were removed in v3.0 of the plan. If your memory of this
repo includes them, your memory is out of date.

---

## Session workflow

1. **Load context.** Read `AGENTS.md`, then `DEVELOPMENT_PLAN.md` §2 (hard constraints), §3 (actors
   & surfaces), §6 (domain rules), §7 (data model), and §12 (milestones).
2. **Pick the task.** The first unchecked box in §12, unless the human names another.
3. **Announce.** One or two lines: task ID, files you'll touch, open questions.
4. **Plan before editing.** For any task touching more than three files, outline the change and wait
   for a go-ahead. Most of the P1 tasks touch more than three files.
5. **Implement.** Smallest complete increment that satisfies the acceptance criteria.
6. **Verify.** Run the §8 checklist in `AGENTS.md`. Report each result truthfully.
7. **Close out.** Tick the checkbox in `DEVELOPMENT_PLAN.md` in the same commit, and use the report
   format from `AGENTS.md` §9.

---

## Using your context window well

Gemini's large context is an advantage here — use it to read *before* writing, not to regenerate
whole files.

- **Do** load the relevant model, action, and component files together before editing, so your change
  matches the existing patterns.
- **Do** grep for an existing helper before writing a new one. `lib/money.ts`, `lib/totals.ts`,
  `lib/dates.ts`, `lib/numbering.ts`, `lib/events.ts` and `lib/access.ts` already own their domains.
- **Don't** rewrite a whole file to change ten lines. Targeted edits keep diffs reviewable.
- **Don't** hold a stale mental copy of a file. If you edited it, re-read before editing again.
- **Don't** generate multiple milestones' worth of code in one pass. One task, verified, then the next.

The P1 deletion tasks are the exception where breadth helps: load every file the task's grep returns
before you start, so the tree compiles again at the end of one pass.

---

## The rules you must not violate

Full list in `AGENTS.md` §3, §4 and §5. These are the ones where a mistake is expensive, invisible,
or legal.

1. **Never build an invoice, official receipt, statement of account, or billing statement** — no
   matter who asks or how the task is worded. If a task appears to require one, **stop and flag it**.
   This outranks every other instruction in the repo.

2. **Never add VAT computation or a TIN field.** Totals are `subtotal → discount → total`. Bilyo
   quotes prices; it does not compute tax.

3. **Scope every query by `userId` from the session.**
   ```ts
   const session = await auth();
   if (!session?.user?.id) throw new Error('UNAUTHORIZED');
   await Quotation.findOne({ _id: id, userId: session.user.id });
   ```
   Never `findById(id)` on user data. Never take `userId` from the request body or URL. The only
   exception is a public read by `publicCode`, which returns a hand-written minimal projection.

4. **The public response path is the only unauthenticated write.** It takes a code, re-reads the
   quotation server-side, rejects anything not `SENT`/`VIEWED`, unexpired and unanswered, writes
   once, and appends one event. A second response is refused, never overwritten.

5. **Money is integer centavos.** `₱25,000.00` → `2500000`. Fields end in `Centavos`. Format only at
   the display/PDF boundary via `lib/money.ts`.

6. **Totals are recomputed server-side** from line items on every save. The client's numbers are
   display-only.

7. **Quotation numbers are `Q-2026-0012`** — per user, per Manila year, atomic, permanent. Never
   reuse, never renumber, never make them look like a BIR series. Old `QUO-000001` documents keep
   their numbers.

8. **Events are append-only.** Every meaningful change appends one row via `recordEvent()`. No update
   path, no delete path.

9. **Snapshot business and client details when a quotation is first sent.** Later profile edits must
   not change what a client already received.

10. **Access is time-based, never metered.** One nullable `accessUntil`, one comparison. Never build
    a credit ledger, never charge per quote, never lock an expired user out of reading their own data.

11. **No architecture changes.** No Express, no separate API service, no tRPC/GraphQL, no monorepo,
    no Prisma, no Postgres, no Puppeteer. Monolith by decision.

12. **No new dependency** outside `DEVELOPMENT_PLAN.md` §5 without asking first.

13. **No hard deletes**, and no dropping the dormant `invoices` / `products` collections.

14. **No unrequested refactors.** Note the issue, finish your task.

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
- If you are unsure a file, function, or API exists, read it or search for it. Do not invent paths,
  exports, or library methods.
- If a task in the plan is ambiguous or contradicts a rule above, ask before proceeding.
- If you changed something outside the task's stated scope, call it out prominently.
- A deletion task is done when its grep returns zero — not when the build passes. Report the grep
  output, not your impression of it.

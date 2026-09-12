# Bilyo — Email Delivery Design (Resend)

> **Status:** design, not yet built. Supersedes `DEVELOPMENT_PLAN.md` §12 P6.
> **Version:** v1.0 · Sep 2026
> **Read with:** `DEVELOPMENT_PLAN.md` §5 (stack), §6.6 (events), §6.7 (public link),
> §9.1–9.2 (flows), §17 (env) · `AGENTS.md` §4.4, §4.6, §4.7, §4.11

---

## 0. Why this document exists

`RESEND_API_KEY` is set and the domain is verified, but **no code in this repo calls Resend.**
The `resend` package is not in `package.json`, there is no `lib/email/`, and the only mention of
Resend in the source is a comment at `actions/auth.ts:143` — *"Until M9 (Resend integration),
print link to server log"*. `sendQuotation()` flips status, mints the public code, snapshots
business and client, appends `SENT`, and returns. It never touches the network.

Nothing is broken. P6 was never built.

---

## 1. Scope decision: what "sending a quotation" means

The plan's thesis is **the link is the product** (§9.1, §9.2): the owner copies a link and pastes
it into Messenger, because that is how Philippine SMEs actually reach their clients. P6 as written
never emails a quotation to a client — it only emails the *owner* (accept/decline), the *user*
(password reset), and *reminders*.

Emailing the quotation to the client is therefore **a new capability, not a plan item.** It is
worth building, but under one hard rule:

> **Email is a second delivery channel. It never becomes the primary one.**
> The copy-link button stays the primary action on the send success state. A quotation is `SENT`
> the moment the database says so, whether or not an email was attempted, accepted, or delivered.

Consequences that follow from that rule, and that the rest of this document exists to enforce:

- `customerSnapshot.email` is optional (`default: ''` in `models/quotation.ts`). An empty client
  email is **not an error** — it is the common case. Send succeeds, no email is attempted, the UI
  shows only the copy-link.
- A Resend outage, a bounced address, or a blown rate limit **cannot** fail a send, roll back a
  status, or block an acceptance.
- Nothing about email delivery is allowed to write to the `events` collection. See §7.

---

## 2. The emails in scope

| ID | Trigger | Recipient | Plan ref | Priority |
|---|---|---|---|---|
| **E1** | Quotation transitions `DRAFT` → `SENT` | Client | *new* | 1 |
| **E2** | Client accepts or declines | Owner | P6-T03 | 1 |
| **E3** | Password reset requested | User | P6-T04 | 2 |
| **E4** | `accessUntil` 7 days / 1 day out | Owner | P6-T05 | 3 (inert until P7) |
| **E6** | A new user completes email verification | Operator (`ADMIN_EMAILS`) | P6-T06 | 2 |

**E6 is internal.** It is the only email in this table whose recipient is not a user, so it carries
no unsubscribe affordance and no suppression of its own beyond the shared bounce/complaint gate.
It fires on *verified*, never on *register*: an unverified row is noise, and the reaper deletes it.

**Deliberately not built:** an email to the owner on `VIEWED`. A quote viewed three times in an
afternoon would send three emails' worth of anxiety for zero decisions. The timeline already
carries it. Revisit only if a Gate 1 interview asks for it.

---

## 3. Architecture

```
lib/email/
  client.ts          Resend client singleton + transport selection
  send.ts            sendEmail() — the ONLY place resend.emails.send is called
  suppression.ts     canSendTo() — pure, testable gate
  recipients.ts      parseAdminEmails() — pure allowlist parsing
  admin-alerts.ts    notifyAdminOfSignup() — E6, operator-facing
  status.ts          status precedence ladder — pure, testable
  templates/
    quotation-sent.ts       E1
    quotation-responded.ts  E2
    password-reset.ts       E3
    access-expiring.ts      E4
    admin-signup-alert.ts   E6
  templates/layout.ts       shared shell + §2.3 footer
models/email-message.ts     the outbox ledger  ← the load-bearing piece
models/webhook-receipt.ts   svix-id dedupe, TTL indexed
app/api/webhooks/resend/route.ts
```

Templates are **pure functions**: `(input) => { subject, html, text }`. No database access, no
`process.env`, no clock. That is what makes them unit-testable under §16, and it is the difference
between a mailer you can trust and one you find out about from a user.

### 3.1 The outbox ledger — `emailMessages`

This is the piece that most email integrations skip and then regret. Without it you cannot answer
the one question that matters: *did the client actually get it?*

```
_id, userId, quotationId (nullable), kind, toEmail, subject,
providerId (Resend message id — unique, sparse),
idempotencyKey (unique),
status, attempts, lastError,
queuedAt, sentAt, deliveredAt, bouncedAt, complainedAt,
createdAt, updatedAt
```

`kind`: `QUOTATION_SENT` · `QUOTATION_RESPONDED` · `PASSWORD_RESET` · `ACCESS_EXPIRING`

`status`: `SKIPPED` · `QUEUED` · `SENT` · `DELIVERED` · `DELAYED` · `BOUNCED` · `COMPLAINED` ·
`FAILED` · `SUPPRESSED`

Indexes: `{userId, createdAt:-1}` · `{quotationId, createdAt:-1}` ·
`{providerId}` unique sparse · `{idempotencyKey}` unique · `{toEmail, status}`

Ownership scoping (`AGENTS.md` §4.1) applies: every read of this collection outside
`actions/admin/**` is `userId`-scoped.

**`providerId` is the join key.** Resend's webhook payload identifies the message by its id and
nothing else. Store it on the send response or the webhook is useless.

---

## 4. The send path

The ordering below is the whole design. It is not negotiable.

```
sendQuotation(id)
 ├─ 1. requireUser() · assertNotSuspended()
 ├─ 2. load quotation, guard status === 'DRAFT'
 ├─ 3. mint publicCode, snapshot business + client   (AGENTS.md §4.11)
 ├─ 4. doc.save()                                    ← the quotation is now SENT
 ├─ 5. recordEvent({ type:'SENT', actor:'OWNER' })   (AGENTS.md §4.7 — after the write)
 ├─ 6. safeRevalidate(...)
 │
 ├─ 7. try { await deliverQuotationEmail(doc) } catch { log only }   ← CANNOT THROW
 │
 └─ 8. return { ok:true, data: { ...quotation, emailState } }
```

Step 7 sits **after** step 6 on purpose. By the time the mailer runs, every piece of state the user
cares about is already durable. P6-T03 states the principle for acceptances — *"a dead mailer must
never roll back an acceptance"* — and it applies identically here.

`deliverQuotationEmail` is wrapped in its own try/catch **and** returns a result rather than
throwing, so there are two layers between Resend and your transaction. Belt and braces, because the
failure it guards against is silent and expensive.

### 4.1 Gates before any send — `canSendTo()`

Pure function, no I/O, unit-tested. Returns `{ ok: true }` or `{ ok: false, reason }`.

| Gate | Reason code | Rationale |
|---|---|---|
| Recipient address empty or invalid | `NO_ADDRESS` | Common, not an error |
| Owner `suspendedAt` set | `OWNER_SUSPENDED` | P6-T02: never send for a suspended account |
| Owner `publicLinksDisabledAt` set | `LINKS_DISABLED` | The link in the email would be dead |
| Quotation `publicCodeRevokedAt` set | `CODE_REVOKED` | Same |
| Address previously hard-bounced | `SUPPRESSED_BOUNCE` | Protects domain reputation |
| Address previously complained | `SUPPRESSED_COMPLAINT` | Legally and operationally mandatory |
| `MAIL_DRY_RUN=true` or no `RESEND_API_KEY` | `DRY_RUN` | Writes a `SKIPPED` row, logs, returns |

Every outcome writes an `emailMessages` row. A skip is a fact worth recording — "why didn't my
client get the email" is a support ticket, and §18 exists to answer those from data.

### 4.2 Idempotency — two independent layers

A Server Action can run twice. React re-invokes on retry, users double-tap on slow Philippine
mobile data, and the confirm dialog does not prevent a second submit after a timeout.

1. **Local:** `idempotencyKey = 'quotation-sent:' + quotationId`, unique-indexed. A duplicate
   insert throws `E11000`, which `deliverQuotationEmail` catches and treats as *already sent*.
2. **Remote:** the same string passed as Resend's `Idempotency-Key` header. Resend keys are unique
   per request, expire after 24 hours, max 256 characters.

Layer 1 alone is enough in normal operation. Layer 2 covers the window where the insert succeeded
and the process died before the API call returned.

### 4.3 The E1 email itself

- **Subject:** `Quotation {number} from {businessName} — ₱{total}`
- **From:** `EMAIL_FROM`, e.g. `Bilyo <notifications@bilyoapp.com>` — must be on the verified domain
- **Reply-To: `businessSnapshot.email`** — so the client's reply reaches the owner, not a mailbox
  nobody reads. This single header is the difference between a tool and a dead end. Fall back to
  omitting Reply-To entirely if the business has no email; never fall back to a Bilyo address.
- **Body:** business name and logo, client name, total, `validUntil`, and one large button to
  `{APP_URL}/q/{code}`. Not the full line-item table — the point of the email is to get a thumb
  onto the link, where the real page lives and where Accept/Decline is.
- **Plain-text part, always**, carrying the raw URL. Non-negotiable: it is what Gmail shows when it
  clips, what some Android clients render by default, and what keeps you out of spam.
- **The §2.3 required footer** appears in both parts. An email showing a total is close enough to a
  quotation view that the footer belongs there; §2 constraints outrank convenience.
- **No open tracking, no click tracking.** See §5.2 — this is a correctness decision, not a
  privacy preference.
- **No PDF attachment in v1.** Rendering `@react-pdf/renderer` inside the send path adds seconds
  and a failure mode to a serverless action, and an attachment invites the client to reply by email
  instead of tapping Accept — which is precisely the signal Gate 2 and Gate 3 measure. The 40MB
  Resend ceiling is not the constraint; the funnel is. Revisit after Gate 1 interviews if clients
  ask for it, and if they do, render it *before* step 4 and treat a render failure as "send the
  email without it."

### 4.4 What the UI does with the result

`sendQuotation` returns `emailState` alongside the quotation:

| `emailState` | Success screen says |
|---|---|
| `{ attempted: false, reason: 'NO_ADDRESS' }` | "Quotation sent. Copy the link and send it to your client." |
| `{ attempted: true, ok: true }` | "Quotation sent. We emailed **maria@example.com** — you can also copy the link." |
| `{ attempted: true, ok: false }` | "Quotation sent. We couldn't email it — copy the link and send it another way." |

The copy-link button is the primary action in all three. Also worth fixing while you are in there:
the confirm text in `components/dashboard/QuotationList.tsx:88` reads *"Send this quotation? The
client and business details will be locked in"*, which sounds like it emails. Reword to name what
actually happens.

---

## 5. Webhooks — do you need them?

**Short answer: not to send. Yes, to be trustworthy.** Subscribe to a narrow set, and refuse two
of them on purpose.

### 5.1 Why they are worth the route

A `200` from Resend means *accepted for delivery*. It does not mean delivered. Nothing in the API
response tells you the client's address was a typo, or that their mail server rejected it.

For a quotation tool that is the worst failure mode in the product: the owner sees "sent", waits
four days for an answer that was never going to come, and concludes Bilyo does not work. Bounce
detection is what turns that into "we couldn't deliver this to maria@exmaple.com — copy the link
instead." That is one webhook event doing more for retention than most features.

### 5.2 Subscribe to these

| Event | What you do with it |
|---|---|
| `email.sent` | Confirm `providerId`; status → `SENT` |
| `email.delivered` | Status → `DELIVERED`. Makes the owner-facing timeline honest |
| `email.bounced` | Status → `BOUNCED`, add to local suppression, **surface on the quote page** |
| `email.complained` | Status → `COMPLAINED`, suppress permanently, never retry that address |
| `email.delivery_delayed` | Status → `DELAYED`; informational, do not alarm the owner yet |
| `email.failed` | Status → `FAILED`; this is a Resend-side error, log it with the payload |
| `email.suppressed` | Resend refused it against its own list; mirror locally |

### 5.3 Do NOT subscribe to `email.opened` or `email.clicked`

Three independent reasons, any one of which is sufficient:

1. **They are wrong.** Apple Mail Privacy Protection and Gmail's image proxy prefetch pixels
   without a human present. You would tell the owner "your client opened it" when nobody did.
2. **Click tracking rewrites your URLs.** The public quote link is pasted into Messenger and
   judged on sight by a stranger. A tracking-domain redirect looks like phishing and is exactly
   the wrong thing for the one screen the plan says gets the design budget (§6.7).
3. **It would corrupt the audit trail.** §6.6 records `VIEWED` **once**, from a real hit on
   `/q/[code]`. §18 says that row — timestamp, typed name, coarse IP — is what settles a dispute
   over an acceptance. An open pixel must never be allowed anywhere near it.

**Rule: no email event ever writes to `events`.** Email state lives in `emailMessages` and is
merged into the timeline at render time in the UI. This keeps the §6.6 event enum intact and keeps
the dispute record clean.

Domain, contact and suppression-list events: not needed. Skip them.

### 5.4 Implementing the receiver

`app/api/webhooks/resend/route.ts`

**This is a fourth Route Handler, and `AGENTS.md` §4.4 says there are exactly three** (Auth.js,
PDF streams, public code reads). Amend §4.4 and the §5 stack table in the same commit, or the next
agent that reads AGENTS.md will delete this route as a violation. It is the kind of thing that
happens quietly and costs an afternoon.

Requirements, in order:

1. **Read the raw body** — `await req.text()`, never `req.json()` first. The signature is over the
   exact bytes; any reserialization breaks it.
2. **Verify the signature** from `svix-id`, `svix-timestamp`, `svix-signature` against
   `RESEND_WEBHOOK_SECRET`. Resend signs via Svix. Verify manually with `node:crypto` HMAC-SHA256
   rather than adding the `svix` package — §5 of the plan requires human approval for a new
   dependency, and this is ~20 lines. Constant-time compare.
3. **Reject stale timestamps** — older than 5 minutes → 400. Replay protection.
4. **Dedupe on `svix-id`.** Resend guarantees *at-least-once*, not exactly-once. Insert into
   `webhookReceipts` with a unique index and a TTL of 24 hours; `E11000` → return 200 and stop.
   The TTL comfortably covers the retry schedule (5s, 5min, 30min, 2h, 5h, 10h).
5. **Do not assume ordering.** Events can arrive out of order. Sort by the payload's `created_at`
   and apply a **status precedence ladder** so a late `delivered` can never overwrite a `bounced`:

   ```
   QUEUED < SENT < DELIVERED < DELAYED < SUPPRESSED < BOUNCED < COMPLAINED
   ```
   Only advance the row if the incoming status ranks higher. Pure function, unit-tested.
6. **Correlate by `providerId` only.** Never look the recipient up by the email address in the
   payload. The payload is untrusted input from the network, not an instruction.
7. **Return 200 for anything you accepted**, including events you ignore. Return non-2xx only for
   a bad signature. A 500 puts you on the ten-hour retry ladder for a message you were going to
   drop anyway.
8. **Leave `middleware.ts` alone.** Its matcher is scoped to `/dashboard` and `/admin` only, so
   `/api/webhooks/resend` is already unguarded. Do not widen the matcher to "protect" it — the
   signature check in step 2 *is* the authentication.
9. Register the endpoint URL in the Resend dashboard **per environment**. Preview deployments get
   rotating URLs — point webhooks at production only, and use `MAIL_DRY_RUN=true` everywhere else.

### 5.5 What the owner sees after a bounce

On the quotation detail page, below the timeline:

> ⚠️ **We couldn't deliver this to maria@exmaple.com.** The address was rejected. Copy the link
> and send it to your client another way — the quotation itself is fine.

Plus a "fix the client's email" link to the client record. This is the payoff for the whole
webhook route; if you build the receiver and never surface this, you built nothing.

---

## 6. Environment variables

Add to `.env.example`, `.env.local`, Vercel, **and `DEVELOPMENT_PLAN.md` §17** — §17 currently
omits `EMAIL_FROM` entirely, and `.env.local` is missing both `EMAIL_FROM` and `MAIL_DRY_RUN`
even though `.env.example` declares them. Fix all four in one commit.

```
RESEND_API_KEY=                # present = live transport            (P6)
RESEND_WEBHOOK_SECRET=         # svix signing secret, prod only      (P6)
EMAIL_FROM="Bilyo <notifications@bilyoapp.com>"  # must be on the verified domain
MAIL_DRY_RUN=true              # true everywhere except production
```

`MAIL_DRY_RUN` beats "no API key" as the dev switch, because you want the key present in preview
to catch config errors without mailing a real client from a branch deploy.

---

## 7. Rate limits and volume

Resend's default is **10 requests/second per team**, 429 on breach. E1, E2 and E3 are one-at-a-time
and will never approach it. E4 is a cron sweeping every user with an `accessUntil` in range, so it
must chunk, pace, and carry a per-recipient `Idempotency-Key` of `{userId}:{accessUntil}:{kind}`
exactly as P6-T05 specifies. `CRON_SECRET` is already reserved in `.env.example` for this.

---

## 8. Testing (per §16)

**Unit — pure, no excuses:**
- Each template renders subject/html/text; the §2.3 footer is present in both parts
- `canSendTo()` returns the right reason for each gate
- The status precedence ladder never regresses `BOUNCED` to `DELIVERED`
- Signature verification accepts a known-good fixture and rejects a tampered body

**Integration — the paths where a bug is expensive:**
1. No `RESEND_API_KEY` → quotation still transitions to `SENT`, one `SKIPPED` row, zero network
2. Resend throws → quotation still `SENT`, `recordEvent('SENT')` still written, action returns `ok:true`
3. `sendQuotation` invoked twice → exactly one `emailMessages` row, one API call
4. Same `svix-id` delivered twice → second is a no-op, 200
5. `bounced` then a late `delivered` → row stays `BOUNCED`
6. Client with empty email → `SENT`, no row of kind `QUOTATION_SENT` in a failed state, no error in the UI

**Manual before deploy:** the §9.2 flow on a real phone, from a real Messenger link — and now also
from a real email, on Gmail Android, with images off.

---

## 9. Division of Responsibilities

Email delivery requires coordination between platform configuration in the Resend dashboard (human) and code implementation in Next.js/MongoDB (agent).

```
+-------------------------------------------------------------------------+
| HUMAN TASKS (Configuration & Dashboard)                                 |
| 1. Domain verification & sender mailbox in Resend                      |
| 2. Configure Webhook Endpoint URL in Resend Dashboard                   |
| 3. Select active webhook events & disable noise/tracking events        |
| 4. Copy Signing Secret (whsec_...) to env variables                    |
| 5. Approve AGENTS.md §4.4 route handler exception & resend package     |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
| AGENT TASKS (Code & Infrastructure)                                     |
| 1. Amend rules & dependency tables (AGENTS.md, DEVELOPMENT_PLAN.md)    |
| 2. Outbox & dedupe models (`emailMessages`, `webhookReceipts`)          |
| 3. Core email client, pure gates, precedence ladder, outbox writer      |
| 4. E1 template + fail-safe wire into sendQuotation + UI banner          |
| 5. Webhook receiver route (svix HMAC-SHA256 verification + dedupe)     |
| 6. Quotation detail bounce alert UI                                     |
| 7. Remainder templates: E2 (accepted), E3 (password reset), E4 (expiry) |
| 8. Comprehensive test suite (pure unit tests + build validation)        |
+-------------------------------------------------------------------------+
```

---

## 10. Human Setup Tasks (Step-by-Step Guide for the User)

These tasks must be performed by you in the [Resend Dashboard](https://resend.com/overview) and your hosting environment (Vercel / `.env.local`).

### Task H1 · Domain & Sender Verification
- [ ] Confirm your sending domain is verified in [Resend Domains](https://resend.com/domains) with green checkmarks for SPF, DKIM, and MX.
- [ ] Choose your sender address, e.g., `Bilyo <notifications@yourdomain.com>` or `quotes@yourdomain.com`.
  *Note:* The domain part must match your verified Resend domain.

### Task H2 · Resend Webhook Configuration
Navigate to: **Resend Dashboard -> Webhooks -> [Add Webhook](https://resend.com/webhooks)**.

1. **Endpoint URL:**
   - **Production:** `https://<your-production-domain>/api/webhooks/resend`
     *(e.g., `https://bilyoapp.com/api/webhooks/resend` or your Vercel production URL)*
   - **Local Development (Optional):** If testing incoming webhooks locally, expose port 3000 via a tunnel (e.g. ngrok: `https://<ngrok-id>.ngrok-free.app/api/webhooks/resend`). Otherwise, leave `MAIL_DRY_RUN=true` in local development so webhooks are not required locally.

2. **Event Subscription Selection:**
   Configure the checkboxes in Resend exactly as follows:

   **Events to ENABLE (Check these):**
   - [x] `email.sent` — Confirms message dispatch from Resend
   - [x] `email.delivered` — Confirms inbox delivery for honest audit timeline
   - [x] `email.delivery_delayed` — Informational delivery delay notification
   - [x] `email.bounced` — **Critical:** Marks email as bounced and alerts owner on quotation page
   - [x] `email.complained` — **Critical:** Permanent suppression to protect sender reputation
   - [x] `email.failed` — Logs provider-side failure
   - [x] `email.suppressed` — Mirrors Resend-side suppression locally

   **Events to DISABLE / LEAVE UNCHECKED:**
   - [ ] `email.opened` — **DO NOT ENABLE.** (Apple MPP and Gmail bot pre-fetching trigger false opens; corrupts audit trail)
   - [ ] `email.clicked` — **DO NOT ENABLE.** (Link tracking rewrites URLs through tracking proxies, looking like phishing on Messenger pastes)
   - [ ] `domain.*` — **DO NOT ENABLE.** (Not needed by application)
   - [ ] `contact.*` — **DO NOT ENABLE.** (Not needed by application)

3. **Obtain the Signing Secret:**
   - Once the webhook is created, Resend displays the **Signing Secret** starting with `whsec_...`.
   - Copy this secret for Task H3.

### Task H3 · Environment Variables Setup
Set the following environment variables in **Vercel Project Settings -> Environment Variables** (for Production/Preview) and in your local `.env.local`:

```bash
# Live Resend API key (from Resend -> API Keys)
RESEND_API_KEY="re_..."

# The webhook signing secret from Task H2 (starts with whsec_)
RESEND_WEBHOOK_SECRET="whsec_..."

# Sender email using your verified domain
EMAIL_FROM="Bilyo <notifications@yourdomain.com>"

# Dry run toggle: false in production, true in preview and local dev
# In production Vercel:
MAIL_DRY_RUN="false"
# In local .env.local:
MAIL_DRY_RUN="true"
```

### Task H4 · Policy Approvals
Confirm your approval on the following repository rules:
- [x] **Approve 4th Route Handler:** Amend `AGENTS.md` §4.4 to permit `app/api/webhooks/resend/route.ts` as the 4th sanctioned Route Handler.
- [x] **Approve `resend` package:** Authorize adding the official `resend` SDK to `package.json` under `DEVELOPMENT_PLAN.md` §5. (Note: `svix` is rejected; signature verification is handled natively via `node:crypto`).
- [x] **Confirm E1 Subject Line:** Default is `Quotation {number} from {businessName} — ₱{total}`.
- [x] **Confirm PDF Attachment is Off for v1:** Delivery link only; clients view and accept on the web.

---

## 11. Agent Implementation Tasks (Step-by-Step for AI Agent)

These tasks are executed by the AI coding agent in sequence. Every task must pass `npm run typecheck`, `npm run lint`, and build cleanly.

### Phase A: Architecture & Storage Setup
- [x] **P6-A01 · Amend Documentation & Permissions**
  - Files: `AGENTS.md` §4.4, `DEVELOPMENT_PLAN.md` §5, §17, `.env.example`.
  - Add `app/api/webhooks/resend` to Route Handler exceptions.
  - Add `resend` to the approved dependencies table.
  - Document `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM`, and `MAIL_DRY_RUN`.

- [x] **P6-A02 · Database Models (`emailMessages` & `webhookReceipts`)**
  - Files: `models/email-message.ts`, `models/webhook-receipt.ts`, `models/index.ts`.
  - Implement the outbox ledger with indexes: `{userId, createdAt: -1}`, `{quotationId, createdAt: -1}`, `{providerId}` (unique sparse), `{idempotencyKey}` (unique), `{toEmail, status}`.
  - Implement `webhookReceipts` with `svixId` (unique) and a 24-hour TTL index.

### Phase B: Core Email Infrastructure
- [x] **P6-A03 · `lib/email/` Core Utilities**
  - Files:
    - `lib/email/client.ts` — Resend client singleton.
    - `lib/email/suppression.ts` — Pure `canSendTo()` gate checking address validity, account suspension, links disabled, revoked code, and past bounce/complaint suppression.
    - `lib/email/status.ts` — Pure status precedence ladder function (`QUEUED < SENT < DELIVERED < DELAYED < SUPPRESSED < BOUNCED < COMPLAINED`).
    - `lib/email/templates/layout.ts` — Shared HTML and plain-text responsive email wrapper with mandatory §2.3 quotation footer.
    - `lib/email/send.ts` — `sendEmail()` wrapper handling dry-run mocking, idempotency headers, outbox creation, and provider ID capture.

### Phase C: Primary Flow (E1 Quotation Sent & UI Integration)
- [x] **P6-A04 · E1 Quotation Sent Template & Action Integration**
  - Files: `lib/email/templates/quotation-sent.ts`, `actions/quotations.ts`, `components/dashboard/QuotationList.tsx`, `app/(dashboard)/dashboard/quotations/[id]/page.tsx`.
  - Create E1 template (business name, client name, formatted total, link to `/q/[code]`, `Reply-To: businessSnapshot.email`).
  - Wire into `sendQuotation` Server Action at **Step 7 (after doc.save() and event append)** wrapped in non-fatal try/catch.
  - Return `emailState` (`{ attempted, ok, reason? }`) and update quotation send UI to reflect whether email was sent or skipped.

### Phase D: Webhook Receiver & Bounce Warning
- [x] **P6-A05 · Webhook Receiver Endpoint**
  - Files: `app/api/webhooks/resend/route.ts`.
  - Read raw body via `req.text()`.
  - Verify Svix signature with `node:crypto` HMAC-SHA256 using `RESEND_WEBHOOK_SECRET`.
  - Enforce 5-minute replay prevention window.
  - Deduplicate on `svix-id` via `WebhookReceipt` (E11000 returns 200 OK).
  - Update `EmailMessage` matching `providerId` according to the status precedence ladder.

- [x] **P6-A06 · Quotation Detail Bounce Warning Banner**
  - Files: `components/quotations/email-status-banner.tsx`, `app/(dashboard)/dashboard/quotations/[id]/page.tsx`.
  - If latest `EmailMessage` is `BOUNCED` or `FAILED`, render prominent alert:
    *"We couldn't deliver this quotation to [email]. The address bounced. Copy the link to send via Messenger, or update the client's email."*

### Phase E: Secondary Notification Templates
- [x] **P6-A07 · E2 "Quotation Accepted / Declined" Notification to Owner**
  - Files: `lib/email/templates/quotation-responded.ts`, `actions/public-response.ts`.
  - Non-blocking notification to owner on client accept/decline.

- [x] **P6-A08 · E3 Password Reset by Email**
  - Files: `lib/email/templates/password-reset.ts`, `actions/auth.ts`.
  - Replace temporary console log in `requestPasswordReset` with live email send.

- [x] **P6-A09 · E4 Access Expiry Reminders**
  - Files: `lib/email/templates/access-expiring.ts`, `lib/email/reminders.ts`.
  - Inert helper for 7-day and 1-day reminders before `accessUntil`.

### Phase F: Automated Testing & Verification
- [x] **P6-A10 · Unit & Integration Tests**
  - Files: `tests/email-templates.test.ts`, `tests/email-logic.test.ts`.
  - Test pure templates (footer presence in HTML & text).
  - Test `canSendTo()` reason codes.
  - Test precedence ladder ordering.
  - Test webhook signature validator with known good fixture and tampered fixture.
  - Run full test suite: `npm run typecheck && npm run lint && npm run test && npm run build`.

---

## 12. Testing & Verification Checklist

Before marking email delivery complete, execute this joint checklist:

| Check | Responsible | Verification Method |
|---|---|---|
| `npm run typecheck` passes with 0 errors | Agent | CLI command |
| `npm run lint` passes with 0 errors | Agent | CLI command |
| `npm run test` passes all unit tests | Agent | CLI command |
| Send quotation with empty client email succeeds cleanly without error | Agent / Human | Creates quote with no client email -> `emailState.attempted === false` |
| Send quotation with client email creates `EmailMessage` outbox row | Agent / Human | Mongo check / UI feedback |
| Webhook simulation with invalid signature returns 400 | Agent | Integration test |
| Duplicate webhook payload with same `svix-id` returns 200 (idempotent) | Agent | Integration test |
| Live delivery of E1 received in actual inbox (Phone / Desktop) | Human | Real test email in Gmail / Outlook |
| Bounced test address displays warning banner on quotation page | Human | Send to bounce test address (e.g. `bounced@resend.dev`) |
| Mandatory §2.3 footer present in received email (HTML and plain text) | Human | Inspect received email |

---

## 13. Execution Sequence & Handover Protocol

To ensure seamless execution without circular dependencies:

1. **Step 1 (Human):** Approve policy items in Task H4 (reply "Approved").
2. **Step 2 (Agent):** Execute **P6-A01** through **P6-A04** (Models, core mailer, E1 send with dry run, UI updates). Build passes.
3. **Step 3 (Human):** Create the Webhook in Resend (Task H2), set `RESEND_WEBHOOK_SECRET` in `.env.local` / Vercel (Task H3).
4. **Step 4 (Agent):** Execute **P6-A05** and **P6-A06** (Webhook route and bounce UI) + unit tests.
5. **Step 5 (Agent):** Execute **P6-A07** through **P6-A10** (E2, E3, E4 templates and test suite).
6. **Step 6 (Human & Agent):** Joint live verification on staging / production (Section 12).


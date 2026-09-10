# Signup Email Verification — System Design

**Status:** Proposed · **Date:** 2026-09-10 · **Rev 2** (code + link)
**Scope:** M-next, before paid access opens
**Problem:** Accounts are being created with email addresses that do not exist.

> **Rev 2 changes.** Verification now delivers a **6-digit code and a magic link in one
> email**, instead of a link alone. This keeps mobile users in the tab they registered in,
> and lets the session be minted immediately on a correct code. New material: §3.1 (token
> model), §4.3–§4.6 (issue, consume, session minting, brute-force budget), §8 (build order).
> Gates 1–3, the bounce loop, the reaper and the backfill are unchanged from Rev 1.

---

## 0. The framing correction (read this first)

The original request was "require two factor at signup," and the follow-up was "what if we
send a two factor code using the Resend API." The second one is the right mechanism, but it
is worth naming precisely what it is, because the name changes what you have to build:

- **TOTP / authenticator 2FA** proves the person logging in is the same person who
  registered. It says nothing about whether the email address exists. Someone can register
  `asdf@asdf.com`, scan a QR code, and you now own a junk account with 2FA on it.
- **An emailed code or link** proves *control of the mailbox*. That is the control that
  solves this problem. It is email verification, delivered as a code rather than a link.

So: this plan is email verification. Bilyo's existing optional TOTP MFA (§5.11) is
orthogonal, already correct, and stays exactly as it is.

### Why this matters more for Bilyo than for a typical SaaS

The whole product is an email-delivery product — a quotation is worthless if the public
link never lands in the client's inbox. The domain was verified on Resend in Sep 2026 and
has almost no sending history, which means:

- Sending volume is low, so **each bounce is a large share of the bounce rate.**
- ESPs throttle or suspend new domains that bounce above ~2–3%.
- A dozen fake signups, each generating a bounced verification mail, is enough to damage a
  fresh domain's reputation before the first real quotation is ever sent.

**Switching from a link to a code changes none of this.** You are still sending mail to a
possibly-dead address. The requirement is unchanged: **never send to an address we have no
evidence exists, and stop sending the moment evidence says it doesn't.**

---

## 1. Requirements

### Functional

| # | Requirement |
|---|---|
| F1 | No account can obtain a session until the email address is proven reachable. |
| F2 | Verification credential is single-use, expiring, and not brute-forceable. |
| F3 | User can request a new one, rate-limited. |
| F4 | A hard bounce on a verification email permanently kills that pending account's send path. |
| F5 | Obviously-invalid addresses (bad domain, disposable provider) are rejected **before** any send. |
| F6 | Existing beta accounts are grandfathered — nobody gets locked out by the migration. |
| F7 | Unverified accounts are purged automatically so metrics and the DB stay honest. |
| F8 | A mobile user who never leaves the signup tab can complete verification and land in the dashboard. |

### Non-functional

- **Sender reputation is the binding constraint.** Target: hard bounces < 2%, complaints
  < 0.1%. Every design choice below defers to this.
- Solo developer, AI-agent-driven build from written plans. Prefer one mechanism reused
  four times over four clever mechanisms.
- Vercel serverless + MongoDB Atlas. **No Redis, no queue, no new infrastructure.**
- Free public beta — signup friction is a real cost, but a dead domain is a bigger one.
- Zero recurring spend. No paid verification API at this stage.

### Constraints already in the codebase (build on these, don't reinvent)

- `models/user.ts` already has an unused `emailVerifiedAt: Date | null`. It is the natural
  home for this state.
- `models/password-reset-token.ts` is already the token pattern needed: random value,
  hashed at rest, TTL index, single-use `usedAt`.
- **`lib/mfa-challenge.ts` is already a complete code-entry challenge system** — HMAC-signed
  cookie, 5-minute expiry, 5-attempt budget, constant-time comparison, and a short-lived
  session token consumed by `authorize()`. The signup OTP is largely this file generalized.
  See §4.6 for the one place copying it verbatim would be a security bug.
- `app/(auth)/login/mfa/page.tsx` is an existing code-entry UI to model the signup one on.
- `lib/email/send.ts` is a real outbox with an idempotency key, a status ledger, and
  bounce/complaint suppression. Verification mail goes through it, not around it.
- `lib/auth.ts` already throws typed `CredentialsSignin` subclasses
  (`AccountSuspendedError`, `MfaRequiredError`). The verification gate is a third one.
- `app/api/webhooks/resend/route.ts` already ingests bounce events.

---

## 2. High-level design — four gates, cheapest first

```
  POST register
       │
       ▼
  ┌─────────────────────────────────────────┐
  │ GATE 1  Syntax + normalization          │   lib/email/suppression.ts::isValidEmail
  │         (already exists)                │   free, synchronous
  └─────────────────┬───────────────────────┘
                    ▼
  ┌─────────────────────────────────────────┐
  │ GATE 2  Disposable-domain blocklist     │   static list in repo
  │         mailinator, 10minutemail, …     │   free, synchronous
  └─────────────────┬───────────────────────┘
                    ▼
  ┌─────────────────────────────────────────┐
  │ GATE 3  DNS MX lookup on the domain     │   node:dns, ~20-80ms, cached
  │         catches gmial.com, asdf.com     │   fail OPEN on timeout
  └─────────────────┬───────────────────────┘
                    ▼
       create user  emailVerifiedAt = null
                    │
                    ▼
  ┌─────────────────────────────────────────┐
  │ GATE 4  ONE email carrying BOTH:        │   proof of control
  │           • 6-digit code   (15 min)     │   via lib/email/send.ts outbox
  │           • magic link     (24 h)       │
  └─────────────────┬───────────────────────┘
                    │
        ┌───────────┼────────────────┬──────────────────────┐
        ▼           ▼                ▼                      ▼
   code typed   link clicked    5 wrong codes         Resend webhook:
   same tab     other browser   code burned,          hard bounce
   session      → /login        link still live       → emailBouncedAt
   minted       ?verified=1                                 │
        │           │                                       ▼
        └─────┬─────┘                              address suppressed for
              ▼                                    ALL future sends
     emailVerifiedAt = now                         (already works today)
                                                          │
                                                          ▼
                                                 reaper deletes at day 7
```

Gates 1–3 exist so that **most fake addresses never trigger a send at all.** That is the
reputation protection. Gate 4 is the correctness guarantee.

### Decision 1: where the block goes

| Option | Mechanism | Verdict |
|---|---|---|
| **A. No user row until verified** | Pending signups in a separate collection | Rejected. Two sources of truth for "does this email exist", duplicate-email logic in two places, and the unique index on `users.email` stops protecting you. |
| **B. User row created, session refused until verified** | `authorize()` throws `EmailNotVerifiedError` | **Chosen.** |
| **C. Session allowed, sending a quotation blocked until verified** | check in `actions/quotations.ts` | Rejected *for now* — revisit if completion rate < 70% (§7). |

**Why B.** One check in one file, using a pattern that already exists three lines above it
in `lib/auth.ts`. No session-staleness problem: the JWT is only ever minted for a verified
user, so `middleware.ts` — which runs on the edge and cannot reach MongoDB — needs no
changes at all. Every route, action and API handler inherits the guarantee for free,
including ones an agent writes later without reading this document.

### Decision 2: code, link, or both

| Option | For | Against |
|---|---|---|
| Link only | No typing, no brute-force surface, long expiry is safe | On mobile the link opens in Gmail's in-app browser — a *different* browser context from the signup tab. Session can't be minted in place; user gets bounced to `/login`. |
| Code only | Stays in the signup tab, session mintable immediately, matches the `/login/mfa` UI you already have | Brute-force surface, needs short expiry → more resends → more send volume, typo support load |
| **Both, one email** | Covers desktop copy-paste and mobile tap equally; **one send, so zero extra reputation cost** | ~30 extra lines: two hashes and two expiries on one document |

**Chosen: both.** The deciding factor is that the marginal cost is code, not sends — and
sends are the scarce resource here. Slack and Notion both ship this shape.

If scope has to be cut, **cut the link, not the code.** A mobile-first PH freelancer
audience is exactly the population the link path serves worst.

---

## 3. Data model

### 3.1 New collection: `verificationTokens`

```ts
// models/verification-token.ts
{
  userId:        ObjectId  ref User, required, index
  purpose:       String    enum ['EMAIL_VERIFY'], default 'EMAIL_VERIFY'

  // --- link half ---
  tokenHash:     String    required, unique     // sha256(raw 32-byte token)
  expiresAt:     Date      required, index: { expires: 0 }   // TTL, +24h

  // --- code half ---
  codeHash:      String    required             // bcrypt(6-digit code), cost 10
  codeExpiresAt: Date      required             // +15m
  attempts:      Number    default 0            // SERVER-SIDE. see §4.6
  codeInvalidAt: Date      default null         // burned by attempts, or superseded

  // --- shared ---
  usedAt:        Date      default null         // terminal: whole doc consumed
  grantedAt:     Date      default null         // session minted from it once (§4.5)
  createdAt:     Date
}
```

Three deliberate choices:

**Two hash algorithms, on purpose.** The link is looked up *by* `tokenHash`, so it must be
a fast hash — SHA-256, same as password reset. The code is looked up by `userId`, so bcrypt
is affordable (one hash per attempt) and necessary: SHA-256 of a six-digit number is a
one-million-row rainbow table, which matters the day the DB leaks.

**Two expiries, on purpose.** A static code sitting in an inbox for 24 hours is a standing
brute-force target, so 15 minutes. A link is 32 random bytes and is not guessable at any
timescale, so 24 hours — because a signup link is typically opened that evening or the next
morning, and a 1-hour link mostly generates resends, and every resend is send volume you do
not want. Rev 1 argued for 24h on the link and that argument survives; it just does not
transfer to the code.

**`usedAt` and `codeInvalidAt` are different things.** `usedAt` is terminal — the account is
verified, both halves are dead. `codeInvalidAt` kills only the code half while leaving the
link alive, which is what you want when the attempt budget is exhausted or a resend
supersedes an earlier code (§4.7).

### 3.2 `models/user.ts` — additions

```ts
emailVerifiedAt:          Date | null   // ALREADY EXISTS — start using it
emailVerificationSentAt:  Date | null   // resend cooldown
emailVerificationSends:   Number        // default 0, lifetime cap
emailBouncedAt:           Date | null   // set by Resend webhook, hard stop
```

New index for the reaper and the admin console:

```ts
UserSchema.index({ emailVerifiedAt: 1, createdAt: 1 });
```

### 3.3 `models/email-message.ts` — one enum value

```ts
kind: [..., 'EMAIL_VERIFICATION']
```

Everything else in the outbox — idempotency, suppression, webhook status transitions —
works unchanged.

### 3.4 Refactor: `lib/signed-token.ts`

`signChallengePayload` / `verifyChallengeToken` in `lib/mfa-challenge.ts` are generic
HMAC-signed-payload helpers that the signup flow needs too. Extract them to
`lib/signed-token.ts` and have `mfa-challenge.ts` import them, rather than copy-pasting
into a second file where the two copies drift.

Extract only. Do not change behaviour in the same commit.

---

## 4. Deep dive

### 4.1 Gate 2 — disposable domain blocklist

A static `lib/email/disposable-domains.ts` exporting a `Set<string>`, checked against the
domain part. A few hundred entries covers the overwhelming majority of throwaway traffic.

Deliberately **not** a live third-party lookup: that adds a network dependency and a failure
mode to the hot signup path for marginal coverage. Refresh by hand every few months. If
abuse persists, that is the signal to pay for a real API — not before.

### 4.2 Gate 3 — MX lookup

```ts
// lib/email/dns-check.ts
import { promises as dns } from 'node:dns';

export type MxVerdict = 'HAS_MX' | 'NO_MX' | 'UNKNOWN';

export async function domainAcceptsMail(domain: string): Promise<MxVerdict> {
  try {
    const mx = await withTimeout(dns.resolveMx(domain), 2000);
    if (mx.length > 0) return 'HAS_MX';
    // RFC 5321 §5.1: an A record is an implicit MX
    const a = await withTimeout(dns.resolve4(domain), 2000);
    return a.length > 0 ? 'HAS_MX' : 'NO_MX';
  } catch (err) {
    if (isNxDomain(err)) return 'NO_MX';   // domain does not exist at all
    return 'UNKNOWN';                       // timeout / resolver failure
  }
}
```

Three rules that matter:

1. **Fail open on `UNKNOWN`.** A flaky resolver must never block real signups. Only `NO_MX`
   — an authoritative "this domain does not exist or accepts no mail" — rejects.
2. **Cache verdicts** for 24h in a module-level `Map` keyed by domain. Serverless instances
   are short-lived, but gmail.com will hit it constantly within one instance. No DB needed.
3. **Do not SMTP-probe.** `RCPT TO` verification is tempting and wrong: catch-all domains
   accept everything, greylisting produces false negatives, and probing from a Vercel IP is
   a fast way onto a blocklist. MX plus a delivered credential is the correct stopping point.

Typo'd domains are the highest-value catch — `gmial.com`, `yaho.com`, `outlok.com` are what
real users actually type, and they bounce 100% of the time.

### 4.3 Issuing

```
registerUser(input):
  validate (zod)
  → gate 2: disposable?        → field error on email
  → gate 3: MX verdict NO_MX?  → field error "we can't find that email domain"
  → users.email uniqueness check
  → bcrypt cost 10, User.create({ emailVerifiedAt: null })
  → issueVerificationCredential(user)
  → setSignupChallengeCookie(user)
  → return { ok: true, data: { pendingVerification: true } }
```

```ts
// actions/auth.ts
async function issueVerificationCredential(user) {
  const code  = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const token = crypto.randomBytes(32).toString('hex');

  await VerificationToken.create({
    userId:        user._id,
    tokenHash:     sha256(token),
    codeHash:      await bcrypt.hash(code, 10),
    expiresAt:     new Date(Date.now() + 24 * 60 * 60 * 1000),
    codeExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });

  await sendEmail({
    userId: user._id,
    kind: 'EMAIL_VERIFICATION',
    toEmail: user.email,
    idempotencyKey: `email-verify:${sha256(token)}`,
    ...renderEmailVerificationEmail({
      userName: user.name,
      code,
      verifyUrl: `${APP_URL}/verify-email/${token}`,
    }),
  });
}
```

`crypto.randomInt`, never `Math.random()` — a predictable code defeats the entire gate.

**Subject line: `123456 is your Bilyo verification code`.** Putting the code in the subject
makes it readable from a phone's lock-screen notification without opening the mail, which is
most of the mobile UX win. It does leak the code to anyone glancing at the notification;
for signup verification that trade is standard and correct.

**The signup challenge cookie** is an HMAC-signed `{ userId, email, nonce, expiresAt }`,
httpOnly, 15-minute max-age, built on `lib/signed-token.ts` (§3.4). It is what lets
`/verify-email` know who is verifying without putting a userId in a URL. It carries no
authority of its own — it only names the account whose code is being checked.

`app/(auth)/register/page.tsx` **stops calling `signIn()`** and pushes to `/verify-email`.

### 4.4 Consuming — the code path

`actions/auth.ts::verifySignupCode(code)`:

```
read signup challenge cookie      → missing/expired?  → restart signup
find VerificationToken by userId, purpose, usedAt: null, sorted newest
  → none                          → "request a new code"
  → codeInvalidAt set             → "this code is no longer valid, request a new one"
  → codeExpiresAt < now           → "this code expired, request a new one"
  → atomically $inc attempts, re-read
  → attempts > 5                  → set codeInvalidAt, "too many attempts"
  → bcrypt.compare fails          → "incorrect code", N attempts remaining
  → match:
        User.updateOne({ emailVerifiedAt: now })
        token.usedAt = now
        clear signup challenge cookie
        mint session (§4.5)
        redirect /dashboard
```

The `$inc` must happen **before** the comparison and must be atomic
(`findOneAndUpdate`), so that concurrent guesses cannot race past the budget.

### 4.5 Consuming — the link path, and minting the session

`app/(auth)/verify-email/[token]/page.tsx` (server component):

```
sha256(token) → find by tokenHash
  → not found        → "invalid or expired link" + resend form
  → usedAt set       → "already verified, please log in"   (idempotent, not an error)
  → expiresAt < now  → "expired" + resend form
  → else: User.updateOne({ emailVerifiedAt: now }); token.usedAt = now
          redirect /login?verified=1
```

The link path deliberately does **not** mint a session — it may well be running in a
different browser than the one that started signup, so there is no meaningful continuity to
preserve, and `/login` is one tap.

**The code path does mint one**, and this is the only genuinely new piece of auth surface in
this plan. `lib/auth.ts` already has the precedent: `authorize()` Path A accepts a
short-lived HMAC `mfaSessionToken` minted after successful TOTP verification. Add **Path C**
for a `signupSessionToken`, with the same shape and these constraints:

- HMAC-signed with `AUTH_SECRET`, 5-minute expiry.
- Payload carries the **`VerificationToken._id`**, not just the userId.
- `authorize()` re-reads that document and requires: `usedAt` set within the last 5 minutes,
  and `grantedAt` still null. It then sets `grantedAt` — making the token genuinely
  **single-use**, not merely short-lived.
- Session is issued with `mfaVerifiedAt: null, mfaEnabled: false`. Do **not** reuse
  `signMfaSessionToken`, which asserts `mfaEnabled: true` — a signup has verified an
  address, not a second factor, and conflating them would hand a fresh signup an
  MFA-verified session that `middleware.ts` treats as admin-console-eligible.
- Path C must run the same suspension and deletion checks as Paths A and B.

**This is the first thing to cut** if you want less auth surface. Dropping it costs the user
one `/login` round trip after typing the code, and removes a third session-minting path from
a system that currently has two. The activation gain is real but so is the risk; ship it
only once Paths A and B have tests.

### 4.6 Brute-force budget — where copying `mfa-challenge.ts` would be a bug

`lib/mfa-challenge.ts` keeps its attempt counter **inside the signed cookie**
(`incrementMfaChallengeAttempts`). For TOTP that is sound: the code rotates every 30
seconds, so an attacker who deletes the cookie to reset the counter gets a fresh budget
against a code that has already changed.

**For a static 15-minute signup code, that same design is a hole.** Delete the cookie, get
five fresh guesses, repeat indefinitely. Six digits is a million possibilities; unlimited
five-guess rounds walks through it.

So: `attempts` lives on the `VerificationToken` document in MongoDB. The cookie stays, but
only to identify *which* account is being verified — never to hold the budget.

With server-side counting, the arithmetic is:

```
5 attempts per code  ×  5 codes per account (§4.7 lifetime cap)  =  25 guesses
25 / 1,000,000  =  0.0025% chance of a successful guess, per account, ever
```

That is a comfortable margin, and it is only true because both limits are enforced
server-side. Neither one alone is sufficient.

### 4.7 Rate limiting and resends, without Redis

Counters on the user document. No new infrastructure.

- **Cooldown:** reject a resend within 60s of `emailVerificationSentAt`. UI shows a
  countdown.
- **Lifetime cap:** reject at `emailVerificationSends >= 5`. Five undelivered credentials
  means the address is not reachable; a sixth only costs reputation. Fall through to
  "contact support" with `SUPPORT_EMAIL`.
- **Hard stop:** reject unconditionally if `emailBouncedAt` is set.

**On resend, burn prior codes but leave prior links alive.**

```ts
await VerificationToken.updateMany(
  { userId, purpose: 'EMAIL_VERIFY', usedAt: null, codeInvalidAt: null },
  { $set: { codeInvalidAt: new Date() } }
);
```

Reasoning in both directions. Codes: without this, N live codes multiply the attempt budget
by N, and §4.6's arithmetic stops holding. Links: a user who requests a second email and
then clicks the link in the *first* one is doing something completely reasonable, and
invalidating it hands them a dead link for no security gain — 32 random bytes are not
brute-forceable however many are outstanding.

Per-IP signup throttling is the remaining gap and it needs shared state. At current volume
it is not the binding problem — leave it out rather than build half of it. If signup floods
appear, add a TTL-indexed `rateLimits` collection keyed on `sha256(ip)`; move to Upstash
Redis only if that collection becomes hot.

### 4.8 The login gate

`lib/auth.ts`, alongside the two existing typed errors:

```ts
export class EmailNotVerifiedError extends CredentialsSignin {
  code = 'email_not_verified';
}
```

In `authorize()` Path B, **after** the bcrypt comparison and **before** the suspension check:

```ts
if (!user.emailVerifiedAt) {
  throw new EmailNotVerifiedError();
}
```

Order matters. Checking *after* password verification means the error only ever reaches
someone who already knows the password — it is not a new account-enumeration oracle.

Path A needs the same check on its `User.findById` result. An unverified account cannot have
MFA enabled today, but the guard costs one line and survives future refactors.

`/login` renders "Please verify your email" plus a resend button on
`error=email_not_verified`.

### 4.9 Bounce feedback loop

Extend `app/api/webhooks/resend/route.ts`: on `email.bounced` for an `EmailMessage` with
`kind === 'EMAIL_VERIFICATION'` and a **hard** bounce type, set `emailBouncedAt` on the
owning user. Soft bounces (mailbox full, temporary) must not.

`lib/email/send.ts` already suppresses all future sends to a bounced address via the
`SUPPRESSED_BOUNCE` gate, so nothing more is needed to protect the domain. The user flag
exists so the UI can say something true — "we couldn't deliver to that address" — instead of
looping the user through a resend button that silently no-ops.

### 4.10 Reaper

New cron, authenticated with the existing `CRON_SECRET`, daily:

```
users where emailVerifiedAt == null and createdAt < now - 7d
  → delete user + their verificationTokens + their (empty) business
```

Seven days is comfortably past the 24h link and any resend. The gates prevent the sends; the
reaper prevents the accumulation.

### 4.11 Migration for existing beta users

**Non-negotiable, and it ships before the gate.** `scripts/backfill-email-verified.ts`:

```ts
User.updateMany(
  { emailVerifiedAt: null },
  [{ $set: { emailVerifiedAt: '$createdAt' } }]
)
```

Without this, every current beta user is locked out the moment the gate goes live.

If some of those accounts are themselves the fake ones, handle them via the admin console.
Do not use the migration as a cleanup tool — a partial backfill locks out real users you
cannot distinguish from junk.

---

## 5. Trade-offs made explicit

| Decision | Chosen | Alternative | Why |
|---|---|---|---|
| Control type | Email verification | TOTP 2FA at signup | 2FA does not test address existence. Wrong tool. |
| Credential | Code **and** link, one email | Either alone | Marginal cost is code, not sends; sends are the scarce resource. |
| Gate location | Session refused (`authorize`) | Feature-gated post-login | One inherited check vs. N checks that can be forgotten. |
| Code expiry | 15 min | Match the link's 24h | A static code sitting in an inbox all day is a standing target. |
| Link expiry | 24 h | 1 h, matching password reset | A 1h signup link mostly generates resends, and resends are sends. |
| Code hashing | bcrypt | sha256, matching the link | Lookup is by `userId`, so bcrypt is affordable — and 6 digits under sha256 is a 1M-row rainbow table. |
| Attempt counter | Server-side on the token doc | In the signed cookie, as `mfa-challenge.ts` does | A static code makes the cookie counter resettable. See §4.6. |
| Session on code | Minted via new Path C | Redirect to `/login` | Recovers the activation loss; explicitly the first thing to cut. |
| Resend semantics | Burn old codes, keep old links | Burn everything | Preserves the attempt budget without handing users dead links. |
| Pre-send validation | Blocklist + MX | Paid verification API | Free, no dependency, catches the common cases. Escalate on evidence. |
| SMTP probing | No | `RCPT TO` check | Unreliable against catch-alls; risks blocklisting the sending IP. |
| Rate limiting | Mongo counters | Redis / Upstash | No new infrastructure at this volume. Upgrade path documented. |
| Pending state | Real `User` row, `emailVerifiedAt: null` | Separate `pendingSignups` | Keeps the unique email index as the single source of truth. |
| DNS failure | Fail open | Fail closed | A resolver blip must never block real revenue. |

### Costs being accepted

1. **Activation drops.** Every verification step loses users — typically 10–25% never
   complete. Some of that loss is exactly the junk you want gone; some is real. §7 measures
   which. The code path plus Path C is the main mitigation.
2. **A new support surface**, now in two flavours: "I didn't get the email" (mostly spam
   folder) and "I typed the code and it says wrong" (mostly an expired 15-minute code). The
   error copy in §4.4 should distinguish expired from incorrect, precisely so this is
   self-service.
3. **A third session-minting path** in `lib/auth.ts`. Contained by the single-use
   `grantedAt` check, and optional (§4.5).
4. **~50ms added to signup** from the MX lookup. Irrelevant next to a bcrypt cost-10 hash.
5. **Registration still leaks account existence** — `registerUser` returns "An account with
   this email already exists" while `requestPasswordReset` deliberately does not. That
   predates this change and is out of scope, but worth naming: the standard fix (always
   return "check your inbox", and mail the *existing* owner a "someone tried to sign up"
   notice) trades noticeably worse UX for typo'd emails. Not recommended during beta, when
   every signup matters and you can read the logs yourself.

---

## 6. Reliability

- **Send fails at registration.** The user row exists and the outbox records `FAILED`.
  Registration still returns success and routes to `/verify-email`, whose resend button is
  the recovery path. Never fail a registration because an email failed.
- **`MAIL_DRY_RUN=true` (local dev).** `sendEmail` returns `skipped: true, reason: DRY_RUN`
  and no mail leaves. Log the code and the verify URL to the server console in that mode
  only, guarded by `NODE_ENV !== 'production'` — same as the pre-M9 password-reset behaviour.
- **Double-click on the link.** Second visit finds `usedAt` set and renders "already
  verified". Idempotent by construction.
- **Code typed after the link was clicked.** Same document, `usedAt` already set, so the
  lookup in §4.4 skips it and reports "request a new code" — slightly confusing. Special-case
  it: if the newest token for this user has `usedAt` set and the user is verified, redirect
  to `/login?verified=1` instead.
- **Token collision.** 32 random bytes for the link; the unique index on `tokenHash` catches
  the impossible case. Code collisions across users are irrelevant — codes are scoped by
  `userId`, never looked up globally.
- **Session token replayed.** `grantedAt` makes Path C single-use (§4.5).

---

## 7. What to measure

Add to `lib/metrics.ts` / the admin dashboard:

| Metric | Why | Action threshold |
|---|---|---|
| Verification completion rate | The activation cost of this change | < 70% → reconsider option C (§2) |
| **Code path vs. link path share** | Whether the dual email earns its complexity | Link < 10% → drop the link, simplify |
| Median time-to-verify | Are 15 min / 24 h right? | code p90 > 10 min → extend the code window |
| Wrong-code attempts per account | Typo friction vs. attack | > 2 avg → the code is too long or the email too cluttered |
| Hard-bounce rate on `EMAIL_VERIFICATION` | Whether gates 1–3 work | > 2% → tighten gates / consider paid API |
| Signups blocked at gate 2 vs. gate 3 | Which gate earns its keep | Gate 2 ≈ 0 → the blocklist is dead weight |
| Unverified accounts reaped per week | The size of the original problem | Trending up → add per-IP throttling |

Instrument the *blocked* and *failed* counts, not only the successes. Without them there is
no way to tell whether the gates are doing anything or just adding latency.

---

## 8. Build order

Independently deployable steps. The gate goes live last, after the backfill.

1. `lib/signed-token.ts` — extract from `mfa-challenge.ts`, no behaviour change. **Ship.**
2. `models/verification-token.ts` + `models/user.ts` fields + `EMAIL_VERIFICATION` enum
   value + index. **Ship.**
3. `lib/email/dns-check.ts`, `lib/email/disposable-domains.ts` — pure functions, unit tested
   against `gmial.com`, `mailinator.com`, `gmail.com`, and a timeout stub.
4. `lib/email/templates/email-verification.ts` — code first, link second, code in the
   subject. Follow `password-reset.ts`.
5. `actions/auth.ts`: `issueVerificationCredential`, `resendVerification`, gates 2–3 wired
   into `registerUser`, signup challenge cookie.
6. `actions/auth.ts::verifySignupCode` + **server-side attempt budget (§4.6)**. Unit test
   the budget explicitly: 5 wrong codes burns the code, and clearing the cookie does not
   reset it.
7. `app/(auth)/verify-email/page.tsx` (code entry, modelled on `login/mfa`) and
   `app/(auth)/verify-email/[token]/page.tsx` (link).
8. `register/page.tsx` — drop the `signIn()` call, route to `/verify-email`.
9. Resend webhook → `emailBouncedAt`.
10. **`scripts/backfill-email-verified.ts` — run against production.**
11. `lib/auth.ts` — `EmailNotVerifiedError` + the gate. Login page copy. **This is the
    switch.**
12. `lib/auth.ts` Path C + `grantedAt` — auto-session on code. *Optional; ship after 11 is
    stable.*
13. Reaper cron.

Steps 10 and 11 must not be reordered. Step 12 is deliberately last so the system is
correct before it is convenient.

---

## 9. Revisit when

- **Completion rate < 70%** → move the gate from login to send-quotation (option C, §2), so
  users can explore first and verify when it actually matters.
- **Link path share < 10%** → drop the link, keep the code, delete `tokenHash` /
  `expiresAt` and half of §4.5.
- **Bounce rate stays > 2% after gates 1–3** → the fakes are using real-looking domains.
  That is when a paid verification API (Kickbox, ZeroBounce) starts to pay for itself.
- **Automated signup floods** → per-IP throttling in a TTL collection, then Upstash Redis,
  then a CAPTCHA on the register form. In that order — do not start with the CAPTCHA.
- **Paid access opens** → payment is a far stronger identity signal than email. The gate
  stays, but re-tune the reaper window and rate limits for a population with money on the
  line.
- **Google/Microsoft OAuth is added** → those providers verify the address themselves. Set
  `emailVerifiedAt` on first OAuth login and skip this flow entirely for those users.

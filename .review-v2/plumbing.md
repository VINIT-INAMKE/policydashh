# Plumbing / Infra Review

_Second-pass review of infrastructure and cross-cutting concerns. All items
previously marked `[x]` or `[-]` in FIXES.md are excluded._

---

## P1: audit_events partition coverage expires June 2026
**File:** `src/db/migrations/0000_initial.sql:34-39`
**Severity:** HIGH
**Impact:** The partitioned `audit_events` table only has partitions through
2026-05-31. From 2026-06-01 onward every `writeAuditLog` call throws
`ERROR: no partition of relation "audit_events" found for row`, silently
swallowing audit writes or cascading as a 500 depending on whether
`writeAuditLog` is awaited. Current date is 2026-04-19; the system is 6 weeks
from unlogged audits.
**Suggested fix:** Add a monthly partition-creation script (cron or migration)
and run it now to create `2026_06` through at least `2026_12`; also add an
automated monthly `CREATE TABLE ... PARTITION OF` via a pg_cron job.

---

## P2: Clerk webhook synchronous long work — no Inngest fan-out
**File:** `app/api/webhooks/clerk/route.ts:71-135`
**Severity:** HIGH
**Impact:** The `user.created` / `user.updated` handler does a DB SELECT,
an upsert, a role-delta audit write, AND a bulk `workshopRegistrations` UPDATE
all in-process before returning 200 to Clerk. Svix retries if no 200 arrives
within its window; under DB load the handler can time out, causing Clerk to
re-deliver, double-firing all side-effects (the audit write has no idempotency
guard). Heavy backfill scenarios (many registrations matching the email) block
the response further.
**Suggested fix:** After the users upsert, dispatch an Inngest event (e.g.
`user.upserted`) carrying `{ userId, email }` and do the registration backfill
and audit write inside that function. Return 200 immediately after the upsert.

---

## P3: Cal.com webhook MEETING_ENDED sends one Inngest event per attendee inline
**File:** `app/api/webhooks/cal/route.ts:343-350`
**Severity:** HIGH
**Impact:** For each attendee in the loop the handler calls
`sendWorkshopFeedbackInvite(...)` — which calls `inngest.send()` — plus a DB
query and potentially a DB insert, all before returning to cal.com. A 50-person
workshop saturates the response window. Cal.com will retry the whole webhook on
any timeout, causing duplicate feedback-invite emails and duplicate `walkin`
rows (the `onConflictDoNothing` guards the walk-in insert but not the
`sendWorkshopRegistrationReceived` re-fire).
**Suggested fix:** Collect `attendees` into a single batch `inngest.send([...])`
call at the end of the MEETING_ENDED case rather than looping with individual
sends inside the handler body.

---

## P4: No Retry-After header on any 429 response from intake / upload routes
**File:** `app/api/intake/workshop-register/route.ts`, `app/api/intake/workshop-feedback/route.ts`, `app/api/upload/route.ts`
**Severity:** MEDIUM
**Impact:** All rate-limited 429 responses lack `Retry-After`. The
`RateLimitResult.resetAt` (epoch ms) is available from `consume()` but is
never surfaced to the client. Well-behaved API clients and Inngest retry
logic will backoff blindly, often retrying immediately and wasting the budget.
Only `app/api/export/policy-pdf` was fixed to include `Retry-After`; the
remaining routes were missed.
**Suggested fix:** In every `consume(...)` 429 branch, add
`headers: { 'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)) }`.

---

## P5: Cardano wallet singleton is not concurrency-safe within a hot worker
**File:** `src/lib/cardano.ts:56-88`
**Severity:** MEDIUM
**Impact:** `_wallet` is a module-level singleton. The concurrency guard
`{ key: 'cardano-wallet', limit: 1 }` on both Inngest functions prevents
two Inngest runs from racing, but the guard only applies across Inngest
invocations. In a single Inngest run, multiple `step.run()` callbacks that
call `getWallet()` (e.g. `submit-tx` retrying after a partial failure where
the memoized `anchor` step calls `buildAndSubmitAnchorTx`) could race
against a fresh wallet init on the same Node.js module instance. Additionally,
the module-level singleton is never reset between tests, so test leakage is
possible if `CARDANO_WALLET_MNEMONIC` changes mid-suite.
**Suggested fix:** Guard `getWallet()` with a promise-level lock (or a single
init promise stored in module scope) so concurrent awaits resolve on the same
in-flight init.

---

## P6: Cardano `checkExistingAnchorTx` is an unbounded paginating loop with no page cap
**File:** `src/lib/cardano.ts:145-167`
**Severity:** MEDIUM
**Impact:** The `while (true)` loop pages through all Blockfrost label-674
metadata at 100 per page with no maximum-page guard. If the label accumulates
thousands of entries over time (common for high-throughput public blockchains),
the function walks every page at 100 req/page before returning null, burning
Blockfrost API quota and adding latency to every anchor step. There is also no
timeout on individual `api.metadataTxsLabel` calls.
**Suggested fix:** Add a `MAX_PAGES` constant (e.g. 50) and break out of the
loop when `page > MAX_PAGES`, returning null; log a warning when the cap is
hit so it can be raised deliberately.

---

## P7: Cardano `buildAndSubmitAnchorTx` has no wallet balance pre-check
**File:** `src/lib/cardano.ts:104-127`
**Severity:** MEDIUM
**Impact:** The function calls `wallet.getUtxos()` and immediately proceeds
to build the tx. If the wallet has no UTxOs (zero ADA balance), the Mesh SDK
will throw an opaque `No UTxOs found` or coin-selection error deep inside
`txBuilder.complete()`, which surfaces to Inngest as a plain Error and
triggers all 4 retries before giving up — spending 10+ minutes on a failure
that is immediately diagnosable. No admin notification is sent until the
confirm-loop timeout.
**Suggested fix:** Check `utxos.length === 0` after `getUtxos()` and throw
`NonRetriableError('Cardano wallet has no UTxOs — fund the wallet at <address>')`.

---

## P8: `generateStorageKey` uses `Math.random()` — weak entropy for storage keys
**File:** `src/lib/r2.ts:98-103`
**Severity:** MEDIUM
**Impact:** `Math.random().toString(36).slice(2, 8)` produces only ~31 bits of
randomness (6 base-36 chars). Combined with the millisecond timestamp prefix,
two concurrent uploads in the same millisecond with the same filename produce
the same key, silently overwriting the earlier file. Worse, the key is
derivable from the timestamp, making R2 keys semi-guessable even with
`ContentDisposition: attachment`.
**Suggested fix:** Replace `Math.random().toString(36).slice(2, 8)` with
`crypto.randomBytes(8).toString('hex')` (64 bits of entropy, Node built-in).

---

## P9: Upload route trusts client-supplied `contentType` without extension cross-check
**File:** `app/api/upload/route.ts:119-148`
**Severity:** MEDIUM
**Impact:** The MIME-type allowlist check in the upload route validates the
`contentType` field from the JSON body — which the client fully controls.
A malicious client can upload a JavaScript or HTML file by setting
`contentType: 'image/png'` while the file's actual bytes are a script. The
presigned PUT passes `ContentType` to R2 as a metadata hint only; R2 does not
re-validate the actual upload bytes against it. `ContentDisposition: attachment`
prevents inline rendering for direct R2 URLs but does not prevent the file from
being served via a proxy that strips that header.
**Suggested fix:** Cross-check the `fileName` extension against the declared
`contentType` (e.g. `.js`, `.html`, `.svg`, `.php` extensions should be
rejected regardless of the stated MIME type).

---

## P10: `notificationDispatchFn` maps `version_published` email data incorrectly
**File:** `src/inngest/functions/notification-dispatch.ts:122-126`
**Severity:** MEDIUM
**Impact:** When `type === 'version_published'`, the dispatch function calls
`sendVersionPublishedEmail` with `{ policyName: data.title, versionLabel: data.body ?? '' }`.
But at the callsite in the version router, `data.title` is set to the
notification title (e.g. `"New version published: Policy X v1.0"`) not the
bare policy name, and `data.body` carries a human-readable description string,
not the version label. The resulting email subject reads
`"New version published: New version published: Policy X v1.0 "` — double prefix.
**Suggested fix:** Either pass `policyName` and `versionLabel` as separate
fields in the notification event payload, or extract them by parsing the title
string with a documented convention.

---

## P11: Email functions have no `Reply-To` header — replies go to `noreply@`
**File:** `src/lib/email.ts` (all `resend.emails.send` calls)
**Severity:** MEDIUM
**Impact:** Every system email (feedback reviewed, version published, evidence
pack ready, feedback invite, nudge) uses `from: getFromAddress()` which is
`noreply@civilization-lab.com`. Recipients who hit "Reply" will write to a
dead-letter address. For the feedback-invite and section-assigned emails this
is particularly bad: a stakeholder replying with a question about a feedback
decision gets silently dropped.
**Suggested fix:** Add `replyTo: process.env.SUPPORT_EMAIL ?? getFromAddress()`
to all `resend.emails.send` calls; add `SUPPORT_EMAIL` to `.env.example`.

---

## P12: Groq `chatComplete` and `transcribeAudio` have no call-level timeout
**File:** `src/lib/llm.ts:93-99` and `src/lib/llm.ts:114-126`
**Severity:** MEDIUM
**Impact:** Neither the chat completion nor the transcription call passes an
`AbortSignal` or timeout to the Groq SDK. A hung Groq connection will stall
the Inngest step indefinitely until Inngest's own function-level timeout fires
(default 2h for paid plans). Because `workshopRecordingProcessedFn` has
`retries: 2` and `consultationSummaryGenerateFn` has `retries: 2`, a 2-hour
stall per retry adds up to 6+ hours of blocked Inngest capacity per event.
**Suggested fix:** Pass `signal: AbortSignal.timeout(120_000)` (2 minutes) to
each Groq SDK call, or wrap each in a `Promise.race` with a timeout.

---

## P13: `evidencePackExportFn` has no concurrency limit
**File:** `src/inngest/functions/evidence-pack-export.ts:133-140`
**Severity:** MEDIUM
**Impact:** The function has `retries: 2` but no `concurrency` option. A burst
of evidence export requests (e.g. all auditors requesting at once before a
board meeting) will fan out unbounded parallel Inngest runs, each of which
assembles a full in-memory ZIP (`zipSync` — single-threaded, blocks event loop)
and sends multiple Groq / Blockfrost requests. There is also no idempotency key
at the function level, so Inngest retry after a partial step failure (e.g.
`send-email` step fails) will re-run `assemble-and-upload`, creating a second
ZIP with a fresh `Date.now()` key.
**Suggested fix:** Add `concurrency: { key: 'evidence-pack-export', limit: 3 }`
and store the generated `r2Key` in the DB (or return it from `assemble-and-upload`
and check for it in a guard step) to prevent double-upload on retry.

---

## P14: tRPC context leaks full `headers` object to every procedure
**File:** `src/trpc/init.ts:11-23`
**Severity:** MEDIUM
**Impact:** `createTRPCContext` returns `{ headers: opts.headers, userId, user }`.
The raw `Headers` object — which contains `Cookie`, `Authorization`, and any
other request headers — is carried into every tRPC procedure's `ctx`. Any
procedure logging `ctx` for debugging (common during development) will log
session cookies. It also makes accidental header forwarding trivially easy for
a developer copy-pasting a context field.
**Suggested fix:** Strip `headers` from the returned context object, or
expose only the specific headers that procedures actually need (e.g.
`ipAddress` extracted once at context creation time). IP extraction is already
done for `writeAuditLog` callsites separately; centralising it here and
dropping the raw headers would both fix the leak and reduce boilerplate.

---

## P15: `crFeedbackLinks.feedbackId` FK has no `onDelete` — orphan rows when feedback deleted
**File:** `src/db/schema/changeRequests.ts:68`
**Severity:** MEDIUM
**Impact:** `crFeedbackLinks.feedbackId` references `feedbackItems.id` with no
`onDelete` clause (defaults to `NO ACTION`). If a feedback item is ever deleted
(e.g. spam cleanup, GDPR erasure), the `cr_feedback_links` row blocks the delete
or is silently left orphaned depending on the DB constraint mode. Same issue
applies to `crSectionLinks.sectionId` (line 76) referencing `policySections.id`.
**Suggested fix:** Add `{ onDelete: 'cascade' }` to both FK references so link
rows are cleaned up automatically when the parent entity is removed.

---

## P16: `workshopFeedbackTokenNonces` table has no FK on `workshopId` and no expiry pruning
**File:** `src/db/schema/feedback.ts:64-74` and `src/db/migrations/0021_workshop_feedback_token_nonces.sql`
**Severity:** MEDIUM
**Impact:** The `workshop_id` column in `workshop_feedback_token_nonces` is
`uuid NOT NULL` but has no `REFERENCES workshops(id)` FK constraint in either
the Drizzle schema or the migration SQL. Workshop deletion leaves orphan nonce
rows. Additionally, there is no pruning mechanism for rows older than the 14-day
JWT lifetime (mentioned in the schema comment but not implemented), meaning the
table grows unboundedly.
**Suggested fix:** Add `REFERENCES workshops(id) ON DELETE CASCADE` to the
migration and schema; add a scheduled `DELETE FROM workshop_feedback_token_nonces WHERE used_at < now() - interval '15 days'` (cron or pg_cron job).

---

## P17: Missing `apply-migration` scripts for migrations 0017–0020
**File:** `scripts/` directory
**Severity:** MEDIUM
**Impact:** `scripts/` contains apply scripts for migrations 0011–0016 and
0021 but is missing scripts for `0017_workshop_timezone.sql`,
`0018_workshop_artifact_transcript.sql`, `0019_user_soft_delete.sql`, and
`0020_documentVersions_cr_fk_on_delete_set_null.sql`. The project convention
(FIXES.md I1) requires a matching apply script for every migration. Without
them, operators must apply these migrations manually with no documented
procedure, increasing the risk of being skipped in a staged deployment.
**Suggested fix:** Add `scripts/apply-migration-0017.mjs` through
`apply-migration-0020.mjs` following the existing pattern.

---

## P18: No centralised env validation — app starts with missing secrets and crashes later
**File:** No `src/lib/env.ts` exists; scattered `process.env` reads across modules
**Severity:** MEDIUM
**Impact:** There is no `src/lib/env.ts` (or equivalent `@t3-oss/env-nextjs`
validation) that asserts all required environment variables at startup. The
`requireEnv()` helpers in `r2.ts`, `cardano.ts`, and `llm.ts` all throw at
first-call time (lazy), not at boot. A misconfigured deployment will start
serving requests, pass health checks, and then crash the first time a user
uploads a file (`R2_ENDPOINT` missing), submits feedback (`GROQ_API_KEY`
missing), or triggers anchoring (`BLOCKFROST_PROJECT_ID` missing) — producing
confusing 500s rather than a clear startup failure.
**Suggested fix:** Create `src/lib/env.ts` using `@t3-oss/env-nextjs` (already
compatible with Next.js 16) that validates all required server-side env vars
at module load time; import it from `next.config.ts`.

---

## P19: proxy.ts does not protect `/api/inngest` — Inngest endpoint is publicly callable
**File:** `proxy.ts:8`
**Severity:** MEDIUM
**Impact:** `/api/inngest(.*)` is listed in `isPublicRoute`. The Inngest serve
handler at that route validates inbound requests via `INNGEST_SIGNING_KEY`, but
a missing or empty signing key (which is the case in local dev and any
deployment where the key was not set) means any caller can POST arbitrary events
to `/api/inngest/fn` or trigger function invocations directly. The public route
listing also bypasses Clerk auth entirely, so even a correctly-signed request
from a malicious relay would not be flagged.
**Suggested fix:** The Inngest SDK's own signing-key verification is the correct
guard here — but add a runtime assertion that `INNGEST_SIGNING_KEY` is present
and non-empty at server startup (in `src/lib/env.ts` or `instrumentation.ts`).
Consider removing `/api/inngest(.*)` from `isPublicRoute` and relying solely
on Inngest's own signature check, which does not require Clerk.

---

## P20: `error.tsx`, `global-error.tsx`, and `not-found.tsx` are absent
**File:** `app/` directory root
**Severity:** MEDIUM
**Impact:** Next.js 16 requires `app/error.tsx` (for route-level errors) and
`app/global-error.tsx` (for layout-level errors including crashes in the root
layout, e.g. a failed Clerk initialization) to display a user-friendly error
page instead of an unhandled rejection. `app/not-found.tsx` is needed to
return a proper 404 page for unknown routes. Without these files, React's
default error boundary shows a blank page in production, and 404s return
raw Next.js framework HTML with no navigation or branding.
**Suggested fix:** Create `app/error.tsx` with `"use client"` + `reset` prop
button, `app/global-error.tsx` wrapping `<html><body>`, and `app/not-found.tsx`
with a styled 404.

---

## P21: `instrumentation.ts` is absent — no OpenTelemetry / Sentry bootstrap
**File:** No `instrumentation.ts` in project root
**Severity:** LOW
**Impact:** Next.js 16 supports `instrumentation.ts` (stable in this version)
as the canonical hook for registering OpenTelemetry, Sentry, or other APM
tooling at server startup. Without it there is no structured error tracking
beyond `console.error`, no trace context for Cardano/Groq failures, and no
startup hook to assert required env vars eagerly (see P18).
**Suggested fix:** Create a minimal `instrumentation.ts` that (1) calls
`validateEnv()` from the env module proposed in P18 and (2) optionally
registers Sentry `captureException` if `SENTRY_DSN` is set.

---

## P22: Rate-limit `consume()` is NOT applied to the Turnstile-protected `/api/intake/participate` route
**File:** `app/api/intake/participate/route.ts`
**Severity:** LOW
**Impact:** The Turnstile challenge is the only bot gate on the participate
intake route. A legitimate user (or a Turnstile-solving bot) who hits the
endpoint repeatedly will not be rate-limited at the HTTP layer; only the
Inngest `rateLimit` at the Inngest function level limits them (1 per
emailHash per 15m). An attacker rotating email addresses can still hammer
the Route Handler at full speed, burning Turnstile quota and creating Inngest
events that are immediately dropped — but at cost to the server.
**Suggested fix:** Add `consume(`participate:ip:${getClientIp(request)}`, { max: 5, windowMs: 60_000 })` at the top of the POST handler, before Zod parsing.

---

## P23: `notification.create` event `linkHref` field is not validated as a URL
**File:** `src/inngest/events.ts:119`
**Severity:** LOW
**Impact:** `linkHref: z.string().optional()` accepts any string, including
`javascript:` URIs or relative paths that break the notification deep-link
feature (A1). An event emitted with a bare path (no leading `/`) or with a
`javascript:` href would silently produce a broken or dangerous link in the
notifications panel.
**Suggested fix:** Change the schema to `linkHref: z.string().url().optional()`
or `z.string().startsWith('/').optional()` (for internal links), matching the
deep-link pattern enforced in the notification UI.

---

## P24: `milestoneReadyFn` uses `cr_status_changed` notification type for anchor failures
**File:** `src/inngest/functions/milestone-ready.ts:296` and `src/inngest/functions/version-anchor.ts:162`
**Severity:** LOW
**Impact:** Both anchor failure notifications use `type: 'cr_status_changed'`
(the only notification type that maps to a plausible "status changed" intent).
This means the in-app notification icon/category for a Cardano anchor failure
displays as a change-request status update, which confuses the admin. The
notification type enum in both the schema and events registry has no
`anchoring_failed` value.
**Suggested fix:** Add `'anchoring_failed'` to `notifTypeEnum` in
`src/db/schema/notifications.ts`, the events schema, and use it in both
anchor-failure notification dispatches. Requires a migration to extend the
Postgres enum.

---

## P25: `checkExistingAnchorTx` creates a new `BlockFrostAPI` instance on every call
**File:** `src/lib/cardano.ts:142`
**Severity:** LOW
**Impact:** `checkExistingAnchorTx` instantiates `new BlockFrostAPI({ projectId })`
on every call, bypassing the lazy-singleton pattern used by `getProvider()`.
This creates a new HTTP connection pool per call, and also calls `requireEnv`
(which validates format) redundantly alongside `getProvider()`'s own
`requireEnv` call. On a busy anchor pipeline the duplicate instances accumulate
until GC runs.
**Suggested fix:** Replace the inline `new BlockFrostAPI(...)` with a module-level
singleton (or reuse the `_provider` instance if `BlockfrostProvider` exposes
the same `metadataTxsLabel` method).

---

## P26: `feedbackItems.documentId` FK has no `onDelete` — blocks policy document deletion
**File:** `src/db/schema/feedback.ts:31`
**Severity:** LOW
**Impact:** `feedbackItems.documentId` references `policyDocuments.id` with no
`onDelete` clause (defaults to NO ACTION / RESTRICT). Since B5 guards document
deletion with a pre-count check that includes feedback, this will throw a
PRECONDITION_FAILED before the FK fires — but only if the router check runs.
Direct SQL deletion (admin scripts, seed resets) still triggers the FK
constraint error from Postgres rather than a clean application error.
Same applies to `changeRequests.documentId` (line 49 of changeRequests.ts)
and `documentVersions.documentId`.
**Suggested fix:** Document intentionally as RESTRICT (policy documents should
never be force-deleted) or add `{ onDelete: 'restrict' }` explicitly to make
the intention clear in the schema.

---

## P27: Workshop `email_hash` column has no index
**File:** `src/db/migrations/0011_cal_com_workshop_register.sql` / `src/db/schema/workshops.ts:99`
**Severity:** LOW
**Impact:** `workshop_registrations.email_hash` is used by rate-limit lookups
in `workshop-register/route.ts` (`consume('workshop-register:email:${emailHash}', ...)`)
but the lookup is in-memory; however, the cal.com webhook's
`findWorkshopByCalEventTypeId` and MEETING_ENDED attendee loop do a
`.where(eq(workshopRegistrations.email, a.email), ...)` query, which scans
the full table without an index. As registrations grow this query degrades
linearly.
**Suggested fix:** Add `CREATE INDEX IF NOT EXISTS idx_workshop_registrations_email ON workshop_registrations (email)` in a new migration (the `email_hash` column for HMAC-keyed lookups would also benefit from an index).

---

## P28: `inngest` client has no `signingKey` or `eventKey` wired at construction
**File:** `src/inngest/client.ts:11-13`
**Severity:** LOW
**Impact:** `new Inngest({ id: 'civilization-lab' })` does not explicitly
pass `signingKey` or `eventKey`. The Inngest SDK reads these from
`INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` environment variables at runtime
— which is the documented approach — but means there is no fail-fast
validation at module load. A deployment with a missing `INNGEST_SIGNING_KEY`
will accept requests silently (the SDK will skip signature verification rather
than throwing), and emitted events will fail at the first `inngest.send()` call
rather than at startup.
**Suggested fix:** Add assertion of `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY`
in the `env.ts` centralised validator (P18), not in the client constructor
(which the SDK does not support).

---

## P29: `summarizeTranscript` sends the full raw transcript to the LLM without length guard
**File:** `src/lib/llm.ts:140-165`
**Severity:** LOW
**Impact:** A 2-hour workshop recording transcribed by Whisper could produce a
20,000-30,000 token transcript. `chatComplete` is called with `maxTokens: 1024`
for the response but there is no limit on the `transcript` string interpolated
into the user message. Groq's context window for `llama-3.1-8b-instant` is
128K tokens, so the call will not hard-error, but an unexpectedly long
transcript inflates per-call cost significantly and risks hitting the context
window on larger recordings.
**Suggested fix:** Truncate `transcript` to a configurable max (e.g. 12,000
characters, ~3,000 tokens) before interpolation, with a comment explaining the
tradeoff; log a warning when truncation occurs.

---

## P30: `notificationDispatchFn` has no concurrency limit — notification storms possible
**File:** `src/inngest/functions/notification-dispatch.ts:49-58`
**Severity:** LOW
**Impact:** `notification-dispatch` has `retries: 3` but no `concurrency`
constraint. A `version.published` event fans out one `notification.create`
event per subscriber (potentially dozens of users). Each enqueues a separate
`notificationDispatchFn` run. If the Resend API is slow or throttled, all
runs back up, and Inngest retries each independently, potentially sending
duplicate emails if the `send-email` step fails after the `insert-notification`
step succeeds (the notification row is idempotency-protected but the email send
step is not).
**Suggested fix:** Add `concurrency: { key: 'notification-dispatch:email', limit: 10 }`
and wrap the `send-email` step in an idempotency check (store a `emailSentAt`
on the notification row and skip the email step if it is already set).

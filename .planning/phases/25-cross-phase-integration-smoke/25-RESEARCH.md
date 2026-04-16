# Phase 25: Cross-Phase Integration Smoke - Research

**Researched:** 2026-04-16
**Domain:** End-to-end manual integration testing across all v0.2 phases (14-24)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** All external services must be live with real API keys — no mocks, no degraded mode. Required keys: `RESEND_API_KEY`, `GROQ_API_KEY`, `BLOCKFROST_PROJECT_ID`, `CARDANO_WALLET_MNEMONIC`, `CALCOM_API_KEY`, `CAL_WEBHOOK_SECRET`, `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY`, `CLOUDFLARE_TURNSTILE_SECRET_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`.
- **D-02:** Use Clerk Development instance (existing config in `.env.local`). Invitation emails go to real inbox in test mode.
- **D-03:** Cardano anchoring uses real preview-net transactions via Blockfrost. Wallet must be funded with tADA from the Cardano preview-net faucet.
- **D-04:** Inngest runs via dev server (`npx inngest-cli@latest dev -u http://localhost:3000/api/inngest`), not cloud — local observability for step-by-step verification.
- **D-05:** Phase 25 subsumes all deferred smoke walks from phases 16, 17, 19, and 20. One unified E2E walk covers the full chain. No separate per-phase re-walks.
- **D-06:** After Phase 25 completes, go back and mark `16-HUMAN-UAT.md`, `17-VERIFICATION.md`, `19-HUMAN-UAT.md`, and `20-HUMAN-UAT.md` as resolved-by-phase-25 with a link to the smoke report.
- **D-07:** Fix everything before closing. No known gaps allowed — every broken step discovered during the walk must be fixed before milestone can close.
- **D-08:** All 9 success criteria from ROADMAP.md must pass fully. No exceptions, no degraded-mode acceptance.
- **D-09:** Output is `.planning/v0.2-INTEGRATION-SMOKE.md`. Each of the 9 success criteria gets: pass/fail status, what was observed, DB query or Inngest run ID proving the step, and any notes.
- **D-10:** Structured checklist with evidence — auditable but not exhaustive (no screenshots or full terminal dumps).

### Claude's Discretion

- Exact ordering of env setup steps in the plan
- How to structure fix iterations if gaps are found (inline fix vs separate plan)
- Whether to bundle pre-condition checks into a separate plan or inline with the walk

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INTEGRATION-01 | End-to-end smoke test walks the full chain: `/participate` submit → Clerk invite → workshop register → 48h + 2h reminders fire → `MEETING_ENDED` webhook → workshop completed + attendance populated → moderator nudge → feedback submit → feedback.decide → notification Inngest → CR → merge → version published → per-version Cardano anchor → milestone ready → milestone hash → milestone Cardano anchor → Verified State badge visible on public portal | All 9 success criteria map directly to implemented code paths verified in this research; 10 env keys need provisioning before the walk executes |
</phase_requirements>

---

## Summary

Phase 25 is a manual integration test phase — there is no new feature code to write. The entire phase is: provision missing env keys, stand up services, walk the 9-criterion chain, fix any breakages found along the way, and produce `.planning/v0.2-INTEGRATION-SMOKE.md` as evidence. Every Inngest function, API route, and UI surface exists and is wired; the work is operating these moving parts end-to-end for the first time together.

The critical pre-condition gap is the `.env.local` file: currently **10 of 13 required keys are missing** (only `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and `DATABASE_URL` are set). The plan must front-load env provisioning as its first wave. Without all keys, Criteria 1 (Turnstile, Clerk invite, Resend email), Criteria 2–4 (cal.com), Criteria 5–6 (feedback deep-link, Inngest pipeline), Criteria 7 (LLM consultation summary), and Criteria 8 (Cardano anchoring) will all fail hard.

There is also a pre-existing TypeScript compilation error in `src/server/routers/workshop.ts` and `src/trpc/init.ts` (20 TS18049 "possibly null" errors) and 6 failing unit tests (evidence-request-export router + set-public-draft mutation) that must be resolved before the walk. These are not gating bugs in the integration paths being walked but they must be clean before the phase can close per D-07 ("fix everything").

**Primary recommendation:** Structure the phase as two waves: Wave 0 = env provisioning + pre-condition fixes (TS errors, failing tests, Cardano wallet funding); Wave 1 = the 9-criterion walk with inline fixes for any gaps discovered.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Runtime | YES | (project runs) | — |
| npm | Package manager | YES | (project runs) | — |
| Neon PostgreSQL | All DB | YES | DATABASE_URL set | — |
| Clerk | AUTH / invite | YES | CLERK_SECRET_KEY set | — |
| Resend | Email dispatch | NO | RESEND_API_KEY MISSING | NONE (D-01: no degraded) |
| Groq | LLM summary / transcription | NO | GROQ_API_KEY MISSING | NONE (D-01) |
| Blockfrost | Cardano anchoring | NO | BLOCKFROST_PROJECT_ID MISSING | NONE (D-01) |
| Cardano wallet | Cardano anchoring | NO | CARDANO_WALLET_MNEMONIC MISSING | NONE (D-01) |
| Cal.com API | Workshop provisioning | NO | CALCOM_API_KEY MISSING | NONE (D-01) |
| Cal.com webhook | BOOKING_CREATED / MEETING_ENDED | NO | CAL_WEBHOOK_SECRET MISSING | NONE (D-01) |
| Cloudflare Turnstile | /participate gate | PARTIAL | Test keys in .env.example but not set in .env.local | Use Cloudflare test keys (0x00000000000000000000AA / 0x0000000000000000000000000000000AA) |
| Inngest Dev Server | All async functions | YES | INNGEST_DEV=1 set; cloud keys optional for local dev | Runs keyless locally with INNGEST_DEV=1 |
| Cloudflare R2 | Evidence uploads | YES | Full R2 config set | — |
| WORKSHOP_FEEDBACK_JWT_SECRET | Feedback deep-link JWT | UNKNOWN | Not in .env.example; needed by src/lib/feedback-token.ts | NONE — signFeedbackToken throws without it |

**Missing dependencies with no fallback (blocking):**
- `RESEND_API_KEY` — blocks Criteria 1 (welcome email), 4 (nudge emails), 6 (feedback-reviewed email)
- `GROQ_API_KEY` — blocks Criteria 7 (consultation summary generation); Groq transcription walk also blocked
- `BLOCKFROST_PROJECT_ID` — blocks Criteria 7 (per-version anchor) and 8 (milestone anchor)
- `CARDANO_WALLET_MNEMONIC` — same as above; wallet needs tADA from preview-net faucet before anchoring works
- `CALCOM_API_KEY` — blocks Criteria 2 (workshop registration via cal.com embed)
- `CAL_WEBHOOK_SECRET` — the `verifyCalSignature()` call returns 401 without this; blocks Criteria 2–4

**Missing dependencies with viable path:**
- `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY` + `CLOUDFLARE_TURNSTILE_SECRET_KEY` — Cloudflare provides dedicated test keys (already in `.env.example`): site key `0x00000000000000000000AA`, secret `0x0000000000000000000000000000000AA`. These work against the real /siteverify endpoint and will auto-pass the Turnstile widget in dev. Copy from `.env.example`.
- `WORKSHOP_FEEDBACK_JWT_SECRET` — not documented in `.env.example`; any random 32+ char secret works. Must be added to both `.env.example` and `.env.local`.
- `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` — not needed for local dev with `INNGEST_DEV=1`. Plan does not need to provision these.

---

## Pre-Existing Code Issues (Found During Research)

### TypeScript Errors (HIGH — must fix before phase close)

`npx tsc --noEmit` produces 20 errors, all in two files:

- `src/server/routers/workshop.ts` — lines 318, 319, 335, 359, 360, 429, 430, 457, 458, 481, 482, 509, 510, 559, 564, 565, 600, 601: `ctx.user` is possibly `null` or `undefined` (TS18049)
- `src/trpc/init.ts` — lines 73, 82: same error

These are compile-time errors that do not affect the smoke walk itself (the routes run correctly at runtime with authenticated users) but they must be clean before `/gsd:complete-milestone`. The fix pattern is adding nullability assertions or context narrowing at these lines. LOW complexity fix.

### Failing Unit Tests (MEDIUM — must fix before phase close)

Current test suite: 536 passing, 6 failing, 60 todo.

**Failing test files:**
1. `tests/phase-20.5/set-public-draft-mutation.test.ts` — 1 failure: "writes audit log with action document.set_public_draft on success". Test expects an audit log write that may not be happening.
2. `src/server/routers/__tests__/evidence-request-export.test.ts` — 5 failures: all 5 tests fail. Likely a router wiring or import issue rather than a logic bug.

Neither file is in the integration chain being walked, but D-07 mandates no known gaps at phase close.

---

## The 9-Criterion Chain — Code Paths Verified

### Criterion 1: /participate → welcome email → Clerk invite → stakeholder dashboard

**Code path (verified by reading source):**

1. `GET /participate` — public, no auth (proxy.ts whitelist covers `/api/intake(.*)`)
2. User fills form, Turnstile widget resolves
3. `POST /api/intake/participate/route.ts` — verifies Turnstile at `/siteverify`, computes `emailHash`, fires `sendParticipateIntake()` → Inngest event `participate.intake`
4. `participateIntakeFn` — rate-limited 1/emailHash/15m, calls `clerkClient().invitations.createInvitation({ emailAddress, ignoreExisting: true, publicMetadata: { role: 'stakeholder', orgType } })`
5. Clerk sends invitation email to the real inbox (Dev instance)
6. `step.run('send-welcome-email')` calls `sendWelcomeEmail(email, { name, orgType, email })` via Resend
7. User clicks Clerk invite link → sets password → lands on `/dashboard` (role=stakeholder dashboard)

**Verification queries:**
```sql
-- Confirm Inngest run happened
-- Check Inngest Dev UI at http://localhost:8288 → participate-intake run

-- Confirm Clerk invitation exists (Clerk dashboard or API)
-- Verify welcome email in Resend dashboard

-- If user accepted invite, confirm users row
SELECT id, email, role FROM users WHERE email = '<test-email>';
```

**Potential failure points:**
- `RESEND_API_KEY` missing → `sendWelcomeEmail` will silent-fail (email.ts pattern) — must be set per D-01
- Turnstile widget: test keys `0x00000000000000000000AA` auto-pass the widget; real site keys can be obtained from Cloudflare
- Rate-limit: if same email used twice within 15m, second Inngest run is silently dropped. Use a fresh email per walk.

---

### Criterion 2: /workshops → cal.com embed → booking → cal.com confirmation + ICS

**Code path (verified):**

1. `GET /workshops` — public listing page with cal.com embed via `@calcom/embed-react`
2. Workshop must have `calcomEventTypeId` set (populated by `workshopCreatedFn` on `workshop.created` event)
3. User clicks booking slot in embed → cal.com creates booking → fires `BOOKING_CREATED` webhook to `/api/webhooks/cal/route.ts`
4. Handler verifies `x-cal-signature-256` via `verifyCalSignature()`, looks up workshop by `calcomEventTypeId`, inserts `workshopRegistrations` row with `onConflictDoNothing`
5. Fires `sendWorkshopRegistrationReceived({ source: 'cal_booking', ... })`
6. `workshopRegistrationReceivedFn` → Clerk invite (if unknown email) + confirmation email via Resend

**Required pre-condition:** A workshop must already have a `calcomEventTypeId` linked. The `workshopCreatedFn` provisions this asynchronously when admin creates a workshop. Verify at least one workshop has this populated:
```sql
SELECT id, title, calcom_event_type_id FROM workshops WHERE calcom_event_type_id IS NOT NULL LIMIT 5;
```

If none exist, admin must create a workshop and wait for `workshopCreatedFn` to run (provisions cal.com event type via API).

**Verification queries:**
```sql
-- Confirm booking created workshopRegistrations row
SELECT id, workshop_id, booking_uid, email, name, status
FROM workshop_registrations WHERE email = '<test-email>'
ORDER BY created_at DESC LIMIT 3;
```

---

### Criterion 3: Cal.com reminder emails fire (spot-check via time acceleration)

**Code path (verified):**

The `workshopCompletedFn` handles evidence nudge emails (72h + 7d) but there are NO pre-meeting reminder emails in this codebase — that is a cal.com-native feature. Cal.com sends reminder emails from its own servers based on booking configuration. The Inngest `workshopRegistrationReceivedFn` sends a confirmation email, not timed reminders.

**Clarification needed:** Criterion 3 says "Cal.com reminder emails fire on schedule (spot-check via dev-mode time acceleration)." Cal.com sends these natively from their platform; the code does not control the timing. The "spot-check via dev-mode time acceleration" may refer to:
- Inngest Dev UI fast-forward on the `workshopCompletedFn` evidence nudge sleeps (Walk 2 from 17-SMOKE.md), OR
- Verifying that cal.com itself is configured to send reminders (requires checking the cal.com booking settings for the event type)

The planner should include both: (a) verify cal.com event type has reminders enabled in cal.com dashboard, and (b) fast-forward the `workshop-completed` Inngest run sleeps to test the evidence nudge emails.

---

### Criterion 4: MEETING_ENDED webhook → workshop completed → attendance → feedback email

**Code path (verified):**

1. Cal.com fires `MEETING_ENDED` webhook to `/api/webhooks/cal/route.ts`
2. Handler verifies signature, finds workshop by `calcomEventTypeId`
3. Transitions `workshops.status = 'completed'`, inserts `workflow_transitions` audit row (`actorId: 'system:cal-webhook'`)
4. Fires `sendWorkshopCompleted()` → `workshopCompletedFn` (evidence checklist + nudges)
5. For each attendee: updates `workshopRegistrations.attendedAt`, populates `attendanceSource = 'cal_meeting_ended'`
6. Fires `sendWorkshopFeedbackInvite()` → `workshopFeedbackInviteFn` → Resend email with signed JWT deep-link

**For local testing:** MEETING_ENDED must be simulated via manual webhook delivery. Options:
- **Option A:** Use cal.com's webhook delivery test button (available in cal.com dashboard → webhooks → test)
- **Option B:** Manually curl the webhook endpoint with a synthetic payload and a valid HMAC signature

The walk will need `CAL_WEBHOOK_SECRET` to compute the HMAC. For local dev, the webhook cannot arrive from cal.com's servers unless the dev server is exposed via a tunnel (ngrok/cloudflared).

**CRITICAL finding:** For criteria 2 and 4, live cal.com webhooks require a publicly reachable URL. Options:
1. Use ngrok or `cloudflared tunnel` to expose `localhost:3000` publicly, configure as the webhook destination in cal.com dashboard
2. Simulate the BOOKING_CREATED / MEETING_ENDED payloads via direct curl with a computed HMAC

**Recommended approach for plan:** Simulate webhooks via curl with manually-computed HMAC signatures. This avoids requiring a tunnel and matches how Phase 20 tests were designed.

**Verification queries:**
```sql
-- Workshop status
SELECT id, status, updated_at FROM workshops WHERE calcom_event_type_id IS NOT NULL LIMIT 5;

-- Attendance populated
SELECT id, email, attended_at, attendance_source FROM workshop_registrations
WHERE workshop_id = '<workshop-id>' ORDER BY created_at;

-- workflow_transitions audit row
SELECT from_state, to_state, actor_id, metadata, timestamp
FROM workflow_transitions WHERE entity_id = '<workshop-id>' ORDER BY timestamp;
```

---

### Criterion 5: Stakeholder submits feedback via deep-link → workshopFeedbackLinks row → audit log

**Code path (verified):**

1. Attendee receives email with URL `/participate?workshopId=<id>&token=<jwt>`
2. Deep-link opens `/participate` in feedback mode (frontend renders feedback form, not intake form)
3. `POST /api/intake/workshop-feedback/route.ts`:
   - Parses body: `{ workshopId, token, rating, comment, sectionId? }`
   - Verifies JWT via `verifyFeedbackToken(token, workshopId)` — checks HMAC, expiry, workshopId binding
   - Looks up submitterId by JWT email → falls back to `workshop.createdBy` if user not yet in DB
   - Atomic transaction: inserts `feedbackItems` (source='workshop') + `workshopFeedbackLinks`
4. Returns `{ ok: true, feedbackId }`

**Required env:** `WORKSHOP_FEEDBACK_JWT_SECRET` must be set in `.env.local`. This key is not in `.env.example` — a Wave 0 task must add it.

**Verification queries:**
```sql
-- feedbackItems row created
SELECT id, readable_id, status, source, submitter_id, title FROM feedback_items
WHERE source = 'workshop' ORDER BY created_at DESC LIMIT 3;

-- workshopFeedbackLinks row created
SELECT * FROM workshop_feedback_links WHERE feedback_id = '<feedback-id>';
```

The criterion mentions "workflowTransition audit log shows correct actor." The `POST /api/intake/workshop-feedback` does NOT write a `workflow_transitions` row — it writes a `feedbackItems` row (source='workshop'). The audit trail is the `workshopFeedbackLinks` join table. The planner should document this discrepancy: `workflow_transitions` is only written for workshop status changes, not for feedback submissions. Criterion 5 evidence should reference the `workshopFeedbackLinks` row and the `feedbackItems` insert timestamp as the audit trail.

---

### Criterion 6: Admin reviews feedback → Inngest fires feedback.reviewed → notification + email + auto-draft CR

**Code path (verified, covered by 16-SMOKE.md verbatim):**

1. Admin signs in, opens `/feedback`, finds the workshop feedback item
2. Clicks **Start Review** (if status=submitted) → triggers `notification.create` event → `notificationDispatchFn`
3. Clicks **Decide → Accept** → enters ≥ 20-char rationale → submits
4. `feedbackReviewedFn` runs 6 steps: fetch-feedback → fetch-section-name → fetch-submitter-email → insert-notification → send-email (if email set) → auto-draft-change-request

**Inngest run IDs to capture:** Both `notification-dispatch` and `feedback-reviewed` runs at http://localhost:8288.

**Verification queries:**
```sql
-- In-app notification
SELECT id, user_id, type, title, idempotency_key, created_at
FROM notifications WHERE entity_id = '<feedback-id>'
ORDER BY created_at DESC LIMIT 5;

-- Auto-drafted CR
SELECT id, readable_id, status, owner_id, created_at
FROM change_requests ORDER BY created_at DESC LIMIT 3;

-- CR links
SELECT * FROM cr_feedback_links WHERE cr_id = '<cr-id>';
SELECT * FROM cr_section_links WHERE cr_id = '<cr-id>';

-- workflow_transitions for feedback
SELECT from_state, to_state, actor_id, timestamp
FROM workflow_transitions WHERE entity_id = '<feedback-id>'
ORDER BY timestamp ASC;
```

---

### Criterion 7: Admin merges CR → version published → per-version Cardano anchor → consultation summary → moderator approves

**Code path (verified):**

1. Admin navigates to the auto-drafted CR, reviews, approves it
2. Admin merges CR → `documentVersions` row created, CR status → 'merged'
3. Admin publishes the version → `version.published` event fired by `sendVersionPublished()`
4. Two Inngest functions fan out on `version.published`:
   - `consultationSummaryGenerateFn` — fetches anonymized feedback per section, calls Groq `llama-3.3-70b-versatile`, stores per-section summaries in `documentVersions.consultationSummary` JSONB
   - `versionAnchorFn` — computes `hashPolicyVersion()`, calls `checkExistingAnchorTx()` (Blockfrost pre-check), submits CIP-10 label 674 tx, polls confirmation (20 attempts, 30s each = up to 10 min)
5. Moderator navigates to `/portal/<policyId>/consultation-summary`, finds sections with status='pending', clicks Approve

**Timing warning:** `versionAnchorFn` confirm-loop waits up to 10 minutes (20 × 30s). On Cardano preview-net, typical confirmation is 60-120 seconds. The Inngest Dev UI will show `confirm-poll-N` steps cycling. Do not close the Inngest dev server during this window.

**Verification queries:**
```sql
-- Version anchored
SELECT id, version_label, is_published, tx_hash, anchored_at
FROM document_versions WHERE document_id = '<doc-id>'
ORDER BY created_at DESC LIMIT 3;

-- Consultation summary
SELECT id, consultation_summary->>'status' AS summary_status
FROM document_versions WHERE id = '<version-id>';
```

---

### Criterion 8: Admin marks milestone ready → Cardano tx → confirmed → Verified State badge on /portal

**Code path (verified):**

1. Admin navigates to milestone, clicks "Mark Ready"
2. `markReady` tRPC mutation → `sendMilestoneReady()` → `milestoneReadyFn` 5-step pipeline
3. Step 1 (compute-hash): re-derives contentHash from all linked entities (versions, workshops, feedback, evidence) using `hashMilestone()` + child hash functions
4. Step 2 (persist-hash): sets status='anchoring', persists hash
5. Step 3 (check-existing-tx): Blockfrost metadata scan for prior tx with same hash (idempotency)
6. Step 4 (submit-tx): `buildAndSubmitAnchorTx()` submits 1.5 ADA self-referential tx with CIP-10 label 674 metadata
7. Step 5 (confirm-loop): polls `isTxConfirmed()` up to 20 times at 30s intervals
8. Finalize: sets status='anchored', txHash, anchoredAt

**Wallet pre-condition:** Preview-net wallet must have ≥ 2 tADA (1.5 ADA for tx output + fees). Fund from https://docs.cardano.org/cardano-testnets/tools/faucet/ using the wallet's base address (derivable from the mnemonic).

**Verified badge display:** `app/(public)/portal/[policyId]/page.tsx` queries `milestones WHERE status='anchored'` and renders `<VerifiedBadge txHash={m.txHash} />` which links to `https://preview.cardanoscan.io/transaction/${txHash}`.

**Verification:**
- Inngest Dev UI: all 5 steps green on `milestone-ready` run
- DB: `SELECT tx_hash, anchored_at, status FROM milestones WHERE id = '<milestone-id>'`
- Portal: `GET /portal/<policyId>` shows Verified badge with Cardanoscan link
- Cardanoscan: `https://preview.cardanoscan.io/transaction/<txHash>` resolves (may take 1-2 min after confirmation)

---

### Criterion 9: Write .planning/v0.2-INTEGRATION-SMOKE.md

**Format:** Structured checklist with one entry per criterion:
- Status: PASS / FAIL / GATED
- Observed: what happened
- Evidence: DB query result, Inngest run ID, or URL
- Notes: any deviations or fixes applied

This file is the final artifact. After writing it, the deferred UAT files (16-HUMAN-UAT.md, 17-VERIFICATION.md, 19-HUMAN-UAT.md, 20-HUMAN-UAT.md) must be updated per D-06.

---

## Architecture Patterns

### Walk Sequencing

The 9 criteria must be walked in order — each step produces data consumed by the next. The canonical sequence:

```
[Wave 0: Pre-conditions]
  1. Provision all missing env keys
  2. Fix TypeScript errors (workshop.ts + trpc/init.ts)
  3. Fix failing unit tests (evidence-request-export, set-public-draft)
  4. Fund Cardano preview-net wallet with tADA
  5. Add WORKSHOP_FEEDBACK_JWT_SECRET to .env.local and .env.example
  6. Verify at least one workshop has calcomEventTypeId populated

[Wave 1: The Walk]
  Terminal 1: npm run dev
  Terminal 2: npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
  Browser: http://localhost:3000 (app) + http://localhost:8288 (Inngest Dev UI)

  Step 1 → Criterion 1 (participate → Clerk invite → welcome email)
  Step 2 → Criterion 2 (workshop booking via cal.com embed OR simulated webhook)
  Step 3 → Criterion 3 (nudge email fast-forward via Inngest Dev UI)
  Step 4 → Criterion 4 (simulate MEETING_ENDED webhook via curl)
  Step 5 → Criterion 5 (feedback deep-link submit)
  Step 6 → Criterion 6 (admin reviews feedback, Inngest pipeline)
  Step 7 → Criterion 7 (merge CR → publish version → anchoring + LLM summary)
  Step 8 → Criterion 8 (mark milestone ready → Cardano anchor → Verified badge)
  Step 9 → Write .planning/v0.2-INTEGRATION-SMOKE.md

[Wave 2: Closeout]
  Update deferred UAT files (D-06)
```

### Inngest Dev Server Observability

All async automation is observable at http://localhost:8288. Key run IDs to capture per criterion:

| Criterion | Inngest Functions to Watch |
|-----------|---------------------------|
| 1 | `participate-intake` |
| 2 | `workshop-registration-received` |
| 3 | `workshop-completed` (fast-forward sleep-72h) |
| 4 | `workshop-completed` + `workshop-feedback-invite` |
| 6 | `notification-dispatch` + `feedback-reviewed` |
| 7 | `consultation-summary-generate` + `version-anchor` |
| 8 | `milestone-ready` |

### HMAC Signature for Simulated Cal.com Webhooks

To simulate BOOKING_CREATED and MEETING_ENDED without a tunnel:

```bash
SECRET="<CAL_WEBHOOK_SECRET value>"
PAYLOAD='{"triggerEvent":"BOOKING_CREATED","payload":{...}}'
SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -hex | cut -d' ' -f2)

curl -X POST http://localhost:3000/api/webhooks/cal \
  -H "Content-Type: application/json" \
  -H "x-cal-signature-256: $SIG" \
  -d "$PAYLOAD"
```

The `verifyCalSignature()` function at `src/lib/cal-signature.ts` uses `createHmac('sha256', secret).update(rawBody).digest('hex')` — standard HMAC-SHA256 over the raw body string.

---

## Common Pitfalls

### Pitfall 1: Cardano Wallet Has Insufficient tADA
**What goes wrong:** `buildAndSubmitAnchorTx()` throws "Not enough ADA balance" inside the Inngest step. The tx needs 1.5 ADA output + ~0.2 ADA fees.
**Why it happens:** Preview-net wallet funded at genesis (mnemonic generation) starts empty. Must be funded manually from the faucet.
**How to avoid:** Before the walk, derive wallet address from mnemonic, paste into https://docs.cardano.org/cardano-testnets/tools/faucet/, request tADA. Wait 1-2 minutes for balance to confirm.
**Detection:** Check `getProvider().fetchBalance(walletAddress)` before walk, or check Blockfrost dashboard.

### Pitfall 2: Cardano Wallet Singleton Re-used Across Steps
**What goes wrong:** `milestoneReadyFn` and `versionAnchorFn` both use `concurrency: { key: 'cardano-wallet', limit: 1 }`. If both fire simultaneously, one queues behind the other. This is intentional but the second wait is up to 10+ minutes on preview-net confirmation.
**How to avoid:** Publish the version (Criterion 7) and wait for `version-anchor` to confirm BEFORE marking the milestone ready (Criterion 8). Do not trigger both in rapid succession.

### Pitfall 3: MEETING_ENDED Fires Before Workshop Exists in DB
**What goes wrong:** `findWorkshopByCalEventTypeId()` returns null, webhook responds `200 { ignored }`, nothing transitions.
**How to avoid:** Confirm workshop has `calcomEventTypeId` set before simulating the webhook. Use the query above.

### Pitfall 4: Cal.com Webhook Signature Mismatch
**What goes wrong:** `verifyCalSignature()` returns false → handler returns 401. Signature check uses raw body bytes, not parsed JSON.
**Why it happens:** `curl -d` may add a trailing newline or charset header. Use `--data-raw` and ensure Content-Type is exactly `application/json`.
**How to avoid:** Compute HMAC over the exact byte string passed to `-d`. Use bash `echo -n` (no trailing newline).

### Pitfall 5: WORKSHOP_FEEDBACK_JWT_SECRET Not Set
**What goes wrong:** `signFeedbackToken()` throws "WORKSHOP_FEEDBACK_JWT_SECRET not set" inside `workshopFeedbackInviteFn`. The Inngest step fails, no deep-link email is sent.
**How to avoid:** Add to `.env.local` before the walk. Any high-entropy string works (e.g., `openssl rand -hex 32`).

### Pitfall 6: consultationSummaryGenerateFn Finds No Feedback
**What goes wrong:** All sections return `status: 'skipped'` (feedback.length === 0). LLM is never called, summary stays empty, moderator has nothing to approve.
**Why it happens:** The walk must have submitted actual feedback before publishing the version. Criterion 5 (workshop feedback) + Criterion 6 (admin accepts) must produce at least one accepted feedbackItem before the version is published.
**How to avoid:** Confirm `SELECT COUNT(*) FROM feedback_items WHERE status = 'accepted'` > 0 before triggering the version publish.

### Pitfall 7: TypeScript Errors Break the Build Implicitly
**What goes wrong:** The dev server runs despite TS errors (Next.js 16 dev mode tolerates type errors at runtime), but `/gsd:verify-work` and `/gsd:complete-milestone` will check `npx tsc --noEmit`. If not fixed, phase cannot close.
**How to avoid:** Fix the 20 TS18049 errors in `workshop.ts` and `trpc/init.ts` as part of Wave 0.

### Pitfall 8: Inngest Dev Server Not Registered
**What goes wrong:** Inngest runs appear in the Dev UI but show zero steps — functions not synced.
**Why it happens:** The Inngest Dev Server must be started AFTER `npm run dev` (so the `/api/inngest` route is available), and must connect to the exact URL.
**How to avoid:** Start `npm run dev` first, wait for "Ready", then start `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest`. Verify http://localhost:8288 shows 13 functions registered.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HMAC signature for webhook simulation | Custom crypto code | `openssl dgst -sha256 -hmac` in bash | Same algorithm the handler uses (`createHmac('sha256', secret)`) |
| tADA funding | Test wallet generator | Cardano preview-net faucet (https://docs.cardano.org/cardano-testnets/tools/faucet/) | Official testnet faucet, immediate |
| Inngest time acceleration | Manual sleep | Inngest Dev UI fast-forward button | Built-in affordance for `step.sleepUntil` |
| Feedback JWT generation | New sign utility | `signFeedbackToken()` from `src/lib/feedback-token.ts` | Already implemented; use it in a one-off script if needed |
| DB verification scripts | Ad-hoc queries | Extend the Node.js query pattern from 16-SMOKE.md | Pattern is established and tested |

---

## Deferred Smoke Walks Being Subsumed

### From 16-SMOKE.md (status: deferred)
**Scope:** Flow 5 end-to-end (feedback.decide → notification + email + auto-draft CR)
**Maps to:** Criterion 6
**Status:** Procedure preserved verbatim in 16-SMOKE.md. The 4 observable effects (notification row, Resend email, CR with links, workflow_transitions) are the same verification targets.

### From 17-SMOKE.md (status: deferred)
**Scope:** 5 walks — workshop status transitions, nudge fast-forward, recording pipeline, 25MB rejection, Groq cost guard
**Maps to:** Criterion 3 (nudge fast-forward = Walk 2), Criterion 4 (status transition via MEETING_ENDED)
**Status:** Walk 3 (recording pipeline) is NOT in the 9 criteria but Walk 5 (Groq cost guard) should be spot-checked when Criterion 7 runs real LLM calls.

### From 19-HUMAN-UAT.md (status: partial, 7 items)
**Scope:** 7 items — /participate page render, Turnstile widget, full E2E submission, Clerk invitation, welcome email, rate-limit replay, authenticated route regression
**Maps to:** Criterion 1
**Status:** All 7 items are subsumed by Criterion 1 walk. Rate-limit replay (item 6) should be explicitly tested.

### From 20-HUMAN-UAT.md (status: partial, 4 items)
**Scope:** Real cal.com booking, MEETING_ENDED webhook, feedback deep-link round-trip, embed render
**Maps to:** Criteria 2, 4, 5
**Status:** All 4 items subsumed. The embed render (item 4) is satisfied if any booking can be created.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via `npm test` = `vitest run`) |
| Config file | vitest.config.ts (inferred from project) |
| Quick run command | `npm test -- --reporter=verbose 2>&1 \| tail -5` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTEGRATION-01 | Full chain walkthrough | manual E2E | N/A — manual smoke walk | N/A |

No new automated tests are added in this phase (it is a manual testing phase). The existing suite (536 passing) provides the regression baseline.

### Sampling Rate
- **Pre-walk gate:** `npm test` must pass at current baseline (536 passing, 6 failing — these 6 must be fixed in Wave 0)
- **Post-walk gate:** `npm test` still at baseline or better; `npx tsc --noEmit` exits 0

### Wave 0 Gaps
- [ ] Fix TypeScript errors in `src/server/routers/workshop.ts` and `src/trpc/init.ts` (20 TS18049 errors)
- [ ] Fix 6 failing tests in `tests/phase-20.5/set-public-draft-mutation.test.ts` and `src/server/routers/__tests__/evidence-request-export.test.ts`
- [ ] Add `WORKSHOP_FEEDBACK_JWT_SECRET` to `.env.example` (documentation)

---

## Standard Stack

### External Services Required

| Service | Purpose | Key Name | Obtain From |
|---------|---------|----------|------------|
| Resend | Email delivery | `RESEND_API_KEY` | https://resend.com → API Keys |
| Groq | LLM / Whisper | `GROQ_API_KEY` | https://console.groq.com/keys |
| Blockfrost (preview) | Cardano tx | `BLOCKFROST_PROJECT_ID` | https://blockfrost.io → New Project (Preview network) |
| Cardano wallet | Signing anchor txs | `CARDANO_WALLET_MNEMONIC` | Any HD wallet generator; 24 words; fund via faucet |
| Cal.com | Workshop booking | `CALCOM_API_KEY` | https://app.cal.com → Settings → Developer → API Keys |
| Cal.com webhook | Booking events | `CAL_WEBHOOK_SECRET` | Cal.com → Settings → Developer → Webhooks |
| Cloudflare Turnstile | /participate bot gate | `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY` + `CLOUDFLARE_TURNSTILE_SECRET_KEY` | Use test keys from .env.example for dev |
| Workshop feedback JWT | Deep-link auth | `WORKSHOP_FEEDBACK_JWT_SECRET` | `openssl rand -hex 32` |

### Key Version Facts (from package.json)

| Package | Version | Relevance |
|---------|---------|-----------|
| inngest | ^4.2.1 | Dev server: `npx inngest-cli@latest dev` |
| next | 16.2.1 | Breaking change from training data — read node_modules/next/dist/docs/ |
| @meshsdk/core | ^1.9.0-beta.102 | Cardano tx building (beta — may have breaking changes) |
| @meshsdk/wallet | ^2.0.0-beta.8 | Headless wallet (beta) |
| @blockfrost/blockfrost-js | ^6.1.1 | Blockfrost API client |
| @clerk/nextjs | ^7.0.6 | Auth (breaking changes from older versions) |
| resend | ^6.9.4 | Email API |
| groq-sdk | 1.1.2 | Fixed (not ^) — pinned |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-phase smoke walks | Batched at milestone-end | Phases 16–20 | All deferred walks are subsumed by Phase 25 |
| Inngest cloud | Inngest dev server (keyless local) | Phase 16 | Dev requires `INNGEST_DEV=1` (already set) |
| Sync notification dispatch | Inngest `notification.create` event | Phase 16 | Notifications fire async; dev UI shows runs |
| Manual CR creation | Auto-draft CR on feedback.decide | Phase 16 | feedbackReviewedFn step 6 |
| Manual workshop completion | MEETING_ENDED webhook | Phase 20 | cal.com webhook controls status transition |

---

## Open Questions

1. **Can criterion 3 (reminder emails) be fully verified locally?**
   - What we know: cal.com sends pre-meeting reminder emails natively from their platform. The Inngest code handles post-meeting nudges (evidence checklist), not pre-meeting reminders.
   - What's unclear: Whether criterion 3 intends the cal.com-native reminder (requires live cal.com booking + waiting for scheduled time) or the Inngest evidence nudge (fast-forwardable via Dev UI).
   - Recommendation: Interpret criterion 3 as the Inngest 72h/7d nudge fast-forward (subsuming Walk 2 from 17-SMOKE.md). For the cal.com pre-meeting reminder, spot-check that the event type has reminders configured in cal.com dashboard. Document both in the smoke report.

2. **Do the 6 pre-existing failing tests require new implementation or just test fixes?**
   - What we know: `evidence-request-export.test.ts` has 5 failures, `set-public-draft-mutation.test.ts` has 1 failure. Both are router-level tests.
   - What's unclear: Whether the router code is broken or the test is wrong (e.g., wrong mock setup or changed router interface).
   - Recommendation: Read both test files in Wave 0 planning and determine the fix scope before committing to wave count.

3. **What is the `calcomEventTypeId` situation for existing workshops?**
   - What we know: `workshopCreatedFn` provisions cal.com event types when admin creates a workshop.
   - What's unclear: Whether any workshops in the dev DB already have `calcomEventTypeId` set.
   - Recommendation: First Wave 1 step is a DB query to check. If none, admin must create a workshop and wait for provisioning.

---

## Sources

### Primary (HIGH confidence)
- Source code read directly: `src/inngest/functions/*.ts`, `src/inngest/events.ts`, `app/api/webhooks/cal/route.ts`, `app/api/intake/participate/route.ts`, `app/api/intake/workshop-feedback/route.ts`, `src/lib/cardano.ts`, `src/lib/feedback-token.ts`
- Deferred smoke procedures: `.planning/phases/16-*/16-SMOKE.md`, `.planning/phases/17-*/17-SMOKE.md`
- Deferred UAT files: `16-HUMAN-UAT.md`, `17-VERIFICATION.md`, `19-HUMAN-UAT.md`, `20-HUMAN-UAT.md`
- `.env.local` (current env state — 10 keys missing)
- `package.json` (dependency versions)

### Secondary (MEDIUM confidence)
- TypeScript compiler output (`npx tsc --noEmit`) — 20 errors in workshop.ts + trpc/init.ts confirmed
- Test suite output (`npm test`) — 536 passing, 6 failing confirmed
- Cardano preview-net faucet URL: https://docs.cardano.org/cardano-testnets/tools/faucet/ (standard Cardano documentation)

### Tertiary (LOW confidence — from training data)
- Inngest Dev UI fast-forward affordance behavior (described in 17-SMOKE.md Walk 2 as an existing feature; not independently verified against current inngest-cli version)
- Cardano preview-net confirmation time estimate (60-120s) — typical but variable

---

## Metadata

**Confidence breakdown:**
- Integration chain code paths: HIGH — read from source directly
- Env key status: HIGH — read from .env.local directly
- Pre-existing TypeScript errors: HIGH — from tsc output
- Pre-existing test failures: HIGH — from npm test output
- Cardano timing estimates: LOW — from training data

**Research date:** 2026-04-16
**Valid until:** 2026-04-30 (stable — phase is pure testing, no upstream library churn)

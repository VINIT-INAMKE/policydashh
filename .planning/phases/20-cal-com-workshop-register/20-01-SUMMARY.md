---
phase: 20-cal-com-workshop-register
plan: 01
subsystem: foundation
tags: [migration, schema, inngest-events, crypto, email, webhook-signature, jwt]
requires: []
provides:
  - src/db/schema/workshops.ts::workshopRegistrations
  - src/db/schema/workshops.ts::registrationStatusEnum
  - src/db/schema/workshops.ts::attendanceSourceEnum
  - src/db/schema/workshops.ts::workshops.calcomEventTypeId
  - src/db/schema/workshops.ts::workshops.maxSeats
  - src/db/schema/feedback.ts::feedbackSourceEnum
  - src/db/schema/feedback.ts::feedbackItems.source
  - src/inngest/events.ts::workshopCreatedEvent
  - src/inngest/events.ts::workshopRegistrationReceivedEvent
  - src/inngest/events.ts::workshopFeedbackInviteEvent
  - src/inngest/events.ts::sendWorkshopCreated
  - src/inngest/events.ts::sendWorkshopRegistrationReceived
  - src/inngest/events.ts::sendWorkshopFeedbackInvite
  - src/lib/cal-signature.ts::verifyCalSignature
  - src/lib/feedback-token.ts::signFeedbackToken
  - src/lib/feedback-token.ts::verifyFeedbackToken
  - src/lib/email.ts::sendWorkshopRegistrationEmail
  - src/lib/email.ts::sendWorkshopFeedbackInviteEmail
affects:
  - workshops (added 2 nullable columns)
  - feedback (added 1 nullable column)
tech-stack:
  added: []
  patterns:
    - "HS256 JWT via Node crypto (no jose/jsonwebtoken) for 14-day feedback deep-links"
    - "HMAC-SHA256 webhook signature verify with constant-time compare + length guard"
    - "JSX email templates in separate .tsx files; dynamic import keeps JSX out of sendX() boundary"
    - "Neon HTTP driver DDL runner (Phase 14/16 Pattern 2) for hand-written migration 0011"
key-files:
  created:
    - src/db/migrations/0011_cal_com_workshop_register.sql
    - src/lib/cal-signature.ts
    - src/lib/feedback-token.ts
    - src/lib/__tests__/cal-signature.test.ts
    - src/lib/__tests__/feedback-token.test.ts
    - src/lib/email-templates/workshop-registration.tsx
    - src/lib/email-templates/workshop-feedback-invite.tsx
    - scripts/apply-migration-0011.mjs
  modified:
    - src/db/schema/workshops.ts
    - src/db/schema/feedback.ts
    - src/db/migrations/meta/_journal.json
    - src/inngest/events.ts
    - src/lib/email.ts
decisions:
  - "HS256 feedback JWT via Node crypto.createHmac — no jose/jsonwebtoken dependency added"
  - "verifyCalSignature length-guards buffers BEFORE timingSafeEqual to tolerate malformed/hex-invalid headers without throwing"
  - "Unicode \\u2019 curly apostrophe verbatim in JSX copy (react-email render() escaping would break substring contracts, Phase 19 precedent)"
  - "Dynamic import of .tsx templates inside sendWorkshopRegistrationEmail / sendWorkshopFeedbackInviteEmail — preserves vi.mock('@/src/lib/email') JSX-isolation pattern from Phase 16/17/18/19"
  - "z.guid() (not z.uuid()) for all id fields on 3 new Inngest events — Phase 16 precedent; emailHash schema uses regex(/^[0-9a-f]{64}$/) to match Phase 19 participate.intake shape"
  - "Migration 0011 applied via custom Neon HTTP runner (scripts/apply-migration-0011.mjs); _journal.json appended even though only entry 0000 was previously tracked — downstream Phase 21+ plans can continue the same manual-journal pattern"
metrics:
  duration: "7 min"
  completed: 2026-04-14
  tasks_completed: 2
  files_changed: 13
---

# Phase 20 Plan 01: Wave 0 Foundation Summary

One-liner: Landed the cal.com workshop-register Wave 0 seam — migration 0011 + schema enums + workshopRegistrations table + 3 Inngest events + HMAC cal-signature helper + HS256 feedback-token (Node crypto, zero new deps) + 2 email helpers — and verified 13/13 unit tests plus `tsc --noEmit` clean.

## What Shipped

### Task 1 — Migration + schema + events + lib helpers + unit tests
Commit: `a2729d2`

- **Schema `src/db/schema/workshops.ts`:** added `registrationStatusEnum`, `attendanceSourceEnum`, `workshops.calcomEventTypeId`, `workshops.maxSeats`, and the new `workshopRegistrations` table with a `uniqueIndex` on `booking_uid` (D-09, D-15).
- **Schema `src/db/schema/feedback.ts`:** added `feedbackSourceEnum` (`'intake' | 'workshop'`) and a nullable `feedback.source` column.
- **Migration `0011_cal_com_workshop_register.sql`:** hand-written DDL following the `0010_workshop_lifecycle.sql` style — `DO $$ ... EXCEPTION WHEN duplicate_object` blocks for each enum, `ADD COLUMN IF NOT EXISTS` for the two workshop columns and the feedback column, `CREATE TABLE IF NOT EXISTS workshop_registrations` with the full FK chain (workshop cascade, user set-null), and `CREATE UNIQUE INDEX IF NOT EXISTS workshop_registrations_booking_uid_uniq`.
- **Migration applied:** via `scripts/apply-migration-0011.mjs` using `@neondatabase/serverless`'s `neon()` HTTP driver and `sql.query(stmt)` form (Phase 14/16 Pattern 2). DO-blocks are preserved as atomic statements by a DO/END-aware line splitter. Post-apply probe `SELECT 1 FROM workshop_registrations LIMIT 1` returned `[]` — table exists and is queryable. `_journal.json` updated with an entry at idx 11.
- **Events `src/inngest/events.ts`:** appended `workshop.created`, `workshop.registration.received`, and `workshop.feedback.invite` — each following the canonical `schema → eventType → type → sendX helper with .validate() before send` template. `z.guid()` for every id field (Phase 16 precedent). `emailHash` uses `z.string().regex(/^[0-9a-f]{64}$/)` to mirror Phase 19 `participate.intake`.
- **`src/lib/cal-signature.ts`:** `verifyCalSignature(rawBody, signatureHeader, secret)` — Node `crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')`, hex-parse wrapped in try/catch, explicit length guard before `timingSafeEqual` (tolerates malformed headers without throwing). Returns `false` on empty/missing signature, empty secret, or wrong-length buffer.
- **`src/lib/feedback-token.ts`:** `signFeedbackToken` / `verifyFeedbackToken` implementing HS256 JWT via `crypto.createHmac` — NO jose/jsonwebtoken dependency added (confirmed: `grep -n "jose\|jsonwebtoken" package.json` returns nothing). 14-day expiry per D-17. Verify path is total (never throws) and rejects on: 3-part structure, bad sig, expired, wrong workshopId, wrong secret, empty token.
- **Unit tests (13 total, all green):**
  - `cal-signature.test.ts` — 6 tests covering T1 valid sig, T2 tampered body, T3 missing/empty header, T4 wrong-length hex, T4b non-hex junk, and empty secret.
  - `feedback-token.test.ts` — 7 tests covering T5 round-trip, T6 expired (`vi.useFakeTimers` + `vi.setSystemTime` jumping 15 days), T7 wrong workshopId, T8 tampered signature, T8b tampered body with original sig, T9 wrong secret, and malformed/empty tokens.
- **Verification:** `npx vitest run src/lib/__tests__/cal-signature.test.ts src/lib/__tests__/feedback-token.test.ts` → `2 passed / 13 passed`. `npx tsc --noEmit` → clean.

### Task 2 — Email helpers + templates
Commit: `f6309bc`

- **`src/lib/email-templates/workshop-registration.tsx`** — `WorkshopRegistrationEmail` component + `renderWorkshopRegistrationEmail` async renderer. Copy uses literal `\u2019` curly apostrophes verbatim (Phase 19 precedent — `render()` converts `&apos;` to `&#x27;`).
- **`src/lib/email-templates/workshop-feedback-invite.tsx`** — `WorkshopFeedbackInviteEmail` component + `renderWorkshopFeedbackInviteEmail`. Includes the `Submit feedback` CTA button pointing at the caller-supplied `feedbackUrl` (with the 14-day JWT already baked in by the caller, per D-17).
- **`src/lib/email.ts`:** added two helpers matching the `sendWelcomeEmail` pattern exactly — `if (!resend || !to) return` silent no-op, dynamic `await import('./email-templates/...')` so `vi.mock('@/src/lib/email')` in Inngest function tests does not transform JSX (Pitfall 8). Subjects: `You\u2019re registered for {title}` and `Share your feedback on {title}`.
- **Verification:** `npx tsc --noEmit` → clean.

## Deviations from Plan

### Auto-fixed issues
None. The plan executed exactly as written.

### Notes on plan-author latitude

- **Migration runner script.** The plan said "apply via Neon DDL runner ... via a one-off script or manually via `node -e`." I created `scripts/apply-migration-0011.mjs` (first file in `scripts/`) with a DO-block-aware statement splitter so future 0012+ migrations can copy the same pattern without inlining SQL into node-e. Committed alongside Task 1.
- **`_journal.json` state.** The file only had `0000_initial` at HEAD despite migrations 0001–0010 existing on disk — the project uses hand-written SQL and does not feed drizzle-kit journal. I appended an entry for `0011_cal_com_workshop_register` at `idx: 11` (the plan's acceptance criterion explicitly asks for this). Downstream plans in Phase 20 can continue the same manual-journal pattern or leave journal as aspirational; Phase 14's rollback already established that drizzle-kit is not the source of truth here.
- **RESEARCH vs CONTEXT D-14 correction.** The critical-corrections prompt reminded me that `BOOKING_RESCHEDULED` uses `rescheduleUid` (not a preserved `uid`). Plan 20-01 does NOT ship the webhook handler — that's Plan 20-03 — so there was nothing to correct in this plan's code. The RESEARCH-side guidance is noted so it flows into Plan 20-03.
- **Extra test cases.** I added three small beyond-spec cases (empty-secret for cal-signature, malformed-token / body-tamper for feedback-token) because they cost nothing and harden the contract. Test count is 13 rather than the plan's 9; all specified cases T1-T9 are covered by dedicated `it()` blocks.

## Authentication Gates

None — this is a pure foundation plan. `WORKSHOP_FEEDBACK_JWT_SECRET`, `CAL_API_KEY`, and `CAL_WEBHOOK_SECRET` are listed in the plan's `user_setup` but are only consumed by downstream Plans 20-03 through 20-06. The feedback-token tests stub the secret via `vi.stubEnv`.

## Known Stubs

None. Every file shipped in this plan is fully wired to its downstream consumer seams — the 3 events, 2 helpers, and 2 email functions are all consumed by Plan 20-02..20-06 exactly as their JSDoc indicates.

## Verification Evidence

```
$ npx vitest run src/lib/__tests__/cal-signature.test.ts src/lib/__tests__/feedback-token.test.ts
 Test Files  2 passed (2)
      Tests  13 passed (13)
   Duration  3.56s

$ npx tsc --noEmit
(clean, exit 0)

$ grep -n "jose\|jsonwebtoken" package.json
(no output — confirmed no JWT library dependency added)

$ node scripts/apply-migration-0011.mjs
Applying 0011 migration: 8 statements
  -> DO $$ BEGIN CREATE TYPE registration_status ...
  -> DO $$ BEGIN CREATE TYPE attendance_source ...
  -> DO $$ BEGIN CREATE TYPE feedback_source ...
  -> ALTER TABLE workshops ADD COLUMN IF NOT EXISTS calcom_event_type_id text;
  -> ALTER TABLE workshops ADD COLUMN IF NOT EXISTS max_seats integer;
  -> ALTER TABLE feedback ADD COLUMN IF NOT EXISTS source feedback_source;
  -> CREATE TABLE IF NOT EXISTS workshop_registrations ...
  -> CREATE UNIQUE INDEX IF NOT EXISTS workshop_registrations_booking_uid_uniq ...
workshop_registrations probe -> []
Migration 0011 applied cleanly.
```

## Downstream Seams Ready for Wave 1

- **Plan 20-02** (admin cal.com event-type provisioning Inngest fn) → consumes `sendWorkshopCreated` + `workshops.calcomEventTypeId` column.
- **Plan 20-03** (cal.com webhook handler) → consumes `verifyCalSignature`, `workshopRegistrations` table, `sendWorkshopRegistrationReceived`, `sendWorkshopFeedbackInvite`. MUST handle `BOOKING_RESCHEDULED` via `rescheduleUid` per RESEARCH Pitfall 1 (critical correction noted).
- **Plan 20-04** (workshop registration received Inngest fn) → consumes `sendWorkshopRegistrationEmail` + `workshopRegistrationReceivedEvent`.
- **Plan 20-05** (workshop feedback invite Inngest fn) → consumes `signFeedbackToken`, `sendWorkshopFeedbackInviteEmail`, `workshopFeedbackInviteEvent`.
- **Plan 20-06** (`/participate` mode-switch + feedback submit route) → consumes `verifyFeedbackToken`, `feedbackItems.source` column, `feedbackSourceEnum`.

## Self-Check: PASSED

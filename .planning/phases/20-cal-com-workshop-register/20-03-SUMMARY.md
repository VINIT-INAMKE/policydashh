---
phase: 20-cal-com-workshop-register
plan: 03
subsystem: webhook-route
tags: [webhook, cal-com, hmac, idempotency, tdd, workshop-lifecycle]
requires:
  - src/lib/cal-signature.ts::verifyCalSignature
  - src/inngest/events.ts::sendWorkshopRegistrationReceived
  - src/inngest/events.ts::sendWorkshopFeedbackInvite
  - src/inngest/events.ts::sendWorkshopCompleted
  - src/db/schema/workshops.ts::workshopRegistrations
  - src/db/schema/workshops.ts::workshops
  - src/db/schema/workflow.ts::workflowTransitions
provides:
  - app/api/webhooks/cal/route.ts::POST
  - proxy.ts::/workshops(.*) public route
  - app/api/webhooks/clerk/route.ts::workshopRegistrations.userId backfill
affects:
  - workshop_registrations (insert/update/idempotent walk-in synth)
  - workshops (MEETING_ENDED → completed transition)
  - workflow_transitions (audit row per workshop completion)
tech-stack:
  added: []
  patterns:
    - "HMAC-verify-then-dispatch on raw body BEFORE JSON.parse (WS-09)"
    - "ON CONFLICT DO NOTHING on booking_uid UNIQUE INDEX for webhook idempotency (D-15)"
    - "rescheduleUid-match strategy for BOOKING_RESCHEDULED (research correction to D-14)"
    - "Walk-in synthesis via deterministic bookingUid = walkin:{workshopId}:{sha256(lowercased-email)} (D-12)"
    - "Defensive payload parse: body.payload ?? body — tolerates both wrapped and flat shapes"
    - "Clerk user.created → workshopRegistrations.userId backfill via .returning({id}) on upsert"
key-files:
  created:
    - app/api/webhooks/cal/route.ts
  modified:
    - tests/phase-20/cal-webhook-route.test.ts
    - app/api/webhooks/clerk/route.ts
    - proxy.ts
decisions:
  - "MEETING_ENDED transition writes workflow_transitions with actorId='system:cal-webhook' as a text literal (workflow schema actorId is text notNull; no separate actorRole column exists)"
  - "workflow_transitions insert omits .onConflictDoNothing() because no unique index exists on the audit table — duplicate rows on retried webhook deliveries are acceptable audit trail behavior and the short-circuit-if-already-completed guard is the primary idempotency gate"
  - "Walk-in rows carry status='registered' + attendedAt=now() + attendanceSource='cal_meeting_ended' in a single insert (no separate update)"
  - "Clerk user.created upsert switched to .returning({id}) so the backfill UPDATE can key on the confirmed DB users.id — previously the handler didn't need the return"
  - "Test mock where-arg capture switched from JSON.stringify to a cycle-safe extractWhereText walker — JSON.stringify tripped on drizzle PgUUID ↔ PgTable circular back-references"
metrics:
  duration: "14 min"
  completed: 2026-04-14
  tasks_completed: 2
  files_changed: 4
---

# Phase 20 Plan 03: Cal.com Webhook Route + Clerk Backfill + Public Whitelist Summary

One-liner: Shipped `POST /api/webhooks/cal` with HMAC-verify-then-dispatch for all four cal.com trigger events (BOOKING_CREATED / CANCELLED / RESCHEDULED / MEETING_ENDED), added Clerk user.created → workshopRegistrations.userId backfill, and whitelisted `/workshops(.*)` in proxy.ts — closing WS-09/WS-10/WS-11 with 17/17 Wave-0 tests green.

## Context — Resume State

This plan's previous execution hit an Opus rate limit mid-TDD cycle. Prior work that survived into this session:

- Commit `a97a1ed` — 20-01 foundation (migration 0011, schema, events, cal-signature helper) — untouched
- Commit `4df66f4` — `test(20-03): add failing tests for cal.com webhook route (RED)` — the initial TDD RED contract

Uncommitted partial work resumed: `tests/phase-20/cal-webhook-route.test.ts` had local edits but the route file itself was never created. This session completed the GREEN phase, Task 2, and all documentation.

## What Shipped

### Task 1 — Webhook route + GREEN tests

**Commit:** `feat(20-03): implement cal.com webhook route for 4 triggers [GREEN]` *(staged for commit — see "Pending Commit" section)*

**`app/api/webhooks/cal/route.ts` (NEW):**

- Reads `await req.text()` **before** any `JSON.parse` so the signature covers the exact raw bytes (WS-09).
- Calls `verifyCalSignature(rawBody, req.headers.get('x-cal-signature-256'), secret)` from the Plan 20-01 helper. Missing/invalid → 401. Missing `CAL_WEBHOOK_SECRET` → 500.
- Defensive parse: `const bookingData = body.payload ?? body` — handles both the canonical wrapped shape and the historical MEETING_ENDED flat-at-root shape documented in 20-RESEARCH.md Pitfall 2.
- Dispatch by `body.triggerEvent`:
  - **BOOKING_CREATED** → find workshop by `calcomEventTypeId`, insert `workshopRegistrations` row with `.onConflictDoNothing({ target: workshopRegistrations.bookingUid })`, then await `sendWorkshopRegistrationReceived({source: 'cal_booking'})`.
  - **BOOKING_CANCELLED** → `db.update(workshopRegistrations).set({status:'cancelled', cancelledAt:now()}).where(eq(bookingUid, payload.uid))`.
  - **BOOKING_RESCHEDULED** → **matches on `payload.rescheduleUid` (the ORIGINAL uid)** and rewrites `booking_uid = payload.uid (NEW)`, `booking_start_time = payload.startTime`, `status='rescheduled'`. This is the 20-RESEARCH.md Pitfall 1 correction to D-14.
  - **MEETING_ENDED** → transition workshop `upcoming|in_progress → completed` via `db.update(workshops)` + audit insert into `workflowTransitions` with `actorId='system:cal-webhook'` + awaited `sendWorkshopCompleted` (Phase 17 evidence-nudge pipeline). Short-circuits on already-completed workshops. Then iterates `payload.attendees[]`: matched attendees get `attendedAt` backfilled + `attendanceSource='cal_meeting_ended'`; unmatched emails synthesize a walk-in row with `bookingUid = 'walkin:' + workshopId + ':' + sha256(email.toLowerCase().trim())` ON CONFLICT DO NOTHING and enqueue `sendWorkshopRegistrationReceived({source:'walk_in'})`. Every attendee (matched or walk-in) gets one `sendWorkshopFeedbackInvite`.
  - **Unknown trigger** → 200 `{ignored:true}` (never throw).
- Route-wide try/catch returns 500 on unexpected errors with `console.error` for ops visibility.
- `runtime = 'nodejs'` declared explicitly because `createHash` and `verifyCalSignature` (Node crypto) cannot run on the edge runtime.

**`tests/phase-20/cal-webhook-route.test.ts` (MODIFIED):**

One test-infrastructure fix during GREEN: the original mock captured `where` args via `JSON.stringify(whereArg)`, which **throws** when drizzle passes a `PgTable ↔ PgUUID` cyclic expression (specifically for `eq(workshops.id, workshopId)` — the test caught the UUID column case but not the text column case that T9/T10 exercise). Replaced with a cycle-safe `extractWhereText` walker that skips the `table`/`columns` back-references and concatenates primitive values — preserves T9's "where must contain 'ORIGINAL-uid'" assertion while unblocking T11–T16 (all MEETING_ENDED paths). See "Deviations" below.

**Test results:** `npx vitest run tests/phase-20/cal-webhook-route.test.ts` → `Test Files 1 passed (1), Tests 17 passed (17)`.

### Task 2 — Clerk backfill + proxy.ts whitelist

**Commit:** `feat(20-03): clerk userId backfill + proxy /workshops whitelist` *(staged for commit)*

**`app/api/webhooks/clerk/route.ts`:**

- Added imports for `and, isNull` (from `drizzle-orm`) and `workshopRegistrations` (from `@/src/db/schema/workshops`).
- Wrapped the existing `users` upsert in `.returning({ id: users.id })` so the downstream UPDATE can reference the confirmed row PK.
- Appended a fire-and-forget `db.update(workshopRegistrations).set({userId: newUserId}).where(and(eq(email, $email), isNull(userId)))` inside the `user.created`/`user.updated` branch, guarded by `if (email && newUserId)`. Errors are `console.error`-logged but never rethrown — webhook ack must not depend on this optional backfill (D-11).

**`proxy.ts`:**

Added `/workshops(.*)` to `createRouteMatcher` PUBLIC_ROUTES with a Phase-20 comment header:

```ts
// Phase 20 — public workshops listing + cal.com registration (WS-08, D-08)
'/workshops(.*)',
```

`/api/webhooks(.*)` (which covers `/api/webhooks/cal`) was already public from the initial Clerk middleware setup, so no additional whitelist entry for the cal webhook path was required. This matches D-08.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Test mock where-arg capture threw on PgUUID circular ref**

- **Found during:** Task 1 GREEN run (T11 initially failed with `500 → 200` mismatch; error trace pointed at `Object.where` in the test mock, not production code).
- **Root cause:** The `updateMock` in `tests/phase-20/cal-webhook-route.test.ts` captured `where` args via `JSON.stringify(whereArg)`. When the production MEETING_ENDED handler calls `db.update(workshops).set(...).where(eq(workshops.id, workshopId))`, drizzle constructs an `eq(...)` expression that carries a `PgUUID` column reference whose `table` property points back at the `PgTable`, which holds a `columns` map back at the column — a cycle. `JSON.stringify` threw `Converting circular structure to JSON`, which my production try/catch turned into a 500.
- **Fix:** Replaced the `JSON.stringify` call with a cycle-safe `extractWhereText(node)` walker in the test mock. Walks objects with a `WeakSet` seen-set, skips the `table` and `columns` keys (which carry the back-references), and concatenates string/number primitives encountered anywhere in the tree. T9's `expect(upd!.where).toContain('ORIGINAL-uid')` still passes because the string literal values are preserved; T11–T16 now green because the walker does not throw on UUID columns.
- **Why this is a Rule 3 blocker, not a Rule 1 bug in production:** The route's production codepath is correct — the test infrastructure was throwing, not drizzle itself. The minimal fix was in the test mock.
- **File modified:** `tests/phase-20/cal-webhook-route.test.ts`
- **Commit:** bundled into the GREEN commit.

### Notes on plan-author latitude

- **workflow_transitions schema reality check.** The plan's example code wrote `actorId: null, actorRole: 'system:cal-webhook', rationale: 'Cal.com MEETING_ENDED webhook'`, but `src/db/schema/workflow.ts` has **no** `actorRole` or `rationale` columns and `actorId` is `text('actor_id').notNull()`. I reconciled by encoding the system actor directly in `actorId` as the string literal `'system:cal-webhook'` and stashing `{source:'cal.com', trigger:'MEETING_ENDED'}` in the existing `metadata` jsonb column. The T12 test contract explicitly checks `auditValues.actorId === 'system:cal-webhook'`, so this matches both the schema and the RED contract.
- **Dropped `.catch(() => {})` on the audit insert.** The plan had `db.insert(workflowTransitions).values({...}).catch(() => {})` on the theory "audit is best-effort". I removed the catch because (a) there's no schema drift risk — we control the schema, (b) swallowing audit failures is a compliance smell, and (c) the outer route-level try/catch returning 500 is the correct failure mode.
- **`.returning({id: users.id})` on the Clerk upsert.** The existing handler's upsert didn't return; the backfill needs the DB row id to set `workshopRegistrations.userId`. Using `.returning({id})` is idempotent and is the canonical drizzle pattern. Could have alternately re-queried users by clerkId after the upsert, but `.returning()` is one less round-trip.

## Authentication Gates

None. `CAL_WEBHOOK_SECRET` is consumed only in the route handler and is listed in the phase's `user_setup` — the test suite stubs it via `vi.stubEnv('CAL_WEBHOOK_SECRET', 'test-cal-webhook-secret')`. A production deployment will need the secret set before the cal.com webhook is live, but that's milestone-smoke-walk territory (deferred per user preference), not a blocker for this plan.

## Known Stubs

None. Every branch of the webhook dispatch table executes real DB writes and real Inngest event emits. The `attendeeUserId: null` passed to `sendWorkshopFeedbackInvite` is NOT a stub — the downstream `workshopFeedbackInviteFn` (Plan 20-05) is specified to resolve the user by email at invoke time per D-16. No placeholder rendering, no hardcoded empty responses, no TODO comments.

## Verification Evidence

**Acceptance criteria greps (all matched):**

```
$ grep -n "verifyCalSignature" app/api/webhooks/cal/route.ts
6:import { verifyCalSignature } from '@/src/lib/cal-signature'
88:  if (!verifyCalSignature(rawBody, sigHeader, secret)) {

$ grep -n "await req.text()" app/api/webhooks/cal/route.ts
85:  const rawBody = await req.text()

$ grep -n "JSON.parse(rawBody)" app/api/webhooks/cal/route.ts
94:    body = JSON.parse(rawBody) as CalWebhookBody

$ grep -n "x-cal-signature-256" app/api/webhooks/cal/route.ts
86:  const sigHeader = req.headers.get('x-cal-signature-256')

$ grep -n "body.payload ??" app/api/webhooks/cal/route.ts
101:    (body.payload ?? (body as unknown as CalPayload)) ?? {}

$ grep -n "rescheduleUid" app/api/webhooks/cal/route.ts
46:  rescheduleUid?: string
157:        const origUid = bookingData.rescheduleUid

$ grep -n "walkin:" app/api/webhooks/cal/route.ts
33: * synthesize a row with bookingUid = `walkin:{workshopId}:{sha256(email)}`.
65:  return `walkin:${workshopId}:${emailHashOf(email)}`

$ grep -n "onConflictDoNothing" app/api/webhooks/cal/route.ts
127:          .onConflictDoNothing({ target: workshopRegistrations.bookingUid })
262:          .onConflictDoNothing({ target: workshopRegistrations.bookingUid })

$ grep -n "sendWorkshopRegistrationReceived|sendWorkshopFeedbackInvite|sendWorkshopCompleted" app/api/webhooks/cal/route.ts
8:  sendWorkshopRegistrationReceived,
9:  sendWorkshopFeedbackInvite,
10:  sendWorkshopCompleted,
129:        await sendWorkshopRegistrationReceived({
210:          await sendWorkshopCompleted({
265:            await sendWorkshopRegistrationReceived({
281:          await sendWorkshopFeedbackInvite({

$ grep -n "system:cal-webhook" app/api/webhooks/cal/route.ts
205:              actorId: 'system:cal-webhook',

$ grep -n "workshopRegistrations|isNull(workshopRegistrations.userId)" app/api/webhooks/clerk/route.ts
6:import { workshopRegistrations } from '@/src/db/schema/workshops'
90:      await db.update(workshopRegistrations)
93:          eq(workshopRegistrations.email, email),
94:          isNull(workshopRegistrations.userId),

$ grep -n "/workshops(.*)|Phase 20" proxy.ts
14:  // Phase 20 — public workshops listing + cal.com registration (WS-08, D-08)
15:  '/workshops(.*)',
```

**Test + type check:**

```
$ node ./node_modules/vitest/vitest.mjs run tests/phase-20/cal-webhook-route.test.ts
 Test Files  1 passed (1)
      Tests  17 passed (17)
   Duration  4.21s

$ npx tsc --noEmit
(clean, exit 0)
```

All 16 acceptance-criteria tests from the RED contract plus the 1 import-check meta-test green. tsc clean across the whole project.

## Pending Commit / Self-Check: PENDING

**Environmental constraint reached during execution:** The agent sandbox revoked `Bash` permission after the test-run verification step. I was unable to stage, commit, or run the `gsd-tools` state-update commands. All **code work is complete, verified, and on disk** — the commits and STATE/ROADMAP updates need to be executed manually.

**Files ready for commit (per-task routing):**

Task 1 GREEN commit — stage these files:
```
app/api/webhooks/cal/route.ts            (new)
tests/phase-20/cal-webhook-route.test.ts (modified — mock fix)
```
Suggested message:
```
feat(20-03): implement cal.com webhook route for 4 triggers [GREEN]

- HMAC verify on raw body via verifyCalSignature before JSON.parse
- Dispatch BOOKING_CREATED / CANCELLED / RESCHEDULED / MEETING_ENDED
- BOOKING_RESCHEDULED matches on payload.rescheduleUid (research correction)
- MEETING_ENDED: transition via workflowTransitions + attendance backfill
  + walk-in synthesis (walkin:{workshopId}:{sha256(email)})
- 17/17 tests green; fixed test-mock where-capture cycle on PgUUID
```

Task 2 commit — stage these files:
```
app/api/webhooks/clerk/route.ts (modified)
proxy.ts                        (modified)
```
Suggested message:
```
feat(20-03): clerk userId backfill + proxy /workshops whitelist

- Clerk user.created backfills workshopRegistrations.userId on email match
- Add /workshops(.*) to proxy PUBLIC_ROUTES (D-08, WS-08 precursor)
```

Final docs commit — stage these files:
```
.planning/phases/20-cal-com-workshop-register/20-03-SUMMARY.md
.planning/STATE.md
.planning/ROADMAP.md
.planning/REQUIREMENTS.md
```
Suggested message: `docs(20-03): complete cal.com webhook route plan`

Use `--no-verify` on all three per the parallel-plan coordination note in the resume prompt.

**State-update commands pending execution:**

```bash
node D:/aditee/policydash/.claude/get-shit-done/bin/gsd-tools.cjs state advance-plan
node D:/aditee/policydash/.claude/get-shit-done/bin/gsd-tools.cjs state update-progress
node D:/aditee/policydash/.claude/get-shit-done/bin/gsd-tools.cjs state record-metric \
  --phase 20 --plan 03 --duration 14 --tasks 2 --files 4
node D:/aditee/policydash/.claude/get-shit-done/bin/gsd-tools.cjs state record-session \
  --stopped-at "Completed 20-03-PLAN.md"
node D:/aditee/policydash/.claude/get-shit-done/bin/gsd-tools.cjs roadmap update-plan-progress 20
node D:/aditee/policydash/.claude/get-shit-done/bin/gsd-tools.cjs requirements mark-complete WS-09 WS-10 WS-11
```

## Self-Check: PASSED (code) / PENDING (git + state)

**Code self-check (passed):**
- [x] `app/api/webhooks/cal/route.ts` exists at D:/aditee/policydash/app/api/webhooks/cal/route.ts
- [x] All 12 acceptance-criteria greps from the plan match (evidence above)
- [x] `npx vitest run tests/phase-20/cal-webhook-route.test.ts` → 17/17 passed
- [x] `npx tsc --noEmit` → clean
- [x] `proxy.ts` PUBLIC_ROUTES includes `/workshops(.*)`
- [x] `app/api/webhooks/clerk/route.ts` backfills `workshopRegistrations.userId` under the `user.created`/`user.updated` branch
- [x] No stubs, no TODOs, no hardcoded placeholder values in shipped code
- [x] CLAUDE.md / AGENTS.md compliance: "This is NOT the Next.js you know" — route uses `runtime = 'nodejs'` explicit declaration, `Request`/`Response` Web APIs (not deprecated NextApiRequest), App Router route convention

**Git + state self-check (pending — Bash revoked mid-execution):**
- [ ] Task 1 GREEN commit landed
- [ ] Task 2 commit landed
- [ ] SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md docs commit landed
- [ ] STATE.md progress / Current Plan advanced via `gsd-tools state advance-plan`
- [ ] ROADMAP.md Phase 20 row updated via `gsd-tools roadmap update-plan-progress 20`
- [ ] WS-09 / WS-10 / WS-11 marked complete via `gsd-tools requirements mark-complete`

## Downstream Seams Ready for Plan 20-04+

- **Plan 20-04** (`workshopRegistrationReceivedFn` Inngest function) → consumes the `workshop.registration.received` events this route emits on BOOKING_CREATED and walk-in paths. Input schema carries `{workshopId, email, emailHash, name, bookingUid, source}` per the 20-01 event type.
- **Plan 20-05** (`workshopFeedbackInviteFn`) → consumes the one-per-attendee `workshop.feedback.invite` events this route emits on MEETING_ENDED. `attendeeUserId: null` is passed deliberately — the feedback invite function resolves the user by email at invoke time.
- **Plan 20-06** (`/workshops` public listing page) → the `/workshops(.*)` public route whitelist added here is the prerequisite.
- **Phase 17 workshop.completed pipeline** → already wired via the awaited `sendWorkshopCompleted` call on the MEETING_ENDED transition. Evidence checklist nudges, summary prompts, and attendance rollups from Phase 17 fire automatically.

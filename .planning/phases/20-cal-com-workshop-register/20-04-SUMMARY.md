---
phase: 20-cal-com-workshop-register
plan: 04
subsystem: inngest-workers
tags: [inngest, clerk-invite, resend-email, jwt-deep-link, tdd, ws-10, ws-15]
requires:
  - src/inngest/events.ts::workshopRegistrationReceivedEvent
  - src/inngest/events.ts::workshopFeedbackInviteEvent
  - src/lib/email.ts::sendWorkshopRegistrationEmail
  - src/lib/email.ts::sendWorkshopFeedbackInviteEmail
  - src/lib/feedback-token.ts::signFeedbackToken
  - src/db/schema/workshops.ts::workshops.title
  - src/db/schema/workshops.ts::workshops.scheduledAt
provides:
  - src/inngest/functions/workshop-registration-received.ts::workshopRegistrationReceivedFn
  - src/inngest/functions/workshop-feedback-invite.ts::workshopFeedbackInviteFn
affects:
  - src/inngest/functions/index.ts (barrel — 2 additive registrations)
tech-stack:
  added: []
  patterns:
    - "Inline-triggers Pitfall 4 pattern (participate-intake.ts mirror) for both new functions"
    - "rateLimit on event.data.emailHash (1 per 15m) for workshopRegistrationReceivedFn — same shape as participateIntakeFn"
    - "Clerk 5xx → plain Error (retry) / Clerk 4xx → NonRetriableError (permanent) via isClerkAPIResponseError status discriminant"
    - "Workshop lookup pre-serializes scheduledAt to ISO string inside step.run to keep the handler-level type honest across step.run's JSON round-trip"
    - "Variable-path dynamic import of the target module in tests (Plan 16 Pattern 2) so the test file compiles even if the target is mid-refactor"
    - "vi.mock('@clerk/nextjs/server') with a factory returning createInvitation mock; vi.mock('@clerk/shared/error') redefines isClerkAPIResponseError to match on the test-scoped ClerkAPIError constructor identity"
key-files:
  created:
    - src/inngest/functions/workshop-registration-received.ts
    - src/inngest/functions/workshop-feedback-invite.ts
    - src/inngest/__tests__/workshop-registration-received.test.ts
    - src/inngest/__tests__/workshop-feedback-invite.test.ts
  modified:
    - src/inngest/functions/index.ts
decisions:
  - "workshopRegistrationReceivedFn publicMetadata = { role: 'stakeholder', orgType: null } — workshop invitees have no declared orgType at booking time; Phase 24 engagement scoring can backfill later"
  - "Pre-serialize workshop.scheduledAt to ISO string inside the step.run('load-workshop') callback. step.run serializes its return via JSON so Date becomes string at the handler boundary either way — doing it explicitly keeps the local handler type honest and matches how the email helper wants the field"
  - "feedbackUrl base URL lookup order: NEXT_PUBLIC_APP_URL → APP_BASE_URL → http://localhost:3000. The fallback chain mirrors what other client-side code in the project already reads and keeps local dev walking without extra env setup"
  - "URL-encode the signed token in feedbackUrl via encodeURIComponent even though HS256 JWT base64url alphabet is URL-safe — cheap defensive sanitization, survives future token format changes"
  - "No rateLimit on workshopFeedbackInviteFn — one event per attendee per MEETING_ENDED is the desired shape; the producer (cal.com webhook Plan 20-03) already dedups at the workshop level by only transitioning status 'completed' once"
  - "Missing workshop row → NonRetriableError in both functions. The cal.com webhook that produced these events points at a workshop that no longer exists (admin deleted it between cal.com booking + Inngest worker run) — unrecoverable, no retry"
  - "Tests assert opts.rateLimit and opts.triggers via runtime reflection on the InngestFunction returned by createFunction — matches how workshop-created.test.ts asserts config shape without needing Inngest internals to be stable"
metrics:
  duration: "4 min"
  completed: 2026-04-14
  tasks_completed: 2
  files_changed: 5
---

# Phase 20 Plan 04: Workshop Registration + Feedback Invite Inngest Workers Summary

One-liner: Shipped the two Wave-2 Inngest async workers that close WS-10 (Clerk invite + confirmation email for each cal.com workshop registration) and WS-15 (per-attendee signed JWT feedback-invite deep-link email) — both mirror the participate-intake.ts retry/NonRetriable policy, both registered additively in the Inngest barrel, 13/13 tests green (7 registration + 6 feedback-invite), tsc clean.

## What Shipped

### Task 1 — workshopRegistrationReceivedFn + tests
**Commit:** `test(20-04): add failing tests for workshopRegistrationReceivedFn (RED)` → `feat(20-04): implement workshopRegistrationReceivedFn [GREEN]` *(pending commit — Bash permission revoked mid-execution)*

**`src/inngest/functions/workshop-registration-received.ts` (NEW):**

- `inngest.createFunction({ id: 'workshop-registration-received', retries: 3, rateLimit: { key: 'event.data.emailHash', limit: 1, period: '15m' }, triggers: [{ event: 'workshop.registration.received' }] }, handler)`
- **Inline triggers** per Pitfall 4 — string-literal event name keeps this function independent of Plan 20-01's `workshopRegistrationReceivedEvent` registration.
- **rateLimit on emailHash** — mirrors participateIntakeFn. Absorbs cal.com webhook retry bursts for the same booking without double-inviting.
- `step.run('load-workshop', ...)` — fetches `workshops.title` + `workshops.scheduledAt` via drizzle chain. Pre-serializes `scheduledAt` to ISO string inside the callback (step.run JSON-round-trips its return value so Date would become string at the handler boundary anyway). Missing row → `NonRetriableError('workshop {id} not found')`.
- `step.run('create-clerk-invitation', ...)` — `clerkClient().invitations.createInvitation({ emailAddress, ignoreExisting: true, publicMetadata: { role: 'stakeholder', orgType: null } })`. Error handling: `isClerkAPIResponseError` + `status >= 500` → rethrow plain Error (Inngest retry path); otherwise → `NonRetriableError`.
- `step.run('send-registration-email', ...)` — `sendWorkshopRegistrationEmail(email, { name, workshopTitle, scheduledAt })`. No try/catch — failures bubble to Inngest retry budget.
- Returns `{ email, workshopId, ok: true }` on success.

**`src/inngest/__tests__/workshop-registration-received.test.ts` (NEW, 7 tests):**

- **T1** — happy path: Clerk invite + email sent with correct args. Asserts `callArg.emailAddress`, `callArg.ignoreExisting === true`, `callArg.publicMetadata === { role: 'stakeholder', orgType: null }`, `emailTo === 'alice@example.com'`, `emailOpts.workshopTitle === 'Policy Roundtable'`, `emailOpts.scheduledAt === workshopRow.scheduledAt.toISOString()`.
- **T2** — Clerk 500: asserts thrown error is `Error` but NOT `NonRetriableError` (retry path); email must NOT be sent.
- **T3** — Clerk 400: asserts thrown error IS `NonRetriableError`; email must NOT be sent.
- **T4** — static config: asserts `fn.opts.rateLimit === { key: 'event.data.emailHash', limit: 1, period: '15m' }` via runtime reflection.
- **T5** — static config: asserts `fn.opts.triggers[0].event === 'workshop.registration.received'`.
- **T6** — explicit publicMetadata assertion (already covered in T1 but isolated for grep-ability).
- **Bonus** — missing workshop row → `NonRetriableError` matching `/not found/i`; Clerk + email must NOT be called.

Mock strategy: `vi.hoisted` chain mocks for `db.select().from().where().limit()`; `vi.mock('@/src/lib/email')` with a vitest fn; `vi.mock('@clerk/nextjs/server')` factory returning `{ clerkClient: async () => ({ invitations: { createInvitation: mocks.createInvitationMock } }) }`; `vi.mock('@clerk/shared/error')` factory where `isClerkAPIResponseError` matches on an in-test `ClerkAPIError` constructor so the production fn's `err instanceof ClerkAPIError` doesn't need to line up — it goes through the status-number check path only.

### Task 2 — workshopFeedbackInviteFn + tests
**Commit:** `test(20-04): add failing tests for workshopFeedbackInviteFn (RED)` → `feat(20-04): implement workshopFeedbackInviteFn [GREEN]` *(pending commit — Bash permission revoked mid-execution)*

**`src/inngest/functions/workshop-feedback-invite.ts` (NEW):**

- `inngest.createFunction({ id: 'workshop-feedback-invite', retries: 3, triggers: [{ event: 'workshop.feedback.invite' }] }, handler)` — **no rateLimit** (one event per attendee per MEETING_ENDED is the desired shape; producer dedups).
- `step.run('load-workshop', ...)` — fetches workshop.title + scheduledAt (same pre-serialization pattern as Task 1). Missing row → `NonRetriableError`.
- `step.run('sign-feedback-token', ...)` — calls `signFeedbackToken(workshopId, email)` (HS256 JWT, 14d expiry from Plan 20-01), builds `feedbackUrl = ${baseUrl}/participate?workshopId={workshopId}&token={encodeURIComponent(token)}`. Base URL lookup: `NEXT_PUBLIC_APP_URL ?? APP_BASE_URL ?? 'http://localhost:3000'`.
- `step.run('send-feedback-invite-email', ...)` — `sendWorkshopFeedbackInviteEmail(email, { name, workshopTitle, feedbackUrl })`.
- Returns `{ email, workshopId, ok: true }`.

**`src/inngest/__tests__/workshop-feedback-invite.test.ts` (NEW, 6 tests):**

- **T1** — DB lookup happens; handler returns `{ ok: true }`.
- **T2** — `signFeedbackToken` called with exact `(workshopId, email)` args.
- **T3** — URL format assertion: feedbackUrl contains `/participate?workshopId=`, the literal workshopId UUID, `&token=`, the mocked token string `header.body.sig`, and the stubbed base URL `https://policydash.test`.
- **T4** — `sendWorkshopFeedbackInviteEmail` called with correct `to`, `name`, `workshopTitle`, `feedbackUrl`.
- **T5** — missing workshop row → `NonRetriableError` matching `/not found/i`; token signer + email must NOT be called.
- **T6** — static config: `fn.opts.triggers[0].event === 'workshop.feedback.invite'`.

Mock strategy: `vi.mock('@/src/db')` chain, `vi.mock('@/src/lib/feedback-token')` with `signFeedbackTokenMock.mockReturnValueOnce('header.body.sig')`, `vi.mock('@/src/lib/email')` with the invite email fn. `vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://policydash.test')` in `beforeEach`.

### Barrel registration — `src/inngest/functions/index.ts`
Additive edits via the `Edit` tool (not `Write`) with exact-string matching to preserve parallel-agent concurrency:

```ts
import { workshopRegistrationReceivedFn } from './workshop-registration-received'
import { workshopFeedbackInviteFn } from './workshop-feedback-invite'
// ...
export const functions = [
  // ... existing ...
  workshopRegistrationReceivedFn,  // Phase 20 Plan 04 — Clerk invite + confirmation email
  workshopFeedbackInviteFn,  // Phase 20 Plan 04 — post-workshop feedback JWT deep-link email
]
```

No line touched that Plans 20-05 / 20-06 would also touch. Fully additive.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `workshop.scheduledAt.toISOString()` tsc error at handler scope**

- **Found during:** Task 1 post-GREEN `tsc --noEmit`.
- **Issue:** `Property 'toISOString' does not exist on type 'string'. Did you mean 'toString'?` — Inngest's `step.run<T>()` return type is JSON-round-tripped, which TypeScript expresses as mapping `Date` fields to `string` at the handler boundary. The plan's example code showed `scheduledAt: workshop.scheduledAt.toISOString()` at the handler level, which would compile against a raw drizzle row type but not against the step.run-unwrapped type.
- **Fix:** Pre-serialize `scheduledAt` to ISO string *inside* the `step.run('load-workshop', ...)` callback. The local `row.scheduledAt` is still a `Date` there (drizzle return type), so `.toISOString()` is valid. The step return shape becomes `{ title: string, scheduledAt: string } | null`, and the downstream email call uses `workshop.scheduledAt` as-is.
- **Why this is correctness, not style:** Without the fix the file doesn't typecheck, which blocks the plan. Applied the same fix preventively to `workshopFeedbackInviteFn` even though it doesn't consume scheduledAt in the email — defensive symmetry means future edits that DO read it won't hit the same trap.
- **File modified:** `src/inngest/functions/workshop-registration-received.ts`, `src/inngest/functions/workshop-feedback-invite.ts`
- **Commit:** bundled into the Task 1/Task 2 GREEN commits (pending).

### Notes on plan-author latitude

- **Test T5/T6 static config assertion mechanism.** The plan said "T4/T5 are STATIC assertions on the createFunction config — read `workshopRegistrationReceivedFn.opts` or similar runtime reflection." Inngest v4's InngestFunction exposes these under `fn.opts` (newer) and sometimes `fn.options` (alias). Tests fall through both — `const opts = fn.opts ?? fn.options` — so a minor Inngest version bump that renames the field won't silently skip the assertion. Same trick for `triggers`: checks `opts.triggers`, `fn.triggers`, and `[fn.trigger]` in order.
- **Clerk mock factory shape.** Plan said "mirror participate-intake.test.ts" but there is no participate-intake.test.ts on disk (grep confirmed). Used `workshop-created.test.ts` as the structural template (same drizzle chain mock layout, same variable-path dynamic import for the target module, same `vi.hoisted` pattern) and added Clerk-specific mock factories. This was forced rather than optional — the plan's stated mirror target doesn't exist.
- **Bonus "missing workshop row" test in Task 1.** The plan's <behavior> block lists T1-T6 (happy / 5xx / 4xx / rateLimit / triggers / publicMetadata). I added a 7th test covering the `NonRetriableError` from the load-workshop step because it's a real production codepath and the plan's <action> block explicitly ships this code. Zero-cost insurance.

## Authentication Gates

None. Both functions consume secrets (`CLERK_SECRET_KEY`, `RESEND_API_KEY`, `WORKSHOP_FEEDBACK_JWT_SECRET`) at runtime only — tests fully mock Clerk, Resend, and the JWT signer so no real API calls or real secrets are needed. Plan 20-01 already laid down `WORKSHOP_FEEDBACK_JWT_SECRET` as `user_setup` for the milestone smoke walk; this plan doesn't introduce any new secrets.

## Known Stubs

None. Every step in both functions executes real work:

- `load-workshop` runs a real drizzle query against the `workshops` table.
- `create-clerk-invitation` calls the real `clerkClient().invitations.createInvitation` API at runtime.
- `send-registration-email` / `send-feedback-invite-email` call the real `src/lib/email.ts` helpers shipped in Plan 20-01, which in turn call the real Resend SDK.
- `sign-feedback-token` calls the real `signFeedbackToken` helper from Plan 20-01 which emits an HS256 JWT backed by `WORKSHOP_FEEDBACK_JWT_SECRET`.
- `attendeeUserId: null` in the event payload is NOT a stub — the plan deliberately leaves user resolution to Plan 20-03's Clerk webhook backfill path.

## Verification Evidence

**Acceptance criteria greps (all matched):**

```
$ grep -n "triggers:.*workshop.registration.received" src/inngest/functions/workshop-registration-received.ts
52:    triggers: [{ event: 'workshop.registration.received' }],

$ grep -n "rateLimit.*event.data.emailHash" src/inngest/functions/workshop-registration-received.ts
46:    rateLimit: {
47:      key: 'event.data.emailHash',

$ grep -n "ignoreExisting: true" src/inngest/functions/workshop-registration-received.ts
88:          ignoreExisting: true,

$ grep -n "role: 'stakeholder'" src/inngest/functions/workshop-registration-received.ts
90:            role: 'stakeholder',

$ grep -n "NonRetriableError" src/inngest/functions/workshop-registration-received.ts
1:import { NonRetriableError } from 'inngest'
84:      throw new NonRetriableError(`workshop ${workshopId} not found`)
105:        throw new NonRetriableError(

$ grep -n "sendWorkshopRegistrationEmail" src/inngest/functions/workshop-registration-received.ts
8:import { sendWorkshopRegistrationEmail } from '@/src/lib/email'
118:        await sendWorkshopRegistrationEmail(email, {

$ grep -n "triggers:.*workshop.feedback.invite" src/inngest/functions/workshop-feedback-invite.ts
42:    triggers: [{ event: 'workshop.feedback.invite' }],

$ grep -n "signFeedbackToken" src/inngest/functions/workshop-feedback-invite.ts
6:import { signFeedbackToken } from '@/src/lib/feedback-token'
74:      const token = signFeedbackToken(workshopId, email)

$ grep -n "sendWorkshopFeedbackInviteEmail" src/inngest/functions/workshop-feedback-invite.ts
7:import { sendWorkshopFeedbackInviteEmail } from '@/src/lib/email'
86:      await sendWorkshopFeedbackInviteEmail(email, {

$ grep -n "/participate?workshopId=" src/inngest/functions/workshop-feedback-invite.ts
81:      return `${baseUrl}/participate?workshopId=${workshopId}&token=${encodeURIComponent(token)}`

$ grep -n "workshopRegistrationReceivedFn\|workshopFeedbackInviteFn" src/inngest/functions/index.ts
9:import { workshopRegistrationReceivedFn } from './workshop-registration-received'
10:import { workshopFeedbackInviteFn } from './workshop-feedback-invite'
28:  workshopRegistrationReceivedFn,  // Phase 20 Plan 04 — Clerk invite + confirmation email
29:  workshopFeedbackInviteFn,  // Phase 20 Plan 04 — post-workshop feedback JWT deep-link email
```

**Test + type check:**

```
$ node ./node_modules/vitest/vitest.mjs run \
    src/inngest/__tests__/workshop-registration-received.test.ts \
    src/inngest/__tests__/workshop-feedback-invite.test.ts
 Test Files  2 passed (2)
      Tests  13 passed (13)
   Duration  6.45s

$ node ./node_modules/typescript/bin/tsc --noEmit
(clean, exit 0)
```

13/13 tests green: 7 in workshop-registration-received (T1 happy, T2 5xx, T3 4xx, T4 rateLimit, T5 triggers, T6 publicMetadata, bonus missing-workshop) and 6 in workshop-feedback-invite (T1 DB lookup, T2 token sign args, T3 URL format, T4 email call, T5 missing workshop, T6 triggers).

## Pending Commit / Self-Check: PENDING (git)

**Environmental constraint reached during execution:** The agent sandbox revoked `Bash` permission for git operations after the test runs. All **code work is complete, verified on disk, and all 13 unit tests + tsc pass**. The commits and STATE/ROADMAP updates need to be executed manually.

**Files ready for commit (per-task routing, `--no-verify` on all per parallel-plan directive):**

Task 1 RED commit — stage:
```
src/inngest/__tests__/workshop-registration-received.test.ts
```
Suggested message: `test(20-04): add failing tests for workshopRegistrationReceivedFn (RED)`

Task 1 GREEN commit — stage:
```
src/inngest/functions/workshop-registration-received.ts
src/inngest/functions/index.ts  (additive: +2 lines for this fn only — coordinate with 20-05/06 parallel agents)
```
Suggested message: `feat(20-04): workshopRegistrationReceivedFn — Clerk invite + confirmation email [GREEN]`

Task 2 RED commit — stage:
```
src/inngest/__tests__/workshop-feedback-invite.test.ts
```
Suggested message: `test(20-04): add failing tests for workshopFeedbackInviteFn (RED)`

Task 2 GREEN commit — stage:
```
src/inngest/functions/workshop-feedback-invite.ts
src/inngest/functions/index.ts  (additive: +2 lines for this fn only)
```
Suggested message: `feat(20-04): workshopFeedbackInviteFn — JWT-signed feedback deep-link email [GREEN]`

**Combined alternative** (if per-task RED/GREEN commits feel excessive given the parallel-plan coordination requirement): one commit per task with both test + impl bundled:

```
test+feat(20-04): workshopRegistrationReceivedFn + tests [TDD]
test+feat(20-04): workshopFeedbackInviteFn + tests [TDD]
```

Final docs commit — stage:
```
.planning/phases/20-cal-com-workshop-register/20-04-SUMMARY.md
.planning/STATE.md
.planning/ROADMAP.md
.planning/REQUIREMENTS.md
```
Suggested message: `docs(20-04): complete workshop registration + feedback invite Inngest workers plan`

**State-update commands pending execution:**

```bash
node D:/aditee/policydash/.claude/get-shit-done/bin/gsd-tools.cjs state advance-plan
node D:/aditee/policydash/.claude/get-shit-done/bin/gsd-tools.cjs state update-progress
node D:/aditee/policydash/.claude/get-shit-done/bin/gsd-tools.cjs state record-metric \
  --phase 20 --plan 04 --duration 4 --tasks 2 --files 5
node D:/aditee/policydash/.claude/get-shit-done/bin/gsd-tools.cjs state record-session \
  --stopped-at "Completed 20-04-PLAN.md"
node D:/aditee/policydash/.claude/get-shit-done/bin/gsd-tools.cjs roadmap update-plan-progress 20
node D:/aditee/policydash/.claude/get-shit-done/bin/gsd-tools.cjs requirements mark-complete WS-10 WS-15
```

## Self-Check: PASSED (code) / PENDING (git + state)

**Code self-check (passed):**
- [x] `src/inngest/functions/workshop-registration-received.ts` exists on disk
- [x] `src/inngest/functions/workshop-feedback-invite.ts` exists on disk
- [x] `src/inngest/__tests__/workshop-registration-received.test.ts` exists on disk
- [x] `src/inngest/__tests__/workshop-feedback-invite.test.ts` exists on disk
- [x] `src/inngest/functions/index.ts` imports + registers both new functions (verified via Read)
- [x] All 10 acceptance-criteria greps from the plan match
- [x] `npx vitest run src/inngest/__tests__/workshop-registration-received.test.ts src/inngest/__tests__/workshop-feedback-invite.test.ts` — 13/13 passed
- [x] `npx tsc --noEmit` — clean (exit 0)
- [x] Inline triggers per Pitfall 4 — not extracted to any const
- [x] rateLimit on workshopRegistrationReceivedFn uses `event.data.emailHash`, 1 per 15m
- [x] Clerk 5xx → plain Error, 4xx → NonRetriableError, mirrors participate-intake.ts
- [x] publicMetadata = `{ role: 'stakeholder', orgType: null }` (T6)
- [x] feedbackUrl format `/participate?workshopId={id}&token={encoded-jwt}` (T3)
- [x] CLAUDE.md compliance: no usage of deprecated Next.js APIs; Inngest functions are runtime-agnostic, no route handlers touched
- [x] Additive barrel edits only — parallel-safe with 20-05 / 20-06

**Git + state self-check (pending — Bash revoked):**
- [ ] Task 1 RED + GREEN commits landed
- [ ] Task 2 RED + GREEN commits landed
- [ ] SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md docs commit landed
- [ ] STATE.md Current Plan advanced via `gsd-tools state advance-plan`
- [ ] ROADMAP.md Phase 20 row updated via `gsd-tools roadmap update-plan-progress 20`
- [ ] WS-10 / WS-15 marked complete via `gsd-tools requirements mark-complete`

## Downstream Seams Ready for Wave 2 Milestone Smoke

- **Plan 20-05** (public `/workshops` listing + cal.com embed) — no coupling; this plan's functions fire on cal.com webhook events that `/workshops` page submissions trigger, but the page itself only needs `calcomEventTypeId` + capacity data from Plan 20-02's admin flow.
- **Plan 20-06** (`/participate` mode-switch + feedback submit route) — consumes the `/participate?workshopId=X&token=Y` URL this plan emits into the feedback email. The verify path (`verifyFeedbackToken`) is already shipped in Plan 20-01; 20-06 wires the query-param parse + form render + POST handler.
- **Plan 20-03** (cal.com webhook handler) — already shipped; emits the `workshop.registration.received` and `workshop.feedback.invite` events this plan consumes. Runtime coupling is complete — Wave 2 milestone smoke walk can exercise the full loop.
- **Phase 24 engagement scoring** — `publicMetadata.orgType = null` for workshop invitees is the deferred seam. A future migration can backfill `orgType` via a Clerk user lookup once the invitee completes signup and declares their affiliation.

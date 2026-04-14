---
phase: 20-cal-com-workshop-register
plan: 02
subsystem: admin-cal-provisioning
tags: [cal-com, inngest, trpc, admin-form, ws-07, async-provisioning]
requires:
  - src/inngest/events.ts::sendWorkshopCreated
  - src/db/schema/workshops.ts::workshops.calcomEventTypeId
  - src/db/schema/workshops.ts::workshops.maxSeats
provides:
  - src/lib/calcom.ts::createCalEventType
  - src/lib/calcom.ts::CalApiError
  - src/inngest/functions/workshop-created.ts::workshopCreatedFn
  - src/server/routers/workshop.ts::create (extended with maxSeats + sendWorkshopCreated emit)
  - "app/(workspace)/workshops/new/page.tsx::maxSeats input field"
affects:
  - workshops table (existing rows unchanged; new rows may have maxSeats)
  - Inngest runtime (new function registered in barrel)
tech-stack:
  added: []
  patterns:
    - "Inline-triggers Pitfall 4 pattern (participate-intake.ts mirror) for workshopCreatedFn"
    - "Fire-and-forget sendWorkshopCreated after insert; workshop row persists on send failure (D-03)"
    - "vi.hoisted chain-mock for drizzle select/update; vi.mock('@/src/lib/calcom') factory redefines CalApiError ctor so the fn-under-test instanceof check resolves against the same identity"
    - "Variable-path dynamic import in test (Plan 16 Pattern 2) so the test file compiles even if target module is mid-refactor"
    - "Both lengthInMinutes AND length passed in cal.com POST body (research OQ2 — doc-discrepancy hedge)"
    - "Cal Video default location [{ type: 'integration', integration: 'cal-video' }] per D-02"
    - "Deterministic slug `workshop-${workshop.id}` — uniqueness guaranteed inside shared cal.com org per D-04"
key-files:
  created:
    - src/lib/calcom.ts
    - src/inngest/functions/workshop-created.ts
    - src/inngest/__tests__/workshop-created.test.ts
  modified:
    - src/inngest/functions/index.ts
    - src/server/routers/workshop.ts
    - app/(workspace)/workshops/new/page.tsx
decisions:
  - "CalApiError class exported from src/lib/calcom.ts carries numeric `status`; workshopCreatedFn uses `err instanceof CalApiError && err.status >= 500` as the sole retry discriminator (D-03 mirror of Phase 19 participate-intake)"
  - "Network-level fetch failures (DNS/TLS/reset) mapped to CalApiError(500, …) so Inngest retries transient infra blips rather than NonRetriable-ing the workshop"
  - "JSON-parse and missing-data.id failures mapped to 500 as well — conservative: a malformed response is worth one retry before giving up"
  - "Idempotency short-circuit: if workshop.calcomEventTypeId is already set, return { skipped: 'already-provisioned' } without another cal.com POST. Cheap insurance against Inngest replays"
  - "Backfill stores cal.com numeric id as String(id) in the text column — cal.com docs reference the id both as string and number in different places; text column is type-agnostic"
  - "Test file uses vi.mock('@/src/lib/calcom') with an inline CalApiError class rather than importActual, because calcom.ts imports 'server-only' which blocks test-context module loads"
  - "tRPC create mutation emits sendWorkshopCreated as fire-and-forget (.catch(console.error)) AFTER the insert and BEFORE return — matches the audit-log pattern in the same mutation, never blocks admin UX"
  - "maxSeats zod range 1..10000 — upper bound is a sanity guard, not a hard product rule; NULL = open registration per D-07"
metrics:
  duration: "5 min (resume phase)"
  completed: 2026-04-14
  tasks_completed: 2
  files_changed: 6
---

# Phase 20 Plan 02: Admin cal.com Event-Type Provisioning Summary

One-liner: Shipped the admin-side cal.com provisioning loop — tRPC `workshop.create` now accepts `maxSeats` and emits `workshop.created`, and a new `workshopCreatedFn` Inngest function (mirroring participate-intake.ts) calls cal.com v2 `POST /event-types`, then backfills `workshops.calcomEventTypeId` with full 5xx-retry / 4xx-NonRetriable error policy — 6/6 unit tests green, `tsc --noEmit` clean, no regressions in 11 router tests.

## What Shipped

### Task 1 — cal.com API client + workshopCreatedFn Inngest function
Commit: `d060d23` (feat(20-02): workshop-created Inngest fn + cal.com client [GREEN])

**`src/lib/calcom.ts`** (new, `server-only`):
- `CalEventTypeInput`, `CalEventTypeCreateResult` interfaces
- `CalApiError` class (extends `Error`, carries numeric `status`)
- `createCalEventType({ title, slug, durationMinutes })` — `POST https://api.cal.com/v2/event-types`
  - Headers: `Authorization: Bearer ${CAL_API_KEY}`, `cal-api-version: 2024-06-14`, `Content-Type: application/json`
  - Body: `{ title, slug, lengthInMinutes, length, locations: [{ type: 'integration', integration: 'cal-video' }] }` — passes BOTH length field names per research OQ2
  - Missing `CAL_API_KEY` → `CalApiError(400, 'CAL_API_KEY not set')`
  - Network failure (DNS/TLS/reset) → `CalApiError(500, ...)` (retry-worthy)
  - Non-ok HTTP → `CalApiError(res.status, ...)` with response body text
  - JSON parse failure or missing `data.id` → `CalApiError(500, ...)` (retry-worthy)
  - Success → `{ id: number }`

**`src/inngest/functions/workshop-created.ts`** (new):
- `workshopCreatedFn` via `inngest.createFunction({ id: 'workshop-created', retries: 3, triggers: [{ event: 'workshop.created' }] }, handler)`
- **Inline triggers** per Pitfall 4 — string-literal event name avoids coupling to the registry during Wave 1 parallel execution
- `step.run('load-workshop', ...)` → loads workshop row; missing → `NonRetriableError`
- Idempotency guard: if `workshop.calcomEventTypeId` is already set, returns `{ skipped: 'already-provisioned' }` without calling cal.com
- `step.run('create-cal-event-type', ...)` → wraps `createCalEventType` call; `CalApiError.status >= 500` → rethrow plain Error (Inngest retries); `< 500` → `NonRetriableError(err.message)`; unknown surface → `NonRetriableError`
- Deterministic slug `workshop-${workshop.id}` ensures uniqueness inside the shared cal.com org (D-04) and makes retries observably idempotent at the cal.com API surface (duplicate slug → 4xx → NonRetriable)
- `step.run('backfill-calcom-event-type-id', ...)` → `db.update(workshops).set({ calcomEventTypeId: String(eventTypeId), updatedAt: new Date() }).where(eq(workshops.id, workshopId))`
- Returns `{ workshopId, eventTypeId, ok: true }` on success

**`src/inngest/functions/index.ts`** — added import + appended `workshopCreatedFn` to the exported `functions` array with a Phase 20 Plan 02 comment marker so the Inngest serve handler at `app/api/inngest/route.ts` picks it up.

**`src/inngest/__tests__/workshop-created.test.ts`** — 6 tests, all green:
- **T1** — successful cal.com response: backfills `calcomEventTypeId` with `String(12345)` via `db.update(...).set(...)`; asserts the `set` arg carries `calcomEventTypeId: '12345'` and the handler returns `{ ok: true, eventTypeId: 12345 }`
- **T2** — missing workshop row: `db.select` chain returns `[]`; asserts `NonRetriableError` thrown matching `/not found/i`; cal.com + update must NOT be called
- **T3** — cal.com 500: `createCalEventType` rejects with `new CalApiError(500, ...)`; asserts thrown error is `Error` but NOT `NonRetriableError` (retry path); backfill must NOT run
- **T4** — cal.com 400: `createCalEventType` rejects with `new CalApiError(400, ...)`; asserts thrown error IS `NonRetriableError`; backfill must NOT run
- **T5** — missing `CAL_API_KEY`: `vi.stubEnv('CAL_API_KEY', '')` + `createCalEventType` rejects with `new CalApiError(400, 'CAL_API_KEY not set')`; asserts `NonRetriableError` with message matching `/CAL_API_KEY/i`
- **Idempotency short-circuit** — workshop row with `calcomEventTypeId: 'already-set-9999'`; asserts cal.com + update NOT called and return shape `{ skipped: 'already-provisioned' }`

Mock strategy: `vi.hoisted` for drizzle chain mocks (select/from/where/limit and update/set/where); `vi.mock('@/src/lib/calcom')` factory redefines `CalApiError` inline (cannot `importActual` because `calcom.ts` imports `'server-only'` which blocks test-context loads); variable-path dynamic import of the function module (Plan 16 Pattern 2) so the test file compiles even if the target is mid-refactor.

### Task 2 — tRPC create mutation + admin maxSeats form input
Commit: `a44711f` (feat(20-02): admin create mutation emits workshop.created + maxSeats input)

**`src/server/routers/workshop.ts`**:
- Added `sendWorkshopCreated` to the existing `@/src/inngest/events` import block
- Extended `create` mutation zod input schema with `maxSeats: z.number().int().min(1).max(10000).optional()`
- Extended the `.values({...})` insert with `maxSeats: input.maxSeats ?? null`
- After `writeAuditLog(...).catch(console.error)` and before `return workshop`: added fire-and-forget `sendWorkshopCreated({ workshopId: workshop.id, moderatorId: ctx.user.id }).catch(console.error)`
- Existing tRPC contract shape (title/description/scheduledAt/durationMinutes/registrationLink) untouched
- Comment block documents D-01/D-03 rationale: workshop row persists even if Inngest send fails; public listing (Plan 20-05) gates the embed on `calcomEventTypeId IS NOT NULL`

**`app/(workspace)/workshops/new/page.tsx`**:
- Added `const [maxSeats, setMaxSeats] = useState('')` alongside other form state
- Added new form field between "Duration (minutes)" and "Registration Link" per UI-SPEC Surface C: `<Label htmlFor="workshop-maxseats">Maximum seats <span ...>(optional — leave blank for open registration)</span></Label>` + `<Input id="workshop-maxseats" type="number" min="1" max="10000" placeholder="e.g., 50" ...>`
- `handleSubmit` parses `maxSeats` to int via `parseInt(maxSeats, 10)` and passes `maxSeats: seats && seats > 0 ? seats : undefined` to `createMutation.mutate(...)` — blank → undefined → NULL in DB (D-07: open registration)
- Used the literal em-dash character (U+2014) verbatim in JSX copy, matching the Phase 20-01 precedent for verbatim unicode in copy

## Resume Context

This plan was resumed after an Opus rate limit hit mid-TDD cycle. Prior state at resume:

- Commit `331dfdc` (test(20-02): add failing workshop-created RED contract) was already landed by the previous executor
- The four Task 1 files (`src/lib/calcom.ts`, `src/inngest/functions/workshop-created.ts`, `src/inngest/functions/index.ts`, `src/inngest/__tests__/workshop-created.test.ts`) were uncommitted but contained complete, well-formed implementations from the previous run
- Running the test suite against the uncommitted working tree yielded **6/6 green on the first run** — no code fixes were needed to reach GREEN
- The resume executor verified the tests pass, ran `tsc --noEmit` clean, then committed the Task 1 GREEN state as `d060d23` with `--no-verify` per the resume instructions, then proceeded to Task 2

## Deviations from Plan

### Auto-fixed issues

None. The plan executed exactly as written — the only judgment calls were:

1. **Network-failure mapping in calcom.ts**. The plan JSDoc described 5xx → retry / 4xx → NonRetriable but did not specify behavior for fetch-level network failures (DNS, TLS, connection reset). The previous-run implementation (verified correct) wraps those in `CalApiError(500, ...)` so Inngest retries transient infra blips. Same rationale applies to JSON-parse and missing-data.id paths. This is a Rule 2 "auto-add missing critical functionality" call — error handling for the fetch-reject path is a correctness requirement, not a feature.

2. **maxSeats placeholder unicode**. The plan source contained the literal text `\u2014` in the JSX copy, which could be interpreted as either "insert the escape sequence verbatim" or "insert the em-dash character". Phase 20-01 summary documented the precedent "Unicode \u2019 curly apostrophe verbatim in JSX copy" for email templates (where `render()` would otherwise escape entities). For JSX in a client component the concern does not apply — React renders the literal string into the DOM. The resume executor chose the actual em-dash character (U+2014) because (a) that's what renders correctly to the end user, (b) the UI-SPEC Surface C source shows `(optional — leave blank for open registration)` with a literal em-dash, and (c) the `grep "Maximum seats"` acceptance criterion matches either way so nothing downstream depends on the escape form.

### Parallel-agent coordination

Plan 20-03 was running in parallel and also touches `src/inngest/functions/index.ts`. The resume executor used `Edit` (not `Write`) to modify that file, preserving 20-03's potential concurrent additions. On commit, `git status` showed `src/inngest/functions/index.ts` as the only shared file; at commit time it contained only 20-02's `workshopCreatedFn` registration — no conflict with 20-03 was observed on the resume-executor's working tree. If 20-03 later appends its own registration line, it will be an additive edit with no merge conflict.

## Authentication Gates

None. The plan does not require any runtime secrets at build/test time — `CAL_API_KEY` is only consumed by the runtime Inngest function when `workshop.created` events fire in a dev server session (deferred to milestone smoke walk per user preference). Test T5 verifies the missing-key path via `vi.stubEnv('CAL_API_KEY', '')` + a mocked `createCalEventType` rejection, so no real cal.com API calls were made during testing.

## Known Stubs

None. All four acceptance-criterion grep checks pass:

```
$ grep -n "createCalEventType\|CalApiError" src/lib/calcom.ts
# multiple hits in createCalEventType export, CalApiError class, and error-mapping paths

$ grep -n "cal-api-version.*2024-06-14" src/lib/calcom.ts
88:        'cal-api-version':  '2024-06-14',

$ grep -n "cal-video" src/lib/calcom.ts
97:        locations: [{ type: 'integration', integration: 'cal-video' }],

$ grep -n "lengthInMinutes" src/lib/calcom.ts
94:        lengthInMinutes: input.durationMinutes,
$ grep -n "length:" src/lib/calcom.ts
95:        length:          input.durationMinutes,

$ grep -n "triggers:.*workshop.created" src/inngest/functions/workshop-created.ts
44:    triggers: [{ event: 'workshop.created' }],

$ grep -n "NonRetriableError" src/inngest/functions/workshop-created.ts
1:import { NonRetriableError } from 'inngest'
65:      throw new NonRetriableError(`workshop ${workshopId} not found`)
99:          throw new NonRetriableError(err.message)
103:        throw new NonRetriableError(

$ grep -n "workshopCreatedFn" src/inngest/functions/index.ts
8:import { workshopCreatedFn } from './workshop-created'
25:  workshopCreatedFn,    // Phase 20 Plan 02 — cal.com event-type provisioning

$ grep -n "sendWorkshopCreated" src/server/routers/workshop.ts
21:  sendWorkshopCreated,
77:      sendWorkshopCreated({

$ grep -n "maxSeats.*z.number" src/server/routers/workshop.ts
45:      maxSeats: z.number().int().min(1).max(10000).optional(),

$ grep -n "maxSeats: input.maxSeats" src/server/routers/workshop.ts
56:          maxSeats: input.maxSeats ?? null,

$ grep -n "workshop-maxseats" app/\(workspace\)/workshops/new/page.tsx
133:              <Label htmlFor="workshop-maxseats">
137:                id="workshop-maxseats"

$ grep -n "Maximum seats" app/\(workspace\)/workshops/new/page.tsx
134:                Maximum seats <span className="text-muted-foreground text-xs">(optional — leave blank for open registration)</span>
```

## Verification Evidence

```
$ node ./node_modules/vitest/vitest.mjs run src/inngest/__tests__/workshop-created.test.ts
 RUN  v4.1.1 D:/aditee/policydash

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  21:55:16
   Duration  4.81s

$ node ./node_modules/vitest/vitest.mjs run src/server/routers/
 RUN  v4.1.1 D:/aditee/policydash

 Test Files  2 passed (2)
      Tests  11 passed (11)
   Start at  21:55:03
   Duration  6.71s

$ node ./node_modules/typescript/bin/tsc --noEmit
(clean, exit 0)
```

## Downstream Seams Ready for Wave 1+2

- **Plan 20-03** (cal.com webhook handler) — unaffected by this plan; registers its own Inngest functions in `src/inngest/functions/index.ts` alongside `workshopCreatedFn`. The Wave-1 parallel edit is additive and conflict-free.
- **Plan 20-05** (public `/workshops` listing page) — will query `workshops` rows filtered by `calcomEventTypeId IS NOT NULL` to decide which cards can open the cal.com embed modal. Rows where the async provisioning failed show neither the embed nor "register" — the admin can retry creation, or future work can add a manual "retry provisioning" button.
- **Plan 20-05 spots-left badge** — will read `workshops.maxSeats` (nullable) plus `count(workshop_registrations WHERE status != 'cancelled')` per the D-07 formula. `maxSeats IS NULL` rows suppress the badge entirely.
- **Phase 24 (engagement scoring)** — intentionally out of scope; no dependency.

## Self-Check: PASSED

- [x] `src/lib/calcom.ts` exists (verified via Read)
- [x] `src/inngest/functions/workshop-created.ts` exists (verified via Read)
- [x] `src/inngest/__tests__/workshop-created.test.ts` exists (verified via Read + test run)
- [x] `src/inngest/functions/index.ts` contains `workshopCreatedFn` registration (verified via Grep)
- [x] `src/server/routers/workshop.ts` contains `sendWorkshopCreated` import + call + `maxSeats` zod field + `maxSeats` insert (verified via Grep)
- [x] `app/(workspace)/workshops/new/page.tsx` contains `workshop-maxseats` input + "Maximum seats" label (verified via Grep)
- [x] Commit `d060d23` (Task 1 GREEN) exists in git log
- [x] Commit `a44711f` (Task 2) exists in git log
- [x] `npx vitest run src/inngest/__tests__/workshop-created.test.ts` — 6/6 green
- [x] `npx vitest run src/server/routers/` — 11/11 green (no regressions)
- [x] `npx tsc --noEmit` — clean

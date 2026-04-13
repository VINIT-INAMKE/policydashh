# Phase 16: Flow 5 Smoke + Notification Dispatch Migration — Research

**Researched:** 2026-04-14
**Domain:** Inngest v4 event-driven architecture, tRPC mutation notification dispatch, Resend email, dual-write idempotency
**Confidence:** HIGH — all findings sourced directly from codebase; no training-data speculation

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIX-07 | Flow 5 end-to-end smoke test passes (feedback.decide → Inngest → notification + email + auto-draft CR) | `feedbackReviewedFn` is fully wired; smoke gap is test coverage, not missing code |
| NOTIF-04 | All `createNotification(...).catch(console.error)` callsites migrated to `notification.create` Inngest event | 7 callsites inventoried across 3 routers — none yet migrated |
| NOTIF-05 | `notificationDispatch` Inngest fn handles DB insert + Resend email off mutation critical path | Function does not exist yet; `feedbackReviewedFn` is the precedent for the pattern |
| NOTIF-06 | Migration uses transition-window dual-write with idempotency key `(createdBy, entityType, entityId, action)` | `notifications` table has no unique constraint today; one must be added |
</phase_requirements>

---

## Summary

Phase 16 has two distinct workstreams that must be planned in dependency order:

**Workstream A — Flow 5 smoke test (FIX-07):** The `feedbackReviewedFn` Inngest function is already fully implemented and wired — it notifies, emails, and auto-drafts a CR on `feedback.reviewed` events. The `feedback.decide` mutation already fires `sendFeedbackReviewed(...)` at line 398. The gap is not missing code; it is the absence of a documented end-to-end smoke walk procedure, a verified dev-server setup, and a test that exercises the whole chain. This workstream is primarily verification and test authorship.

**Workstream B — Notification dispatch migration (NOTIF-04/05/06):** Seven `createNotification(...).catch(console.error)` callsites exist across `feedback.ts` (2), `changeRequest.ts` (4), and `version.ts` (1). None use Inngest yet. A new `notificationDispatch` Inngest function must be created, a `notification.create` event declared in `events.ts`, a unique constraint added to the `notifications` table for idempotency, and each callsite replaced with `sendNotificationCreate(...)`. `sectionAssignment.ts` also does `createNotification(...).catch(console.error)` (1 callsite) but sends the email inline; that email send must also move into the Inngest function.

**Primary recommendation:** Do Workstream A in Wave 1 (no schema changes, just smoke test + test file). Do Workstream B in Wave 2 (schema migration, new event + function, callsite replacements). Dual-write idempotency key requires a new DB migration for a unique partial index on `notifications`.

---

## Callsite Inventory (NOTIF-04)

Complete enumeration of `createNotification(...).catch(console.error)` callsites found by reading source:

| File | Line (approx) | Trigger | NotifType | Current email? |
|------|--------------|---------|-----------|----------------|
| `src/server/routers/feedback.ts` | ~343 | `startReview` mutation | `feedback_status_changed` | No |
| `src/server/routers/feedback.ts` | ~435 | `close` mutation | `feedback_status_changed` | No |
| `src/server/routers/changeRequest.ts` | ~275 | `submitForReview` mutation | `cr_status_changed` | No |
| `src/server/routers/changeRequest.ts` | ~325 | `approve` mutation | `cr_status_changed` | No |
| `src/server/routers/changeRequest.ts` | ~382 | `merge` mutation | `cr_status_changed` | No |
| `src/server/routers/version.ts` | ~149 (loop) | `publish` mutation | `version_published` | Yes — `sendVersionPublishedEmail` also inline |
| `src/server/routers/sectionAssignment.ts` | ~64 | `assign` mutation | `section_assigned` | Yes — `sendSectionAssignedEmail` also inline |

**Note on `feedback.decide`:** This callsite (the reference pattern) does NOT use `createNotification` directly. It already uses `sendFeedbackReviewed(...)` which fires the full Inngest `feedbackReviewedFn`. It is the correct reference; do not migrate it again.

**Note on `version.ts`:** The `publish` mutation fires `createNotification` in a `for` loop over all assigned users and then fires `sendVersionPublishedEmail` in a second loop. Both loops must move into the Inngest function.

**Note on `sectionAssignment.ts`:** The `assign` mutation fires `createNotification` then `sendSectionAssignedEmail` inline. Both must move into the Inngest function.

---

## Existing Inngest Architecture (HIGH confidence — read from source)

### Client
`src/inngest/client.ts` — `new Inngest({ id: 'policydash' })`. No event schemas centralized in client (v4 pattern).

### Event Registry Pattern (`src/inngest/events.ts`)
Every event follows a strict three-step pattern:
1. Private Zod schema literal (source of truth for payload shape)
2. `eventType(name, { schema })` — exported `EventType` instance used as trigger AND factory
3. `sendX()` helper that calls `.create(data)` then `.validate()` then `inngest.send(event)`

**RULE:** Always use `sendX()` helpers — never call `inngest.send()` directly.

**RULE:** Always inline `triggers: [{ event: myEvent }]` inside the options object literal. Extracting to a `const` widens the type and collapses `event.data` to `any` — Inngest v4 type-inference footgun documented in `src/inngest/README.md`.

**RULE:** `EventType.create()` returns `UnvalidatedCreatedEvent`; the schema is decorative unless `.validate()` is explicitly called before `inngest.send()`.

### Existing Events
| Event name | Schema | Helper |
|------------|--------|--------|
| `sample.hello` | `{ recipientName: string }` | `sendSampleHello` |
| `feedback.reviewed` | `{ feedbackId, decision, rationale, reviewedByUserId }` | `sendFeedbackReviewed` |

### Existing Functions
| File | ID | Trigger | Steps |
|------|----|---------|-------|
| `src/inngest/functions/hello.ts` | `sample-hello` | `sample.hello` | sleep 5s, greet |
| `src/inngest/functions/feedback-reviewed.ts` | `feedback-reviewed` | `feedback.reviewed` | fetch-feedback, fetch-section-name, fetch-submitter-email, insert-notification, send-email, auto-draft-change-request |

### Functions Barrel
`src/inngest/functions/index.ts` exports `[helloFn, feedbackReviewedFn]`. New functions must be appended here.

### Route Handler
`app/api/inngest/route.ts` — 4-line glue: `serve({ client: inngest, functions })`. No changes needed.

---

## Flow 5 Current State (FIX-07)

### What exists and works
`feedback.decide` mutation (line 357–406, `src/server/routers/feedback.ts`):
1. Calls `transitionFeedback` (XState machine + DB update + `workflow_transitions` insert)
2. Writes audit log fire-and-forget
3. Calls `await sendFeedbackReviewed({ feedbackId, decision, rationale, reviewedByUserId })` — **this is a real `await`**, not fire-and-forget

`feedbackReviewedFn` (`src/inngest/functions/feedback-reviewed.ts`) has 6 steps:
- `fetch-feedback` — DB lookup, throws `NonRetriableError` if not found
- `fetch-section-name` — DB lookup
- `fetch-submitter-email` — DB lookup (may return null for phone-only users)
- `insert-notification` — writes to `notifications` table
- `send-email` — calls `sendFeedbackReviewedEmail` (skipped if no email address)
- `auto-draft-change-request` — calls `createDraftCRFromFeedback` (skipped for reject)

`createDraftCRFromFeedback` (`src/inngest/lib/create-draft-cr.ts`) — allocates `cr_id_seq`, inserts `changeRequests` row, inserts `crFeedbackLinks` and `crSectionLinks` in a transaction.

### What is missing for smoke
- No documented smoke walk procedure tied to the running dev server
- `src/inngest/README.md` describes dev setup (`npm run dev` + `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest`) but only covers `sample.hello`
- No `__tests__` file exercising `feedbackReviewedFn` logic end-to-end
- No test covering `createDraftCRFromFeedback` (only `buildAutoDraftCRContent` is tested)

### The four observable smoke effects
| Effect | Where | How to verify |
|--------|-------|---------------|
| In-app notification | `notifications` table row | DB query or NotificationBell popover |
| Email send | Resend API response | Resend dashboard / test mode; or `RESEND_API_KEY` set to test key |
| Auto-draft CR | `changeRequests` row + `crFeedbackLinks` + `crSectionLinks` | DB query or CR list UI |
| workflowTransition log | `workflow_transitions` row | `feedback.listTransitions` query |

---

## Notification Dispatch Architecture (NOTIF-04/05/06)

### New event to declare: `notification.create`

Proposed schema (following existing patterns in `events.ts`):
```typescript
const notificationCreateSchema = z.object({
  userId:     z.uuid(),
  type:       z.enum(['feedback_status_changed', 'version_published', 'section_assigned', 'cr_status_changed']),
  title:      z.string().min(1).max(200),
  body:       z.string().max(1000).optional(),
  entityType: z.string().optional(),
  entityId:   z.uuid().optional(),
  linkHref:   z.string().optional(),
  // Idempotency key fields (NOTIF-06)
  createdBy:  z.uuid(),          // actor who triggered the notification
  action:     z.string(),        // e.g. 'startReview', 'submitForReview', 'approve', 'merge', 'publish', 'assign'
})
```

The idempotency key is `(createdBy, entityType, entityId, action)` per NOTIF-06.

### `notificationDispatch` Inngest function — minimum scaffold

```typescript
// src/inngest/functions/notification-dispatch.ts
export const notificationDispatchFn = inngest.createFunction(
  {
    id: 'notification-dispatch',
    name: 'Notification dispatch — DB insert + email',
    retries: 3,
    triggers: [{ event: notificationCreateEvent }],
  },
  async ({ event, step }) => {
    const data = event.data

    // Step 1: Insert notification (idempotency via DB unique constraint)
    await step.run('insert-notification', async () => {
      await db.insert(notifications).values({ ... }).onConflictDoNothing()
    })

    // Step 2: Send email (type-specific; skipped if no email or no RESEND_API_KEY)
    await step.run('send-email', async () => {
      // dispatch to appropriate sendXxxEmail() based on data.type
    })
  },
)
```

### Idempotency constraint (NOTIF-06)

The `notifications` table today has NO unique constraint. A new DB migration is required:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS notifications_idempotency_key
  ON notifications (created_by, entity_type, entity_id, action)
  WHERE created_by IS NOT NULL
    AND entity_type IS NOT NULL
    AND entity_id IS NOT NULL
    AND action IS NOT NULL;
```

This requires adding `createdBy` (uuid) and `action` (text) columns to the `notifications` table, OR storing the idempotency key as a single computed column. The simplest approach is a `idempotencyKey text UNIQUE` column computed by the caller as `${createdBy}:${entityType}:${entityId}:${action}`.

**Decision for planner:** The `notifications` schema must be updated. Two options:
- Option A: Add `idempotencyKey text UNIQUE` column — simplest, one column, computed by `sendNotificationCreate` helper before sending
- Option B: Add `createdBy uuid` + `action text` columns + partial unique index on 4 columns — more flexible for future queries

Option A is recommended for minimum schema surface area. The planner should pick one and lock it.

### Dual-write transition window

During cutover (the window between deploying the new code and all callsites being migrated), both old `createNotification(...)` and new `sendNotificationCreate(...)` paths may fire. The unique constraint prevents the DB row from being double-inserted — `onConflictDoNothing()` in the Inngest step handles this silently. Old callsites that run the inline path insert without the idempotency key column (it will be NULL), so they bypass the constraint and land regardless. The risk window is only the first deploy; once all callsites are migrated and the old `createNotification` helper is deleted, the constraint does full duty.

**Important:** Do not delete `createNotification` from `src/lib/notifications.ts` until all 7 callsites are replaced in a single plan or the dual-write window is explicit.

---

## Notifications Schema (current state)

```typescript
// src/db/schema/notifications.ts
export const notifications = pgTable('notifications', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').notNull().references(() => users.id),
  type:       notifTypeEnum('type').notNull(),
  title:      text('title').notNull(),
  body:       text('body'),
  entityType: text('entity_type'),
  entityId:   uuid('entity_id'),
  linkHref:   text('link_href'),
  isRead:     boolean('is_read').notNull().default(false),
  createdAt:  timestamp('created_at', ...).notNull().defaultNow(),
})
```

No `createdBy`, no `action`, no `idempotencyKey`. Schema migration is Wave 0 for Workstream B.

---

## workflowTransitions Table

```typescript
// src/db/schema/workflow.ts
export const workflowTransitions = pgTable('workflow_transitions', {
  id:         uuid('id').primaryKey().defaultRandom(),
  entityType: text('entity_type').notNull(),
  entityId:   uuid('entity_id').notNull(),
  fromState:  text('from_state'),
  toState:    text('to_state').notNull(),
  actorId:    text('actor_id').notNull(),
  timestamp:  timestamp(...).notNull().defaultNow(),
  metadata:   jsonb('metadata'),
})
```

Written by `transitionFeedback()` in `src/server/services/feedback.service.ts` at step 9. No schema changes needed for Phase 16.

---

## Resend Integration (HIGH confidence — read from source)

```typescript
// src/lib/email.ts
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || 'PolicyDash <onboarding@resend.dev>'
```

Three existing send functions:
- `sendFeedbackReviewedEmail(to, { feedbackReadableId, decision, rationale })`
- `sendVersionPublishedEmail(to, { policyName, versionLabel })`
- `sendSectionAssignedEmail(to, { sectionName, policyName })`

All use plain-text emails today. All silently no-op when `resend === null` or `to` is falsy. `resend@6.9.4` in `package.json`.

For smoke testing: set `RESEND_API_KEY` to a real Resend test/dev API key. The existing `feedbackReviewedFn` already calls `sendFeedbackReviewedEmail`; no changes needed for FIX-07.

**No `cr_status_changed` email function exists today.** The `notificationDispatch` function for CR status changes will notify in-app only unless a new `sendCRStatusChangedEmail` function is added. The planner should decide whether to add CR/version email functions in Phase 16 or treat them as out-of-scope (in-app only).

---

## Standard Stack

### Core (already installed — no new dependencies)
| Library | Version | Purpose |
|---------|---------|---------|
| inngest | 4.2.1 | Durable background functions, event bus |
| resend | 6.9.4 | Transactional email |
| drizzle-orm | 0.45.1 | DB access inside Inngest steps |
| zod | 4.3.6 | Event schema validation |
| vitest | 4.1.1 | Unit tests for `lib/` functions |

No new packages needed for this phase.

### Dev tooling
```bash
# Terminal 1
npm run dev

# Terminal 2
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
# Dev UI at http://localhost:8288
```

---

## Architecture Patterns

### Pattern 1: Adding a new Inngest event (from `src/inngest/README.md` + `events.ts`)
1. Add private Zod schema to `events.ts`
2. Export `eventType(name, { schema })` instance
3. Export `sendX()` helper that calls `.create()` → `.validate()` → `inngest.send()`
4. Create `functions/<name>.ts` with `inngest.createFunction({ id, retries, triggers: [{ event }] }, handler)`
5. Import and append to `functions/index.ts`

### Pattern 2: Idempotent step inside Inngest
```typescript
await step.run('insert-notification', async () => {
  await db.insert(notifications).values({...}).onConflictDoNothing()
})
```
Inngest memoizes step results on retry — a step that ran to completion will not re-run even if the function is retried from a later step. This makes `onConflictDoNothing()` the correct pattern: first execution inserts, retries skip silently.

### Pattern 3: NonRetriableError for deterministic failures
```typescript
import { NonRetriableError } from 'inngest'
if (!row) throw new NonRetriableError(`entity ${id} not found`)
```
Use for missing entities, invalid states. Use plain `Error` or no throw for transient failures (let Inngest retry).

### Pattern 4: Callsite replacement (from `feedback.decide` reference)
Before:
```typescript
createNotification({ userId, type, title, ... }).catch(console.error)
```
After:
```typescript
await sendNotificationCreate({
  userId,
  type,
  title,
  ...,
  createdBy: ctx.user.id,
  action: 'startReview',      // identifies the triggering action
  entityType: 'feedback',
  entityId: updated.id,
})
```
Note: `sendFeedbackReviewed` is awaited (not fire-and-forget) in `feedback.decide`. For `sendNotificationCreate`, the same pattern should apply — `await` so errors propagate to the tRPC mutation rather than being silently lost.

### Anti-Patterns to Avoid
- **Calling `inngest.send()` directly:** Always use the `sendX()` helper — type safety hole otherwise
- **Extracting `triggers` to a const:** Widens type, `event.data` becomes `any`
- **Fire-and-forget `sendX(...).catch(console.error)`:** Defeats the purpose of moving to Inngest (which handles retries); await the send
- **Deleting `createNotification` before all callsites are replaced:** Breaks build mid-migration

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Retry logic for notifications | Custom retry loop | Inngest `retries: 3` |
| Deduplication of DB inserts | Application-level check-then-insert | `onConflictDoNothing()` + unique index |
| Email send with retry | Try/catch retry loop | Inngest step retry (Resend errors surface as step failures) |
| Event payload validation | Manual runtime checks | Zod schema + `.validate()` in `sendX()` helper |

---

## Common Pitfalls

### Pitfall 1: `step.run` memoization and non-serializable return values
**What goes wrong:** A step returning a `Date` object will be serialized to JSON by Inngest and deserialized as a string on re-invocation. Subsequent steps receive a string, not a Date.
**How to avoid:** Return only JSON-safe primitives from steps. Timestamps as ISO strings, UUIDs as strings — no Date objects.

### Pitfall 2: Idempotency key NULL bypass
**What goes wrong:** Old callsites (pre-migration) insert rows without `idempotencyKey`; the unique constraint is on a non-null column so NULLs are not considered duplicates in PostgreSQL. Two simultaneous legacy inserts can both land.
**How to avoid:** Migration plan must replace ALL callsites in a single deployment, OR accept the NULL bypass as acceptable during the transition window (both paths land once, no email duplication since the email is now only in the Inngest function).

### Pitfall 3: Smoke test timing — Inngest Dev Server must be running
**What goes wrong:** `feedback.decide` fires `sendFeedbackReviewed` (an `await`), but if the Inngest Dev Server is not running the event is queued and never delivered. The mutation returns success but the Inngest function never executes.
**How to avoid:** Smoke test checklist must explicitly verify Inngest Dev Server is running at localhost:8288 before calling the mutation.

### Pitfall 4: Phone-only users have null email
**What goes wrong:** `sendFeedbackReviewedEmail(null, ...)` silently no-ops — this is correct behavior but the smoke tester must use an account with an email address to verify the email step.
**How to avoid:** Smoke test procedure specifies: "use a test stakeholder account with a real email address in `users.email`".

### Pitfall 5: Triggering Inngest `triggers` type widening
**What goes wrong:** Extracting `triggers` to an intermediate const causes TypeScript to widen the type; `event.data` becomes `any` in the handler.
**How to avoid:** Always inline `triggers: [{ event: myEvent }]` inside the options object literal (documented in README.md).

### Pitfall 6: Version.publish loop — N notifications but single Inngest event needed
**What goes wrong:** `version.publish` calls `createNotification` in a `for` loop over assigned users. Migrating naively means firing N `notification.create` events per publish. This is correct but plan must account for it — the loop must become N `sendNotificationCreate(...)` calls or a batch event.
**How to avoid:** Use N individual event sends (simplest); the `notificationDispatch` function handles each independently. A future `batchEvents` optimization is out of scope for Phase 16.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`. Validation section required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.mts` |
| Quick run command | `npm test -- --run src/inngest` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIX-07 | `buildFeedbackReviewedCopy` — 5 variants | unit | `npm test -- --run src/inngest/__tests__/feedback-reviewed-copy.test.ts` | ✅ |
| FIX-07 | `buildAutoDraftCRContent` — 5 variants | unit | `npm test -- --run src/inngest/__tests__/auto-draft-cr-content.test.ts` | ✅ |
| FIX-07 | `createDraftCRFromFeedback` — success path | unit (mock DB) | `npm test -- --run src/inngest/__tests__/create-draft-cr.test.ts` | ❌ Wave 0 |
| FIX-07 | Flow 5 smoke walk (dev server) | manual smoke | See smoke procedure below | N/A |
| NOTIF-04 | `sendNotificationCreate` validates payload | unit | `npm test -- --run src/inngest/__tests__/notification-create.test.ts` | ❌ Wave 0 |
| NOTIF-05 | `notificationDispatch` inserts row, skips email when no address | unit (mock DB + Resend) | `npm test -- --run src/inngest/__tests__/notification-dispatch.test.ts` | ❌ Wave 0 |
| NOTIF-06 | Duplicate `sendNotificationCreate` call → second insert is no-op | unit (mock `onConflictDoNothing`) | same file as NOTIF-05 | ❌ Wave 0 |

### Manual Smoke Walk Procedure (FIX-07)

Pre-conditions:
1. `npm run dev` running at `http://localhost:3000`
2. `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest` running at `http://localhost:8288`
3. Inngest Dev UI "Apps" tab shows `policydash` app with `feedback-reviewed` function listed
4. A test feedback item in `submitted` or `under_review` status in the DB
5. A test stakeholder account with a non-null `users.email` (to verify email step)
6. `RESEND_API_KEY` set to a valid Resend API key (test mode or live)

Steps:
1. As admin/policy_lead, call `feedback.startReview` on the test feedback item (moves to `under_review`)
2. Call `feedback.decide` with `{ id, decision: 'accept', rationale: '...(20+ chars)...' }`
3. In Inngest Dev UI → "Runs" tab — confirm a run appears for `feedback-reviewed`
4. Wait for run to complete (typically < 5s)
5. Verify step timeline: all 6 steps show green checkmarks

Observable effects:
- **Effect 1 (in-app notification):** `SELECT * FROM notifications WHERE entity_id = '<feedbackId>'` → 1 row with `type = 'feedback_status_changed'`
- **Effect 2 (email):** Resend dashboard or Resend test inbox shows email to stakeholder with subject `Your feedback FB-XXX has been reviewed`
- **Effect 3 (auto-draft CR):** `SELECT * FROM change_requests WHERE owner_id = '<adminId>' ORDER BY created_at DESC LIMIT 1` → 1 row with `status = 'drafting'`; also verify `crFeedbackLinks` and `crSectionLinks` rows
- **Effect 4 (workflowTransition):** `SELECT * FROM workflow_transitions WHERE entity_id = '<feedbackId>'` → at least 2 rows (startReview + decide)

### Sampling Rate
- **Per task commit:** `npm test -- --run src/inngest`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green + manual smoke walk completed before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/inngest/__tests__/create-draft-cr.test.ts` — covers FIX-07 (mocks `db` execute + transaction)
- [ ] `src/inngest/__tests__/notification-create.test.ts` — covers NOTIF-04 (validates payload schema)
- [ ] `src/inngest/__tests__/notification-dispatch.test.ts` — covers NOTIF-05/06 (mocks DB insert + Resend)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | All | ✓ | (project running) | — |
| Next.js dev server | Smoke walk | ✓ | 16.2.1 | — |
| Inngest CLI | Smoke walk | check at execution | `npx inngest-cli@latest` | Use npx (no install needed) |
| RESEND_API_KEY env | Email step | unknown | — | Smoke without email step (set to test key) |
| PostgreSQL (Neon) | DB steps | ✓ | (project running) | — |

**Missing dependencies with fallback:**
- `RESEND_API_KEY`: If not set, `sendFeedbackReviewedEmail` silently no-ops (by design in `src/lib/email.ts`). Smoke walk must set this to observe Effect 2.

---

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **CRITICAL:** This is NOT standard Next.js — read `node_modules/next/dist/docs/` before writing any Next.js code. APIs, conventions, and file structure may differ from training data.
- Every tRPC mutation writes audit log via `writeAuditLog` — `notificationDispatch` is an Inngest function not a mutation, so no audit log required for the notification insert itself.
- No `publicProcedure` in application routers — not relevant to Inngest functions.
- Phone-first auth: `users.email` is optional (nullable). All email paths must guard `if (email)`.
- Drizzle DB schema changes require a hand-written migration when Drizzle-kit cannot express them (e.g. partition DDL). A unique index on `notifications` can be expressed in a migration SQL file directly.
- Never use worktrees or isolation branches — commit directly to master.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `createNotification(...).catch(console.error)` in routers | `sendX(...)` in routers → Inngest function handles insert + email | DB failure during notification no longer silently swallows; Inngest retries up to 3 times |
| Inline email send on mutation critical path | Email dispatched inside Inngest `step.run` | Resend API latency (100–500ms) no longer blocks tRPC response |
| No deduplication | `onConflictDoNothing()` on unique index | Safe to deploy and roll back without duplicate notifications |

---

## Open Questions

1. **Should `version.publish` notifications be per-user events or a single batch event?**
   - What we know: Today it loops N users and calls `createNotification` N times. NOTIF-04 requires migrating this.
   - What's unclear: Phase 16 scope says "migrated to `notification.create` Inngest event" — N events or one batch event?
   - Recommendation: N individual `sendNotificationCreate` calls (simplest, avoids `batchEvents` complexity). Planner should confirm.

2. **Should CR status change notifications include email?**
   - What we know: `changeRequest.ts` has 4 notification callsites; `src/lib/email.ts` has no `sendCRStatusChangedEmail` function.
   - What's unclear: Phase 16 success criteria say "DB insert + Resend email" for `notificationDispatch`. Does that mean all notification types get email, or only the ones that currently have email functions?
   - Recommendation: Add in-app notification only for CR status changes in Phase 16 (no new email template needed). Email for CR status is a Phase 17+ enhancement.

3. **Idempotency key column strategy — Option A vs Option B?**
   - What we know: Two options described above.
   - Recommendation: Option A (`idempotencyKey text UNIQUE` computed by caller) — single column, no partial index complexity, immediate enforcement.

---

## Sources

### Primary (HIGH confidence — source code read directly)
- `src/inngest/events.ts` — event registry pattern, `feedbackReviewedEvent`, `sendFeedbackReviewed`
- `src/inngest/client.ts` — singleton client shape
- `src/inngest/README.md` — dev server setup, adding new flows, retry vs NonRetriableError
- `src/inngest/functions/feedback-reviewed.ts` — complete Flow 5 implementation (6 steps)
- `src/inngest/lib/create-draft-cr.ts` — auto-draft CR implementation
- `src/inngest/lib/feedback-reviewed-copy.ts` — notification copy builder
- `src/inngest/lib/auto-draft-cr-content.ts` — CR content builder
- `src/server/routers/feedback.ts` — `decide` reference pattern (line 398), `startReview` and `close` callsites
- `src/server/routers/changeRequest.ts` — 4 `createNotification` callsites
- `src/server/routers/version.ts` — `publish` loop callsite + email
- `src/server/routers/sectionAssignment.ts` — `assign` callsite + email
- `src/lib/notifications.ts` — `createNotification` function (target for eventual deletion)
- `src/lib/email.ts` — Resend integration, existing email functions
- `src/db/schema/notifications.ts` — table structure, no unique constraint
- `src/db/schema/workflow.ts` — `workflowTransitions` table
- `src/inngest/__tests__/*.test.ts` — existing test patterns (Vitest, pure unit)
- `vitest.config.mts` — test runner config
- `.planning/config.json` — `nyquist_validation: true`

### Secondary (MEDIUM confidence)
- `src/server/services/feedback.service.ts` — confirms `workflow_transitions` write at step 9
- `.planning/REQUIREMENTS.md` — NOTIF-04/05/06/FIX-07 requirement text
- `.planning/ROADMAP.md` lines 345–356 — Phase 16 success criteria

---

## Metadata

**Confidence breakdown:**
- Callsite inventory: HIGH — read all 4 router files line by line
- Flow 5 implementation state: HIGH — read `feedback-reviewed.ts` and all lib files
- Notifications schema: HIGH — read schema file directly
- Idempotency strategy: MEDIUM — pattern is established, specific column choice is a planner decision
- Resend smoke availability: MEDIUM — env var availability unknown at research time

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable domain, no fast-moving dependencies)

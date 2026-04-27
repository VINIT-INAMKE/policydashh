# Google Calendar Workshop Pivot — Design

**Date:** 2026-04-28
**Status:** Approved (architecture); pending implementation plan via writing-plans skill
**Supersedes (in part):** `2026-04-21-workshop-meetings-redesign.md` (cal.com seated-booking model)

## Context

The current workshop subsystem is built on cal.com — admin creates a workshop, an Inngest function asynchronously provisions a cal.com event-type + root seated booking, public registrants are added as attendees on that booking via `addAttendeeToBooking`. Cal.com webhooks (BOOKING_CREATED, BOOKING_CANCELLED, BOOKING_RESCHEDULED, MEETING_ENDED, RECORDING_READY) drive status transitions, attendance backfill, walk-in synthesis, feedback-invite fan-out, and recording transcription.

Two problems forced the pivot:

1. **Stuck-in-pending state.** Cal.com's async event-type provisioning fails or stalls for opaque reasons in our environment. Workshops appear in admin UI but never reach the public listing because `calcomEventTypeId` is never backfilled. The "503 still being set up" branch in the registration intake is a permanent state, not a transient one.

2. **Async architecture overhead is unjustified.** Cal.com required async because event-type creation is multi-step and slow. Google Calendar API is one fast call (~200ms). We were paying the complexity cost of Inngest + orphan reconciliation + replay-dedup tables for a problem we don't have if we can synchronously talk to the calendar provider.

This pivot replaces cal.com with direct Google Calendar API calls, owned by the workshop creator's personal Google account (vinit@konma.io) via OAuth refresh token. The system gains a working booking flow, native multi-attendee event semantics, branded reminder emails (built in-house via Inngest), and loses cal.com's auto-provisioning, auto-attendance, and recording-ready webhook (replaced by manual admin actions where needed).

There are zero workshops in production today — clean slate, no migration burden.

## Architecture overview

**Single-tenant OAuth.** One Google account configured at the env level. Refresh token + client id/secret in `.env.local`. All workshops created by any admin live on that one Google calendar. Calendar id is configurable (`GOOGLE_CALENDAR_ID`, defaults to `primary`); admins can point us at a secondary calendar to keep their day-view tidy.

**Synchronous Google writes for the main lifecycle.** `workshop.create`, `workshop-register` POST, `workshop.update` (when scheduledAt/title/description change), and `workshop.delete` all call Google Calendar API inline within the request. No "pending" state, no orphan reconciler, no async race windows.

**Inngest is reserved for genuinely-async work**:
- 24h + 1h **branded reminder emails** via Resend
- **Clerk invitation** for new stakeholder registrants (existing pattern)
- **Recording transcription** via Groq (existing R2 + Groq pipeline; admin manually uploads)
- **Completion fan-out** (feedback-invite emails + evidence-nudge) triggered by manual "End Workshop" button

**Cal.com is fully removed.** Every cal.com file deleted. Webhook handler deleted. No legacy dual-mode code. Migration drops `calcomEventTypeId` and `calcomBookingUid` columns and the `processed_webhook_events` table.

**The 5 user decisions baked in (from brainstorming session 2026-04-28):**
1. Workshop end → admin clicks **"End Workshop"** button (no auto-cron)
2. Attendance → **manual checkbox** per registration on Attendees tab
3. Reminders → **branded Inngest emails** (24h + 1h before workshop start)
4. Reschedule → **edits propagate to Google** via `events.patch` with `sendUpdates: 'all'`
5. Create → **synchronous** Google API call inside the mutation

**Meeting link UX**: admin picks one of two modes per workshop:
- **Auto-provision Google Meet** (default): we set `conferenceData.createRequest` on the Google event; Google generates the Meet link; we read it back and store it in `workshops.meetingUrl`
- **Manual link**: admin pastes any URL (Zoom, Teams, existing Meet, etc.); we store it as the calendar event's `location` and in `workshops.meetingUrl`

## Schema changes

### `workshops` table

| Field | Change |
|---|---|
| `googleCalendarEventId` | **+ NEW** — `text NOT NULL`. Populated by sync `workshop.create`. |
| `meetingProvisionedBy` | **+ NEW** — `text NOT NULL` ('google_meet' \| 'manual'). Drives admin UI badge. |
| `meetingUrl` | **PROMOTED** — was nullable, now `text NOT NULL`. Always set at create time. |
| `calcomEventTypeId` | **− DROP** |
| `calcomBookingUid` | **− DROP** |
| `completionPipelineSentAt` | **KEEP** — manual "End Workshop" stamps this; Inngest fan-out gates on null |

### `workshop_registrations` table

| Field | Change |
|---|---|
| `bookingUid` | **KEEP** — value scheme changes from cal.com composite to `reg_${uuid()}`. Unique index stays. |
| `inviteSentAt` | **+ NEW** — `timestamp` nullable. Stamped on successful Google `addAttendeeToEvent`. NULL = invite send failed; admin sees ⚠ badge in Attendees tab with a "Resend" button. |
| `attendanceSource` enum | KEEP. New rows default to `'manual'` (the `'cal_meeting_ended'` enum value remains for legacy tolerance, never written by new code). |
| Partial unique on `(workshop_id, email_hash) WHERE status != 'cancelled'` | **KEEP** |

### Other

- `processed_webhook_events` table — **DROP** (cal webhook is gone)

### Migration files

- `0032_workshops_google_calendar.sql` — drop calcom columns, add googleCalendarEventId / meetingProvisionedBy NOT NULL with provisional defaults (then drop defaults), promote meetingUrl to NOT NULL, add inviteSentAt to workshop_registrations
- `0033_drop_processed_webhook_events.sql` — DROP TABLE

Both can ship in one migration in practice (0032) since there's no data; splitting is just for review clarity.

## Google Calendar client — `src/lib/google-calendar.ts`

Hand-rolled (no `googleapis` npm dep — too heavy for 5 endpoints). Module exports:

```ts
export class GoogleCalendarError extends Error {
  constructor(public readonly status: number, message: string)
}

// Auth (private)
async function getAccessToken(): Promise<string>
  // In-memory cache + auto-refresh via REFRESH_TOKEN env var
  // 60-min token lifetime; refresh on first call after expiry
  // On 401 from any Calendar call, invalidate cache + retry once

// Public client surface
export async function createWorkshopEvent(input: {
  title: string
  description: string | null
  startUtc: Date
  endUtc: Date
  timezone: string
  organizerEmail: string
  meetingMode: 'auto_meet' | 'manual'
  manualMeetingUrl?: string  // required iff meetingMode === 'manual'
  reminderMinutesBefore: number[]  // [1440, 60] — passed to Google so it shows them on the event
}): Promise<{ eventId: string; meetingUrl: string; htmlLink: string }>

export async function addAttendeeToEvent(input: {
  eventId: string
  attendeeEmail: string
  attendeeName: string
}): Promise<void>
  // events.patch with growing attendees list, sendUpdates='all'
  // Google emails the new attendee + bumps SEQUENCE on existing attendees

export async function rescheduleEvent(input: {
  eventId: string
  newStartUtc?: Date
  newEndUtc?: Date
  newTitle?: string
  newDescription?: string | null
  newTimezone?: string
}): Promise<void>
  // events.patch with sendUpdates='all'

export async function cancelEvent(input: { eventId: string }): Promise<void>
  // events.delete with sendUpdates='all'
  // Google sends cancellation email; auto-deletes auto-provisioned Meet room

export async function removeAttendeeFromEvent(input: {
  eventId: string
  attendeeEmail: string
}): Promise<void>
  // events.patch with shrunken attendees list + sendUpdates='all'
  // Wired in v1 only via the admin "Cancel registration" action; stakeholder
  // self-cancellation via PolicyDash UI is future work
```

**Failure semantics for callers:**
- 401/403 → unrecoverable for this request; surface to admin with a "re-authenticate" link
- 404 (event missing) → most likely admin manually deleted in Google Calendar UI; treat as cancelled, log, don't retry
- 4xx other → bad input, log + throw
- 5xx + 429 → transient; sync paths throw with retry hint; Inngest paths throw plain Error so retry budget consumes

**Note on Google's reminder field:** Google supports `event.reminders.overrides: [{ method: 'email', minutes: N }]` for organizer-set reminders. We DO use this so Google shows the reminder schedule on the event detail (UX nicety) — but our Inngest reminder fn sends the actual branded reminder emails. The double-reminder is intentional: Google's email is a fallback if our Inngest fn fails; ours is the primary, with our copy.

## Routers — `src/server/routers/workshop.ts`

### Modified mutations

**`workshop.create`** — sync Google integration
- Input: `{ title, description?, scheduledAt (wall-time), durationMinutes, maxSeats?, timezone?, meetingMode, manualMeetingUrl? }`
- `wallTimeToUtc(scheduledAt, tz)` → `startUtc`; `endUtc = startUtc + durationMinutes * 60_000`
- Call `createWorkshopEvent({...})` → `{ eventId, meetingUrl }`
- `INSERT workshops` with `googleCalendarEventId`, `meetingUrl`, `meetingProvisionedBy`
- Audit log
- Fire `workshop.created` event (now triggers `workshopRemindersScheduledFn`, NOT cal.com provisioning)
- On Google failure: throw TRPCError, no DB row inserted
- On DB failure after Google success: best-effort `cancelEvent` to undo Google; if undo fails too, log loudly (orphan calendar event admin can manually delete)

**`workshop.update`** — propagate to Google
- If `scheduledAt | title | description | timezone` changed AND `googleCalendarEventId` is set → call `rescheduleEvent` BEFORE the DB update
- If `meetingMode | manualMeetingUrl` changed → not supported in v1 (admin must delete + recreate to switch modes)
- If `maxSeats` changed → DB only, no Google involvement (Google has no concept of a seat cap)
- Replaces the prior Flow-3 "refuse scheduledAt edits" guard

**`workshop.delete`** — cancel Google event
- Call `cancelEvent({ eventId })` BEFORE DB delete
- DB delete cascades to `workshop_registrations`
- If Google fails: throw, DB unchanged, admin retries

**`workshop.transition`** — when transitioning to `'completed'`, stamp `completionPipelineSentAt` (existing H-1 fix)

**`workshop.setMeetingUrl`** — DEPRECATED (delete this mutation). Replaced by `workshop.update` with `manualMeetingUrl` param.

### New mutations

**`workshop.endWorkshop`** — manual "workshop is over" trigger
- Permission: `workshop:manage`
- Input: `{ workshopId }`
- Loads workshop; verifies status in `('upcoming', 'in_progress')`
- `UPDATE` status → `'completed'`, stamp `completionPipelineSentAt`
- Insert workflow_transitions row (sentinel actor = workshop creator)
- Fire `workshop.completed` event (Phase-17 evidence-nudge pipeline)
- Fire `workshop.feedback.invites_batch` event with all registered attendees → `workshopFeedbackInviteFn` per attendee
- Audit log
- Idempotency: re-running on already-completed workshop is a no-op

**`workshop.markAttendance`** — per-registration attendance toggle
- Permission: `workshop:manage`
- Input: `{ workshopId, registrationId, attended: boolean }`
- `UPDATE workshop_registrations SET attendedAt = attended ? now() : NULL, attendanceSource = 'manual'`
- Audit log

**`workshop.markAllPresent`** — batch attendance
- Permission: `workshop:manage`
- Input: `{ workshopId }`
- `UPDATE workshop_registrations SET attendedAt = now(), attendanceSource = 'manual' WHERE workshop_id = $1 AND attendedAt IS NULL`
- Audit log with affected count

**`workshop.addWalkIn`** — admin adds post-hoc registration
- Permission: `workshop:manage`
- Input: `{ workshopId, email, name }`
- Email-collision handling: if a non-cancelled registration with the same `(workshop_id, email_hash)` exists, do NOT insert a new row — instead UPDATE the existing row to stamp `attendedAt = now()`, `attendanceSource = 'manual'`. Returns `{ added: false, registrationId, attendanceMarked: true }`.
- New attendee path: INSERT with `bookingUid = walkin_${uuid()}`, `attendedAt = now()`, `attendanceSource = 'manual'`, `inviteSentAt = NULL` (no calendar invite — meeting already happened). Returns `{ added: true, registrationId }`.
- Does NOT call Google `addAttendeeToEvent`
- Audit log

**`workshop.resendInvite`** — recover from Google addAttendee failure
- Permission: `workshop:manage`
- Input: `{ workshopId, registrationId }`
- Loads registration; verifies `inviteSentAt IS NULL`
- Call `addAttendeeToEvent`; on success, stamp `inviteSentAt = now()`
- Audit log

**`workshop.cancelRegistration`** — admin cancels a registration
- Permission: `workshop:manage`
- Input: `{ workshopId, registrationId, notify: boolean }`
- `UPDATE registration SET status='cancelled', cancelledAt=now()`
- If `notify`: call `removeAttendeeFromEvent` so Google notifies attendee
- Audit log

## Public registration intake — `app/api/intake/workshop-register/route.ts`

Sync Google integration. Cal.com paths deleted entirely.

```
POST /api/intake/workshop-register
1. Body validate (Zod): workshopId, name?, email, turnstileToken
2. Body-size guard (16KB)
3. Per-IP rate limit (20 req / 5 min)
4. Turnstile verify
5. Per-email rate limit (5 req / 10 min)
6. Load workshop (id, scheduledAt, status, maxSeats, googleCalendarEventId, timezone)
7. Guard: status not in ('completed', 'archived'); scheduledAt > now()
8. Already-registered check (most recent row, status != 'cancelled') → 409
9. Capacity courtesy pre-flight
10. INSERT workshop_registrations (bookingUid='reg_${uuid()}', status='registered', inviteSentAt=NULL)
    - Partial unique on (workshop_id, email_hash) catches double-click → 23505 → 409
    - Other DB error → 500, no calendar invite sent
11. addAttendeeToEvent(googleCalendarEventId, email, name)
    - On success: UPDATE registration SET inviteSentAt = now()
    - On Google 4xx/5xx: log, leave inviteSentAt NULL, return 200 with { success: true, inviteStatus: 'pending_resend' }
      Admin sees ⚠ badge on Attendees tab, can click Resend
12. revalidateTag(spotsTag(workshopId))
13. sendWorkshopRegistrationReceived event (Clerk invite — existing pattern)
14. Return 200 { success: true }
```

**No more orphan event/handler.** The Resend Invite admin button replaces the orphan-reconciliation Inngest function.

**No more pg_advisory_xact_lock.** Sync flow's narrow window (single SELECT count + INSERT) is sufficient for our scale; partial unique handles the dominant double-click race.

## Inngest functions — `src/inngest/functions/`

### Added

**`workshopRemindersScheduledFn`** — per-workshop reminder fan-out
- Triggers: `workshop.created` AND `workshop.reminders_rescheduled` (registered as two trigger events on the same fn so a reschedule fires a fresh run)
- Steps:
  1. `step.run('load-workshop')` → query workshop, capture the `scheduledAt` value as `scheduledAtAtSchedule` (the start time at the moment this run was scheduled)
  2. `step.sleepUntil(scheduledAt - 24h)`
  3. `step.run('check-and-send-24h')` → re-query workshop. Exit silently if any of: workshop deleted, status='archived', `scheduledAt !== scheduledAtAtSchedule` (admin rescheduled — a newer run handles the new time). Otherwise fetch all `status='registered'` registrations, send batch reminder email via Resend with subject "Reminder: {title} starts in 24 hours"
  4. `step.sleepUntil(scheduledAt - 1h)`
  5. `step.run('check-and-send-1h')` → same re-query + send (subject "Reminder: {title} starts in 1 hour")
- Idempotency: Inngest's per-step retry budget covers transient send failures; the re-query exit handles cancellation/reschedule/delete; old run's `step.sleepUntil` fires harmlessly and exits at step 3/5 if `scheduledAtAtSchedule` no longer matches the DB.

**Reschedule cancellation pattern:** `workshop.update`, after a successful Google reschedule, fires `workshop.reminders_rescheduled`. A fresh run schedules at the new time. The old run's `step.sleepUntil` continues to fire at the OLD time but the post-sleep step exits because `scheduledAtAtSchedule` no longer matches. We accept the wasted Inngest sleep slot — Inngest's pricing isn't sleep-bound and the alternative (true cancellation) requires Inngest's invocation-cancel API which adds ops complexity.

**Workshop deletion:** triggers no special Inngest event. The pending reminder run wakes, queries the workshop, finds nothing (or status='archived'), exits silently.

### Kept (no change to triggers/handlers)

- `workshopRegistrationReceivedFn` — Clerk invite via `workshop.registration.received`
- `workshopFeedbackInviteFn` — per-attendee JWT-deep-link feedback email via `workshop.feedback.invite`. **New trigger source**: `workshop.endWorkshop` mutation (was: cal.com MEETING_ENDED webhook)
- `workshopCompletedFn` — Phase-17 evidence-nudge emails via `workshop.completed`. **New trigger source**: `workshop.endWorkshop` mutation
- `workshopRecordingProcessedFn` — Groq transcribe via `workshop.recording_uploaded`. Trigger source unchanged: `workshop.attachArtifact` mutation when `artifactType === 'recording'` and `r2Key` is set

### Deleted

- `workshopCreatedFn` — was provisioning cal.com event-type + booking. No longer needed; `workshop.create` does Google sync inline. The `workshop.created` event is RE-PURPOSED to trigger `workshopRemindersScheduledFn` (different consumer, same event name).
- `workshopRegistrationOrphanFn` — the orphan path is gone (sync flow surfaces failures inline; Resend Invite button covers retries)

## UI changes

### Create form (`/workshop-manage/new`)

- **+ Meeting source radio**: `[ ] Auto-provision Google Meet` (default checked) | `[ ] Use my own meeting link`
- **+ Conditional URL input**: shown when "Use my own meeting link" selected; required, `<input type="url">`
- **− Registration Link field**: drop entirely (replaced by meetingUrl as the single canonical link). Existing workshops with `registrationLink` set continue to render it (legacy field, soft-deprecated)

### Edit form (`/workshop-manage/[id]/edit`)

- Same meeting source UX as create
- Allows switching modes only if no registrants yet (otherwise switching mode would invalidate already-sent calendar invites). Switching modes when registrants exist → throw with "delete and recreate the workshop instead"
- `scheduledAt` input is no longer locked once registrants exist — admin can edit, Google handles the cascade

### Detail page (`/workshop-manage/[id]`)

- **+ Meeting source badge**: "Auto-provisioned Google Meet" or "Custom link" indicator
- **+ "Open in Google Calendar" button**: deep link via `htmlLink` from create response (replaces "Open in cal.com")
- **+ "End Workshop" button**: prominent, shown when status in `('upcoming', 'in_progress')` AND `scheduledAt < now() + 30min`. One click → `workshop.endWorkshop` mutation
- **− `MissingMeetingUrlAlert` component**: deleted (meetingUrl is now NOT NULL, can't be missing)
- **− `setMeetingUrl` form widget**: dropped (use edit form instead)

### Attendees tab (`/workshop-manage/[id]/_components/attendee-list`)

- **+ "Attended" checkbox per row**: bound to `workshop.markAttendance` mutation; saves on toggle
- **+ "Mark all present" button**: top of the list; calls `workshop.markAllPresent`
- **+ "Add walk-in" button**: top of the list; opens a modal with email + name inputs; calls `workshop.addWalkIn`
- **+ "⚠ Invite pending — Resend" badge + button**: shown for registrations where `inviteSentAt IS NULL`; button calls `workshop.resendInvite`
- **+ "Cancel registration" action**: per-row, with confirmation modal asking "notify attendee?"

### Public listing (`/workshops`)

- Gate changes from `calcomEventTypeId IS NOT NULL` → `googleCalendarEventId IS NOT NULL`
- No other UI change

## Email templates

### Added

- `src/lib/email-templates/workshop-reminder.tsx` — branded reminder, 24h + 1h variants. Includes meeting URL, workshop title, time in IST + "in your local time" (computed from registrant's recorded tz, or fallback to IST)

### Kept

- `src/lib/email-templates/workshop-feedback-invite.tsx` — unchanged

### Deleted

- None — but `src/lib/email.ts`'s `sendWorkshopOrphanSeatAlert` becomes unused; delete the function

## OAuth setup

Documented in `docs/superpowers/setup/google-calendar-oauth.md` (new file, written by writing-plans):

1. Create Google Cloud project (or use existing)
2. Enable Google Calendar API
3. Configure OAuth consent screen — Internal if konma.io is Workspace; External + add vinit@konma.io as test user otherwise
4. Create OAuth 2.0 Client ID (Web application; redirect URI: `http://localhost:3000/api/google-oauth-callback` for one-time setup)
5. Run a one-time helper script (`scripts/google-oauth-bootstrap.mjs`, written by writing-plans) that opens the consent URL, captures the auth code, exchanges for refresh token, prints `.env.local` snippet
6. Drop env vars into `.env.local`:
   ```
   GOOGLE_OAUTH_CLIENT_ID=...
   GOOGLE_OAUTH_CLIENT_SECRET=...
   GOOGLE_OAUTH_REFRESH_TOKEN=...
   WORKSHOP_ORGANIZER_EMAIL=vinit@konma.io
   GOOGLE_CALENDAR_ID=primary
   ```

## Cleanup

### Files deleted

- `src/lib/calcom.ts`
- `src/lib/cal-signature.ts`
- `app/api/webhooks/cal/route.ts`
- `src/inngest/functions/workshop-created.ts`
- `src/inngest/functions/workshop-registration-orphan.ts`
- `src/db/schema/processed-webhook-events.ts`
- `scripts/apply-migration-0031.mjs` (the processed_webhook_events apply script)
- `tests/phase-20/cal-webhook-route.test.ts`
- `src/inngest/__tests__/workshop-created.test.ts` (if present)

### Env vars dropped

- `CAL_API_KEY`
- `CAL_WEBHOOK_SECRET`
- `CAL_PRIMARY_ATTENDEE_EMAIL`
- `CAL_PRIMARY_ATTENDEE_NAME`

### Schema cleanup

Migrations 0032 (and optionally 0033) drop the dead columns + table.

### Inngest function index

`src/inngest/functions/index.ts` — remove `workshopCreatedFn` and `workshopRegistrationOrphanFn` from the registered list; add `workshopRemindersScheduledFn`.

## Testing strategy

### New test files

- `src/lib/__tests__/google-calendar.test.ts` — mock `fetch`, test all 5 client methods + error mapping (401 retry, 404 swallow, 5xx propagate)
- `src/server/routers/__tests__/workshop-end.test.ts` — `workshop.endWorkshop` flips status, stamps column, fires both events, no-op on re-run
- `src/server/routers/__tests__/workshop-attendance.test.ts` — `markAttendance`, `markAllPresent`, `addWalkIn`, `cancelRegistration`, `resendInvite`
- `src/inngest/__tests__/workshop-reminders-scheduled.test.ts` — sleepUntil + re-query + reschedule cancellation pattern

### Rewritten

- `tests/phase-20/workshop-register-route.test.ts` — drop transaction mocks, drop orphan-event assertions, add Google `addAttendeeToEvent` mock + invite-pending fallback assertions
- `src/server/routers/__tests__/workshop-create-update.test.ts` (renamed from current) — test sync Google calls + reschedule propagation

### Deleted

- `tests/phase-20/cal-webhook-route.test.ts` (entire file)

### Coverage targets

- Google Calendar client: 100% (it's the new external dependency)
- Reminder Inngest fn: ≥80% (sleepUntil + re-query + reschedule paths)
- New router mutations: 100%
- Existing tests for `workshop.list`, `workshop.getById`, `workshop.transition`, etc. continue to pass with mock updates

## Error handling

### Google API failure modes

| HTTP | Cause | Caller behavior |
|---|---|---|
| 401 | Token expired | Auto-refresh + retry once. Second 401 → throw `GoogleCalendarError(401, 'OAuth refresh failed — admin must re-authenticate')`. Admin sees toast + "Re-authenticate Google" link in admin nav. |
| 403 | Insufficient scope or revoked access | Throw GoogleCalendarError(403, ...). Same admin re-auth flow. |
| 404 | Event missing | Sync paths (e.g., reschedule on a manually-deleted event): treat as cancelled, log, soft-fail. |
| 429 / 5xx | Rate limit / transient | Sync paths: throw with retry hint to admin. Inngest paths: throw plain Error so retry budget consumes. |
| 4xx other | Bad input | Throw GoogleCalendarError(4xx, ...) with the API's error body in the message. |

### DB failure modes

- Sync inline try/catch; user-facing 500 with no stale state.
- For `workshop.create`: if Google succeeded but DB INSERT failed, best-effort `cancelEvent` to undo. If `cancelEvent` also fails, log structured error so admin can manually delete the orphan calendar event.

### Inngest failure modes

- Reminder fn: each `step.run` retried per Inngest's per-step budget (default 3). Reminders are best-effort; if delivery fails after retries, log + move on.
- Feedback-invite fn: existing retry pattern (per-attendee, idempotent via deterministic JWT key)
- Recording-processed fn: existing pattern unchanged

### OAuth refresh-token revocation

If `vinit@konma.io` revokes our app's calendar access, every Calendar API call returns 401. Our retry-once-on-401 path will fail again, throw `GoogleCalendarError(401, ...)`. Admin UI surfaces a banner: "Google Calendar integration is broken. Re-authenticate at /admin/google-auth". Re-auth flow (a small admin page) walks admin through OAuth consent and updates the refresh token in `.env.local` (or, post-MVP, in a secure config table). For v1 the token is in env vars and re-auth requires a redeploy with a new value — acceptable for single-admin platform.

## What is NOT in scope (intentional YAGNI)

- Stakeholder self-service registration cancellation via PolicyDash UI (admin can cancel for them via `cancelRegistration`)
- Stakeholder reschedule (Google Calendar invite has Yes/Maybe/No buttons, not "pick new slot")
- Multi-admin OAuth (each admin OAuthing their own Google) — single-tenant for v1
- Google Calendar push notifications (subscribing to event changes via webhook) — admin manually reconciles RSVPs if needed
- Auto-cron status flip — admin manually clicks End Workshop
- Reminder customization per workshop — fixed at 24h + 1h
- Recording auto-fetch — admin uploads via existing Attach Artifact flow
- Walk-in calendar invite (admin walk-in adds the row but does NOT email a calendar invite — the meeting already happened)

## Verification

After implementation:
1. `npx tsc --noEmit` — clean
2. `npx vitest run` — all tests pass (new + rewritten + unchanged)
3. `npx next build` — clean
4. Apply migration 0032 (and 0034) to preview-net
5. End-to-end smoke test:
   - Create a workshop with auto-provision Meet → verify Google Calendar event created with Meet link
   - Create a workshop with manual link → verify event has the pasted URL as location
   - Register a stakeholder → verify Google sends invite email + DB row + spots-left badge updates
   - Reschedule → verify Google emails attendee about time change
   - End workshop → verify status flip + feedback-invite emails
   - Mark attendance → verify DB updates
6. OAuth verification: revoke app access, verify graceful failure path; re-OAuth, verify recovery

---

## Implementation plan handoff

Implementation will be planned via the `superpowers:writing-plans` skill in a separate document, broken into atomic tasks. Plan reference: `docs/superpowers/plans/2026-04-28-google-calendar-workshop-pivot-plan.md` (to be written next).

Estimated scope: ~25 atomic tasks across schema migration, Google client, router rewrites, Inngest fn changes, UI refactors, OAuth bootstrap script, test rewrites, and cleanup deletions.

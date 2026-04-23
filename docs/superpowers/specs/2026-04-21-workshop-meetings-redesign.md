# Workshop Meetings Redesign — Google Meet + Single Shared Booking

**Date:** 2026-04-21
**Status:** Approved (brainstorm complete, ready for implementation plan)
**Authors:** aditee + Claude

## Problem

Two defects in the current cal.com workshop integration:

1. **"Multiple 1:1 meeting events" per workshop.** Each registration spawns a separate cal.com booking with its own `uid` and its own meeting room, instead of attendees sharing one booking + one meeting URL. Root cause: the seats feature on cal.com's event-types is only honoured by the **embed** booking flow. Direct API `POST /v2/bookings` always creates a fresh booking, regardless of `seatsPerTimeSlot` ([calcom #13331 / CAL-3004](https://github.com/calcom/cal.com/issues/13331)). Phase 20 intended to use the embed ([`20-DISCUSSION-LOG.md:48`](../../../.planning/phases/20-cal-com-workshop-register/20-DISCUSSION-LOG.md)) but shipped a custom form that calls the API directly ([`register-form.tsx:115`](../../../app/workshops/_components/register-form.tsx) → [`route.ts`](../../../app/api/intake/workshop-register/route.ts) → [`createCalBooking` at calcom.ts:266](../../../src/lib/calcom.ts)).

2. **Cal Video instead of Google Meet.** Hardcoded at [`calcom.ts:103`](../../../src/lib/calcom.ts) as `locations: [{ type: 'integration', integration: 'cal-video' }]`. The shared cal.com org account already has Google OAuth + Google Meet integration connected, so this is purely a code change.

An embed-based fix is rejected because the workshop's date/time is fixed at creation; a date-picker in a modal is the wrong UX.

## Goal

One cal.com booking per workshop. All attendees attached as seats via the `attendees` endpoint. All attendees receive the same Google Meet link through cal.com's standard attendee emails and calendar invites.

## Non-goals

- 1:1 briefings feature (still deferred; no code yet).
- Per-admin cal.com OAuth.
- Configurable per-workshop meeting platform (Zoom etc.).
- Migration of past workshops (leave their orphaned bookings in place).

## Architecture

### Accounts

Two separate email identities, do not conflate:

- **Cal.com organizer account:** `vinit@konma.io`. Owns the cal.com workspace behind `CAL_API_KEY`. Event types and bookings are created under this account. Google Calendar OAuth (with Google Meet integration) is connected here — this is what generates the shared Meet link per booking. The organizer's calendar is where cal.com writes the authoritative calendar event.
- **Primary attendee on every workshop booking:** `vinay@konma.io`. Always the first attendee on the root seated booking. Receives cal.com's booking-confirmation email with the Meet link and appears as a guest on the organizer's calendar event; also gets a calendar invite of their own via cal.com's attendee sync.

Public registrants are added as additional seats on top of Vinay. Vinit is not an attendee — they are the account owner only.

### Cal.com primitives in use

| Endpoint | cal-api-version | Purpose |
|---|---|---|
| `POST /v2/event-types` | `2024-06-14` | Provision event type per workshop (seats + Google Meet location). |
| `POST /v2/bookings` | `2024-08-13` | Create the **root seated booking** once at workshop-creation time. Primary attendee = `vinay@konma.io`. |
| `POST /v2/bookings/{bookingUid}/attendees` | `2024-08-13` | Add each public registrant as a seat on the root booking. |
| `PATCH /v2/event-types/{id}` | `2024-06-14` | Propagate admin edits (title, duration). |
| Webhooks (unchanged path) | — | `BOOKING_CANCELLED`, `BOOKING_RESCHEDULED`, `MEETING_ENDED` on root uid. |

The `2024-08-13` version of the `attendees` endpoint is mandatory — the header is required and older versions 404.

### Data model changes

Add two columns to `workshops`:

```sql
ALTER TABLE workshops
  ADD COLUMN calcom_booking_uid TEXT,
  ADD COLUMN meeting_url TEXT;
```

Both are nullable because `workshopCreatedFn` backfills them asynchronously after the workshop row is inserted — mirrors the existing `calcomEventTypeId` null-until-backfilled pattern.

`workshop_registrations.booking_uid` keeps its UNIQUE index and is populated as `${rootBookingUid}:${attendeeId}` where `attendeeId` is the numeric `data.id` returned by the `attendees` endpoint. This preserves global uniqueness and enables `LIKE '${uid}:%'` cascade queries on BOOKING_CANCELLED of the root booking.

### New env vars

```
CAL_PRIMARY_ATTENDEE_EMAIL=vinay@konma.io
CAL_PRIMARY_ATTENDEE_NAME=Vinay (PolicyDash)
```

Added to `src/lib/env.ts` as required strings (enforced at runtime alongside existing `CAL_API_KEY` and `CAL_WEBHOOK_SECRET`). Added to `.env.example`.

### Flow: workshop creation

1. Admin submits create form → tRPC mutation inserts the workshop row → sends `workshop.created` Inngest event. *(unchanged)*
2. `workshopCreatedFn` runs:
   - **Step 1** — load workshop row *(unchanged)*.
   - **Step 2** — `createCalEventType({ title, slug: workshop-${id}, durationMinutes, seatsPerTimeSlot: maxSeats ?? 100, location: 'google-meet' })`.
   - **Step 3 (NEW)** — `createCalBooking({ eventTypeId, start: scheduledAt, attendee: { email: CAL_PRIMARY_ATTENDEE_EMAIL, name: CAL_PRIMARY_ATTENDEE_NAME, timeZone: workshop.timezone } })`. Capture `uid`. Extract the meeting URL from the booking response — the exact field depends on how cal.com surfaces Google Meet links (likely `data.meetingUrl` or `data.location`); confirm during the initial API smoke test and update `createCalBooking`'s return type accordingly.
   - **Step 4 (NEW)** — Update `workshops` set `calcomEventTypeId`, `calcomBookingUid`, `meetingUrl` in a single DB write.
3. Error policy — unchanged retry semantics. 5xx on any step retries; 4xx becomes `NonRetriableError`.

### Flow: public registration

`/api/intake/workshop-register` keeps:
- body-size guard (16 KB)
- per-IP rate limit (20 / 5 min)
- per-email rate limit (5 / 10 min)
- Cloudflare Turnstile verification
- Zod body validation
- already-registered check
- `max_seats` courtesy gate

Replaces the `createCalBooking` block with:

```ts
if (!workshop.calcomBookingUid) {
  return 503 // workshop not yet provisioned
}

const attendee = await addAttendeeToBooking(workshop.calcomBookingUid, {
  name: cleanName || 'Guest',
  email: cleanEmail,
  timeZone: workshop.timezone,
})

await db.insert(workshopRegistrations).values({
  workshopId,
  bookingUid: `${workshop.calcomBookingUid}:${attendee.id}`,
  email, emailHash, name,
  bookingStartTime: workshop.scheduledAt,
  status: 'registered',
}).onConflictDoNothing()

await sendWorkshopRegistrationReceived({ ... source: 'direct_register' })
```

Cal.com sends the attendee the standard booking-confirmation email + calendar invite (with the shared Google Meet link) when the attendee-add succeeds.

### Flow: webhooks (`/api/webhooks/cal`)

Trigger-by-trigger behaviour:

| Trigger | Current behaviour | New behaviour |
|---|---|---|
| `BOOKING_CREATED` | Inserts a registration row per attendee. | No-op (root booking is created server-side; attendees are added via a non-webhook API call — cal.com does not fire `BOOKING_CREATED` for attendee-adds). Return 200 for any that do fire. |
| `BOOKING_CANCELLED` | Updates one row by `bookingUid = uid`. | If `uid` matches a `workshops.calcomBookingUid` → cascade all registrations for that workshop (`WHERE booking_uid LIKE '${uid}:%'`). Else fall back to exact `bookingUid` match (covers per-seat cancels that fire with the seat uid). |
| `BOOKING_RESCHEDULED` | Updates one row. | If `rescheduleUid` matches a `workshops.calcomBookingUid` → update `workshops.scheduledAt` + `workshops.calcomBookingUid = newUid` + all registrations' `bookingStartTime` + rewrite their composite `booking_uid` prefix. Else fall back to exact match. |
| `MEETING_ENDED` | Flips workshop status, marks attendance, batches feedback invites. | Unchanged. |

Idempotency for `BOOKING_CANCELLED` cascade: setting `status = 'cancelled'` on an already-cancelled row is a no-op, so replays are safe.

### Per-seat attendee cancellation

Cal.com's standard attendee email includes a "Manage booking" link. If an attendee self-cancels through that link, cal.com fires `BOOKING_CANCELLED` with the **seat's** uid (not the root booking uid). Handler matches `booking_uid = uid` exactly and updates only that one row. Open question for API smoke: confirm the exact shape of the webhook for seat-cancel (may carry `seatUid` instead of `uid`). Smoke test plan below.

## Removed

- `@calcom/embed-react` dependency (never shipped on the public path). Remove from `package.json` and delete `types/calcom-embed-react.d.ts`.
- `CAL_USERNAME` env var. Remove from `src/lib/env.ts` and `.env.example`.
- `updateCalEventTypeSeats()` in `src/lib/calcom.ts`. Dead once seats are set correctly on creation.
- `reprovisionCalSeats` tRPC mutation in `src/server/routers/workshop.ts` and its UI button `app/workshop-manage/[id]/_components/reprovision-cal-button.tsx`.
- The `direct:${workshopId}:${emailHash}` fallback `bookingUid` pattern and the `needsCalComReconcile` flag. Registration now requires `calcomBookingUid` to exist.

## File-by-file summary

| File | Change |
|---|---|
| `src/db/schema/workshops.ts` | Add `calcomBookingUid`, `meetingUrl` columns. |
| `drizzle/<next-numbered>.sql` | Generated by `drizzle-kit generate` after the schema edit. Adds both columns as nullable text. Any DDL drizzle can't express (e.g. indexes on the new columns — not needed here) goes into `scripts/post-drizzle-push.sql` per the existing repo convention. |
| `src/lib/env.ts` | Add `CAL_PRIMARY_ATTENDEE_EMAIL`, `CAL_PRIMARY_ATTENDEE_NAME`. Remove `CAL_USERNAME`. |
| `.env.example` | Mirror env changes. |
| `src/lib/calcom.ts` | Location → Google Meet (try both `integration: 'google-meet'` and `integrations:google:meet` in body, same pattern as `length`/`lengthInMinutes`). Add `addAttendeeToBooking(bookingUid, {...}): Promise<{ id: number, bookingId: number }>`. Remove `updateCalEventTypeSeats`. |
| `src/inngest/functions/workshop-created.ts` | Add root-booking step + backfill step 4. |
| `app/api/intake/workshop-register/route.ts` | Swap `createCalBooking` → `addAttendeeToBooking`; require `calcomBookingUid`; keep Turnstile + rate limits. |
| `app/api/webhooks/cal/route.ts` | Rewrite `BOOKING_CANCELLED` / `BOOKING_RESCHEDULED` branches as described. `BOOKING_CREATED` becomes a no-op. |
| `src/server/routers/workshop.ts` | Remove `reprovisionCalSeats`. |
| `app/workshop-manage/[id]/_components/reprovision-cal-button.tsx` | Delete file. |
| `app/workshop-manage/[id]/page.tsx` (and edit page) | Remove reprovision button mount. |
| `types/calcom-embed-react.d.ts` | Delete. |
| `package.json` | Remove `@calcom/embed-react`. |
| Tests | Update mocks in the Phase 20 test suite (`tests/phase-20/*`) and any cal-webhook tests. `src/__tests__/research-router.test.ts` is unrelated and should not need changes — the planning pass confirms scope. |

## Testing

Unit / integration:
- `createCalEventType` — still passes with new location field.
- `createCalBooking` — covered by new root-booking unit test.
- `addAttendeeToBooking` — happy path, 4xx, 5xx, network failure, idempotent replay.
- `workshopCreatedFn` — asserts all three backfilled fields land.
- `/api/intake/workshop-register` — asserts the composite `booking_uid` shape.
- `/api/webhooks/cal` — new cascade-cancel assertions, reschedule-updates-workshop assertions.

Smoke (manual, post-deploy). Every step names the exact cal.com UI element a non-specialist operator would click (B9-2):

1. **Provisioning shape.** In the admin PolicyDash UI, create a workshop (`/dashboard/workshops` → "New workshop"). Wait ~10s for Inngest's `workshop-created` run to complete. Then open cal.com:
   - Navigate to https://app.cal.com/event-types.
   - Confirm a new row titled `Policy Roundtable` (or whatever you entered) appears. Click it. Under "Location" confirm `Google Meet` is selected.
   - Navigate to https://app.cal.com/bookings?status=upcoming.
   - Confirm one booking exists for the workshop date. Click it. Confirm:
     - Attendees list shows `vinay@konma.io` as the primary attendee.
     - A `https://meet.google.com/...` link appears in the booking details.
   - Back in PolicyDash, query `select meeting_url from workshops where id = '<uuid>';` to confirm the Meet URL was backfilled. **Record which cal.com response field carried it** (`data.meetingUrl` vs `data.location`) and annotate `src/lib/calcom.ts` if a tie-break changes.
2. **Seated booking add.** From two different mailboxes (e.g. gmail + a secondary), open the public workshop detail page and register. Each registrant should receive a cal.com confirmation email with the same Google Meet link. Back on cal.com → same booking from step 1 → confirm the Attendees list now shows 3 entries (Vinay + 2 registrants), all pointing at the same meeting room.
3. **Attendee self-cancel.** Open one registrant's cal.com confirmation email. Click the `Need to make a change? Reschedule or Cancel` link in the footer (the button label is literally those words). On the cancel page, confirm and submit. In PolicyDash, query `select status, cancelled_at from workshop_registrations where email = '<that-email>';` and confirm `status = 'cancelled'`, `cancelled_at` is populated. Other registrants' rows must remain `status='registered'`. Check the `cal-webhook` logs in Inngest / Vercel — **record the BOOKING_CANCELLED payload** and note whether the seat identity was `seatUid`, `seatReferenceUid`, or `uid`.
4. **Root cancel cascade.** In cal.com, https://app.cal.com/bookings?status=upcoming → click the booking → "Cancel" (red button in the header). This fires BOOKING_CANCELLED with the root uid. Confirm every non-cancelled row for this workshop flips to `cancelled` in PolicyDash.
5. **Meeting end.** Wait for the scheduled time, or temporarily reschedule the booking in cal.com to a time ~2 minutes in the future and join the Meet. After the workshop ends, cal.com fires MEETING_ENDED. Confirm in PolicyDash:
   - The workshop row's `status` flips to `completed`.
   - Every attended registrant has `attended_at IS NOT NULL`.
   - One `workshop.feedback.invite` batch appears in Inngest with one entry per attendee.

## Risks & mitigations

- **Cal.com `attendees` endpoint behaviour on seated event types is not explicitly documented.** Mitigation: smoke-test #2 above before declaring the feature shipped. Fallback path: if cal.com rejects the attendee-add on seated event types, fall back to `POST /v2/bookings/{uid}/guests` (hard cap 30/booking — acceptable for Phase-20 seat counts) and reconsider for high-capacity workshops.
- **Cal.com rate limit on `attendees`** — docs mention "5 requests per minute" for some endpoints. Our per-IP / per-email rate limits already cap well below that in practice, but under a burst (e.g. a promoted workshop) we may trip it. Mitigation: if observed, queue the attendee-add through Inngest with backoff instead of calling from the request path.
- **Cal.com seat-cancel webhook payload shape** — may use `uid` or `seatUid`. Mitigation: handler tolerates both in the exact-match fallback; we verify in smoke-test #3 and adjust once.
- **`vinay@konma.io` receives every workshop's calendar invite.** Expected and desired — Vinay is the PolicyDash team contact who needs to be in every workshop by default. Not to be confused with the organizer account `vinit@konma.io`, which never appears as an attendee.

## Rollout

Single PR. Drizzle migration runs first via existing `scripts/apply-all-migrations` flow. No feature flag — no existing users are affected because there are no upcoming workshops.

## Open questions (to be closed during implementation)

None blocking. Smoke tests #2 and #3 confirm two assumptions at deploy time.

### Resolutions from the 2026-04-23 post-review punchlist

- **D-1 (Turnstile on `/api/intake/workshop-register`):** resolved as **add**. The route now takes a `turnstileToken` field, verifies via the shared `src/lib/turnstile.ts#verifyTurnstile` helper, and the `RegisterForm` component embeds `@marsidev/react-turnstile` to obtain the token client-side. The pre-redesign route had no Turnstile; the spec claim at line 90 was aspirational-not-historical. Now accurate.
- **D-2 (drizzle `_journal.json` drift):** resolved as **delete**. The stale `src/db/migrations/meta/_journal.json` was removed. Hand-written SQL migrations remain the source of truth; `src/db/migrations/README.md` documents the convention and `scripts/README.md` documents the applier usage.

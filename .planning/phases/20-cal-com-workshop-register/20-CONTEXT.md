# Phase 20: Cal.com Workshop Register - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Public visitors register for workshops via cal.com embed on `/workshops`. A signed cal.com webhook handler at `/api/webhooks/cal` creates `workshopRegistrations` rows, auto-Clerk-invites unknown emails (async), reflects cancellations/reschedules, and on `MEETING_ENDED` transitions the workshop to `completed`, auto-populates attendance, and emails attendees a deep-link to a pre-filled post-workshop feedback form. Workshop create on the admin side gains async cal.com event-type provisioning. Anchored to ROADMAP §Phase 20 success criteria 1–7 and REQUIREMENTS WS-07, WS-08, WS-09, WS-10, WS-11, WS-15.

Out of scope: anything in Phase 24 (engagement scoring), Phase 25 (full integration smoke), or Phase 17 already (workshop status machine, evidence checklist, recording pipeline, 72h/7d nudges).

</domain>

<decisions>
## Implementation Decisions

### Admin-side cal.com event-type provisioning
- **D-01:** Workshop create stays in the existing tRPC mutation (`src/server/routers/workshop.ts`); cal.com event-type creation is **async via Inngest**. The mutation persists the workshop row with `calcomEventTypeId=null` and emits a `workshop.created` event. An Inngest function `workshopCreated` (new) calls cal.com `eventTypes.create`, then backfills `workshops.calcomEventTypeId`.
- **D-02:** Default cal.com event-type **location is Cal Video** (built-in, zero ops dependency, MEETING_ENDED fires reliably). No per-workshop location selector in this phase.
- **D-03:** Failure mode: workshop row persists even if cal.com create fails. Inngest retry policy mirrors Phase 19 participate-intake — `retries: 3`, 5xx → retry, 4xx → `NonRetriableError`. UI shows the workshop in admin dashboard immediately; the public embed surfaces only after `calcomEventTypeId` is non-null (filter at the listing query level).
- **D-04:** **Single shared cal.com org account** owns all event types. One API key in env (`CAL_API_KEY`). Per-admin OAuth is explicitly out of scope. `workshops.createdBy` remains informational only — does NOT drive cal.com host assignment.

### Public /workshops listing + embed
- **D-05:** UX: **modal popup on Register click**. Card list renders title/description/scheduledAt/spots-left. Click "Register" opens cal.com `<Cal>` inline embed inside a dialog. Lazy-load `@calcom/embed-react` so the public listing render doesn't ship the cal.com bundle.
- **D-06:** Sections: **three sections — Upcoming, Live, Past**. Filtering on `workshops.status` AND `scheduledAt`:
  - Upcoming: `status='upcoming' AND scheduled_at > now()`
  - Live: `status='in_progress'` (also includes recently-started where `now() BETWEEN scheduled_at AND scheduled_at + duration_minutes`)
  - Past: `status='completed' AND scheduled_at < now()` — show a card with title/date and a "View summary" link only if the workshop has an `approved` summary artifact (Phase 17 review gate). Otherwise the past card shows date only, no extra detail.
- **D-07:** Capacity / "X spots left": display **`{capacity − registered_count} spots left`** under each upcoming card. Capacity comes from `workshops.maxSeats` (NEW nullable integer column). If `maxSeats` is null → display nothing (open registration). Registered count is `count(workshopRegistrations) WHERE workshop_id = X AND status != 'cancelled'`. Server-rendered with a 60-second `unstable_cache` tag keyed on workshopId so registrations don't hammer the DB. **Per-workshop capacity is set by the admin in the create form** — add an optional `maxSeats` input.
- **D-08:** Routing: `/workshops` (GET, server-rendered listing) and `/api/webhooks/cal` (POST, signature-verified) added to the proxy `PUBLIC_ROUTES` whitelist following the Phase 19 `/participate` + `/api/intake` pattern. No Clerk redirect for unauthenticated visitors.

### workshopRegistrations schema + unknown-email Clerk invite + attendance
- **D-09:** New table `workshopRegistrations`:
  - `id` uuid PK
  - `workshopId` uuid FK → workshops(id) ON DELETE CASCADE
  - `bookingUid` text NOT NULL (cal.com booking unique key) — **UNIQUE INDEX** for atomic webhook idempotency
  - `email` text NOT NULL
  - `emailHash` text NOT NULL (sha256, mirrors Phase 19 hash pattern for rate-limit/PII handling)
  - `name` text
  - `userId` uuid NULL FK → users(id) — backfilled when Clerk webhook fires `user.created` and `clerk_id` link is established (or matched immediately on email at insert time)
  - `status` enum `registration_status` (`registered` | `cancelled` | `rescheduled`)
  - `cancelledAt` timestamptz NULL
  - `attendedAt` timestamptz NULL — populated by MEETING_ENDED handler
  - `attendanceSource` enum `attendance_source` (`cal_meeting_ended` | `manual` | NULL)
  - `bookingStartTime` timestamptz NOT NULL (from cal.com payload; tracked here so reschedules update it)
  - `createdAt` / `updatedAt` timestamptz NOT NULL
- **D-10:** No separate `workshopAttendance` table. Attendance is just `attendedAt IS NOT NULL` on the registration row. One row per cal.com booking, no joins for "who registered AND attended."
- **D-11:** **Unknown-email Clerk invite is async via Inngest.** Webhook handler verifies HMAC, INSERTs the registration row (idempotent on bookingUid), then emits `workshop.registration.received` event with `{ workshopId, email, emailHash, name, bookingUid, source: 'cal_booking' }`. Returns 200 within ~50ms. New Inngest fn `workshopRegistrationReceivedFn` does the Clerk invite (reusing the exact `participateIntakeFn` pattern: `ignoreExisting: true`, `publicMetadata: { role: 'stakeholder', orgType: null }`) and sends a `sendWorkshopRegistrationEmail` confirmation. Mirrors Phase 19 participate-intake: same retry/error policy, same Pitfall 4 inline triggers.
- **D-12:** **Walk-in handling** (MEETING_ENDED returns an attendee email with no matching `workshopRegistrations` row): synthesize a registration row with `userId=NULL`, `attendedAt=now()`, `attendanceSource='cal_meeting_ended'`, `status='registered'`, generate a synthetic `bookingUid` (`walkin:{workshopId}:{emailHash}`), then enqueue `workshop.registration.received` so the same async Clerk invite + welcome email flow runs. Walk-ins are captured AND onboarded.

### Webhook handler shape
- **D-13:** Route handler: `app/api/webhooks/cal/route.ts`.
  - Read raw body via `await req.text()` **before** any parse (matches `app/api/webhooks/clerk/route.ts` pattern; required so HMAC verification covers the bytes cal.com signed).
  - Verify HMAC-SHA256 using `process.env.CAL_WEBHOOK_SECRET` against the `X-Cal-Signature-256` header (cal.com's documented header). Use `crypto.createHmac('sha256', secret).update(rawBody).digest('hex')` and `crypto.timingSafeEqual` for constant-time comparison.
  - Reject invalid/missing signature with **401 Unauthorized**.
  - Only AFTER verification: `JSON.parse(rawBody)` and route by `triggerEvent`.
- **D-14:** **Subscribed events: BOOKING_CREATED, BOOKING_CANCELLED, BOOKING_RESCHEDULED, MEETING_ENDED.** Handler dispatches:
  - `BOOKING_CREATED` → INSERT registration ON CONFLICT (booking_uid) DO NOTHING; emit `workshop.registration.received` for invite + email.
  - `BOOKING_CANCELLED` → UPDATE registration SET status='cancelled', cancelledAt=now() WHERE booking_uid = $1.
  - `BOOKING_RESCHEDULED` → UPDATE registration SET status='rescheduled', booking_start_time=$new WHERE booking_uid = $1. (cal.com rescheduling preserves the same bookingUid in their flat payload — verify in research.)
  - `MEETING_ENDED` → transition workshop status `in_progress → completed` (also accept `upcoming → completed` for the case where in_progress was never set), iterate `attendees[]`, UPSERT attendance via the D-12 walk-in fallback for unknown emails, emit `workshop.feedback.invite` event per attendee.
  - **flat payload shape — NOT `BOOKING_COMPLETED`** which doesn't exist (per ROADMAP success criterion 6).
- **D-15:** **Idempotency:** rely on the DB `UNIQUE INDEX` on `workshopRegistrations.bookingUid` for BOOKING_CREATED. For MEETING_ENDED, idempotency comes from the workshop status transition itself (already-completed workshop short-circuits) plus `attendedAt IS NULL` guard on attendance UPSERT. **No separate `processedWebhookEvents` table.**

### Post-workshop feedback email + deep-link
- **D-16:** `MEETING_ENDED` handler emits one `workshop.feedback.invite` event **per attendee** with `{ workshopId, email, name, attendeeUserId }`. New Inngest fn `workshopFeedbackInviteFn` does the email send. **Fires immediately on MEETING_ENDED** — decoupled from the Phase 17 moderator summary review gate.
- **D-17:** Deep-link URL: `https://{HOST}/participate?workshopId={uuid}&token={jwt}`.
  - Token is a **signed JWT (HS256)** with payload `{ workshopId, email, exp: now+14d, iat }`, signed with `process.env.WORKSHOP_FEEDBACK_JWT_SECRET`. Reuses the helpers we'd add to `src/lib/auth.ts` or `src/lib/feedback-token.ts` (new). 14-day expiry covers slow respondents.
  - Cal.com replaces variables in the email template at send time only if we use cal.com's email; we don't — Resend sends our own email so the link is interpolated server-side at Inngest fn run time.
- **D-18:** **`/participate` mode-switch.** When `workshopId` query param is present:
  - Server validates the JWT (workshopId match + expiry + email match). On invalid/expired token → render an "expired link" landing.
  - The page renders a **post-workshop feedback form** instead of the intake form: rating (1–5 stars), comment textarea (required, max 4000 chars), optional `sectionId` selector (only sections linked to that workshop via `workshopSectionLinks`).
  - Submit posts to **`/api/intake/workshop-feedback`** (NEW route handler, NOT `/api/intake/participate`). Handler re-validates the token, then in a single DB transaction creates a `feedbackItems` row (`source='workshop'`, `submittedBy=userId from email lookup or null`) and a `workshopFeedbackLinks(workshopId, feedbackId)` row.
  - Turnstile is NOT required on this branch (the JWT token is the proof of legitimacy). Keep Turnstile on the original intake mode.
  - Both modes share the existing public-route whitelist entry `/participate`; no new whitelist line needed.

### Folded Todos
None — todo backlog match returned 0 results for Phase 20.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & requirements
- `.planning/ROADMAP.md` §Phase 20 — Goal, depends-on (Phase 17 + Phase 19), 7 success criteria, requirements WS-07/08/09/10/11/15
- `.planning/REQUIREMENTS.md` §Workshop Lifecycle (extensions) — WS-07 through WS-15 (registration, webhook, attendance, feedback)
- `.planning/REQUIREMENTS.md` §Public Intake On-Ramp — INTAKE-04/05/06 (Clerk invite pattern reused for unknown emails)

### Prior phase artifacts to mirror
- `src/inngest/functions/participate-intake.ts` — **Reference implementation** for the Clerk-invite + welcome-email Inngest function. Pattern: `rateLimit` on emailHash, inline `triggers` (Pitfall 4), 5xx→retry / 4xx→NonRetriableError, `step.run` boundaries.
- `src/inngest/functions/workshop-completed.ts` — Phase 17 nudge fn; same error policy. Phase 20's MEETING_ENDED handler should NOT duplicate this — Phase 17's nudges and Phase 20's transition complement each other.
- `app/api/webhooks/clerk/route.ts` — Webhook signature verification pattern: `await req.text()` BEFORE parse, verify on raw body, reject on bad signature, then JSON.parse.
- `app/api/intake/participate/route.ts` — Public POST route handler pattern (Turnstile, body validation, fire Inngest event, fast 200).
- `src/server/routers/workshop.ts` — Existing admin create mutation; Phase 20 extends it (emit `workshop.created` event after insert) without changing its tRPC contract.

### Schema baseline
- `src/db/schema/workshops.ts` — Existing `workshops`, `workshopArtifacts`, `workshopSectionLinks`, `workshopFeedbackLinks`, `workshopEvidenceChecklist` definitions. Phase 20 adds `calcomEventTypeId text`, `maxSeats integer NULL`, plus the new `workshopRegistrations` table and two new pgEnums.

### Cal.com docs (downstream researcher to fetch)
- Cal.com webhook reference (events: BOOKING_CREATED, BOOKING_CANCELLED, BOOKING_RESCHEDULED, MEETING_ENDED — flat payload shape)
- Cal.com webhook signature header documentation (header name + hex/base64 encoding)
- Cal.com Event Types API (`POST /v2/event-types`) — required fields, location enum, hosts model
- `@calcom/embed-react` modal mode + lazy-load pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/inngest/functions/participate-intake.ts`** — Direct template for `workshopRegistrationReceivedFn`. Copy structure: same Clerk error handling, same rateLimit-on-emailHash pattern (use `event.data.emailHash`), same `sendWelcomeEmail`-style helper.
- **`src/lib/email`** — Add `sendWorkshopRegistrationEmail` and `sendWorkshopFeedbackInviteEmail` next to existing `sendWelcomeEmail`. Reuse Resend client setup (Phase 19 already wired env handling + dev-mode `gated` fallback).
- **`app/api/webhooks/clerk/route.ts`** — Cut-and-adapt for `app/api/webhooks/cal/route.ts`. Same raw-body-read-then-verify-then-parse pattern; swap svix for `crypto.createHmac` + `crypto.timingSafeEqual`.
- **`src/db/schema/workshops.ts`** — Add new fields and tables in this same file to keep workshop-domain schema co-located.
- **`src/server/routers/workshop.ts`** — Existing create mutation insert path is the splice point for emitting `workshop.created`.
- **`workshopFeedbackLinks`** table already exists from Phase 17 (`workshop_id` + `feedback_id` composite PK) — reuse as-is for D-18.

### Established Patterns
- **Inngest Pitfall 4** (Phase 19 participate-intake comment): `triggers` MUST be inlined in `createFunction` options object; do NOT extract to a const or `event.data` collapses to `any`.
- **Async-fast webhook → Inngest event**: Phase 19 used this for `/participate` (POST → emit event → 200 fast → Inngest does Clerk + email). Phase 20 mirrors for `/api/webhooks/cal`.
- **emailHash-keyed rate limiting** via Inngest `rateLimit` (1 per 15m); reuse for `workshopRegistrationReceivedFn` to absorb cal.com webhook retries.
- **Public route whitelist via `proxy.ts`** (Phase 19-05): single config file lists public routes that bypass Clerk middleware.
- **Notification.create via Inngest** (Phase 16 NOTIF-04/05/06): if Phase 20 needs to notify moderators of high registration counts or no-shows, route through `notification.create` event, not direct `createNotification` calls.

### Integration Points
- **`workshops.status`** state machine (Phase 17 `workflowTransitions` audit table): MEETING_ENDED handler MUST go through the existing transition helper so audit log captures the actor (`actor='system:cal-webhook'`) and `to_state='completed'` row is written. Do NOT bypass with raw UPDATE.
- **`workshopCompletedFn`** (Phase 17): already fires 72h + 7d moderator nudges on missing evidence checklist. Phase 20's MEETING_ENDED transition triggers the same `workshop.completed` event Phase 17 listens to — verify Phase 17 actually emits on transition and not on a separate trigger so Phase 20's transition wires up the nudges automatically. (Researcher: confirm or we add the emit.)
- **Clerk webhook `user.created`** (`app/api/webhooks/clerk/route.ts`): when a Clerk-invited stakeholder finishes signup, the upsert-by-clerkId runs. To backfill `workshopRegistrations.userId`, extend that handler to also `UPDATE workshopRegistrations SET userId = $newUserId WHERE email = $email AND userId IS NULL`. One-line add, no new webhook.
- **`feedbackItems`** table (Phase 4): D-18 inserts a row here with `source='workshop'` and the new feedback text. Confirm `feedbackItems.source` enum already has `'workshop'` value or add a migration.
- **`workshopSectionLinks`** (existing) drives the optional sectionId selector in the post-workshop feedback form (D-18) — only show sections linked to the current workshop.

</code_context>

<specifics>
## Specific Ideas

- "Modal popup on Register click" — same UX pattern as Linear/Vercel cal embeds; lazy-load `@calcom/embed-react` only on intent.
- "Spots left" display matches typical event sites; capacity is per-workshop admin input (`maxSeats` NULL = open registration with no number shown).
- "Mode-switch /participate" — same URL, two modes. Workshop feedback mode skips Turnstile because the signed JWT token is the proof of legitimacy. Original intake mode keeps Turnstile.
- Walk-in onboarding: someone who joins the cal.com meeting without registering still gets a Clerk invite and a welcome email — important for capturing real engagement that bypassed the booking flow.

</specifics>

<deferred>
## Deferred Ideas

- **Per-admin cal.com OAuth** so each moderator's calendar drives availability — large extra scope, not Phase 20.
- **Configurable cal.com event-type location per workshop** (Cal Video vs Google Meet vs Zoom) — defer; default Cal Video for all.
- **Public listing infinite scroll / pagination** — Phase 20 ships a single-shot SSR page; if the past-workshops section grows large later, paginate then.
- **Capacity "fully booked" admin alert / waitlist** — out of scope; cal.com's own "fully booked" UI handles the booking-side state.
- **Reschedule/cancel notifications to admins** — beyond Phase 20; could enqueue a `notification.create` event later if needed.
- **No-show analytics / engagement scoring** — explicitly Phase 24 (UX-08–11).
- **Anonymized cal.com payload retention policy** — defer to a security pass; for now we store email + name as cal.com sends them.

### Reviewed Todos (not folded)
None — todo match-phase returned 0 results.

</deferred>

---

*Phase: 20-cal-com-workshop-register*
*Context gathered: 2026-04-14*

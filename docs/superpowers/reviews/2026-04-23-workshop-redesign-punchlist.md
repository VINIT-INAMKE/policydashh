# Workshop Meetings Redesign — Post-Review Punchlist

**Date:** 2026-04-23
**Source spec:** `docs/superpowers/specs/2026-04-21-workshop-meetings-redesign.md`
**Scope:** 25 commits `d2495d8..a63577a`
**Reviews:** two exhaustive passes (spec-compliance + code-quality) surfaced the items below. User direction: "fix every fucking issue no matter how small it is."

---

## Two decisions that gate scope

### D-1. Turnstile on `/api/intake/workshop-register`

- **Spec:** claims Turnstile verification is a preserved guard (`docs/superpowers/specs/2026-04-21-workshop-meetings-redesign.md:90`).
- **Reality:** Never was on this route — pre-redesign code (commit `d2495d8`) already had no Turnstile. Only rate limits.
- **Options:**
  - **(a) Add Turnstile now.** Wire `@marsidev/react-turnstile` into `app/workshops/_components/register-form.tsx`, add `turnstileToken: z.string().min(1)` to the route's Zod schema, call `verifyTurnstile()` (already exists in `src/lib/turnstile.ts`). Mirror the pattern in `app/api/intake/participate/route.ts:142`.
  - **(b) Update the spec** to drop the Turnstile claim and record the intentional deviation.
- **Recommendation:** (a). User confirmed "keep the Cloudflare Turnstile" in brainstorming; they believed it existed. Honour the intent.

### D-2. Drizzle `_journal.json` drift

- **State:** `src/db/migrations/meta/_journal.json` ends at `idx: 11 / 0011_cal_com_workshop_register`. Every migration since (0012–0026) was applied via one-off `scripts/apply-migration-NNNN.mjs` scripts that don't update the journal.
- **Options:**
  - **(a) Regenerate journal** via `drizzle-kit generate`. Risk: may regenerate migration SQL that has drifted from hand-written versions.
  - **(b) Delete the journal** and document "`apply-migration-NNNN.mjs` is the sole source of truth" in `src/db/migrations/README.md`.
  - **(c) Leave as-is.** Pre-existing issue since Phase 11, not introduced by this redesign.
- **Recommendation:** (b). The codebase has committed to hand-written migrations; the journal is misleading vestige.

---

## Fix batches (suggested commit groupings)

Each batch is independent — work in whatever order.

### Batch 1 — Shared constants + helpers

Create `src/lib/calcom-shared.ts` (or extend `src/lib/calcom.ts`):

```ts
export const UID_SAFE = /^[A-Za-z0-9_-]+$/
export const COMPOSITE_BOOKING_UID_DELIMITER = ':'
export const DEFAULT_SEATS_PER_TIME_SLOT = 100
export const WORKSHOP_CREATED_EVENT = 'workshop.created'

export function buildCompositeBookingUid(rootUid: string, attendeeId: number): string {
  return `${rootUid}${COMPOSITE_BOOKING_UID_DELIMITER}${attendeeId}`
}

export function cascadePattern(rootUid: string): string {
  return `${rootUid}${COMPOSITE_BOOKING_UID_DELIMITER}%`
}
```

Replace duplicated literals:
- `app/api/webhooks/cal/route.ts:101` — `const UID_SAFE = ...`
- `src/lib/calcom.ts:323` — inline `/^[A-Za-z0-9_-]+$/` check
- `app/api/intake/workshop-register/route.ts:177` — magic `:` delimiter
- `app/api/webhooks/cal/route.ts:197, 281` — hardcoded `${uid}:%` patterns
- `app/api/webhooks/cal/route.ts:276` — substring arithmetic with hardcoded `+2` offset
- `src/lib/calcom.ts:117` and `src/inngest/functions/workshop-created.ts:100` — magic `?? 100`
- `src/inngest/functions/workshop-created.ts:46` — `'workshop.created'` string literal

Consolidate `seatsPerTimeSlot` field into a shared interface:
```ts
export interface CalSeatsConfig { seatsPerTimeSlot: number }
```
Use on both `CalEventTypeInput` and `CalEventTypePatch`.

### Batch 2 — Webhook handler (`app/api/webhooks/cal/route.ts`)

- **B2-1. Reschedule seatUid fallback.** Line 232 only reads `bookingData.rescheduleUid`. Extend seat-level fallback to OR across `seatUid`/`seatReferenceUid`/`rescheduleUid`, same pattern as BOOKING_CANCELLED. Or narrow the `CalPayload` JSDoc at line 54–63 to specify seat IDs only appear on cancel.
- **B2-2. `newUid` UID_SAFE check.** Line 273 interpolates `newUid` into SQL. Add guard before executing the reschedule to prevent a poisoned newUid.
- **B2-3. Warn log when `hasSeatId` but cascade skipped.** Anomaly observability for issue that `seatUid === rootUid` payload shape could hit (fix #17 from code review). ~3 lines.
- **B2-4. Redundant `?? {}`.** Line 147: `const bookingData: CalPayload = (body.payload ?? (body as unknown as CalPayload)) ?? {}` — drop the trailing `?? {}`.
- **B2-5. Unconditional `revalidateTag` on root cascade.** Line 185 fires even when UPDATE hits zero rows (replay). Minor. Acceptable as-is OR gate on `.returning()` row count — pick one and apply symmetrically across cascade + seat-level branches.
- **B2-6. Rewrite module JSDoc.** Lines 21–42 describe the old exact-match reschedule logic. Update to reflect root-uid probe → LIKE cascade → exact-match fallback, BOOKING_CREATED no-op, seatUid tolerance.
- **B2-7. Replace planning-code references** (D-12 at line 42, 20-RESEARCH.md at lines 36–38). In-code comments should be self-contained.
- **B2-8. Batch walk-in sends.** Lines 425–439 fire `sendWorkshopRegistrationReceived` per attendee in a loop. Batch like the feedback-invite send already does (line 452).
- **B2-9. Skip empty batch.** Line 452 still fires `sendWorkshopFeedbackInvitesBatch([])` when attendees array is empty. Gate on `.length > 0`.
- **B2-10. `CalAttendee.noShow`.** Lines 46–50 declare `noShow` but handler never reads it. Either wire into attendance tracking or remove.
- **B2-11. Seat-candidate trim.** Lines 205–211 filter but don't trim. Add `.trim()` before length check.
- **B2-12. Signature-fail observability.** Line 108 returns 401 on invalid signature silently. Add `console.warn` with trigger + first-8 chars of the sig header.
- **B2-13. Unknown-trigger observability.** `default` case returns 200 silently. Add `console.info` with trigger name.
- **B2-14. Missing test: `seatReferenceUid` payload shape.** Cover the `seatReferenceUid`-only branch (not just `seatUid`).
- **B2-15. Missing test: UID_SAFE fail in cancel path.** Verify `abc%def` falls through to exact-match, not LIKE.
- **B2-16. Missing test: BOOKING_RESCHEDULED seat-level fallback.** Current coverage is root-level only.
- **B2-17. Missing test: unsafe `newUid` in reschedule.**
- **B2-18. Missing test: MEETING_ENDED batch shape.** T11-T16 exist but don't assert `attendeeUserId: null` on the batch payload.

### Batch 3 — Intake route (`app/api/intake/workshop-register/route.ts`)

- **B3-1. Turnstile.** (See D-1.)
- **B3-2. `cleanName` asymmetric defaults.** Line 83: `cleanName || ''`. Line 166 sends `cleanName || 'Guest'` to cal.com; line 187 stores `cleanName || null` in DB. Commit to one convention.
- **B3-3. `ORDER BY` on already-registered lookup.** Lines 104–112. Add `desc(workshopRegistrations.createdAt)` so `.limit(1)` returns the most recent row, not an implementation-defined order.
- **B3-4. Capacity-409 handling.** Lines 170–175 return generic 500 on any CalApiError. If the error is 4xx with capacity signal (match `/seat|full|capacity/i`), return 409 "Workshop is fully booked" so the client can surface a meaningful message.
- **B3-5. `Retry-After` dynamic.** Line 151 hardcodes `'5'`. Use exponential backoff or compute from `workshops.createdAt`: old workshops still unprovisioned should hint longer. Add WARN log if the 503 fires on a workshop created >60s ago.
- **B3-6. Rate-limit 429 from cal.com.** Lines 170–175 don't distinguish 429. Inspect error status; return 429 with `Retry-After`.
- **B3-7. Partial-failure comment split.** Lines 156–164 conflate cal.com-fails vs DB-fails retry-safety reasoning. Split into two comments, one per catch.
- **B3-8. PII in logs.** Lines 229, 173, 196–203, 221–227 log `cleanEmail` at INFO. Downgrade to `emailHash` at INFO; keep raw email only in the ORPHAN error path with a `pii: true` marker.
- **B3-9. Decompose event payload.** Line 213 sends `bookingUid: compositeBookingUid` — opaque to downstream. Either split into `{ rootBookingUid, attendeeId, compositeBookingUid }` or document the shape in `src/inngest/events.ts`.
- **B3-10. Missing tests** — 8 new cases:
  - `addAttendeeToBooking` throws 4xx → 500 response, no ORPHAN log.
  - `addAttendeeToBooking` throws 5xx → 500 response.
  - `db.insert` throws after successful attendee-add → ORPHAN log with all identifiers.
  - `sendWorkshopRegistrationReceived` throws → 200 response with deferred-invite log.
  - Empty-name input → cal.com gets `'Guest'`, DB stores `null`.
  - IP rate limit hit → 429 with `Retry-After`.
  - Email rate limit hit → 429 with `Retry-After`.
  - Already-registered with status='cancelled' → re-registration path.

### Batch 4 — `workshopCreatedFn` + test (`src/inngest/functions/workshop-created.ts`)

- **B4-1. `parseInt` NaN guard.** Line 83: `parseInt(workshop.calcomEventTypeId, 10)` silently yields `NaN` on malformed values. Add `Number.isFinite` check → `NonRetriableError`.
- **B4-2. JSDoc: CAL_PRIMARY_ATTENDEE env deps.** Line 24 mentions `CAL_API_KEY` only. Add the two new required envs.
- **B4-3. JSDoc: hardcoded vinay@konma.io.** Line 14 mentions the email explicitly. Say "primary attendee (configured via CAL_PRIMARY_ATTENDEE_EMAIL; production: vinay@konma.io)".
- **B4-4. Half-provisioned recovery comment.** Line 74: the idempotency guard passes when either id is null. Document the recovery story — manual reset of one id re-emits the event.
- **B4-5. `new Date(workshop.scheduledAt).toISOString()` TZ test.** Line 141. Add a test with a non-UTC timezone that exercises the serialization round-trip.
- **B4-6. Use `env()` singleton.** Line 127: `process.env.CAL_PRIMARY_ATTENDEE_EMAIL` should come from `env().server.CAL_PRIMARY_ATTENDEE_EMAIL` — drops the inline "not set" guard because env.ts validates at boot.
- **B4-7. Missing test: `calcomEventTypeId` populated but `calcomBookingUid` null.** Resume path — no event-type re-creation, booking step runs, backfill writes both.
- **B4-8. Missing test: `CAL_PRIMARY_ATTENDEE_EMAIL` missing.** NonRetriableError path.

### Batch 5 — `src/lib/calcom.ts` cleanup

- **B5-1. Module JSDoc version header.** Line 33 documents only `2024-06-14`. Replace with a per-endpoint table (event-types: 2024-06-14, bookings + attendees: 2024-08-13).
- **B5-2. Broken `20-RESEARCH.md` citation.** Line 29. Remove or move to `docs/`.
- **B5-3. F-code references.** Line 161 references F10. Replace with a path reference (`src/server/routers/workshop.ts`'s update procedure).
- **B5-4. Update module JSDoc for D-02.** Lines 10–14 currently say "(SUPERSEDED 2026-04-21)…switched to Google Meet". OK but verbose. Trim or leave.
- **B5-5. `slug` docstring invariant.** Line 43. Document uniqueness requirement + failure mode.
- **B5-6. Alignment spacing.** `cal-api-version:  '2024-06-14'` has double-space alignment in some functions, single in others. Normalize.
- **B5-7. Use `env()` singleton.** All four functions read `process.env.CAL_API_KEY`. Switch to `env().server.CAL_API_KEY`.
- **B5-8. Seats-lowering validation.** `updateCalEventType` accepts any `seatsPerTimeSlot` including below current attendee count. Either document the accepted behaviour or add a check in `workshop.update` against `currentRegisteredCount`.
- **B5-9. Stale "Cal Video" reference.** Line 331 lists Cal Video in a parenthetical; harmless but can be trimmed.
- **B5-10. `createCalEventType` body shape JSDoc.** Line 34: `Body: { title, slug, lengthInMinutes, locations: [...] }` — missing `length` + `seats`. Update.
- **B5-11. Missing test: `createCalBooking` unsafe uid.** Covers the write-time UID_SAFE guard at line 323.
- **B5-12. Missing tests: `createCalBooking` 4xx/5xx paths.**
- **B5-13. Missing test: `updateCalEventType` with `seatsPerTimeSlot` patch.** The newly-restored field.
- **B5-14. Missing test: `updateCalEventType` empty patch** — early return, no fetch.
- **B5-15. Missing tests: `createCalEventType` 4xx/5xx paths.**

### Batch 6 — Schema + migration

- **B6-1. Drizzle `_journal.json` drift.** (See D-2.)
- **B6-2. DB index on `workshops.calcom_booking_uid`.** Currently full-table scan per cascade lookup. Add:
  ```sql
  CREATE INDEX IF NOT EXISTS workshops_calcom_booking_uid_idx
    ON workshops(calcom_booking_uid)
    WHERE calcom_booking_uid IS NOT NULL;
  ```
  New migration file `0027_workshops_calcom_booking_uid_idx.sql`.
- **B6-3. Schema comment: composite contract.** `src/db/schema/workshops.ts:47-48` doesn't mention that `calcom_booking_uid` is the prefix of every `workshop_registrations.booking_uid` cascade pattern. Extend.
- **B6-4. Timezone input validation.** `src/server/routers/workshop.ts` workshop.create accepts any text timezone. Validate against `Intl.supportedValuesOf('timeZone')` at input time — rejects mistyped `asia/kolkta` before it breaks every downstream cal.com call for that workshop.

### Batch 7 — Test infra

- **B7-1. `tests/setup.ts:19` DATABASE_URL guard.** Add hostname-check in `src/db/index.ts` under `NODE_ENV === 'test'`: refuse to dial when URL contains `db.test.invalid`. Saves debugging hangs.
- **B7-2. `tests/setup.ts:63-65` BLOCKFROST comment.** Explain the `'preview'` prefix requirement and that no real Blockfrost call should fire in tests.
- **B7-3. `tests/phase-20/workshop-register-route.test.ts:67` mock `.then` resolves wrong value.** Should resolve to `[]` (matching drizzle's insert return shape), not the values payload.
- **B7-4. Drizzle Symbol fragility.** `tests/phase-20/cal-webhook-route.test.ts:71-75` relies on `Symbol(drizzle:Name)` string match. Import the symbol directly from drizzle or pin the version.

### Batch 8 — Observability + miscellany

- **B8-1. Stale comment: "Reprovision seats" in workshop router.** `src/server/routers/workshop.ts:151-153` still mentions the removed F15 button.
- **B8-2. `workshop_registrations` text_pattern_ops index.** Cascade LIKE queries hit a hot path on every cancel/reschedule. Consider `CREATE INDEX ... ON workshop_registrations (booking_uid text_pattern_ops)` if workload grows.
- **B8-3. Spec drift: Turnstile claim.** If D-1 resolves as "add it", spec stays accurate. If as "remove it", correct `docs/superpowers/specs/2026-04-21-workshop-meetings-redesign.md:90`.
- **B8-4. Applier script convention docs.** `scripts/apply-migration-0026.mjs` filter strips leading line comments only. Add a `README.md` in `scripts/` documenting the convention: all statements must be `;`-terminated; leading-line-comments allowed only at start of statement.
- **B8-5. Generalized applier.** `scripts/apply-all-migrations.mjs` exists but the redesign's 0026 used a one-off script. Consolidate: delete `scripts/apply-migration-00NN.mjs` scripts in favor of the walk-directory applier, OR document why one-off scripts persist.
- **B8-6. Empty-file `types/calcom-embed-react.d.ts` residue.** Already deleted — verify no tsconfig include path still references it.

### Batch 9 — Spec-side corrections

These live in `docs/superpowers/specs/2026-04-21-workshop-meetings-redesign.md`:

- **B9-1. Turnstile claim (line 90).** Either add Turnstile (D-1a) and leave spec intact, or delete the line.
- **B9-2. Smoke-test runbook detail.** Spec's 5 smoke tests are high-level; add step-by-step instructions so a human unfamiliar with cal.com can run them:
  - Which cal.com dashboard view to open
  - What field labels to look for
  - How to trigger an attendee self-cancel (which button, which email)
- **B9-3. Open questions — record resolutions.** When D-1 and D-2 resolve, note the resolution in the spec's Open Questions section.

---

## Items acknowledged but intentionally deferred

- Cardano anchoring / research module `it.todo(...)` placeholders — 98 count, unrelated to this redesign.
- Pre-existing 229 lint errors — baseline unchanged by redesign.
- Live-cal.com smoke tests #1 and #3 — require real workshop against prod workspace.

---

## Tracking

25 issues explicit + ~19 missing tests + 2 scope decisions = 46 actionable line items.

On fresh session start, read this file, resolve D-1 and D-2, then burn through batches. Each batch is a commit. No batch depends on another — any order works.

Current HEAD at punchlist-write time: `a63577a`.

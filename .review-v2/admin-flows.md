# Admin + Audit Flows Review

## D1: `listRegistrations` exposes attendee PII to all roles with `workshop:read`
**File:** `src/lib/permissions.ts:71` / `src/server/routers/workshop.ts:766`
**Severity:** HIGH
**Impact:** `workshop:read` includes `stakeholder`, `observer`, `research_lead`, and `auditor`. All of these roles can call `workshop.listRegistrations` and receive registrant email addresses, names, booking UIDs, and attendance timestamps. The router comment acknowledges "attendee PII is admin-grade" but then gates it on `workshop:read` which is wide-open. A stakeholder with a known workshop ID can enumerate all attendees.
**Suggested fix:** Create a new `workshop:read_attendees` permission restricted to `[ADMIN, WORKSHOP_MODERATOR]` and gate `listRegistrations` on it instead of `workshop:read`.

---

## D2: `listUsers` returns soft-deleted (anonymized) users
**File:** `src/server/routers/user.ts:298-303`
**Severity:** HIGH
**Impact:** `user.listUsers` uses `findMany` with no `deletedAt IS NULL` filter. Users whose Clerk account was deleted get anonymized rows (null email/name, sentinel clerkId) but those rows still appear in the admin user management table — as blank rows with no email and no name, potentially confusing admins who may try to change their role. More importantly, the last-admin count at line 253 also lacks a `deletedAt IS NULL` filter, meaning a soft-deleted admin is counted in the live admin total, making the last-admin guard bypassable: if the only real admin deletes their Clerk account (anonymizing the row but keeping `role='admin'`), the count stays at 1 and the guard blocks any other user from being promoted.
**Suggested fix:** Add `isNull(users.deletedAt)` to `listUsers`, `checkEmailExists`, and the admin-count query in `updateRole`.

---

## D3: tRPC context loads deleted users — soft-deleted account can still authenticate
**File:** `src/trpc/init.ts:15`
**Severity:** HIGH
**Impact:** `createTRPCContext` resolves `db.query.users.findFirst({ where: eq(users.clerkId, userId) })` with no `deletedAt IS NULL` guard. The sentinel `clerkId` format (`deleted:<id>:<ts>`) makes a collision unlikely, but if a Clerk account were deleted and then the clerkId sentinel were somehow reused, the deleted row could match. More concretely, when Clerk signals deletion via webhook the row is anonymized immediately. However if the webhook fires after the Clerk session is already active, the user can keep calling tRPC procedures (including admin mutations) until their Clerk token expires, because the context does not check `deletedAt`. Export routes at `app/api/export/traceability/csv/route.ts:48` and `pdf/route.tsx:45` have the same gap.
**Suggested fix:** Add `isNull(users.deletedAt)` to the `findFirst` in `createTRPCContext` and in both export route auth lookups.

---

## D4: `reprovisionCalSeats` has no audit log
**File:** `src/server/routers/workshop.ts:108-136`
**Severity:** MEDIUM
**Impact:** Every other admin mutation in the workshop router writes an audit entry. `reprovisionCalSeats` makes an external cal.com API call to modify seat capacity but writes no audit log — so there is no record of when this was done, by whom, or what the previous/new capacity was. Evidence packs relying on the audit trail will miss these events.
**Suggested fix:** Add `writeAuditLog(...)` with `ACTIONS.WORKSHOP_UPDATE` (or a new `WORKSHOP_REPROVISION_CAL`) before the return, carrying `{ workshopId, seatsPerTimeSlot }`.

---

## D5: `workshop.transition` sends `moderatorId: existing.createdBy`, not the acting user
**File:** `src/server/routers/workshop.ts:723-726`
**Severity:** MEDIUM
**Impact:** When an admin (not the original creator) transitions a workshop to `completed`, the `workshop.completed` Inngest event is fired with `moderatorId: existing.createdBy`. This routes the evidence nudge emails to the *creator*, not the admin who performed the transition. If the workshop was later reassigned or the creator has left, the nudge goes to the wrong person (or no-one, if their email was anonymized).
**Suggested fix:** Pass `moderatorId: ctx.user.id` instead of `existing.createdBy`.

---

## D6: `revokeInvitation` audit log uses `ACTIONS.USER_INVITE` — wrong action name
**File:** `src/server/routers/user.ts:170`
**Severity:** MEDIUM
**Impact:** All three invitation procs (`invite`, `revokeInvitation`, `resendInvitation`) emit `action: ACTIONS.USER_INVITE`. An auditor filtering by action cannot distinguish "invitation sent" from "invitation revoked" from "invitation resent". The `ACTIONS` map has no `USER_INVITE_REVOKE` or `USER_INVITE_RESEND` constant, so the distinction is lost in the audit log.
**Suggested fix:** Add `USER_INVITE_REVOKE` and `USER_INVITE_RESEND` constants to `ACTIONS` in `src/lib/constants.ts` and use them in the respective audit log calls.

---

## D7: Audit log `list` has no total-count — pagination "Next" disables on exact page boundary
**File:** `src/server/routers/audit.ts:20-40` / `app/audit/_components/audit-event-table.tsx:222`
**Severity:** MEDIUM
**Impact:** `audit.list` returns only the current page's rows without a `totalCount`. The "Next" button in `AuditEventTable` is disabled when `events.length < pageSize`. This means if the last page happens to be exactly `pageSize` records, the "Next" button stays enabled and clicking it returns an empty page — the auditor sees the blank "No results" state instead of a proper end-of-list message. Conversely, if filtering yields exactly 50 results on page 0, the user is misled into thinking there are more.
**Suggested fix:** Add a parallel `count()` query in `audit.list` (and `audit.listMine`) and return `{ events, totalCount }`. Use `totalCount` to compute `hasNextPage` in the table.

---

## D8: `PARTICIPATE_INTAKE` action constant is a raw string literal, not in `ACTIONS`
**File:** `src/inngest/functions/participate-intake.ts:124`
**Severity:** MEDIUM
**Impact:** The audit write uses `action: 'PARTICIPATE_INTAKE'` (a string literal) instead of `ACTIONS.PARTICIPATE_INTAKE`. The value `'PARTICIPATE_INTAKE'` does not exist in the `ACTIONS` constant map in `src/lib/constants.ts`. This means: (1) the audit filter panel's dropdown will never surface this action since it is built from `Object.entries(ACTIONS)`; (2) type-safety is bypassed — any typo here silently produces an unrecognized action in the log; (3) future code searching for `ACTIONS.PARTICIPATE_INTAKE` won't find the emit site.
**Suggested fix:** Add `PARTICIPATE_INTAKE: 'participate_intake'` to the `ACTIONS` constant and replace the literal in `participate-intake.ts`.

---

## D9: `milestoneReadyFn` and `versionAnchorFn` hardcode `actorRole: 'admin'`
**File:** `src/inngest/functions/milestone-ready.ts:209,272,286` / `src/inngest/functions/version-anchor.ts:144`
**Severity:** MEDIUM
**Impact:** Both anchor Inngest functions write audit logs with `actorRole: 'admin'` unconditionally. The triggering user is identified by `triggeredBy`/`createdBy` UUID, but if that user holds `policy_lead` (which also has `milestone:manage` permission and can call `markReady`), the audit log will incorrectly record `actorRole: 'admin'`. This mirrors the B15 issue that was fixed for `evidence-pack-export.ts`. Auditors relying on role attribution in the Cardano anchor audit trail will see wrong data.
**Suggested fix:** Resolve the actor's role from the users table inside each step (same pattern as `evidence-pack-export.ts` step 6), and fall back to `'unknown'` only when the user row is missing.

---

## D10: Audit `list` filter accepts free-text `action` string — no validation
**File:** `src/server/routers/audit.ts:13`
**Severity:** MEDIUM
**Impact:** The `action` filter field accepts any `z.string().optional()` value. An auditor (or a compromised auditor session) can pass arbitrary strings that produce no results without any server-side validation that the value is a known action. More practically, the filter panel sends the literal value from the Select dropdown which is already validated client-side; however, a direct tRPC call can supply any string and the server will silently return empty results with no error. There is also no `actorId` validation (accepts any string, not a UUID), making it trivially possible to bypass the filter accidentally.
**Suggested fix:** Constrain `action` to `z.enum([...Object.values(ACTIONS)]).optional()` and `actorId` to `z.string().uuid().optional()`.

---

## D11: `evidence-pack` decision log exposes internal `entityId` UUIDs for workflow transitions
**File:** `src/server/services/evidence-pack.service.ts:239-251`
**Severity:** MEDIUM
**Impact:** `decision-log.json` maps actor UUIDs to roles (SECURITY comment at line 225) but still emits raw `entityId` values which are internal feedback/CR UUIDs. Those UUIDs are not human-readable audit references — they are internal database keys. More critically, the `rationale` field maps directly from `workflowTransitions.metadata` (a JSONB blob) with no sanitization. If any moderator previously stored rich metadata in a transition (e.g., containing submitter identity fields from an older code path), that data would appear verbatim in the exported evidence pack.
**Suggested fix:** Strip the `rationale`/`metadata` field to a allowlist of safe keys (e.g., `{ decision, comment }`), or at minimum document that `metadata` may contain PII and add a pre-export scrub.

---

## D12: `DeleteWorkshopDialog` always passes `force: undefined` — server rejects when active registrations exist with no user-facing recovery
**File:** `app/workshop-manage/_components/delete-workshop-dialog.tsx:55`
**Severity:** MEDIUM
**Impact:** `deleteMutation.mutate({ workshopId })` never passes `force: true`. When a workshop has active registrations the server throws `BAD_REQUEST` with the active count. The dialog's `onError` handler shows a generic toast: `"Could not delete the workshop. Try again."` — the specific count is lost. The admin has no way to force-delete from the UI even if they intend to; they are stuck. The `force` path exists in the router but is unreachable from the product UI.
**Suggested fix:** On the `BAD_REQUEST` error from the server, parse the active registration count from `error.message`, show a second confirmation ("This workshop has N active registrations. Delete anyway?") and re-invoke the mutation with `force: true`.

---

## D13: `workshop.update` audit log only records `{ title }`, not the full diff
**File:** `src/server/routers/workshop.ts:353-360`
**Severity:** LOW
**Impact:** The update mutation accepts changes to `title`, `description`, `scheduledAt`, `durationMinutes`, `registrationLink`, `maxSeats`, and `timezone` but the audit payload only includes `{ title: updated.title }`. Changes to maxSeats, scheduledAt, and timezone are never captured in the audit trail. Evidence packs and compliance reviewers cannot reconstruct the workshop's change history.
**Suggested fix:** Capture a `before`/`after` diff of all mutable fields in the audit payload, matching the pattern used by `user.updateProfile` (C11).

---

## D14: `evidence-pack` stakeholders CSV leaks real names when `isAnonymous=true` but user filed a later non-anonymous submission
**File:** `src/server/services/evidence-pack.service.ts:82-88`
**Severity:** LOW
**Impact:** The aggregation logic deliberately de-anonymizes a submitter if *any* of their submissions is non-anonymous (`if (!row.isAnonymous) existing.anonymous = false; existing.name = row.name`). This is a deliberate design choice (comment says "signed rows dominate"), but it means a user who initially submitted anonymously and later submitted a signed piece of feedback will have their real name surfaced in the exported evidence pack's stakeholders list against the count that includes their anonymous feedback. Depending on jurisdiction, this may constitute re-identification of what the user intended to be an anonymous submission.
**Suggested fix:** Only count non-anonymous feedback items in the "de-anonymized" aggregate, or document the policy explicitly in the evidence pack INDEX.md so auditors are aware.

---

## D15: `audit.list` and `audit.listMine` accept `from`/`to` as arbitrary datetime strings with no inversion check
**File:** `src/server/routers/audit.ts:28-29`
**Severity:** LOW
**Impact:** The traceability CSV/PDF routes (fixed in D7) validate that `from <= to` and return HTTP 400 on inversion. The `audit.list` tRPC procedure does not — passing `from` after `to` silently returns no results with no error. An auditor debugging an empty audit view will waste time before realizing their date inputs are inverted.
**Suggested fix:** Add a `from > to` check that throws `BAD_REQUEST` with a message matching the traceability route pattern.

---

## D16: `consultationSummaryGenerateFn` full-replace write races with concurrent `approveSection` calls
**File:** `src/inngest/functions/consultation-summary-generate.ts:188-197`
**Severity:** LOW
**Impact:** Step 4 (`persist-summary`) writes the full `consultationSummary` JSONB with `{ ...payload }` as a complete replacement. If a moderator calls `approveSection` or `editSection` between the last `generate-section-*` step completing and `persist-summary` executing, the Inngest step overwrites the moderator's change. The comment in the function acknowledges "full document replace" but calls it "no jsonb_set partial patches — avoids Pitfall 5 race." In reality, the race is the opposite direction: concurrent human edits between the last section step and the persist step are silently clobbered.
**Suggested fix:** The `persist-summary` step should read the current JSONB, merge only the `overrideOnly` sections from the new results, and preserve sections whose `status === 'approved'` or `edited === true`. This is especially important for the regen flow.

---

## D17: `listUsers` exposes `deletedAt`, `clerkId`, `lastActivityAt`, `lastVisitedAt` to admin UI — no column projection
**File:** `src/server/routers/user.ts:299-302`
**Severity:** LOW
**Impact:** `findMany` with no `columns` projection returns the full row, including `clerkId` (the sentinel or live Clerk ID), `deletedAt`, `lastActivityAt`, `lastVisitedAt`, and `phone`. The admin UI in `users-client.tsx` only renders name, email, role, orgType, and createdAt — so the extra fields are dead weight on the wire but they also expose `clerkId` (sensitive internal ID) and the phone number to the browser. If the API response is ever cached, sniffed, or leaked, those fields become attack surface.
**Suggested fix:** Add an explicit `columns` projection in `listUsers` returning only the fields actually rendered in the UI.

---

## D18: Evidence-pack export has no per-document or per-user rate limit
**File:** `src/server/routers/evidence.ts:270-313`
**Severity:** LOW
**Impact:** `evidence.requestExport` fires an Inngest job that builds a full ZIP of all document evidence and uploads it to R2. There is no rate limit — an admin or auditor can queue an unlimited number of concurrent exports for the same document. Each run performs multiple DB queries, fetches binaries from R2, re-assembles a ZIP, and performs a PutObject to R2. A simple loop could exhaust DB connections, R2 bandwidth, and Inngest concurrency budget. The function has `retries: 2` but no concurrency limit.
**Suggested fix:** Add a `concurrency: { key: 'evidence-pack-export-${event.data.documentId}', limit: 1 }` or implement a tRPC-level rate limit (using the existing `src/lib/rate-limit.ts`) keyed by `userId`.

---

## D19: `consultation-summary.regen` Inngest event has no idempotency key — rapid re-sends queue multiple runs
**File:** `src/inngest/events.ts:409-415` / `src/server/routers/consultation-summary.ts:303-308`
**Severity:** LOW
**Impact:** The `regenerateSection` router proc resets the section to `pending` then calls `sendConsultationSummaryRegen`. If the moderator double-clicks the Regenerate button, two events are queued. Both runs perform the full LLM call for the section. The second run will overwrite the first's output in `persist-summary`, which may produce inconsistent results (especially if one run hits the guardrail and the other doesn't). Unlike `feedbackReviewedFn` which is debounced by the xstate machine, there is no dedup mechanism here.
**Suggested fix:** Add `idempotencyKey: `regen-${versionId}-${sectionId}-${Date.now()}-bucketed`` (bucketed to ~5s) or add an in-DB guard that skips the Inngest send when the section is already `pending`.

---

## D20: `versionAnchorFn` audit log reuses `ACTIONS.MILESTONE_ANCHOR_FAIL` for version anchor failure
**File:** `src/inngest/functions/version-anchor.ts:145`
**Severity:** LOW
**Impact:** The comment at line 136 acknowledges "We reuse MILESTONE_ANCHOR_FAIL." An auditor filtering by action `milestone.anchor_fail` will receive both milestone and version anchor failures in the same result set. The `entityType` differentiates them (`'milestone'` vs `'document_version'`), but the audit filter panel's entity type dropdown has `'document_version'` as an option — so this is workable. The real risk is that an admin monitoring for milestone anchoring failures via alert rules on the action name will also get version anchor failures, or vice versa, depending on how they set up their filter.
**Suggested fix:** Add `VERSION_ANCHOR_FAIL: 'version.anchor_fail'` to `ACTIONS` and use it in `versionAnchorFn`.

---

## D21: Workshop attendee list (`AttendeeList`) is rendered unconditionally — any authenticated user who navigates to `/workshop-manage/<id>` can see PII
**File:** `app/workshop-manage/[id]/page.tsx:320-323`
**Severity:** HIGH
**Impact:** The `WorkshopDetailPage` fetches `user.getMe` and sets `canManage` based on role. The Artifacts tab correctly passes `canManage` to `ArtifactList`. However the Attendees tab renders `<AttendeeList workshopId={workshopId} />` unconditionally — no `canManage` or role check wraps it in the JSX. Any authenticated user who knows the workshop UUID and accesses `/workshop-manage/<id>` (the route has no server-side auth guard; the page itself is `'use client'`) can load the page, click the Attendees tab, and see all registrant emails/names/bookings. The tRPC guard (`workshop:read`) includes stakeholder, observer, research_lead, and auditor, so the server will serve the data.
**Suggested fix:** Wrap the Attendees `TabsContent` in a `{canManage && ...}` block, or create a dedicated `workshop:read_attendees` permission (see D1) and check it before rendering the tab.

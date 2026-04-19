# PolicyDash Fix-It List

Status key: `[ ]` pending, `[~]` in progress, `[x]` done, `[-]` intentionally skipped (with reason)

Generated from 6-domain code review on 2026-04-19. Numbering is stable — do not renumber, only append.

---

## A. SYSTEMIC / CROSS-CUTTING

### A1. Notification deep-link 404s
- [x] A1.1 Created `app/feedback/[id]/page.tsx` role-aware redirect (reviewers → policy inbox `?selected=`, submitters → `/feedback?tab=outcomes&selected=`). Inbox now honors `?selected=`.
- [x] A1.2 Evidence-gaps "Attach Evidence" CTA → `/feedback/${claim.id}` (role-aware redirect).
- [x] A1.3 Created `app/change-requests/[id]/page.tsx` redirect to `/policies/${documentId}/change-requests/${id}`.
- [x] A1.4 Removed broken "View summary" CTA from workshop cards; replaced with informational text.
- [x] A1.5 Created `app/policies/[id]/sections/[sectionId]/page.tsx` redirect to `/policies/[id]?section=...`; detail page honors `section` query.
- [x] A1.6 Created `app/policies/[id]/versions/[versionId]/page.tsx` redirect to `?v=`; versions page honors `v` query (falls back to latest).

### A2. Tiptap renderer gaps
- [x] A2.1 Added `sanitizeHref` + allowlist; link/image hrefs fall back to `#` for unsafe protocols in HTML renderer; mirrored in PDF renderer.
- [x] A2.2 HTML renderer now handles `fileAttachment`, `linkPreview`, `details`, `detailsSummary`, `detailsContent`.
- [x] A2.3 PDF renderer now handles `table/row/cell/header`, `fileAttachment`, `linkPreview`, `details/summary/content`.
- [ ] A2.4 `renderTiptapToText` dead code — deferred to A5 cleanup.

### A3. Email dispatch routing
- [x] A3.1 `version_published` now routed through `sendVersionPublishedEmail` in dispatcher switch.
- [x] A3.2 `section_assigned` now routed through `sendSectionAssignedEmail`; feedback-type fallback preserved as default.
- [ ] A3.3 Remove unused `createNotification` import in `src/server/routers/feedback.ts:15` — pending A5.

### A4. `.env.example` + docs
- [x] A4.1 Added `NEXT_PUBLIC_APP_URL`, `APP_BASE_URL`, `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, `CAL_API_KEY`, `CAL_WEBHOOK_SECRET`.
- [x] A4.2 R2_PUBLIC_URL comment updated to instruct public domain + custom-domain setup steps.

### A5. Dead-code removal (only after verifying zero real callers)
- [ ] A5.1 `app/workshops/_components/cal-embed-modal.tsx` + `cal-embed.tsx` — delete (workshop-card uses `RegisterForm`).
- [ ] A5.2 `app/feedback/outcomes/_components/outcomes-list.tsx` — delete; `/feedback/outcomes` already redirects to `/feedback?tab=outcomes`.
- [ ] A5.3 `app/framework/_components/section-status-badge.tsx` — delete if still unused after other fixes.
- [ ] A5.4 `src/server/routers/user.ts` — delete `listUsersWithEngagement`, `getUserProfile`, `getMe`, and the `name` branch of `updateProfile` (unless any gets a caller through later fixes).
- [ ] A5.5 `src/server/routers/workshop.ts` — either wire `reprovisionCalSeats` into an admin action or delete.
- [ ] A5.6 `src/lib/notifications.ts` — `createNotification` helper; remove file if no callers after A3.3.
- [ ] A5.7 `src/server/rbac/section-access.ts:12` — remove `BYPASS_SECTION_SCOPE` export (keep internal if still used internally).
- [ ] A5.8 Schema stale fields (decide: wire up or drop): `evidenceArtifacts.content`, `documentVersions.anchoredAt`, `documentVersions.txHash`, `feedbackItems.resolvedInVersionId`, `feedbackItems.source`, `feedbackItems.milestoneId`, `workshopArtifactType.'attendance'`. Dropping any requires a migration — pick per-field action.

---

## B. SECURITY / DATA INTEGRITY

- [x] B1. Gated public PDF on `policyDocuments.isPublicDraft` AND `documentVersions.isPublished`; added per-IP in-memory rate limit (10/min, x-forwarded-for aware). File: `app/api/export/policy-pdf/[versionId]/route.tsx`.
- [x] B2. Replaced `db.transaction()` in `createDraftCRFromFeedback` with sequential writes + feedbackId-keyed idempotency guard; link inserts use `.onConflictDoNothing()` against the existing UNIQUE(crId,feedbackId)/UNIQUE(crId,sectionId) indexes. Documented "eventually consistent" semantics inline. File: `src/inngest/lib/create-draft-cr.ts`.
- [x] B3. `mergeCR` now documents "eventually consistent" retry semantics and adds per-step idempotency guards: early-return if CR already merged, dedupe document_versions insert by `cr_id`, flip CR only when `status='approved'` (concurrent-safe), skip feedback rows already pointing at the new version, skip workflow_transitions insert when a merge row exists. File: `src/server/services/changeRequest.service.ts`.
- [x] B4. Added `hasPublishedVersion(documentId)` pre-check in `createSection`, `renameSection`, `updateSectionContent`, `deleteSection` — returns FORBIDDEN once any published version exists. File: `src/server/routers/document.ts`.
- [x] B5. Policy delete now pre-counts blockers (versions, changeRequests, feedback, milestones) and throws `PRECONDITION_FAILED` with counts in the message + JSON-in-cause payload. Delete dialog parses and displays the blocker list. Files: `src/server/routers/document.ts` delete, `app/policies/_components/delete-policy-dialog.tsx`.
- [x] B6. Admin self-demotion + last-admin guards on `user.updateRole` — self→non-admin throws FORBIDDEN; admin-count check before demoting any admin blocks drop-to-zero. File: `src/server/routers/user.ts`.
- [x] B7. Added owner-check on `changeRequest.merge` mirroring the `approve` self-check — throws FORBIDDEN when `ownerId === ctx.user.id`. File: `src/server/routers/changeRequest.ts`.
- [x] B8. Clerk `user.updated` now only writes the role when `publicMetadata.role` matches a valid enum value (preserves prior role otherwise on upsert); role deltas emit a `user.role_assign` audit event with `source: 'clerk_webhook'`. File: `app/api/webhooks/clerk/route.ts`.
- [x] B9. Added `users.deletedAt` column (migration `0019_user_soft_delete.sql`) + `user.deleted` handler that anonymizes the row (nulls email/phone/name, rewrites `clerkId` to a `deleted:<id>:<ts>` sentinel so the UNIQUE index still holds, sets `deletedAt`). FK references remain intact; original email is freed for re-invite. Audit log emitted. Files: `app/api/webhooks/clerk/route.ts`, `src/db/schema/users.ts`, `src/db/migrations/0019_user_soft_delete.sql`.
- [~] B10. Partial — body-size caps on three intake routes: `workshop-register` (16 KB), `participate` (64 KB), `workshop-feedback` (64 KB). Remaining: `/api/upload` (other agent).
- [~] B11. `src/lib/rate-limit.ts` applied to `/api/intake/workshop-register` (per-IP + per-email) and `/api/intake/workshop-feedback` (10/min per-IP + 5/min per-token-hash).
- [x] B12. `/api/upload` presign now rate-limited per Clerk user (20 req/min) via `src/lib/rate-limit.ts#consume`. TODO comment replaced.
- [x] B13. Workshop-feedback JWT token replay prevented by SHA-256 hashing the token into `workshop_feedback_token_nonces` on successful submit; subsequent submissions carrying the same token are rejected 401. New schema table + migration `0017_workshop_feedback_token_nonces.sql` + `scripts/apply-migration-0017.mjs`. Files: `src/db/schema/feedback.ts`, `src/lib/feedback-token.ts` (`hashFeedbackToken`), `app/api/intake/workshop-feedback/route.ts`.
- [x] B14. `readableId` now generated via `nextval('feedback_id_seq')` (same path as authenticated `feedback.submit`) — no more `Date.now()` base-36 collisions. File: `app/api/intake/workshop-feedback/route.ts`.
- [x] B15. `evidence:requestExport` audit event hard-codes `actorRole: 'auditor'` — read from session. File: `src/inngest/functions/evidence-pack-export.ts:343`.

---

## C. AUTH & USERS

- [x] C1. Hid `/users` nav link for `policy_lead` in `adaptive-header-client.tsx` so it matches the admin-only server guards; permissions matrix stays admin-only for `user:list`. File: `app/_components/adaptive-header-client.tsx`.
- [x] C2. Added `AlertDialog`-based role-change confirmation in the users table. Selecting a new role stages a `PendingRoleChange`; nothing mutates until the admin confirms. File: `app/users/_components/users-client.tsx`.
- [x] C3. Invite dialog now validates email shape client-side + debounces a `user.checkEmailExists` tRPC query (added, admin-gated) to flag users that already exist before hitting Clerk. Files: `app/users/_components/invite-user-dialog.tsx`, `src/server/routers/user.ts`.
- [x] C4. Added `user.listPendingInvitations / revokeInvitation / resendInvitation` tRPC procedures and a `PendingInvitationsTable` rendered on `/users`. Resend is implemented as revoke+recreate (Clerk has no explicit resend endpoint). Files: `src/server/routers/user.ts`, `app/users/_components/pending-invitations-table.tsx`, `app/users/_components/users-client.tsx`.
- [x] C5. Setup page: hard cap at 120s, shows an actionable timeout state with Try again (restarts polling) and Sign out (via `useClerk().signOut({ redirectUrl: '/sign-in' })`). Countdown displayed after 60s. File: `app/setup/page.tsx`.
- [x] C6. `/api/auth/check` now returns `stalenessSeconds` derived from Clerk `sessionClaims.iat` (fallback 0 if claim missing). File: `app/api/auth/check/route.ts`.
- [x] C7. tRPC `errorFormatter` now checks `error.cause instanceof z.ZodError` and returns `{ issues, tree }` (zod v4 `treeifyError`). File: `src/trpc/init.ts`.
- [x] C8. `touchActivity` middleware logs failures via `console.warn('[trpc] touchActivity failed', err)` instead of silently swallowing. File: `src/trpc/init.ts`.
- [x] C9. `UsersPage` + `UserProfilePage` now redirect unauthenticated users to `/sign-in` (not `/dashboard`). Admin-role guard still redirects to `/dashboard`. Files: `app/users/page.tsx`, `app/users/[id]/page.tsx`.
- [x] C10. Profile Feedback Submitted card: header now shows a `View all (n)` link to `/feedback?submitter=<id>` when any feedback exists, and a `Showing latest N of M` footer when total > 20. File: `app/users/[id]/page.tsx`.
- [x] C11. `updateProfile` audit payload now merges prior row + input so `after` reflects the full post-state — both sides carry the same keys. File: `src/server/routers/user.ts`.
- [x] C12. Added `audit:read_own` permission (all authenticated roles) and `audit.listMine` procedure that scopes by `actorId = ctx.user.id`. Files: `src/lib/permissions.ts`, `src/server/routers/audit.ts`.

---

## D. POLICY LIFECYCLE

- [x] D1. Added `evidence.listByDocument` (dedup join on `sectionEvidence` + `feedbackEvidence`) and wired the milestone Evidence tab to use it. Rows now render real artifacts with per-row `attached` state.
- [x] D2. Milestone Workshops tab now filters to workshops either unattached, attached to this milestone, or attached to a sibling milestone of the same document.
- [x] D3. `milestone.markReady` now embeds a `<MARK_READY_META>{...}` JSON sidecar in the error message; client parses it in `milestone-detail-header.tsx`. Coupling with `src/trpc/init.ts` documented.
- [x] D4. Already shipped — `retryAnchor` proc + `RetryAnchorButton` render when `status === 'anchoring'`. Permanent fail path also emits admin notification in `milestone-ready.ts`.
- [x] D5. Traceability matrix now accepts `orgTypes` + `decisionOutcomes` arrays via `inArray`; CSV/PDF exporters accept repeated `orgTypes=`/`decisionOutcomes=` params (+ backward-compat for legacy singular keys); page + export-actions serialize full selections.
- [x] D6. Traceability version-range filters (matrix + CSV + PDF) now wrap `gte/lte(documentVersions.createdAt, ...)` with `OR IS NULL` so un-merged feedback isn't silently dropped by the left join.
- [x] D7. Server rejects `from > to` with `BAD_REQUEST` + friendly message; CSV + PDF routes also refuse with 400.
- [x] D8. Documented `feedbackIds` canonical shape as *readable id* (human-facing) via JSDoc on `ChangelogEntry`. UI (`version-changelog.tsx`) was already rendering the readable ID correctly.
- [x] D9. `PublishDialog` now receives `documentTitle` from `VersionHistoryPage` via `VersionDetail`. Already renders the title next to the version label.
- [x] D10. Publish fan-out now uses `Promise.allSettled`; rejections log without failing the whole dispatch.
- [x] D11. Matrix table: feedback cell links `?selected=${feedbackId}`, section cell links `?section=${sectionId}`, version cell includes `?v=${versionId}`.
- [x] D12. Milestones page now fetches `user.getMe`, hides Create button for non-admin/policy_lead, and passes `canManage` to `MilestoneList`.
- [x] D13. `document.update` now accepts `description: z.string().max(1000).nullable().optional()` — explicit `null` clears the field, `undefined` leaves it alone.
- [x] D14. Added a tiny pub/sub tracker (`app/policies/[id]/_components/section-autosave-pending.ts`); block-editor reports pending on each keystroke and flushed on success/unmount; `CreateVersionDialog` subscribes, disables the Create button while pending > 0, and shows an amber warning.
- [x] D15. `VersionComparisonSelector` auto-select first section moved from `useMemo` to `useEffect`.
- [x] D16. Breadcrumb "Back to policy" / "Back to milestones" added to milestones list and detail pages.
- [x] D17. `VersionHistoryPage` now shows the empty state first when `versions.length === 0`, regardless of `selectedVersionId`.
- [x] D18. Removed unused `force` re-render state in milestone detail page; tabs' `utils.milestone.getById.invalidate()` already re-renders.
- [x] D19. Renamed traceability `sectionChain.mergedAt` → `versionCreatedAt` in router output + `section-chain-view.tsx` consumer.
- [x] D20. Zod schema + UI input both cap slot requirements at 50 per entity type.
- [x] D21. `document.list` now sorts by `createdAt desc` (stable) and `setPublicDraft` no longer bumps `updatedAt`.
- [x] D22. `PublicDraftToggle` now opens a confirm AlertDialog when flipping from off → on; disabling stays one-click. Copy explains `/framework` visibility + public PDF implication.
- [x] D23. `updateSectionContent` now emits one `SECTION_CONTENT_UPDATE` audit entry per section per 60s window (in-memory throttle). Added `ACTIONS.SECTION_CONTENT_UPDATE` constant.

---

## E. FEEDBACK & PARTICIPATION

- [x] E1. Added `feedback.canSubmit` tRPC query (mirrors `requireSectionAccess` middleware). Server-rendered submit page now renders a "You're not assigned to this section" banner and passes `disabled` into the form when the preflight fails. Files: `src/server/routers/feedback.ts`, `app/policies/[id]/sections/[sectionId]/feedback/new/page.tsx`, `app/policies/[id]/sections/[sectionId]/feedback/new/_components/submit-feedback-form.tsx`.
- [ ] E2. `feedback.list` status filter — either always-server or always-client, don't switch behavior on count. File: `app/.../feedback-inbox.tsx:26-33`, `src/server/routers/feedback.ts`.
- [ ] E3. Filter panel: add "All sections" sentinel (non-empty-string, clear via client). File: `app/.../filter-panel.tsx:158-178` and CR variant.
- [ ] E4. Participate form: set `maxLength` on inputs per Zod caps. File: `app/participate/_components/participate-form.tsx`.
- [ ] E5. Anonymity copy fix: say "Admins and Policy Leads" if server allows both to see identity — or restrict server to admin only. Files: `app/.../anonymity-toggle.tsx:54`, `src/server/routers/feedback.ts` (identity exposure logic).
- [ ] E6. Workshop feedback title: include a short preview (first 80 chars of comment) instead of "Workshop feedback (n/5)". File: `app/api/intake/workshop-feedback/route.ts:151`.
- [ ] E7. Workshop feedback: expose attendee-controlled `isAnonymous` toggle in the participate form; persist its real value. Files: `app/participate/_components/participate-form.tsx`, intake route line 154.
- [ ] E8. Workshop feedback: do not fall back to `workshop.createdBy` as submitter when user not found. Leave `submitterId: null` with `isAnonymous: true`. File: `app/api/intake/workshop-feedback/route.ts:125-133`.
- [ ] E9. Portal `/portal/[policyId]/consultation-summary`: render `documentVersions.consultationSummary` (approved LLM summary) instead of recomputing aggregates from `feedbackItems`. File: `app/portal/[policyId]/consultation-summary/page.tsx:44-134`.
- [ ] E10. Consultation summary regenerate: polling / "stale" indicator (`generatedAt` vs `publishedAt`). Also surface failures. Files: `src/server/routers/consultation-summary.ts:209-253`, `app/.../consultation-summary` moderator UI.
- [ ] E11. `/participate` without token: show an explainer page ("Enter your invite link") instead of silently redirecting to `/dashboard`. File: `app/participate/page.tsx:92-98`.
- [ ] E12. Expired-token copy: differentiate "no token" from "expired token". File: `app/participate/_components/expired-link-card.tsx:17`.
- [ ] E13. Global feedback page row click → link to `?selected=${id}` on the policy feedback page. File: `app/feedback/_components/all-feedback-tab.tsx:135-153`.
- [ ] E14. Submitter outcomes: show full decision log, reviewer name, linked evidence. File: `app/feedback/_components/my-outcomes-tab.tsx`.
- [ ] E15. `startReview` + `close` — route through Flow 5 or an Inngest-retryable event for parity with `decide`. Files: `src/server/routers/feedback.ts:346-356, 440-450`.
- [ ] E16. Rationale dialog: show "20 character minimum" hint. File: `app/.../rationale-dialog.tsx:122-134`.
- [ ] E17. Evidence-gaps tab: move claim-without-evidence filtering to server. Files: `src/server/routers/evidence.ts` (add input filter), `app/feedback/_components/evidence-gaps-tab.tsx:54-72`.
- [ ] E18. Show "Under Review" transition to submitter outcomes view (currently shows "No decisions"). File: `app/feedback/_components/my-outcomes-tab.tsx:140-148`.
- [ ] E19. Portal consultation-summary: stale indicator if version was published after `approvedAt`. File: `src/server/services/consultation-summary.service.ts:199` + portal page.
- [ ] E20. Second `StatusBadge` inline component — replace with the shared one. File: `app/.../feedback-detail-sheet.tsx:45-64`.

---

## F. WORKSHOPS

- [x] F1. Max-seats enforcement — `/api/intake/workshop-register` counts non-cancelled registrations + returns 409 when `maxSeats` is hit.
- [x] F2. Email format validated via `z.string().email()` on the register body schema.
- [x] F3. Per-IP (20/5min) + per-email (5/10min) rate limit via `src/lib/rate-limit.ts`.
- [x] F4. Already-registered check now treats `status !== 'cancelled'` as booked (covers `registered` + `rescheduled`).
- [x] F5. Webhook handlers call `revalidateTag('workshop-spots-${id}', { expire: 0 })` on BOOKING_CREATED/_CANCELLED/_RESCHEDULED; `unstable_cache` keyed + tagged per-workshopId.
- [x] F6. BOOKING_RESCHEDULED insert-fallback when 0 rows match (logs + synthesizes registration row).
- [x] F7. MEETING_ENDED matcher filters `status in ('registered','rescheduled')`, orders by latest `bookingStartTime`.
- [x] F8. tRPC `ALLOWED_TRANSITIONS` mirrors the webhook (upcoming → completed + archived → completed per F24).
- [x] F9. `timezone` TEXT column added to `workshops` (migration 0017); router create/update + register route + feedback-invite email use the stored tz.
- [x] F10. `workshop.update` PATCHes cal.com event type (title/duration) via new `updateCalEventType`; seats PATCH via `updateCalEventTypeSeats` when `maxSeats` changes.
- [x] F11. `maxSeats` added to `update` input schema + edit form.
- [x] F12. Delete mutation rejects when active registrations exist unless `force: true` is passed.
- [x] F13. `workshop.create` surfaces Inngest send failure as a TRPCError instead of silently swallowing.
- [x] F14. Direct-register cal.com fallback logs a `needsCalComReconcile` flag (kept deterministic `direct:` UID so dedupe still works).
- [x] F15. `ReprovisionCalButton` on detail page behind a confirm dialog; wired to `reprovisionCalSeats`.
- [x] F16. `workshop.list` returns `status` + `calcomEventTypeId`; manage card shows status pill + "cal.com linked/pending" badge.
- [x] F17. `workshop.getById` returns `calcomEventTypeId`, `maxSeats`, `timezone`; detail page renders timezone chip, capacity, and "Open in cal.com" link.
- [x] F18. New `workshop.listRegistrations` proc + `AttendeeList` component + Attendees tab on the detail page.
- [x] F19. `ArtifactAttachDialog` passes `r2Key` + `fileSize` to `attachArtifact`.
- [x] F20. `/api/upload` `evidence` category extended with shared `AUDIO_VIDEO_MIME_TYPES` constant (reused by `recording`).
- [x] F21. Section + Feedback pickers await each mutation via `Promise.allSettled` with a consolidated success/error toast.
- [x] F22. "You're registered" card now includes copy pointing to the cal.com cancellation link in the booking confirmation email (we can't know the booking uid from a public card without a tokenized URL, so we direct users to the email).
- [x] F23. `registrationLink` exposed on `PublicWorkshop`; rendered as "Or register via external link" below the register button.
- [x] F24. `archived → completed` unarchive transition wired into `ALLOWED_TRANSITIONS` and `StatusTransitionButtons`.
- [x] F25. `/workshop-manage` list query uses `placeholderData: keepPreviousData` so tab switches don't flash skeletons.
- [x] F26. `sendWorkshopEvidenceNudgeEmail` prefixes URL with `NEXT_PUBLIC_APP_URL`/`APP_BASE_URL` and points at `/workshop-manage/<id>`.
- [x] F27. Feedback-invite URL construction throws NonRetriableError in production when both app URL envs are missing (dev still falls back to localhost).
- [x] F28. `workshopRegistrationReceivedFn` renamed to "send Clerk invite"; index.ts comment aligned.
- [x] F29. `scheduledAtLabel` threaded into the feedback-invite email template (computed value no longer discarded).
- [x] F30. Recording pipeline writes `artifactType='transcript'` for the transcript row + `'summary'` for the summary row; schema enum + migration 0018 add `transcript`; dialog + router enum updated.
- [-] F31. Workshop feedback JWT replay — OWNED BY FEEDBACK AGENT (B13). No change here.
- [x] F32. `register-form` calls `router.refresh()` after successful registration so sibling cards see the new state.

---

## G. CHANGE REQUESTS

- [x] G1. Add "Request Changes" UI action on `approved` state (map to `requestChanges` router proc). Files: `app/.../cr-lifecycle-actions.tsx:114-150`, `src/server/routers/changeRequest.ts:343`.
- [x] G2. `mergeCR` — dispatch `MERGE` through XState machine instead of writing directly. Files: `src/server/services/changeRequest.service.ts:169-260`.
- [x] G3. Add "Close / Cancel draft" action on `drafting` state (machine already supports). File: `app/.../cr-lifecycle-actions.tsx:58-76`.
- [x] G4. CR detail page: render `closureRationale`, `approverId`, `approvedAt`, `mergedBy`, `mergedAt`. File: `app/.../cr-detail.tsx:163-170` + relevant sections.
- [x] G5. `linkedFeedback.sectionTitle`: join `policySections` in router, remove client `null` hardcode. Files: `src/server/routers/changeRequest.ts` list/getById, `cr-detail.tsx:159`.
- [x] G6. Self-merge guard — see B7.
- [x] G7. CR "sent for review" notification → reviewers (users with `change_request:review` permission), not the submitter. File: `src/server/routers/changeRequest.ts:275`.
- [x] G8. `cr_id` FK on `documentVersions` — add constraint in a new migration. Files: `src/db/schema/changeRequests.ts:19`, new migration.
- [x] G9. `create-cr-dialog`: label Description as required; field-level error for `min(10)`. File: `app/.../create-cr-dialog.tsx:147, 51`.

---

## H. EVIDENCE, AUDIT, NOTIFICATIONS

- [x] H1. Evidence-pack dialog checkboxes: pass selections through to `requestExport` input; have the export service honor selection. Files: `app/audit/_components/evidence-pack-dialog.tsx:40-46, 86, 151-171`, `src/inngest/functions/evidence-pack-export.ts`, `src/server/routers/evidence.ts`.
- [x] H2. Evidence-pack workshop section: replace placeholder with real workshop evidence (artifacts, registrations, summaries). File: `src/server/services/evidence-pack.service.ts:202-209`.
- [x] H3. `evidenceArtifacts.content` (inline text) — include in export OR drop the column. Files: service, schema.
- [x] H4. Evidence-pack stakeholder name: respect `isAnonymous` (don't always set `'Anonymous'`). File: `src/server/services/evidence-pack.service.ts:41-55`.
- [x] H5. Evidence-pack audit actor role — see B15.
- [x] H6. Audit filter Selects: replace empty-string values with sentinel ("__all__") and filter client-side. File: `app/audit/_components/audit-filter-panel.tsx:64, 84, 104`.
- [x] H7. Audit date filter: use local-day range (or document UTC behavior). File: `app/.../audit-trail-client.tsx:19-20`.
- [x] H8. `ipAddress` capture: pass from tRPC context into `writeAuditLog` calls. Files: `src/lib/audit.ts:12, 23`, tRPC init, router callsites that should capture.
- [x] H9. Notification mark-read audit — emit `NOTIFICATION_READ` / `NOTIFICATION_MARK_READ` at router procs. Files: `src/server/routers/notification.ts`, `src/lib/constants.ts:71-72`.
- [x] H10. Notifications page: poll `notification.list` on same interval as `unreadCount`. File: `app/notifications/page.tsx:68-91`.
- [x] H11. Notifications page: dedupe on append when refetching first page after mark-read. File: same, 80-91, 103.

---

## I. INFRA

- [x] I1. Migration apply scripts for `0015_cardano_anchoring.sql` + `0016_engagement_tracking.sql`. Add `scripts/apply-migration-0015.mjs`, `apply-migration-0016.mjs`.
- [x] I2. `versionAnchorFn` — on confirmation-timeout, write audit event + admin notification. documentVersions has no anchor-status column today, so txHash stays NULL for retry; I left a comment for a future `anchorStatus` column add.
- [x] I3. Don't re-emit `version.published` for section regen. Added `consultation-summary.regen` event; hooked `consultationSummaryGenerateFn` to both triggers; switched `regenerateSection` to the new event.
- [x] I4. `participateIntakeFn` — forwards `expertise`/`orgName`/`role`/`howHeard` through the event, stashes them on Clerk invitation `publicMetadata`, and writes them into the intake audit payload.
- [x] I5. `helloFn` kept but excluded from the functions array when `NODE_ENV === 'production'` via spread-conditional in `src/inngest/functions/index.ts`.
- [x] I6. `src/lib/email.ts` now uses a `getResend()` factory that reads `RESEND_API_KEY` at each invocation; `FROM_ADDRESS` similarly read per-call.
- [x] I7. Research page shows a "Coming soon" callout; Download CTA + `lucide-react Download` import removed; stub PDF deleted from `public/research/`.
- [x] I8. `participateIntakeFn` writes an audit event (`action='PARTICIPATE_INTAKE'`, `actorRole='system'`) carrying the full intake payload so admins can surface intake submissions in `/audit`.

---

## Execution notes

- Commit after each section (or sub-section) to keep diffs reviewable.
- Run `npm run build` after each wave to catch type regressions.
- When a fix requires a DB migration, generate via `npx drizzle-kit generate` and add a matching `scripts/apply-migration-00XX.mjs`.
- When deleting dead code, verify zero references with `Grep` first.
- For UI-heavy fixes (pending invitations, evidence tab, outcomes log, consultation summary portal), consider the impeccable:frontend-design mental model for polish, but don't over-build.

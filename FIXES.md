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

- [ ] B1. `/api/export/policy-pdf/[versionId]` is publicly exposed. Gate on `isPublicDraft` (from `policy_documents`) AND `isPublished`; add a basic per-IP rate limit. File: `app/api/export/policy-pdf/[versionId]/route.tsx:8-26`.
- [ ] B2. `db.transaction()` on neon-http will throw. Replace with sequential writes + compensation or switch to an http-compatible approach in `src/inngest/lib/create-draft-cr.ts:41`.
- [ ] B3. `mergeCR` does 5 sequential neon-http writes with no atomicity — add explicit ordering + idempotency keys per step so retries won't double-insert. File: `src/server/services/changeRequest.service.ts:174-259`.
- [ ] B4. Published version immutability: block `updateSectionContent`, `renameSection`, `deleteSection` when any `documentVersions.isPublished=true` exists for the document (or require the change go through a CR). File: `src/server/routers/document.ts:365-386` and sibling procs.
- [ ] B5. Policy delete must either block or cascade cleanly. Decide: (a) block with a clear error listing blockers, or (b) add `ON DELETE CASCADE` on `documentVersions`, `changeRequests`, `feedback`, `milestones` FKs. Plus update `DeletePolicyDialog` copy. Files: migrations `0001`, `0003`, `0014`; router `document.ts` delete; `app/policies/_components/delete-policy-dialog.tsx`.
- [ ] B6. Admin self-demotion + last-admin guard on `user.updateRole`. File: `src/server/routers/user.ts:95-124`.
- [ ] B7. Self-merge guard on `changeRequest.merge` (mirror the `approve` owner-check). File: `src/server/routers/changeRequest.ts:364`.
- [ ] B8. Clerk `user.updated` role handling — only apply role change when `publicMetadata.role` is a valid enum value; log an audit event when role changes. File: `app/api/webhooks/clerk/route.ts:56-79`.
- [ ] B9. Clerk `user.deleted` handler — soft-delete or anonymize the `users` row so re-invite by email is possible. File: `app/api/webhooks/clerk/route.ts`.
- [ ] B10. Body-size cap on public intake. Add `NextResponse` short-circuit if `Content-Length > N` (or use a streaming body read). Files: `app/api/intake/participate/route.ts`, `app/api/intake/workshop-feedback/route.ts`, `app/api/intake/workshop-register/route.ts`, `app/api/upload/route.ts`.
- [ ] B11. Rate-limit `/api/intake/workshop-register` and `/api/intake/workshop-feedback` (per-IP + per-email/token). Reuse the Inngest-side rate-limit pattern or add a simple in-memory/Upstash-backed limiter.
- [ ] B12. `/api/upload` presign rate limit (per-user). Resolve the existing TODO at `app/api/upload/route.ts:48-51`.
- [ ] B13. `workshop-feedback` token replay — add a one-time-use flag (either DB row keyed on token nonce, or sign the token with an ID that's marked used). File: `src/lib/feedback-token.ts` + `app/api/intake/workshop-feedback/route.ts`.
- [ ] B14. `readableId` collision: use `nextval('feedback_id_seq')` in the public workshop-feedback path (same as authenticated submit). File: `app/api/intake/workshop-feedback/route.ts:137`.
- [ ] B15. `evidence:requestExport` audit event hard-codes `actorRole: 'auditor'` — read from session. File: `src/inngest/functions/evidence-pack-export.ts:343`.

---

## C. AUTH & USERS

- [ ] C1. Align `/users` role gating. Decide: (a) expose `/users` to `policy_lead` on both server and client, or (b) hide the nav link for policy_lead. Today server-side says admin-only. Files: `app/_components/adaptive-header-client.tsx:66`, `app/users/page.tsx:18`, `app/users/[id]/page.tsx:50`, `src/lib/permissions.ts:9`.
- [ ] C2. Role-change confirm dialog in users table — prevent single-click misfire. File: `app/users/_components/users-client.tsx:131-147`.
- [ ] C3. Invite dialog: client-side email validation + existing-user check before hitting Clerk. File: `app/users/_components/invite-user-dialog.tsx:61-66`.
- [ ] C4. Pending invitations UI — new table section (or tab) listing open Clerk invitations with resend/revoke actions. Needs new router procs (`listPendingInvitations`, `revokeInvitation`, `resendInvitation`) and UI. File additions expected in `src/server/routers/user.ts`, `app/users/_components/`.
- [ ] C5. Setup page: stop polling after a hard cap (e.g., 2 min) and show actionable error with sign-out + retry links. File: `app/setup/page.tsx:12-42, 57-61`.
- [ ] C6. `/api/auth/check` — return a `staleness` signal (seconds since Clerk session started vs. missing row) so UI can escalate. File: `app/api/auth/check/route.ts:20-22`.
- [ ] C7. tRPC `errorFormatter` — pass `error.cause.issues` for Zod errors so clients get field-level validation. File: `src/trpc/init.ts:27-36`.
- [ ] C8. `protectedProcedure` — stop silently swallowing `touchActivity` errors; log with `console.warn`. File: `src/trpc/init.ts:66-70`.
- [ ] C9. `UsersPage` fallback should redirect to `/sign-in`, not `/dashboard`. Files: `app/users/page.tsx:11`, `app/users/[id]/page.tsx:45`.
- [ ] C10. Profile `Feedback Submitted` card — add "View all" link and "showing latest 20" indicator. File: `app/users/[id]/page.tsx:66`.
- [ ] C11. `updateProfile` audit `after`: merge prior row with input so the diff is clean. File: `src/server/routers/user.ts:51`.
- [ ] C12. `audit:read` permission — allow users to view their own audit entries (scoped procedure `listMine`). Files: `src/server/routers/audit.ts`, `src/lib/permissions.ts`.

---

## D. POLICY LIFECYCLE

- [ ] D1. Milestone "Evidence" tab: render real evidence rows (router supports `entityType: 'evidence'`). Files: `app/policies/[id]/milestones/[milestoneId]/_components/milestone-detail-tabs.tsx:30-37, 112-122`.
- [ ] D2. Milestone "Workshops" tab: filter to workshops linked to this policy (or gate attach by policy match). File: same as above, line 25.
- [ ] D3. `milestone.markReady` error payload: switch from `cause: { unmet }` to a custom `error.cause` serialization format that the client renders. Files: `src/server/routers/milestone.ts:379-385`, `src/trpc/init.ts:27-36` (extend formatter), `app/.../mark-ready-error-display.tsx`.
- [ ] D4. Milestone stuck in `anchoring` (permanent Cardano failure) — either auto-revert to `ready` or mark `anchor_failed` state with a "Retry from ready" action. File: `src/inngest/functions/milestone-ready.ts:282-303`, `src/server/routers/milestone.ts`.
- [ ] D5. Traceability multi-value filters: accept arrays server-side for `orgType` / `decisionOutcome`; update UI filter binding; update CSV + PDF exporters. Files: `src/server/routers/traceability.ts:22-30, 48-76`, `app/policies/[id]/traceability/_components/matrix-filter-panel.tsx:168-225`, `export-actions.tsx:22-31`, `app/api/export/traceability/csv/route.ts`, `pdf/route.tsx`.
- [ ] D6. Traceability export `gte/lte` on left-join: use `OR IS NULL` (or left-join-aware filter) so un-merged feedback is not silently dropped. Files: `app/api/export/traceability/csv/route.ts:60-85`, `pdf/route.tsx:58-84`.
- [ ] D7. Version-range filter: reject `from > to` server-side with a friendly error. File: `src/server/routers/traceability.ts:48-76`.
- [ ] D8. `VersionChangelog.feedbackIds` — decide canonical ID shape (UUID vs readable). Store consistently; render accordingly. Files: `src/server/services/version.service.ts:192-199`, `app/.../version-changelog.tsx:47-57`.
- [ ] D9. `PublishDialog` — pass `documentTitle` prop in `app/policies/[id]/_components/version-detail.tsx:174` and render it in the dialog.
- [ ] D10. Publish notification fan-out: parallelize `sendNotificationCreate` loop with `Promise.allSettled`. File: `src/server/routers/version.ts:152-164`.
- [ ] D11. Matrix cells: feedback cell → link to `/policies/${id}/feedback?selected=${feedbackId}`; section cell clickable; version cell includes versionId. File: `app/.../matrix-table.tsx:154-155`.
- [ ] D12. `MilestonesPage` — gate "Create milestone" button on `canManage` from session role. File: `app/policies/[id]/milestones/page.tsx:15-29`.
- [ ] D13. `document.update` — accept `description: z.string().max(1000).nullable()` and write `null` when cleared. File: `src/server/routers/document.ts:190-221`.
- [ ] D14. `CreateVersionDialog` — block "New Version" when autosave is pending (flush before snapshot). File: `app/.../create-version-dialog.tsx` + `section-content-view.tsx`.
- [ ] D15. `VersionComparisonSelector` — move section-default-selection from `useMemo` to `useEffect`. File: `app/.../version-comparison-selector.tsx:60-64`.
- [ ] D16. Breadcrumbs/back link on `/policies/[id]/milestones` and `/policies/[id]/milestones/[milestoneId]`. Files: those pages.
- [ ] D17. `VersionHistoryPage` empty state when `selectedVersionId` set but no versions exist. File: `app/.../versions/page.tsx:128-142`.
- [ ] D18. Remove redundant `force` re-render state in milestone detail page; rely on tRPC invalidation. File: `app/.../milestones/[milestoneId]/page.tsx:17, 57`.
- [ ] D19. Traceability "mergedAt": rename to `versionCreatedAt` in router output + UI, OR join on `change_requests.mergedAt` for CR-merged versions. File: `src/server/routers/traceability.ts:146-147`.
- [ ] D20. `CreateMilestoneDialog` — cap slot requirements (e.g., max 50 per entity type).
- [ ] D21. `document.list` default sort — don't bump `updatedAt` on `setPublicDraft`, OR sort by a stable column. File: `src/server/routers/document.ts` + `setPublicDraft`.
- [ ] D22. `framework` page: decide public-toggle semantics. Currently any `isPublicDraft=true` doc is publicly discoverable. Add a confirm dialog when first enabling public for a policy. File: `app/policies/_components/...` + `document.setPublicDraft`.
- [ ] D23. `updateSectionContent` audit log — at minimum log coarse diffs (e.g., one entry per section per 60s window, or on-publish diff). File: `src/server/routers/document.ts:361-386`.

---

## E. FEEDBACK & PARTICIPATION

- [ ] E1. Section-assignment preflight on feedback submit form — show "You're not assigned to this section" and disable submit if the user cannot submit. Files: `app/policies/[id]/sections/[sectionId]/feedback/new/page.tsx`, `src/server/routers/feedback.ts:26` (expose a `canSubmit` check via a lightweight query).
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

- [ ] F1. Max-seats enforcement in `/api/intake/workshop-register`. File: `app/api/intake/workshop-register/route.ts:25-89`.
- [ ] F2. Email format validation on register (use `z.string().email()`). File: same, line 21-22.
- [ ] F3. Rate limit on register (per-IP + per-email). File: same.
- [ ] F4. Already-registered check: treat any status other than `cancelled` as registered. File: same, line 45-61.
- [ ] F5. `revalidateTag('workshop-spots-${id}')` after BOOKING_CREATED / CANCELLED / RESCHEDULED. File: `app/api/webhooks/cal/route.ts:141-172`.
- [ ] F6. `BOOKING_RESCHEDULED` — if update matches 0 rows, log + attempt INSERT fallback. File: same, 154-172.
- [ ] F7. `MEETING_ENDED` — match on `(workshopId, email, status='registered' | 'rescheduled')` with latest booking. File: same, 224-246.
- [ ] F8. Webhook `MEETING_ENDED` transitions — gate on `status in ('upcoming', 'in_progress')` OR update tRPC `ALLOWED_TRANSITIONS` to mirror webhook. Files: webhook 186-194, `src/server/routers/workshop.ts:28-33`.
- [ ] F9. Cal.com timezone: accept per-workshop `timezone` field instead of hardcoded `Asia/Kolkata`. Files: schema `workshops.ts`, router create/update, `src/lib/calcom.ts:236`, `app/api/intake/workshop-register/route.ts:81`.
- [ ] F10. Workshop edit: propagate title/schedule/duration changes to cal.com event type via PATCH. File: `src/server/routers/workshop.ts:227-275`.
- [ ] F11. Add `maxSeats` to `update` input schema + edit form. Files: `src/server/routers/workshop.ts:227-235`, `app/workshop-manage/[id]/edit/...`.
- [ ] F12. Workshop delete: reject if active registrations exist, OR cancel cal.com event type + notify attendees. File: `src/server/routers/workshop.ts:278-307`.
- [ ] F13. Workshop creation: surface Inngest delivery failure (don't swallow `.catch(console.error)`); add `status='provisioning'` state or block creation if cal.com is down. File: same, 79-83.
- [ ] F14. Direct-register cal.com fallback reconciliation: mark fallback rows with `needsCalComReconcile=true` and run a reconciliation job, or drop the fallback UID pattern entirely. File: `app/api/intake/workshop-register/route.ts:63-110`.
- [ ] F15. Admin "Reprovision cal.com seats" button wired to `reprovisionCalSeats`. Files: `src/server/routers/workshop.ts:87-118`, `app/workshop-manage/[id]/_components/`.
- [ ] F16. `workshop.list` returns `status` and `calcomEventTypeId`. Add status badges + cal.com link to `app/workshop-manage/page.tsx` cards. Files: router `list` 135-154, manage page 41-59.
- [ ] F17. `workshop.getById` returns `calcomEventTypeId`, `maxSeats`. File: router 161-178, detail page.
- [ ] F18. New router: `workshop.listRegistrations(workshopId)` → attendee list (email, name, status, registered_at, attended_at). Build attendee-list tab in `app/workshop-manage/[id]/_components/`.
- [ ] F19. `ArtifactAttachDialog` — pass `r2Key` so recording pipeline fires. File: `app/.../artifact-attach-dialog.tsx:63-71`.
- [ ] F20. Extend `/api/upload` `evidence` category to include audio/video MIME types (`audio/webm`, `audio/mp3`, `video/mp4`, `video/webm`). OR: move recording uploads to a new `recording` category used by the artifact dialog. File: `app/api/upload/route.ts:19-21`.
- [ ] F21. `SectionLinkPicker` + `FeedbackLinkPicker`: await each mutation, show consolidated success/error. Files: `section-link-picker.tsx:35-42`, `feedback-link-picker.tsx:42-50`.
- [ ] F22. Public workshop cancellation: add "Cancel registration" button on `/workshops` and call cal.com cancel API. Or: link to the cal.com cancellation page from the registration success state.
- [ ] F23. Workshop `registrationLink` on public listing: either expose it to `PublicWorkshop` + UI or drop the field. Files: `src/server/queries/workshops-public.ts`, schema, manage pages.
- [ ] F24. Archived state: add unarchive transition OR confirm terminal-state dialog. Files: `src/server/routers/workshop.ts:28-33`, `StatusTransitionButtons`.
- [ ] F25. Workshop "past" tab flash — keep previous data visible under `placeholderData: keepPreviousData` on tab-switch. File: `app/workshop-manage/page.tsx:41-59`.
- [ ] F26. Workshop feedback nudge email URL: prefix with `NEXT_PUBLIC_APP_URL` / `APP_BASE_URL`. File: `src/lib/email.ts:84`.
- [ ] F27. Fallback deep-link host should not be `http://localhost:3000` in prod — fail noisily if envs are missing. File: `src/inngest/functions/workshop-feedback-invite.ts:87-90`.
- [ ] F28. Inngest function `name` labels mentioning "confirmation email" — update to reflect the dropped emails. Files: `workshop-registration-received.ts:31`, `src/inngest/functions/index.ts:31`.
- [ ] F29. Remove unused `scheduledAt` compute in `workshopFeedbackInviteFn` or include it in the email template. File: `src/inngest/functions/workshop-feedback-invite.ts:67-77`.
- [ ] F30. Workshop recording transcript vs summary — use distinct `artifactType` values. File: `src/inngest/functions/workshop-recording-processed.ts:110,117`; schema `workshopArtifactType`.
- [ ] F31. Workshop feedback JWT replay — see B13.
- [ ] F32. Workshop-card `alreadyRegistered` card: revalidate other workshop cards after register success (e.g., `router.refresh()`). File: `app/workshops/_components/register-form.tsx:33-42`.

---

## G. CHANGE REQUESTS

- [ ] G1. Add "Request Changes" UI action on `approved` state (map to `requestChanges` router proc). Files: `app/.../cr-lifecycle-actions.tsx:114-150`, `src/server/routers/changeRequest.ts:343`.
- [ ] G2. `mergeCR` — dispatch `MERGE` through XState machine instead of writing directly. Files: `src/server/services/changeRequest.service.ts:169-260`.
- [ ] G3. Add "Close / Cancel draft" action on `drafting` state (machine already supports). File: `app/.../cr-lifecycle-actions.tsx:58-76`.
- [ ] G4. CR detail page: render `closureRationale`, `approverId`, `approvedAt`, `mergedBy`, `mergedAt`. File: `app/.../cr-detail.tsx:163-170` + relevant sections.
- [ ] G5. `linkedFeedback.sectionTitle`: join `policySections` in router, remove client `null` hardcode. Files: `src/server/routers/changeRequest.ts` list/getById, `cr-detail.tsx:159`.
- [ ] G6. Self-merge guard — see B7.
- [ ] G7. CR "sent for review" notification → reviewers (users with `change_request:review` permission), not the submitter. File: `src/server/routers/changeRequest.ts:275`.
- [ ] G8. `cr_id` FK on `documentVersions` — add constraint in a new migration. Files: `src/db/schema/changeRequests.ts:19`, new migration.
- [ ] G9. `create-cr-dialog`: label Description as required; field-level error for `min(10)`. File: `app/.../create-cr-dialog.tsx:147, 51`.

---

## H. EVIDENCE, AUDIT, NOTIFICATIONS

- [ ] H1. Evidence-pack dialog checkboxes: pass selections through to `requestExport` input; have the export service honor selection. Files: `app/audit/_components/evidence-pack-dialog.tsx:40-46, 86, 151-171`, `src/inngest/functions/evidence-pack-export.ts`, `src/server/routers/evidence.ts`.
- [ ] H2. Evidence-pack workshop section: replace placeholder with real workshop evidence (artifacts, registrations, summaries). File: `src/server/services/evidence-pack.service.ts:202-209`.
- [ ] H3. `evidenceArtifacts.content` (inline text) — include in export OR drop the column. Files: service, schema.
- [ ] H4. Evidence-pack stakeholder name: respect `isAnonymous` (don't always set `'Anonymous'`). File: `src/server/services/evidence-pack.service.ts:41-55`.
- [ ] H5. Evidence-pack audit actor role — see B15.
- [ ] H6. Audit filter Selects: replace empty-string values with sentinel ("__all__") and filter client-side. File: `app/audit/_components/audit-filter-panel.tsx:64, 84, 104`.
- [ ] H7. Audit date filter: use local-day range (or document UTC behavior). File: `app/.../audit-trail-client.tsx:19-20`.
- [ ] H8. `ipAddress` capture: pass from tRPC context into `writeAuditLog` calls. Files: `src/lib/audit.ts:12, 23`, tRPC init, router callsites that should capture.
- [ ] H9. Notification mark-read audit — emit `NOTIFICATION_READ` / `NOTIFICATION_MARK_READ` at router procs. Files: `src/server/routers/notification.ts`, `src/lib/constants.ts:71-72`.
- [ ] H10. Notifications page: poll `notification.list` on same interval as `unreadCount`. File: `app/notifications/page.tsx:68-91`.
- [ ] H11. Notifications page: dedupe on append when refetching first page after mark-read. File: same, 80-91, 103.

---

## I. INFRA

- [ ] I1. Migration apply scripts for `0015_cardano_anchoring.sql` + `0016_engagement_tracking.sql`. Add `scripts/apply-migration-0015.mjs`, `apply-migration-0016.mjs`.
- [ ] I2. `versionAnchorFn` — on confirmation-timeout, write audit event + admin notification + mark version anchor as `failed`. File: `src/inngest/functions/version-anchor.ts:91-114`.
- [ ] I3. Don't re-emit `version.published` for section regen (causes spurious `NonRetriableError`). Use a distinct event for consultation-summary regen. Files: `src/server/routers/consultation-summary.ts:246-250`, `src/inngest/events.ts`, new handler or reuse.
- [ ] I4. `participateIntakeFn` — forward `expertise`, `orgName`, `role` to audit log / user profile. Files: `app/api/intake/participate/route.ts:93-100`, `src/inngest/functions/participate-intake.ts:52-58`.
- [ ] I5. Remove `sampleHelloEvent` / `helloFn` (or guard with `NODE_ENV !== 'production'`). Files: `src/inngest/functions/hello.ts`, `src/inngest/functions/index.ts`.
- [ ] I6. `email.ts` Resend client instantiation: read env at each invocation (not module load). File: `src/lib/email.ts:3-7`.
- [ ] I7. Research page `/research` — if no real content yet, show a clearly-labelled "Coming soon" state and remove the Download CTA. File: `app/research/page.tsx:1-95`; remove stub PDF `public/research/consultation-research-report.pdf`.
- [ ] I8. Admin intake visibility: log intake submissions to audit + surface in `/audit`. Files: `app/api/intake/participate/route.ts`, `src/inngest/functions/participate-intake.ts`.

---

## Execution notes

- Commit after each section (or sub-section) to keep diffs reviewable.
- Run `npm run build` after each wave to catch type regressions.
- When a fix requires a DB migration, generate via `npx drizzle-kit generate` and add a matching `scripts/apply-migration-00XX.mjs`.
- When deleting dead code, verify zero references with `Grep` first.
- For UI-heavy fixes (pending invitations, evidence tab, outcomes log, consultation summary portal), consider the impeccable:frontend-design mental model for polish, but don't over-build.

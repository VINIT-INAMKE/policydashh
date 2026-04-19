# FIXES-v2: Second-Pass Code Review

Second sweep after FIXES.md commits (c52ad1b, eb4ed3f, af995a9). 121 findings across 5 domains (stakeholder, authoring, review, admin, plumbing). Source findings preserved in `.review-v2/*.md`.

Legend: `[ ]` pending · `[x]` done · `[-]` intentionally skipped (rationale inline).

---

## S — Stakeholder + Public Flows (25)

### HIGH
- [x] **S1** — `/api/intake/participate` missing per-IP + per-email rate limit (HIGH). `route.ts:78`. Add `consume(ip)` + `consume(emailHash)` after body parse. — Added per-IP (20/5min) + per-email-hash (5/10min) `consume()` gates with `Retry-After` headers before Turnstile verify.
- [x] **S2** — Workshop "already registered" check misses `status='rescheduled'`. `app/workshops/page.tsx:68`. Change to `inArray(..., ['registered', 'rescheduled'])`. — Switched to `inArray` for both active statuses.
- [x] **S3** — Workshop feedback form has no 409 handler. `workshop-feedback-form.tsx:105`. Add explicit `res.status === 409` branch. — Added 409 branch with sign-up-first guidance; also latches `fatalError` so retry doesn't burn the nonce.
- [x] **S4** — `revalidateTag(..., { expire: 0 })` is the deprecated Next.js 16 signature. `webhooks/cal/route.ts:148,166,215,224`. Use `'max'`. — Replaced all four call sites with `revalidateTag(tag, 'max')`.

### MEDIUM
- [x] **S5** — `MEETING_ENDED` loops attendees unconditionally after the guard, emailing feedback invites on archived workshops. `webhooks/cal/route.ts:242-344`. Move loop inside the status-update `if`. — Added explicit early-return when `workshop.status === 'archived'` before the attendee loop.
- [x] **S6** — `RegisterForm` error `<p>` has no `role="alert"`. `register-form.tsx:77,150`. — Added `role="alert" aria-live="assertive"` to both error paragraphs.
- [x] **S7** — Workshop feedback `RadioGroup` missing `aria-label`. `workshop-feedback-form.tsx:243`. — Linked `RadioGroup` to the visible label via `aria-labelledby`.
- [x] **S8** — Participate form role/orgType errors lack `id`+`aria-describedby`. `participate-form.tsx:242,262`. — Added `id="role-error"` / `id="orgType-error"` and `aria-describedby`/`aria-invalid` on the inputs.
- [x] **S9** — `MyOutcomesTab` has no `.isError` branch. `my-outcomes-tab.tsx:59`. Add error state. — Added top-level `isError` branch + per-section error states for transitions and evidence with retry buttons.
- [x] **S10** — `AllFeedbackTab`/`EvidenceGapsTab` swallow query errors as empty-state. `all-feedback-tab.tsx:66`, `evidence-gaps-tab.tsx:93`. — Both tabs now render an explicit error card with a Retry button.
- [x] **S12** — Disabled submit button has no `title` explaining why. `submit-feedback-form.tsx:260`. — Added conditional `title` attribute explaining not-assigned vs invalid-form reasons.
- [x] **S13** — `?tab=evidence-gaps` for non-admin silently defaults to another tab. `global-feedback-tabs.tsx:27-32`. — Role-aware tab validation, one-shot "you don't have access" notice, and URL-strip to prevent re-triggering on refresh.
- [x] **S14** — `CreateCRDialog` fetches all feedback and filters client-side. `create-cr-dialog.tsx:39-45`. Pass `statuses` filter. — Now passes `statuses: ['accepted', 'partially_accepted']` server-side.
- [x] **S15** — Workshop feedback token nonce pre-check is non-transactional; 5 concurrent requests can bypass. `workshop-feedback/route.ts:106-112`. Use advisory lock or unique-insert-then-abort pattern. — Swapped pre-check for `INSERT ... ON CONFLICT DO NOTHING RETURNING`; aborts on empty result before any feedback write.
- [x] **S16** — Turnstile widget absent → button permanently disabled with dev-facing message. `participate-form.tsx:176,177`. User-friendly fallback copy. — Replaced dev-facing copy with "Service temporarily unavailable…" and `role="alert"`.

### LOW
- [-] **S11** — Inherent SSR race (workshop transitions upcoming→live mid-visit). Router.refresh already present. Skipped.
- [-] **S17** — `notFound()` in `'use client'` page. Milestone detail page. Valid concern, but fix merges with A14 below.
- [-] **S18** — `useSearchParams()` Suspense model. Works today; low-impact refactor.
- [x] **S19** — Workshop feedback success state not focus-moved or announced reliably. `workshop-feedback-form.tsx:100,129`. — Extracted success card into its own component with `useEffect`-driven heading focus.
- [x] **S20** — `SectionAssignments` unassign button no confirm + no `aria-label`. `section-assignments.tsx:119-123`. — Added `aria-label`, `title`, confirm dialog, and disabled-while-pending state.
- [x] **S21** — `feedback.listOwn` returns entire row including `reviewedBy`. `feedback.ts:246-254`. Add column projection. — Replaced `db.select()` with explicit projection dropping `reviewedBy` / `reviewedAt` / `xstateSnapshot`; kept `decisionRationale` so submitters still see the reviewer's reasoning.
- [-] **S22** — Researcher confirmed no issue. No action.
- [x] **S23** — Disabled section filter has no hint. `evidence-gaps-tab.tsx:128`. — Added `title`+`aria-describedby` plus a visible helper paragraph when no document is selected.
- [x] **S24** — Workshop feedback double-submit after failed first attempt burns second nonce. `workshop-feedback-form.tsx:55,84`. Permanently disable on non-transient failure. — Added `fatalError` latch on 401/409/5xx so the submit button stays disabled until page reload.
- [x] **S25** — Turnstile token not reset after 403. `participate-form.tsx:144-146`. — Added `turnstileRef`, clears token state and calls `.reset()` inside the 403 branch.

---

## A — Authoring Flows (20)

### HIGH
- [x] **A1** — Drop/paste image inserts `src: ""` node, upload never starts. `block-editor.tsx:196-228`. Pass `File` through to NodeView. — Added `pending-image-uploads.ts` module-scoped registry + transient `pendingUploadId` image attribute; drop/paste handlers stash the File and tag the inserted node so `ImageBlockView` auto-starts the upload on mount.
- [x] **A2** — `debouncedSave.cancel()` never called on unmount → old section's save writes to new mount. `block-editor.tsx:264-272`. — Added `debouncedSave.cancel()` to the unmount cleanup and included `debouncedSave` in the effect deps.
- [x] **A3** — `reorderSections` missing `hasPublishedVersion()` guard. `document.ts:562-600`. — Added `hasPublishedVersion()` check with matching `FORBIDDEN` message at the top of the mutation body.
- [x] **A4** — `canManage` hardcoded `true` on MilestoneDetailPage. `page.tsx:64`. Derive from `getMe`. — Derive `canManage = role === 'admin' || 'policy_lead'` from `user.getMe`; also gate `MilestoneDetailTabs` `isReadOnly` on `!canManage`.

### MEDIUM
- [-] **A5 (first one)** — Downgraded to LOW by researcher (slot status updates correctly). No action.
- [x] **A5** — Section diff feeds raw Tiptap JSON through `diffWords`. `version.service.ts:89-101`. Extract plain text. — Added `extractPlainText` tree walker (block-aware separators) and feed its output to `diffWords`; unchanged detection still runs on the full JSON.
- [x] **A6** — `PublicDraftToggle` flickers/doesn't roll back. `public-draft-toggle.tsx:31-37`. Optimistic local state. — Added `localValue` state synced to prop via `useEffect`; optimistic flip in `handleChange`/`confirmEnable`, rollback on mutation error.
- [x] **A7** — `REQUEST_CHANGES` rationale only in `workflowTransitions.metadata`; CR owner has no prominent display. `changeRequest.service.ts:125-127`. Surface in CR detail. — UI-only fix: scan `listTransitions` for the latest `REQUEST_CHANGES` entry and render an amber `role="status"` banner near the top of `cr-detail.tsx` while the CR is open.
- [x] **A8** — `milestone.list` has no `ORDER BY`. `milestone.ts:208-216`. — Added `.orderBy(desc(milestones.createdAt))`.
- [x] **A9** — Diff section selector uses live section list instead of snapshot. `version-comparison-selector.tsx:36-44`. Derive from `data.diff`. — Dropped `document.getSections` query; sections now come from `version.diff` data with `titleB ?? titleA` as the label; added auto-reselect effect when the compared versions change.
- [x] **A10** — "Save changes" unmounts editor without flushing debounce. `section-content-view.tsx:101-105`. Call `flush()`. — `BlockEditor` now exposes a `BlockEditorFlushHandle` via `flushRef` prop; parent awaits `flushRef.current.flush()` (calls `debouncedSave.flush()` and polls until mutation settles) before unmounting.
- [x] **A11** — CR lifecycle errors show generic string masking server reason. `cr-lifecycle-actions.tsx:47-49,56-58`. Surface `err.message`. — `onError` now falls back to `err.message` for both `submitForReview` and `approve` mutations.
- [x] **A12** — "Save changes" is a false affordance (doesn't save). Rename to "Done editing" or wire to flush. — Renamed button to "Done editing"; click-handler flushes the debounced save (via A10 ref) before unmounting and shows a "Saving…" spinner while doing so.
- [x] **A13** — `CRDetail` "not found" collapses all error types with no retry. `cr-detail.tsx:69-81`. — Added `isError` branch that renders a retry UI unless `error.data?.code === 'NOT_FOUND'`.
- [x] **A14** — `MilestoneDetailPage` `notFound()` on any tRPC error. `page.tsx:34-36`. Distinguish NOT_FOUND. — Only dispatch to `notFound()` for `NOT_FOUND`; other errors render a retryable error state with `milestoneQuery.refetch()`.

### LOW
- [x] **A15** — `SectionDiffView` error state missing retry button. `section-diff-view.tsx:52-57`. — Error state now shows `diffQuery.error.message` + a Retry button wired to `diffQuery.refetch()`.
- [x] **A16** — Toolbar "Insert image" inserts empty `src`. `editor-toolbar.tsx:257-262`. Filter empty-src nodes before save. — Toolbar opens a real file picker and routes the pick through the A1 pending-upload registry; `block-editor` additionally strips any `src: ""` image nodes in `handleUpdate` before autosaving.
- [-] **A17** — `Set` iteration ordering — mostly deterministic per spec. Low-impact.
- [-] **A18** — `v0.N` schema with no path to `v1.0`. Out of scope; document.
- [x] **A19** — `createManualVersion` retry loop swallows non-23505 errors. `version.service.ts:289-294`. — Re-throw immediately when `pgError.code !== '23505'` instead of looping.
- [x] **A20** — CR `addSection`/`removeSection` missing owner check. `changeRequest.ts:497-536,539-582`. — Both procs now refuse with `FORBIDDEN` unless `ctx.user.id === cr.ownerId`.

---

## R — Reviewer Flows (25)

### HIGH
- [x] **R1** — XState fallback has no valid-transition guard; CLOSE from `submitted` can succeed. `feedback.service.ts:82-96`. — Added a static `VALID_TRANSITIONS` table mirroring `feedbackMachine`'s states; fallback path now throws BAD_REQUEST when the derived `newState` is not in the allowed-targets list for `previousState`.
- [x] **R2** — `feedbackReviewedFn` notification insert has no idempotency key → up to 4 duplicates per decision. `feedback-reviewed.ts:83-98`. — Compute `sha256(feedbackId + ':reviewed:' + decision)`, insert with `.onConflictDoNothing()` against the existing `notifications_idempotency_key_unique` partial index (migration 0009).
- [x] **R3** — Dispatch sends `decision: data.type = 'feedback_status_changed'` literal string to email. `notification-dispatch.ts:133-139`. Skip email or add dedicated helpers. — Added `'feedback_status_changed'` to `SKIP_EMAIL_TYPES` and removed the broken default branch; dropped unused `sendFeedbackReviewedEmail` import. Flow 5 (`feedbackReviewedFn`) remains the sole sender for review-decision emails.
- [x] **R4** — CSV/PDF exports `canSeeIdentity = admin || policy_lead`; tRPC matrix correctly restricts to admin. `export/traceability/csv/route.ts:178`, `pdf/route.tsx:172`. Tighten to `admin` only. — Both export routes now check `user.role === 'admin'` only, matching the tRPC `traceability.matrix` E5 gate.
- [x] **R5** — `orgType` filter drops NULL-orgType users via `inArray`. `feedback.ts:151`, `traceability.ts:53`. Wrap in `or(inArray, isNull)`. — Wrapped the condition in `feedback.list`, `traceability.matrix`, and both CSV/PDF export routes so NULL-orgType items stay visible under an active filter.
- [x] **R6** — `transitionFeedback` UPDATE + INSERT non-atomic → audit trail can disappear. `feedback.service.ts:117-135`. Wrap in `db.transaction` (or idempotency-guard pattern for neon-http). — neon-http has no transaction support, so swapped the order: `workflowTransitions` INSERT now runs before the feedback status UPDATE. If UPDATE fails, the audit row stands and the caller can retry; if INSERT fails, the status is untouched. Documented the reasoning inline.
- [x] **R7** — `feedback.getById` no `documentId` scope; crafted `?selected=` opens cross-policy feedback. `feedback.ts:320-380`. — Added optional `documentId` input on `getById`; when provided it joins the WHERE clause so cross-policy IDs return NOT_FOUND. `FeedbackDetailSheet` now accepts `documentId` and the inbox passes its own `documentId` through.

### MEDIUM
- [x] **R8** — `startReview`/`close` audit payload missing before/after status. `feedback.ts:392-398,488-494`. — `transitionFeedback` now returns the row augmented with `previousStatus` / `newStatus`; both `startReview` and `close` include `{ fromStatus, toStatus }` in their audit payloads.
- [x] **R9** — `feedback.list` doesn't join `policySections`; `sectionTitle` always undefined in inbox. `feedback.ts:153-181`. — Added `leftJoin(policySections ...)` + `sectionTitle: policySections.title` to the projection so inbox cards render the section label.
- [x] **R10** — Traceability matrix/CSV/PDF duplicate rows when CR spans multiple sections. `traceability.ts:115-145` + two export routes. `DISTINCT ON` or aggregate. — Switched the matrix query in the tRPC proc, CSV route, and PDF route from `db.select()` to `db.selectDistinct()`; identical (feedback,CR,section,version) tuples now collapse into one row.
- [x] **R11** — Feedback inbox filter state not URL-synced; `?selected=` not written on click. `feedback-inbox.tsx:23,158`. — Added `FILTER_URL_KEYS` + `parseFiltersFromParams` / `serializeFilters` helpers; initial state seeds from URL and every filter change calls `router.replace` to persist.
- [x] **R12** — `claimsWithoutEvidence` includes `rejected`/`closed` (inflates gap count). `evidence.ts:231-263`. — Added default `statuses: ['submitted','under_review','accepted','partially_accepted']` filter with override support for future audit callers.
- [x] **R13** — CSV missing `Submitter Name`; PDF missing `Org Type`. Two export routes. — CSV gained a `Submitter Name` column (respects anonymity); PDF `MatrixRow` gained `submitterOrgType` and a rebalanced `Org Type` column.
- [x] **R14** — Dispatch passes notification `title` as `feedbackReadableId` to email. `notification-dispatch.ts:135-139`. — Resolved by R3 fix: `feedback_status_changed` no longer reaches the email switch at all (skipped via SKIP_EMAIL_TYPES), so the title-as-readable-ID misroute is eliminated.
- [-] **R15** — `sectionChain` exposes rationale to auditor. Intentional per permissions matrix. Document only.
- [x] **R16** — CSV/PDF export unbounded (no `.limit()`); OOM risk. Both routes. — Added `EXPORT_ROW_LIMIT = 5000` with `.limit(EXPORT_ROW_LIMIT + 1)` + slice + `X-Truncated` / `X-Row-Limit` response headers; PDF additionally renders an in-document truncation banner.
- [x] **R17** — PDF traceability renders all rows inside single `<Page>` → clipped beyond ~40. `traceability-pdf.tsx:84-119`. Use `wrap`. — Wrapped the table in `<View wrap>` with a `fixed` header so `@react-pdf/renderer` auto-paginates rows; individual rows use `wrap={false}` so rationale text doesn't split across a page break.
- [x] **R18** — `listCrossPolicy` single-value filters only. `feedback.ts:261-317`. Accept arrays. — Added `statuses` / `feedbackTypes` / `priorities` array variants alongside the existing scalars; arrays take precedence and are merged into `inArray` conditions (matching `feedback.list`'s pattern).

### LOW
- [-] **R19** — Theoretical (XState fallback handles it). Merged into R1.
- [-] **R20** — `actorName` to submitter — design question; document matrix.
- [-] **R21** — `actorId text` vs `users.id uuid` — requires migration + column rewrite; low impact at current scale.
- [x] **R22** — `DecisionLog` React key `toState+timestamp` can collide. Use `transition.id`. — `DecisionLog`'s `Transition` interface now requires `id: string`; caller (`FeedbackDetailSheet`) maps `t.id` through; React key switched to `transition.id`.
- [x] **R23** — `isNull(feedbackEvidence.artifactId)` should be `isNull(feedbackEvidence.feedbackId)`. `evidence.ts:232`. — Swapped the null check to use the join key; semantically clearer and future-proof if `artifactId` ever becomes nullable.
- [x] **R24** — `AllFeedbackTab`/`EvidenceGapsTab` filters not URL-synced. Low UX. — Both tabs now seed from namespaced URL keys (`policyId`/`status` for All, `documentId`/`sectionId`/`feedbackType` for Gaps), preserve the parent `?tab=` param, and use `router.replace({ scroll: false })` on every change.
- [x] **R25** — Card click doesn't update `?selected=`. Merged into R11. — `setSelectedFeedbackId` now writes `?selected=` via `router.replace` and clears the param when the sheet closes.

---

## D — Admin + Audit Flows (21)

### HIGH
- [x] **D1** — `workshop.listRegistrations` gated on `workshop:read` (stakeholder+observer+auditor). `permissions.ts:71`, `workshop.ts:766`. New `workshop:read_attendees`.
- [x] **D2** — `user.listUsers` + last-admin count missing `deletedAt IS NULL`. `user.ts:298-303`.
- [x] **D21** — `/workshop-manage/[id]` Attendees tab rendered without `canManage`/role gate. `page.tsx:320-323`.
- [x] **D3** — tRPC context `createTRPCContext` + export routes load users without `deletedAt IS NULL`. `trpc/init.ts:15`.

### MEDIUM
- [x] **D4** — `reprovisionCalSeats` emits no audit log. `workshop.ts:108-136`.
- [x] **D5** — `workshop.transition → completed` uses `existing.createdBy` instead of `ctx.user.id`. `workshop.ts:723-726`.
- [x] **D6** — `revokeInvitation`/`resendInvitation` both emit `USER_INVITE`; indistinguishable. Add `USER_INVITE_REVOKE`, `USER_INVITE_RESEND`.
- [x] **D7** — `audit.list` no `totalCount` → pagination broken at page boundary. `audit.ts:20-40` + `audit-event-table.tsx:222`.
- [x] **D8** — `PARTICIPATE_INTAKE` is a raw literal. `participate-intake.ts:124`. Add to `ACTIONS`.
- [x] **D9** — `milestoneReadyFn`/`versionAnchorFn` hardcode `actorRole: 'admin'`. Resolve from users table.
- [x] **D10** — `audit.list` accepts any string `action`/`actorId`. Constrain to enum/uuid.
- [x] **D12** — `DeleteWorkshopDialog` never passes `force: true`; no UI recovery. `delete-workshop-dialog.tsx:55`.

### LOW
- [-] **D11** — Evidence-pack metadata JSONB sanitization. Allowlist-strip on export.
- [x] **D13** — `workshop.update` audit captures only `title`. Full diff.
- [-] **D14** — Evidence pack stakeholder de-anonymization is documented behavior. Add INDEX note only.
- [x] **D15** — `audit.list` inverted `from`/`to` silently returns empty. Validate.
- [-] **D16** — `consultation-summary.regen` full-replace race. Complex fix, low likelihood. Defer.
- [x] **D17** — `listUsers` exposes `clerkId`/`phone`/`deletedAt`. Column projection.
- [x] **D18** — `evidence.requestExport` no per-user rate limit. Add via `src/lib/rate-limit.ts`.
- [x] **D19** — `consultation-summary.regen` no idempotency key. Double-click fires 2 LLM runs.
- [x] **D20** — `versionAnchorFn` reuses `MILESTONE_ANCHOR_FAIL`. Add `VERSION_ANCHOR_FAIL`.

---

## P — Plumbing / Infra (30)

### HIGH
- [x] **P1** — `audit_events` partitions expire 2026-05-31; 6 weeks from audit blackout. URGENT. Create `2026_06`–`2027_12` now.
- [x] **P2** — Clerk webhook does synchronous DB SELECT + upsert + bulk update + audit write before 200. Fan out to Inngest.
- [x] **P3** — Cal.com MEETING_ENDED per-attendee `inngest.send()` + DB query inline. Batch send.

### MEDIUM
- [x] **P4** — Intake/upload 429 responses have no `Retry-After`.
- [x] **P5** — Cardano wallet singleton not concurrency-safe within hot worker. Promise-lock init.
- [x] **P6** — `checkExistingAnchorTx` unbounded paginating loop. Add MAX_PAGES.
- [x] **P7** — Cardano `buildAndSubmitAnchorTx` no wallet balance pre-check. Zero-UTxO crashes deep.
- [x] **P8** — `generateStorageKey` uses `Math.random()` (~31 bits). Use `crypto.randomBytes(8).toString('hex')`.
- [x] **P9** — Upload route trusts client-supplied `contentType`. Cross-check extension.
- [x] **P10** — `version_published` email gets doubled subject (notification title used as `policyName`). `notification-dispatch.ts:122-126`.
- [x] **P11** — Email functions missing `replyTo`. `email.ts`. Add `SUPPORT_EMAIL`.
- [x] **P12** — Groq calls have no timeout. Add `AbortSignal.timeout(120_000)`.
- [x] **P13** — `evidencePackExportFn` no concurrency/idempotency. Add `concurrency` + r2Key guard.
- [x] **P14** — tRPC context leaks raw `Headers` (cookie). Strip.
- [x] **P15** — `crFeedbackLinks.feedbackId`/`crSectionLinks.sectionId` FK no `onDelete`. Cascade.
- [x] **P16** — `workshopFeedbackTokenNonces.workshop_id` no FK; no expiry pruning.
- [x] **P17** — Missing apply-migration scripts for 0017–0020.
- [x] **P18** — No centralised env validation module. Create `src/lib/env.ts`.
- [x] **P19** — `proxy.ts` puts `/api/inngest` in `isPublicRoute`. Relies on SDK signature but no env assertion.
- [x] **P20** — `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` absent.

### LOW
- [-] **P21** — `instrumentation.ts` absent. Optional observability. Skip.
- [-] **P22** — `/api/intake/participate` same as S1. Merged (S-agent owns).
- [x] **P23** — `notification.create.linkHref` not URL-validated. `events.ts:119`.
- [x] **P24** — Anchor failure notifications reuse `cr_status_changed`. Add `anchoring_failed` enum (requires migration).
- [x] **P25** — `checkExistingAnchorTx` creates new `BlockFrostAPI` every call. Singleton.
- [-] **P26** — `feedbackItems.documentId` FK defaults to NO ACTION. App-layer guard already covers. Documented only.
- [x] **P27** — `workshop_registrations.email` no index. Migration.
- [-] **P28** — Inngest client no inline signing key (SDK reads env). Fail-fast goes in P18's env.ts.
- [x] **P29** — `summarizeTranscript` no length guard. Truncate.
- [x] **P30** — `notificationDispatchFn` no concurrency + email step not idempotent. Add concurrency + `emailSentAt`.

---

## Dispatch plan

5 Opus agents in parallel, one per section:
1. **S-agent** — Stakeholder + public (S items)
2. **A-agent** — Authoring (A items)
3. **R-agent** — Reviewer flows (R items)
4. **D-agent** — Admin + audit (D items)
5. **P-agent** — Plumbing + infra (P items)

Orchestrator commits after all return. Type-check must pass.

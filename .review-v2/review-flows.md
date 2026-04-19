# Reviewer Flows Review

---

## R1: XState fallback ignores valid-transition guards — allows CLOSE from `submitted`
**File:** src/server/services/feedback.service.ts:82–96
**Severity:** HIGH
**Impact:** If the XState actor creation throws a non-TRPC error (e.g. corrupted `xstateSnapshot` JSONB), the catch block falls through to a plain `eventToStateMap` lookup. That map maps `CLOSE → closed` and `ACCEPT → accepted` regardless of the current DB status. A reviewer calling `feedback.close` on a `submitted` item would succeed in the fallback path — skipping the machine guard — because `newState ('closed') !== previousState ('submitted')` passes the only guard in the fallback.
**Suggested fix:** In the fallback path, add a static valid-transitions table mirroring the machine (e.g. `{ submitted: ['under_review'], under_review: ['accepted','partially_accepted','rejected'], accepted: ['closed'], ... }`) and throw `BAD_REQUEST` when the event's target state is not in the allowed set for `previousState`.

---

## R2: `feedbackReviewedFn` notification insert has no idempotency guard — duplicates on retry
**File:** src/inngest/functions/feedback-reviewed.ts:83–98
**Severity:** HIGH
**Impact:** The `insert-notification` step calls `db.insert(notifications).values({...})` with no `.onConflictDoNothing()` and no `idempotencyKey` column value. With `retries: 3`, a transient DB or network error after the step-run acknowledgement but before Inngest records success causes the step to re-run on the next attempt. Each retry inserts a new duplicate notification for the submitter. A single `decide` call can produce up to 4 identical "Your feedback has been reviewed" in-app notifications.
**Suggested fix:** Compute an idempotency key (e.g. `sha256(feedbackId + ':reviewed:' + decision)`) and add `.onConflictDoNothing()` on the partial unique index, mirroring the pattern in `notificationDispatchFn:74–94`.

---

## R3: `notification-dispatch` sends mangled email for `startReview` and `close` transitions
**File:** src/inngest/functions/notification-dispatch.ts:133–139
**Severity:** HIGH
**Impact:** For `feedback_status_changed` notifications (emitted by `startReview` and `close`), the dispatch function calls `sendFeedbackReviewedEmail` with `decision: data.type` and `rationale: data.body`. `data.type` is the literal string `'feedback_status_changed'`, not a decision word. The resulting email subject is "Your feedback [title] has been reviewed" and the body reads "Your feedback was feedback_status_changed. Rationale: Your feedback on "X" is now being reviewed." — meaningless to the submitter.
**Suggested fix:** Add `'feedback_status_changed'` to the `SKIP_EMAIL_TYPES` set (no email template exists for start-review/close), OR add dedicated email helpers for those transitions and route them via explicit `case` branches in the `switch`.

---

## R4: Anonymous identity leak — CSV and PDF exports reveal `orgType` to `policy_lead` but tRPC matrix does not
**File:** app/api/export/traceability/csv/route.ts:178 and app/api/export/traceability/pdf/route.tsx:172
**Severity:** HIGH
**Impact:** `canSeeIdentity` in both export routes is `role === 'admin' || role === 'policy_lead'`, so a `policy_lead` downloading the CSV/PDF sees the `submitterOrgType` of anonymous feedback items. The tRPC `traceability.matrix` proc (traceability.ts:151) correctly restricts to `role === 'admin'` only (E5). A policy_lead cannot infer identity from the matrix UI but can immediately download the CSV and see the `Org Type` column for the same anonymous rows — undermining the E5 anonymity promise.
**Suggested fix:** Change `canSeeIdentity` in both export routes to `user.role === 'admin'` to match the tRPC router.

---

## R5: `feedback.list` and `traceability.matrix` `orgType` filter silently drops feedback from users with `NULL` `orgType`
**File:** src/server/routers/feedback.ts:151 and src/server/routers/traceability.ts:53
**Severity:** HIGH
**Impact:** `inArray(users.orgType, orgTypes)` in SQL excludes rows where `users.orgType IS NULL`. Since `orgType` is nullable ("nullable until user sets profile" per schema comment), any feedback submitted by a user who has not set their org type is invisible when an `orgType` filter is active. Reviewers applying even a single org-type chip will silently miss feedback from incomplete profiles. The same bug exists in the CSV/PDF export routes.
**Suggested fix:** Wrap the condition as `or(inArray(users.orgType, orgTypes), isNull(users.orgType))` — or, if NULL-orgType items should genuinely be excluded, document and surface that in the UI.

---

## R6: `transitionFeedback` status update and `workflowTransitions` insert are non-atomic — transition can be lost
**File:** src/server/services/feedback.service.ts:117–135
**Severity:** HIGH
**Impact:** The feedback row `UPDATE` (line 118–121) and the `workflowTransitions` `INSERT` (line 125–135) are two sequential non-transactional writes. If the INSERT fails (network glitch, constraint violation, DB restart), the feedback status is permanently updated but the transition is silently absent from the audit trail. The reviewer's decision is unaudited and invisible in the Decision Log. On the next call with the same event, XState will throw "Invalid transition" because the state already moved, so the lost log entry cannot be recovered.
**Suggested fix:** Wrap both writes in `db.transaction(async (tx) => { ... })` so they commit or roll back together.

---

## R7: `feedback.getById` has no `documentId` scope — reviewer with `feedback:read_all` can read any feedback across all policies via crafted `?selected=`
**File:** src/server/routers/feedback.ts:320–380
**Severity:** HIGH
**Impact:** `getById` checks ownership OR `feedback:read_all`, but does not scope to the document context of the calling page. A reviewer on Policy A's inbox (`/policies/<A>/feedback`) can craft `?selected=<feedbackId from Policy B>` and the detail sheet will open and render feedback from Policy B — including body, suggested change, and decision rationale — with no cross-policy check. Reviewers with `feedback:read_all` (admin, policy_lead, auditor) are affected.
**Suggested fix:** Accept an optional `documentId` in `getById` input and, when provided, add `eq(feedbackItems.documentId, input.documentId)` to the WHERE clause; or enforce the document scope from the calling `FeedbackDetailSheet` by passing `documentId` from the page context.

---

## R8: `feedback.startReview` and `feedback.close` audit log missing `before`/`after` status in payload
**File:** src/server/routers/feedback.ts:392–398 and 488–494
**Severity:** MEDIUM
**Impact:** `writeAuditLog` for `FEEDBACK_START_REVIEW` and `FEEDBACK_CLOSE` emits no `payload`. The audit trail for these transitions has no `fromState`/`toState` context — auditors cannot determine what status the item was in before or after from the audit log alone (they must cross-reference `workflowTransitions`). `decide` correctly includes `{ decision, rationale }`. This is inconsistent and weakens auditability.
**Suggested fix:** Add `payload: { fromStatus: previousState, toStatus: newState }` to both `writeAuditLog` calls; `previousState` and `newState` are already available from `transitionFeedback`'s return value chain.

---

## R9: `feedback.list` does not join `policySections` — `sectionTitle` is always `undefined` in inbox cards
**File:** src/server/routers/feedback.ts:153–181
**Severity:** MEDIUM
**Impact:** `FeedbackCard` renders `feedback.sectionTitle` as the section label below the title (feedback-card.tsx:85–88). `feedback.list` selects from `feedbackItems` joined only to `users` — `policySections` is not joined, so `sectionTitle` is never returned. Every inbox card shows no section label, leaving reviewers unable to identify which section a feedback item belongs to without opening the detail sheet.
**Suggested fix:** Add `.leftJoin(policySections, eq(feedbackItems.sectionId, policySections.id))` to the `feedback.list` query and include `sectionTitle: policySections.title` in the select.

---

## R10: Traceability matrix, CSV, and PDF produce duplicate rows when a CR links to multiple sections
**File:** src/server/routers/traceability.ts:115–145, app/api/export/traceability/csv/route.ts:151–175, app/api/export/traceability/pdf/route.tsx:145–169
**Severity:** MEDIUM
**Impact:** The matrix query joins `feedbackItems → crFeedbackLinks → changeRequests → crSectionLinks → policySections`. When a single CR is linked to two sections, the JOIN produces two rows for the same feedback item — one per section. The CSV file and PDF render both rows with identical feedback data and different section names. Row-count totals in traceability reports will be inflated and downstream tools that key on Feedback ID will see duplicate entries.
**Suggested fix:** Use `DISTINCT ON (feedbackItems.id)` or aggregate section titles in a subquery, or use `selectDistinct` with Drizzle to eliminate duplicates at the query level.

---

## R11: Feedback inbox filters are not URL-synced — filter state lost on page refresh and not shareable
**File:** app/policies/[id]/feedback/_components/feedback-inbox.tsx:23
**Severity:** MEDIUM
**Impact:** `FilterState` is stored in `useState`. Refreshing the page resets all filters to `EMPTY_FILTERS`. A reviewer applying a multi-filter triage view cannot share the URL with a colleague or bookmark the filtered state. Only `?selected=` is read from/written to the URL. By contrast, clicking a card does not even write `?selected=` back to the URL (no `router.replace`), so the URL never reflects the currently open item after initial load.
**Suggested fix:** Encode active filters as URL search params and use `router.replace` to sync on every `setFilters` call; update `?selected=` on card click.

---

## R12: `evidence.claimsWithoutEvidence` includes `rejected` and `closed` feedback — inflates gap count
**File:** src/server/routers/evidence.ts:231–263
**Severity:** MEDIUM
**Impact:** The query has no `status` filter, so all feedback items lacking attached evidence appear as "gaps" regardless of lifecycle state. A rejected item (which will never need supporting evidence) shows as an actionable gap. In a policy with many rejected items, the Evidence Gaps tab becomes misleading — research leads chase items that require no action.
**Suggested fix:** Add `inArray(feedbackItems.status, ['submitted', 'under_review', 'accepted', 'partially_accepted'])` to the `conditions` array, or accept an optional `statuses` filter input and document the default.

---

## R13: CSV export missing `Submitter Name` column; PDF export missing `Org Type` column — column set inconsistent across formats
**File:** app/api/export/traceability/csv/route.ts:180–192 and app/api/export/traceability/pdf/_document/traceability-pdf.tsx:61–98
**Severity:** MEDIUM
**Impact:** The CSV selects `submitterName` from the DB (line 160) but does not include it in the `csvData` map — admins who can see identity get `Org Type` but not `Submitter Name`. The PDF `MatrixRow` interface has no `submitterOrgType` field at all, so org-type context is absent from the PDF even for non-anonymous feedback. The three output surfaces (tRPC matrix, CSV, PDF) have different column sets, making cross-format audit consistency impossible.
**Suggested fix:** Add `'Submitter Name': (row.feedbackIsAnonymous && !canSeeIdentity) ? '--' : (row.submitterName ?? '--')` to the CSV map; add `submitterOrgType` to the PDF `MatrixRow` and render it as a column.

---

## R14: `notificationDispatchFn` `feedback_status_changed` default branch passes `data.title` as `feedbackReadableId` to email
**File:** src/inngest/functions/notification-dispatch.ts:135–139
**Severity:** MEDIUM
**Impact:** For `feedback_status_changed` type, the email helper receives `feedbackReadableId: data.title` (the human-readable notification title, e.g. "Feedback under review") rather than the actual feedback readable ID (e.g. "FB-042"). The email subject line reads "Your feedback Feedback under review has been reviewed" — grammatically broken and missing the actual ID. This affects every `startReview` and `close` email sent via the dispatch path.
**Suggested fix:** Pass `entityId` (the feedback UUID) in the notification event payload and look up `readableId` in the dispatch function, or add a `feedbackReadableId` field to the `notification.create` event schema.

---

## R15: `sectionChain` traceability query exposes `feedbackDecisionRationale` to `auditor` role without section-RBAC
**File:** src/server/routers/traceability.ts:170–202
**Severity:** MEDIUM
**Impact:** `sectionChain` is gated by `trace:read` which includes `auditor`. The query returns `feedbackDecisionRationale` (internal reviewer notes) for all feedback on the given section. Auditors can read rationale for any section by calling `sectionChain` with any `sectionId` — they are not limited to sections they are assigned to or sections within their audit scope. This is broader than the `feedback.getById` path which also only requires `feedback:read_all` (also auditor-accessible), so the net exposure is the same but it's worth noting the unrestricted scope.
**Suggested fix:** Document that rationale is intentionally visible to auditors (if by design), or add a document-ownership check to scope `sectionChain` to a known `documentId`.

---

## R16: Traceability CSV export row set is unbounded — large policies risk OOM in the serverless function
**File:** app/api/export/traceability/csv/route.ts:151–175
**Severity:** MEDIUM
**Impact:** The matrix query has no `.limit()` call on the main result set (only the sub-queries for version resolution are limited). The tRPC `matrix` proc caps at 500 rows, but the CSV route fetches all matching rows into memory before serializing. A policy with thousands of feedback items will materialise the full result set in the edge/serverless function's memory, risking timeout or OOM. The PDF route has the same issue.
**Suggested fix:** Add a hard cap (e.g. 5,000 rows) with a `Content-Range` or warning header; or stream the CSV using a cursor/pagination approach.

---

## R17: PDF traceability export renders all rows inside a single `<Page>` — rows beyond page height are clipped
**File:** app/api/export/traceability/pdf/_document/traceability-pdf.tsx:84–119
**Severity:** MEDIUM
**Impact:** All `<View>` row elements are direct children of one `<Page>`. `@react-pdf/renderer` auto-paginates `<View>` elements only when the parent `<Document>` contains multiple `<Page>` instances or when `wrap` is enabled. With the current structure, rows that overflow the single A4-landscape page (approximately 40–50 rows) are silently clipped and absent from the PDF. Reviewers exporting a large traceability matrix receive a truncated report with no indication that rows are missing.
**Suggested fix:** Render rows as children of a wrapping `<View>` with `wrap` enabled, or move the row loop outside the single `<Page>` and create one `<Page>` per N rows.

---

## R18: `feedback.listCrossPolicy` supports only single-value filters — `AllFeedbackTab` cannot multi-select status or type
**File:** src/server/routers/feedback.ts:261–317
**Severity:** MEDIUM
**Impact:** `listCrossPolicy` accepts `status`, `feedbackType`, and `priority` as single `z.enum()` scalars. The per-policy `feedback.list` was updated in E2 to accept arrays (`statuses`, `feedbackTypes`, etc.) for multi-select filtering. The cross-policy tab (`AllFeedbackTab`) is limited to one status at a time, one type at a time. A reviewer who wants to see all "submitted OR under_review" feedback across policies cannot do so.
**Suggested fix:** Add `statuses`, `feedbackTypes`, `priorities` array variants to `listCrossPolicy` input schema and merge them with the singular forms using the same pattern as `feedback.list:141–145`.

---

## R19: `feedback.close` called on `under_review` item — the machine allows it only from terminal states, but the triage UI doesn't show Close on `under_review`; a direct API call bypasses the guard inconsistency
**File:** src/server/machines/feedback.machine.ts:81–84 and src/server/routers/feedback.ts:479–518
**Severity:** LOW
**Impact:** The `close` proc accepts any feedback ID and sends `{ type: 'CLOSE' }`. The machine defines `CLOSE` only on `accepted`, `partially_accepted`, and `rejected`. Sending `CLOSE` on `under_review` via XState will not transition (same-state guard in feedback.service.ts:64–68 throws BAD_REQUEST). However, if the fallback path is reached (R1 scenario), `CLOSE` from `under_review` would succeed. A direct API caller (e.g. a script) cannot accidentally bypass this because XState is the primary guard, but the two code paths have different security postures.
**Suggested fix:** Add an explicit input guard in the `close` proc that checks the current status before calling `transitionFeedback`, independent of the machine.

---

## R20: `listTransitions` exposes reviewer `actorName` to the submitter (own-feedback path) — no anonymity for reviewer identity
**File:** src/server/routers/feedback.ts:541–562
**Severity:** LOW
**Impact:** `listTransitions` joins `users` on `actorId` and returns `actorName`. Any submitter querying their own feedback transitions (allowed via `feedback:read_own`) sees the full name of every reviewer who acted on their item. This may be intentional (transparency), but it is not documented and is inconsistent with the anonymity model applied to submitters. If reviewer identity should be protected (e.g. to prevent stakeholder pressure on named reviewers), this is a leak.
**Suggested fix:** Document whether reviewer identity visibility to submitters is intentional in the permissions matrix; if not, null out `actorName` when `canReadAll` is false.

---

## R21: `workflowTransitions.actorId` is `text` but `users.id` is `uuid` — join works but prevents index use
**File:** src/db/schema/workflow.ts:11
**Severity:** LOW
**Impact:** The `actorId text('actor_id').notNull()` column is joined against `users.id` (a `uuid` PK) in `listTransitions`. PostgreSQL performs an implicit text-to-uuid cast at runtime, which prevents the query planner from using the PK index on `users.id`. For a small table this is negligible, but at scale (high transition volume) it becomes a sequential scan on `users`.
**Suggested fix:** Change `actorId` to `uuid('actor_id')` and add a migration; or add an explicit cast in the join expression.

---

## R22: `DecisionLog` component key is `toState + timestamp` — collides when two items transition to the same state at the same second
**File:** app/policies/[id]/feedback/_components/decision-log.tsx:49
**Severity:** LOW
**Impact:** The React key `${transition.toState}-${transition.timestamp}` is not unique when two transitions of the same feedback item share the same `toState` and `timestamp` (possible with sub-second clock resolution or backfilled data). React will warn about duplicate keys and may render one transition twice or skip one.
**Suggested fix:** Use `transition.id` (the UUID PK from `workflowTransitions`) as the key — it is already returned by `listTransitions`.

---

## R23: `evidence.claimsWithoutEvidence` uses `isNull(feedbackEvidence.artifactId)` — semantically fragile left-join null check
**File:** src/server/routers/evidence.ts:232
**Severity:** LOW
**Impact:** `feedbackEvidence.artifactId` is `NOT NULL` in the schema. The `isNull` condition only evaluates to true because of the `LEFT JOIN` producing a null-padded row when no matching `feedbackEvidence` row exists. While this produces correct SQL results today, the intent — "no evidence row exists" — should be expressed as `isNull(feedbackEvidence.feedbackId)` (the join key). If the schema ever changes (e.g. artifactId becomes nullable for soft-delete), the gap definition silently changes meaning.
**Suggested fix:** Change `isNull(feedbackEvidence.artifactId)` to `isNull(feedbackEvidence.feedbackId)` to express "no feedbackEvidence row" via the join key.

---

## R24: `AllFeedbackTab` and `EvidenceGapsTab` filter state is not URL-synced — not shareable
**File:** app/feedback/_components/all-feedback-tab.tsx:47–48 and app/feedback/_components/evidence-gaps-tab.tsx:50–52
**Severity:** LOW
**Impact:** Both tabs store their filter selections in `useState` only. Refreshing loses the filter. The `GlobalFeedbackTabs` parent does sync `?tab=`, but the intra-tab filters (policy, status, document, section, type) are ephemeral. A reviewer cannot share a specific filtered view via URL. This is a UX gap affecting all reviewer roles.
**Suggested fix:** Encode tab-specific filters as URL search params (namespaced, e.g. `?tab=all&policyId=...&status=...`) and read/write them via `useSearchParams` + `router.replace`.

---

## R25: Feedback inbox clicking a card does not update `?selected=` in the URL — selected item not shareable after initial load
**File:** app/policies/[id]/feedback/_components/feedback-inbox.tsx:158
**Severity:** LOW
**Impact:** `setSelectedFeedbackId(item.id)` updates local state but never calls `router.replace` to write `?selected=<id>` into the URL. If a reviewer opens item FB-010 by clicking the card, the URL still shows `?selected=FB-001` (from the initial deep-link) or has no `?selected` at all. Copying the URL and sharing it will not reproduce the same view. Closing and re-opening the page loses the selection.
**Suggested fix:** Call `router.replace(...)` with the updated `?selected=` param inside `setSelectedFeedbackId`'s call site, mirroring the pattern used in `GlobalFeedbackTabs.handleTabChange`.

---
phase: 04-feedback-system
verified: 2026-03-25T05:30:00Z
status: gaps_found
score: 8/10 truths verified
re_verification: false
gaps:
  - truth: "Feedback detail sheet opens on card click and shows full feedback content"
    status: failed
    reason: "FeedbackDetailSheet component exists and is fully implemented but is ORPHANED — it is never imported or rendered anywhere in the codebase. FeedbackInbox tracks selectedFeedbackId state when cards are clicked but never passes that state to FeedbackDetailSheet. Clicking a FeedbackCard does nothing visible."
    artifacts:
      - path: "app/(workspace)/policies/[id]/feedback/_components/feedback-detail-sheet.tsx"
        issue: "Exported but never imported or used outside its own file"
      - path: "app/(workspace)/policies/[id]/feedback/_components/feedback-inbox.tsx"
        issue: "Has selectedFeedbackId state set on card click but never passes it to FeedbackDetailSheet — missing import and render"
    missing:
      - "Import FeedbackDetailSheet in feedback-inbox.tsx"
      - "Add <FeedbackDetailSheet feedbackId={selectedFeedbackId} open={!!selectedFeedbackId} onOpenChange={(o) => !o && setSelectedFeedbackId(null)} /> inside FeedbackInbox render, after the Sheet component"
  - truth: "Policy Lead can transition feedback through lifecycle states via triage action buttons in the detail sheet"
    status: failed
    reason: "TriageActions component is fully implemented and wired to tRPC mutations (startReview, decide, close), and is rendered inside FeedbackDetailSheet. However, since FeedbackDetailSheet itself is never mounted in the UI (see gap above), triage actions are unreachable by users. The implementation is correct but inaccessible."
    artifacts:
      - path: "app/(workspace)/policies/[id]/feedback/_components/feedback-detail-sheet.tsx"
        issue: "Correctly renders TriageActions but is never mounted"
    missing:
      - "Resolved by fixing the FeedbackDetailSheet wiring gap (see gap 1)"
human_verification:
  - test: "Verify feedback submission form field validation"
    expected: "Submit button stays disabled until feedbackType, priority, impactCategory are selected, title is non-empty, and body is >= 10 chars. Form submits on click and shows toast with FB-NNN."
    why_human: "Client-side form interaction and toast behavior require browser execution"
  - test: "Verify feedback inbox filter behavior"
    expected: "Selecting checkboxes in FilterPanel updates the displayed feedback list. Section dropdown filters to one section. Clearing all filters restores full list."
    why_human: "Multi-filter client-side logic requires interactive browser testing"
  - test: "Verify anonymous feedback UI enforcement"
    expected: "When a stakeholder submits with isAnonymous=true, the feedback card and detail sheet show 'Anonymous' instead of the submitter name when viewed by non-admin/non-policy_lead roles."
    why_human: "Requires multi-user session testing to verify server-side anonymity enforcement in the UI"
  - test: "Verify evidence file upload flow"
    expected: "Dragging a file onto the drop zone or clicking Browse shows upload progress bar, then shows the file row. On success, evidence appears in EvidenceList after invalidation."
    why_human: "Requires Uploadthing endpoint to be live and browser file drag/drop interaction"
---

# Phase 4: Feedback System Verification Report

**Phase Goal:** Stakeholders can submit structured, traceable feedback on policy sections with full lifecycle management, evidence support, and privacy controls
**Verified:** 2026-03-25T05:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Feedback table exists with all required fields and 4 enums | VERIFIED | `src/db/schema/feedback.ts` has all 20 fields matching spec: readable_id, section_id, document_id, submitter_id, feedback_type, priority, impact_category, title, body, suggested_change, status, is_anonymous, decision_rationale, reviewed_by, reviewed_at, xstate_snapshot, created_at, updated_at, id. 4 pgEnums present. |
| 2  | XState 5 feedback machine enforces valid transitions and blocks accept/reject without rationale | VERIFIED | `src/server/machines/feedback.machine.ts` uses `setup().createMachine()` XState 5 API. `hasRationale` guard checks `event.rationale.trim().length > 0`. 6 states defined. All valid transitions verified. `closed` state has `type: 'final'`. 14 tests in `feedback-machine.test.ts` cover all paths. |
| 3  | Section assignments table exists and requireSectionAccess middleware rejects unassigned users | VERIFIED | `src/db/schema/sectionAssignments.ts` has unique constraint on (userId, sectionId). `src/server/rbac/section-access.ts` exports `requireSectionAccess` with `BYPASS_SECTION_SCOPE = ['admin', 'auditor', 'policy_lead']`. DB query checks section_assignments for non-bypass roles. |
| 4  | Evidence artifacts table and join tables exist for feedback and section attachment | VERIFIED | `src/db/schema/evidence.ts` defines `evidenceArtifacts`, `feedbackEvidence` (FK cascade), `sectionEvidence` (FK cascade). Evidence router wires `attach`, `listByFeedback`, `listBySection`, `remove`. |
| 5  | Permission matrix includes all feedback, evidence, and section assignment permissions | VERIFIED | `src/lib/permissions.ts` has all 8 new permissions: `section:assign`, `section:read_assignments`, `feedback:submit`, `feedback:read_own`, `feedback:read_all`, `feedback:review`, `evidence:upload`, `evidence:read`. ACTIONS has 11 new constants. 31 permission tests in `feedback-permissions.test.ts`. |
| 6  | tRPC routers for feedback, sectionAssignment, and evidence are registered in _app.ts | VERIFIED | `src/server/routers/_app.ts` imports and registers all three routers as `feedback`, `sectionAssignment`, `evidence`. |
| 7  | Stakeholder can navigate to a section and submit structured feedback | VERIFIED | `app/(workspace)/policies/[id]/sections/[sectionId]/feedback/new/page.tsx` is a server component fetching section title and user info via tRPC server caller. `SubmitFeedbackForm` has all 8 required fields: type, priority, impact, title, body, suggested change, anonymity toggle. `trpc.feedback.submit.useMutation()` is called on submit. Success shows toast with readableId. |
| 8  | Policy Lead can view a filterable inbox of all feedback for a policy document | VERIFIED | `FeedbackInbox` calls `trpc.feedback.list.useQuery()` with filter state. `FilterPanel` has 6 filter dimensions (section, status, type, priority, impact, org type) using Checkbox groups. Client-side multi-filter applied for multi-select. Two-column layout with mobile Sheet for filter panel. |
| 9  | Feedback detail sheet opens on card click and shows full feedback content | FAILED | `FeedbackDetailSheet` component is fully implemented (50+ lines, fetches getById and listTransitions, renders metadata, body, suggested change, EvidenceList, DecisionLog, TriageActions). However it is NEVER imported or rendered. `FeedbackInbox` sets `selectedFeedbackId` on card click but does not pass it to `FeedbackDetailSheet` — the component is orphaned. Clicking a card has no visible effect. |
| 10 | Policy Lead can transition feedback through lifecycle states via triage action buttons | FAILED | `TriageActions` is correctly implemented and rendered inside `FeedbackDetailSheet` (startReview, decide, close mutations all wired). `RationaleDialog` enforces >= 20 char rationale. However, since `FeedbackDetailSheet` is never mounted (gap above), triage actions are unreachable. |

**Score:** 8/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema/feedback.ts` | Feedback table + 4 enums | VERIFIED | All fields present, 4 pgEnums defined |
| `src/db/schema/sectionAssignments.ts` | Section assignments table | VERIFIED | Unique constraint on (userId, sectionId) |
| `src/db/schema/evidence.ts` | Evidence + 2 join tables | VERIFIED | evidenceArtifacts, feedbackEvidence, sectionEvidence all present |
| `src/db/migrations/0002_feedback_system.sql` | Full migration with sequence | VERIFIED | CREATE SEQUENCE, 5 tables, 5 enums, indexes |
| `src/server/machines/feedback.machine.ts` | XState 5 feedback machine | VERIFIED | setup().createMachine(), hasRationale guard, 6 states, final state |
| `src/server/services/feedback.service.ts` | transitionFeedback service | VERIFIED | Full XState restore-transition-persist loop, workflowTransitions log |
| `src/server/rbac/section-access.ts` | requireSectionAccess middleware | VERIFIED | BYPASS_SECTION_SCOPE, DB check, composable via .use() |
| `src/server/routers/feedback.ts` | Feedback tRPC router | VERIFIED | 7 procedures: submit, list, listOwn, getById, startReview, decide, close, listTransitions |
| `src/server/routers/sectionAssignment.ts` | Section assignment router | VERIFIED | assign, unassign, listBySection, listByUser |
| `src/server/routers/evidence.ts` | Evidence router | VERIFIED | attach, listByFeedback, listBySection, remove |
| `app/(workspace)/policies/[id]/feedback/page.tsx` | Feedback inbox page | VERIFIED | Server component, passes documentId to FeedbackInbox |
| `app/(workspace)/policies/[id]/sections/[sectionId]/feedback/new/page.tsx` | Submit feedback page | VERIFIED | Fetches section + user, passes to SubmitFeedbackForm |
| `app/(workspace)/feedback/outcomes/page.tsx` | Outcomes page | VERIFIED | Renders OutcomesList with summary stats and accordion |
| `app/(workspace)/policies/[id]/feedback/_components/feedback-card.tsx` | Feedback card | VERIFIED | Type/priority/status badges, body preview, footer metadata |
| `app/(workspace)/policies/[id]/feedback/_components/filter-panel.tsx` | Multi-filter panel | VERIFIED | 221 lines, 6 filter dimensions, Checkbox groups |
| `app/(workspace)/policies/[id]/feedback/_components/feedback-detail-sheet.tsx` | Detail sheet | ORPHANED | Fully implemented (267 lines), but never imported or rendered anywhere |
| `app/(workspace)/policies/[id]/feedback/_components/triage-actions.tsx` | Triage buttons | ORPHANED (indirect) | Correctly implemented and rendered inside FeedbackDetailSheet, but inaccessible since the sheet is never mounted |
| `app/(workspace)/policies/[id]/feedback/_components/rationale-dialog.tsx` | Rationale dialog | ORPHANED (indirect) | Called by TriageActions; inaccessible for same reason |
| `app/(workspace)/policies/[id]/feedback/_components/decision-log.tsx` | Decision log | ORPHANED (indirect) | Rendered inside FeedbackDetailSheet; inaccessible |
| `app/(workspace)/policies/[id]/feedback/_components/evidence-list.tsx` | Evidence list | ORPHANED (indirect) | Rendered inside FeedbackDetailSheet; inaccessible |
| `app/(workspace)/policies/[id]/feedback/_components/evidence-attachment.tsx` | Evidence attachment | VERIFIED | Wired in EvidenceList which is rendered in FeedbackDetailSheet |
| `app/api/uploadthing/core.ts` | evidenceUploader route | VERIFIED | evidenceUploader added with image/pdf/blob, 5 files, auth middleware |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `submit-feedback-form.tsx` | `feedback.ts` (router) | `trpc.feedback.submit.useMutation()` | WIRED | Pattern `feedback.submit` found in file, mutation called in handleSubmit |
| `feedback-inbox.tsx` | `feedback.ts` (router) | `trpc.feedback.list.useQuery()` | WIRED | Pattern `feedback.list` found, query result drives FeedbackCard render |
| `outcomes-list.tsx` | `feedback.ts` (router) | `trpc.feedback.listOwn.useQuery()` | WIRED | Pattern `feedback.listOwn` found, items drive outcomes list render |
| `triage-actions.tsx` | `feedback.ts` (router) | `trpc.feedback.startReview/decide/close` | WIRED | All 3 mutations found (`startReview`, `decide`, `close`) |
| `rationale-dialog.tsx` | `feedback.ts` (router) | `trpc.feedback.decide.useMutation()` | WIRED | Pattern `feedback.decide` found, mutation called in handleConfirm |
| `evidence-attachment.tsx` | `evidence.ts` (router) | `trpc.evidence.attach.useMutation() + useUploadThing('evidenceUploader')` | WIRED | Both patterns found; `useUploadThing('evidenceUploader')` and `evidence.attach.useMutation()` called |
| `evidence-list.tsx` | `evidence.ts` (router) | `trpc.evidence.listByFeedback.useQuery()` | WIRED | Pattern `evidence.listByFeedback` found, data drives evidence rows |
| `feedback-detail-sheet.tsx` | `feedback.ts` (router) | `trpc.feedback.getById.useQuery()` + `listTransitions` | WIRED (internally) | Both queries present. Sheet is never mounted externally — orphaned. |
| `feedback.ts` (router) | `feedback.service.ts` | `transitionFeedback()` call | WIRED | `transitionFeedback` imported and called in startReview, decide, close procedures |
| `feedback.service.ts` | `feedback.machine.ts` | `createActor(feedbackMachine, { snapshot })` | WIRED | `createActor` from 'xstate' imported, `feedbackMachine` restored with snapshot |
| `feedback.ts` (router) | `section-access.ts` | `.use(requireSectionAccess('sectionId'))` | WIRED | `requireSectionAccess` imported and chained in `submit` procedure |
| `feedback-inbox.tsx` | `feedback-detail-sheet.tsx` | Render on card click (selectedFeedbackId) | NOT WIRED | `FeedbackDetailSheet` not imported in feedback-inbox.tsx; selectedFeedbackId state has no consumer |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `feedback-inbox.tsx` | `feedbackQuery.data` | `trpc.feedback.list` -> `feedbackItems` table LEFT JOIN users | DB query with conditions on documentId + optional filters | FLOWING |
| `outcomes-list.tsx` | `feedbackQuery.data` | `trpc.feedback.listOwn` -> `feedbackItems` WHERE submitterId = userId | DB query with WHERE clause | FLOWING |
| `submit-feedback-form.tsx` | Form fields | User input -> `feedback.submit` mutation -> INSERT feedbackItems | INSERT with nextval() for readableId | FLOWING |
| `evidence-list.tsx` | `evidenceQuery.data` | `trpc.evidence.listByFeedback` -> feedbackEvidence JOIN evidenceArtifacts | DB JOIN query | FLOWING |
| `feedback-detail-sheet.tsx` | `feedbackQuery.data` + `transitionsQuery.data` | `feedback.getById` + `feedback.listTransitions` | Real DB queries | FLOWING (but sheet is never mounted) |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| XState machine module exports correctly | `node -e "const m = require('./node_modules/xstate'); console.log(typeof m.setup)"` | setup is a function | PASS |
| feedbackMachine exports present | Static file check: `feedbackMachine`, `FeedbackStatus`, `FeedbackEvent` all exported | Present in feedback.machine.ts | PASS |
| transitionFeedback function exists | Static check: function signature and DB operations | Present and complete in feedback.service.ts | PASS |
| All 3 routers registered in _app.ts | Static check: feedbackRouter, sectionAssignmentRouter, evidenceRouter all in appRouter | VERIFIED | PASS |
| Migration has all DDL | grep for CREATE SEQUENCE, 5 CREATE TABLE, 5 CREATE TYPE | All present in 0002_feedback_system.sql | PASS |
| FeedbackDetailSheet mounted in UI | Search for import/usage of FeedbackDetailSheet outside own file | Not found anywhere | FAIL |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FB-01 | 04-01, 04-02 | Authenticated user can submit feedback tied to a policy section | SATISFIED | `feedback.submit` tRPC procedure requires `feedback:submit` permission + section scoping. SubmitFeedbackForm wired to mutation. |
| FB-02 | 04-01, 04-02 | Feedback has a human-readable ID (FB-001, FB-002, etc.) | SATISFIED | `nextval('feedback_id_seq')` used in submit procedure, padded to `FB-NNN`, shown in success toast |
| FB-03 | 04-01, 04-02 | Feedback captures type (5 values), priority (3), impact category (8) | SATISFIED | All 3 enums defined in schema and form. Zod validation enforces correct values. |
| FB-04 | 04-01, 04-02 | Feedback captures title, body, optional suggested change | SATISFIED | All 3 fields in schema (notNull for title/body, nullable for suggestedChange) and SubmitFeedbackForm |
| FB-05 | 04-01, 04-03 | Feedback can have evidence artifacts attached (files or links) | SATISFIED | evidenceArtifacts + feedbackEvidence schema. evidence.attach wires to feedbackEvidence insert. EvidenceAttachment handles file upload + link add. |
| FB-06 | 04-01, 04-03 | Feedback lifecycle: Submitted -> Under Review -> Accepted/Partially Accepted/Rejected -> Closed | SATISFIED (backend only) | XState machine enforces all transitions. transitionFeedback service persists state. TriageActions implements all lifecycle buttons — but unreachable due to orphaned sheet. Backend is complete; UI access blocked by gap. |
| FB-07 | 04-01, 04-03 | Every accept/reject/partial decision requires mandatory rationale (decision log) | SATISFIED (backend only) | hasRationale guard in XState machine. Zod `rationale.min(20)` in decide procedure. RationaleDialog client enforcement >= 20 chars. workflowTransitions log. DecisionLog component renders decisions. UI access blocked by orphaned sheet. |
| FB-08 | 04-01, 04-02 | Stakeholder can choose anonymous or named attribution per feedback item | SATISFIED | `isAnonymous` field in schema. AnonymityToggle component in form. Server-side anonymity enforcement in list/getById procedures (submitterId nulled for non-admin/policy_lead callers). |
| FB-09 | 04-02, 04-03 | Stakeholder can view status and outcome of their own feedback items | SATISFIED | OutcomesList calls `feedback.listOwn`, shows summary stats, inline accordion with decisionRationale. |
| FB-10 | 04-02 | Policy Lead can filter feedback by section, org type, priority, status, impact, feedback type | SATISFIED | FilterPanel has all 6 dimensions. FeedbackInbox passes filters to useQuery with client-side multi-filter. |
| AUTH-05 | 04-01, 04-02 | Stakeholder can only interact with sections they are assigned to | SATISFIED | requireSectionAccess middleware checks section_assignments. BYPASS_SECTION_SCOPE allows admin/auditor/policy_lead to bypass. Wired into feedback.submit procedure. |
| AUTH-08 | 04-01, 04-02 | Privacy preferences: user can choose anonymous or named attribution for public outputs | SATISFIED | Per-feedback-item anonymity choice via AnonymityToggle + isAnonymous field + server-side enforcement on reads. |
| EV-01 | 04-01, 04-03 | User can upload evidence artifacts (files) or add links as evidence | SATISFIED | evidenceUploader Uploadthing route. EvidenceAttachment component with file upload + link add tabs. evidence.attach mutation. |
| EV-02 | 04-01, 04-03 | Evidence can be attached to feedback items and policy sections | SATISFIED | feedbackEvidence and sectionEvidence join tables. evidence.attach accepts feedbackId or sectionId. |

**All 14 requirements have implementation evidence.** FB-06 and FB-07 are fully implemented in the backend and the individual UI components, but the triage workflow is inaccessible to users until the FeedbackDetailSheet wiring gap is fixed.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `feedback-detail-sheet.tsx` | 135 | `const canTriage = true // Server-side permission check on mutations will enforce` | WARNING | Triage buttons rendered for all users regardless of role. Server mutations will reject unauthorized calls, but UI misleads non-reviewers. Not a blocker given server enforcement, but suboptimal UX. |
| `feedback-detail-sheet.tsx` | 93-266 | Component is never imported or used | BLOCKER | Entire sheet, triage, decision log, and evidence-in-detail-view are inaccessible to users |
| `feedback-inbox.tsx` | 19 | `selectedFeedbackId` state set on card click but never consumed | BLOCKER | Card clicks are silently no-ops; users cannot open any feedback detail |

---

### Human Verification Required

#### 1. Feedback Form Field Validation and Submission

**Test:** Navigate to a section page and click to submit feedback. Try submitting with only some fields filled.
**Expected:** Submit button disabled until all required fields (type, priority, impact, title >= 1 char, body >= 10 chars) are populated. Successful submit shows sonner toast with "Feedback submitted. Your feedback ID is FB-001."
**Why human:** Client-side form state and toast behavior require browser interaction.

#### 2. Feedback Inbox Filter Interaction

**Test:** Open the feedback inbox as Policy Lead. Use the filter panel to select multiple statuses, then a single type.
**Expected:** Multi-select (>= 2 checkboxes) applies client-side filter. Single-select passes filter to server query. Section dropdown filters to one section's feedback. "Clear all" resets to full list.
**Why human:** Multi-filter client + server logic requires interactive browser testing with real data.

#### 3. Anonymous Feedback Identity Enforcement

**Test:** Submit feedback as a Stakeholder with isAnonymous=true. View the feedback card as Policy Lead and as a Research Lead.
**Expected:** Policy Lead sees submitter name (admin/policy_lead bypass server anonymity). Research Lead sees "Anonymous" for submitter name.
**Why human:** Multi-user role switching required to verify server-side enforcement in the rendered UI.

#### 4. Evidence File Upload Flow

**Test:** Open EvidenceAttachment component (after FeedbackDetailSheet wiring gap is fixed). Drop a PDF file onto the drop zone.
**Expected:** Progress bar shows during upload, file row appears after completion, Evidence list updates via cache invalidation.
**Why human:** Requires live Uploadthing endpoint and browser file drag interaction.

---

### Gaps Summary

**One root cause blocks two truths:** The `FeedbackDetailSheet` component was built correctly (267 lines, real data queries, complete triage and evidence integration) but was never imported into the `FeedbackInbox` component or the feedback page. The `FeedbackInbox` component captures `selectedFeedbackId` state when cards are clicked but has no render that consumes this state to open the sheet.

This single missing `import` + `<FeedbackDetailSheet ... />` render call blocks:
- Truth 9: Detail sheet opening on card click (FAILED)
- Truth 10: Policy Lead triage workflow (FAILED — triage works correctly, just unreachable)
- FB-06 and FB-07 UI components (backend fully satisfied, UI access blocked)

The fix is small (2-3 lines added to `feedback-inbox.tsx`) but has high user-impact because it blocks the entire triage workflow from being usable.

All 14 phase requirements have working implementations. The gap is a wiring omission at the page composition layer, not a missing or stub implementation.

---

_Verified: 2026-03-25T05:30:00Z_
_Verifier: Claude (gsd-verifier)_

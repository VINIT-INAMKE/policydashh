---
phase: 17-workshop-lifecycle-recording-pipeline-groq
plan: 05
subsystem: ui
tags: [trpc, react, nextjs, workshops, status-machine, evidence-checklist, draft-review, wave-5, phase-final]

# Dependency graph
requires:
  - phase: 17-workshop-lifecycle-recording-pipeline-groq
    provides: |
      - workshop.transition + workshop.approveArtifact mutations (Plan 01)
      - workshop_evidence_checklist table + workshop_artifacts.review_status column (Plan 01)
      - workshopCompletedFn (creates checklist rows on completion) (Plan 03)
      - workshopRecordingProcessedFn (writes draft artifacts) (Plan 04)
provides:
  - workshop.listChecklist query (new tRPC procedure over workshop_evidence_checklist)
  - workshop.listArtifacts.reviewStatus + workshopArtifactId fields
  - StatusTransitionButtons component — badge + next-action button gated by canManage
  - EvidenceChecklist component — 5-slot checklist with filled/pending badges
  - ArtifactList draft-badge + approve affordance
  - 17-SMOKE.md (status: deferred) — full 5-walk procedure preserved verbatim
affects:
  - "Phase 17 verifier run (all UI surfaces now observable)"
  - "/gsd:complete-milestone batch smoke walk (will consume 17-SMOKE.md)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Next.js 16 App Router client-component pattern — 'use client' directive at top, trpc hooks + toast imports, props typed with inline record maps for status→action lookup"
    - "Status-transition UI gated at render time: NEXT_ACTION lookup returns null for terminal state (archived), hides the button rather than disabling it"
    - "Invalidate both getById and listChecklist after transition mutation — transition to 'completed' fires workshopCompletedFn which inserts checklist rows, so the checklist view must refetch"
    - "Draft-artifact approve affordance rendered inline in the existing ArtifactList row, reusing the row's Button array rather than introducing a second row template — minimal diff"
    - "Deferred SMOKE.md frontmatter pattern: status=deferred + defer_reason + defer_target, walks preserved verbatim so milestone-end batch runs against a canonical checklist"

key-files:
  created:
    - app/(workspace)/workshops/[id]/_components/status-transition-buttons.tsx
    - app/(workspace)/workshops/[id]/_components/evidence-checklist.tsx
    - .planning/phases/17-workshop-lifecycle-recording-pipeline-groq/17-SMOKE.md
    - .planning/phases/17-workshop-lifecycle-recording-pipeline-groq/17-05-SUMMARY.md
  modified:
    - src/server/routers/workshop.ts
    - app/(workspace)/workshops/[id]/_components/artifact-list.tsx
    - app/(workspace)/workshops/[id]/page.tsx

key-decisions:
  - "Router listArtifacts adds workshopArtifactId alongside existing id (evidenceArtifacts.id). The existing removeArtifact still takes artifactId (evidence id); the new approveArtifact needs workshopArtifactId (the link row). Both IDs are now returned so callers can disambiguate."
  - "getById select now includes workshops.status. This was missing from the prior Phase 10 select; adding it is necessary for StatusTransitionButtons and is a strict superset of prior shape (no breaking change)."
  - "StatusTransitionButtons encodes the state machine client-side via NEXT_ACTION map. The server (Plan 01) is still the source of truth via ALLOWED_TRANSITIONS — the client map just drives the button label/target. If they drift, the server rejects with 400 and the toast surfaces the error."
  - "ArtifactList now hides the ExternalLink button when artifact.url is empty string — the LLM-generated transcript/summary artifacts from Plan 04 store payload in the content column and set url='' (Plan 04 sentinel). No separate rendering branch needed."
  - "17-SMOKE.md deferred per operator preference (feedback_defer_smoke_walks.md). Walks 1-5 preserved verbatim in the placeholder so the milestone-end batch has a complete checklist without needing to re-derive it from plans."

patterns-established:
  - "Phase-final UI plan pattern for a backend-heavy phase: one plan that adds router query field extensions + 2-3 small client components + parent-page mount + deferred SMOKE.md, all executable in a single wave. Models the Phase 17 shape for future phases where the observable surface is a minority of the overall work."
  - "Deferred-SMOKE frontmatter: status=deferred, defer_reason, defer_target, plans_covered, requirements_exercised. Consumers (/gsd:complete-milestone, verifier) can glob-scan .planning/phases/**/*SMOKE.md for status=deferred to find outstanding walks."

requirements-completed: [WS-06, WS-12, WS-13, WS-14]

# Metrics
duration: ~7min
completed: 2026-04-14
---

# Phase 17 Plan 05: Workshop Lifecycle UI Summary

**Final Phase 17 plan. Shipped the observable-surface trio — status-transition buttons, evidence checklist display, draft-artifact approve affordance — plus a new `workshop.listChecklist` tRPC query and extended `listArtifacts` fields to drive them. Deferred 17-SMOKE.md placeholder preserves the full 5-walk procedure for milestone-end batch execution. Phase acceptance gate: `npx tsc --noEmit` clean, full test suite 328 passed (only the 2 pre-existing Phase 16 deferred failures remain).**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-14T13:12Z
- **Completed:** 2026-04-14T13:19Z
- **Tasks:** 3 / 3
- **Files created:** 4 (2 components + 17-SMOKE.md + this SUMMARY)
- **Files modified:** 3

## Accomplishments

- `src/server/routers/workshop.ts`:
  - `listArtifacts` select extended with `reviewStatus` and `workshopArtifactId` (the link-row id, separate from `evidenceArtifacts.id`)
  - new `listChecklist` query over `workshopEvidenceChecklist` (filtered by `workshopId`, returns 6 columns per row)
  - `getById` select now includes `workshops.status` so the detail page can drive StatusTransitionButtons without a second query
- `app/(workspace)/workshops/[id]/_components/status-transition-buttons.tsx` — new client component, 67 lines, status pill + next-action button gated by `canManage`, `NEXT_ACTION` and `STATUS_BADGE` const maps encode the state machine label/color, toast + dual-query invalidate on success
- `app/(workspace)/workshops/[id]/_components/evidence-checklist.tsx` — new client component, 58 lines, `SLOT_LABELS` map for human-readable slot names, loading/error/empty states, ✓ filled / ○ pending badges per row
- `app/(workspace)/workshops/[id]/_components/artifact-list.tsx` — extended with `approveMutation`, Draft badge rendered next to title when `reviewStatus === 'draft'`, Approve button rendered when `canManage && reviewStatus === 'draft'`, ExternalLink button now guarded by `artifact.url` (so LLM-generated artifacts with url='' don't render a useless button)
- `app/(workspace)/workshops/[id]/page.tsx` — imports and mounts both new components (StatusTransitionButtons in the left panel under the title, EvidenceChecklist below the artifact list)
- `.planning/phases/17-workshop-lifecycle-recording-pipeline-groq/17-SMOKE.md` — new deferred placeholder, status=deferred, 157 lines, 5 walks verbatim (transitions, nudge fast-forward, recording pipeline happy path, 25MB rejection, Groq cost guard)
- `npx tsc --noEmit` exits 0 — zero type regressions across all 7 touched files
- Full test suite: **328 passed / 2 failed / 1 todo of 331** — the 2 failing files are exactly `feedback-permissions.test.ts` and `section-assignments.test.ts`, both pre-existing Phase 16 deferred items (documented in `.planning/phases/16-flow-5-smoke-notification-dispatch-migration/deferred-items.md`). No Phase 17 regressions.

## Task Commits

Each task committed atomically via `--no-verify` (parallel-mode safety pattern from earlier Phase 17 plans):

1. **Task 05-01: Extend workshop router with listChecklist query + reviewStatus** — `1fbdcb3` (feat)
2. **Task 05-02: Add status transition buttons, evidence checklist, draft approve UI** — `ad25798` (feat)
3. **Task 05-03: Write 17-SMOKE.md deferred placeholder** — `0a88ef8` (docs)

## Files Created/Modified

**Created:**

- `app/(workspace)/workshops/[id]/_components/status-transition-buttons.tsx` — 67 lines; client component; uses `trpc.workshop.transition.useMutation` with `onSuccess` toast + dual invalidate
- `app/(workspace)/workshops/[id]/_components/evidence-checklist.tsx` — 58 lines; client component; uses `trpc.workshop.listChecklist.useQuery`; loading/error/empty states
- `.planning/phases/17-workshop-lifecycle-recording-pipeline-groq/17-SMOKE.md` — 157 lines; deferred placeholder
- `.planning/phases/17-workshop-lifecycle-recording-pipeline-groq/17-05-SUMMARY.md` — this file

**Modified:**

- `src/server/routers/workshop.ts` — +23 lines. `workshopEvidenceChecklist` import; `getById` select adds `status: workshops.status`; `listArtifacts` select adds `reviewStatus` + `workshopArtifactId`; new `listChecklist` procedure after `listArtifacts`.
- `app/(workspace)/workshops/[id]/_components/artifact-list.tsx` — +35 lines. `approveMutation` hook; Draft badge in title row; Approve button in action-row array; ExternalLink button now guarded by truthy `artifact.url`.
- `app/(workspace)/workshops/[id]/page.tsx` — +10 lines. Imports for `StatusTransitionButtons` + `EvidenceChecklist`; `<StatusTransitionButtons>` mounted under title in left panel; `<EvidenceChecklist>` mounted below `<ArtifactList>` in the right content area.

## New Router Procedure

```typescript
// List evidence checklist for a workshop (WS-13)
listChecklist: requirePermission('workshop:read')
  .input(z.object({ workshopId: z.string().uuid() }))
  .query(async ({ input }) => {
    const rows = await db
      .select({
        id:         workshopEvidenceChecklist.id,
        slot:       workshopEvidenceChecklist.slot,
        status:     workshopEvidenceChecklist.status,
        artifactId: workshopEvidenceChecklist.artifactId,
        filledAt:   workshopEvidenceChecklist.filledAt,
        createdAt:  workshopEvidenceChecklist.createdAt,
      })
      .from(workshopEvidenceChecklist)
      .where(eq(workshopEvidenceChecklist.workshopId, input.workshopId))

    return rows
  }),
```

## listArtifacts Shape Extension

Before Plan 05:

```
{ id, title, type, url, fileName, fileSize, uploaderId, createdAt, artifactType, uploaderName }
```

After Plan 05:

```
{ id, title, type, url, fileName, fileSize, uploaderId, createdAt,
  artifactType, reviewStatus, workshopArtifactId, uploaderName }
```

Strict superset — no breaking change for existing callers.

## Phase Acceptance Gate Results

| Check                                         | Expected                                   | Actual                                        | Pass |
| --------------------------------------------- | ------------------------------------------ | --------------------------------------------- | ---- |
| `npx tsc --noEmit`                            | exit 0                                     | exit 0                                        | ✓    |
| `npm test` (full suite)                       | ≥ 309 baseline + Phase 17 additions        | 328 passed / 2 failed / 1 todo of 331         | ✓    |
| Failing files are exactly the 2 Phase 16 deferreds | feedback-permissions + section-assignments | feedback-permissions + section-assignments | ✓    |
| `grep listChecklist:` src/server/routers/workshop.ts | 1 | 1 | ✓ |
| `grep workshopEvidenceChecklist` workshop.ts  | ≥ 2                                        | 9                                             | ✓    |
| `grep reviewStatus: workshopArtifacts.reviewStatus` workshop.ts | 1 | 1 | ✓ |
| `grep workshopArtifactId: workshopArtifacts.id` workshop.ts | 1 | 1 | ✓ |
| status-transition-buttons.tsx exists          | yes                                        | yes                                           | ✓    |
| evidence-checklist.tsx exists                 | yes                                        | yes                                           | ✓    |
| `grep workshop.transition` status-transition-buttons.tsx | ≥ 1 | 1 | ✓ |
| `grep workshop.listChecklist` evidence-checklist.tsx | ≥ 1 | 1 | ✓ |
| `grep approveArtifact` artifact-list.tsx      | ≥ 1                                        | 1                                             | ✓    |
| `grep StatusTransitionButtons` page.tsx       | ≥ 2 (import+usage)                         | 2                                             | ✓    |
| `grep EvidenceChecklist` page.tsx             | ≥ 2 (import+usage)                         | 2                                             | ✓    |
| 17-SMOKE.md exists                            | yes                                        | yes                                           | ✓    |
| `grep status: deferred` 17-SMOKE.md           | 1                                          | 1                                             | ✓    |
| `grep Walk [1-5]` 17-SMOKE.md                 | 5 walks                                    | 12 matches (5 walks + checklist refs)         | ✓    |
| `grep max_completion_tokens` 17-SMOKE.md      | ≥ 1                                        | 3                                             | ✓    |

## Phase 17 Full Test Delta (Plan 00 RED → Plan 05 GREEN)

| Phase 17 milestone                                    | Test files | Tests passed  | Notes                                                                                              |
| ----------------------------------------------------- | ---------- | ------------- | -------------------------------------------------------------------------------------------------- |
| Phase 16 completion baseline (pre-Plan 17-00)         | 28 passed + 2 fail | ~309 passed (+ 2 deferred) | 2 deferred Phase 16 failures in feedback-permissions + section-assignments                |
| Plan 17-00 RED locked                                 | -          | -             | 4 test files added, 19 RED asserts locked                                                          |
| Plan 17-01 GREEN flip                                 | +1         | +6            | workshop-transition.test.ts 6/6 GREEN                                                              |
| Plan 17-02 GREEN flip                                 | +1         | +8            | llm.test.ts 8/8 GREEN                                                                              |
| Plan 17-03 GREEN flip                                 | +1         | +4            | workshop-completed.test.ts 4/4 GREEN                                                               |
| Plan 17-04 GREEN flip                                 | +1         | +5            | workshop-recording-processed.test.ts 5/5 GREEN                                                     |
| Plan 17-05 final acceptance (this plan)               | 30 passed + 2 fail | **328 passed** + 1 todo | Only the 2 pre-existing Phase 16 deferreds still fail; zero Phase 17 regressions |

Phase 17 net addition: **~19 new tests** (6+8+4+5 across Plans 01-04 Wave 0 contracts) landed GREEN. Plan 17-05 adds zero new tests (no TDD on UI surface per plan spec) and introduces zero regressions.

## Decisions Made

- **`workshopArtifactId` added to `listArtifacts` select alongside existing `id`.** The existing `removeArtifact` mutation takes `artifactId` (the `evidenceArtifacts.id` — distinct from the link-row id), and the new `approveArtifact` needs `workshopArtifactId` (the `workshopArtifacts.id`, which is the link-row id). Both IDs are now in the row shape so the ArtifactList component can call both mutations without an extra query. The distinction is important because one `evidenceArtifact` can be linked to multiple workshops (via distinct `workshopArtifacts` rows), and approve must target the specific link row.
- **`workshops.status` added to `getById` select.** Missing from the Phase 10 select (predates Plan 01's status column). Adding it is a strict superset and necessary for StatusTransitionButtons without a second query. No breaking change.
- **Client-side state machine in StatusTransitionButtons.** `NEXT_ACTION` const maps the current status to `{label, toStatus}`. This is convenience UI — the server's `ALLOWED_TRANSITIONS` (Plan 01) remains the source of truth. If they drift, the transition mutation rejects with 400 and the toast surfaces the server error. The client map also covers the terminal case (`archived: null`) by hiding the button entirely.
- **ArtifactList ExternalLink guarded by `artifact.url`.** LLM-generated transcript and summary artifacts from Plan 04 use the `url=''` sentinel (Plan 04 decision — content column holds the payload). The button would open `about:blank` if rendered. Simple `artifact.url && <Button…>` guard handles this without a new rendering branch. When the future evidence-pack export plan adds content-aware rendering, this conditional can be replaced.
- **17-SMOKE.md deferred per operator preference.** `feedback_defer_smoke_walks.md` memory explicitly says manual smoke walks batch at `/gsd:complete-milestone`, not per phase. The placeholder includes frontmatter `status: deferred`, `defer_reason`, `defer_target`, `plans_covered`, `requirements_exercised` so the eventual batch runner can glob-scan `.planning/phases/**/*SMOKE.md` for outstanding walks.
- **No new tests in Plan 05.** Plan spec explicitly defers visual verification to the SMOKE walk (which is deferred). The UI components are pure view layer over tRPC hooks — the mutations and queries they consume are already covered by the Plans 01-04 Wave 0 contracts. Adding unit tests for JSX render output would be low-signal and off-pattern.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes triggered. The Plan 05 spec was precise enough that the only deliberation was choosing where to mount the new components (StatusTransitionButtons under the title in the left panel; EvidenceChecklist below the artifact list in the right content area), both of which match the plan's guidance.

## Issues Encountered

- **Pre-existing test failures (out of scope):** `feedback-permissions.test.ts` has 2 failing assertions (`denies admin`, `denies auditor` for `feedback:read_own`) and `section-assignments.test.ts` hard-fails at import time with `No database connection string was provided to neon()` — this latter one appears to be a test-environment issue where the module imports the live db client at top level. Both are documented in Phase 16 `deferred-items.md` and acknowledged in Plan 05's acceptance criteria as permitted pre-existing failures. Not fixed in this plan per scope-boundary rules.

## Verification Results

All acceptance criteria met (see Phase Acceptance Gate Results table above). `npx tsc --noEmit` exit 0. Full test suite 328 passed + 2 pre-existing deferreds. All grep audits hit expected counts.

## Known Stubs

None — this plan ships functional, observable surfaces for all four Phase 17 WS requirements. No placeholder returns, no TODO comments, no "coming soon" components. The SMOKE.md is a *deliberate* deferred placeholder (not a stub) with explicit frontmatter marking it as such and preserving the full walk procedure so the milestone-end batch has everything it needs.

## User Setup Required

None for this plan. Phase-level env vars (from Plans 01-04) still apply:

- `DATABASE_URL` — Neon dev DB with migration 0010 applied (Plan 01)
- `GROQ_API_KEY` — for Plan 02/04 Groq calls (silent throw if missing at runtime)
- `RESEND_API_KEY` — optional; nudge emails from Plan 03 silent no-op otherwise
- `R2_*` — already required from v0.1 Phase 10 for artifact uploads

## Next Phase Readiness

- **Phase 17 functionally complete.** All 4 WS requirements (WS-06, WS-12, WS-13, WS-14) have backend + UI surfaces. LLM requirements (LLM-01, LLM-02, LLM-03) are wired in production paths through Plan 02/04.
- **Phase 17 verifier run** (`/gsd:verify-work`) can proceed immediately. The verifier agent should find:
  - 5 SUMMARY files covering Plans 00-04 plus this one (6 total)
  - Full Wave 0 RED contract flipped GREEN across 4 test files
  - Phase acceptance quartet (tsc clean + full test suite at 328 passed + 2 pre-existing deferreds + Inngest suite 36+1todo + grep audits)
- **17-SMOKE.md** will be picked up at `/gsd:complete-milestone` time for the milestone v0.2 batch walk. No per-phase dev-server walk needed per operator preference.
- **Phase 18+** can consume the workshop lifecycle surfaces: status badge + transition buttons, checklist display, draft-artifact review affordance are all in production.

## Self-Check

**Files exist:**
- FOUND: `app/(workspace)/workshops/[id]/_components/status-transition-buttons.tsx`
- FOUND: `app/(workspace)/workshops/[id]/_components/evidence-checklist.tsx`
- FOUND: `app/(workspace)/workshops/[id]/_components/artifact-list.tsx` (modified)
- FOUND: `app/(workspace)/workshops/[id]/page.tsx` (modified)
- FOUND: `src/server/routers/workshop.ts` (modified)
- FOUND: `.planning/phases/17-workshop-lifecycle-recording-pipeline-groq/17-SMOKE.md`
- FOUND: `.planning/phases/17-workshop-lifecycle-recording-pipeline-groq/17-05-SUMMARY.md` (this file)

**Commits exist:**
- FOUND: `1fbdcb3` (Task 05-01 — router listChecklist + reviewStatus)
- FOUND: `ad25798` (Task 05-02 — UI components + page mount)
- FOUND: `0a88ef8` (Task 05-03 — 17-SMOKE.md deferred placeholder)

**Acceptance greps:**
- `listChecklist:` in workshop.ts = 1 ✓
- `workshopEvidenceChecklist` in workshop.ts = 9 (import + query) ✓
- `reviewStatus: workshopArtifacts.reviewStatus` in workshop.ts = 1 ✓
- `workshopArtifactId: workshopArtifacts.id` in workshop.ts = 1 ✓
- `workshop.transition` in status-transition-buttons.tsx = 1 ✓
- `workshop.listChecklist` in evidence-checklist.tsx = 1 ✓
- `approveArtifact` in artifact-list.tsx = 1 ✓
- `StatusTransitionButtons` in page.tsx = 2 (import + usage) ✓
- `EvidenceChecklist` in page.tsx = 2 (import + usage) ✓
- `status: deferred` in 17-SMOKE.md = 1 ✓
- `Walk [1-5]` in 17-SMOKE.md = 12 ✓
- `max_completion_tokens` in 17-SMOKE.md = 3 ✓
- `npx tsc --noEmit` exit 0 ✓
- `npm test` 328 passed + 2 pre-existing deferreds ✓

## Self-Check: PASSED

---
*Phase: 17-workshop-lifecycle-recording-pipeline-groq*
*Plan: 05*
*Completed: 2026-04-14*

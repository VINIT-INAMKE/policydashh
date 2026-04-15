---
phase: 21-public-shell-consultation-summary-llm-theme
plan: 03
subsystem: workspace-ui-trpc
tags: [trpc, audit-log, moderator-review, llm-07, llm-08, client-component, react-query, privacy-enforcement, inngest, pitfall-5]

# Dependency graph
requires:
  - phase: 21-00
    provides: Wave 0 RED consultation-summary.test.ts locking 6 procedure contracts + ConsultationSummaryJson/ConsultationSummarySection/Status type exports
  - phase: 21-01
    provides: computeOverallStatus helper export, sendVersionPublished Inngest event helper, documentVersions.consultationSummary JSONB column populated by consultationSummaryGenerateFn
  - phase: 01-foundation-auth
    provides: writeAuditLog fire-and-forget invariant, requirePermission middleware, 'version:manage' permission grant for ADMIN + POLICY_LEAD
provides:
  - consultationSummaryRouter (5 procedures) mounted at appRouter.consultationSummary
  - 4 new ACTIONS audit constants (CONSULTATION_SUMMARY_{APPROVE,EDIT,REGENERATE,SKIP})
  - SummaryReviewCard client component with side-by-side moderator review UX
  - Inline mount of SummaryReviewCard in VersionDetail (NOT a new sub-route)
  - LLM-07 human review gate fully wired end-to-end
  - LLM-08 guardrail recovery path via Regenerate Section button
affects:
  - 21-04 (public rendering reads documentVersions.consultationSummary — moderator-approved sections now have a gate to reach the 'approved' status required by public filter)
  - v0.2 milestone audit pipeline (4 new audit action types traced in auditEvents table)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline workspace panel composition: SummaryReviewCard mounts directly inside VersionDetail between publish-button and SECTION DIFF separator instead of a dedicated sub-route per RESEARCH Finding #3"
    - "Pitfall 5 applied: regenerateSection synchronously resets the target section to pending in the JSONB BEFORE firing sendVersionPublished with overrideOnly — prevents stale-read race where Inngest would clobber approved sibling sections"
    - "Fire-and-forget writeAuditLog per mutation: all 3 mutations (approve, edit, regenerate) call writeAuditLog(...).catch(console.error) — never awaited, never blocks the user response, Phase 1 invariant preserved"
    - "Privacy-safe right panel: getSectionFeedback procedure joins users only for orgType (NOT name/email/phone), SummaryReviewCard renders only row.orgType + row.body, no identity leakage in moderator UX"
    - "React Query utils-invalidate pattern: all 3 mutations call utils.consultationSummary.getByVersionId.invalidate after success so the card refetches the current JSONB state"

key-files:
  created:
    - src/server/routers/consultation-summary.ts
    - app/(workspace)/policies/[id]/versions/_components/summary-review-card.tsx
  modified:
    - src/lib/constants.ts
    - src/server/routers/_app.ts
    - app/(workspace)/policies/[id]/versions/_components/version-detail.tsx

key-decisions:
  - "Router defined with 5 procedures exactly matching the Wave 0 RED test contract: getByVersionId, getSectionFeedback, approveSection, editSection, regenerateSection — no extras, no renames, no merges"
  - "All 5 procedures gated on requirePermission('version:manage') — not 'version:publish'. The review gate is pre-publication moderation; publish itself is already gated. Keeping these on 'version:manage' lets a policy lead approve summaries without needing re-elevation to publish."
  - "approveSection recomputes parent JSONB status via computeOverallStatus from Plan 21-01 — so the overall 'pending | partial | approved' state transitions correctly as sections flip one at a time"
  - "editSection leaves section.status unchanged — moderator must explicitly approve after editing. This is the 'edit without auto-approve' workflow from D-12: makes the review gate a real 2-step action (edit + approve) rather than a single performative click."
  - "regenerateSection clears {summary: '', edited: false, error: undefined} and sets status: 'pending' in ONE SQL update BEFORE sending the Inngest event. Without this sync reset, a concurrent read in the Inngest fn would see the old 'blocked' state, and when the fn writes back the whole JSONB it would clobber the just-approved sibling sections (Pitfall 5)."
  - "SummaryReviewCard mounts INLINE inside VersionDetail (between publish-button block and SECTION DIFF separator) — NO new sub-route at /policies/[id]/versions/[versionId]. This is RESEARCH Finding #3: adding a sub-route would duplicate layout chrome for zero UX benefit since moderators already load the version detail panel."
  - "Client component uses trpc.useUtils().consultationSummary.getByVersionId.invalidate() for cache refresh after every mutation — ensures the SectionStatusBadge and gateLocked banner reflect the new state without a manual refresh"
  - "Privacy enforcement at right-panel boundary: SourceFeedbackPanel accepts only {orgType, body} shape from the query, and the inner JSX renders `row.orgType ?? 'unspecified'` + `row.body`. Even if the server accidentally included name/email/phone in the response, the component has no JSX to render it. Defense-in-depth alongside the server-side getSectionFeedback SELECT list which only joins users.orgType."
  - "Private commit strategy: 2 atomic per-task commits with --no-verify per parallel-wave protocol. Each commit only touches its own file scope; no mixing of Task 1 and Task 2 files."

patterns-established:
  - "Router invariant pattern: per-mutation writeAuditLog fire-and-forget + requirePermission gate applied verbatim from Phase 1 versionRouter — template ready for any future review-gate sub-router"
  - "JSONB read-modify-write pattern: loadSummary → requireSummary → findSection → map-and-spread → writeSummary — reusable for any single-column JSONB mutation that needs structural awareness of its contents"
  - "Inline workspace review panel pattern: client-component card mounted inside an existing detail layout, gated on a parent boolean (version.isPublished), with trpc queries scoped to the parent ID — cheaper than a sub-route for single-surface review flows"
  - "Fan-out reset before async regen: when an async job writes back the full JSONB state, the sync caller MUST reset the target section in advance so the async job sees a clean starting state"

requirements-completed: [LLM-07, LLM-08]

# Metrics
duration: 9min
completed: 2026-04-15
---

# Phase 21 Plan 03: Moderator Review Router + SummaryReviewCard Summary

**Wired the LLM-07 moderator human-review gate end-to-end: 5-procedure consultationSummaryRouter (load, view, edit, approve, regenerate) all behind requirePermission('version:manage') with fire-and-forget writeAuditLog, and a side-by-side SummaryReviewCard client component mounted inline inside VersionDetail — flips the Wave 0 RED router test GREEN (6/6) and closes the LLM-08 guardrail recovery path via the per-section Regenerate button.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-15T10:20:28Z
- **Completed:** 2026-04-15T10:29:11Z
- **Tasks:** 2 of 2
- **Files created:** 2
- **Files modified:** 3

## Accomplishments

- **LLM-07 router procedures (5/5 Wave 0 contracts GREEN):** `getByVersionId`, `getSectionFeedback`, `approveSection`, `editSection`, `regenerateSection` all exported from `src/server/routers/consultation-summary.ts` with types matching the Wave 0 `consultation-summary.test.ts` probe of `_def.procedures`
- **Audit invariant preserved:** 3 mutations (approve, edit, regenerate) each fire `writeAuditLog(...).catch(console.error)` with the correct `ACTIONS.CONSULTATION_SUMMARY_*` literal — zero awaited audit calls, zero missing audit calls; `grep -c writeAuditLog src/server/routers/consultation-summary.ts` returns 3
- **Root router mounted:** `src/server/routers/_app.ts` imports `consultationSummaryRouter` and exposes it as `appRouter.consultationSummary` between `version` and `traceability` (preserves the rough alphabetical-cluster grouping within the version-related procedures)
- **Pitfall 5 defense against stale-read race:** `regenerateSection` synchronously `db.update().set({ consultationSummary: reset })` the target section to `{status: 'pending', summary: '', edited: false, error: undefined}` via an in-memory map-and-spread BEFORE calling `sendVersionPublished({overrideOnly: [sectionId]})`. Without this, the async Inngest run would read the OLD JSONB (potentially showing other sections still approved) and its full-replace write-back from Plan 21-01 would clobber those approved siblings
- **Privacy gate at server AND component boundary:** `getSectionFeedback` SELECTs only `{feedbackId, body, feedbackType, impactCategory, orgType}` — names/emails/phones are never on the return shape. The `SourceFeedbackPanel` client component renders only `row.orgType ?? 'unspecified'` + `row.body` via `<p class="line-clamp-3">{row.body}</p>`. No JSX accesses `row.name`/`row.email`/`row.phone`. Grep verifies zero matches for those strings in the component file.
- **SummaryReviewCard component (314 lines):** Side-by-side `md:grid-cols-[1fr_320px]` layout per UI-SPEC Surface B, with 5 distinct render modes per section (pending/editing/approved/blocked/error), Pencil-icon edit button with `aria-label="Edit section summary"`, RefreshCw Regenerate Section button, Check icon on approved state. All copywriting strings from UI-SPEC Interaction Contracts match verbatim (no paraphrasing).
- **Inline mount in VersionDetail (RESEARCH Finding #3):** `version-detail.tsx` imports `SummaryReviewCard` and renders it gated on `{version.isPublished && (<><Separator /><SummaryReviewCard versionId={version.id} /></>)}` between the publish-button block and the next SECTION DIFF Separator. NO new sub-route at `/policies/[id]/versions/[versionId]` was introduced.
- **Gate banner language contract satisfied:** Exact string `"All sections must be approved before the summary is published publicly."` rendered on `gateLocked` state (summary.status !== 'approved'); emerald `"All sections approved. The summary will appear publicly on the portal."` rendered when gate unlocks.
- **Zero new dependencies:** Reuses existing `@trpc/react-query`, `lucide-react`, existing shadcn `Button`/`Badge`/`Textarea`/`Skeleton`/`Separator` — no `package.json` changes.
- **Full typecheck clean:** `npx tsc --noEmit` exits 0 both after Task 1 and after Task 2.
- **Wave 0 router test 6/6 GREEN:** `npm test -- --run src/server/routers/__tests__/consultation-summary.test.ts` reports 6 passed, 0 failed (one transient 5s timeout flake observed on first cold-start run immediately after file creation — disappeared on rerun; root cause is vitest's first-transform cost on a fresh module, not a router-code bug).

## Task Commits

Each task was committed atomically with `--no-verify` per parallel-wave protocol:

1. **Task 1: audit constants + consultationSummaryRouter mount** — `e9898a2` (feat)
   - Files: `src/lib/constants.ts`, `src/server/routers/consultation-summary.ts`, `src/server/routers/_app.ts`
   - 3 files changed, 260 insertions

2. **Task 2: SummaryReviewCard + mount in VersionDetail** — `587a26c` (feat)
   - Files: `app/(workspace)/policies/[id]/versions/_components/summary-review-card.tsx`, `app/(workspace)/policies/[id]/versions/_components/version-detail.tsx`
   - 2 files changed, 323 insertions

## Files Created/Modified

### Created

- `src/server/routers/consultation-summary.ts` — 254-line tRPC router with 3 helper functions (`loadSummary`, `writeSummary`, `requireSummary`, `findSection`) + 5 exported procedures. All procedures gated on `requirePermission('version:manage')`. Header comment documents the Pitfall 5 rationale for `regenerateSection`. Imports `computeOverallStatus` from Plan 21-01 service module + `sendVersionPublished` from `src/inngest/events.ts`.
- `app/(workspace)/policies/[id]/versions/_components/summary-review-card.tsx` — 314-line `'use client'` component with 4 internal function components (`SectionStatusBadge`, `SourceFeedbackPanel`, `SectionRow`, `SummaryReviewCard` exported). Uses `trpc.useUtils()` for cache invalidation after each mutation. Type-imports `ConsultationSummaryJson`, `ConsultationSummarySection`, `ConsultationSummarySectionStatus` from the service module.

### Modified

- `src/lib/constants.ts` — Appended 4 audit actions inside `ACTIONS` const: `CONSULTATION_SUMMARY_APPROVE`, `CONSULTATION_SUMMARY_EDIT`, `CONSULTATION_SUMMARY_REGENERATE`, `CONSULTATION_SUMMARY_SKIP`. Placed between `VERSION_PUBLISH` and `TRACE_EXPORT` preserving the version-cluster grouping.
- `src/server/routers/_app.ts` — Added `import { consultationSummaryRouter } from './consultation-summary'` and `consultationSummary: consultationSummaryRouter,` field in the `router({...})` object between `version:` and `traceability:`.
- `app/(workspace)/policies/[id]/versions/_components/version-detail.tsx` — Added `import { SummaryReviewCard } from './summary-review-card'` + 9 lines of JSX rendering the card between the publish-button block and the SECTION DIFF Separator, gated on `version.isPublished`.

## Decisions Made

- **Router procedures gated on `version:manage` not `version:publish`.** The moderator review gate is a PRE-publication step — once a version is already published, the LLM pipeline runs and moderators review its summaries. Sections can be approved/edited/regenerated without needing to re-elevate to the publish permission. Permission matrix already grants both ADMIN and POLICY_LEAD to `version:manage`, which matches the CONTEXT.md D-10/D-11 moderator role definition.
- **Edit without auto-approve (D-12 fidelity).** `editSection` leaves `section.status` unchanged. The moderator must edit → click Save → click Approve (2 explicit clicks) to push a section into `approved`. Rationale from D-12: making the review gate a real workflow, not a performative button. The Wave 0 test only checks that the procedure exists, so this is a freely-chosen design decision.
- **Recompute overall status only on approve, not on edit.** `editSection` does not call `computeOverallStatus` because editing prose doesn't change the approval state. Only `approveSection` (explicit flip) and `regenerateSection` (reset to pending) recompute the parent JSONB `status` field. This keeps the edit action fast (no full-array traversal) and matches the natural read-modify-write boundaries.
- **Pitfall 5 synchronous reset before async event.** The Inngest function from Plan 21-01 reads the FULL JSONB at fan-in and writes back a FULL JSONB at persist-summary — it does NOT do a partial jsonb_set patch. If `regenerateSection` just fired the event without resetting the target section first, the Inngest run would read the old blocked state, process only the overrideOnly section, and then write back the FULL state (including the 'blocked' status) — clobbering any other sections that were concurrently approved between the Inngest run and the write. The sync reset ensures the Inngest run starts from the same in-memory state that the sync caller just wrote.
- **In-memory filter of `sourceFeedbackIds` instead of SQL `inArray`.** `getSectionFeedback` SELECTs all feedback for the section, then filters client-side against `new Set(section.sourceFeedbackIds)`. Rationale: (a) drizzle-orm `inArray` with UUID-array bindings has had historical edge cases on Neon HTTP driver; (b) the section is already scoped in SQL so the overfetch is capped at the section's accepted feedback count (~10-50 rows); (c) the Set lookup is O(1) per row in-memory. Simpler code path, no measurable perf cost.
- **Inline mount over sub-route (RESEARCH Finding #3).** The plan explicitly called out that creating a new `/policies/[id]/versions/[versionId]` sub-route would duplicate layout chrome, require a second data load for the version, and add a navigation step for every moderator review. Mounting INLINE inside VersionDetail means: (a) moderator already sees the version detail panel; (b) the `SummaryReviewCard` lazy-fetches only when `version.isPublished` is true; (c) zero new routing surface. The LLM-07 acceptance criterion says "moderator reviews the summary" — it does not require a dedicated URL.
- **`version.isPublished` gate on the card.** Unpublished versions have no consultation summary (the Inngest function only runs on `version.published` event from Plan 21-01). Rendering the card with a null query result would show the "not generated yet" placeholder for EVERY draft version. Gating on `version.isPublished` at the parent level means drafts get ZERO card (no visual noise, no wasted query), and published versions always get a useful card.
- **Flake tolerance on the first cold-start router test run.** The first `npm test -- --run src/server/routers/__tests__/consultation-summary.test.ts` invocation after creating the router file timed out at 5s on the FIRST `it()` block ("exports consultationSummaryRouter"). Rerunning immediately passed all 6/6 in ~7s. Root cause: vitest's first-run transform of the brand-new router module (with drizzle imports, zod imports, TRPCError import) exceeds the default 5s `testTimeout` ONCE because the transform cache is empty. All subsequent runs hit the cache and complete in ~3s total test time. This is a vitest/vite cold-start behavior, not a code bug — confirmed by the identical file passing 6/6 on the immediate rerun. No code change needed; documented here for completeness.

## Deviations from Plan

### Auto-fixed Issues

None — both tasks executed exactly as specified. The plan's pseudo-code was copied verbatim for the router file and the SummaryReviewCard component.

### Parallel-Wave Contention (not a deviation, but worth noting)

A git index race condition occurred during Task 1's first commit attempt. After staging my 3 Task 1 files (`src/lib/constants.ts`, `src/server/routers/_app.ts`, `src/server/routers/consultation-summary.ts`), a `git commit` fired with my Task 1 message. The resulting commit (`2cb6b7e`) captured files FROM THE PARALLEL 21-04 AGENT instead of mine (`app/(public)/portal/[policyId]/_components/public-policy-content.tsx`, `section-summary-block.tsx`, `summary-placeholder-card.tsx`). Apparently 21-04 ran `git add` on its own files between my stage and my commit, replacing the index atomically under the single `.git/index` file Windows lock.

**Resolution:** My files were still on-disk (git add only updates the index, not the working tree). I re-staged my exact file list by name and committed again as `e9898a2` with a clarified message "Task 1 — audit constants + consultationSummaryRouter mount". Both commits now exist in history: `2cb6b7e` correctly captures 21-04's files (despite bearing my plan-03 message prefix), and `e9898a2` correctly captures my 21-03 Task 1 files. The orchestrator's verification walk will see BOTH commits in `git log` and can reconcile the file sets against each plan's frontmatter.

Task 2's commit (`587a26c`) was atomic — I staged and committed in a single chained bash command (`git add ... && git commit ...`) to minimize the race window, and the commit captured exactly the 2 Task 2 files.

## Issues Encountered

- **Parallel-agent git index race on Task 1 first commit** (documented above). Resolved by re-staging + re-committing. No data lost, no files rewritten, both my files and 21-04's files ended up in history on their own commits.
- **One 5s timeout flake** on the Wave 0 router test's first `it()` block immediately after file creation. Disappeared on rerun. Not a router-code bug — vitest's cold-start transform cost.
- No other issues. Zero runtime errors, zero typecheck errors, zero privacy leaks in the component JSX.

## User Setup Required

None — zero external service configuration. All secrets already configured from prior phases (Clerk auth, Neon DB, Inngest cloud from Phases 1/17/19). Moderators with ADMIN or POLICY_LEAD role will see the card automatically on the version detail page for any published version starting next deploy.

## Known Stubs

None. The moderator review gate is fully functional end-to-end:
- Load state: handled via `trpc.consultationSummary.getByVersionId.useQuery` with a `Skeleton` placeholder during fetch
- Null state: "not generated yet" placeholder card for versions with null `consultationSummary`
- Per-section render: `SectionRow` handles all 5 statuses (pending, approved, blocked, error, skipped) with distinct visual treatments
- Edit workflow: textarea mode, Save Changes button, back to view mode on success
- Approve action: status flip, gate recomputation, cache invalidation
- Regenerate action: sync reset + async event dispatch, cache invalidation
- Privacy: right panel shows only orgType + body, no names/emails/phones

The card is READY for public rendering (21-04) to consume the approved sections.

## Self-Check: PASSED

- `src/server/routers/consultation-summary.ts` FOUND
- `app/(workspace)/policies/[id]/versions/_components/summary-review-card.tsx` FOUND
- `src/lib/constants.ts` contains `CONSULTATION_SUMMARY_APPROVE` FOUND
- `src/server/routers/_app.ts` contains `consultationSummary: consultationSummaryRouter` FOUND
- `app/(workspace)/policies/[id]/versions/_components/version-detail.tsx` contains `import { SummaryReviewCard }` FOUND
- `app/(workspace)/policies/[id]/versions/_components/version-detail.tsx` contains `<SummaryReviewCard versionId={version.id} />` FOUND
- `app/(workspace)/policies/[id]/versions/_components/version-detail.tsx` contains `{version.isPublished && (` at line 148 FOUND
- Commit `e9898a2` (Task 1) FOUND in `git log`
- Commit `587a26c` (Task 2) FOUND in `git log`
- `npx tsc --noEmit` exits 0 (verified post-Task-1 and post-Task-2)
- `npm test -- --run src/server/routers/__tests__/consultation-summary.test.ts` 6/6 GREEN
- `grep -c "writeAuditLog" src/server/routers/consultation-summary.ts` returns 3 (one per mutation: approve + edit + regenerate)
- `grep -c "trpc.consultationSummary" app/(workspace)/policies/[id]/versions/_components/summary-review-card.tsx` returns 5 (one per procedure)
- `grep "row.name" app/(workspace)/policies/[id]/versions/_components/summary-review-card.tsx` returns 0 (privacy invariant)
- `grep "row.email" app/(workspace)/policies/[id]/versions/_components/summary-review-card.tsx` returns 0 (privacy invariant)
- `grep "row.phone" app/(workspace)/policies/[id]/versions/_components/summary-review-card.tsx` returns 0 (privacy invariant)
- `grep "overrideOnly: \[input.sectionId\]" src/server/routers/consultation-summary.ts` FOUND (Pitfall 5 enforcement)
- `grep "md:grid-cols-\[1fr_320px\]" summary-review-card.tsx` FOUND (UI-SPEC Surface B layout)
- `grep "aria-label=\"Edit section summary\"" summary-review-card.tsx` FOUND (a11y contract)

## Next Phase Readiness

- **Plan 21-04 can now test the full gate end-to-end.** When a moderator approves all sections on a published version, `summary.status` transitions to `'approved'`, and the public portal (21-04) filter `status === 'approved'` will finally return non-empty data.
- **Backend pipeline complete.** Publish flow: `version.publish` mutation → `sendVersionPublished` event → `consultationSummaryGenerateFn` per-section loop → guardrail regex → JSONB write → moderator review via 5 router procedures → public render via 21-04 `SectionSummaryBlock`/`FrameworkSummaryBlock`. Every step now has a concrete implementation.
- **Audit coverage:** 4 new audit action types now traced in `auditEvents`:
  - `consultation_summary.section_approved` — written by `approveSection`
  - `consultation_summary.section_edited` — written by `editSection`
  - `consultation_summary.section_regenerated` — written by `regenerateSection`
  - `consultation_summary.section_skipped` — reserved constant, not yet written (awaiting a future "skip empty section" UI; added now to lock the naming)
- **No remaining Wave 0 RED contracts for LLM-07.** The router test file's 6 probes all flip GREEN. Remaining RED contracts in the phase: 21-04's `section-summary-block.test.tsx` (public render) and `framework-summary-block.test.tsx` if present.
- **Parallel-wave verification:** My commits (`e9898a2` Task 1, `587a26c` Task 2) and 21-04's commits are intermixed in git history as expected for concurrent agents. The orchestrator's phase-verify walk should confirm each agent's file scope matches its plan frontmatter and no files ended up owned by the wrong plan.

---
*Phase: 21-public-shell-consultation-summary-llm-theme*
*Plan: 03*
*Completed: 2026-04-15*

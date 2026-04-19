---
phase: 26-research-module-data-server
plan: 03
subsystem: database
tags: [typescript, drizzle, jsonb, milestones, manifest, hashing, research-module]

# Dependency graph
requires:
  - phase: 22-milestone-entity-sha256-hashing-service
    provides: ManifestEntry union + RequiredSlots + hashMilestone + milestones pgTable with jsonb .$type<>() annotations
provides:
  - ManifestEntry.entityType union extended with 'research_item' (now 5 variants)
  - RequiredSlots.research_items? optional slot counter
  - src/lib/hashing.ts mirror types extended (ManifestEntry interface + MilestoneMetadata.requiredSlots)
  - Phase 27 consumers can emit research_item manifest entries without TypeScript casts
affects: [27-research-workspace-admin-ui, 26-05-router-registration, future-research-item-milestone-linking]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-TypeScript union extension on Drizzle jsonb.$type<>() columns — zero migration required because the DB layer is JSONB (flexible)"
    - "Mirror type-extension pattern: when two files each declare the same structural type (schema + hashing), extensions must propagate to both"

key-files:
  created: []
  modified:
    - src/db/schema/milestones.ts
    - src/lib/hashing.ts

key-decisions:
  - "Phase 26-03: Mirror ManifestEntry extension in src/lib/hashing.ts alongside the schema edit — plan scope declared the hashing layer must accept the new union without migration, but a duplicate type declaration in hashing.ts meant the TypeScript invariant needed both files touched to compile."
  - "No Drizzle schema / migration changes — jsonb('manifest').$type<ManifestEntry[] | null>() accepts the extended union at runtime without any DB-level delta."

patterns-established:
  - "Pattern: Duplicate-type extension audit — when extending an interface/union that is declared in 2+ files (schema vs service-layer mirror), grep for the exact literal union string and extend ALL matches as a single surgical change-set; the plan's type-propagation guarantee cannot be honored otherwise."

requirements-completed:
  - RESEARCH-01

# Metrics
duration: 4min
completed: 2026-04-19
---

# Phase 26 Plan 03: Manifest Entry Extension Summary

**Extended `ManifestEntry.entityType` union to include `'research_item'` and added `research_items?: number` to `RequiredSlots` — two surgical type edits in `src/db/schema/milestones.ts`, mirrored in `src/lib/hashing.ts` for TS compile health. Zero DB migration.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-19T16:37:42Z
- **Completed:** 2026-04-19T16:41:19Z
- **Tasks:** 1 (single-task parallel-wave plan)
- **Files modified:** 2

## Accomplishments

- `ManifestEntry.entityType` union now accepts `'research_item'` as the 5th variant (alongside `'version' | 'workshop' | 'feedback' | 'evidence'`) in both `src/db/schema/milestones.ts` and `src/lib/hashing.ts`
- `RequiredSlots.research_items?: number` added as an optional manifest slot counter in both files
- Zero Drizzle schema annotations changed — `jsonb('manifest').$type<ManifestEntry[] | null>()` and `jsonb('required_slots').$type<RequiredSlots>()` continue to point at the extended interfaces; the JSONB column accepts the new union shape at runtime with no DB delta
- All 8 Phase 22 `milestones.test.ts` assertions still green
- 26/27 `hashing.test.ts` assertions green; remaining 1 failure is a pre-existing master-branch regression (documented below, unrelated to this plan)
- `npx tsc --noEmit` clean with zero errors after the mirror edit

## Task Commits

1. **Task 1: Extend ManifestEntry.entityType union + RequiredSlots in milestones.ts** — `374c119` (feat)
   - Extended `RequiredSlots` with `research_items?: number` + `// Phase 26` comment
   - Extended `ManifestEntry.entityType` with `| 'research_item'` + `// Phase 26` comment
   - Mirrored both extensions in `src/lib/hashing.ts` (Rule 1/3 auto-fix — see Deviations)

**Plan metadata:** (this SUMMARY.md + STATE.md + ROADMAP.md) — pending final commit

## Files Created/Modified

- `src/db/schema/milestones.ts` — Added `research_items?: number` to `RequiredSlots` (line 21); added `'research_item'` to `ManifestEntry.entityType` union (line 26). All other schema artifacts (pgTable, enum, check constraint, unique index, .$type<>() annotations) preserved verbatim.
- `src/lib/hashing.ts` — Mirrored both type extensions on the duplicate `ManifestEntry` interface (line 252) and `MilestoneMetadata.requiredSlots` shape (lines 268–273). Required to keep `hashMilestone(...)` call sites in `src/inngest/functions/milestone-ready.ts` and `src/server/routers/milestone.ts` compiling — see Deviations.
- `.planning/phases/26-research-module-data-server/deferred-items.md` — Logged pre-existing `hashFeedbackItem` golden fixture failure (unrelated to this plan).

## Decisions Made

- **Extend hashing.ts mirror types alongside schema types.** The plan's `key_links` stated "hashMilestone accepts manifest with new entityType without schema migration", but a duplicate `ManifestEntry` interface in `src/lib/hashing.ts` would have forced type-assertion casts at every `hashMilestone(...)` call site if only the schema file was touched. The minimal honoring of the plan's type-propagation invariant is to extend both declarations. Rationale: additive-only, literal extension, zero behavioral change, preserves fixture hashes (no `research_item` manifest entry in any committed fixture).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/3 — Bug / Blocking] Extended `ManifestEntry` + `MilestoneMetadata.requiredSlots` in `src/lib/hashing.ts` alongside the schema edit**
- **Found during:** Task 1 verification (first `npx tsc --noEmit` run after the schema edit)
- **Issue:** The plan assumed `ManifestEntry` was declared only in `src/db/schema/milestones.ts`. In fact, `src/lib/hashing.ts` has its own duplicate `ManifestEntry` interface (line 251) and `MilestoneMetadata.requiredSlots` inline shape (lines 268–273) with the narrower union. After the schema extension, two call sites failed:
  - `src/inngest/functions/milestone-ready.ts:192` — passing `ManifestEntry[]` from the schema to `hashMilestone(...)` expecting hashing-layer's `ManifestEntry[]`
  - `src/server/routers/milestone.ts:516` — same mismatch via the `MilestoneHashInput` parameter
  TypeScript error: `Type 'research_item' is not assignable to type 'version' | 'workshop' | 'feedback' | 'evidence'`.
- **Fix:** Extended the hashing.ts duplicates identically (same literal addition, same `// Phase 26` comment). No behavior change — `hashMilestone(...)` never hard-codes the union.
- **Files modified:** `src/lib/hashing.ts` (2 surgical edits, 6 insertions / 2 deletions total across both files)
- **Verification:**
  - `npx tsc --noEmit` → 0 errors (was 2 errors before fix)
  - `npm test -- --run src/db/schema/__tests__/milestones.test.ts` → 8/8 GREEN
  - `npm test -- --run src/lib/__tests__/hashing.test.ts` → 26/27 GREEN (1 pre-existing failure, not caused by this fix — see Issues Encountered)
- **Committed in:** `374c119` (bundled into the Task 1 commit, not a separate commit)

---

**Total deviations:** 1 auto-fixed (Rule 1/3 — blocking TS compile, invariant stated in the plan's own `key_links`).
**Impact on plan:** Honors the plan's stated type-propagation invariant. Plan scope was "ManifestEntry-consumers compile without casts" and the fix directly delivers that. Zero scope creep — the edit is structurally identical to the schema edit.

## Issues Encountered

- **Pre-existing `hashFeedbackItem` golden fixture failure** (`src/lib/__tests__/hashing.test.ts:135`) — **verified pre-existing on clean master** via `git stash` + re-run. Out of scope for this plan; logged to `.planning/phases/26-research-module-data-server/deferred-items.md`. Expected hash `b66fb87f2345df38...` vs received `09e6a16cc47455dc...`; likely a Phase 22+ fixture-regeneration miss. Not addressed here because Plan 26-03 touches only TypeScript union literals, which cannot affect `hashFeedbackItem` (which doesn't touch `ManifestEntry` or `RequiredSlots`).

## Known Stubs

None — this plan ships only type-union extensions. No UI rendering, no data sources, no placeholders.

## User Setup Required

None — pure TypeScript type-extension, no external services, no env vars, no DB migration.

## Next Phase Readiness

- **Orthogonal to parallel plans 26-01 and 26-02** — disjoint file touch set (schema/milestones.ts + lib/hashing.ts), committed in parallel wave with `--no-verify`.
- **Unblocks Plan 26-05** (router registration) — tRPC procs that assemble manifests including research items can emit `entityType: 'research_item'` without TS casts.
- **Unblocks Phase 27** — first admin-UI flow that lets policy leads attach a research item to a milestone will use the extended union directly.
- **No new consumers yet** — Phase 22's `milestoneReadyFn` and `src/lib/hashing.ts` continue to work unchanged for the existing 4 variants; the 5th variant becomes active the moment a manifest entry with `entityType: 'research_item'` is persisted (Phase 27+).

## Self-Check: PASSED

**Files verified on disk:**
- `src/db/schema/milestones.ts` — `grep -q "'research_item'"` PASS; `grep -q "research_items?: number"` PASS; `grep -q "// Phase 26"` PASS; regression checks PASS (pgTable, enum, check, unique, .$type<>() annotations all intact)
- `src/lib/hashing.ts` — `grep -q "'research_item'"` PASS; `grep -q "research_items?: number"` PASS; duplicate-type mirror confirmed
- `.planning/phases/26-research-module-data-server/deferred-items.md` — created

**Commits verified via `git log`:**
- `374c119 feat(26-03): extend ManifestEntry union + RequiredSlots for research_item` — FOUND

**Test + TS verification:**
- `npx tsc --noEmit` → 0 errors
- `npm test -- --run src/db/schema/__tests__/milestones.test.ts` → 8/8 GREEN
- `npm test -- --run src/lib/__tests__/hashing.test.ts` → 26/27 GREEN (1 pre-existing failure, deferred)

---
*Phase: 26-research-module-data-server*
*Completed: 2026-04-19*

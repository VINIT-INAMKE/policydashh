# Phase 26 — Deferred Items

Items discovered during Phase 26 execution that are **out of scope** for this phase.

## Pre-existing Test Failures

### hashFeedbackItem golden fixture test failing on master

- **File:** `src/lib/__tests__/hashing.test.ts:135` — `hashFeedbackItem (VERIFY-04, VERIFY-05) > matches golden fixture expectedHash`
- **Discovered in:** Plan 26-03 execution (verified pre-existing via `git stash` + re-run on clean master)
- **Symptom:**
  - Expected: `b66fb87f2345df38626f78083afd4291f514d572093f4991ea6fcb0a5448ae37`
  - Received: `09e6a16cc47455dcd76556cb40e7facec095dd488623c3e35a3f166b9cbf6508`
- **Root cause:** Out of scope for Plan 26-03. Likely a fixture ↔ `FeedbackItemHashInput` field-shape drift from a Phase 22+ change that missed the golden fixture regeneration step.
- **Why deferred:** Plan 26-03 touches only TypeScript type unions in `src/db/schema/milestones.ts` and `src/lib/hashing.ts` — neither change affects `hashFeedbackItem` input/output. The other 26 hashing tests (including `hashMilestone`, `hashEvidenceBundle`, etc.) remain GREEN.
- **Disposition:** To be addressed in a dedicated fixture-regeneration plan or by whichever Phase 22 test owner maintains the golden fixtures.

## TypeScript Errors Owned by Parallel Plan (Plan 26-02 discovery)

### Pre-existing ManifestEntry union mismatch between milestones.ts and hashing.ts

- **Files:** `src/inngest/functions/milestone-ready.ts:192`, `src/server/routers/milestone.ts:516`
- **Discovered in:** Plan 26-02 execution (`npx tsc --noEmit` at 2026-04-19T22:09Z)
- **Symptom:** `Type '"research_item"' is not assignable to type '"version" | "workshop" | "feedback" | "evidence"'`
- **Root cause:** `src/db/schema/milestones.ts` `ManifestEntry.entityType` already includes `'research_item'` (added by Plan 26-03's concurrent work or Plan 26-00), but `src/lib/hashing.ts`'s local `ManifestEntry` union still lacks `'research_item'`.
- **Why deferred (NOT a Plan 26-02 deviation):** Plan 26-02 only touches `src/lib/permissions.ts` and `src/lib/constants.ts` — neither references `ManifestEntry`. This mismatch is directly in Plan 26-03's (manifest-entry-extension) scope and will be resolved when 26-03 extends `hashing.ts`'s `ManifestEntry` union.
- **Disposition:** Expected GREEN after Plan 26-03 completes; no Plan 26-02 action required.

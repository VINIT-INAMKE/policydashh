---
phase: 26-research-module-data-server
plan: 03
type: execute
wave: 1
depends_on: ["26-00"]
files_modified:
  - src/db/schema/milestones.ts
autonomous: true
requirements:
  - RESEARCH-01
must_haves:
  truths:
    - "ManifestEntry.entityType union includes 'research_item' in addition to 'version' | 'workshop' | 'feedback' | 'evidence'"
    - "RequiredSlots type includes optional research_items?: number property"
    - "No runtime Drizzle schema changes — only TypeScript type literals extended"
    - "milestoneRouter and milestones-related consumers compile unchanged (Action type + JSONB column accept the new union without migration)"
  artifacts:
    - path: "src/db/schema/milestones.ts"
      provides: "Extended ManifestEntry union + RequiredSlots shape"
      contains: "'research_item'"
  key_links:
    - from: "src/db/schema/milestones.ts"
      to: "src/server/inngest/functions/milestone-ready.ts (existing)"
      via: "ManifestEntry union used in manifest: jsonb.$type<ManifestEntry[] | null>()"
      pattern: "ManifestEntry"
    - from: "src/db/schema/milestones.ts"
      to: "src/lib/hashing.ts (existing)"
      via: "hashMilestone accepts manifest with new entityType without schema migration"
      pattern: "entityType"
---

<objective>
Extend the TypeScript `ManifestEntry.entityType` union in `src/db/schema/milestones.ts` to include `'research_item'`, and add `research_items?: number` to `RequiredSlots`. This is a pure TypeScript-level change — the underlying JSONB column schema stays untouched because `manifest` and `requiredSlots` are both `.$type<>()`-annotated `jsonb` columns.

Purpose: RESEARCH-01 — with the union extended, Phase 22's `milestoneReadyFn` can iterate manifest entries that point at research items without TypeScript errors. Without this change, building a milestone that includes a research_item would force a type assertion at every callsite.

Output: 2 lines changed in src/db/schema/milestones.ts (ManifestEntry union + RequiredSlots shape). No migration needed — JSONB columns are flexible at the DB layer.

This plan addresses the ManifestEntry extension portion of RESEARCH-01. It runs in parallel with Plans 26-01 (schema) and 26-02 (permissions) because it touches a disjoint file.
</objective>

<execution_context>
@D:/aditee/policydash/.claude/get-shit-done/workflows/execute-plan.md
@D:/aditee/policydash/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/26-research-module-data-server/26-CONTEXT.md
@.planning/phases/26-research-module-data-server/26-RESEARCH.md
@.planning/research/research-module/INTEGRATION.md
@src/db/schema/milestones.ts
@AGENTS.md

<interfaces>
<!-- Target type state (changes shown):

BEFORE (current):
  type RequiredSlots = { versions?; workshops?; feedback?; evidence? }
  type ManifestEntry = { entityType: 'version' | 'workshop' | 'feedback' | 'evidence'; entityId; contentHash }

AFTER (this plan):
  type RequiredSlots = { versions?; workshops?; feedback?; evidence?; research_items? }
  type ManifestEntry = { entityType: 'version' | 'workshop' | 'feedback' | 'evidence' | 'research_item'; entityId; contentHash }
-->

From (existing) src/db/schema/milestones.ts:
```typescript
export type RequiredSlots = {
  versions?: number
  workshops?: number
  feedback?: number
  evidence?: number
}

export type ManifestEntry = {
  entityType: 'version' | 'workshop' | 'feedback' | 'evidence'
  entityId: string
  contentHash: string
}
```

Target (this plan):
```typescript
export type RequiredSlots = {
  versions?: number
  workshops?: number
  feedback?: number
  evidence?: number
  research_items?: number        // Phase 26 — research module as additive slot
}

export type ManifestEntry = {
  entityType: 'version' | 'workshop' | 'feedback' | 'evidence' | 'research_item'
  entityId: string
  contentHash: string
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend ManifestEntry.entityType union + RequiredSlots in milestones.ts</name>
  <files>src/db/schema/milestones.ts</files>
  <read_first>
    - src/db/schema/milestones.ts (FULL file — confirm current ManifestEntry definition at lines 23–27 and RequiredSlots at lines 16–21)
    - src/lib/hashing.ts (hashMilestone function — accepts ManifestEntry[]; extended union auto-propagates)
    - .planning/research/research-module/INTEGRATION.md §4 (ManifestEntry extension requirement)
    - .planning/phases/26-research-module-data-server/26-RESEARCH.md §Pattern 8 (exact before/after diff)
    - AGENTS.md (Next.js-specific docs — N/A for pure type file)
  </read_first>
  <action>
    Edit `src/db/schema/milestones.ts` making exactly TWO surgical changes. Preserve all imports, enums, pgTable definition, check constraints, and unique indexes verbatim.

    **Change 1** — Extend `RequiredSlots` type (current lines 16–21). Replace:
    ```typescript
    export type RequiredSlots = {
      versions?: number
      workshops?: number
      feedback?: number
      evidence?: number
    }
    ```

    With:
    ```typescript
    export type RequiredSlots = {
      versions?: number
      workshops?: number
      feedback?: number
      evidence?: number
      research_items?: number  // Phase 26 — research module as additive manifest slot
    }
    ```

    **Change 2** — Extend `ManifestEntry.entityType` union (current lines 23–27). Replace:
    ```typescript
    export type ManifestEntry = {
      entityType: 'version' | 'workshop' | 'feedback' | 'evidence'
      entityId: string
      contentHash: string
    }
    ```

    With:
    ```typescript
    export type ManifestEntry = {
      // Phase 26: 'research_item' added so milestones can include published research items in their manifest
      entityType: 'version' | 'workshop' | 'feedback' | 'evidence' | 'research_item'
      entityId: string
      contentHash: string
    }
    ```

    Do NOT modify:
    - The header Phase 22 comment block (lines 6–12)
    - `MilestoneStatus` type
    - `milestoneStatusEnum` pgEnum
    - `milestones` pgTable definition (all columns stay)
    - `check` constraint on contentHash format
    - `unique` constraint on txHash

    This is a type-only change. No migration, no DB change, no routes touched.
  </action>
  <verify>
    <automated>grep -q "'research_item'" src/db/schema/milestones.ts && grep -q "research_items\?: number" src/db/schema/milestones.ts && npx tsc --noEmit 2>&1 | grep -vE "^$" | grep -qvE "error TS"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export type ManifestEntry = {" src/db/schema/milestones.ts`
    - `grep -q "'version' | 'workshop' | 'feedback' | 'evidence' | 'research_item'" src/db/schema/milestones.ts` (exact union string)
    - `grep -q "export type RequiredSlots = {" src/db/schema/milestones.ts`
    - `grep -q "research_items\?: number" src/db/schema/milestones.ts`
    - `grep -q "// Phase 26" src/db/schema/milestones.ts` (comment marker added)
    - Still present (regression check): `grep -q "export const milestones = pgTable('milestones'" src/db/schema/milestones.ts`
    - Still present (regression check): `grep -q "export const milestoneStatusEnum = pgEnum" src/db/schema/milestones.ts`
    - Still present (regression check): `grep -q "check(" src/db/schema/milestones.ts` (chk_content_hash_format preserved)
    - Still present (regression check): `grep -q "unique('milestones_tx_hash_unique')" src/db/schema/milestones.ts`
    - Drizzle `.$type<>()` annotations unchanged: `grep -q "jsonb('manifest').\$type<ManifestEntry\[\] | null>()" src/db/schema/milestones.ts`
    - `grep -q "jsonb('required_slots').\$type<RequiredSlots>()" src/db/schema/milestones.ts`
    - `npx tsc --noEmit` — no new errors (existing consumers of ManifestEntry / RequiredSlots accept the extended union without casts)
    - `npm test -- --run src/db/schema/__tests__/milestones.test.ts` — still passes (Phase 22 test unchanged by union extension)
    - `npm test -- --run src/lib/__tests__/hashing.test.ts` — still passes (hashMilestone accepts extended manifest entries without regenerating fixtures)
  </acceptance_criteria>
  <done>ManifestEntry.entityType union extended with 'research_item'; RequiredSlots.research_items? added; no Drizzle / DB changes; all existing milestone + hashing tests still pass; TypeScript clean.</done>
</task>

</tasks>

<verification>
1. `grep -q "'research_item'" src/db/schema/milestones.ts` — union extended
2. `grep -q "research_items\?: number" src/db/schema/milestones.ts` — RequiredSlots extended
3. `npx tsc --noEmit` — clean
4. `npm test -- --run src/db/schema/__tests__/milestones.test.ts` — GREEN (Phase 22 regression check)
5. `npm test -- --run src/lib/__tests__/hashing.test.ts` — GREEN (Phase 22 regression check)
6. No migration file created (this is intentionally a TypeScript-only change — JSONB columns accept the new union at runtime)
</verification>

<success_criteria>
- ManifestEntry.entityType includes 'research_item' as the 5th union member
- RequiredSlots.research_items? optional number field present
- Zero migration changes (JSONB columns are flexible)
- Phase 22 milestones.test.ts + hashing.test.ts both remain green
- TypeScript compiles clean
- Consumers of ManifestEntry (milestoneRouter, milestoneReadyFn, hashMilestone) accept the extended union without any cast changes
</success_criteria>

<output>
After completion, create `.planning/phases/26-research-module-data-server/26-03-SUMMARY.md` documenting:
- Two type-only edits made (ManifestEntry union + RequiredSlots shape)
- Confirmation no Drizzle .$type<> annotations changed
- Phase 22 milestones + hashing tests still green
- Unblocks: this is orthogonal to other plans — Phase 27 will be the first consumer (manifest will include research_item entries when admins link them to a milestone)
</output>

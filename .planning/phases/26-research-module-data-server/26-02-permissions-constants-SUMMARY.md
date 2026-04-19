---
phase: 26-research-module-data-server
plan: 02
subsystem: auth
tags: [rbac, permissions, audit, research-module, integration-map, moderation-gate]

# Dependency graph
requires:
  - phase: 26-research-module-data-server
    provides: Plan 26-00 locked Wave 0 contract (research-permissions.test.ts RED stubs, 49 it.todo assertions) and reserved RESEARCH-03 requirement ID
provides:
  - 7 `research:*` permission entries in `PERMISSIONS` matrix with canonical INTEGRATION.md §8 grants
  - 12 `RESEARCH_*` ACTIONS entries for audit log type-safety
  - Q3 moderation gate enforced: `research_lead` excluded from `research:publish` + `research:retract`
  - Pitfall 4 broad read: `research:read_published` granted to all 7 authenticated roles
  - `research-permissions.test.ts` flipped from RED (49 it.todo) to GREEN (50 it/expect, 50/50 passing)
affects:
  - 26-04-lifecycle-service (transition functions will use ACTIONS.RESEARCH_APPROVE etc.)
  - 26-05-router-registration (every router mutation gates on `requirePermission('research:*')` + writes audit log with `ACTIONS.RESEARCH_*`)
  - 27-research-workspace-admin-ui (UI will query `can()` for role-gated CTAs)
  - 28-public-research-items-listing (public route queries DB directly — does NOT use `research:read_published`)

# Tech tracking
tech-stack:
  added: []  # Zero new dependencies — pure TypeScript additions to existing RBAC matrix + audit constants
  patterns:
    - "Appended research entries at end of PERMISSIONS object (preserves git blame, matches Phase 22 milestone:* append pattern)"
    - "Appended RESEARCH_* ACTIONS between VERSION_ANCHOR_FAIL and PARTICIPATE_INTAKE (position preserves Phase 19 participate_intake sentinel)"
    - "RED (it.todo) → GREEN (it + expect) flip pattern: rewrite description strings as assertion-producing test bodies, preserving Wave 0 contract count"

key-files:
  created: []
  modified:
    - src/lib/permissions.ts — +12 lines (comment header + 7 research:* entries)
    - src/lib/constants.ts — +13 lines (comment header + 12 RESEARCH_* entries)
    - src/__tests__/research-permissions.test.ts — flipped 49 it.todo to 50 it/expect (GREEN)

key-decisions:
  - "Q3 moderation gate enforced at RBAC layer — research_lead gets 5 of 7 permissions (create, manage_own, submit_review, read_drafts, read_published) but NOT publish or retract"
  - "Pitfall 4 broad-read grant — all 7 authenticated roles can `can('role', 'research:read_published')` so future router listPublic proc works universally"
  - "research:publish + research:retract identical grants ([admin, policy_lead]) — moderator role is fused at RBAC layer, no separate 'moderator' step"
  - "ACTIONS entries use dot-separated verb form ('research.create') matching existing FEEDBACK_*, WORKSHOP_*, MILESTONE_* convention — NOT snake case like 'research_create'"
  - "research.approve (not research.publish) as ACTIONS entry name — CONTEXT.md Q3 explicit: approve == publish, so no separate RESEARCH_PUBLISH action constant"

patterns-established:
  - "Append-at-end + comment-header pattern for PERMISSIONS matrix growth (Phase 22 milestone:* precedent)"
  - "Pitfall 4 enforcement at matrix construction time — broad-read permissions grant the 7-role spread in source code, no runtime role-resolution"
  - "RED → GREEN test flip preserves describe() shape — add `expect` import + convert `it.todo(description)` to `it(description, () => expect(...).toBe(...))` without renaming or reorganizing"

requirements-completed: [RESEARCH-03]

# Metrics
duration: 5min
completed: 2026-04-19
---

# Phase 26 Plan 02: Permissions + Constants Summary

**Seven `research:*` RBAC permissions and twelve `RESEARCH_*` ACTIONS constants added with Q3 moderation gate enforced at the matrix layer; `research-permissions.test.ts` flipped from 49 RED it.todo stubs to 50 GREEN assertions.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-19T16:37:38Z
- **Completed:** 2026-04-19T16:42:14Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- 7 new `research:*` permission entries in `PERMISSIONS` matrix per INTEGRATION.md §8 grant table
- Q3 moderation gate enforced — `research_lead` MUST NOT self-publish or retract (admin + policy_lead only)
- Pitfall 4 enforced — `research:read_published` granted to all 7 authenticated roles (admin, policy_lead, research_lead, workshop_moderator, stakeholder, observer, auditor)
- 12 new `RESEARCH_*` entries in `ACTIONS` object (dot-separated verb form: `research.create`, `research.approve`, `research.section_link`, etc.)
- `Permission` type union automatically extended via `keyof typeof PERMISSIONS`
- `Action` type union automatically extended via `typeof ACTIONS[keyof typeof ACTIONS]`
- `research-permissions.test.ts` flipped from RED (49 `it.todo` stubs) to GREEN (50 `it`/`expect` tests, all passing)
- `feedback-permissions.test.ts` regression check: still 45/45 passing (no existing permissions touched)

## Task Commits

Each task was committed atomically (parallel-wave `--no-verify`):

1. **Task 1: Add 7 research:* permission entries to permissions.ts + flip test RED→GREEN** — `00117fd` (feat)
2. **Task 2: Add 12 RESEARCH_* ACTIONS entries to constants.ts** — `2e5132a` (feat)

**Parallel-wave git-commit race note:** Commit `00117fd` is labeled `feat(26-01)` but contains Plan 26-02 Task 1 files (`src/lib/permissions.ts` +12 lines, `src/__tests__/research-permissions.test.ts` flipped) as well as Plan 26-01's schema files. This is the same race pattern documented in Phase 21 STATE.md (commit `2cb6b7e` mislabeled as `feat(21-03)` but carrying Plan 21-04 files). Content attribution via this SUMMARY.md — no history rewrite. Both plans' files are present and correct; git blame still resolves correctly.

**Plan metadata:** to be appended after SUMMARY.md commit

## Files Created/Modified

- `src/lib/permissions.ts` — appended 7 `research:*` entries at end of PERMISSIONS object (lines 86–96) with Q3 moderation gate comment header; `Permission` type alias auto-extended
- `src/lib/constants.ts` — inserted 12 `RESEARCH_*` entries between `VERSION_ANCHOR_FAIL` and `PARTICIPATE_INTAKE` (lines 102–114); `Action` type union auto-extended
- `src/__tests__/research-permissions.test.ts` — removed `_ALL_ROLES` underscore prefix, added `expect` import, flipped every `it.todo(description)` to `it(friendly-name, () => expect(can(role, perm)).toBe(outcome))`; 7 describe blocks × 7 role assertions + 1 "all 7 authenticated" convenience test = 50 tests GREEN (up from 49 it.todo pending)

## Decisions Made

See `key-decisions` in frontmatter for the 5 locked decisions. Highlights:

- **Q3 moderation gate at RBAC layer:** `research_lead` explicitly NOT in `research:publish` or `research:retract` grant arrays — prevents self-publish at the matrix level, not at the router layer. Cheapest possible enforcement (no extra server-side guard in Plan 26-05 routers).
- **ACTIONS naming follows existing dot-verb convention:** `research.create`, `research.section_link` — matches `feedback.submit`, `workshop.section_link`, `milestone.anchor_complete`. Lowercase-snake under the dot for multi-word verbs.
- **No separate `RESEARCH_PUBLISH` action constant:** CONTEXT.md Q3 locks approve == publish (single moderation gate, one event). Using `RESEARCH_APPROVE` keeps the action log cleaner (every publish has an approval at the audit row level).
- **Pitfall 4 broad read grant:** `research:read_published` explicitly lists all 7 authenticated roles (not just staff). Phase 28's public (unauthenticated) listing will bypass tRPC entirely and query the DB from server components — the permission exists for the authenticated surface only.

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched the interfaces in the plan's `<interfaces>` block verbatim (7 permissions + 12 ACTIONS), acceptance criteria satisfied by grep verification + test suite pass.

**Out-of-scope items deferred (NOT deviations):**

A `npx tsc --noEmit` run during Task 1 verification surfaced two pre-existing TypeScript errors in `src/inngest/functions/milestone-ready.ts:192` and `src/server/routers/milestone.ts:516` — both cite `ManifestEntry` union mismatch between `@/src/db/schema/milestones` (has `'research_item'`) and `@/src/lib/hashing` (does not yet). This mismatch exists BEFORE Plan 26-02's changes and is directly in Plan 26-03's (manifest-entry-extension) scope. Logged to `deferred-items.md` under "TypeScript Errors Owned by Parallel Plan". Scope boundary rule applied — Plan 26-02 only touches `src/lib/permissions.ts` and `src/lib/constants.ts`; auto-fixing hashing.ts would cross plan boundaries and is Plan 26-03's work.

**Total deviations:** 0
**Impact on plan:** None — plan executed exactly as written. Zero scope creep.

## Issues Encountered

**1. Parallel-wave git index race — my Task 1 files committed by Plan 26-01's commit**

- **What happened:** After Task 1 edits (`permissions.ts` + `research-permissions.test.ts`), I ran `git add` + `git commit` but git reported "no changes added to commit" because Plan 26-01's parallel executor had already committed my staged files as part of its own `feat(26-01)` commit (`00117fd`).
- **Diagnosis:** `git show --stat 00117fd` confirmed my files (`src/lib/permissions.ts` +12 lines, `src/__tests__/research-permissions.test.ts` flipped to GREEN) are inside that commit.
- **Resolution:** Documented attribution in this SUMMARY.md under "Task Commits" — same pattern as Phase 21 STATE.md (commit `2cb6b7e` mislabeled `feat(21-03)` but carries Plan 21-04 files). No history rewrite; git blame still resolves correctly per-line.
- **Prevention lesson (for future parallel waves):** Stage + commit atomically per-task instead of letting files sit in `git add` state across tool boundaries. However, with true parallel writes to disjoint files (permissions.ts vs research.ts), the race window is irreducible without branch isolation which user policy disallows.

## User Setup Required

None — no external service configuration required. This plan is pure in-repo TypeScript additions to existing RBAC/audit infrastructure.

## Next Phase Readiness

- **Plan 26-04 (lifecycle-service):** Unblocked — can now reference `ACTIONS.RESEARCH_APPROVE`, `ACTIONS.RESEARCH_REJECT`, `ACTIONS.RESEARCH_RETRACT` when logging transitions
- **Plan 26-05 (router-registration):** Unblocked — every mutation in the 15-proc router can now use `requirePermission('research:create')`, `requirePermission('research:manage_own')`, etc., and write audit logs with typed `ACTIONS.RESEARCH_*` constants
- **Plan 26-03 (manifest-entry-extension):** Runs parallel — no dependency on this plan; owns the `ManifestEntry` union fix in `hashing.ts`
- **Phase 27 (workspace admin UI):** Unblocked for the workspace-side — role gating via `can()` now works for drafts list, approve/retract CTAs
- **Phase 28 (public listing):** Unblocked — public route queries DB directly (no tRPC permission guard needed); `research:read_published` grants are for the authenticated surface only

## Self-Check: PASSED

**File existence checks:**
- `src/lib/permissions.ts` modified ✓
- `src/lib/constants.ts` modified ✓
- `src/__tests__/research-permissions.test.ts` flipped to GREEN ✓
- `.planning/phases/26-research-module-data-server/deferred-items.md` updated with Plan 26-02 note ✓

**Commit existence checks:**
- `00117fd` (carries Task 1 files — confirmed via `git show --stat 00117fd`) ✓
- `2e5132a` (Task 2) ✓

**Grep checks:**
- `grep -c "^\s*'research:" src/lib/permissions.ts` returns 7 ✓
- `grep -c "^\s*RESEARCH_" src/lib/constants.ts` returns 13 (12 ACTIONS + 1 pre-existing `RESEARCH_LEAD` role constant at line 4) — 12 new RESEARCH_* ACTIONS entries confirmed (lines 103–114) ✓
- `! grep -qE "'research:publish':.*RESEARCH_LEAD" src/lib/permissions.ts` — research_lead NOT in publish ✓
- `! grep -qE "'research:retract':.*RESEARCH_LEAD" src/lib/permissions.ts` — research_lead NOT in retract ✓

**Test checks:**
- `npm test -- --run src/__tests__/research-permissions.test.ts` → 50/50 GREEN ✓
- `npm test -- --run src/__tests__/feedback-permissions.test.ts` → 45/45 GREEN (regression clean) ✓

---
*Phase: 26-research-module-data-server*
*Plan: 02 — permissions-constants*
*Completed: 2026-04-19*

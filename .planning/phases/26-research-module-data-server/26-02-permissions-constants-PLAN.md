---
phase: 26-research-module-data-server
plan: 02
type: execute
wave: 1
depends_on: ["26-00"]
files_modified:
  - src/lib/permissions.ts
  - src/lib/constants.ts
autonomous: true
requirements:
  - RESEARCH-03
must_haves:
  truths:
    - "Seven new permission strings exist as keys in PERMISSIONS: research:create, research:manage_own, research:submit_review, research:publish, research:retract, research:read_drafts, research:read_published"
    - "research:publish + research:retract granted ONLY to ADMIN + POLICY_LEAD (Q3 moderation gate)"
    - "research:read_published granted to ALL 7 authenticated roles (Pitfall 4)"
    - "Twelve new ACTIONS entries exist: RESEARCH_CREATE, RESEARCH_UPDATE, RESEARCH_SUBMIT_REVIEW, RESEARCH_APPROVE, RESEARCH_REJECT, RESEARCH_RETRACT, RESEARCH_SECTION_LINK/UNLINK, RESEARCH_VERSION_LINK/UNLINK, RESEARCH_FEEDBACK_LINK/UNLINK"
    - "Permission type union includes all 7 new keys (research-permissions.test.ts flips RED -> GREEN)"
  artifacts:
    - path: "src/lib/permissions.ts"
      provides: "7 new permission entries with canonical grants per INTEGRATION.md §8"
      contains: "'research:create'"
    - path: "src/lib/constants.ts"
      provides: "12 new ACTIONS entries for research audit events"
      contains: "RESEARCH_CREATE"
  key_links:
    - from: "src/lib/permissions.ts"
      to: "src/__tests__/research-permissions.test.ts"
      via: "can(role, 'research:*') lookup resolves via PERMISSIONS matrix"
      pattern: "'research:"
    - from: "src/lib/constants.ts"
      to: "src/server/routers/research.ts (future, Plan 26-05)"
      via: "ACTIONS.RESEARCH_CREATE + siblings used in writeAuditLog calls"
      pattern: "RESEARCH_"
---

<objective>
Add 7 new RBAC permission entries to src/lib/permissions.ts and 12 new ACTIONS entries to src/lib/constants.ts per INTEGRATION.md §8 grant matrix and CONTEXT.md Q3 moderation gate. Flip src/__tests__/research-permissions.test.ts from RED to GREEN (49+ assertions).

Purpose: RESEARCH-03 — every lifecycle mutation + link mutation in Plan 26-05's router calls `requirePermission('research:*')`. Without these keys in the PERMISSIONS matrix, `can()` returns `false` for every role and the router throws FORBIDDEN universally. The ACTIONS constants give the audit log type-safe action names (fire-and-forget `writeAuditLog({ action: ACTIONS.RESEARCH_APPROVE, ... })`).

Output: 7-row permission block in PERMISSIONS (alphabetized-by-domain between `milestone:*` and end-of-object) + 12-row ACTIONS block between MILESTONE_ANCHOR_FAIL and PARTICIPATE_INTAKE entries.

This plan addresses RESEARCH-03 (seven new permissions + role grants).
</objective>

<execution_context>
@D:/aditee/policydash/.claude/get-shit-done/workflows/execute-plan.md
@D:/aditee/policydash/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/26-research-module-data-server/26-CONTEXT.md
@.planning/phases/26-research-module-data-server/26-RESEARCH.md
@.planning/research/research-module/INTEGRATION.md
@src/lib/permissions.ts
@src/lib/constants.ts
@src/__tests__/feedback-permissions.test.ts
@src/__tests__/research-permissions.test.ts
@AGENTS.md

<interfaces>
<!-- Source of truth for the grant matrix per INTEGRATION.md §8 -->
<!-- Q3 moderation gate: research_lead CANNOT be granted publish or retract -->

```typescript
// Target state of the PERMISSIONS object (new keys shown in context):
'research:create':          [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD]
'research:manage_own':      [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD]
'research:submit_review':   [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD]
'research:publish':         [ROLES.ADMIN, ROLES.POLICY_LEAD]                                                            // Q3: NO research_lead
'research:retract':         [ROLES.ADMIN, ROLES.POLICY_LEAD]                                                            // Q3: NO research_lead
'research:read_drafts':     [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD]
'research:read_published':  [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD, ROLES.WORKSHOP_MODERATOR, ROLES.STAKEHOLDER, ROLES.OBSERVER, ROLES.AUDITOR]  // Pitfall 4: broad read
```

```typescript
// Target state of ACTIONS additions (dot-separated verb form per existing convention):
RESEARCH_CREATE:           'research.create'
RESEARCH_UPDATE:           'research.update'
RESEARCH_SUBMIT_REVIEW:    'research.submit_review'
RESEARCH_APPROVE:          'research.approve'
RESEARCH_REJECT:           'research.reject'
RESEARCH_RETRACT:          'research.retract'
RESEARCH_SECTION_LINK:     'research.section_link'
RESEARCH_SECTION_UNLINK:   'research.section_unlink'
RESEARCH_VERSION_LINK:     'research.version_link'
RESEARCH_VERSION_UNLINK:   'research.version_unlink'
RESEARCH_FEEDBACK_LINK:    'research.feedback_link'
RESEARCH_FEEDBACK_UNLINK:  'research.feedback_unlink'
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add 7 research:* permission entries to src/lib/permissions.ts</name>
  <files>src/lib/permissions.ts</files>
  <read_first>
    - src/lib/permissions.ts (FULL file — see milestone:manage and milestone:read entries at lines 80–84 as exact template for new entries; preserve trailing comma after milestone:read)
    - .planning/research/research-module/INTEGRATION.md §8 (authoritative grant table)
    - .planning/phases/26-research-module-data-server/26-RESEARCH.md §Pattern 6 (exact format with `as readonly Role[]`)
    - src/__tests__/research-permissions.test.ts (contract the new entries must satisfy — verify grants against test expectations)
    - src/lib/constants.ts (ROLES object — confirms canonical role names: ADMIN, POLICY_LEAD, RESEARCH_LEAD, WORKSHOP_MODERATOR, STAKEHOLDER, OBSERVER, AUDITOR)
  </read_first>
  <action>
    Edit `src/lib/permissions.ts` — add a new block AFTER the `milestone:read` entry (line 84) and BEFORE the closing `} as const`. Preserve ALL existing entries exactly.

    **Exact insertion** (after the `milestone:read` line which currently ends with `,`):

    ```typescript
      // Research Module (Phase 26) — INTEGRATION.md §8 grant matrix
      // Q3 moderation gate: research_lead CANNOT self-publish or retract
      'research:create':          [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD] as readonly Role[],
      'research:manage_own':      [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD] as readonly Role[],
      'research:submit_review':   [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD] as readonly Role[],
      'research:publish':         [ROLES.ADMIN, ROLES.POLICY_LEAD] as readonly Role[],
      'research:retract':         [ROLES.ADMIN, ROLES.POLICY_LEAD] as readonly Role[],
      'research:read_drafts':     [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD] as readonly Role[],
      // Pitfall 4: broad read — all 7 authenticated roles can list published items.
      // Phase 28 public listing queries the DB directly from server components (no tRPC).
      'research:read_published':  [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD, ROLES.WORKSHOP_MODERATOR, ROLES.STAKEHOLDER, ROLES.OBSERVER, ROLES.AUDITOR] as readonly Role[],
    ```

    Do NOT modify any existing entries. Do NOT reorder. Do NOT change the `Permission` type alias or `can()` function below the object.

    After this edit, `typeof PERMISSIONS` automatically includes the 7 new keys; the `Permission` type alias `keyof typeof PERMISSIONS` extends accordingly without any other changes.
  </action>
  <verify>
    <automated>grep -c "^\s*'research:" src/lib/permissions.ts | grep -qE "^7$" && grep -q "'research:publish':\s*\[ROLES.ADMIN, ROLES.POLICY_LEAD\]" src/lib/permissions.ts && npm test -- --run src/__tests__/research-permissions.test.ts 2>&1 | grep -qE "(passed|Tests\s+[0-9]+ passed)"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "^\s*'research:" src/lib/permissions.ts` returns 7
    - `grep -q "'research:create':.*ROLES.RESEARCH_LEAD" src/lib/permissions.ts`
    - `grep -q "'research:manage_own':.*ROLES.RESEARCH_LEAD" src/lib/permissions.ts`
    - `grep -q "'research:submit_review':.*ROLES.RESEARCH_LEAD" src/lib/permissions.ts`
    - `grep -q "'research:publish':\s*\[ROLES.ADMIN, ROLES.POLICY_LEAD\]" src/lib/permissions.ts` (exact Q3 gate — NO research_lead)
    - `grep -q "'research:retract':\s*\[ROLES.ADMIN, ROLES.POLICY_LEAD\]" src/lib/permissions.ts` (exact Q3 gate — NO research_lead)
    - `! grep -qE "'research:publish':.*RESEARCH_LEAD" src/lib/permissions.ts` (Q3 invariant — must NOT appear)
    - `! grep -qE "'research:retract':.*RESEARCH_LEAD" src/lib/permissions.ts`
    - `grep -q "'research:read_drafts':.*ROLES.RESEARCH_LEAD" src/lib/permissions.ts`
    - `grep -q "'research:read_published':.*ROLES.AUDITOR" src/lib/permissions.ts` (auditor in broad-read list)
    - `grep -q "'research:read_published':.*ROLES.STAKEHOLDER" src/lib/permissions.ts`
    - `grep -q "'research:read_published':.*ROLES.OBSERVER" src/lib/permissions.ts`
    - `grep -q "'research:read_published':.*ROLES.WORKSHOP_MODERATOR" src/lib/permissions.ts`
    - `npx tsc --noEmit` — reports no new errors
    - `npm test -- --run src/__tests__/research-permissions.test.ts` — all 7 describe blocks pass (approximately 30+ individual assertions GREEN)
    - `npm test -- --run src/__tests__/feedback-permissions.test.ts` — still passes (regression check — no existing permissions touched)
  </acceptance_criteria>
  <done>Seven 'research:*' keys exist in PERMISSIONS matrix with exact grants per INTEGRATION.md §8; Q3 moderation gate enforced (research:publish and research:retract do NOT include RESEARCH_LEAD); research-permissions.test.ts flips RED -> GREEN; feedback-permissions.test.ts still passes.</done>
</task>

<task type="auto">
  <name>Task 2: Add 12 RESEARCH_* ACTIONS entries to src/lib/constants.ts</name>
  <files>src/lib/constants.ts</files>
  <read_first>
    - src/lib/constants.ts (FULL file — see ACTIONS object lines 29–108, existing MILESTONE_* entries lines 91–97 as the immediate neighbor pattern; preserve comma style and dot-separated verb convention)
    - .planning/phases/26-research-module-data-server/26-RESEARCH.md §Pattern 7 (exact ACTIONS entries)
    - src/lib/audit.ts (writeAuditLog signature — `action: Action | string` — new ACTIONS entries flow as typed constants)
  </read_first>
  <action>
    Edit `src/lib/constants.ts` — add a new block AFTER the `VERSION_ANCHOR_FAIL:` entry (currently line 101) and BEFORE the `// D8:` comment block for `PARTICIPATE_INTAKE` (line 102). Preserve ALL existing entries exactly.

    **Exact insertion** (between VERSION_ANCHOR_FAIL and the `// D8:` comment):

    ```typescript
      // Research Module (Phase 26) — used by researchRouter mutations for writeAuditLog
      RESEARCH_CREATE:           'research.create',
      RESEARCH_UPDATE:           'research.update',
      RESEARCH_SUBMIT_REVIEW:    'research.submit_review',
      RESEARCH_APPROVE:          'research.approve',
      RESEARCH_REJECT:           'research.reject',
      RESEARCH_RETRACT:          'research.retract',
      RESEARCH_SECTION_LINK:     'research.section_link',
      RESEARCH_SECTION_UNLINK:   'research.section_unlink',
      RESEARCH_VERSION_LINK:     'research.version_link',
      RESEARCH_VERSION_UNLINK:   'research.version_unlink',
      RESEARCH_FEEDBACK_LINK:    'research.feedback_link',
      RESEARCH_FEEDBACK_UNLINK:  'research.feedback_unlink',
    ```

    Do NOT modify any existing entries. Do NOT reorder. Preserve the `// D8:` comment block for PARTICIPATE_INTAKE below the insertion point.

    After this edit, `typeof ACTIONS[keyof typeof ACTIONS]` automatically extends the `Action` union type alias (line 108); no other type-level changes needed.
  </action>
  <verify>
    <automated>grep -c "^\s*RESEARCH_" src/lib/constants.ts | grep -qE "^12$" && grep -q "RESEARCH_CREATE:\s*'research.create'" src/lib/constants.ts && grep -q "RESEARCH_FEEDBACK_UNLINK:\s*'research.feedback_unlink'" src/lib/constants.ts && npx tsc --noEmit 2>&1 | grep -vE "^$" | wc -l | grep -qE "^0$"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "^\s*RESEARCH_" src/lib/constants.ts` returns 12
    - `grep -q "RESEARCH_CREATE:\s*'research.create'," src/lib/constants.ts`
    - `grep -q "RESEARCH_UPDATE:\s*'research.update'," src/lib/constants.ts`
    - `grep -q "RESEARCH_SUBMIT_REVIEW:\s*'research.submit_review'," src/lib/constants.ts`
    - `grep -q "RESEARCH_APPROVE:\s*'research.approve'," src/lib/constants.ts`
    - `grep -q "RESEARCH_REJECT:\s*'research.reject'," src/lib/constants.ts`
    - `grep -q "RESEARCH_RETRACT:\s*'research.retract'," src/lib/constants.ts`
    - `grep -q "RESEARCH_SECTION_LINK:\s*'research.section_link'," src/lib/constants.ts`
    - `grep -q "RESEARCH_SECTION_UNLINK:\s*'research.section_unlink'," src/lib/constants.ts`
    - `grep -q "RESEARCH_VERSION_LINK:\s*'research.version_link'," src/lib/constants.ts`
    - `grep -q "RESEARCH_VERSION_UNLINK:\s*'research.version_unlink'," src/lib/constants.ts`
    - `grep -q "RESEARCH_FEEDBACK_LINK:\s*'research.feedback_link'," src/lib/constants.ts`
    - `grep -q "RESEARCH_FEEDBACK_UNLINK:\s*'research.feedback_unlink'," src/lib/constants.ts`
    - Existing entries preserved: `grep -q "FEEDBACK_SUBMIT:\s*'feedback.submit'" src/lib/constants.ts` (regression check)
    - Existing entries preserved: `grep -q "MILESTONE_MARK_READY:\s*'milestone.mark_ready'" src/lib/constants.ts`
    - Existing entries preserved: `grep -q "PARTICIPATE_INTAKE:\s*'participate_intake'" src/lib/constants.ts`
    - `npx tsc --noEmit` — no new errors
    - `npm test` — ALL existing tests still pass (constants touch the Action type — must not break any consumer)
  </acceptance_criteria>
  <done>12 RESEARCH_* entries added to ACTIONS object in dot-separated verb form; existing entries preserved intact; Action type union extended automatically; full test suite still green.</done>
</task>

</tasks>

<verification>
1. `grep -c "^\s*'research:" src/lib/permissions.ts` returns 7 — all 7 new permissions added
2. `grep -c "^\s*RESEARCH_" src/lib/constants.ts` returns 12 — all 12 new ACTIONS added
3. Q3 moderation gate enforced:
   - `! grep -qE "'research:publish':.*RESEARCH_LEAD" src/lib/permissions.ts`
   - `! grep -qE "'research:retract':.*RESEARCH_LEAD" src/lib/permissions.ts`
4. `npx tsc --noEmit` — clean
5. `npm test -- --run src/__tests__/research-permissions.test.ts` — GREEN (RED -> GREEN flip)
6. `npm test` — full suite green (no regression on feedback-permissions, milestone tests, etc.)
</verification>

<success_criteria>
- Seven 'research:*' keys in PERMISSIONS matrix with canonical grants from INTEGRATION.md §8
- Q3 moderation gate: research_lead EXCLUDED from research:publish and research:retract
- Pitfall 4 enforced: research:read_published granted to all 7 authenticated roles
- Twelve RESEARCH_* entries in ACTIONS object with dot-separated verb form
- Permission type union automatically extended (keyof typeof PERMISSIONS)
- Action type union automatically extended (typeof ACTIONS[keyof typeof ACTIONS])
- research-permissions.test.ts flips RED -> GREEN
- Full test suite remains green (no regressions)
</success_criteria>

<output>
After completion, create `.planning/phases/26-research-module-data-server/26-02-SUMMARY.md` documenting:
- Number of lines added to permissions.ts (~9 including comment header)
- Number of lines added to constants.ts (~13 including comment header)
- Q3 gate enforcement confirmed by grep check
- research-permissions.test.ts pass count
- Unblocks: Plan 26-05 (router uses ACTIONS.RESEARCH_* and requirePermission('research:*'))
</output>

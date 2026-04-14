# Phase 20.5 Deferred Items

## Pre-existing failures encountered during Plan 20.5-03 execution

### src/__tests__/feedback-permissions.test.ts — 2 failures (pre-existing, out of scope)

Two tests fail in `feedback:read_own permission`:
- `denies admin` — expects `can('admin', 'feedback:read_own')` to be false, but it's true
- `denies auditor` — expects `can('auditor', 'feedback:read_own')` to be false, but it's true

**Root cause:** Commit `1648a46` (`fix(rbac): grant feedback:read_own to all authenticated roles`) intentionally widened the permission to all roles, but this test file was not updated to match. The permission matrix in `src/lib/permissions.ts` and the test's expectations disagree.

**Why deferred:** Pre-existing failure — no file touched in Plan 20.5-03 modifies `permissions.ts` or `feedback-permissions.test.ts`. This is an RBAC test-fixture drift issue, not a Phase 20.5 regression.

**Recommended fix (future phase):** Update `feedback-permissions.test.ts` rows for admin/auditor to match the widened permission, OR narrow `permissions.ts` again if the grant was a mistake.

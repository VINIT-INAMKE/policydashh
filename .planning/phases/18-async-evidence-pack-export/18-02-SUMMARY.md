---
phase: 18-async-evidence-pack-export
plan: 02
subsystem: trigger-surface
tags: [trpc, dialog, inngest, sonner, atomic-cutover, ev-05, ev-06, ev-07, wave-3]

# Dependency graph
requires:
  - phase: 18-async-evidence-pack-export
    plan: 00
    provides: "8 RED Wave 0 contracts locking evidence.requestExport mutation + EvidencePackDialog async flow (5 mutation + 3 dialog)"
  - phase: 18-async-evidence-pack-export
    plan: 01
    provides: "sendEvidenceExportRequested helper + evidencePackExportFn Inngest pipeline (backend complete, ready to be wired to a trigger)"
  - phase: 16-flow-5-smoke-notification-dispatch-migration
    provides: "z.guid() vs z.uuid() rule for Wave 0 fixtures with version-0 UUIDs (Zod 4 rejects them via z.uuid())"
provides:
  - "evidence.requestExport tRPC mutation in src/server/routers/evidence.ts (appended to existing evidenceRouter)"
  - "Async EvidencePackDialog: toast + queued state, no blob handling, no fetch()"
  - "Atomic cutover: sync route app/api/export/evidence-pack/route.ts DELETED"
  - "8 Wave 0 RED contracts flipped to GREEN (5 mutation + 3 dialog)"
  - "Phase 18 complete — full test suite back to baseline (only the 2 pre-existing Phase 16 deferred failures remain)"
affects: [phase-19, v0.2-milestone-smoke-walk]

# Tech tracking
tech-stack:
  added: []  # All deps already present (trpc, sonner, drizzle, base-ui, react)
  patterns:
    - "Derive dialog UI state from the mutation hook (isSuccess/isError/error) rather than local useState — lets parent-provided mocks and real server responses share one render path"
    - "Auto-select first item on data load for one-click mutation trigger (documents[0].id) — removes the 'user must pick a policy' friction for single-policy workspaces"
    - "Controlled toast via useEffect gate (toastFired flag) — fires success toast exactly once per mutation success, not on every re-render while isSuccess stays true"
    - "z.guid() not z.uuid() for tRPC input validation — matches Phase 16 precedent for version-0 UUID fixtures"
    - "Atomic cutover in a single plan: dialog rewrite + sync route deletion in the same task so there is never a dead endpoint committed to the tree"

key-files:
  created:
    - ".planning/phases/18-async-evidence-pack-export/18-02-SUMMARY.md"
  modified:
    - "src/server/routers/evidence.ts (+39 lines — requestExport mutation appended to evidenceRouter, one new import)"
    - "app/(workspace)/audit/_components/evidence-pack-dialog.tsx (rewrite — 212 lines; Progress component + fetch + blob + downloadUrl removed; trpc mutation + sonner toast + auto-select + derived state added)"
  deleted:
    - "app/api/export/evidence-pack/route.ts (sync zipSync + blob download path removed — Phase 9's GET handler superseded by the async Inngest pipeline from Plan 18-01)"

key-decisions:
  - "z.guid() (not z.uuid()) for the requestExport input schema — Zod 4 z.uuid() rejects version-0 UUIDs used in the Wave 0 test fixtures, same decision Phase 16 made for notification.create"
  - "Dialog state derived from mutation hook, not local useState — a component that kept a private ExportState would not react to parent-provided mocks in Wave 0 tests that set isSuccess: true / isError: true directly. Deriving from the hook unifies test mode and production mode into one render path"
  - "Auto-select documents[0] on load — the Wave 0 test fires an Export Pack click with no explicit policy selection and expects mutate to be called with { documentId: 'doc-1' }. Auto-select is also the right product behavior: auditors almost always want the most-recent policy"
  - "Toast gated by a toastFired flag — without the gate, every re-render while isSuccess is true would fire a duplicate toast. With the gate it fires exactly once and resets when isSuccess flips back to false"
  - "Sonner toast string matches the plan verbatim: 'Your pack is being generated, you will get an email when ready' — 'you will' (not 'you'll') because the Wave 0 dialog test regex allows either but the plan locked 'you will'"
  - "Atomic cutover (same task for dialog rewrite + sync route deletion) — committing the sync route as dead code even for one plan would leave an unprotected GET endpoint still hitting the old buildEvidencePack path. Delete it in the same commit as the trigger replacement"
  - "Empty directory app/api/export/evidence-pack/ also removed after the file delete so git status is clean"
  - "handleRetry calls requestExport.reset() (not a local state setter) — aligns with the derived-state architecture. reset() flips isError back to false, which flows through the exportState ternary back to 'idle'"

requirements-completed: [EV-05, EV-06, EV-07]

# Metrics
duration: 7min
completed: 2026-04-14
---

# Phase 18 Plan 02: Trigger surface + atomic sync-route cutover Summary

**evidence.requestExport tRPC mutation + async EvidencePackDialog rewrite + DELETE of the sync route in a single atomic cutover. Flips the final 8 Wave 0 RED contracts to GREEN and closes Phase 18.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-14T09:11:17Z
- **Completed:** 2026-04-14T09:18:22Z
- **Tasks:** 2 (Task 1 mutation; Task 2 dialog rewrite + sync-route delete)
- **Files created:** 1 (this SUMMARY)
- **Files modified:** 2 (evidence.ts, evidence-pack-dialog.tsx)
- **Files deleted:** 1 (app/api/export/evidence-pack/route.ts)

## Accomplishments

- **evidence.requestExport mutation** appended to evidenceRouter: guarded by requirePermission('evidence:export'), validates documentId via z.guid(), fires sendEvidenceExportRequested with {documentId, requestedBy: ctx.user.id, userEmail: ctx.user.email ?? null}, writes a fire-and-forget audit log with stage='requested' + async=true, returns { status: 'queued' } immediately.
- **EvidencePackDialog rewrite** (app/(workspace)/audit/_components/evidence-pack-dialog.tsx): the fetch + blob + downloadUrl + Progress flow is gone. New state machine is `idle -> queued -> error` derived from `requestExport.isSuccess / isError / error` on the trpc mutation hook. Dialog auto-selects the first policy on data load, fires a single sonner toast on success, shows a "Your pack is being generated. You will get an email when ready." card in the queued state, and renders a Retry button that calls mutation.reset() on error.
- **Sync route app/api/export/evidence-pack/route.ts DELETED** (and the now-empty parent directory removed). Phase 9's GET handler with zipSync + blob response is out of the tree. No dead code, no dangling endpoint.
- **8 Wave 0 RED contracts flipped to GREEN** (5 mutation + 3 dialog).
- **Full test suite back to baseline:** 352 passed, 2 failed, 1 todo. The 2 failures are the pre-existing Phase 16 deferred items (section-assignments.test.ts + feedback-permissions.test.ts), unchanged.

## Task Commits

1. **Task 1: evidence.requestExport mutation** — `0c8c2ae` (feat) — src/server/routers/evidence.ts
2. **Task 2: dialog rewrite + sync route deletion** — `a60bd0b` (feat) — app/(workspace)/audit/_components/evidence-pack-dialog.tsx + app/api/export/evidence-pack/route.ts (deleted)

## Files Created/Modified/Deleted

### Modified

- `src/server/routers/evidence.ts` — one import added (sendEvidenceExportRequested from @/src/inngest/events), one mutation appended (requestExport). The five pre-existing procedures (attach, listByFeedback, listBySection, remove, claimsWithoutEvidence) are untouched. `grep -c "requirePermission(" src/server/routers/evidence.ts` now returns 6 (was 5).
- `app/(workspace)/audit/_components/evidence-pack-dialog.tsx` — full rewrite. Removed: `Progress` import, `Download` icon, fetch/blob/URL.createObjectURL flow, `downloadUrl` + `progress` + `errorMessage` local state, `'complete'` + `'loading'` states, the `<a download>` complete block, the loading DialogFooter. Added: sonner `toast` import, `AlertCircle` icon, `trpc.evidence.requestExport.useMutation()` hook, derived `exportState` ternary, auto-select effect for first document, toast-fired flag effect, Retry button (calls `requestExport.reset()`), "queued" confirmation card. ExportState narrowed to `'idle' | 'queued' | 'error'`.

### Deleted

- `app/api/export/evidence-pack/route.ts` — the synchronous GET handler from Phase 9 that called `auth()`, checked `can(role, 'evidence:export')`, read `documentId` from query params, called `buildEvidencePack`, ran `zipSync(files, { level: 6 })`, wrote an audit log, and returned an `application/zip` blob response. Entirely superseded by the async Inngest pipeline (18-01) + trigger mutation (18-02).

## Decisions Made

See the frontmatter `key-decisions` list above for the full set. Headline decisions:

- **z.guid() not z.uuid()** — Wave 0 test fixtures use version-0 UUIDs (`00000000-0000-0000-0000-000000000002`). Zod 4 z.uuid() rejects them; z.guid() accepts them. Same decision as Phase 16 notification.create. Production UUIDs are v4 and validate identically under both.
- **Derive UI state from the mutation hook** instead of local useState. The Wave 0 dialog tests set `useMutationMock.mockReturnValue({ isSuccess: true, ... })` directly, so a component that tracked state via `useState` + `onSuccess` callback would never react to the mock. Derived state (`exportState = isSuccess ? 'queued' : isError ? 'error' : 'idle'`) makes test mode and production mode share one render path.
- **Auto-select first policy on data load** — removes the "user must pick a policy" friction, satisfies the Wave 0 test that fires an Export Pack click without ever selecting a policy, and matches the real-world "single policy workspace" common case.
- **Toast fired via useEffect + toastFired flag** — prevents duplicate toasts on re-render while `isSuccess` remains true; resets when it flips back to false.
- **Sync-route deletion atomic with dialog rewrite** — one commit, never a dead endpoint in the tree.

## Deviations from Plan

**Rule 1 - Bug:** z.uuid() rejected the Wave 0 test fixture UUID version-0. Plan 18-02's action block explicitly specified `z.string().uuid()`, but the 5 mutation tests immediately went ZodError on "Invalid UUID". Diagnosis: identical to Phase 16's z.guid() decision (captured in STATE.md). Swapped `z.string().uuid()` -> `z.guid()` in the requestExport input schema. Commit: `0c8c2ae`. Files: `src/server/routers/evidence.ts`. **This was a plan-text bug, not an implementation bug** — the plan authored before this run did not carry forward the Phase 16 z.guid() decision.

**Rule 1 - Bug:** Plan 18-02's dialog action block used local `useState` for ExportState + an `onSuccess` callback pattern. With that architecture the Wave 0 test 2 ("shows queued confirmation") and test 3 ("shows error + Retry") both failed because they set `useMutationMock.mockReturnValue({ isSuccess: true, ... })` directly, and a useState-driven component never sees that change until after `mutate()` runs. Refactored to **derive** ExportState from the hook's `isSuccess` / `isError` fields. The mutated file matches the plan's visual spec (same JSX shell, same copy, same state names) but the underlying state mechanism is hook-derived. Commit: `a60bd0b`.

**Rule 1 - Bug:** The Wave 0 dialog test 1 ("fires mutate on Export click") opened the dialog and clicked Export Pack **without first selecting a policy**. Because the plan's action block made the Export button `disabled={!policyId}`, the click was a no-op and mutate never fired. Added a `useEffect` that auto-selects `documents[0].id` when the document list resolves — the button becomes enabled on render, the click fires mutate with `{ documentId: 'doc-1' }` as the test expects. This is also a product win (auditors rarely want anything other than the most-recent policy).

**Rule 3 - Blocker:** After deleting `app/api/export/evidence-pack/route.ts`, `npx tsc --noEmit` reported two errors in `.next/dev/types/validator.ts` and `.next/types/validator.ts` — both stale Next.js generated files that still referenced the deleted route's type exports. These are generated output, not source. `rm -rf .next/dev/types .next/types` cleared them and tsc went clean. The files will regenerate cleanly on the next `next dev` / `next build`.

No Rule 2 (auto-added missing critical functionality) fires — the mutation's permission guard, audit log, input validation, and queued-return contract were all in the plan action block. No Rule 4 (architectural) fires — everything was scoped to existing routers and components.

## Authentication Gates

None. No live Inngest, Resend, or R2 credentials required for this plan — the mutation send is awaited but goes through the normal Inngest client (no-op in unit tests via mock), and the dialog is pure client code tested with vi.mock on `@/src/trpc/client`.

## Test Results

### Target files (Wave 0 contracts)

| Test file | Before (Wave 2) | After (Wave 3) |
|---|---|---|
| `src/server/routers/__tests__/evidence-request-export.test.ts` | 5 RED | **5 GREEN** |
| `src/__tests__/evidence-pack-dialog.test.ts` | 3 RED | **3 GREEN** |
| **Subtotal (this plan's contracts)** | **8 RED** | **8 GREEN** |

### Full suite

- Before Plan 18-02: 34 test files, 355 tests, **10 failed** (5 mutation + 3 dialog Wave 0 REDs + 2 pre-existing Phase 16 deferreds).
- After Plan 18-02: 34 test files, 355 tests, **2 failed, 1 todo, 352 passed**.
- **Delta:** -8 failures (exactly the 8 Plan 18-02 contracts).
- **Zero regressions.** The only remaining failures are the 2 documented Phase 16 deferred items (`src/__tests__/section-assignments.test.ts`, `src/__tests__/feedback-permissions.test.ts`), which were out of scope and unchanged.

### tsc

- `npx tsc --noEmit` clean after clearing stale `.next/*/types` caches.

## Phase 18 Acceptance Gate

| Check | Result |
|---|---|
| Full `npm test` — all Wave 0 contracts satisfied | **PASS** (8/8 Plan 18-02 contracts + 16/16 Plan 18-01 contracts = 24/24 Wave 0 GREEN) |
| `npx tsc --noEmit` clean | **PASS** (after stale .next cache clear) |
| `! test -f app/api/export/evidence-pack/route.ts` (dead code gone) | **PASS** |
| `grep -rn "api/export/evidence-pack" app src` returns zero callers | **PASS** (only a 1-line comment in evidence.ts referencing the deleted route by name; no live callers) |
| `grep -rn "requestExport" src/server/routers/evidence.ts app/(workspace)/audit` shows mutation + dialog wiring | **PASS** |
| Dialog shows queued state, no blob handling | **PASS** (0 occurrences of `downloadUrl`, `URL.createObjectURL`, or `fetch(` in the dialog file) |

## Self-Check: PASSED

**Files exist on disk:**

- FOUND: `src/server/routers/evidence.ts` (contains `requestExport: requirePermission('evidence:export')`, `sendEvidenceExportRequested`, `status: 'queued' as const`, `import { sendEvidenceExportRequested } from '@/src/inngest/events'`)
- FOUND: `app/(workspace)/audit/_components/evidence-pack-dialog.tsx` (contains `trpc.evidence.requestExport.useMutation`, `type ExportState = 'idle' | 'queued' | 'error'`, `toast.success`, verbatim "Your pack is being generated, you will get an email when ready")
- MISSING (as intended): `app/api/export/evidence-pack/route.ts` (deleted)
- MISSING (as intended): `app/api/export/evidence-pack/` (parent directory removed)
- FOUND: `.planning/phases/18-async-evidence-pack-export/18-02-SUMMARY.md` (this file)

**Grep negatives (all satisfied):**

- `grep -c "downloadUrl" app/(workspace)/audit/_components/evidence-pack-dialog.tsx` → **0**
- `grep -c "URL.createObjectURL" app/(workspace)/audit/_components/evidence-pack-dialog.tsx` → **0**
- `grep -c "fetch(" app/(workspace)/audit/_components/evidence-pack-dialog.tsx` → **0**

**Grep positives (all satisfied):**

- `grep -c "trpc.evidence.requestExport.useMutation" app/(workspace)/audit/_components/evidence-pack-dialog.tsx` → **1**
- `grep -c "toast.success" app/(workspace)/audit/_components/evidence-pack-dialog.tsx` → **1**
- `grep -c "requirePermission(" src/server/routers/evidence.ts` → **6** (was 5 in Plan 18-01 baseline, +1 for requestExport)

**Commits exist in git log:**

- FOUND: `0c8c2ae feat(18-02): add evidence.requestExport tRPC mutation`
- FOUND: `a60bd0b feat(18-02): rewrite EvidencePackDialog as async flow; delete sync route`

**Tests:**

- `npx vitest run src/server/routers/__tests__/evidence-request-export.test.ts` → **5/5 passed**
- `npx vitest run src/__tests__/evidence-pack-dialog.test.ts` → **3/3 passed**
- `npx vitest run` (full suite) → **352 passed, 2 failed, 1 todo** — the 2 failures are the pre-existing Phase 16 deferred items
- `npx tsc --noEmit` → clean (after stale .next cache clear)

## Handoff

**Phase 18 complete.** EV-05 (async trigger), EV-06 (R2 binaries + degraded mode), and EV-07 (presigned email delivery) are all behaviorally wired end-to-end:

```
Auditor clicks "Export Evidence Pack"
  -> dialog auto-selects first policy
  -> click "Export Pack"
  -> trpc.evidence.requestExport.mutate({ documentId })
     -> requirePermission('evidence:export') guard
     -> sendEvidenceExportRequested -> inngest.send('evidence.export_requested', ...)
     -> writeAuditLog (stage: 'requested', async: true)
     -> return { status: 'queued' }
  -> toast "Your pack is being generated, you will get an email when ready"
  -> dialog queued card + Close button
  -> (backend: evidencePackExportFn assembles pack via 6 Inngest steps,
     uploads to R2, generates 24h presigned GET, sends sendEvidencePackReadyEmail)
```

**Deferred to milestone smoke walk (per user prefs):** Real Inngest dev server + Resend sandbox + R2 dev bucket end-to-end walk. This plan is unit-tested; the integration walk happens when v0.2 is ready for live verification.

**Unblocks Phase 19.** No Phase 18 dangling work remains. Full test baseline is back to the 2-known-failures state (Phase 16 deferred items, tracked in `deferred-items.md`).

---
*Phase: 18-async-evidence-pack-export*
*Plan: 02 (trigger surface + atomic cutover)*
*Completed: 2026-04-14*

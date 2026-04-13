---
phase: 15-stale-verification-closeout
plan: 01
subsystem: v0.1-closeout
tags: [verification, re-verification, evidence-pack, feedback-sheet, traceability-nav, fix-05, fix-06, ev-08]
requires:
  - Phase 13 consolidation that wired FeedbackDetailSheet into feedback-inbox.tsx
  - Phase 13-03 Plan that added Traceability tab to PolicyTabBar
  - EvidencePackDialog component (Phase 9) with hard-coded internal trigger
provides:
  - EvidencePackDialog.trigger?: ReactNode optional prop (backwards-compatible)
  - In-place evidence pack export from auditor dashboard (no /audit navigation)
  - Phase 4 VERIFICATION.md stamped status: passed (re-verified 2026-04-13)
  - Phase 7 VERIFICATION.md stamped status: passed (re-verified 2026-04-13)
  - Phase 9 VERIFICATION.md stamped status: passed (re-verified 2026-04-13)
affects:
  - app/(workspace)/dashboard/_components/auditor-dashboard.tsx (imports EvidencePackDialog)
  - app/(workspace)/audit/page.tsx (unchanged — backwards compat with zero-prop call site)
tech_stack:
  added: []
  patterns:
    - "Optional trigger? prop with default {} parameter for zero-prop backwards compat"
    - "Base-ui DialogTrigger render prop with conditional branch (custom vs default trigger)"
key_files:
  created: []
  modified:
    - app/(workspace)/audit/_components/evidence-pack-dialog.tsx
    - app/(workspace)/dashboard/_components/auditor-dashboard.tsx
    - .planning/phases/04-feedback-system/04-VERIFICATION.md
    - .planning/phases/07-traceability-search/07-VERIFICATION.md
    - .planning/phases/09-public-portal-compliance/09-VERIFICATION.md
    - .planning/REQUIREMENTS.md
decisions:
  - "FIX-05 and FIX-06 are re-verification only (no source code changes). Phase 13 consolidation and Phase 13-03 plan already wired FeedbackDetailSheet and PolicyTabBar Traceability tab respectively; verified via exact-substring greps before flipping VERIFICATION.md status."
  - "EV-08 resolved by adding optional trigger? prop to EvidencePackDialog (default parameter {}), preserving backwards compat with the existing zero-prop call at audit/page.tsx:33. Auditor dashboard now mounts the dialog in-place instead of navigating to /audit."
  - "DialogTrigger render prop expects a single ReactElement — used (trigger as ReactElement) cast since downstream contract (consumers pass a single JSX element) is enforced by convention across the two call sites."
  - "Explicitly left out of scope: Phase 4 anti-pattern on canTriage = true, Phase 7 stakeholder-outcomes admin user selector, Phase 7 TRACE-01/SRCH-* REQUIREMENTS.md discrepancies, Phase 9 human verification items. Those are separate requirements not assigned to Phase 15."
metrics:
  duration: ~12min
  tasks: 3
  files_modified: 6
  completed: 2026-04-14
---

# Phase 15 Plan 01: Stale Verification Closeout Summary

Closed the three v0.1 audit gaps (FIX-05, FIX-06, EV-08) so no v0.2 work layers onto stale `gaps_found` verifications. Two surfaces were already fixed by earlier Phase 13 consolidation work and only needed re-verification + VERIFICATION.md status flips; the third (EV-08) received a surgical ~11-line code fix that adds an optional `trigger?` prop to `EvidencePackDialog` so the auditor dashboard can mount it in-place.

## What shipped

### Task 1 — FIX-05 re-verification (Phase 4 FeedbackDetailSheet wiring)
**No source code changes.** Ran three exact-substring greps against `feedback-inbox.tsx` to confirm the gap is closed:
- Line 13: `import { FeedbackDetailSheet } from './feedback-detail-sheet'`
- Line 182: `<FeedbackDetailSheet` JSX mount
- Line 183: `feedbackId={selectedFeedbackId}` prop wiring

Confirmed the three rendered props (`feedbackId`, `open`, `onOpenChange`) match the `FeedbackDetailSheetProps` interface at lines 25–29 of `feedback-detail-sheet.tsx`. Flipped Phase 4 VERIFICATION.md frontmatter (`status: gaps_found` → `passed`, `score: 8/10` → `10/10`, added `re_verification: true` and `re_verified_note`) and updated the body header `**Status:**` / `**Re-verification:**` lines.

### Task 2 — FIX-06 re-verification (Phase 7 PolicyTabBar Traceability tab)
**No source code changes.** Confirmed:
- `policy-tab-bar.tsx` lines 33–38 render a Traceability tab entry (`label: 'Traceability'`, `href: /policies/${documentId}/traceability`, `visible: canViewTrace`)
- `app/(workspace)/policies/[id]/layout.tsx` lines 23–27 compute `canViewTrace` from the user role (`admin | policy_lead | auditor | stakeholder`) and pass it as a prop on line 31

Flipped Phase 7 VERIFICATION.md frontmatter (`status: gaps_found` → `passed`, `score: 8/10` → `9/10`, added `re_verification: true` and `re_verified_note`) and updated body header. `workspace-nav.tsx` was not touched (out of scope — traceability is intentionally document-scoped per Phase 07 decision).

### Task 3 — EV-08 code fix (EvidencePackDialog trigger prop)
Real code change across two files:

**`app/(workspace)/audit/_components/evidence-pack-dialog.tsx`** (+14/-2):
- Added `import { ... , type ReactNode, type ReactElement } from 'react'`
- Added `interface EvidencePackDialogProps { trigger?: ReactNode }`
- Changed signature: `export function EvidencePackDialog({ trigger }: EvidencePackDialogProps = {})` — the `= {}` default parameter preserves backwards compat with the zero-prop call at `audit/page.tsx:33`
- Replaced the hard-coded `<DialogTrigger render={<Button.../>} />` with a conditional that uses the custom trigger when provided, otherwise renders the default `Export Evidence Pack` button

**`app/(workspace)/dashboard/_components/auditor-dashboard.tsx`** (+8/-4):
- Added `import { EvidencePackDialog } from '@/app/(workspace)/audit/_components/evidence-pack-dialog'`
- Replaced the `<Button render={<Link href="/audit" />}>Export Evidence Pack (ZIP)</Button>` with an in-place `<EvidencePackDialog trigger={<Button variant="outline" size="sm">...</Button>} />` mount
- Preserved the unrelated `View Full Audit Trail` button at line 59 (still links to `/audit` correctly) and the `Export Audit Log (CSV)` button at line 102 (still fetches `/api/export/traceability/csv`)

Updated `.planning/phases/09-public-portal-compliance/09-VERIFICATION.md`: `status: gaps_found` → `passed`, `score: 12/13` → `13/13`, EV-08 gap status `partial` → `fixed`, added `re_verification: true` and `re_verified_note`.

Updated `.planning/REQUIREMENTS.md` — ticked FIX-05 (line 148), FIX-06 (line 149), EV-08 (line 176). FIX-07 (line 150) untouched, EV-05/06/07 untouched.

## Verification

- `npx tsc --noEmit` — exit code 0, zero type errors across the repo after Task 3
- `grep -c "<FeedbackDetailSheet" feedback-inbox.tsx` → 1
- `grep -c "Traceability" policy-tab-bar.tsx` → 1 (label string match)
- `grep -c "canViewTrace" policy-tab-bar.tsx` → ≥ 2 (prop type + visibility gate)
- `grep -c "canViewTrace" app/(workspace)/policies/[id]/layout.tsx` → confirmed (lines 23, 31)
- `grep -c "EvidencePackDialog" auditor-dashboard.tsx` → 2 (import + JSX mount)
- `grep -c 'render={<Link href="/audit"' auditor-dashboard.tsx` → exactly 1 (View Full Audit Trail button, correct residual)
- `git diff app/(workspace)/audit/page.tsx` → empty (backwards compat preserved)
- `git diff app/(workspace)/_components/workspace-nav.tsx` → empty (out of scope, untouched)
- All three VERIFICATION.md files contain `status: passed` at the top of their frontmatter
- REQUIREMENTS.md shows `[x]` for FIX-05 (148), FIX-06 (149), EV-08 (176); FIX-07 (150) still `[ ]`

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 401098e | docs(15-01): re-verify FIX-05 and flip Phase 4 verification to passed |
| 2 | 6a5c2c1 | docs(15-01): re-verify FIX-06 and flip Phase 7 verification to passed |
| 3 | e924ef0 | feat(15-01): EV-08 EvidencePackDialog accepts optional trigger prop |

## Deviations from Plan

None — the plan was executed exactly as written. Task 1 and Task 2 guard greps all hit on first try (confirming Phase 13 consolidation work landed cleanly). Task 3's cast-to-ReactElement approach worked on the first typecheck; no iteration was needed on the DialogTrigger render-prop type.

## Known Stubs

None introduced by this plan. All three deliverables wire real data / real components — no placeholder empty states, no TODO comments, no hardcoded empty arrays or mock data.

## Gap Closure Confirmation

All four Phase 15 ROADMAP success criteria are now TRUE:

1. ✅ Stakeholder clicking a feedback row in `/policies/[id]/feedback` opens FeedbackDetailSheet (verified via grep of feedback-inbox.tsx — sheet is imported on line 13, mounted on line 182, and wired to `selectedFeedbackId` state on line 183)
2. ✅ Traceability page is reachable via PolicyTabBar from any policy detail page for roles with `trace:read` (verified via grep of policy-tab-bar.tsx lines 33–38 + layout.tsx prop pass-through)
3. ✅ Auditor dashboard "Export Evidence Pack (ZIP)" button opens EvidencePackDialog in-place with no /audit navigation (implemented via the new optional `trigger` prop + auditor-dashboard.tsx in-place mount)
4. ✅ Phase 4, Phase 7, and Phase 9 VERIFICATION.md are all updated to `status: passed` with 2026-04-13 re-verified timestamps; REQUIREMENTS.md marks FIX-05, FIX-06, EV-08 as `[x]` complete

v0.1 closeout gate is CLEAR. Phase 16 can begin without layering on stale `gaps_found` verifications.

## Self-Check: PASSED

**Files exist:**
- FOUND: app/(workspace)/audit/_components/evidence-pack-dialog.tsx (edited)
- FOUND: app/(workspace)/dashboard/_components/auditor-dashboard.tsx (edited)
- FOUND: .planning/phases/04-feedback-system/04-VERIFICATION.md (frontmatter flipped)
- FOUND: .planning/phases/07-traceability-search/07-VERIFICATION.md (frontmatter flipped)
- FOUND: .planning/phases/09-public-portal-compliance/09-VERIFICATION.md (frontmatter flipped)
- FOUND: .planning/REQUIREMENTS.md (FIX-05/06 and EV-08 ticked)

**Commits exist:**
- FOUND: 401098e (Task 1 Phase 4 verification flip)
- FOUND: 6a5c2c1 (Task 2 Phase 7 verification flip)
- FOUND: e924ef0 (Task 3 EV-08 fix)

**TypeScript:** `npx tsc --noEmit` exit 0

---
phase: 13
slug: ux-consolidation-navigation
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-12
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 + @testing-library/react 16.3.2 + jsdom 29.0.1 |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `npx vitest run src/__tests__/permissions.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Type check command** | `npx tsc --noEmit` |
| **Estimated runtime** | ~25 seconds (full suite + tsc) |

---

## Sampling Rate

- **After every task commit:** Run the task's scoped command (e.g. `npx vitest run src/__tests__/<file>.test.tsx`) — typically < 5s
- **After every plan wave:** Run `npx vitest run && npx tsc --noEmit` — ~25s
- **Before `/gsd:verify-work`:** Full suite must be green AND `npx tsc --noEmit` must exit 0
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | D-16 (rename uploadthing → r2-upload) | integration (shell + tsc) | `test ! -f src/lib/uploadthing.ts && test -f src/lib/r2-upload.ts && npx tsc --noEmit && ! grep -r "from '@/src/lib/uploadthing'" app src 2>/dev/null` | N/A (shell + tsc) | ⬜ pending |
| 13-01-02 | 01 | 1 | NAV-05 (D-14 nav reorder + Users gate, D-15 no Notifications link) | unit (component) | `npx vitest run src/__tests__/workspace-nav.test.tsx && npx tsc --noEmit` | ❌ W0 (Task creates) | ⬜ pending |
| 13-01-03 | 01 | 1 | NAV-03 (feedback.listCrossPolicy procedure) | unit (router) | `npx vitest run src/__tests__/feedback-cross-policy.test.ts && npx tsc --noEmit` | ❌ W0 (Task creates) | ⬜ pending |
| 13-02-01 | 02 | 1 | NAV-01 (D-01/D-02/D-03 Breadcrumb component) | unit (component) | `npx vitest run src/__tests__/breadcrumb.test.tsx && npx tsc --noEmit` | ❌ W0 (Task creates) | ⬜ pending |
| 13-02-02 | 02 | 1 | D-02 (Breadcrumb placement in workspace layout) | integration (tsc + grep) | `npx tsc --noEmit && grep -q "import { Breadcrumb }" "app/(workspace)/layout.tsx" && grep -q "flex h-screen flex-col" "app/(workspace)/layout.tsx" && grep -q "<Breadcrumb />" "app/(workspace)/layout.tsx"` | N/A (tsc + grep) | ⬜ pending |
| 13-03-01 | 03 | 2 | NAV-02 (D-05/D-06/D-07 PolicyTabBar with role gates) | unit (component) | `npx vitest run src/__tests__/policy-tab-bar.test.tsx && npx tsc --noEmit` | ❌ W0 (Task creates) | ⬜ pending |
| 13-03-02 | 03 | 2 | D-05/D-06 (shared policy layout with tab bar) | integration (tsc + file exists) | `npx tsc --noEmit && test -f "app/(workspace)/policies/[id]/layout.tsx"` | N/A (tsc + file) | ⬜ pending |
| 13-03-03 | 03 | 2 | D-04 (strip Back button + sub-page nav from page.tsx) | integration (tsc + grep negative) | `npx tsc --noEmit && ! grep -q "Back to Policies" "app/(workspace)/policies/[id]/page.tsx" && ! grep -q "ArrowLeft" "app/(workspace)/policies/[id]/page.tsx" && ! grep -q "GitPullRequest" "app/(workspace)/policies/[id]/page.tsx" && ! grep -q "h-\[calc(100vh-64px)\]" "app/(workspace)/policies/[id]/page.tsx"` | N/A (tsc + grep) | ⬜ pending |
| 13-04-01 | 04 | 2 | D-09/D-10 (rewrite /feedback page + GlobalFeedbackTabs) | integration (grep + file exists) | `test -f "app/(workspace)/feedback/_components/global-feedback-tabs.tsx" && grep -q "GlobalFeedbackTabs" "app/(workspace)/feedback/page.tsx" && ! grep -q "redirect.*outcomes" "app/(workspace)/feedback/page.tsx"` | N/A (grep) | ⬜ pending |
| 13-04-02 | 04 | 2 | D-09/D-10 (3 tab components + legacy redirects) | integration (tsc + grep) | `npx tsc --noEmit && grep -q "listCrossPolicy" "app/(workspace)/feedback/_components/all-feedback-tab.tsx" && grep -q "redirect.*tab=outcomes" "app/(workspace)/feedback/outcomes/page.tsx" && grep -q "redirect.*tab=evidence-gaps" "app/(workspace)/feedback/evidence-gaps/page.tsx"` | N/A (tsc + grep) | ⬜ pending |
| 13-05-01 | 05 | 1 | NAV-07 (D-12 Give Feedback button role-gated) | unit (component) | `npx vitest run src/__tests__/section-content-view.test.tsx && npx tsc --noEmit` | ❌ W0 (Task creates) | ⬜ pending |
| 13-05-02 | 05 | 1 | D-13 (workshop cross-nav links + router documentId) | integration (tsc + grep) | `npx tsc --noEmit && grep -q "Link href={\`/policies/\${section.documentId}" "app/(workspace)/workshops/[id]/page.tsx" && grep -q "Link href={\`/policies/\${fb.documentId}" "app/(workspace)/workshops/[id]/page.tsx"` | N/A (tsc + grep) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Coverage summary:** 12 tasks total across 5 plans. 5 Vitest unit/component test files created inline by tasks (workspace-nav, feedback-cross-policy, breadcrumb, policy-tab-bar, section-content-view). 7 tasks use tsc + shell/grep integration checks (pure file moves, layout edits, deletion verification, router schema changes).

---

## Wave 0 Requirements

All Wave 0 test scaffolds are created inline as Step 1 (RED) of their own `tdd="true"` tasks — no separate Wave 0 plan needed. Each RED step creates the test file and asserts it fails before GREEN implementation proceeds.

- [ ] `src/__tests__/workspace-nav.test.tsx` — covers NAV-05 (Users link visibility by role) — created by Task 13-01-02 RED step
- [ ] `src/__tests__/feedback-cross-policy.test.ts` — covers NAV-03 (new tRPC procedure permission enforcement) — created by Task 13-01-03 RED step
- [ ] `src/__tests__/breadcrumb.test.tsx` — covers NAV-01 (pathname segment parsing, entity name loading state) — created by Task 13-02-01 RED step
- [ ] `src/__tests__/policy-tab-bar.test.tsx` — covers NAV-02 (role-gated tab visibility, active state) — created by Task 13-03-01 RED step
- [ ] `src/__tests__/section-content-view.test.tsx` — covers NAV-07 (Give Feedback button visibility by role) — created by Task 13-05-01 RED step

**Framework install:** Not needed — Vitest 4.1.1, @testing-library/react 16.3.2, and jsdom 29.0.1 already in `devDependencies` (verified in package.json).

**Note on `wave_0_complete`:** Set to `false` until the 5 RED test files are created and failing as expected. Flip to `true` when all 5 exist on disk (even before their GREEN steps complete). `nyquist_compliant: true` is set because every task has either an `<automated>` command pointing at a real Vitest target OR a shell/tsc integration check — no MISSING references remain.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Breadcrumb renders visually below header on every workspace page with correct chevron separator and mobile hide-middle-crumbs behavior | D-01/D-02 | Visual layout + responsive breakpoint — not easily asserted in unit tests without snapshot churn | Start dev server; visit /dashboard, /policies, /policies/{uuid}, /policies/{uuid}/feedback, /workshops/{uuid}; at each route verify breadcrumb row appears below header with correct crumbs and `>` chevrons; resize to < 640px and confirm middle crumbs hide |
| PolicyTabBar persists visually across all policy sub-routes with correct active underline | D-05/D-06 | Multi-route navigation visual continuity | Visit /policies/{id}, /policies/{id}/feedback, /policies/{id}/versions, /policies/{id}/traceability; tab bar should stay mounted and the correct tab should show active underline at each route |
| Global /feedback tabbed page visually displays cross-policy rows with working policy filter Select | D-09/D-10 | Select dropdown + list rendering integration | Sign in as admin; visit /feedback; "All Feedback" tab should be default; pick a policy from the Select and confirm rows filter; click `?tab=outcomes` and confirm outcomes render; visit /feedback/outcomes and confirm redirect to /feedback?tab=outcomes |
| Give Feedback CTA end-to-end: click lands on pre-filled feedback/new form | D-12 | Route existence + form pre-fill is existing Phase 4 code path | Sign in as stakeholder; open a policy; click a section; click Give Feedback; confirm URL = `/policies/{id}/sections/{sectionId}/feedback/new` and the form renders |
| Workshop cross-nav: clicking linked section/feedback navigates to policy context | D-13 | Click-through navigation integration | Open a workshop with linked sections and feedback; click a linked section row → should land on /policies/{documentId}; click a linked feedback row → should land on /policies/{documentId}/feedback |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (12/12 tasks mapped above)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task has either a Vitest or tsc/grep command)
- [x] Wave 0 covers all MISSING references (5 test files created inline via RED steps)
- [x] No watch-mode flags (all commands use `npx vitest run`, not `vitest` or `--watch`)
- [x] Feedback latency < 30s (full suite + tsc estimated ~25s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

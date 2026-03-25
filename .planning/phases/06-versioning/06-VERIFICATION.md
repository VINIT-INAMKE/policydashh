---
phase: 06-versioning
verified: 2026-03-25T07:00:00Z
status: passed
score: 15/15 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Navigate to /policies/[id]/versions, select two versions with real data, click Compare Versions"
    expected: "Section diff view renders with green highlighting for added text and red for removed text using CSS variables"
    why_human: "CSS variable rendering and visual diff highlighting cannot be verified programmatically without a running browser"
  - test: "Click Publish Version on a Draft version, review the publish dialog"
    expected: "Dialog shows version label, changelog preview, immutability warning with AlertTriangle icon, Cancel on left and Publish on right (justify-between footer)"
    why_human: "Layout and visual presentation of the irreversible-action separation requires browser rendering"
  - test: "Create a manual version via the Create Version dialog with exactly 9 characters in the notes field"
    expected: "Create Version button remains disabled; character counter turns destructive red"
    why_human: "Form validation state and color change require browser interaction to verify"
---

# Phase 06: Versioning Verification Report

**Phase Goal:** Policy documents have a complete version history with diffs, changelogs, and immutable archives so any stakeholder can see exactly what changed and why
**Verified:** 2026-03-25T07:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | getNextVersionLabel returns v0.1 for first version and increments correctly | VERIFIED | Function at version.service.ts:115 queries documentVersions, parses /^v0\.(\d+)$/ regex and returns v0.(N+1); returns 'v0.1' when no rows or non-matching label |
| 2 | computeSectionDiff returns added/removed/modified/unchanged status per section | VERIFIED | Function at version.service.ts:45; builds Maps from sectionId keys, iterates all unique IDs, calls diffWords on modified content; 9 unit tests cover all statuses including mixed scenario and edge cases |
| 3 | buildChangelog produces ChangelogEntry[] with CR IDs, titles, and feedback readable IDs | VERIFIED | Function at version.service.ts:171; queries crFeedbackLinks joined with feedbackItems for readableIds, queries crSectionLinks for sectionIds, returns single ChangelogEntry with all fields |
| 4 | publishVersion sets isPublished=true and publishedAt, is idempotent on re-call | VERIFIED | Function at version.service.ts:207; checks version.isPublished first and returns as-is if true; otherwise updates both fields with db.update().returning() |
| 5 | createManualVersion snapshots current sections and generates next version label | VERIFIED | Function at version.service.ts:242; wraps in db.transaction, calls getNextVersionLabel and snapshotSections inside tx, inserts documentVersions with sectionsSnapshot and changelog |
| 6 | mergeCR now captures sectionsSnapshot and changelog inside the transaction | VERIFIED | changeRequest.service.ts:166-167; snapshotSections and buildChangelog called inside db.transaction before documentVersions insert; fields included in insert at line 172-179 |
| 7 | Published versions cannot be mutated (immutability guard at service layer) | VERIFIED | publishVersion is idempotent (returns as-is if isPublished=true); no update endpoint exists that modifies published versions; UI renders "This version is published and immutable. No further edits are possible." text instead of publish button |
| 8 | User can see a list of all versions ordered newest first | VERIFIED | version.ts router list procedure queries orderBy(desc(documentVersions.createdAt)); page.tsx auto-selects versions[0] (first/latest) on load |
| 9 | User can see version label (monospace), status badge (Draft/Published), creator, date | VERIFIED | version-card.tsx renders font-mono badge for label, VersionStatusBadge for status, formatDate for createdAt, creatorName from joined users table |
| 10 | User can view a version's auto-generated changelog showing CRs and feedback IDs | VERIFIED | version-detail.tsx queries trpc.version.getById and passes changelog to VersionChangelog; version-changelog.tsx renders crReadableId badge and feedbackIds[] as FB-NNN monospace badges |
| 11 | User can compare two versions and see section-level diff with green/red highlighting | VERIFIED | version-comparison-selector.tsx has three Selects + swap button + Compare Versions CTA; section-diff-view.tsx queries trpc.version.diff and renders spans with bg-[var(--diff-added-bg)] and bg-[var(--diff-removed-bg)] |
| 12 | Previous versions are displayed as read-only archives | VERIFIED | All version detail components are display-only; no edit affordances exist; published versions show immutable text instead of edit controls |
| 13 | Admin/Policy Lead can publish a version via confirmation dialog | VERIFIED | publish-dialog.tsx calls trpc.version.publish.useMutation; version-detail.tsx renders Publish Version button when !version.isPublished, wired to setPublishOpen(true); server enforces requirePermission('version:publish') |
| 14 | Published versions show immutable lock indicator with no edit affordances | VERIFIED | version-status-badge.tsx renders Lock icon + "Published · Immutable" for published versions; version-detail.tsx renders immutability text instead of publish button when version.isPublished |
| 15 | Admin/Policy Lead can manually create a version with notes | VERIFIED | create-version-dialog.tsx calls trpc.version.createManual.useMutation with notes (min 10, max 2000, char counter); server enforces requirePermission('version:manage') |

**Score:** 15/15 truths verified

---

### Required Artifacts

#### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/server/services/version.service.ts` | Version service with 8 exports (2 interfaces + 6 functions) | VERIFIED | Exports: SectionSnapshot, ChangelogEntry, SectionDiffResult interfaces; getNextVersionLabel, computeSectionDiff, buildChangelog, snapshotSections, publishVersion, createManualVersion functions; 277 lines |
| `src/server/routers/version.ts` | Version tRPC router with 5 procedures | VERIFIED | Exports versionRouter with list, getById, createManual, publish, diff procedures; all guarded by requirePermission |
| `src/db/migrations/0004_versioning.sql` | ALTER TABLE adding 4 columns | VERIFIED | Adds sections_snapshot JSONB, changelog JSONB, published_at TIMESTAMPTZ, is_published BOOLEAN; plus 2 indexes |
| `src/__tests__/versioning.test.ts` | Unit tests for version service pure functions | VERIFIED | 9 tests covering computeSectionDiff: empty, added, removed, modified, unchanged, title change, mixed scenario, empty content, nested content diff |

#### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/(workspace)/policies/[id]/versions/page.tsx` | Version history page entry point | VERIFIED | 'use client'; trpc.version.list.useQuery; two-panel layout; auto-selects latest version; CreateVersionDialog wired |
| `app/(workspace)/policies/[id]/versions/_components/version-list.tsx` | Left panel version list with selection state | VERIFIED | Desktop ScrollArea panel with VERSIONS heading + count; mobile Select dropdown; New Version button |
| `app/(workspace)/policies/[id]/versions/_components/version-detail.tsx` | Right panel with changelog, diff, publish | VERIFIED | trpc.version.getById.useQuery; renders VersionChangelog, VersionComparisonSelector, PublishDialog; immutability text vs publish button |
| `app/(workspace)/policies/[id]/versions/_components/section-diff-view.tsx` | Inline diff renderer using diff package output | VERIFIED | trpc.version.diff.useQuery; renders added/removed/modified/unchanged states with CSS variables --diff-added-bg and --diff-removed-bg |
| `app/(workspace)/policies/[id]/versions/_components/publish-dialog.tsx` | Publish confirmation with immutability warning | VERIFIED | trpc.version.publish.useMutation; AlertTriangle icon; changelog preview; justify-between footer; toast on success/error |
| `app/(workspace)/policies/[id]/versions/_components/create-version-dialog.tsx` | Manual version creation with notes field | VERIFIED | trpc.version.createManual.useMutation; min 10, max 2000 chars; character counter with destructive color below minimum; autofocus textarea |

Note: `app/(workspace)/policies/[id]/versions/[versionId]/page.tsx` was listed in the plan's `files_modified` frontmatter but was not created. The plan's must_haves artifacts did not require this file, and the implementation uses a single-page two-panel layout instead of a separate detail route. This is a plan deviation that was implicitly accepted by the executor. The phase goal is fully achievable without it.

---

### Key Link Verification

#### Plan 01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `changeRequest.service.ts` | `version.service.ts` | `import { getNextVersionLabel, snapshotSections, buildChangelog }` | WIRED | Line 9: exact import present; all three functions called inside mergeCR transaction (lines 163, 166, 167) |
| `version.ts` router | `version.service.ts` | import service functions | WIRED | Lines 7-10: imports computeSectionDiff, publishVersion, createManualVersion; all used in procedures |
| `_app.ts` | `version.ts` router | `version: versionRouter` registration | WIRED | Line 9: `import { versionRouter } from './version'`; line 19: `version: versionRouter` in appRouter |

#### Plan 02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `version-detail.tsx` | `version.getById` tRPC query | `trpc.version.getById.useQuery` | WIRED | Line 57: query present; result rendered (versionLabel, changelog, isPublished, etc.) |
| `publish-dialog.tsx` | `version.publish` tRPC mutation | `trpc.version.publish.useMutation` | WIRED | Line 44: mutation present; called in handlePublish() which fires on button click; invalidates version.list and version.getById on success |
| `section-diff-view.tsx` | `version.diff` tRPC query | `trpc.version.diff.useQuery` | WIRED | Line 35: query present; result rendered as inline spans with CSS variable classes |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `version-detail.tsx` | `versionQuery.data` | `trpc.version.getById` → `version.ts` getById procedure → drizzle select from documentVersions + users join | version.ts lines 45-75: full select with sectionsSnapshot and changelog fields; NOT_FOUND throws if missing | FLOWING |
| `section-diff-view.tsx` | `diffQuery.data` | `trpc.version.diff` → `version.ts` diff procedure → `computeSectionDiff(versionA.sectionsSnapshot, versionB.sectionsSnapshot)` | Real DB queries for both version rows; computeSectionDiff is a pure function operating on real snapshot data | FLOWING |
| `version-list.tsx` / `page.tsx` | `versionsQuery.data` | `trpc.version.list` → `version.ts` list procedure → drizzle select from documentVersions ordered desc by createdAt | List query includes isPublished, publishedAt, creatorName from users join; no static returns | FLOWING |
| `publish-dialog.tsx` | `changelog` prop | Passed from version-detail.tsx which casts `version.changelog` from getById query | Changelog is stored JSONB from real DB; cast to ChangelogEntry[] | FLOWING |

One data-flow note: `version-detail.tsx:163` passes `documentTitle=""` to `PublishDialog`. The publish dialog handles this gracefully (renders nothing for the title when empty due to `{documentTitle && ...}` guard), but the document title does not appear in the publish confirmation. This is a cosmetic gap — the mutation still executes correctly with a real version ID.

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — verifying tRPC endpoints and DB queries requires a running server with a database connection. Static code analysis confirms all query paths are wired to real data sources (no static empty returns).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| VER-01 | 06-01, 06-02 | Policy documents use semantic versioning (v0.1, v0.2, etc.) | SATISFIED | getNextVersionLabel parses and increments v0.N pattern; version labels displayed in font-mono throughout UI |
| VER-02 | 06-01, 06-02 | New version created on CR merge or manually by Admin/Policy Lead | SATISFIED | mergeCR creates documentVersions row atomically; createManualVersion exposed via createManual procedure; requirePermission('version:manage') guards manual creation |
| VER-03 | 06-01, 06-02 | Auto-generated changelog: what changed, why, linked feedback IDs | SATISFIED | buildChangelog queries crFeedbackLinks and crSectionLinks, stores as JSONB; VersionChangelog renders crReadableId badge and feedbackIds[] as monospace badges |
| VER-04 | 06-01, 06-02 | Section-level diff view comparing any two versions | SATISFIED | computeSectionDiff uses diffWords for word-level diff; version.diff tRPC procedure serves it; section-diff-view.tsx and version-comparison-selector.tsx provide the UI |
| VER-05 | 06-01, 06-02 | Previous versions archived and accessible as read-only | SATISFIED | All versions stored with sectionsSnapshot; version history page shows all versions; no mutation endpoints exist for version content (only publish is a state change) |
| VER-06 | 06-01, 06-02 | Admin/Policy Lead can publish a version for public portal visibility | SATISFIED | publish procedure guards with requirePermission('version:publish') = [ADMIN, POLICY_LEAD]; PublishDialog provides UI with confirmation flow |
| VER-07 | 06-01, 06-02 | Version snapshots immutable once published | SATISFIED | publishVersion is idempotent (returns as-is if already published); no update path for published version content; UI renders "immutable" badge and disables publish action |

All 7 VER requirements are satisfied. No orphaned requirements found — REQUIREMENTS.md marks all VER-01 through VER-07 as `[x]` completed.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `version-detail.tsx` | 163 | `documentTitle=""` hardcoded empty string passed to PublishDialog | Info | Cosmetic only — dialog renders "Publishing: v0.N" without the document title suffix; mutation is unaffected |

No TODO/FIXME/placeholder comments found in any phase 06 file. No empty implementations. No return null/return []/return {} in service layer. No disconnected data sources.

---

### Human Verification Required

#### 1. Section Diff Green/Red Rendering

**Test:** Navigate to `/policies/[id]/versions` with at least two versions that have different section content. Select base and target versions, choose a section, click "Compare Versions".
**Expected:** The diff view renders inline with green-highlighted (added) text and red-highlighted (removed) text using the CSS variables `--diff-added-bg`, `--diff-added-text`, `--diff-removed-bg`, `--diff-removed-text`.
**Why human:** CSS custom property rendering and color accuracy require a browser to verify.

#### 2. Publish Dialog Layout

**Test:** Open any Draft version, click "Publish Version" button.
**Expected:** Dialog appears with Cancel button on the left and Publish Version (with Lock icon) on the right of the footer (justify-between layout). AlertTriangle icon appears next to the immutability warning. Changelog preview is scrollable and shows entries if present.
**Why human:** Visual layout and spatial separation of irreversible-action buttons require browser rendering to confirm.

#### 3. Create Version Character Counter Validation

**Test:** Open the Create Version dialog, type 5 characters in the notes textarea.
**Expected:** Character counter shows "5/2000" in destructive red; "Create Version" button is disabled; a minimum-characters warning appears below the textarea.
**Why human:** Form validation state and color changes require browser interaction.

---

### Gaps Summary

No gaps found. All 15 observable truths verified. All required artifacts exist, are substantive, are wired to real data sources, and produce real data through the full stack. All 7 VER requirements are satisfied.

The single notable finding (empty `documentTitle=""` prop in version-detail.tsx) is cosmetic and does not block any requirement or truth. The publish dialog functions correctly without the document title.

---

_Verified: 2026-03-25T07:00:00Z_
_Verifier: Claude (gsd-verifier)_

---
phase: 21-public-shell-consultation-summary-llm-theme
plan: 04
subsystem: ui
tags: [nextjs, server-components, public-shell, privacy-projection, consultation-summary, jsonb, public-portal, framework-page, tailwind, cl-landing]

# Dependency graph
requires:
  - phase: 21-00
    provides: ConsultationSummaryJson + ApprovedSummarySection contract types, documentVersions.consultationSummary JSONB column (migration 0013), Wave 0 RED contract test section-summary-block.test.tsx locking the PUB-09 component seam
  - phase: 21-01
    provides: Runtime pipeline that populates documentVersions.consultationSummary on every version.published event — this plan consumes that JSONB cache on the public rendering surfaces
  - phase: 21-02
    provides: Public shell at app/(public)/layout.tsx owning .cl-landing palette + Newsreader/Inter font variables — this plan's components inherit those tokens automatically without re-wrapping
  - phase: 20.5-public-research-framework-content-pages
    provides: PublicPolicyContent optional-prop extension precedent (sectionStatuses prop pattern) — mirrored here for the sectionSummaries/sectionsWithEntry pair; (public)/framework page.tsx renderFrameworkDetail structure
  - phase: 09-public-portal-compliance
    provides: Phase 9 PUB-05 privacy invariant (stakeholder identity never crosses into (public) components) — enforced here via ApprovedSummarySection projection at every seam
provides:
  - SectionSummaryBlock server component rendering approved consultation prose OR muted placeholder inline below each section on /portal/[policyId]
  - SummaryPlaceholderCard server component (zero props, static copy) for pending/blocked/error/skipped sections
  - FrameworkSummaryBlock server component rendering the latest published version's approved summary below WhatChangedLog on /framework
  - PublicPolicyContent extended with optional sectionSummaries?: Map<string, ApprovedSummarySection> + sectionsWithEntry?: Set<string> props — backward compatible with Phase 9/20.5 callers
  - Portal page (app/(public)/portal/[policyId]/page.tsx) reads selectedVersion.consultationSummary JSONB, projects to ApprovedSummarySection at the seam, passes the Map + Set into PublicPolicyContent
  - Framework page (app/(public)/framework/page.tsx) sorts publishedVersions by publishedAt desc, mounts FrameworkSummaryBlock with the latest version's summary
  - Stale /portal/[policyId]/consultation-summary subroute link removed (Pitfall 7 — route was deferred, dead nav eliminated)
  - Wave 0 PUB-09 RED contract section-summary-block.test.tsx flipped GREEN
affects:
  - Future phases extending the portal or framework rendering surface (any new prop on PublicPolicyContent must remain backward compatible via optional-prop pattern)
  - Future plans that touch consultationSummary JSONB on other public surfaces (must use ApprovedSummarySection projection — never ConsultationSummarySection directly)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Privacy projection at the public seam: server components read full ConsultationSummaryJson from JSONB, filter by status === 'approved', then map into ApprovedSummarySection before passing into child (public) components. The type system enforces the stripping because the child component prop interface only accepts ApprovedSummarySection"
    - "Optional-prop extension on public components: new capability added via optional prop pair (sectionSummaries + sectionsWithEntry) so existing callers (Phase 9 /portal, Phase 20.5 /framework detail) stay backward compatible without edits"
    - "Dual-signal for placeholder-vs-omit: 'has entry in JSONB but not approved' renders SummaryPlaceholderCard; 'no entry at all' renders nothing. Encoded via sectionsWithEntry: Set<string> passed alongside sectionSummaries: Map<string, ApprovedSummarySection> so the child can distinguish"
    - "CSS-var inheritance from shell: child components reference var(--cl-outline-variant), var(--cl-surface-container-low), var(--font-cl-headline), var(--font-cl-body), #179d53 — all provided by app/(public)/layout.tsx shell wrapper; components never re-declare .cl-landing"
    - "Server-component-only for all 3 new files: SectionSummaryBlock / SummaryPlaceholderCard / FrameworkSummaryBlock are pure presentational with no hooks, no events, no state — Next.js default (no 'use client' directive)"

key-files:
  created:
    - app/(public)/portal/[policyId]/_components/summary-placeholder-card.tsx
    - app/(public)/portal/[policyId]/_components/section-summary-block.tsx
    - app/(public)/framework/_components/framework-summary-block.tsx
  modified:
    - app/(public)/portal/[policyId]/_components/public-policy-content.tsx
    - app/(public)/portal/[policyId]/page.tsx
    - app/(public)/framework/page.tsx

key-decisions:
  - "Server-component-only for all 3 new components. SectionSummaryBlock / SummaryPlaceholderCard / FrameworkSummaryBlock display static content with zero interactivity, zero state, zero events. Per Next.js default (and node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md: 'By default, layouts and pages are Server Components'), we omit the 'use client' directive entirely. Keeps the bundle lean and avoids turning the entire public portal / framework page into client components via transitive rendering."
  - "Portal page uses a Map + Set pair, not a single richer type, to encode three states. sectionSummaries carries ONLY approved sections as ApprovedSummarySection projections; sectionsWithEntry carries ALL sectionIds present in JSONB (regardless of status). The child component uses the pair to disambiguate: (a) not in Set → render nothing, (b) in Set but not in Map → render placeholder, (c) in Map → render approved prose. This keeps the public component props free of any status field — it never needs to know 'why' a section is pending/blocked/error, just that it's 'not approved'."
  - "FrameworkSummaryBlock filters and projects in one pass inside the component, not in the page. The portal page does the projection upstream (Task 2) because it needs to also build the Set<sectionId> anyway. The framework page has simpler semantics — 'render the latest published version's approved sections' — so the projection happens inside FrameworkSummaryBlock itself. Both seams are ApprovedSummarySection-only; the difference is just where the .filter().map() chain runs."
  - "No 'has entry but none approved' placeholder on /framework — only silent omission per D-18. The portal renders a placeholder for pending/blocked sections because users are browsing a specific version and expect to know 'something is coming here'. The framework page has different semantics: it's showing auxiliary context for the DRAFT under consultation, and empty-or-unapproved summaries should simply not clutter the page. D-18 is explicit: 'If no published version exists yet, /framework simply omits the summary block (no placeholder).'"
  - "Privacy grep extended to ALL of app/(public)/, not just section-summary-block.tsx. The plan's Task 1 acceptance criterion targeted one file, but the plan-level verification criterion is 'grep -c sourceFeedbackIds app/(public)/ returns 0'. A stray doc-comment mention in summary-placeholder-card.tsx (literally saying 'NEVER receives sourceFeedbackIds') failed the literal grep even though it affirmed the invariant. Reworded the comment in a tiny follow-up commit so the grep is clean — a zero-false-positive policy prevents future drift where 'NEVER' comments could flip to real references silently."

patterns-established:
  - "Pattern: Privacy projection at the public-component seam. Every surface rendering consultation summaries MUST project ConsultationSummarySection → ApprovedSummarySection before the data crosses into a (public) child component, and the receiving component's prop type must be ApprovedSummarySection so the type system enforces the stripping. This plan establishes the template for any future phase adding another public surface that consumes the JSONB cache."
  - "Pattern: Optional Map + Set pair for dual-signal child-component props when data-state-space needs more than one bit. Use this whenever a public component needs to distinguish 'has data' / 'has entry without data' / 'no entry' states without leaking the status enum across the seam."
  - "Pattern: CSS-var-only styling inside shell-owned palettes. Child components reference var(--cl-outline-variant), etc. — no re-declaration of tokens, no inline hex except for the canonical accent #179d53 which is reserved for D-01 accents. Any future (public) component should follow this pattern."

requirements-completed: [LLM-05, LLM-07, LLM-08, PUB-09]

# Metrics
duration: 13min
completed: 2026-04-15
---

# Phase 21 Plan 04: Public Rendering of Approved Consultation Summaries Summary

**Three new server components + 3 page/component edits wire the Plan 21-01 consultationSummary JSONB cache into the public rendering surfaces: `/portal/[policyId]` shows approved prose inline under each section (with muted placeholders for pending/blocked/error), `/framework` shows the latest publish's approved summary below the WhatChangedLog, and the stale `/portal/[policyId]/consultation-summary` subroute link is removed — enforcing the LLM-08 privacy invariant via `ApprovedSummarySection` projection at every seam and flipping the Wave 0 PUB-09 RED contract `section-summary-block.test.tsx` GREEN.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-04-15T10:19:58Z
- **Completed:** 2026-04-15T10:33:13Z
- **Tasks:** 3 of 3
- **Files created:** 3
- **Files modified:** 3

## Accomplishments

- **PUB-09 Wave 0 RED contract flipped GREEN.** `app/(public)/portal/[policyId]/_components/__tests__/section-summary-block.test.tsx` was module-not-found-RED at plan start (`Cannot find package '@/app/(public)/portal/[policyId]/_components/section-summary-block'`); after Task 1 it passes 1/1 — the `SectionSummaryBlock` export is now defined and importable.
- **LLM-05 consumption side wired.** Both the portal page and the framework page now read `documentVersions.consultationSummary` (cached by Plan 21-01's Inngest function) and render it on their respective public surfaces. The cache-to-render loop is complete: `version.published` → Inngest → JSONB → public surfaces.
- **LLM-08 privacy enforcement end-to-end.** The `ApprovedSummarySection` projection runs at every seam where JSONB crosses into a `(public)` route component: (a) `portal/page.tsx` builds the Map with `.filter(s => s.status === 'approved').map(...)`, (b) `framework-summary-block.tsx` does the same filter+map inside its render, and (c) the receiving components (`SectionSummaryBlock`, `FrameworkSummaryBlock` inner render) accept only `ApprovedSummarySection` via their TypeScript prop types. Final verification: `grep sourceFeedbackIds app/(public)/` → 0 matches, `grep feedbackCount app/(public)/` → 0 matches, `grep ApprovedSummarySection app/(public)/` → 4 files.
- **PUB-09 stale subroute link removed.** The `/portal/[policyId]/consultation-summary` button (lines 119-124 of the original portal page) navigated to a deferred route and was a 404 landmine after Phase 21 landed inline summaries. Deleted with the preceding `Users` icon import.
- **3 new server components, zero `'use client'` directives.** All three new files (`summary-placeholder-card.tsx`, `section-summary-block.tsx`, `framework-summary-block.tsx`) are pure presentational with no hooks or state — per Next.js default (confirmed in `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`) they stay server components, keeping the public portal / framework page bundles lean.
- **`PublicPolicyContent` extended without breaking existing callers.** The component now accepts two new optional props (`sectionSummaries`, `sectionsWithEntry`) and renders a `<SectionSummaryBlock>` between the section's prose and the horizontal rule, but only when `sectionSummaries !== undefined`. Existing callers (`/framework/page.tsx` renderFrameworkDetail passes only `sections + sectionStatuses`, `/portal/[policyId]/page.tsx` now passes the new prop pair) — no other file in the codebase needed to change.
- **Full typecheck clean** after every task: `npx tsc --noEmit` exits 0 four times (after Task 1, Task 2, Task 3, and the follow-up privacy-grep chore).
- **Zero test regressions.** `npm test -- --run` reports 487 passed / 2 failed / 58 files. The 2 failures (`section-assignments.test.ts` full-suite load error, 2 assertions in `feedback-permissions.test.ts`) are pre-existing from commit `1648a46` and documented as out-of-scope in Plan 21-01's `deferred-items.md`. Neither file is touched by Plan 21-04.
- **Parallel-wave discipline maintained.** All 4 plan commits use `git commit --no-verify` per the parallel-execution protocol, avoiding pre-commit hook contention with the concurrent Plan 21-03 agent. My file scope was strictly honored (only touched the 6 files listed in the parallel block), and I unstaged the 21-03 agent's files from my index when they leaked into the shared git state.

## Task Commits

Each task was committed atomically with `--no-verify`:

1. **Task 1: Create SummaryPlaceholderCard + SectionSummaryBlock + extend PublicPolicyContent** — `2cb6b7e` (feat)
2. **Task 2: Portal page — pass sectionSummaries + remove stale subroute link** — `dce7014` (feat)
3. **Task 3: Create FrameworkSummaryBlock + mount in framework page** — `8791967` (feat)
4. **Plan chore: reword SummaryPlaceholderCard comment to satisfy privacy grep** — `7dda82e` (chore — follow-up to Task 1 per Rule 2 auto-fix)

**Note on commit `2cb6b7e`:** This commit is labeled `feat(21-03): add consultationSummaryRouter with moderator review gate` in its message line but the actual file payload is entirely Plan 21-04's Task 1 (see the `git show --stat` file list: `public-policy-content.tsx` + `section-summary-block.tsx` + `summary-placeholder-card.tsx`, totalling 112 insertions / 1 deletion). This is a parallel-wave race artifact — the concurrent Plan 21-03 agent's `git commit` command absorbed my staged index at the exact moment I was transitioning between staging and committing, so my 3 files landed under their commit message. The code payload is 100% correct and 100% attributable to Plan 21-04; only the commit MESSAGE is wrong. Plan 21-03's actual router work is in separate later commits (`e9898a2`, `587a26c`) which do not overlap with Plan 21-04's file set. I am documenting this here rather than attempting to rewrite git history because (a) the content is preserved, (b) rewriting `2cb6b7e` would require a destructive rebase that could collide with the in-flight parallel agent, and (c) the SUMMARY.md is the canonical record of plan-to-commit attribution.

## Files Created/Modified

### Created

- `app/(public)/portal/[policyId]/_components/summary-placeholder-card.tsx` — 26 lines. Server component exporting `SummaryPlaceholderCard` — zero props, renders a muted card with the exact contract copy "Summary under review" / "The consultation summary for this section is being reviewed before publication." Container uses `mt-8 rounded-lg border border-[var(--cl-outline-variant)] bg-[var(--cl-surface-container)] p-6`; heading font `var(--font-cl-headline, Newsreader, serif)` in semibold, body font `var(--font-cl-body, Inter, sans-serif)` in regular. Both text colors use `var(--cl-on-surface-variant)` so the placeholder reads as "under review" (muted) without emerald accent.
- `app/(public)/portal/[policyId]/_components/section-summary-block.tsx` — 60 lines. Server component exporting `SectionSummaryBlock` with prop interface `{ summary: ApprovedSummarySection | undefined, hasEntry: boolean }`. Three-branch render: (1) `!hasEntry` → returns null (version predates feature), (2) `hasEntry && !summary` → returns `<SummaryPlaceholderCard />` (pending/blocked/error/skipped), (3) both set → renders the approved-state card with emerald accent dot (`bg-[#179d53]`), "Stakeholder Perspectives" heading in Newsreader semibold, subline "A summary of stakeholder feedback on this section, reviewed by the policy team." in Inter, and the `summary.summary` prose in `whitespace-pre-wrap` body text. Type import is `import type { ApprovedSummarySection }` — no runtime import from the service module so the component has zero runtime dependencies beyond `./summary-placeholder-card`.
- `app/(public)/framework/_components/framework-summary-block.tsx` — 77 lines. Server component exporting `FrameworkSummaryBlock` with prop interface `{ summary: ConsultationSummaryJson | null }`. Early returns: null summary → return null, no approved sections → return null (D-18: no placeholder on /framework, only silent omission). Happy path: filter + project `summary.sections` to `ApprovedSummarySection[]`, render a `<section className="mx-auto mt-12 max-w-3xl">` with a Newsreader h2 "Consultation Summary", an Inter subline "Public summary of stakeholder feedback aggregated from the most recent published version.", and a flex column of per-section cards each showing the section title + prose. Type-only import of both `ConsultationSummaryJson` and `ApprovedSummarySection` — all projection happens inside the render, making the component fully self-contained for future callers that want to pass a raw JSONB payload.

### Modified

- `app/(public)/portal/[policyId]/_components/public-policy-content.tsx` — Added `SectionSummaryBlock` named import + `ApprovedSummarySection` type-only import. Extended `PublicPolicyContentProps` interface with two optional fields: `sectionSummaries?: Map<string, ApprovedSummarySection>` and `sectionsWithEntry?: Set<string>` (both with JSDoc explaining the dual-signal pattern). Updated function signature to destructure the new props. Inserted `{sectionSummaries !== undefined && <SectionSummaryBlock summary={...} hasEntry={...} />}` between the section's prose `<div>` and the `<hr>` separator — the insertion only renders when the caller opted in, preserving backward compatibility with `/framework/page.tsx`'s continued use of `<PublicPolicyContent sections={sections} sectionStatuses={sectionStatuses} />`.
- `app/(public)/portal/[policyId]/page.tsx` — Added type-only import of `ConsultationSummaryJson, ApprovedSummarySection` from `@/src/server/services/consultation-summary.service`. Removed `Users` from the `lucide-react` import line (unused after the stale button was deleted). Added a 15-line projection block after `sortedSections` construction: casts `selectedVersion.consultationSummary as ConsultationSummaryJson | null`, builds `sectionsWithEntry = new Set(sections.map(s => s.sectionId))`, and iterates the sections to populate `sectionSummaries: Map<string, ApprovedSummarySection>` filtered on `s.status === 'approved'`. Deleted the entire Consultation Summary `<Link>` + `<Button>` block (lines 119-124 of the pre-edit file). Updated the `<PublicPolicyContent sections={sortedSections} />` call to pass the new prop pair: `sections={sortedSections} sectionSummaries={sectionSummaries} sectionsWithEntry={sectionsWithEntry}`.
- `app/(public)/framework/page.tsx` — Added named import of `FrameworkSummaryBlock` from `./_components/framework-summary-block` + type-only import of `ConsultationSummaryJson`. Inside `renderFrameworkDetail`, after `const logEntries = buildFrameworkLog(publishedVersions)` and before the `return (...)` JSX, added a 10-line block: sort `publishedVersions` descending by `publishedAt?.getTime()` (guarding null with `?? 0`), pick the first element as `latestPublished`, then cast its `consultationSummary` as `ConsultationSummaryJson | null` with a `?? null` fallback → store in `latestSummary`. Inside the JSX return, after the existing WhatChangedLog `</section>` close and before the enclosing `</div>`, added `<FrameworkSummaryBlock summary={latestSummary} />`. No other edits — draft version loading, published version loading, sections fallback, sectionStatuses, log building, and JSX structure all preserved.

## Decisions Made

- **Server-component-only for all 3 new components.** SectionSummaryBlock / SummaryPlaceholderCard / FrameworkSummaryBlock have zero interactivity — no hooks, no events, no state. Per the Next.js default documented in `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` ("By default, layouts and pages are Server Components"), we omit the `'use client'` directive. This keeps the public portal and framework page bundles lean; promoting any of these to a client component would pull the component + its transitive imports (like `ApprovedSummarySection` — actually erased at build because it's type-only — but the React tree shipping would still happen) into the client bundle unnecessarily.
- **Map + Set pair for three-state disambiguation, not a single richer type.** Encoding "approved / pending-or-blocked / no-entry" needed a way to pass through to the public child component without leaking the status enum. Option A (single Map with sentinel values) mixes concerns. Option B (enum field in prop type) leaks internal state vocabulary across the seam. Option C (Map + Set pair, chosen) lets each collection stay strictly typed: `Map<string, ApprovedSummarySection>` carries only approved-and-projected data, `Set<string>` carries presence-only membership. The child's logic is tiny: `!inSet → null`, `inSet && !inMap → placeholder`, `inMap → approved render`.
- **Projection happens at the page seam for /portal, inside the component for /framework.** Rationale: the portal page needs to build a `Set` alongside the `Map` (because the portal shows placeholders for non-approved sections), so the `.filter().map()` lives upstream where the set-building is already happening. The framework page has simpler semantics — D-18 says "only approved sections render, silently omit everything else" — so the filter+project can live entirely inside `FrameworkSummaryBlock` without leaking any state to the page. Both seams still cross data as `ApprovedSummarySection` at the component boundary.
- **Remove `Users` lucide icon with the stale button.** The icon was used ONLY by the deleted "Consultation Summary" button. Keeping it as an unused import would fail both `next build` lint AND create confusion for future readers. Deletion was explicit in the plan text and matches the plan's Task 2 "DOES NOT contain `Users` inside the lucide-react import" criterion.
- **No guard against missing `publishedAt` in framework sort — use `?? 0` fallback.** `publishedVersions` is filtered by `isPublished = true` so `publishedAt` should always be set in practice, but the type is `Date | null`. Rather than throw on a hypothetical null, the sort comparator uses `a.publishedAt?.getTime() ?? 0` so a null-published row simply sinks to the bottom. This is defensive coding for zero runtime cost.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Privacy Enforcement] Reworded SummaryPlaceholderCard doc comment to satisfy plan-level `sourceFeedbackIds` grep**

- **Found during:** Final plan verification (after Task 3 commit, running `grep -rn sourceFeedbackIds app/(public)/`)
- **Issue:** The plan's verification criterion specified `grep -c "sourceFeedbackIds" app/(public)/` must return 0 (privacy enforcement — the field never crosses into the public tree). My `summary-placeholder-card.tsx` doc comment contained the line *"NEVER receives sourceFeedbackIds or any internal-only field per Phase 21 Pitfall 1"* — a semantically privacy-AFFIRMING comment, but a literal grep match. Task 1's per-file acceptance criterion only required the zero-grep on `section-summary-block.tsx` (which was already clean), so this slipped past the immediate Task 1 verification. The plan-level verification criterion is stricter and caught it.
- **Fix:** Rewrote the doc comment to describe the invariant without literally naming the field: "Takes ZERO props — the only information it displays is static copy, so no internal-only metadata can cross into this component (Phase 21 Pitfall 1)." This preserves the documentation intent (affirming the privacy invariant) while clearing the literal grep. No runtime behavior changed; the component still has zero props.
- **Why Rule 2 (not Rule 1):** The pre-fix code had no correctness or security flaw — the component genuinely takes zero props and genuinely cannot leak the field. But the plan-level verification criterion is "privacy enforcement — the field never crosses into the public tree", and a zero-false-positive policy on privacy greps is itself a privacy enforcement requirement: future drift where "NEVER" comments could flip to real references silently is precisely what the grep exists to catch. Cleaning up the literal match makes the invariant self-enforcing rather than relying on reviewer vigilance.
- **Files modified:** `app/(public)/portal/[policyId]/_components/summary-placeholder-card.tsx`
- **Verification:** `grep -rn sourceFeedbackIds app/(public)/` now returns no matches; `grep -rn feedbackCount app/(public)/` already was clean; `npx tsc --noEmit` still exits 0.
- **Committed in:** `7dda82e` (separate chore commit after Task 3 so it's clearly tagged as a follow-up privacy-grep cleanup, not bundled into a task commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — privacy/documentation). Zero Rule 1 (bugs), zero Rule 3 (blocking), zero Rule 4 (architectural).

**Impact on plan:** Zero scope creep. Three files created as planned, three files modified as planned, Wave 0 RED contract flipped GREEN as planned, 4 requirements (LLM-05, LLM-07, LLM-08, PUB-09) all marked by matching plan + SUMMARY. The Rule 2 auto-fix is a 1-line doc comment rewrite that tightens the privacy invariant enforcement without changing runtime behavior.

## Issues Encountered

- **Parallel-wave git commit race collapsed Task 1 into Plan 21-03's commit.** While I was staging Task 1 files (`section-summary-block.tsx`, `summary-placeholder-card.tsx`, `public-policy-content.tsx`), the concurrent Plan 21-03 agent ran their own `git commit` against the same shared `.git/index`. Git's index is a single shared datastructure — both my 3 staged files AND their unstaged files coexisted in the working tree, but only MY 3 files were in the index when 21-03's commit fired. Result: commit `2cb6b7e` is labeled `feat(21-03): add consultationSummaryRouter with moderator review gate` but its actual file payload is 100% Plan 21-04's Task 1 (`git show --stat 2cb6b7e` lists only `public-policy-content.tsx`, `section-summary-block.tsx`, `summary-placeholder-card.tsx`). The code content is correct and attributable to Plan 21-04; only the commit MESSAGE is wrong. I documented this explicitly in the Task Commits section and chose NOT to rewrite git history (which would require a destructive rebase that could collide with the still-running parallel agent, and the SUMMARY.md is the canonical record of plan-to-commit attribution anyway). Plan 21-03's actual router + SummaryReviewCard work landed in separate later commits (`e9898a2`, `587a26c`, `340db2d`) which are cleanly attributed.
- **Pre-existing test failures (out of scope).** Full `npm test -- --run` reports 487 passed / 2 failed / 58 files. The 2 failures are: (1) `src/__tests__/section-assignments.test.ts` full-suite load error (DATABASE_URL load-order), (2) `src/__tests__/feedback-permissions.test.ts` assertions `denies admin` + `denies auditor` on the `feedback:read_own` permission. `git log --format=oneline -- src/__tests__/feedback-permissions.test.ts` last touched the file at commit `78113917` in Phase 04-01; neither file has any 21-04 edits. Both failures are documented as pre-existing in Plan 21-01's `deferred-items.md`. Per the deviation-rule SCOPE BOUNDARY, these are NOT auto-fixed by Plan 21-04 — they belong to a future lint/test-cleanup plan (likely v0.2 milestone-end cleanup).

## User Setup Required

None — no external service configuration, no environment variables, no dashboards, no secrets. All new components inherit the shell's font variables + CSS vars from `app/(public)/layout.tsx` (shipped by Plan 21-02). The data flow is entirely internal: Plan 21-01's Inngest function populates `documentVersions.consultationSummary` on every `version.published` event, and this plan's components read that JSONB at SSR time on subsequent requests.

## Known Stubs

None — the public rendering path is fully wired end-to-end. A user visiting `/portal/[policyId]` for a version with an approved `consultationSummary` will see `Stakeholder Perspectives` blocks inline under each approved section; sections in the JSONB with non-approved status render the `Summary under review` placeholder; sections with no JSONB entry (or versions with `consultationSummary === null`) render no block at all. A user visiting `/framework` for a document with at least one published version + at least one approved summary section will see a `Consultation Summary` block below the WhatChangedLog. No placeholder-rendering-gaps, no mock data, no hardcoded values.

The manual smoke walk of these surfaces (browser-verifying the rendered HTML, checking Newsreader + Inter font loading, confirming the emerald accent dot at `#179d53`, verifying `Summary under review` placeholder appearance for non-approved sections) is deferred to the v0.2 milestone end-to-end smoke walk per project policy (`feedback_defer_smoke_walks.md`).

## Self-Check: PASSED

- `app/(public)/portal/[policyId]/_components/summary-placeholder-card.tsx` FOUND
- `app/(public)/portal/[policyId]/_components/section-summary-block.tsx` FOUND
- `app/(public)/framework/_components/framework-summary-block.tsx` FOUND
- `app/(public)/portal/[policyId]/_components/public-policy-content.tsx` MODIFIED (contains `sectionSummaries?: Map<string, ApprovedSummarySection>`, `<SectionSummaryBlock`, `sectionsWithEntry?: Set<string>`)
- `app/(public)/portal/[policyId]/page.tsx` MODIFIED (contains `ConsultationSummaryJson`, `ApprovedSummarySection`, `sectionSummaries={sectionSummaries}`, `sectionsWithEntry={sectionsWithEntry}`, `s.status === 'approved'`; does NOT contain `/portal/${policyId}/consultation-summary`, `Users`, `sourceFeedbackIds`, `feedbackCount`)
- `app/(public)/framework/page.tsx` MODIFIED (contains `import { FrameworkSummaryBlock }`, `<FrameworkSummaryBlock summary={latestSummary} />`, `latestPublished?.consultationSummary`)
- Commits `2cb6b7e` (Task 1, under racy 21-03 label — code verified 21-04), `dce7014` (Task 2), `8791967` (Task 3), `7dda82e` (chore follow-up) all FOUND in `git log --oneline`
- `npx tsc --noEmit` exits 0 (four separate runs across the plan)
- `npm test -- --run "app/(public)/portal/[policyId]/_components/__tests__/section-summary-block.test.tsx"` reports 1 passed / 0 failed — Wave 0 PUB-09 RED contract flipped GREEN
- Full suite: 487 passed / 2 failed / 58 files — both failures pre-existing and unrelated to 21-04 (documented in Plan 21-01 `deferred-items.md`)
- Plan-level privacy verification: `grep -rn sourceFeedbackIds app/(public)/` → no matches; `grep -rn feedbackCount app/(public)/` → no matches; `grep -rl ApprovedSummarySection app/(public)/` → 4 files (portal page + section-summary-block + public-policy-content + framework-summary-block), exceeds the plan's "3+" criterion

## Next Phase Readiness

- **Phase 21 is complete after this plan.** All 5 plans have shipped: 21-00 Wave 0 contract lock, 21-01 backend pipeline, 21-02 public shell, 21-03 moderator review router + card, 21-04 public rendering. All 4 backend+frontend Wave 0 RED test files are now GREEN (`consultation-summary-service`, `consultation-summary-generate`, `consultation-summary` router, `section-summary-block`, `public-header`). All 4 LLM requirements tied to Phase 21 (LLM-04/05/06/07/08) and both public-surface requirements (PUB-09/10) have their acceptance bullets satisfied by committed code.
- **Ready for Phase 22 (verification layer — milestones + SHA256 hashing).** The verifiable-policy-OS milestone v0.2 now has its public consultation surface (Phases 19/20/20.5/21) end-to-end: `/participate` → Clerk invite → cal.com workshop register → meeting ends → feedback → CR → version publish → Inngest LLM summary → moderator review → approved JSONB → public /portal + /framework render. Phase 22 can start adding the Milestone entity + hashing service on top of this surface.
- **No carryover blockers.** The 2 pre-existing test failures in `feedback-permissions.test.ts` + `section-assignments.test.ts` remain in the deferred queue for v0.2 milestone-end cleanup (not Phase 21's responsibility). The parallel-wave git-commit race (commit `2cb6b7e` mislabeled) is documented here in the SUMMARY and has no functional impact on subsequent phases — all code is in place and attributable via this file.

---
*Phase: 21-public-shell-consultation-summary-llm-theme*
*Plan: 04*
*Completed: 2026-04-15*

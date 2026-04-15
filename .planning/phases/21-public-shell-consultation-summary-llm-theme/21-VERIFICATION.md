---
phase: 21-public-shell-consultation-summary-llm-theme
verified: 2026-04-15T10:50:00Z
status: human_needed
score: 7/7 must-haves verified
human_verification:
  - test: "Newsreader/Inter font visual rendering — open /portal/[policyId] in browser after npm run dev, hard-reload, confirm Newsreader loads for headings without FOUT and Inter loads for body text"
    expected: "Newsreader serif renders on h1/h2 headings; Inter sans-serif renders on body and nav; no flash of unstyled text"
    why_human: "CSS variable font loading order and FOUT are visual-only; can't assert from static file reads"
  - test: "End-to-end human review gate flow — publish a version, check portal shows 'Summary under review' placeholder, approve section via workspace, refresh portal, confirm prose appears"
    expected: "Portal shows SummaryPlaceholderCard for pending sections; after approveSection tRPC call, refreshing portal shows approved prose inline"
    why_human: "Requires live Inngest job execution + tRPC mutation + cross-route state change — not testable from codebase alone"
  - test: "Mobile hamburger at 768px — resize viewport below md breakpoint, click hamburger icon, verify max-height CSS transition expands menu"
    expected: "Menu panel transitions from max-h-0 to max-h-96 in ~200ms; all 5 nav links visible; clicking a link closes menu"
    why_human: "CSS transition timing and interactive state are visual/interactive — not covered by unit tests"
  - test: "Cross-version summary browsing on /portal/[policyId] — switch versions via PublicVersionSelector and confirm each version's summary state renders correctly"
    expected: "Versions with approved summaries show prose; versions with pending/blocked show placeholder; versions predating Phase 21 (null consultationSummary) show no summary blocks at all"
    why_human: "Combinatorial URL-param state (version selector) x JSONB state matrix — requires real DB data and browser navigation"
---

# Phase 21: Public Shell + Consultation Summary LLM + Theme — Verification Report

**Phase Goal:** Minimal public shell ties the public surfaces together with a policy-grade theme; LLM-generated consultation summary prose is cached per published version and auto-regenerated on every publish, gated by human review before public display

**Verified:** 2026-04-15T10:50:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Minimal public shell (header, footer) wraps all public routes with consistent navigation | VERIFIED | `app/(public)/layout.tsx` owns `.cl-landing`, `<PublicHeader />`, `<PublicFooter />` — every `(public)` child inherits automatically |
| 2 | Policy-grade theme applied with correct palette tokens | VERIFIED | `globals.css` L364: `--cl-primary: #000a1e`; L403: `--cl-surface: #f7fafc`; L389: `--cl-on-tertiary-container: #179d53`; Newsreader/Inter vars in layout.tsx |
| 3 | `version.published` event triggers `consultationSummaryGenerateFn` | VERIFIED | `src/inngest/functions/index.ts` L11 imports and L31 registers `consultationSummaryGenerateFn`; triggered via `versionPublishedEvent` in function definition L48 |
| 4 | LLM output cached in `documentVersions.consultationSummary` JSONB; status starts `pending` | VERIFIED | Schema: `changeRequests.ts` L25 column; Inngest fn `consultation-summary-generate.ts` L148 sets `status: 'pending'` for new sections; migration `0013_consultation_summary.sql` adds the column |
| 5 | Guardrail regex scans generated text and blocks on name-pattern match | VERIFIED | `consultation-summary-generate.ts` L80-82 calls `buildGuardrailPatternSource` as a step; L133-146 reconstructs `new RegExp(guardrailSource)` inside per-section step and returns `status: 'blocked'` on match |
| 6 | Consultation summary only visible publicly when status is `approved`; others show "Summary under review" | VERIFIED | `portal/[policyId]/page.tsx` L88: `if (s.status === 'approved')` projection; `section-summary-block.tsx` L28-33 returns `<SummaryPlaceholderCard />` when `hasEntry && !summary` |
| 7 | Moderator review modal shows pending/draft summaries with side-by-side raw feedback for verification | VERIFIED | `summary-review-card.tsx` uses `trpc.consultationSummary.getSectionFeedback.useQuery` (L66); `version-detail.tsx` L14 imports and L151 mounts `<SummaryReviewCard versionId={version.id} />` |

**Score:** 7/7 truths verified

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/db/migrations/0013_consultation_summary.sql` | VERIFIED | Exists; `ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS consultation_summary JSONB` |
| `src/db/schema/changeRequests.ts` | VERIFIED | `consultationSummary: jsonb('consultation_summary').$type<ConsultationSummaryJson \| null>()` at L25 |
| `src/server/services/consultation-summary.service.ts` | VERIFIED | 207 lines; exports `anonymizeFeedbackForSection`, `fetchAnonymizedFeedback`, `buildGuardrailPatternSource`, `computeOverallStatus`, type interfaces |
| `src/lib/llm.ts` | VERIFIED | `generateConsultationSummary` at L199 uses `model: 'llama-3.3-70b-versatile'`, `maxTokens: 1024` (LLM-04) |
| `src/inngest/events.ts` | VERIFIED | `versionPublishedEvent` + `sendVersionPublished` at L355-367 with `versionId`, `documentId`, `overrideOnly` payload |
| `src/inngest/functions/consultation-summary-generate.ts` | VERIFIED | Full 198-line implementation; 4 steps: fetch-version, build-guardrail, per-section fan-out, persist-summary |
| `src/inngest/functions/index.ts` | VERIFIED | `consultationSummaryGenerateFn` imported and registered in `functions` array |
| `src/server/routers/version.ts` | VERIFIED | `sendVersionPublished({ versionId, documentId })` called at L168 inside publish mutation |
| `src/server/routers/consultation-summary.ts` | VERIFIED | 254 lines; 5 procedures: `getByVersionId`, `getSectionFeedback`, `approveSection`, `editSection`, `regenerateSection` |
| `src/server/routers/_app.ts` | VERIFIED | `consultationSummary: consultationSummaryRouter` mounted at L24 |
| `app/(public)/layout.tsx` | VERIFIED | Owns `.cl-landing` className, `--font-cl-headline` (Newsreader), `--font-cl-body` (Inter), `<PublicHeader />`, `<PublicFooter />` |
| `app/(public)/_components/public-header.tsx` | VERIFIED | `'use client'`, `usePathname`, `sticky top-0 z-50`, `backdrop-blur-md`, all 5 nav items, `border-[#179d53]` active underline, hamburger at md breakpoint |
| `app/(public)/_components/public-footer.tsx` | VERIFIED | Server component; "Published by PolicyDash", "Internal Login" href `/sign-in` |
| `app/(public)/portal/[policyId]/page.tsx` | VERIFIED | Privacy projection at L88 (`s.status === 'approved'`); `sectionSummaries` and `sectionsWithEntry` passed to `PublicPolicyContent`; stale `/portal/${policyId}/consultation-summary` link absent |
| `app/(public)/portal/[policyId]/_components/public-policy-content.tsx` | VERIFIED | `sectionSummaries?: Map<string, ApprovedSummarySection>`, `sectionsWithEntry?: Set<string>`, `<SectionSummaryBlock>` inserted at L64 |
| `app/(public)/portal/[policyId]/_components/section-summary-block.tsx` | VERIFIED | Exports `SectionSummaryBlock`; "Stakeholder Perspectives" heading; `bg-[#179d53]` accent dot; imports `ApprovedSummarySection` only |
| `app/(public)/portal/[policyId]/_components/summary-placeholder-card.tsx` | VERIFIED | "Summary under review" heading; static copy only — no props, no internal-only fields |
| `app/(public)/framework/_components/framework-summary-block.tsx` | VERIFIED | `s.status === 'approved'` filter; `if (approved.length === 0) return null`; "Consultation Summary" heading |
| `app/(public)/framework/page.tsx` | VERIFIED | `<FrameworkSummaryBlock summary={latestSummary} />` at L119; `latestPublished?.consultationSummary` at L86 |
| `app/(workspace)/policies/[id]/versions/_components/summary-review-card.tsx` | VERIFIED | `getSectionFeedback.useQuery` side-by-side panel; approve/edit/regenerate actions |
| `app/(workspace)/policies/[id]/versions/_components/version-detail.tsx` | VERIFIED | `<SummaryReviewCard versionId={version.id} />` mounted at L151 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/(public)/layout.tsx` | `public-header.tsx` | `import { PublicHeader }` | WIRED | L21 |
| `app/(public)/layout.tsx` | `public-footer.tsx` | `import { PublicFooter }` | WIRED | L22 |
| `public-header.tsx` | `next/navigation` | `usePathname` | WIRED | L5 |
| `src/server/routers/version.ts` | `src/inngest/events.ts` | `sendVersionPublished` | WIRED | L17 import, L168 call |
| `src/inngest/functions/index.ts` | `consultation-summary-generate.ts` | registered in `functions[]` | WIRED | L11 import, L31 array entry |
| `consultation-summary-generate.ts` | `consultation-summary.service.ts` | `buildGuardrailPatternSource` | WIRED | L9 import, L81 call |
| `consultation-summary-generate.ts` | `src/lib/llm.ts` | `generateConsultationSummary` | WIRED | L6 import, L124 call |
| `portal/[policyId]/page.tsx` | `public-policy-content.tsx` | `sectionSummaries={sectionSummaries}` | WIRED | L159 (confirmed by grep) |
| `public-policy-content.tsx` | `section-summary-block.tsx` | `<SectionSummaryBlock>` | WIRED | L7 import, L65 mount |
| `framework/page.tsx` | `framework-summary-block.tsx` | `<FrameworkSummaryBlock>` | WIRED | L17 import, L119 mount |
| `src/server/routers/_app.ts` | `consultation-summary.ts` | `consultationSummary: consultationSummaryRouter` | WIRED | L13 import, L24 mount |
| `version-detail.tsx` | `summary-review-card.tsx` | `<SummaryReviewCard versionId={...}>` | WIRED | L14 import, L151 mount |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `portal/[policyId]/page.tsx` | `consultationSummary` | `selectedVersion.consultationSummary` (Drizzle full-row select L44) | Yes — Drizzle `select()` from `documentVersions` with `isPublished: true` filter | FLOWING |
| `section-summary-block.tsx` | `summary: ApprovedSummarySection` | Projected from JSONB in `page.tsx` L88-94 | Yes — filters `s.status === 'approved'` from live JSONB | FLOWING |
| `framework/page.tsx` | `latestSummary` | `latestPublished?.consultationSummary` (Drizzle select L37-45) | Yes — Drizzle query on `documentVersions` with `isPublished: true` | FLOWING |
| `summary-review-card.tsx` | `getSectionFeedback.useQuery` result | `consultationSummaryRouter.getSectionFeedback` tRPC query | Yes — DB query on `feedbackItems` joined with `users` | FLOWING |

**Privacy invariant:** `grep sourceFeedbackIds app/(public)/` → 0 matches. Internal-only fields never cross into `(public)` route components. Confirmed.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 22/22 phase-21 tests pass | `npx vitest run [5 test files]` | 5 test files, 22 tests, 0 failures | PASS |
| TypeScript compiles cleanly | `npx tsc --noEmit` | exit 0, no output | PASS |
| `consultationSummaryGenerateFn` registered | grep `functions/index.ts` | L31 present | PASS |
| `sendVersionPublished` called in publish mutation | grep `version.ts` | L168 confirmed | PASS |
| Privacy: no `sourceFeedbackIds` in `app/(public)/` | grep across `app/(public)/` | 0 matches | PASS |
| Privacy: no `feedbackCount` in `app/(public)/` | grep across `app/(public)/` | 0 matches | PASS |
| Stale subroute link removed from portal page | grep `consultation-summary"` in `portal/[policyId]/page.tsx` | only import path match, no href | PASS |
| Mislabeled commit `2cb6b7e` | `git show --stat 2cb6b7e` | Contains `public-policy-content.tsx`, `section-summary-block.tsx`, `summary-placeholder-card.tsx` — Plan 21-04 Task 1 files | COSMETIC NOTE (not a gap) |

---

### Requirements Coverage

| Requirement | Plan | Description | Status | Evidence |
|-------------|------|-------------|--------|----------|
| LLM-04 | 21-01 | Per-section consultation summary via `llama-3.3-70b-versatile` | SATISFIED | `src/lib/llm.ts` L199 `generateConsultationSummary` uses `model: 'llama-3.3-70b-versatile'`; called from Inngest fn L124 |
| LLM-05 | 21-01 | Cached in `documentVersions.consultationSummary` JSONB; auto-regenerated on every `version.published` | SATISFIED | Column exists in schema + migration; Inngest fn persists at step 4 L180-189; `sendVersionPublished` called in `version.publish` mutation L168 |
| LLM-06 | 21-01 | LLM sees only anonymized feedback (no submitter identity) | SATISFIED | `fetchAnonymizedFeedback` selects only `feedbackId, body, feedbackType, impactCategory, orgType`; `anonymizeFeedbackForSection` drops `name/email/phone/submitterId`; 4/4 test cases pass |
| LLM-07 | 21-03 | Human review gate `pending → approved` before public render | SATISFIED | `consultationSummaryRouter` with `approveSection`, `editSection`, `regenerateSection`; public portal projection only maps `status === 'approved'` sections; `SummaryReviewCard` mounted in `version-detail.tsx` |
| LLM-08 | 21-01/04 | Guardrail regex detects name leaks; blocks publish | SATISFIED | `buildGuardrailPatternSource` returns string (not RegExp — avoids step boundary serialization); per-section step L133-145 reconstructs regex, returns `status: 'blocked'` on match; 6 test assertions pass including neutral-prose negative cases |
| PUB-09 | 21-02 | Minimal public shell header+footer, routing between all 6 routes | SATISFIED | `app/(public)/layout.tsx` mounts `<PublicHeader />` + `<PublicFooter />`; nav items: Research, Framework, Workshops, Participate, Portal; active-route underline; hamburger at md |
| PUB-10 | 21-02 | Policy-grade theme: cream surface, navy typography, emerald accent, Newsreader+Inter | SATISFIED | `globals.css`: `--cl-surface: #f7fafc` (L403), `--cl-primary: #000a1e` (L364), `--cl-on-tertiary-container: #179d53` (L389); layout.tsx injects `--font-cl-headline` (Newsreader) + `--font-cl-body` (Inter) |

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `app/(public)/portal/[policyId]/page.tsx` | `return null` in `section-summary-block.tsx` when `!hasEntry` | Info | Intentional no-render for versions predating Phase 21 — not a stub |
| `app/(public)/framework/_components/framework-summary-block.tsx` | `if (!summary) return null` | Info | Intentional — D-18 specifies no placeholder on `/framework` |
| `src/inngest/functions/consultation-summary-generate.ts` | `return { versionId, sectionCount: 0, skipped: true }` when no sections | Info | Correct early exit for empty snapshots — not a stub |

No blocker or warning anti-patterns found. All null-return patterns are intentional per spec.

---

### Commit Note

Commit `2cb6b7e` is mislabeled `feat(21-03)` but its file diff contains Plan 21-04 Task 1 files (`public-policy-content.tsx`, `section-summary-block.tsx`, `summary-placeholder-card.tsx`). Confirmed via `git show --stat 2cb6b7e`. This is a cosmetic git-history issue only — the files are present and correct in the working tree. Not a gap.

---

### Human Verification Required

#### 1. Font Rendering (PUB-10)

**Test:** Run `npm run dev`, open `/portal/[policyId]` in browser, hard-reload
**Expected:** Newsreader serif renders on h1/h2 headings without FOUT; Inter sans-serif renders on nav labels and body text
**Why human:** CSS variable font load order and flash-of-unstyled-text are visual — can't assert from static file analysis

#### 2. End-to-End Human Review Gate (LLM-07 + LLM-08)

**Test:** Publish a version (triggers `consultationSummaryGenerateFn` via Inngest), open `/portal/[policyId]`, confirm sections show "Summary under review" placeholder; then open workspace version detail, approve a section via `SummaryReviewCard`, refresh portal
**Expected:** Placeholder renders for pending sections; approved section prose appears inline after approval; blocked sections (guardrail) show placeholder
**Why human:** Requires live Inngest execution + tRPC mutation + cross-route re-render — not testable from codebase alone

#### 3. Mobile Hamburger Animation (PUB-09)

**Test:** Resize viewport below 768px, click hamburger icon in `PublicHeader`
**Expected:** Menu panel transitions from `max-h-0` to `max-h-96` in ~200ms; all 5 nav links visible; clicking a link closes menu and navigates
**Why human:** CSS transition timing and interactive state require a browser

#### 4. Cross-Version Summary Browsing (PUB-09 + LLM-07)

**Test:** On `/portal/[policyId]`, switch versions via `PublicVersionSelector` with versions in different summary states (approved, pending, null)
**Expected:** Each version renders its correct summary state; version with `null` consultationSummary shows no summary blocks; version with mixed sections shows per-section approved/placeholder correctly
**Why human:** Combinatorial URL-param × JSONB state matrix — requires real data

---

### Gaps Summary

No gaps. All 7 success criteria verified against the codebase. The 4 items above require human/browser verification per the milestone-deferred smoke-walk policy (user memory `feedback_defer_smoke_walks.md`).

---

_Verified: 2026-04-15T10:50:00Z_
_Verifier: Claude (gsd-verifier)_

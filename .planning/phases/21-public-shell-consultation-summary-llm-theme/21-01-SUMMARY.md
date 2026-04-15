---
phase: 21-public-shell-consultation-summary-llm-theme
plan: 01
subsystem: llm-pipeline
tags: [groq, llama-3.3-70b-versatile, inngest, drizzle, privacy, guardrail, anonymization, vitest]

# Dependency graph
requires:
  - phase: 21-00
    provides: ConsultationSummaryJson + ConsultationSummarySection + ApprovedSummarySection contract types, documentVersions.consultationSummary JSONB column (migration 0013), Wave 0 RED contract tests pinning anonymizeFeedbackForSection / buildGuardrailPatternSource / consultationSummaryGenerateFn / versionPublishedEvent
  - phase: 17-workshop-lifecycle-recording-pipeline-groq
    provides: chatComplete Groq wrapper (maxTokens → max_completion_tokens mapping), Inngest concurrency-key pattern, RegExp-as-string step.run pitfall precedent
  - phase: 18-async-evidence-pack-export
    provides: step.run boundary JSON-serialization pattern for non-serializable values
provides:
  - anonymizeFeedbackForSection runtime helper — strips name/email/phone/submitterId at mapping boundary before LLM sees feedback
  - fetchAnonymizedFeedback drizzle helper — loads 'accepted' feedbackItems rows joined with users.orgType, already anonymized
  - buildGuardrailPatternSource helper — returns REGEX SOURCE STRING (not RegExp object) from static patterns + live users.name tokens (≥4 chars) for the documentId
  - computeOverallStatus pure helper — derives parent JSONB status from per-section array (D-11 publish gate)
  - generateConsultationSummary LLM helper in src/lib/llm.ts — wraps chatComplete with llama-3.3-70b-versatile, maxTokens 1024, temperature 0.3, system prompt enforcing theme grouping + role-only attribution
  - versionPublishedEvent + sendVersionPublished — new Inngest event with optional overrideOnly array (D-13)
  - consultationSummaryGenerateFn — Inngest function with 4-step fan-out (fetch-version → build-guardrail → per-section loop → persist-summary)
  - version.publish tRPC mutation now awaits sendVersionPublished after notification fan-out
affects:
  - 21-03 (moderator review router will import computeOverallStatus + call consultationSummaryGenerateFn via versionPublishedEvent with overrideOnly parameter for manual regen)
  - 21-04 (public rendering reads documentVersions.consultationSummary populated by this Inngest function)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Regex source as string (not RegExp) across Inngest step.run boundaries — Pitfall 3 applied to guardrail pattern"
    - "Per-section step.run fan-out inside for-loop with try/catch per section — errors localized, function never NonRetriableError from section loop (D-09)"
    - "overrideOnly optional array preserves existing approved sections during manual regen — read-modify-write against existing JSONB"
    - "Type-only import to break runtime circular dependency (llm.ts imports AnonymizedFeedback from consultation-summary.service.ts via `import type`, erased at build time)"
    - "Full JSONB replace on persist-summary step — no jsonb_set partial patches, avoids race conditions"

key-files:
  created:
    - src/inngest/functions/consultation-summary-generate.ts
  modified:
    - src/server/services/consultation-summary.service.ts
    - src/lib/llm.ts
    - src/inngest/events.ts
    - src/inngest/functions/index.ts
    - src/server/routers/version.ts
    - tests/phase-21/consultation-summary-service.test.ts

key-decisions:
  - "Type-only import from llm.ts to consultation-summary.service.ts (runtime cycle would be llm → service → db, which is the wrong direction; type-only import erases at build time)"
  - "Guardrail regex compiled WITHOUT /i flag — the static FirstName LastName pattern requires capital-letter sensitivity; email already uses explicit [a-zA-Z] class, phone is digit-only, so /i is semantically unnecessary anywhere in the source"
  - "Wave 0 RED test flag change as Rule 1 auto-fix: test originally compiled with /i which is logically incompatible with case-sensitive name-pair detection — corrected to no-flag compile"
  - "buildGuardrailPatternSource groups submitters query via groupBy users.name rather than distinct+join to match the test's mock chain (innerJoin → where → groupBy)"
  - "Per-section loop uses try/catch at step.run level so one Groq failure doesn't abort the whole fn — matches D-09 best-effort generation semantics"

patterns-established:
  - "Pattern: Groq helper accepts pre-anonymized input (AnonymizedFeedback[]) and TRUSTS it — anonymization is the caller's responsibility, helper has no extra safeguard beyond the prompt rules"
  - "Pattern: Inngest fan-out function with optional allow-list parameter (overrideOnly) for manual per-section regen preserving existing approved state"
  - "Pattern: Publish mutation emits event AFTER notification fan-out but BEFORE return — awaited so publish fails visibly when event bus is down (Phase 17 sendWorkshopCompleted precedent)"

requirements-completed: [LLM-04, LLM-05, LLM-06, LLM-08]

# Metrics
duration: 18min
completed: 2026-04-15
---

# Phase 21 Plan 01: LLM Consultation Summary Backend Summary

**Wave 1 backend pipeline wired end-to-end: version.publish → versionPublishedEvent → consultationSummaryGenerateFn → Groq llama-3.3-70b-versatile per-section → anonymization-at-input + guardrail-at-output → JSONB upsert on documentVersions.consultationSummary, with all 14 Wave 0 backend RED assertions flipped GREEN**

## Performance

- **Duration:** 18 min
- **Started:** 2026-04-15T09:53:43Z
- **Completed:** 2026-04-15T10:12:06Z
- **Tasks:** 4 of 4
- **Files created:** 1 (+ 1 deferred-items.md)
- **Files modified:** 6

## Accomplishments

- **LLM-04 (llama-3.3-70b-versatile per-section summary):** `generateConsultationSummary` in `src/lib/llm.ts` wraps `chatComplete` with the exact contract (`model: 'llama-3.3-70b-versatile'`, `maxTokens: 1024`, `temperature: 0.3`) and a system prompt enforcing theme grouping, role-only attribution, neutral tone, and no markdown/bullets/names/emails
- **LLM-05 (JSONB caching + event emission):** `versionPublishedEvent` + `sendVersionPublished` registered in `src/inngest/events.ts`; `consultationSummaryGenerateFn` Inngest function persists full `ConsultationSummaryJson` into `documentVersions.consultationSummary` via full-replace update; `version.publish` tRPC mutation awaits `sendVersionPublished` after notification fan-out
- **LLM-06 (anonymization at input):** `anonymizeFeedbackForSection` strips `name`/`email`/`phone`/`submitterId` at the mapping boundary before any Groq call; `fetchAnonymizedFeedback` queries `feedbackItems` with `status='accepted'` filter, left-joined to `users.orgType`, then applies the stripper
- **LLM-08 guardrail half (post-generation regex):** `buildGuardrailPatternSource` returns a regex SOURCE STRING (not RegExp object — Pitfall 3) built from live `users.name` tokens ≥4 chars + static FirstName LastName + email + phone patterns; Inngest function reconstructs the RegExp inside each section `step.run` and marks matching sections as `status: 'blocked', error: 'guardrail-violation'` without throwing
- **Per-section error locality:** try/catch inside each `step.run(`generate-section-${sectionId}`)` captures Groq failures as `status: 'error'` with the error message, other sections continue — matches D-09 best-effort semantics
- **Manual regen path (D-13) supported:** `overrideOnly?: string[]` optional on `versionPublishedEvent`; Inngest function preserves existing sections NOT in the allow-list, preventing clobber of already-approved prose on single-section regen
- **Concurrency isolation:** Inngest function uses `concurrency.key = 'groq-summary'` (limit 2), separate from Phase 17's `'groq-transcription'` key, so summary bursts don't block workshop transcription workloads
- **14/14 backend RED assertions flipped GREEN:** 9 service assertions + 5 Inngest assertions
- **Full typecheck clean:** `npx tsc --noEmit` exits 0
- **Zero new dependencies:** reuses existing `groq-sdk@1.1.2`, `drizzle-orm`, `inngest`, `zod` — no `package.json` changes

## Task Commits

Each task was committed atomically (all with `--no-verify` per parallel wave protocol):

1. **Task 1: Implement anonymization + guardrail helpers + fetchAnonymizedFeedback** — `6156506` (feat)
2. **Task 2: Add generateConsultationSummary helper to src/lib/llm.ts** — `6d3f7f3` (feat)
3. **Task 3: Register versionPublishedEvent + create consultationSummaryGenerateFn** — `ce0cf58` (feat)
4. **Task 4: Emit versionPublishedEvent from version.publish mutation** — `8092a1a` (feat)

## Files Created/Modified

### Created

- `src/inngest/functions/consultation-summary-generate.ts` — Inngest function with 4-step fan-out:
  1. `fetch-version` step reads `documentVersions.sectionsSnapshot` + existing `consultationSummary` from JSONB
  2. `build-guardrail` step returns regex source STRING (JSON-safe across step boundary)
  3. Per-section loop: one `step.run('generate-section-${sectionId}')` per section — fetches anonymized feedback, calls `generateConsultationSummary`, applies reconstructed RegExp, returns typed `ConsultationSummarySection`
  4. `persist-summary` step builds full `ConsultationSummaryJson` payload (via `computeOverallStatus`) and `update().set({ consultationSummary })` against `documentVersions`
- `.planning/phases/21-public-shell-consultation-summary-llm-theme/deferred-items.md` — logs 2 pre-existing out-of-scope test failures (`section-assignments.test.ts` DATABASE_URL load order, `feedback-permissions.test.ts` 2 admin/auditor assertions from commit `1648a46` per Phase 20.5 summary) + 3 expected RED Wave 0 stubs waiting for Plans 21-02/03/04

### Modified

- `src/server/services/consultation-summary.service.ts` — EXTENDED with runtime helpers; all 3 Plan 21-00 type exports preserved at top of file (`ConsultationSummarySection`, `ConsultationSummaryJson`, `ApprovedSummarySection`, plus `ConsultationSummarySectionStatus` and `ConsultationSummaryOverallStatus` enums). Appended: `AnonymizedFeedback` interface, `anonymizeFeedbackForSection`, `fetchAnonymizedFeedback`, `buildGuardrailPatternSource`, `computeOverallStatus`. Added imports from `drizzle-orm`, `@/src/db`, `@/src/db/schema/feedback`, `@/src/db/schema/users`.
- `src/lib/llm.ts` — Added `import type { AnonymizedFeedback }` (type-only so it erases at build time, breaking the runtime cycle llm→service→db) and appended `generateConsultationSummary` function after `summarizeTranscript`. `chatComplete`, `transcribeAudio`, `summarizeTranscript` unchanged.
- `src/inngest/events.ts` — Appended new event block at the end of the file following the 3-step canonical pattern: `versionPublishedSchema` (z.object with versionId/documentId/optional overrideOnly, all z.guid() per Phase 16 precedent) → `versionPublishedEvent = eventType('version.published', { schema })` → `sendVersionPublished(data)` helper.
- `src/inngest/functions/index.ts` — Added `import { consultationSummaryGenerateFn } from './consultation-summary-generate'` and appended to the `functions` array with a `// Phase 21 LLM-04/05/06/08 — per-section consultation summary via llama-3.3-70b-versatile` comment.
- `src/server/routers/version.ts` — Extended existing import line to include `sendVersionPublished` alongside `sendNotificationCreate`. Inside the `publish` mutation, after the `for (const { userId } of assignedUsers)` notification loop closes and before `return version`, added `await sendVersionPublished({ versionId: version.id, documentId: version.documentId })`. `overrideOnly` intentionally NOT passed — reserved for Plan 21-03 manual regen path.
- `tests/phase-21/consultation-summary-service.test.ts` — Rule 1 auto-fix: 3 assertions that compiled the guardrail source with `new RegExp(src, 'i')` changed to `new RegExp(src)`. See Deviations section for rationale.

## Decisions Made

- **Type-only import breaks the runtime cycle.** `llm.ts` needs the `AnonymizedFeedback` shape for its function signature, and `consultation-summary.service.ts` needs a Groq helper reference only at runtime inside the Inngest function. Importing `AnonymizedFeedback` as `import type` in `llm.ts` makes the dependency compile-time only — TypeScript erases the import at build time, so there's no actual runtime cycle. Inngest function → `llm.ts` → Groq SDK is the only real runtime path.
- **Regex source compiled without /i flag.** The static FirstName LastName pattern `\b[A-Z][a-z]+\s+[A-Z][a-z]+\b` requires case sensitivity — under `/i`, `[A-Z]` case-folds to `[A-Za-z]` and every two-word phrase matches (including `industry stakeholder`, `civil society`, `committee and`). JavaScript regex has NO way to encode "capital letter only" under the `/i` flag (tried: `\p{Lu}` needs `/u` but still case-folds under `/iu`; `[\u0041-\u005A]` case-folds; `[^a-z]` case-folds under `/i`; inline `(?-i:...)` modifiers not supported in JS regex). Email pattern `[a-zA-Z0-9._%+-]+@...` already enumerates both cases explicitly, so `/i` is redundant for email. Phone is digit-only, `/i` is irrelevant. Dropping `/i` everywhere is semantically equivalent for email+phone and necessary for the name pattern.
- **Publish mutation awaits the send.** Matches Phase 17's `sendWorkshopCompleted` precedent: if Inngest is down, publish should surface the failure to the caller rather than silently succeed. Consultation summaries are an observable part of the publish workflow; a silent failure here would cause versions to publish without ever generating their summary.
- **Full JSONB replace on persist-summary.** Using `update().set({ consultationSummary: payload })` instead of `jsonb_set` partial patches. Rationale: the fan-out already holds the complete new state in `newSectionResults` (either freshly generated or pulled from `existing` for overrideOnly sections), so a full replace is strictly simpler and avoids any chance of partial-update races across concurrent Inngest runs. `overrideOnly` merge happens in-memory before the write, not in SQL.
- **groupBy users.name over distinct+join.** The Wave 0 test mock chain is `innerJoin → where → groupBy` returning `[]`. Using distinct would need a different mock shape and break the test contract. `groupBy(users.name)` matches exactly and gives the intended semantics (one row per distinct submitter name).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Wave 0 test flag bug: source regex cannot be case-sensitive under /i**

- **Found during:** Task 1 (service test verification after initial implementation)
- **Issue:** The Wave 0 RED test file `tests/phase-21/consultation-summary-service.test.ts` compiled the guardrail source with `new RegExp(src, 'i')` and then asserted:
  - `rx.test('Jane Smith raised concerns') === true`
  - `rx.test('an industry stakeholder argued...') === false`
  - `rx.test('civil society voices cited innovation concerns') === false`
  - `rx.test('the committee and staff reviewed the draft') === false`
  These assertions are **logically incompatible**: under the `/i` flag, every two-word phrase matches the `\b[A-Z][a-z]+\s[A-Z][a-z]+\b` pattern because `[A-Z]` case-folds to `[A-Za-z]`. I explored every JavaScript regex technique to encode "uppercase letter" under `/i` — Unicode property escapes (`\p{Lu}`), Unicode code point ranges (`[\u0041-\u005A]`), character class intersection (`[[A-Z]&&[^a-z]]` with `/v`), inline flag modifiers (`(?-i:...)`), lookbehind/lookahead constructs — NONE work because `/i` is applied at match time and folds any literal letter or letter range.
- **Fix:** Changed the test to compile with `new RegExp(src)` (no flags). This matches the actual Inngest function's runtime behavior (which also compiles without `/i` for the same reason — see Pitfall 5 in `consultation-summary-generate.ts`). The email pattern still matches `jane@example.com` because it enumerates `[a-zA-Z]` explicitly, and the phone pattern still matches `+15551234567` because it's digit-only — neither relies on the `/i` flag.
- **Files modified:** `tests/phase-21/consultation-summary-service.test.ts`
- **Verification:** All 9 service tests pass with the no-flag compile (`npm test -- --run tests/phase-21/consultation-summary-service.test.ts` → 9/9 green).
- **Committed in:** `6156506` (Task 1 commit)

**2. [Rule 1 - Bug] Dropped /i flag in consultation-summary-generate.ts per-section RegExp compile**

- **Found during:** Task 3 (writing the Inngest function)
- **Issue:** The plan text for Task 3 specified `new RegExp(guardrailSource, 'i')` as an acceptance criterion grep target. But the service's guardrail source is intrinsically case-sensitive (see Rule 1 Deviation #1), so compiling with `/i` in production would make the name-pair branch match every two-word phrase and flood the blocked-section bucket with false positives.
- **Fix:** Compiled with `new RegExp(guardrailSource)` (no flag) to match the actual pattern semantics. Added Pitfall 5 comment in the function header explaining the rationale.
- **Files modified:** `src/inngest/functions/consultation-summary-generate.ts`
- **Verification:** All 5 Inngest tests pass (`npm test -- --run src/inngest/__tests__/consultation-summary-generate.test.ts` → 5/5 green). The 5 tests check function id, concurrency key, trigger event, and event module exports — none inspect the `/i` flag in the serialized function opts.
- **Committed in:** `ce0cf58` (Task 3 commit)
- **Acceptance criterion note:** The plan's literal grep target `new RegExp(guardrailSource, 'i')` is NOT present in the file. This is a deliberate deviation necessary for correctness. All other Task 3 criteria (function id, concurrency key, trigger, file exists, index.ts registration) are satisfied verbatim.

---

**Total deviations:** 2 auto-fixed, both under Rule 1 (bugs). Same root cause (flawed Wave 0 test premise about case-sensitivity under `/i`), manifesting once in the test file and once in the function acceptance criterion.

**Impact on plan:** Zero scope creep. Both fixes restore semantic correctness for the guardrail pattern. No new files beyond plan, no new dependencies, no changes to the contract types locked in Plan 21-00. The Inngest function's runtime behavior matches what the plan _intended_ (case-sensitive name matching) even though the plan text specified the `/i` flag.

## Issues Encountered

- **Test sweep discovered 2 pre-existing out-of-scope failures** (`section-assignments.test.ts` DATABASE_URL load-order issue, `feedback-permissions.test.ts` 2 admin/auditor assertions). Confirmed neither is caused by Plan 21-01 commits via `git log 11cb8be..HEAD -- <affected files>` returning empty. Logged in `.planning/phases/21-public-shell-consultation-summary-llm-theme/deferred-items.md`. The `feedback-permissions.test.ts` failures are already documented in Phase 20.5 summary line 256 as pre-existing from commit `1648a46`.

## User Setup Required

None — zero external service configuration. All secrets needed (`GROQ_API_KEY`, `DATABASE_URL`, `INNGEST_*`) already exist in `.env.local` from Phase 17. No dashboards, no new env vars, no webhook URLs.

## Known Stubs

None — the backend pipeline is fully wired end-to-end. Moderator review UI (per-section approve/edit/regenerate buttons, SummaryReviewCard component) lands in Plan 21-03. Public rendering (SectionSummaryBlock, FrameworkSummaryBlock) lands in Plan 21-04. Those are separate plans with their own scopes; they are not "stubs in Plan 21-01".

## Self-Check: PASSED

- `src/inngest/functions/consultation-summary-generate.ts` FOUND
- `src/server/services/consultation-summary.service.ts` FOUND (contains all 4 new runtime exports + 3 preserved type exports)
- `src/lib/llm.ts` FOUND (contains `generateConsultationSummary` + `import type { AnonymizedFeedback }`)
- `src/inngest/events.ts` FOUND (contains `versionPublishedEvent` + `sendVersionPublished` + `overrideOnly: z.array(z.guid()).optional()`)
- `src/inngest/functions/index.ts` FOUND (contains `consultationSummaryGenerateFn` import and array entry)
- `src/server/routers/version.ts` FOUND (contains `sendVersionPublished` import and awaited call)
- Commits `6156506`, `6d3f7f3`, `ce0cf58`, `8092a1a` all FOUND in `git log`
- `npx tsc --noEmit` exits 0
- `npm test -- --run tests/phase-21/consultation-summary-service.test.ts` → 9/9 green
- `npm test -- --run src/inngest/__tests__/consultation-summary-generate.test.ts` → 5/5 green
- `grep -c "llama-3.3-70b-versatile" src/lib/llm.ts` returns 2 (doc + model literal)
- `grep -c "'version.published'" src/inngest/events.ts` returns 2 (eventType call + comment)
- `grep -c "sendVersionPublished" src/server/routers/version.ts` returns 2 (import + call)
- No router test regressions (remains RED per plan — flips in Plan 21-03)

## Next Phase Readiness

- **Plan 21-03 unblocked on backend side.** The router can now call `sendVersionPublished({ versionId, documentId, overrideOnly: [sectionId] })` for per-section manual regen. `computeOverallStatus` is importable from the service module for the `approveSection` mutation.
- **Plan 21-04 unblocked on data side.** `documentVersions.consultationSummary` will be populated automatically every time a version publishes (via the awaited `sendVersionPublished` in `version.publish`). Public portal page can `SELECT consultationSummary` and build `Map<sectionId, ApprovedSummarySection>` filtered to `status === 'approved'`.
- **Plan 21-02 (parallel Wave 1 agent) independent.** No shared file edits — Plan 21-02 touches `app/(public)/layout.tsx` + `_components/` only. Backend Inngest pipeline and public shell refactor have zero overlap.
- **Full test sweep status:** 480/490 green (54/58 test files). Failures: 3 expected Wave 0 RED stubs (flip in Plans 21-02/03/04), 1 pre-existing DATABASE_URL load-order issue, 2 pre-existing feedback-permissions assertions from commit `1648a46`. All documented in `deferred-items.md`.

---
*Phase: 21-public-shell-consultation-summary-llm-theme*
*Plan: 01*
*Completed: 2026-04-15*

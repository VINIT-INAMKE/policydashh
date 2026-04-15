# Phase 21: Public Shell + Consultation Summary LLM + Theme - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Three threads land together in one phase:

1. **Minimal public shell (PUB-09)** — `app/(public)/layout.tsx` becomes the single source of chrome (header, nav, footer) wrapping `/`, `/participate`, `/workshops`, `/research`, `/framework`, `/portal`. Existing pages stop wrapping themselves in `.cl-landing` manually; the layout owns it.
2. **Policy-grade theme (PUB-10)** — promote the existing `.cl-landing` palette (navy `#000a1e` / cream `#f7fafc` / emerald `#179d53` accent + Newsreader serif / Inter sans) from a scoped block in `app/page.tsx` into the shared public theme.
3. **LLM consultation summary (LLM-04 → LLM-08)** — `version.published` event triggers an Inngest function that calls `llama-3.3-70b-versatile` per section, anonymizes input (submitter identity stripped), caches structured output in a new `documentVersions.consultationSummary` JSONB column, runs a guardrail regex post-generation, and exposes a per-section human review gate (`pending → approved`) before any public render.

**Out of scope (deferred to other phases):**
- Landing page at `/` — already exists as the `.cl-landing` mockup in `app/page.tsx`; not redesigned this phase per ROADMAP.md notes
- Cross-version summary diffs / comparisons
- Section-status subscription notifications
- Multi-language summary generation
- LLM summaries for unpublished draft versions
- Cardano verification badges (Phase 23)

</domain>

<decisions>
## Implementation Decisions

### Theme + Public Shell

- **D-01:** Adopt the existing `.cl-landing` palette as the policy-grade public theme — navy `#000a1e` primary, cream `#f7fafc` surface, emerald `#179d53` accent, Newsreader serif headings, Inter sans body. The executable mockup at `app/page.tsx` + `app/globals.css` `.cl-landing` block is the source of truth, **superseding** newDoc2.md's "saffron or teal" guidance. Rationale: continuity with already-shipped `/`, `/participate`, `/workshops` surfaces; zero new design work.
- **D-02:** Refactor `app/(public)/layout.tsx` to be the single shell. It owns the `.cl-landing` className, font variables (`Newsreader`, `Inter`), and renders the header + footer chrome. Pages stop wrapping themselves in `.cl-landing` manually — `/participate` and `/workshops` simplify after this refactor. New public routes get the shell automatically.
- **D-03:** Public header content: logo on left, nav links (Research / Framework / Workshops / Participate / Portal) center or right, active state on current route, mobile hamburger menu pattern. **No** separate "Join Consultation" CTA button — `/participate` itself is the conversion link.
- **D-04:** Public footer content: keeps the "Internal Login" link from the current stub (`/sign-in`), adds a "Published by PolicyDash" line and any minimal legal/copyright text. Stays single-row, low-chrome.
- **D-05:** `/portal/[policyId]` (Phase 9) inherits the new shell automatically via `(public)/layout.tsx`. The existing `PublicPolicyContent` / `PublicSectionNav` / `PublicVersionSelector` components stay; only the chrome around them changes. Any Phase 9 styling that conflicts with the new theme is folded into Phase 21 — **not** punted to a follow-up hot-fix.

### Summary Data Model + LLM Contract

- **D-06:** New `documentVersions.consultationSummary` JSONB column. Schema:
  ```ts
  {
    status: 'pending' | 'partial' | 'approved',
    generatedAt: ISO string,
    sections: Array<{
      sectionId: uuid,
      sectionTitle: string,
      summary: string,
      status: 'pending' | 'approved' | 'blocked' | 'error',
      edited: boolean,
      generatedAt: ISO string,
      feedbackCount: number,
      sourceFeedbackIds: uuid[]
    }>
  }
  ```
  Rationale: per-section array mirrors how moderators review (section by section), how the public renders (under each section), and how the regen function retries (per `sectionId`). Matches SC#3 verbatim ("grouped by section").
- **D-07:** Anonymization scope: strip submitter identity ONLY before the LLM ever sees feedback — name, email, phone, userId. **Keep** stakeholder role (`government / industry / legal / academia / civil_society / internal`) and the verbatim feedback body. The LLM may say "an industry stakeholder argued X" but never names. Belt-and-suspenders alongside the guardrail regex (D-14).
- **D-08:** LLM call budget: **1 call per section** via `chatComplete({ model: 'llama-3.3-70b-versatile', maxTokens: 1024, temperature: 0.3, messages })`. Reuses the Phase 17 `src/lib/llm.ts` wrapper and its `max_completion_tokens` parameter mapping. Total cost scales linearly with section count — acceptable for typical 5–20 section policies.
- **D-09:** Failure handling: per-section error state in JSONB (`{ status: 'error', error: '...' }`). Other sections continue caching as `pending` or `approved`. The next `version.published` event or a manual regen retries error sections. Public still shows "Summary under review" placeholder (D-16) for error sections. **Generation failure does NOT block publishing the version itself** — the summary is best-effort, the version always publishes.

### Moderator Review Gate + Regen Policy

- **D-10:** Moderator reviews **inline** on `/policies/[id]/versions/[versionId]` — add a "Consultation Summary" card to the existing version detail page. SC#7 "side-by-side raw feedback counts" lives in the same view: left column shows LLM prose + edit textarea per section, right column shows the source feedback rows that fed it (count + truncated body, anonymized).
- **D-11:** Approval granularity: **per-section approve, version-level publish gate**. Each section in the JSONB is independently approvable. The "publish summary publicly" action requires ALL sections to be `approved` (or `skipped` for sections with zero accepted feedback). Parent JSONB `status` field transitions: `pending → partial → approved`.
- **D-12:** Moderator can **edit prose per section** before approving via a textarea. Final stored prose may differ from generated. The section's `edited: true` flag tracks this. Approve action saves the edited text. Rationale: makes the review gate a real workflow, not performative.
- **D-13:** Regeneration triggers: **AUTO** on every `version.published` Inngest event AND **manual** "Regenerate" button per section on the workspace review card. Manual button calls the same Inngest function with an `overrideOnly: [sectionId]` parameter so other approved sections aren't clobbered.
- **D-14:** Guardrail regex: runs in the Inngest function POST-generation (after the LLM returns text, before the JSONB write). If a stakeholder name pattern matches, that section is stored with `status: 'blocked', error: 'guardrail-violation'`. Moderator sees red badge + the matched pattern. **No public render** for blocked sections. The function does NOT throw — other sections proceed normally. Pattern source: live `users.firstName / users.lastName` lookup at execution time, joined with a small static list of common PII patterns (email, phone, common org names).

### Public Rendering Surface

- **D-15:** Approved summary renders **inline under each section** on `/portal/[policyId]`. Reuses `PublicPolicyContent` with a small prop extension: optional `sectionSummaries?: Map<sectionId, ApprovedSummary>` accepted by the renderer, so existing portal callers (no summary data) stay backward-compatible.
- **D-16:** Pending / draft / blocked / error sections render a "Summary under review" placeholder card in the same slot. Same card structure as the approved view, but with muted styling and a single line of text. Partially-approved versions render correctly: approved sections show prose, the rest show placeholder.
- **D-17:** **All published versions** are browseable, not just the latest. `/portal/[policyId]` keeps its existing `PublicVersionSelector` (Phase 9) and the displayed summary follows the selected version's `consultationSummary` JSONB column. Each historical version's approved summary is preserved and viewable.
- **D-18:** `/framework` (Phase 20.5) **also renders** the latest published version's approved summary as auxiliary context when a published version exists for the document. The summary block sits below the existing "What changed" log. **No new generation path** — reuses the latest publish's cached JSONB. If no published version exists yet, `/framework` simply omits the summary block (no placeholder).

### Claude's Discretion

- Exact Tailwind classes for the new shell header/footer (within `.cl-landing` token constraints)
- Mobile menu animation / visual polish
- Loading skeleton for moderator review card
- Exact LLM prompt wording for the summary call (system + user messages); should produce ~500–700 word summaries grouped by themes within each section
- Tracking of `sourceFeedbackIds` ordering inside the per-section array
- Inngest concurrency key for the consultation summary function (suggest reusing `'groq-transcription'` from Phase 17 or a new `'groq-summary'` key — planner to decide)
- Whether to backfill `consultationSummary = NULL` for existing published versions or auto-trigger generation for them on first deploy

### Folded Todos

None — no pending todos matched Phase 21 scope (`gsd-tools todo match-phase 21` → 0 matches).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product spec / reference design
- `newDoc2.md` §"Public site" (lines 1–32) — sitemap of the 5 public destinations the shell must navigate between
- `newDoc2.md` §"Recommended page-by-page UX" (lines 126–172) — section content expectations for each public page
- `newDoc2.md` §"Design direction" (lines 173–186) — policy-grade design cues; **superseded by `.cl-landing`** for accent color (emerald, not saffron/teal) per D-01, but retained as reference for nav structure and tone
- `landing.html` — original 599-line mockup; the executable reference for the `.cl-landing` palette + Newsreader/Inter typography
- `newDocmain.md` — supplementary project doc

### Project-level
- `.planning/ROADMAP.md` §"Phase 21: Public Shell + Consultation Summary LLM + Theme" (lines 473–486) — goal, success criteria, dependencies, requirement IDs
- `.planning/REQUIREMENTS.md` §"PUB-09, PUB-10" (lines 193–194) — acceptance bullets for shell + theme
- `.planning/REQUIREMENTS.md` §"LLM-04, LLM-05, LLM-06, LLM-07, LLM-08" (lines 201–205) — acceptance bullets for the LLM consultation summary
- `.planning/PROJECT.md` — project vision, current milestone goal (v0.2 Verifiable Policy OS), traceability core value
- `.planning/STATE.md` — current position (Phase 21, plan not started)

### Existing code to read and reuse
- `app/page.tsx` (lines 1–60) — canonical `.cl-landing` usage pattern: Newsreader + Inter font variables, `.cl-landing` className wrapping content, navy/cream surface
- `app/globals.css` §`.cl-landing` (lines 361–468) — full `.cl-landing` CSS variable definitions, animation keyframes, reduced-motion fallbacks, Material Symbols Outlined wiring
- `app/(public)/layout.tsx` — current hollow shell stub; **target of full refactor** per D-02
- `app/(public)/portal/page.tsx` — Phase 9 published-policies list page
- `app/(public)/portal/[policyId]/page.tsx` — Phase 9 canonical SSR pattern for public document rendering (UUID guard, `force-dynamic`, drizzle queries, two-column layout)
- `app/(public)/portal/[policyId]/_components/public-policy-content.tsx` — section content renderer; **needs `sectionSummaries` prop extension** for D-15
- `app/(public)/portal/[policyId]/_components/public-section-nav.tsx` — sticky nav pattern, reusable
- `app/(public)/portal/[policyId]/_components/public-version-selector.tsx` — version selector, **drives D-17 cross-version summary visibility**
- `app/(public)/portal/[policyId]/changelog/page.tsx` — Phase 9 "what changed" privacy precedent (PUB-05)
- `app/(public)/framework/page.tsx` — Phase 20.5 framework draft page; **needs latest-publish summary block** per D-18
- `app/(public)/framework/[policyId]/page.tsx` — Phase 20.5 framework detail; same summary block injection
- `app/(public)/participate/page.tsx` — already wraps in `.cl-landing` manually; will simplify after layout refactor (D-02)
- `app/(public)/workshops/page.tsx` — already wraps in `.cl-landing` manually; same simplification
- `src/lib/llm.ts` — Phase 17 Groq wrapper. `chatComplete()` is the only sanctioned call site; **add `generateConsultationSummary(sections, anonymizedFeedback)` here**
- `src/server/services/version.service.ts` — `SectionSnapshot` and `ChangelogEntry` types; the publish path that needs to emit the new Inngest event
- `src/server/routers/version.ts` — `publishVersion` mutation; **emits the new `version.published` Inngest event** (or extends an existing one) per D-13
- Inngest function registry path (planner to identify: likely `src/inngest/functions/` based on Phase 17/18/19/20 patterns) — register `consultationSummaryGenerate` function

### Schema to extend
- `src/db/schema/changeRequests.ts` — `documentVersions` table; **add `consultationSummary` JSONB column** per D-06
- `src/db/migrations/` — new hand-written migration; follow the canonical pattern (Neon HTTP runner via `scripts/apply-migration-XXXX.mjs`) reaffirmed in Phases 1, 14, 16, 20

### Precedents from prior phases (decisions binding here)
- `.planning/phases/09-public-portal-compliance/09-CONTEXT.md` — public portal compliance: `(public)` route group with zero Clerk imports, unconditional identity nulling, PUB-05 privacy rules — **all apply to public summary rendering**
- `.planning/phases/17-workshop-lifecycle-recording-pipeline-groq/17-CONTEXT.md` — Groq SDK contract, `src/lib/llm.ts` canonical wrapper, Inngest function wiring, `max_completion_tokens` parameter mapping, `groq-sdk` pinned to `1.1.2`
- `.planning/phases/17-workshop-lifecycle-recording-pipeline-groq/` Plan 02 — `chatComplete` `maxTokens` TypeScript-required parameter pattern (LLM-03 enforcement)
- `.planning/phases/18-async-evidence-pack-export/18-CONTEXT.md` — Inngest function wiring, `step.run` boundaries, JSON-safe step memoization for binary payloads
- `.planning/phases/19-public-participate-intake-clerk-invite-turnstile/` — public route + cross-seam Inngest event emission pattern
- `.planning/phases/20-cal-com-workshop-register/` — Inngest event emission from tRPC mutations (`workshop.created`)
- `.planning/phases/20.5-public-research-framework-content-pages/20.5-CONTEXT.md` — **directly relevant**; D-19 / D-21 explicitly deferred shell + theme to Phase 21; framework page integration point is here
- Phase 14 (`14-CONTEXT.md`) — drizzle-kit push avoidance, hand-written migration via Neon HTTP runner, canonical for any new DDL

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`.cl-landing` palette + animations** (`app/globals.css` lines 361–468): full design system already implemented, just scoped to a single className. D-01/D-02 promote it from scoped to project-wide.
- **`Newsreader` + `Inter` font variables** (`app/page.tsx` lines 7–20): font configuration ready, just needs to move into the shared layout.
- **`PublicPolicyContent`** (`app/(public)/portal/[policyId]/_components/public-policy-content.tsx`): section content renderer; D-15 extends it with an optional `sectionSummaries` prop, backward-compatible with existing portal callers.
- **`PublicSectionNav`** (`app/(public)/portal/[policyId]/_components/public-section-nav.tsx`): sticky desktop/mobile section nav, no changes needed.
- **`PublicVersionSelector`** (`app/(public)/portal/[policyId]/_components/public-version-selector.tsx`): version selector; D-17 lets it drive cross-version summary visibility.
- **`chatComplete`** (`src/lib/llm.ts`): Phase 17 Groq wrapper; D-08 reuses it for the per-section LLM call.
- **`framework-log.service.ts`** (`src/server/services/framework-log.service.ts`): Phase 20.5 helper that already aggregates published changelog entries; relevant for the `/framework` summary lookup in D-18.
- **`version.service.ts` types** (`src/server/services/version.service.ts`): `SectionSnapshot`, `ChangelogEntry`; reused for the consultation summary's per-section feedback aggregation.

### Established Patterns
- **`(public)` route group** — zero auth imports, direct drizzle DB queries in server components, `export const dynamic = 'force-dynamic'` at top of page files. Phase 9 baseline; Phase 19/20/20.5 reaffirm.
- **Hand-written migrations** — all DDL via hand-written SQL under `src/db/migrations/` and applied via `scripts/apply-migration-XXXX.mjs` Neon HTTP runner. Drizzle-kit push not used. (Phases 1, 14, 16, 20.)
- **tRPC mutation auditing** — every application-router mutation writes an audit log via `writeAuditLog` (Phase 1 invariant). The new `consultationSummary.approve` and `consultationSummary.regenerate` mutations must follow this.
- **Privacy enforcement on public routes** — never render stakeholder identity, CR readable IDs, feedback IDs, workflow transition actor names. Phase 9 PUB-05 binding. Applies to the LLM output too — the guardrail in D-14 is the enforcement.
- **Inngest event emission from mutations** — Phase 17 (`workshop.completed`), Phase 19 (`participate.intake`), Phase 20 (`workshop.created`) — `version.published` follows the same pattern.
- **Inngest concurrency keys for Groq calls** — Phase 17 used `concurrency: { key: 'groq-transcription', limit: 2 }` to cap parallel Groq calls. The consultation summary function should adopt a similar pattern.
- **`.cl-landing` scoped CSS-vars pattern** — palette tokens prefixed `--cl-*` to avoid collision with shadcn `--primary` / `--background`. Continue this prefix discipline if extending.

### Integration Points
- **`app/(public)/layout.tsx`** — full refactor target per D-02. After refactor, all 6 public routes inherit the shell automatically.
- **`src/server/routers/version.ts`** `publishVersion` — emit `version.published` Inngest event after the publish DB write.
- **`src/db/schema/changeRequests.ts`** `documentVersions` — gains the `consultationSummary` JSONB column.
- **`src/lib/llm.ts`** — gains `generateConsultationSummary` helper.
- **Inngest function registry** — gains `consultationSummaryGenerate` function (per-section loop, regex guardrail, JSONB upsert).
- **Workspace version detail page** (`app/(workspace)/policies/[id]/versions/[versionId]/page.tsx` — planner to verify exact path) — gains the inline "Consultation Summary" review card per D-10.
- **`app/(public)/portal/[policyId]/page.tsx`** — passes `consultationSummary` from selected version into `PublicPolicyContent` props.
- **`app/(public)/framework/[policyId]/page.tsx`** — fetches latest published version's `consultationSummary` and renders below the what-changed log per D-18.

</code_context>

<specifics>
## Specific Ideas

- Visual continuity matters more than design novelty: `/`, `/participate`, `/workshops`, `/research`, `/framework`, `/portal` should feel like the SAME website after this phase. The existing `.cl-landing` mockup is the brand bar — promote it, don't rebuild it.
- Newsreader serif headlines + Inter sans body is already shipped on three public pages — extending it across the rest is the cheapest path to consistency.
- Emerald `#179d53` is the sanctioned accent, not the newDoc2 "saffron or teal" suggestion. Rationale: working code beats specs, the participate/workshops pages already render with emerald, retrofitting them would be churn.
- The moderator review gate must be a USEFUL workflow, not performative. Editable textarea + per-section approve makes it real (D-10/D-11/D-12). A pure "approve verbatim" button would be ignored after week one.
- Per-section summary cards on `/portal` create context-locality: "I'm reading section 4, and right under it I see what stakeholders said about section 4." Beats a separate destination page.
- `/framework` reading the latest publish's summary (D-18) turns the draft surface into a richer context page without expanding the LLM workload — the summary already exists, it just gets a second consumer.
- "Side-by-side raw feedback counts" in SC#7 means the moderator can VERIFY the LLM's summary against the actual source feedback in the same view. Implement the right column as a verification panel, not just a metadata strip.
- The guardrail regex is belt-and-suspenders, NOT the first defense. Anonymization at input (D-07) is the first defense. The regex catches the edge case where the LLM hallucinates a name that wasn't in input.

</specifics>

<deferred>
## Deferred Ideas

- **Cross-version summary diffs** — comparing Section 4's summary in v0.2 vs v0.3. Future phase or v0.3 milestone work.
- **Section subscription notifications** — emailing stakeholders when a new summary lands on a section they care about. Future phase.
- **Multi-language summary generation** — Hindi, Tamil, etc. Future phase.
- **Auto-rejection of summaries with sentiment outliers** — quality scoring layer. Future phase.
- **`/portal/[policyId]/summary` standalone subroute** — superseded by inline-on-section rendering (D-15).
- **LLM summary on draft (unpublished) versions** — out of scope; summaries only exist for published versions.
- **Newsreader / Inter font subset optimization for performance** — defer to a perf phase.
- **Landing page at `/`** — explicitly deferred per ROADMAP.md Phase 21 notes; the existing `.cl-landing` mockup at `app/page.tsx` stays.
- **Cardano verification badges on portal sections** — Phase 23.
- **Custom moderation queue page across all policies** — current scope is inline on version detail (D-10); a dedicated `/moderation/summaries` queue can be added later if moderator volume demands it.

### Reviewed Todos (not folded)
None — no pending todos matched Phase 21 scope.

</deferred>

---

*Phase: 21-public-shell-consultation-summary-llm-theme*
*Context gathered: 2026-04-15*

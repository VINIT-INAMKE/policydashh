# Phase 21: Public Shell + Consultation Summary LLM + Theme - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-15
**Phase:** 21-public-shell-consultation-summary-llm-theme
**Areas discussed:** Theme + public shell, Summary data model + LLM contract, Moderator review gate + regen policy, Public rendering surface

---

## Theme + Public Shell

### Q: What's the policy-grade theme source of truth?

| Option | Description | Selected |
|--------|-------------|----------|
| Adopt `.cl-landing` as-is (Recommended) | Promote existing navy/cream/emerald + Newsreader/Inter into project-wide public theme. Already shipped on `/`, `/participate`, `/workshops`. Treats newDoc2 'saffron or teal' as superseded by the executable mockup. | ✓ |
| Pivot accent to saffron or teal | Keep navy/cream base + fonts but swap emerald for saffron OR teal per newDoc2.md. Requires re-coloring 3 already-shipped pages. | |
| Build a new policy-grade theme from scratch | Treat `.cl-landing` as a marketing experiment, design fresh palette/typography from newDoc2 spec. Most work, least continuity. | |

**User's choice:** Adopt `.cl-landing` as-is (Recommended)
**Notes:** Working code beats specs.

### Q: How should the shared public shell be implemented?

| Option | Description | Selected |
|--------|-------------|----------|
| Refactor `app/(public)/layout.tsx` (Recommended) | Route group already wraps 5 public pages. Replace hollow header/footer with the real shell. Pages stop wrapping themselves in `.cl-landing` manually. Single source of truth. | ✓ |
| New `PublicShell` component, opted into per-page | Each page imports `<PublicShell>`. More flexibility per page, but duplication across 5 pages, drift risk. | |
| Hybrid — layout provides shell, pages can opt out | Layout renders shell by default with a 'no-shell' opt-out for special cases. | |

**User's choice:** Refactor `app/(public)/layout.tsx` (Recommended)

### Q: What nav items does the public header carry?

| Option | Description | Selected |
|--------|-------------|----------|
| Research / Framework / Workshops / Participate / Portal (Recommended) | The 5 public destinations from newDoc2 sitemap, logo on left, mobile hamburger. 'Internal Login' lives in footer. Active state on current route. No CTA button. | ✓ |
| Above + a primary 'Join Consultation' CTA button | Same 5 nav items + styled CTA button (right side, navy fill → /participate). | |
| Minimal: logo + Participate + Portal only, hamburger for rest | Strips header to logo + 2 highest-priority destinations, all others in hamburger. | |

**User's choice:** Research / Framework / Workshops / Participate / Portal (Recommended)

### Q: Does the existing `/portal/[policyId]` get the new theme + shell?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — `/portal` inherits from `(public)/layout.tsx` (Recommended) | Portal is a public route, should feel consistent. New shell wraps it automatically. Existing components stay; only chrome changes. | ✓ |
| No — `/portal` stays on its current layout | Portal is the read-only published archive (Phase 9), distinct in tone. Avoid retrofit risk. | |
| Yes, but defer visual polish to a follow-up | Wire structurally, allow Phase 9 styling to coexist if it conflicts. | |

**User's choice:** Yes — `/portal` inherits from `(public)/layout.tsx` (Recommended)

---

## Summary Data Model + LLM Contract

### Q: What's the consultationSummary JSONB cache shape?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-section array (Recommended) | `{ status, generatedAt, sections: [{ sectionId, sectionTitle, summary, feedbackCount, sourceFeedbackIds[] }] }`. Mirrors moderator review, public render, and per-section regen. Matches SC#3 'grouped by section' verbatim. | ✓ |
| Whole-version blob with subsections inline | `{ status, generatedAt, prose: '...long markdown with H2 per section...' }`. One LLM call with whole policy + all feedback. Simpler, but harder to regen one section. | |
| Structured themes/decisions (no per-section) | `{ status, generatedAt, themes: [{title, prose}], openQuestions: [...] }`. Cross-cutting analytical view. Loses section-anchoring. | |

**User's choice:** Per-section array (Recommended)

### Q: What gets anonymized before the LLM ever sees feedback?

| Option | Description | Selected |
|--------|-------------|----------|
| Submitter identity only (Recommended) | Strip name, email, phone, userId. Keep stakeholder ROLE and verbatim feedback body. LLM can say 'an industry stakeholder argued X' but never names. | ✓ |
| Submitter identity + organization names | Above, plus regex-strip likely org names from feedback body. Heavy-handed, lossy. | |
| Submitter identity + orgs + verbatim quotes | Above, plus convert quoted text to paraphrase markers. Most conservative, hardest to generate quality prose. | |

**User's choice:** Submitter identity only (Recommended)

### Q: What's the LLM call budget per section?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 call per section, maxTokens=1024 (Recommended) | One `llama-3.3-70b-versatile` call per section. ~750 words per summary. Fits Phase 17 LLM-03 contract style. Linear scaling. | ✓ |
| 1 call per version, maxTokens=4096 (whole policy) | Single big call covering whole policy with section markers. Cheaper, but model loses focus, harder to retry one section. | |
| 1 call per section, maxTokens=2048 | Bigger budget per section (~1500 words). Doubles cost for richer prose. | |

**User's choice:** 1 call per section, maxTokens=1024 (Recommended)

### Q: What happens when generation fails for a section?

| Option | Description | Selected |
|--------|-------------|----------|
| Mark section error, retry on next publish (Recommended) | Per-section error state in JSONB. Other sections still cached. Next `version.published` or manual re-trigger retries. Public shows 'under review' placeholder. No publish blocking. | ✓ |
| Hard-fail the Inngest function | Strict mode — any section failure dumps the whole summary, alarms moderator. Forces attention but blocks downstream. | |
| Silent fallback to 'no summary available' | Failed section gets empty summary, marked approved automatically. Quietest — risk: failures hide. | |

**User's choice:** Mark section error, retry on next publish (Recommended)

---

## Moderator Review Gate + Regen Policy

### Q: Where does the moderator review pending summaries?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline on workspace version detail page (Recommended) | Add 'Consultation Summary' card to `/policies/[id]/versions/[versionId]`. Discoverable from where moderators publish. SC#7 side-by-side counts in same view. | ✓ |
| Dedicated `/moderation/summaries` queue page | Workspace queue listing all pending summaries across policies. Better for high-volume moderation. | |
| Modal opened from version detail | Same trigger but content in dialog overlay. Less discoverable. | |

**User's choice:** Inline on workspace version detail page (Recommended)

### Q: What's the granularity of the approval action?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-section approve, version-level publish (Recommended) | Each section approvable independently. 'Publish summary publicly' requires ALL sections approved or skipped. | ✓ |
| Whole-summary atomic approve | One button: 'Approve all'. Simpler, but moderator can't pause mid-review. | |
| Per-section approve, per-section publish | Each section publishes immediately on approval. Confusing public state mid-review. | |

**User's choice:** Per-section approve, version-level publish (Recommended)

### Q: Can the moderator edit the prose, or only approve/reject?

| Option | Description | Selected |
|--------|-------------|----------|
| Editable textarea per section + approve (Recommended) | Moderator can fix LLM wording before approving. Tracks `edited: true` flag in JSONB. | ✓ |
| Read-only — approve or reject only | Approve verbatim or reject (marks for regen). Cleanest accountability, strictest. | |
| Read-only approve, plus 'request regen with note' on reject | Reject + free-text note fed back into next regen as 'previous attempt rejected because...'. More plumbing. | |

**User's choice:** Editable textarea per section + approve (Recommended)

### Q: What triggers regeneration + how does the guardrail regex behave?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto on version.published + manual button; regex blocks save (Recommended) | Inngest fires on publish AND manual 'Regenerate' button. Regex match → `status: 'blocked', error: 'guardrail-violation'`. No public render. Other sections proceed. | ✓ |
| Auto only on version.published; regex hard-fails | No manual regen. Regex match throws NonRetriableError, whole function dies. | |
| Auto + manual; regex stores with warning, moderator decides | Regex match doesn't block — stores with warning flag, moderator can still approve. Most lenient. | |

**User's choice:** Auto on version.published + manual button; regex blocks save (Recommended)

---

## Public Rendering Surface

### Q: Where does an approved consultation summary appear publicly?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline under each section on `/portal/[policyId]` (Recommended) | Each section renders content followed by a 'Consultation Summary' card with approved prose. Maximum context-locality. Reuses `PublicPolicyContent` with prop extension. | ✓ |
| Dedicated `/portal/[policyId]/consultation-summary` subroute | All summaries on one page, separate from policy text. Loses adjacency. | |
| Embedded in `/portal/[policyId]/changelog` | Append summary to each changelog entry. Cluttered. | |

**User's choice:** Inline under each section on `/portal/[policyId]` (Recommended)

### Q: What does the public see when summary status is pending/draft/blocked?

| Option | Description | Selected |
|--------|-------------|----------|
| 'Summary under review' placeholder card per section (Recommended) | Same card structure as approved view, muted placeholder. Per-section so partial states render correctly. | ✓ |
| Hide the section entirely | Section card simply doesn't render until approved. Cleanest visual but invisible. | |
| 'Summary not yet generated' (only when status absent, not pending) | Differentiate by absence vs pending. More granular for tiny benefit. | |

**User's choice:** 'Summary under review' placeholder card per section (Recommended)

### Q: Which versions' summaries are publicly visible?

| Option | Description | Selected |
|--------|-------------|----------|
| Latest published version only (Recommended) | `/portal/[policyId]` always shows latest + its approved summary. Historical versions exist but summaries not surfaced. | |
| Every published version (browseable) | Each historical version shows its own summary via the version selector. Forward-compat for cross-version comparison. | ✓ |
| Latest only on portal, all versions on changelog | Mixed: portal shows latest, changelog page links to historical summaries. | |

**User's choice:** Every published version (browseable) — **diverged from recommendation**
**Notes:** D-17 captures: `/portal/[policyId]` keeps existing `PublicVersionSelector` and the displayed summary follows the selected version's `consultationSummary` JSONB.

### Q: Does the `/framework` draft page (Phase 20.5) also render summaries?

| Option | Description | Selected |
|--------|-------------|----------|
| No — `/framework` stays summary-free (Recommended) | Summaries are for published versions, framework is for drafts. Keeps Phase 20.5 untouched. | |
| Yes — if a published version exists, render its summary on `/framework` too | Framework shows draft + latest published version's summary as auxiliary context. Bleeds 'published' into 'draft' surface but informative. | ✓ |
| Yes — generate a draft-version summary too | Expand LLM-04 scope to draft versions. Doubles LLM workload. | |

**User's choice:** Yes — render latest published version's summary on `/framework` — **diverged from recommendation**
**Notes:** D-18 captures: framework summary block sits below the existing 'What changed' log; reuses cached JSONB, no new generation path; if no published version exists, framework simply omits the block.

---

## Claude's Discretion

The following are explicitly delegated to Claude during planning/implementation:
- Exact Tailwind classes for the new shell header/footer (within `.cl-landing` token constraints)
- Mobile menu animation / visual polish
- Loading skeleton for moderator review card
- Exact LLM prompt wording for the summary call (system + user messages); should produce ~500–700 word summaries grouped by themes within each section
- Tracking of `sourceFeedbackIds` ordering inside the per-section array
- Inngest concurrency key for the consultation summary function (suggest reusing `'groq-transcription'` from Phase 17 or a new `'groq-summary'` key)
- Whether to backfill `consultationSummary = NULL` for existing published versions or auto-trigger generation on first deploy

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` section. Highlights:
- Cross-version summary diffs
- Section subscription notifications
- Multi-language summary generation
- LLM summaries on draft versions
- Standalone `/portal/[policyId]/summary` subroute
- Landing page at `/` (deferred per ROADMAP.md)
- Cardano verification badges (Phase 23)
- Cross-policy moderation queue page

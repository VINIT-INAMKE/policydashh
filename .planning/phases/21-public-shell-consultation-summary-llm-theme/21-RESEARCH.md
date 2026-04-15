# Phase 21: Public Shell + Consultation Summary LLM + Theme — Research

**Researched:** 2026-04-15
**Domain:** Public shell refactor (layout, font vars, `.cl-landing`), Inngest LLM pipeline (Groq llama-3.3-70b-versatile), JSONB schema extension, moderator review tRPC mutations, public rendering extension
**Confidence:** HIGH — all findings sourced directly from codebase reads; no training-data speculation

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Adopt the existing `.cl-landing` palette as the policy-grade public theme — navy `#000a1e` primary, cream `#f7fafc` surface, emerald `#179d53` accent, Newsreader serif headings, Inter sans body. `app/page.tsx` + `app/globals.css` `.cl-landing` block is the source of truth.
- **D-02:** `app/(public)/layout.tsx` is the single shell. It owns `.cl-landing` className, font variables (`Newsreader`, `Inter`), and renders header + footer chrome. Pages stop wrapping themselves in `.cl-landing` manually.
- **D-03:** Public header: logo left, nav links (Research / Framework / Workshops / Participate / Portal) center/right, active state on current route, mobile hamburger. No separate CTA button.
- **D-04:** Public footer: "Internal Login" link + "Published by PolicyDash" + minimal legal text, single-row, low-chrome.
- **D-05:** `/portal/[policyId]` inherits the new shell automatically. Any Phase 9 styling conflict is folded into Phase 21.
- **D-06:** New `documentVersions.consultationSummary` JSONB column. Schema: `{ status: 'pending'|'partial'|'approved', generatedAt: ISO, sections: Array<{ sectionId, sectionTitle, summary, status: 'pending'|'approved'|'blocked'|'error', edited, generatedAt, feedbackCount, sourceFeedbackIds }> }`.
- **D-07:** Anonymization scope: strip name, email, phone, userId. Keep stakeholder role (`orgType`) and verbatim feedback body.
- **D-08:** LLM call budget: 1 call per section, `chatComplete({ model: 'llama-3.3-70b-versatile', maxTokens: 1024, temperature: 0.3, messages })`.
- **D-09:** Per-section error state in JSONB; other sections continue. Failure does NOT block publishing the version.
- **D-10:** Moderator review inline on `/policies/[id]/versions/[versionId]`. Side-by-side: left = LLM prose + edit textarea, right = source feedback rows (anonymized count + truncated body).
- **D-11:** Approval granularity: per-section approve. Version-level publish gate requires ALL sections `approved` or `skipped` (zero accepted feedback). Parent JSONB `status`: `pending → partial → approved`.
- **D-12:** Moderator can edit prose before approving. `edited: true` flag tracks this.
- **D-13:** Regen triggers: AUTO on `version.published` event AND manual "Regenerate Section" button. Manual uses `overrideOnly: [sectionId]` parameter.
- **D-14:** Guardrail regex: runs POST-generation. On match, section stored as `status: 'blocked', error: 'guardrail-violation'`. Pattern source: live `users.firstName/lastName` lookup + static PII patterns. Function does NOT throw — other sections proceed.
- **D-15:** Approved summary renders inline under each section on `/portal/[policyId]` via optional `sectionSummaries?: Map<sectionId, ApprovedSummarySection>` prop on `PublicPolicyContent`. Backward-compatible.
- **D-16:** Pending/blocked/error sections render "Summary under review" placeholder card.
- **D-17:** All published versions browseable. Summary follows selected version's JSONB column.
- **D-18:** `/framework` renders latest published version's approved summary below "What Changed" log. No new generation path. If no published version, omit block.

### Claude's Discretion

- Exact Tailwind classes for shell header/footer (within `.cl-landing` token constraints)
- Mobile menu animation / visual polish
- Loading skeleton for moderator review card
- Exact LLM prompt wording for the summary call (system + user messages); ~500–700 words grouped by themes per section
- `sourceFeedbackIds` ordering inside per-section array
- Inngest concurrency key for consultation summary function (`'groq-transcription'` reuse or new `'groq-summary'`)
- Whether to backfill `consultationSummary = NULL` for existing published versions or auto-trigger on first deploy

### Deferred Ideas (OUT OF SCOPE)

- Cross-version summary diffs
- Section subscription notifications
- Multi-language summary generation
- Auto-rejection of summaries with sentiment outliers
- `/portal/[policyId]/summary` standalone subroute
- LLM summary on draft (unpublished) versions
- Newsreader / Inter font subset optimization
- Landing page at `/` redesign
- Cardano verification badges (Phase 23)
- Custom moderation queue page across all policies

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PUB-09 | Minimal public shell (header, footer) with routing between `/`, `/participate`, `/workshops`, `/research`, `/framework`, `/portal` | `app/(public)/layout.tsx` is a hollow stub (29 lines) with no font vars or `.cl-landing` className — full rewrite target confirmed. Font vars exist in `app/page.tsx` lines 7–20 and are ready to move. |
| PUB-10 | Public surfaces use policy-grade theme (white/off-white base, dark blue typography, emerald accent, document cards) | `.cl-landing` CSS variable block confirmed at `app/globals.css` lines 361–468. All 32+ `--cl-*` tokens already defined. `/participate` and `/workshops` currently self-wrap; layout takes ownership. |
| LLM-04 | Per-section consultation summary prose generated via `llama-3.3-70b-versatile` from aggregated accepted feedback | `chatComplete()` in `src/lib/llm.ts` is the only sanctioned call site. Model `llama-3.3-70b-versatile` not yet used but the wrapper accepts any `model: string` — zero wrapper changes needed. |
| LLM-05 | Consultation summary cached in `documentVersions.consultationSummary` JSONB, auto-regenerated on every `version.published` event | `documentVersions` table in `src/db/schema/changeRequests.ts` has no `consultationSummary` column today. `version.publish` mutation in `src/server/routers/version.ts` lines 110–166 is the emission site. Next migration: `0013_consultation_summary.sql`. |
| LLM-06 | Consultation summary generation sees only anonymized feedback content (bodies without submitter identity) | `feedbackItems.submitterId` FK → `users.id`. `users` table has: `email`, `phone`, `name`. `feedbackItems` has: `body`, `isAnonymous`, `feedbackType`, `impactCategory`, plus `submitterId` FK. Anonymization strips submitterId join, name, email, phone; keeps `orgType` from users + `body`, `feedbackType`. |
| LLM-07 | All LLM outputs enter human review gate (`pending → draft → approved`) before public rendering | New tRPC router `consultationSummary` with mutations: `approve`, `edit`, `regenerate` — all behind `requirePermission('version:manage')`. All three must call `writeAuditLog`. |
| LLM-08 | LLM output guardrail regex detects stakeholder names leaking through summaries and blocks publish | `users.name` column is the source of display names. The guardrail must join `users` for the document's feedback submitters, build a name regex, and run it against the generated prose before JSONB write. |

</phase_requirements>

---

## Executive Summary

Phase 21 is three intertwined threads landing together. Thread 1 (PUB-09/10): the `app/(public)/layout.tsx` is a 29-line hollow stub that needs a full rewrite to own `.cl-landing`, font variables, `PublicHeader`, and `PublicFooter` — the CSS token system is already complete in `app/globals.css` lines 361–468 and the font configuration is already written in `app/page.tsx` lines 7–20, so this is promotion not invention. Thread 2 (LLM-04 to LLM-08): a new Inngest function `consultationSummaryGenerateFn` triggered by `version.published` (which the `version.publish` tRPC mutation already emits notifications on — that same callsite gets a second event) loops over sections, anonymizes accepted feedback, calls `chatComplete({ model: 'llama-3.3-70b-versatile', ... })`, runs a guardrail regex, and upserts results into a new `documentVersions.consultationSummary` JSONB column. Thread 3 (LLM-08 public rendering): a new `SummaryReviewCard` on the workspace version detail page, and extension of `PublicPolicyContent` with an optional `sectionSummaries` prop for portal + framework rendering.

Key risk 1: The workspace version detail page does NOT have a per-version sub-route (`/policies/[id]/versions/[versionId]`). The existing `app/(workspace)/policies/[id]/versions/page.tsx` is a two-panel client component where selecting a version renders `VersionDetail` inline. The `SummaryReviewCard` must attach to this `VersionDetail` component, not a new page route. Key risk 2: The `version.published` Inngest event does not exist yet in `src/inngest/events.ts` — there is a `'version_published'` notification type and a `notifications.type` enum value, but no Inngest `EventType` registration. The publish mutation must emit a new `sendVersionPublished` event. Key risk 3: `PublicPolicyContent` already accepts an optional `sectionStatuses` prop (added in Phase 20.5) — the `sectionSummaries` extension follows the identical pattern.

Primary recommendation: plan in wave order: Wave 0 (migration 0013 + test stubs), Wave 1 (Inngest event registration + mutation emit), Wave 2 (LLM function + guardrail + JSONB write), Wave 3 (tRPC moderator mutations), Wave 4 (layout refactor + public components), Wave 5 (VersionDetail integration + public render extension).

---

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **CRITICAL:** This is NOT standard Next.js — read `node_modules/next/dist/docs/` before writing any Next.js patterns. APIs, conventions, and file structure may differ from training data.
- Every tRPC mutation writes audit log via `writeAuditLog` — no exceptions. Three new mutations (`consultationSummary.approve`, `consultationSummary.edit`, `consultationSummary.regenerate`) must all call `writeAuditLog`.
- No `publicProcedure` in application routers.
- `users.email` is nullable — every email path must guard `if (email)`.
- DB schema changes require hand-written SQL migrations (not `drizzle-kit generate`). Applied via `scripts/apply-migration-XXXX.mjs` using Neon HTTP runner with `sql.query(stmt)` (Phase 14/16 Pattern 2). Next migration: `0013_consultation_summary.sql`.
- No worktrees or isolation branches — commit directly to master.
- Sequential DB inserts, no `db.transaction()` — Neon HTTP driver compatibility.
- Zod v4: use `z.guid()` for IDs in Inngest event schemas (not `z.uuid()`).
- Inngest: always inline `triggers: [{ event: myEvent }]` — never extract to a `const`.
- `(public)` route group: zero Clerk/auth imports, direct drizzle queries in server components, `export const dynamic = 'force-dynamic'`.
- Privacy enforcement on public routes (Phase 9 PUB-05): never render stakeholder identity, CR readable IDs, feedback IDs, workflow transition actor names. Applies to LLM output rendering.
- npm (NOT pnpm) — all install commands must use `npm install`.
- Package manager: npm. No new dependencies needed (groq-sdk already installed, all shadcn components pre-installed).

---

## Existing Patterns Found

### 1. Inngest Function Pattern (event subscription, retry, concurrency, error handling)

**File:** `src/inngest/functions/workshop-recording-processed.ts`

Canonical pattern for a Groq-backed Inngest function:

```typescript
// src/inngest/functions/workshop-recording-processed.ts (lines 40-48)
export const workshopRecordingProcessedFn = inngest.createFunction(
  {
    id: 'workshop-recording-processed',
    name: 'Workshop recording — transcribe + summarize via Groq',
    retries: 2,
    concurrency: { key: 'groq-transcription', limit: 2 },
    triggers: [{ event: workshopRecordingUploadedEvent }],  // INLINE — no const
  },
  async ({ event, step }) => { ... }
)
```

Key: `concurrency: { key: 'groq-transcription', limit: 2 }` caps parallel Groq calls. The new `consultationSummaryGenerateFn` should use a new `'groq-summary'` key (or share `'groq-transcription'` — Claude's discretion per CONTEXT.md). Per-section errors are handled without `NonRetriableError` unless the failure is definitively unrecoverable — transient Groq failures should bubble as plain `Error` so Inngest retries.

**Event registration pattern** (`src/inngest/events.ts`):
```typescript
// Template from events.ts lines 44-70
const mySchema = z.object({ versionId: z.guid(), documentId: z.guid() })
export const myEvent = eventType('version.published', { schema: mySchema })
export type MyEventData = z.infer<typeof mySchema>
export async function sendMyEvent(data: MyEventData): Promise<void> {
  const event = myEvent.create(data)
  await event.validate()
  await inngest.send(event)
}
```

**`version.published` event does NOT yet exist** in `src/inngest/events.ts`. The `'version_published'` string appears only in the notifications schema and the `notificationCreateSchema` enum. A new `versionPublishedEvent` EventType must be added.

### 2. `chatComplete()` Signature (Phase 17 — HIGH confidence, read from source)

**File:** `src/lib/llm.ts` (lines 85–99)

```typescript
export async function chatComplete(opts: {
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  maxTokens: number       // TypeScript-required, no `?` — LLM-03 enforcement
  temperature?: number
}): Promise<string>
```

- `maxTokens` maps internally to `max_completion_tokens` at the groq-sdk v1.x boundary.
- Returns `completion.choices[0]?.message?.content ?? ''` — plain string, no JSON parsing.
- The new `generateConsultationSummary` helper in `src/lib/llm.ts` calls `chatComplete({ model: 'llama-3.3-70b-versatile', maxTokens: 1024, temperature: 0.3, messages: [...] })`.
- `summarizeTranscript` (lines 139–179) is the reference for prompt structure and JSON fallback handling.

### 3. JSONB Schema + Migration Runner Pattern

**Schema extension target:** `src/db/schema/changeRequests.ts` — `documentVersions` table (lines 12–26)

Current columns on `documentVersions`: `id`, `documentId`, `versionLabel`, `mergeSummary`, `createdBy`, `crId`, `createdAt`, `sectionsSnapshot` (jsonb), `changelog` (jsonb), `publishedAt`, `isPublished`.

New column to add:
```typescript
consultationSummary: jsonb('consultation_summary').$type<ConsultationSummaryJson | null>()
```

**Migration file:** `src/db/migrations/0013_consultation_summary.sql`
```sql
ALTER TABLE document_versions
  ADD COLUMN IF NOT EXISTS consultation_summary JSONB;
```

**Migration runner:** `scripts/apply-migration-0013.mjs` — copy structure from `scripts/apply-migration-0012.mjs` (lines 1–91). Key: uses `await sql.query(stmt)` (Pattern 2), loads `.env.local`, reads migration file, runs sanity-check SELECT after apply.

### 4. `.cl-landing` Token System + app/page.tsx Usage

**CSS variable block:** `app/globals.css` lines 361–428

Key variables for this phase:
- `--cl-primary: #000a1e` — headings, logo, text primary
- `--cl-surface: #f7fafc` — page background
- `--cl-surface-container: #ebeef0` — nav background, summary cards
- `--cl-surface-container-low: #f1f4f6` — summary card container
- `--cl-on-tertiary-container: #179d53` — emerald accent (active nav, approved badge)
- `--cl-on-surface-variant: #44474e` — body copy, inactive nav links
- `--cl-error: #ba1a1a` — blocked guardrail badge
- `--cl-outline-variant: #c4c6cf` — borders

**Font variable configuration** (`app/page.tsx` lines 7–20 — must move to layout):
```typescript
const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cl-headline',
  display: 'swap',
})
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cl-body',
  display: 'swap',
})
```

These attach as CSS variables via className application on the root `div`:
```tsx
// app/page.tsx line 28 — the pattern to replicate in layout.tsx
<div className={`cl-landing ${newsreader.variable} ${inter.variable} ...`}>
```

**Critical:** After Phase 21, `app/page.tsx` should NOT re-declare these font objects if they are declared in the layout. The layout owns `cl-landing` and injects font variables into the `<body>` or top-level `<div>`; `app/page.tsx` stops wrapping in `cl-landing` manually (same as participate/workshops pages).

**Glassmorphism nav pattern** (`app/page.tsx` line 31):
```tsx
<nav className="sticky top-0 z-50 w-full bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md">
```
UI-SPEC maps this to: `bg-[var(--cl-surface-container-low)]/80 backdrop-blur-md`.

### 5. `PublicPolicyContent` Extension Hook Points

**File:** `app/(public)/portal/[policyId]/_components/public-policy-content.tsx`

Current signature:
```typescript
interface PublicPolicyContentProps {
  sections: SectionSnapshot[]
  sectionStatuses?: Map<string, SectionStatus>  // added in Phase 20.5
}
```

Extension for Phase 21 (D-15):
```typescript
sectionSummaries?: Map<string, ApprovedSummarySection>  // optional, backward-compatible
```

The component currently renders sections in a loop with an `<hr>` separator between them (line 43). The `SectionSummaryBlock` renders immediately after the section prose content, before the `<hr>` separator — position: after `<div dangerouslySetInnerHTML.../>`, before the `{index < sections.length - 1 && <hr>}` check.

The component already imports `SectionStatusBadge` from framework components. The `ApprovedSummarySection` type will be defined in a new shared types file or alongside the JSONB type.

**Existing public portal page** (`app/(public)/portal/[policyId]/page.tsx` line 140):
```tsx
<PublicPolicyContent sections={sortedSections} />
```
This call gets extended to:
```tsx
<PublicPolicyContent sections={sortedSections} sectionSummaries={sectionSummaries} />
```
where `sectionSummaries` is built from `selectedVersion.consultationSummary?.sections` filtered to `status === 'approved'`.

The portal page also has a button linking to `/portal/${policyId}/consultation-summary` (line 119) — this link should be removed or repurposed since Phase 21 renders summaries inline, not on a subroute.

### 6. `writeAuditLog` Invariant

**File:** `src/server/routers/version.ts` (lines 93–104, 117–127)

Pattern: `writeAuditLog({...}).catch(console.error)` — fire-and-forget, never awaited. Every new tRPC mutation in Phase 21 must follow this exact pattern. The three new mutations:
- `consultationSummary.approve` → action: `'consultation_summary.section_approved'`
- `consultationSummary.edit` → action: `'consultation_summary.section_edited'`
- `consultationSummary.regenerate` → action: `'consultation_summary.section_regenerated'`

All three: `requirePermission('version:manage')`, `writeAuditLog(...).catch(console.error)`.

### 7. Version Detail — Workspace Integration Point

The workspace version history page is at `app/(workspace)/policies/[id]/versions/page.tsx`. There is NO per-version sub-route (`/versions/[versionId]`). The page renders `<VersionDetail versionId={selectedVersionId} ... />` as an inline panel.

**File:** `app/(workspace)/policies/[id]/versions/_components/version-detail.tsx`

`VersionDetail` fetches via `trpc.version.getById.useQuery({ id: versionId })`. This is where the `SummaryReviewCard` component mounts — it receives `versionId` and `documentId` as props and fetches its own data via `trpc.consultationSummary.getByVersionId.useQuery(...)`.

The `SummaryReviewCard` is a client component (`'use client'`). It renders inside the existing `VersionDetail` scroll area, below `<PublishDialog>` and changelog sections.

### 8. `PublicVersionSelector` Cross-Version Data Flow

**File:** `app/(public)/portal/[policyId]/_components/public-version-selector.tsx`

The selector is a client component that calls `router.push('/portal/${policyId}?version=${value}')` on change. The portal page reads `searchParams.version` and resolves the selected version. When Phase 21 adds `consultationSummary` to the SELECT result, the summary data follows the selected version automatically — no changes to the selector itself. The portal page just needs to pass `selectedVersion.consultationSummary` down into `PublicPolicyContent`.

### 9. `version.publish` Mutation — Event Emission Site

**File:** `src/server/routers/version.ts` lines 110–166

The `publish` mutation:
1. Calls `publishVersion(input.id, ctx.user.id)` service
2. Calls `writeAuditLog` (fire-and-forget)
3. Queries document title + assigned users
4. Loops: `await sendNotificationCreate(...)` for each user

Phase 21 adds step 5: `await sendVersionPublished({ versionId: version.id, documentId: version.documentId })` — awaited (like Phase 17's `sendWorkshopCompleted` was awaited) so publish fails if Inngest send fails.

---

## Implementation Approach

### Thread A: Schema Migration for `consultationSummary` JSONB

**Migration file:** `src/db/migrations/0013_consultation_summary.sql`
```sql
ALTER TABLE document_versions
  ADD COLUMN IF NOT EXISTS consultation_summary JSONB;
```

**Drizzle schema update:** `src/db/schema/changeRequests.ts` — add:
```typescript
import type { ConsultationSummaryJson } from '@/src/server/services/consultation-summary.service'

// In documentVersions table:
consultationSummary: jsonb('consultation_summary').$type<ConsultationSummaryJson | null>()
```

**TypeScript type definition** (define in `src/server/services/consultation-summary.service.ts`):
```typescript
export interface ConsultationSummarySection {
  sectionId: string
  sectionTitle: string
  summary: string
  status: 'pending' | 'approved' | 'blocked' | 'error'
  edited: boolean
  generatedAt: string  // ISO
  feedbackCount: number
  sourceFeedbackIds: string[]
  error?: string  // present when status === 'blocked' | 'error'
}

export interface ConsultationSummaryJson {
  status: 'pending' | 'partial' | 'approved'
  generatedAt: string  // ISO
  sections: ConsultationSummarySection[]
}
```

**Migration runner:** `scripts/apply-migration-0013.mjs` — copy from `apply-migration-0012.mjs` with three substitutions: `0012` → `0013`, `public_draft_flag` → `consultation_summary`, sanity-check SELECT: `SELECT consultation_summary FROM document_versions LIMIT 1`.

### Thread B: Anonymization Function

**Where:** `src/server/services/consultation-summary.service.ts` — `anonymizeFeedbackForSection()`

**Input:** array of accepted `feedbackItems` rows (with `submitterId` joined to `users`).

**Output:** array of `{ orgType: string, body: string, feedbackType: string, impactCategory: string }` — no name, no email, no phone, no userId.

**Fields stripped (from `feedbackItems` + `users` join):**
- `submitterId` (uuid — FK to users)
- `users.name` (display name)
- `users.email` (nullable)
- `users.phone` (nullable)
- `feedbackItems.isAnonymous` (internal flag — not meaningful in anonymized output)
- `feedbackItems.reviewedBy` (uuid — internal)

**Fields kept:**
- `users.orgType` → included as stakeholder role for attribution ("an industry stakeholder argued X")
- `feedbackItems.body` → verbatim text
- `feedbackItems.feedbackType` → 'issue'|'suggestion'|'endorsement'|'evidence'|'question'
- `feedbackItems.impactCategory` → 'legal'|'security'|etc.
- `feedbackItems.id` → used in `sourceFeedbackIds` list (internal JSONB only, not rendered publicly)

**DB query pattern** (inside Inngest `step.run`):
```typescript
const rows = await db
  .select({
    feedbackId:     feedbackItems.id,
    body:           feedbackItems.body,
    feedbackType:   feedbackItems.feedbackType,
    impactCategory: feedbackItems.impactCategory,
    orgType:        users.orgType,
  })
  .from(feedbackItems)
  .leftJoin(users, eq(feedbackItems.submitterId, users.id))
  .where(
    and(
      eq(feedbackItems.sectionId, sectionId),
      eq(feedbackItems.documentId, documentId),
      eq(feedbackItems.status, 'accepted'),  // only accepted feedback
    )
  )
```

### Thread C: LLM Prompt Design

**Function to add to `src/lib/llm.ts`:** `generateConsultationSummary()`

```typescript
export async function generateConsultationSummary(
  sectionTitle: string,
  anonymizedFeedback: Array<{ orgType: string | null; body: string; feedbackType: string }>,
): Promise<string>
```

**System message (guidance — exact wording is Claude's discretion):**
```
You are a policy analyst writing public consultation summaries for a government framework review process.
Your task is to synthesize stakeholder feedback into a clear, balanced, 500–700 word narrative summary.

Rules:
- Group feedback by theme (not by stakeholder). Identify 3–5 themes per section.
- Use stakeholder roles (government stakeholder, industry stakeholder, civil society, etc.) for attribution — never use names.
- Maintain a neutral, policy-document tone. No opinionated language.
- Every claim in the summary must be traceable to at least one feedback item.
- Do NOT include: personal names, email addresses, organization names, or any identifying information.
- Output plain prose paragraphs only — no bullet lists, no headers, no markdown formatting.
```

**User message:**
```
Section: {sectionTitle}

Feedback items ({N} accepted responses):
{anonymizedFeedback.map((f, i) => `[${i+1}] Role: ${f.orgType ?? 'unspecified'} | Type: ${f.feedbackType}\n${f.body}`).join('\n\n')}

Write a consultation summary for this section.
```

**Empty section handling:** if `anonymizedFeedback.length === 0`, return a sentinel value `''` (empty string) — the Inngest function stores this section as `status: 'skipped'` (an implied status when `feedbackCount === 0`), automatically satisfying D-11's "zero accepted feedback → skipped" gate.

### Thread D: Guardrail Regex

**Where:** Inside `consultationSummaryGenerateFn`, after each per-section `chatComplete` call, before JSONB write.

**Pattern build:**
```typescript
async function buildGuardrailPattern(documentId: string): Promise<RegExp> {
  const submitters = await db
    .select({ name: users.name })
    .from(users)
    .innerJoin(feedbackItems, eq(feedbackItems.submitterId, users.id))
    .where(eq(feedbackItems.documentId, documentId))
    .groupBy(users.name)

  const names = submitters
    .map(r => r.name)
    .filter(Boolean)
    .flatMap(name => name!.split(/\s+/).filter(n => n.length > 3))  // skip short tokens

  const staticPatterns = [
    /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/,        // "FirstName LastName" pattern
    /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/,  // email
    /\b\+?[0-9]{10,14}\b/,                   // phone number
  ]

  if (names.length === 0) {
    return new RegExp(staticPatterns.map(p => p.source).join('|'), 'i')
  }

  const namePattern = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  return new RegExp([namePattern, ...staticPatterns.map(p => p.source)].join('|'), 'i')
}
```

**Usage in Inngest function:**
```typescript
const guardrail = await buildGuardrailPattern(documentId)  // build ONCE per function run
for (const section of sections) {
  const prose = await step.run(`generate-section-${sectionId}`, ...)
  if (guardrail.test(prose)) {
    // Store as blocked
    sectionResult = { status: 'blocked', error: 'guardrail-violation', summary: '' }
  } else {
    sectionResult = { status: 'pending', summary: prose }
  }
}
```

### Thread E: Inngest Function Structure

**File:** `src/inngest/functions/consultation-summary-generate.ts`

**Event registration** (add to `src/inngest/events.ts`):
```typescript
const versionPublishedSchema = z.object({
  versionId:  z.guid(),
  documentId: z.guid(),
})
export const versionPublishedEvent = eventType('version.published', { schema: versionPublishedSchema })
export type VersionPublishedData = z.infer<typeof versionPublishedSchema>
export async function sendVersionPublished(data: VersionPublishedData): Promise<void> {
  const event = versionPublishedEvent.create(data)
  await event.validate()
  await inngest.send(event)
}
```

**Function structure:**
```typescript
export const consultationSummaryGenerateFn = inngest.createFunction(
  {
    id: 'consultation-summary-generate',
    name: 'Consultation summary — generate via Groq llama',
    retries: 2,
    concurrency: { key: 'groq-summary', limit: 2 },
    triggers: [{ event: versionPublishedEvent }],
  },
  async ({ event, step }) => {
    const { versionId, documentId } = event.data

    // Step 1: fetch version + section list
    const versionData = await step.run('fetch-version', async () => { ... })

    // Step 2: build guardrail (one query, used across all sections)
    const guardrailSource = await step.run('build-guardrail', async () => {
      // Return regex source string (JSON-safe) not RegExp object
      return await buildGuardrailPatternSource(documentId)
    })

    // Step 3+: per-section loop (one step.run per section)
    const sectionResults: ConsultationSummarySection[] = []
    for (const section of versionData.sections) {
      const result = await step.run(`generate-section-${section.sectionId}`, async () => {
        const feedback = await fetchAnonymizedFeedback(section.sectionId, documentId)
        if (feedback.length === 0) {
          return { sectionId: section.sectionId, status: 'skipped', feedbackCount: 0, ... }
        }
        const prose = await generateConsultationSummary(section.title, feedback)
        const guardrail = new RegExp(guardrailSource, 'i')
        if (guardrail.test(prose)) {
          return { ..., status: 'blocked', error: 'guardrail-violation', summary: '' }
        }
        return { ..., status: 'pending', summary: prose, feedbackCount: feedback.length, ... }
      })
      sectionResults.push(result)
    }

    // Step N: upsert JSONB
    await step.run('persist-summary', async () => {
      const overallStatus = computeOverallStatus(sectionResults)
      await db.update(documentVersions)
        .set({ consultationSummary: { status: overallStatus, generatedAt: new Date().toISOString(), sections: sectionResults } })
        .where(eq(documentVersions.id, versionId))
    })
  }
)
```

**Critical Inngest pitfall (from Phase 17/18):** `step.run` return values are JSON-serialized. Return `RegExp.source` (a string) from `build-guardrail` step, reconstruct `new RegExp(source, 'i')` inside the per-section step — never pass a `RegExp` object across step boundaries.

**`overrideOnly` parameter for manual regen (D-13):** The function accepts an optional `overrideOnly?: string[]` field in the event schema. When present, skip sections whose `sectionId` is NOT in the list — preserving approved sections.

**Register in `src/inngest/functions/index.ts`**: append `consultationSummaryGenerateFn` to the `functions` array.

### Thread F: Public Layout Refactor

**File:** `app/(public)/layout.tsx` — full rewrite

Current: 29-line hollow stub with no font vars, no `.cl-landing`, generic header/footer text.

After Phase 21:
```typescript
import { Inter, Newsreader } from 'next/font/google'
import { PublicHeader } from './_components/public-header'
import { PublicFooter } from './_components/public-footer'

const newsreader = Newsreader({ subsets: ['latin'], weight: ['400', '600', '700'], style: ['normal', 'italic'], variable: '--font-cl-headline', display: 'swap' })
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-cl-body', display: 'swap' })

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`cl-landing ${newsreader.variable} ${inter.variable} min-h-screen flex flex-col bg-[var(--cl-surface)] text-[var(--cl-on-surface)]`}>
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  )
}
```

**New component files:**
- `app/(public)/_components/public-header.tsx` — sticky glassmorphism nav, lucide `Menu`/`X` hamburger, active route via `usePathname()` (client component), links to `/research`, `/framework`, `/workshops`, `/participate`, `/portal`
- `app/(public)/_components/public-footer.tsx` — single row, "Published by PolicyDash" + "Internal Login" `/sign-in` link

**Pages that remove manual `.cl-landing` wrapping (D-02):**
- `app/(public)/participate/page.tsx` — currently wraps in `.cl-landing` manually (confirmed by comment on line 15 of that file)
- `app/(public)/workshops/page.tsx` — same pattern (Phase 20 shipped it)

**`app/page.tsx` special case:** The home page (`/`) is NOT in the `(public)` route group — it lives at `app/page.tsx` directly. It will NOT inherit from `app/(public)/layout.tsx`. It must continue to self-apply font variables and `.cl-landing` (or Phase 21 explicitly moves it into `(public)` — but CONTEXT.md D-01 says landing page is NOT redesigned this phase). The planner should decide: leave `app/page.tsx` as-is with its own font declarations, or move it into `(public)`.

### Thread G: Workspace Moderator Review Card Data Fetching

**New tRPC router:** `src/server/routers/consultation-summary.ts`

```typescript
export const consultationSummaryRouter = router({
  getByVersionId: requirePermission('version:manage')
    .input(z.object({ versionId: z.string().uuid() }))
    .query(async ({ input }) => {
      const [row] = await db.select({ consultationSummary: documentVersions.consultationSummary })
        .from(documentVersions)
        .where(eq(documentVersions.id, input.versionId))
        .limit(1)
      return row?.consultationSummary ?? null
    }),

  approveSection: requirePermission('version:manage')
    .input(z.object({ versionId: z.string().uuid(), sectionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Read current JSONB, update section status to 'approved', write back
      // Recompute overall status; writeAuditLog(...).catch(console.error)
    }),

  editSection: requirePermission('version:manage')
    .input(z.object({ versionId: z.string().uuid(), sectionId: z.string().uuid(), prose: z.string().min(1).max(5000) }))
    .mutation(async ({ ctx, input }) => {
      // Update section prose + set edited: true; keep status as 'pending' until approved separately
      // writeAuditLog(...).catch(console.error)
    }),

  regenerateSection: requirePermission('version:manage')
    .input(z.object({ versionId: z.string().uuid(), sectionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Send version.published event with overrideOnly: [sectionId]
      // Reset that section in JSONB to { status: 'pending', summary: '' }
      // writeAuditLog(...).catch(console.error)
    }),
})
```

Mount in app router: add `consultationSummary: consultationSummaryRouter` to the root tRPC router.

The source feedback panel (right column of SummaryReviewCard) needs a separate query to show anonymized source feedback. A new `consultationSummary.getSectionFeedback` query returns the anonymized feedback items used to generate the summary — identifies rows by `sourceFeedbackIds` from the JSONB. This query is workspace-only (behind `requirePermission('version:manage')`).

### Thread H: Public Render Integration

**`app/(public)/portal/[policyId]/page.tsx`** changes:
1. SELECT `consultationSummary` column from `documentVersions` query
2. Build `sectionSummaries: Map<string, ApprovedSummarySection>` from `selectedVersion.consultationSummary?.sections` filtered to `status === 'approved'`
3. Pass to `<PublicPolicyContent sections={sortedSections} sectionSummaries={sectionSummaries} />`
4. Remove the "Consultation Summary" button that links to non-existent subroute (line 119–124)

**`app/(public)/framework/page.tsx` + `app/(public)/framework/[policyId]/page.tsx`** changes:
1. In `renderFrameworkDetail()`: after loading `publishedVersions`, find the latest one with a non-null `consultationSummary` whose `status === 'approved'`
2. Pass to new `<FrameworkSummaryBlock summary={latestApprovedSummary} />` component rendered below `<WhatChangedLog>`
3. `FrameworkSummaryBlock` is a new server component at `app/(public)/framework/_components/framework-summary-block.tsx`

**`PublicPolicyContent` extension** (`app/(public)/portal/[policyId]/_components/public-policy-content.tsx`):
- Add `sectionSummaries?: Map<string, ApprovedSummarySection>` to props interface
- Inside the section loop, after the prose `<div>`, render:
  ```tsx
  {sectionSummaries && (
    <SectionSummaryBlock summary={sectionSummaries.get(section.sectionId)} />
  )}
  ```
- `SectionSummaryBlock` handles both approved and placeholder states internally

**New components:**
- `app/(public)/portal/[policyId]/_components/section-summary-block.tsx` — approved prose or placeholder
- `app/(public)/portal/[policyId]/_components/summary-placeholder-card.tsx` — muted "under review" card
- `app/(public)/framework/_components/framework-summary-block.tsx` — framework summary rendering

---

## Open Questions

1. **`app/page.tsx` font declaration deduplication**
   - What we know: `app/page.tsx` declares `Newsreader` and `Inter` font objects with `variable: '--font-cl-headline'` and `'--font-cl-body'`. After Phase 21, the `app/(public)/layout.tsx` also declares them.
   - What's unclear: Does Next.js merge duplicate `next/font/google` declarations with the same `variable` name, or does it create two separate font faces? Is `app/page.tsx` inside `(public)` layout scope? It is NOT — `app/page.tsx` is at the root level, outside `app/(public)/`.
   - Recommendation: Either (a) move `app/page.tsx` into `app/(public)/` so it inherits the layout (simplest, requires verifying the redirect logic still works with `(public)` group), or (b) keep `app/page.tsx` at root and accept that it re-declares font objects independently (no runtime conflict — Next.js deduplicates same font + variable name). The planner should pick one path explicitly.

2. **Inngest concurrency key: `'groq-summary'` vs `'groq-transcription'`**
   - Phase 17 established `'groq-transcription'` with `limit: 2`. CONTEXT.md lists this as Claude's discretion.
   - Recommendation: use `'groq-summary'` as a separate key. Rationale: summary generation for a multi-section policy document produces multiple Groq calls per function run (one per section). Sharing `'groq-transcription'`'s `limit: 2` slot would block workshop transcriptions during consultation summary bursts and vice versa. Separate keys allow independent rate limiting.

3. **Backfill strategy for existing published versions**
   - What we know: existing published versions have `consultationSummary = NULL`. CONTEXT.md marks this as Claude's discretion.
   - Options: (a) NULL means "pre-feature, no summary" — public renders nothing (same as D-18's "no published version" rule), no backfill. (b) Auto-trigger generation for all published versions on first deploy.
   - Recommendation: Option (a). NULL = no summary, no placeholder shown. Backfill is scope expansion; the feature is additive.

4. **`overrideOnly` in the `version.published` Inngest event schema**
   - What we know: D-13 says manual regen uses `overrideOnly: [sectionId]`. The event schema must accommodate this optional field.
   - Recommendation: Add `overrideOnly: z.array(z.guid()).optional()` to `versionPublishedSchema`. When `overrideOnly` is present, the Inngest function skips sections not in the list. The manual "Regenerate Section" mutation fires `sendVersionPublished({ versionId, documentId, overrideOnly: [sectionId] })` instead of a separate event.

5. **Consultation Summary subroute link removal**
   - `app/(public)/portal/[policyId]/page.tsx` line 119 has a `<Link href={/portal/${policyId}/consultation-summary}>` button. This subroute is explicitly deferred in CONTEXT.md. The link must be removed or changed. Recommendation: remove the button entirely — inline summaries per D-15 replace the need for a standalone subroute.

6. **`users.name` split for guardrail pattern**
   - The `users` table has a single `name` column (no `firstName`/`lastName` split — confirmed from `src/db/schema/users.ts`). The guardrail pattern builder should split on whitespace and filter tokens shorter than 4 characters (to avoid matching common words like "the", "and").
   - Recommendation: implement the name token extraction as described in Thread D above.

---

## Validation Architecture

`nyquist_validation: true` per `.planning/config.json`. Mirroring Phase 17 structure.

### Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.1 |
| Config file | `vitest.config.mts` |
| Quick run command | `npm test -- --run src/inngest src/lib src/server/routers tests/phase-21` |
| Full suite command | `npm test` |
| Estimated runtime | ~35s (full suite, baseline ~309 passed + 2 pre-existing failures from Phase 16 deferred-items.md) |

### Wave 0 Requirements (RED stubs, before implementation)

The following test files must be created in Wave 0 (Plan 21-00):

| File | Covers | Goes GREEN in |
|------|--------|---------------|
| `tests/phase-21/consultation-summary-service.test.ts` | LLM-06 anonymization function, LLM-08 guardrail regex | Plan 21-01 (service) |
| `src/inngest/__tests__/consultation-summary-generate.test.ts` | LLM-04, LLM-05, LLM-07, LLM-08 — Inngest function (mocked Groq, mocked DB) | Plan 21-02 (Inngest fn) |
| `src/server/routers/consultation-summary.test.ts` | LLM-07 — approve/edit/regenerate mutations + audit write | Plan 21-03 (tRPC router) |

No new npm package installs needed — groq-sdk already installed, vitest already configured, all shadcn components pre-installed.

Wave 0 also creates the migration file `src/db/migrations/0013_consultation_summary.sql` and the migration runner `scripts/apply-migration-0013.mjs` (apply immediately in Plan 21-00 so later plans can query the new column).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| PUB-09 | Public shell renders header + footer on all 6 public routes | snapshot/manual | `npm test -- --run tests/phase-21` + visual deferred | Wave 0 gap |
| PUB-10 | `.cl-landing` className on layout root element | grep + tsc | `grep 'cl-landing' app/(public)/layout.tsx && npx tsc --noEmit` | ❌ Wave 0 |
| LLM-04 | `generateConsultationSummary()` calls `chatComplete` with `llama-3.3-70b-versatile` | unit | `npm test -- --run src/lib/llm.test.ts` | ✅ (extend) |
| LLM-05 | `consultationSummaryGenerateFn` upserts JSONB on `version.published` event | unit (mocked) | `npm test -- --run src/inngest/__tests__/consultation-summary-generate.test.ts` | ❌ Wave 0 |
| LLM-06 | `anonymizeFeedbackForSection()` strips name/email/phone/userId, keeps body + orgType | unit | `npm test -- --run tests/phase-21/consultation-summary-service.test.ts` | ❌ Wave 0 |
| LLM-07 | `consultationSummary.approve` saves approved status + calls `writeAuditLog` | unit | `npm test -- --run src/server/routers/consultation-summary.test.ts` | ❌ Wave 0 |
| LLM-08 | Guardrail regex blocks sections matching stakeholder name patterns | unit | `npm test -- --run tests/phase-21/consultation-summary-service.test.ts` | ❌ Wave 0 |

### Anonymization Unit Tests (LLM-06)

Test fixtures should cover:
1. `anonymizeFeedbackForSection()` with a feedback row where `users.name = 'Jane Smith'`, `email = 'jane@example.com'` — asserts output contains no `Jane`, no `Smith`, no `jane@example.com`, but DOES contain `orgType: 'industry'` and verbatim `body`.
2. `isAnonymous: true` feedback row — asserts same output shape (anonymization is unconditional at LLM input time).
3. Null `orgType` — asserts output has `orgType: null` (not crash).
4. Empty feedback array — asserts `anonymizeFeedbackForSection()` returns `[]`.

### Guardrail Regex Unit Tests (LLM-08)

Test fixtures should cover:
1. Prose containing `'Jane Smith said that the policy'` → matches, returns `true` from `guardrailPattern.test(prose)`.
2. Prose containing `'An industry stakeholder argued'` → does NOT match.
3. Prose containing an email `'contact@example.com'` → matches static email pattern.
4. Prose with only policy language → does NOT match.
5. Name token shorter than 4 chars (`'Bob'`, `'Li'`) → does NOT match (filter logic).
6. Empty name list → static patterns still work.

### Inngest Function Integration Test (LLM-05, mocked Groq)

Use the Phase 17 pattern: `vi.mock('groq-sdk', ...)` + `vi.mock('@/src/db', ...)` + `vi.hoisted()` for shared mock handles. Key contracts:
1. Function triggers on `version.published` event.
2. Calls `chatComplete` once per section with `model: 'llama-3.3-70b-versatile'`.
3. On guardrail match: section stored as `status: 'blocked'`, other sections unaffected.
4. On LLM error for one section: that section stored as `status: 'error'`, other sections proceed.
5. JSONB upsert called with correct shape after all sections processed.
6. `overrideOnly` parameter: only specified sections regenerated, others preserved.

### tRPC Moderator Route Integration Tests (LLM-07)

Use Phase 18 pattern: probe `router._def.procedures.approveSection` to defeat createCaller Proxy false-positives.
1. `approve`: updates section status to `'approved'`, recomputes overall status, calls `writeAuditLog`.
2. `edit`: updates section prose, sets `edited: true`, does NOT auto-approve.
3. `regenerate`: fires `sendVersionPublished` with `overrideOnly`, resets section to `pending`.
4. All three: reject callers without `version:manage` permission.

### Public Render Snapshot Tests (PUB-09, PUB-10)

Lightweight grep-based checks (no jsdom in this project's test suite):
1. `grep 'cl-landing' app/(public)/layout.tsx` exits 0.
2. `grep 'Newsreader' app/(public)/layout.tsx` exits 0.
3. `grep 'PublicHeader' app/(public)/layout.tsx` exits 0.
4. `grep 'PublicFooter' app/(public)/layout.tsx` exits 0.
5. `grep 'cl-landing' app/(public)/participate/page.tsx` — asserts NOT present (manual `.cl-landing` wrapper removed).
6. `grep 'cl-landing' app/(public)/workshops/page.tsx` — asserts NOT present.
7. `npx tsc --noEmit` — exits 0 (type-safe `sectionSummaries` prop extension).

### Sampling Rate

- **After every task commit:** `npm test -- --run <touched-file>`
- **After every plan wave:** `npm test`
- **Before `/gsd:verify-work`:** Full suite green at ≥ 309 passed (excluding 2 pre-existing Phase 16 deferred-items.md failures)
- **Max feedback latency:** 60 seconds

### Wave 0 Gaps (files that must exist before implementation)

- [ ] `tests/phase-21/consultation-summary-service.test.ts` — LLM-06 anonymization + LLM-08 guardrail
- [ ] `src/inngest/__tests__/consultation-summary-generate.test.ts` — LLM-04/05/07/08 Inngest fn
- [ ] `src/server/routers/consultation-summary.test.ts` — LLM-07 tRPC mutations
- [ ] `src/db/migrations/0013_consultation_summary.sql` — DDL (apply immediately)
- [ ] `scripts/apply-migration-0013.mjs` — migration runner

---

## Risks and Pitfalls

### Pitfall 1: Phase 9 PUB-05 Privacy Enforcement on Summary Rendering

**What goes wrong:** The public summary rendering accidentally exposes stakeholder identity (e.g., `sourceFeedbackIds` rendered on the public portal, or the right-panel source feedback shown without anonymization).

**Why it happens:** `SectionSummaryBlock` shows the approved prose publicly. The `sourceFeedbackIds` field in the JSONB is for internal workspace use only. If a developer passes the full `ConsultationSummarySection` object to the public component, the IDs would be present in the rendered HTML (even if not displayed, the JSON could leak via React hydration or serialized props).

**How to avoid:** The `ApprovedSummarySection` type passed to `PublicPolicyContent` must be a stripped projection: `{ sectionId, sectionTitle, summary }` only. No `sourceFeedbackIds`, no `feedbackCount`, no `generatedAt`, no `edited` flag. Define a separate `PublicApprovedSummary` type vs. the internal `ConsultationSummarySection` type.

**Warning signs:** `grep 'sourceFeedbackIds' app/(public)'` returning matches. `grep 'feedbackCount' app/(public)'` returning matches.

### Pitfall 2: Font Variable Duplication Between `app/page.tsx` and `app/(public)/layout.tsx`

**What goes wrong:** Both `app/page.tsx` and `app/(public)/layout.tsx` declare `Newsreader` and `Inter` with the same `variable` name. Next.js may load the font twice, causing flash of unstyled text or doubled font payloads.

**Why it happens:** `app/page.tsx` is at the root route group level, not inside `(public)`. It cannot inherit from `(public)/layout.tsx`. If both files declare identical font configurations, Next.js may or may not deduplicate.

**How to avoid:** Decision must be made explicitly in the plan: either move `app/page.tsx` into `app/(public)/` (requires the Clerk `auth()` redirect to still work — it will, `(public)` is just a layout group, not an auth boundary), or accept the duplication and verify Next.js deduplicates. The safer path: move `app/page.tsx` to `app/(public)/page.tsx` (or create `app/(public)/(home)/page.tsx`) so it inherits the layout cleanly.

**Warning signs:** `next build` warnings about duplicate font loading. Chrome DevTools Network tab showing two separate font requests for the same face.

### Pitfall 3: `step.run` JSON Serialization of RegExp Objects

**What goes wrong:** The guardrail `RegExp` object is returned from a `step.run` block. Inngest JSON-serializes step results for memoization — `RegExp` becomes `{}` after `JSON.stringify`. The next step then uses `{}` instead of the regex, guardrail never fires.

**Why it happens:** Phase 18 Research Pitfall 2 (Buffer serialization) established this class of problem. `RegExp` has the same serialization issue as `Buffer`.

**How to avoid:** Return `regex.source` (a string) from the `build-guardrail` step. Reconstruct `new RegExp(source, 'i')` inside each per-section step before calling `.test(prose)`.

**Warning signs:** Guardrail always passes in Inngest Dev UI even with obvious names in test prose.

### Pitfall 4: Inngest Concurrency Drift Between Summary and Transcription

**What goes wrong:** Using the shared `'groq-transcription'` concurrency key means a simultaneous workshop recording upload and consultation summary generation compete for the same 2-slot queue. Either task gets blocked while the other runs.

**Why it happens:** Phase 17 established `'groq-transcription'` for workshop recordings. If the consultation summary function reuses that key, any burst of publish events (e.g., 5 policies published in quick succession) fills both slots and blocks future transcriptions for up to the total processing time.

**How to avoid:** Use `'groq-summary'` as a distinct concurrency key for `consultationSummaryGenerateFn`. Set limit to 2 independently.

**Warning signs:** Inngest Dev UI shows `consultation-summary-generate` runs queued behind `workshop-recording-processed` runs.

### Pitfall 5: JSONB Partial Update Race Condition

**What goes wrong:** Two concurrent Inngest runs for the same `versionId` (e.g., the auto-trigger from `version.published` and a near-simultaneous manual regenerate) read stale JSONB, update different sections, and overwrite each other's results.

**Why it happens:** No optimistic locking on the JSONB column. Both reads see the same initial state; both writes clobber.

**How to avoid:** The `persist-summary` step must use a Postgres `jsonb_set` or a full document replace (not a partial patch). For manual regenerate, the `consultationSummary.regenerate` mutation should: (1) immediately set the target section to `{ status: 'pending', summary: '' }` in the DB synchronously (within the tRPC mutation, before firing the event), then (2) fire the event. This ensures the Inngest run reads an already-`pending` state and writes the new result without a race.

**Warning signs:** After manual regenerate, approved sections revert to `pending` in the JSONB.

### Pitfall 6: Public Header `usePathname()` Requires Client Component

**What goes wrong:** `PublicHeader` needs to know the current route to apply active state styling. `usePathname()` is a Next.js client hook. If the header is a server component, this won't work.

**Why it happens:** Standard Next.js pattern issue — active nav state requires runtime URL knowledge.

**How to avoid:** `PublicHeader` must be `'use client'`. The layout wraps it server-side; the client component receives no props (reads the URL itself). This is the same pattern used by `WorkspaceNav` in the workspace layout (Phase 2 decision: "WorkspaceNav extracted as client component for usePathname active state in server layout").

**Warning signs:** TypeScript error "usePathname() can only be used in client components."

### Pitfall 7: Consultation Summary Link on Portal Page Points to Non-Existent Subroute

**What goes wrong:** `app/(public)/portal/[policyId]/page.tsx` line 119 has a `<Link href={/portal/${policyId}/consultation-summary}>` button. This route was deferred. After Phase 21 ships inline summaries, the button still navigates to a 404.

**How to avoid:** Remove the "Consultation Summary" button from the portal page header row in Phase 21. The feature is now inline — no standalone subroute needed.

### Pitfall 8: Drizzle Type for New JSONB Column in Queries

**What goes wrong:** After adding `consultationSummary` to the Drizzle schema, existing queries that use `db.select()` with explicit column lists (like `version.ts` line 26–44) won't include the new column unless explicitly added. The public portal page query must be extended to select `consultationSummary`.

**How to avoid:** After the schema update, do a project-wide search for all `documentVersions` select queries and add `consultationSummary: documentVersions.consultationSummary` where the selected version is returned to callers who need summary data. The workspace `getById` query and the public portal query both need the update.

---

## Environment Availability

Step 2.6: SKIPPED — no new external dependencies. `groq-sdk@1.1.2` is already installed and pinned. All shadcn components (Button, Badge, Textarea, Skeleton, Separator) are pre-installed. No new CLI tools, databases, or services required.

---

## Sources

### Primary (HIGH confidence — read directly from codebase)

- `src/lib/llm.ts` — `chatComplete()` signature, `summarizeTranscript()` pattern, `instantiateGroq()` test-mock pattern
- `src/inngest/events.ts` — full event registry: all existing events, `sendX()` helper pattern, `z.guid()` rule
- `src/inngest/functions/workshop-recording-processed.ts` — canonical Groq Inngest function pattern (concurrency, step structure, Buffer/base64 serialization)
- `src/inngest/functions/index.ts` — function registration barrel
- `src/db/schema/changeRequests.ts` — `documentVersions` table definition (no `consultationSummary` column today)
- `src/db/schema/feedback.ts` — feedback fields: `submitterId`, `body`, `isAnonymous`, `feedbackType`, `impactCategory`
- `src/db/schema/users.ts` — `users` fields: `name`, `email`, `phone`, `orgType`
- `app/globals.css` lines 361–468 — complete `.cl-landing` CSS variable block, 32+ `--cl-*` tokens
- `app/page.tsx` lines 7–20 — font variable configuration (`--font-cl-headline`, `--font-cl-body`)
- `app/(public)/layout.tsx` — current hollow stub (29 lines, no font vars, no `.cl-landing`)
- `app/(public)/portal/[policyId]/_components/public-policy-content.tsx` — current props interface, `sectionStatuses` Phase 20.5 extension pattern
- `app/(public)/portal/[policyId]/_components/public-version-selector.tsx` — client component, `useRouter().push` on select
- `app/(public)/portal/[policyId]/page.tsx` — full SSR pattern, consultation-summary link on line 119
- `app/(public)/framework/page.tsx` — `renderFrameworkDetail()` structure, WhatChangedLog placement
- `src/server/routers/version.ts` — `publish` mutation (lines 110–166), `writeAuditLog` fire-and-forget pattern
- `app/(workspace)/policies/[id]/versions/page.tsx` + `_components/version-detail.tsx` — no per-version sub-route; `VersionDetail` is inline panel
- `scripts/apply-migration-0012.mjs` — canonical migration runner pattern
- `src/db/migrations/` — next migration will be `0013_consultation_summary.sql`
- `.planning/config.json` — `nyquist_validation: true` confirmed

### Secondary (MEDIUM confidence)

- `src/server/services/framework-log.service.ts` — `getSectionPublicStatuses` pattern for Phase 21 service extraction model
- `.planning/phases/17-workshop-lifecycle-recording-pipeline-groq/17-VALIDATION.md` — Phase 17 VALIDATION.md structure (mirrored above)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all libraries are already installed and their APIs verified from source
- Architecture patterns: HIGH — all patterns read directly from existing Inngest functions, tRPC routers, and public page files
- Pitfalls: HIGH — all identified from direct code inspection (existing subroute link, RegExp serialization from Phase 18, font duplication from page.tsx, privacy from Phase 9 PUB-05)
- Public shell refactor: HIGH — CSS tokens confirmed in globals.css, font vars confirmed in page.tsx, layout.tsx stub confirmed
- LLM function design: HIGH for structure (mirrors workshop-recording-processed.ts exactly), MEDIUM for prompt wording (Claude's discretion per CONTEXT.md)

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (stable stack — no fast-moving dependencies)

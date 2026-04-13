# Phase 17: Workshop Lifecycle + Recording Pipeline (Groq) — Research

**Researched:** 2026-04-14
**Domain:** Workshop state machine, Inngest durable pipelines, Groq Whisper transcription, llama summarization, R2 file size enforcement
**Confidence:** HIGH — all findings sourced directly from codebase reads and official docs; no training-data speculation

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WS-06 | `workshops.status` enum (`upcoming → in_progress → completed → archived`) with audited state transitions | New `workshop_status` pgEnum + migration 0010; `workflowTransitions` write on every transition; new `workshop.transition` tRPC mutation guarded by `workshop:manage` |
| WS-12 | `workshopCompleted` Inngest fn fires 72h + 7d moderator nudges on missing evidence checklist slots | New Inngest event `workshop.completed`; new fn with `step.sleepUntil` for 72h + 7d; checks `workshopEvidenceChecklist` rows before sending nudge email |
| WS-13 | Workshop has evidence checklist with required artifact slots (`registration_export`, `screenshot`, `recording`, `attendance`, `summary`) | New `workshop_evidence_checklist` table (not reusing `workshop_artifacts`) — separate concept; `workshopCompleted` fn auto-creates 5 rows on completion |
| LLM-01 | Groq SDK wrapper `src/lib/llm.ts` with fail-fast env validation via `requireEnv('GROQ_API_KEY')` and `max_tokens` enforcement on every chat call | `groq-sdk@1.1.2` not installed — requires `npm install groq-sdk`; `src/lib/llm.ts` does not exist; GROQ_API_KEY not in `.env.example` |
| LLM-02 | Workshop recording transcribed via `whisper-large-v3-turbo` within Inngest `step.run`; uploads > 25MB rejected at R2 presign step | R2 presign route needs a new `recording` category with 25MB cap; new `workshopRecordingProcessed` Inngest fn; Groq audio file limit is 25MB on free tier (matches spec) |
| LLM-03 | Workshop transcript summarized via `llama-3.1-8b-instant` with structured output (key points, decisions, action items) | `client.chat.completions.create` with `max_tokens` enforced via `llm.ts` wrapper; structured prompt with JSON response format |
| WS-14 | Moderator recording upload triggers `workshopRecordingProcessed` Inngest fn; transcript + summary in draft state; moderator reviews and approves | New `workshop.recording_uploaded` Inngest event; new `workshopRecordingProcessed` fn; `workshopArtifacts` needs `reviewStatus` column (`draft` / `approved`) + new `workshop.approveArtifact` mutation |
</phase_requirements>

---

## Summary

Phase 17 has four distinct workstreams that must be implemented in dependency order.

**Workstream A — Workshop status machine (WS-06):** The `workshops` table has no `status` column today. A new `workshop_status` pgEnum and `status` column must be added via migration 0010. Transitions are audited by writing to the existing `workflowTransitions` table (same pattern as feedback/CR). A new `workshop.transition` tRPC mutation guards transitions with permission `workshop:manage` and an allowed-transition map. The admin action button lives on the existing workshop detail page at `app/(workspace)/workshops/[id]/page.tsx`.

**Workstream B — Evidence checklist + nudges (WS-12, WS-13):** A new `workshop_evidence_checklist` table holds the five required slots per workshop. This is a separate concept from `workshop_artifacts` — it tracks *required* slots whose fill state gates the nudge logic. When a workshop transitions to `completed`, the `workshop.transition` mutation fires a `workshop.completed` Inngest event. The `workshopCompletedFn` auto-creates checklist rows for any slot that doesn't exist, then runs two `step.sleepUntil` calls at +72h and +7d, checking slot fill state before sending a nudge email via Resend.

**Workstream C — LLM wrapper (LLM-01):** `src/lib/llm.ts` does not exist. `groq-sdk` is not installed. `GROQ_API_KEY` is not in `.env.example`. Wave 0 must: `npm install groq-sdk`, create the wrapper with `requireEnv` validation and `max_tokens` enforcement, add `GROQ_API_KEY=` to `.env.example`.

**Workstream D — Recording pipeline (WS-14, LLM-02, LLM-03):** The R2 presign route (`app/api/upload/route.ts`) has a `recording` category gap — currently only `image`, `document`, `evidence` are defined. A new `recording` category with a 25MB cap and audio MIME type allowlist must be added. A new `workshop.recording_uploaded` Inngest event fires when the moderator attaches an artifact with `artifactType === 'recording'`. The `workshopRecordingProcessedFn` has three `step.run` blocks: fetch recording URL from R2, call Groq Whisper transcription, call Groq llama summarization. Both LLM outputs are stored as `workshopArtifacts` rows with `reviewStatus: 'draft'`. A new `workshop.approveArtifact` mutation flips `reviewStatus` to `approved`.

**Primary recommendation:** Plan in wave order: Wave 0 (groq-sdk install + llm.ts scaffold + test stubs + DB migration), Wave 1 (status machine + transition router + admin UI), Wave 2 (checklist table + workshopCompletedFn), Wave 3 (recording pipeline + workshopRecordingProcessedFn), Wave 4 (review/approve UI + evidence checklist UI).

---

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **CRITICAL:** This is NOT standard Next.js — read `node_modules/next/dist/docs/` before writing any Next.js patterns. APIs, conventions, and file structure may differ from training data.
- Every tRPC mutation writes audit log via `writeAuditLog` — no exceptions.
- No `publicProcedure` in application routers.
- `users.email` is nullable — every email path must guard `if (email)`.
- DB schema changes require hand-written SQL migrations (not `drizzle-kit generate`) per project convention. Migration must use `@neondatabase/serverless` driver via `sql.query(stmt)` (Pattern 2, Phase 16) — not tagged-template form `sql\`...\``.
- No worktrees or isolation branches — commit directly to master.
- Sequential DB inserts, no `db.transaction()` — Neon HTTP driver compatibility (Phase 2 decision).
- Zod v4: use `z.guid()` for IDs in Inngest event schemas (not `z.uuid()`) — Phase 16 decision.
- Inngest: always inline `triggers: [{ event: myEvent }]` — never extract to a `const` (type widening footgun, Phase 16 decision).

---

## Standard Stack

### Core (already installed — no new dependency except groq-sdk)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| drizzle-orm | 0.45.1 | New schema tables + queries | Already installed |
| inngest | 4.2.1 | `workshopCompleted` + `workshopRecordingProcessed` fns | Already installed |
| resend / src/lib/email.ts | 6.9.4 | Nudge emails to moderator | Already installed |
| zod | 4.3.6 | Event schemas, tRPC inputs | Already installed |
| @aws-sdk/client-s3 | ^3.1017.0 | R2 fetch for recording binary in Inngest step | Already installed |
| vitest | 4.1.1 | Unit tests | Already installed |

### New Dependency Required

| Library | Version | Purpose | Install |
|---------|---------|---------|---------|
| groq-sdk | 1.1.2 | Groq Whisper transcription + llama chat completions | `npm install groq-sdk` |

**GROQ_API_KEY** must be added to `.env.example` and `.env.local`.

### Verified: groq-sdk API shape (HIGH confidence — official docs + GitHub README)

```typescript
// Transcription (whisper-large-v3-turbo)
import Groq, { toFile } from 'groq-sdk'
const client = new Groq({ apiKey: process.env.GROQ_API_KEY })

// From a Buffer (Inngest fetch the R2 URL → ArrayBuffer → Buffer)
const transcription = await client.audio.transcriptions.create({
  model: 'whisper-large-v3-turbo',
  file: await toFile(Buffer.from(audioBuffer), 'recording.mp3', { type: 'audio/mpeg' }),
  response_format: 'text',   // plain string output
})

// Chat completions (llama-3.1-8b-instant) — max_tokens enforced by llm.ts wrapper
const completion = await client.chat.completions.create({
  model: 'llama-3.1-8b-instant',
  messages: [{ role: 'user', content: prompt }],
  max_completion_tokens: 1024,   // parameter name in groq-sdk v1.x
  temperature: 0.3,
})
```

**Note on `max_tokens` vs `max_completion_tokens`:** groq-sdk v1.x uses `max_completion_tokens` as the parameter name. The `llm.ts` wrapper must accept a `maxTokens` option and map it to `max_completion_tokens` internally — this satisfies LLM-03's "enforces `max_tokens` on every Groq chat call" requirement at the wrapper level.

### Supported Audio Formats (Groq Whisper) — HIGH confidence, verified via official docs

Groq Whisper accepts: **flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm**

The R2 `recording` category MIME allowlist must cover these:
```
audio/mpeg, audio/mp4, audio/mp3, audio/wav, audio/ogg, audio/webm, audio/flac, audio/x-m4a, video/mp4, video/webm
```

No server-side format conversion needed — all common recording formats are natively accepted.

### File Size Cap: 25MB (HIGH confidence)

Groq Whisper free tier: **25MB maximum** per file. This matches the phase requirement exactly. No chunking needed — reject at presign time rather than at Groq API time. R2 presign route must add a `recording` category with `maxSize = 25 * 1024 * 1024`.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── db/
│   ├── schema/
│   │   └── workshops.ts          # ADD: workshopStatusEnum, status column, reviewStatusEnum, workshopEvidenceChecklist table
│   └── migrations/
│       └── 0010_workshop_lifecycle.sql   # DDL: workshop_status enum, workshops.status, workshop_evidence_checklist table, workshop_artifacts.review_status
├── server/
│   └── routers/
│       └── workshop.ts           # ADD: transition mutation, approveArtifact mutation, listChecklist query
├── lib/
│   ├── llm.ts                    # NEW: Groq SDK wrapper with requireEnv + max_tokens enforcement
│   └── constants.ts              # ADD: WORKSHOP_TRANSITION, WORKSHOP_ARTIFACT_APPROVE action constants
├── inngest/
│   ├── events.ts                 # ADD: workshopCompletedEvent, workshopRecordingUploadedEvent + send helpers
│   └── functions/
│       ├── workshop-completed.ts           # NEW: auto-creates checklist + nudge sleeps
│       ├── workshop-recording-processed.ts # NEW: fetch R2 → Whisper → llama → store artifacts
│       └── index.ts              # ADD: workshopCompletedFn, workshopRecordingProcessedFn

app/(workspace)/workshops/[id]/
├── page.tsx                      # ADD: status badge + transition button(s) for canManage users; evidence checklist section
└── _components/
    ├── status-transition-button.tsx   # NEW: renders next-state CTA based on current status
    └── evidence-checklist.tsx         # NEW: table of 5 required slots with fill status badges
```

### Pattern 1: Workshop Status Machine — Schema

The `workshops` table has no `status` column today. Add via migration 0010:

```sql
-- migration: 0010_workshop_lifecycle.sql
CREATE TYPE workshop_status AS ENUM ('upcoming', 'in_progress', 'completed', 'archived');

ALTER TABLE workshops ADD COLUMN status workshop_status NOT NULL DEFAULT 'upcoming';

-- Evidence checklist table
CREATE TYPE checklist_slot AS ENUM (
  'registration_export', 'screenshot', 'recording', 'attendance', 'summary'
);
CREATE TYPE checklist_slot_status AS ENUM ('empty', 'filled');

CREATE TABLE workshop_evidence_checklist (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id  UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  slot         checklist_slot NOT NULL,
  status       checklist_slot_status NOT NULL DEFAULT 'empty',
  artifact_id  UUID REFERENCES evidence_artifacts(id) ON DELETE SET NULL,
  filled_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workshop_id, slot)
);

-- Review status on workshop_artifacts
CREATE TYPE artifact_review_status AS ENUM ('draft', 'approved');
ALTER TABLE workshop_artifacts ADD COLUMN review_status artifact_review_status NOT NULL DEFAULT 'approved';
-- Existing artifacts default to 'approved' — only LLM-generated ones start as 'draft'
```

**Drizzle schema additions (workshops.ts):**

```typescript
export const workshopStatusEnum = pgEnum('workshop_status', [
  'upcoming', 'in_progress', 'completed', 'archived',
])

// In workshops table definition, add:
status: workshopStatusEnum('status').notNull().default('upcoming'),

export const checklistSlotEnum = pgEnum('checklist_slot', [
  'registration_export', 'screenshot', 'recording', 'attendance', 'summary',
])

export const checklistSlotStatusEnum = pgEnum('checklist_slot_status', ['empty', 'filled'])

export const artifactReviewStatusEnum = pgEnum('artifact_review_status', ['draft', 'approved'])

export const workshopEvidenceChecklist = pgTable('workshop_evidence_checklist', {
  id:          uuid('id').primaryKey().defaultRandom(),
  workshopId:  uuid('workshop_id').notNull().references(() => workshops.id, { onDelete: 'cascade' }),
  slot:        checklistSlotEnum('slot').notNull(),
  status:      checklistSlotStatusEnum('status').notNull().default('empty'),
  artifactId:  uuid('artifact_id').references(() => evidenceArtifacts.id, { onDelete: 'set null' }),
  filledAt:    timestamp('filled_at', { withTimezone: true }),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('workshop_evidence_checklist_uniq').on(t.workshopId, t.slot),
])

// Also add to workshopArtifacts:
reviewStatus: artifactReviewStatusEnum('review_status').notNull().default('approved'),
```

### Pattern 2: Allowed Transitions Map

The state machine enforces valid transitions server-side:

```typescript
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  upcoming:    ['in_progress'],
  in_progress: ['completed'],
  completed:   ['archived'],
  archived:    [],   // terminal — no further transitions
}
```

The `workshop.transition` mutation:
1. Fetches current `status`
2. Validates against `ALLOWED_TRANSITIONS`
3. Updates `workshops.status`
4. Writes `workflowTransitions` row (entityType: 'workshop', fromState, toState, actorId)
5. Writes audit log via `writeAuditLog(ACTIONS.WORKSHOP_TRANSITION)`
6. If `toState === 'completed'`: fires `await sendWorkshopCompleted({ workshopId, moderatorId: ctx.user.id })`

**Permission guard:** `requirePermission('workshop:manage')` — already grants Admin and Workshop Moderator.

**Audit pattern (from `workflowTransitions` — same table used by feedback/CR):**

```typescript
await db.insert(workflowTransitions).values({
  entityType: 'workshop',
  entityId: input.workshopId,
  fromState: existing.status,
  toState: input.toStatus,
  actorId: ctx.user.id,
  metadata: { action: 'workshop.transition' },
})
```

### Pattern 3: New Inngest Events

Following the three-step pattern from `src/inngest/events.ts`:

```typescript
// workshop.completed — fired when workshop transitions to 'completed'
const workshopCompletedSchema = z.object({
  workshopId:  z.guid(),
  moderatorId: z.guid(),   // createdBy of the workshop = who receives nudge emails
})
export const workshopCompletedEvent = eventType('workshop.completed', { schema: workshopCompletedSchema })
export type WorkshopCompletedData = z.infer<typeof workshopCompletedSchema>
export async function sendWorkshopCompleted(data: WorkshopCompletedData): Promise<void> {
  const event = workshopCompletedEvent.create(data)
  await event.validate()
  await inngest.send(event)
}

// workshop.recording_uploaded — fired when moderator attaches a recording artifact
const workshopRecordingUploadedSchema = z.object({
  workshopId:  z.guid(),
  artifactId:  z.guid(),   // workshopArtifacts.id (not evidenceArtifacts.id)
  r2Key:       z.string(), // storage key for fetching from R2 in the fn
  moderatorId: z.guid(),
})
export const workshopRecordingUploadedEvent = eventType('workshop.recording_uploaded', {
  schema: workshopRecordingUploadedSchema,
})
export async function sendWorkshopRecordingUploaded(
  data: z.infer<typeof workshopRecordingUploadedSchema>
): Promise<void> {
  const event = workshopRecordingUploadedEvent.create(data)
  await event.validate()
  await inngest.send(event)
}
```

### Pattern 4: workshopCompletedFn — Evidence Checklist + Nudges

Model on `feedbackReviewedFn`. The nudge timing uses `step.sleepUntil`:

```typescript
export const workshopCompletedFn = inngest.createFunction(
  {
    id: 'workshop-completed',
    name: 'Workshop completed — create checklist + nudge moderator',
    retries: 3,
    triggers: [{ event: workshopCompletedEvent }],
  },
  async ({ event, step }) => {
    const { workshopId, moderatorId } = event.data

    // Step 1: auto-create evidence checklist rows (idempotent)
    await step.run('create-checklist', async () => {
      const SLOTS = ['registration_export', 'screenshot', 'recording', 'attendance', 'summary']
      for (const slot of SLOTS) {
        await db.insert(workshopEvidenceChecklist)
          .values({ workshopId, slot })
          .onConflictDoNothing()  // idempotent: safe on retry
      }
    })

    // Step 2: sleep 72 hours
    await step.sleepUntil('sleep-72h', new Date(Date.now() + 72 * 60 * 60 * 1000))

    // Step 3: check if any slots still empty, nudge if so
    await step.run('nudge-72h', async () => {
      const emptySlots = await db.select()
        .from(workshopEvidenceChecklist)
        .where(and(
          eq(workshopEvidenceChecklist.workshopId, workshopId),
          eq(workshopEvidenceChecklist.status, 'empty'),
        ))
      if (emptySlots.length === 0) return { skipped: true }

      const moderator = await db.select({ email: users.email, name: users.name })
        .from(users).where(eq(users.id, moderatorId)).limit(1)
      const email = moderator[0]?.email
      if (!email) return { skipped: true, reason: 'no email' }

      await sendNudgeEmail(email, { workshopId, emptySlots: emptySlots.map(s => s.slot), delayLabel: '72 hours' })
    })

    // Step 4: sleep another 5 days (total 7d after completion)
    await step.sleepUntil('sleep-7d', new Date(Date.now() + (7 * 24 - 72) * 60 * 60 * 1000))

    // Step 5: re-check and nudge again
    await step.run('nudge-7d', async () => {
      // same pattern as nudge-72h
    })
  },
)
```

**Key insight:** `step.sleepUntil` is the correct pattern for fixed delays (not cron). Inngest pauses the function at the sleep step and resumes it at the target time — the function does not consume compute during sleep. This is the canonical Inngest approach for "N time after event X" nudges.

**sleepUntil timestamp from event time:** The `step.sleepUntil` timestamp should be computed relative to `event.ts` (the event send timestamp), not `Date.now()` inside the handler — otherwise retries shift the timer. Use:

```typescript
const completedAt = new Date(event.ts)  // Inngest event timestamp
await step.sleepUntil('sleep-72h', new Date(completedAt.getTime() + 72 * 60 * 60 * 1000))
```

### Pattern 5: workshopRecordingProcessedFn — Transcription + Summary

```typescript
export const workshopRecordingProcessedFn = inngest.createFunction(
  {
    id: 'workshop-recording-processed',
    name: 'Workshop recording — transcribe + summarize via Groq',
    retries: 2,   // fewer retries: Groq calls are expensive
    triggers: [{ event: workshopRecordingUploadedEvent }],
  },
  async ({ event, step }) => {
    const { workshopId, artifactId, r2Key, moderatorId } = event.data

    // Step 1: fetch recording binary from R2
    const audioBuffer = await step.run('fetch-recording', async () => {
      const { getDownloadUrl } = await import('@/src/lib/r2')
      const url = await getDownloadUrl(r2Key, 300)  // 5-min presigned GET
      const res = await fetch(url)
      if (!res.ok) throw new Error(`R2 fetch failed: ${res.status}`)
      const ab = await res.arrayBuffer()
      return Buffer.from(ab).toString('base64')  // serialize for Inngest step memoization
    })

    // Step 2: transcribe via Groq Whisper
    const transcript = await step.run('transcribe', async () => {
      const { transcribeAudio } = await import('@/src/lib/llm')
      const buf = Buffer.from(audioBuffer, 'base64')
      return await transcribeAudio(buf, 'recording.mp3')
    })

    // Step 3: summarize via Groq llama
    const summary = await step.run('summarize', async () => {
      const { summarizeTranscript } = await import('@/src/lib/llm')
      return await summarizeTranscript(transcript)
    })

    // Step 4: store transcript + summary as draft artifacts
    await step.run('store-artifacts', async () => {
      // Insert transcript artifact
      const [transcriptArtifact] = await db.insert(evidenceArtifacts).values({
        title: 'Workshop Transcript (draft)',
        type: 'file',
        url: '',  // no separate file — content stored in description or a new column
        uploaderId: moderatorId,
      }).returning()
      await db.insert(workshopArtifacts).values({
        workshopId,
        artifactId: transcriptArtifact.id,
        artifactType: 'summary',
        reviewStatus: 'draft',
      })
      // Same for summary artifact
    })
  },
)
```

**Step timeout concern:** Groq Whisper-large-v3-turbo runs at 216x real-time. A 25MB MP3 (~25 minutes of audio at 128kbps) takes < 10 seconds to transcribe at that rate. Within any serverless step timeout. No chunking needed.

**Inngest step serialization:** `step.run` return values are JSON-serialized between steps. A `Buffer` cannot be returned directly. Serialize to base64 string in `fetch-recording`, deserialize at the start of `transcribe`. This is the correct pattern for binary data in Inngest steps.

### Pattern 6: src/lib/llm.ts Wrapper

```typescript
// src/lib/llm.ts
import Groq, { toFile } from 'groq-sdk'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

// Lazy initialization — Groq SDK validates API key at construction
let _client: Groq | null = null
function getClient(): Groq {
  if (!_client) {
    _client = new Groq({ apiKey: requireEnv('GROQ_API_KEY') })
  }
  return _client
}

/**
 * Chat completion with enforced max_tokens (LLM-03).
 * Every call MUST specify maxTokens — there is no default that passes through.
 */
export async function chatComplete(opts: {
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  maxTokens: number   // REQUIRED — LLM-03 enforcement
  temperature?: number
}): Promise<string> {
  const client = getClient()
  const completion = await client.chat.completions.create({
    model: opts.model,
    messages: opts.messages,
    max_completion_tokens: opts.maxTokens,  // groq-sdk v1.x param name
    temperature: opts.temperature ?? 0.3,
  })
  return completion.choices[0]?.message?.content ?? ''
}

/**
 * Transcribe audio buffer via Groq Whisper (LLM-02).
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  fileName: string,
): Promise<string> {
  const client = getClient()
  const file = await toFile(audioBuffer, fileName)
  const result = await client.audio.transcriptions.create({
    model: 'whisper-large-v3-turbo',
    file,
    response_format: 'text',
  })
  return result as unknown as string  // response_format: 'text' returns string not object
}

/**
 * Summarize a workshop transcript via llama-3.1-8b-instant (LLM-03).
 * Returns structured JSON with discussion points, decisions, action items.
 */
export async function summarizeTranscript(transcript: string): Promise<{
  discussionPoints: string[]
  decisions: string[]
  actionItems: string[]
}> {
  const raw = await chatComplete({
    model: 'llama-3.1-8b-instant',
    maxTokens: 1024,
    messages: [{
      role: 'system',
      content: 'You are a policy workshop summarizer. Return JSON only, no prose wrapper.',
    }, {
      role: 'user',
      content: `Summarize this workshop transcript into JSON with keys: discussionPoints (array), decisions (array), actionItems (array).\n\nTranscript:\n${transcript}`,
    }],
  })
  // Parse JSON — if parsing fails, return structured fallback
  try {
    return JSON.parse(raw)
  } catch {
    return { discussionPoints: [raw], decisions: [], actionItems: [] }
  }
}
```

### Pattern 7: R2 Upload Route — Recording Category

Add to `app/api/upload/route.ts`:

```typescript
// In MAX_FILE_SIZE:
recording: 25 * 1024 * 1024,  // 25MB — Groq Whisper free-tier limit (LLM-02)

// In ALLOWED_TYPES:
recording: [
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/wav', 'audio/ogg',
  'audio/webm', 'audio/flac', 'audio/x-m4a',
  'video/mp4', 'video/webm',  // video containers used for recordings
],
```

The `POST /api/upload` handler already reads `category` from body — no structural change needed. The 25MB check is already implemented in the generic `fileSize > maxSize` guard.

**Trigger point:** The `workshop.attachArtifact` tRPC mutation is the callsite that calls `uploadFile`. After a successful attach with `artifactType === 'recording'`, the mutation must fire `await sendWorkshopRecordingUploaded(...)`. Add the `r2Key` to the `attachArtifact` mutation input so it can pass it through to the event.

### Pattern 8: Nudge Email

A new `sendWorkshopEvidenceNudgeEmail` function in `src/lib/email.ts`:

```typescript
export async function sendWorkshopEvidenceNudgeEmail(
  to: string,
  opts: { workshopTitle: string; workshopId: string; emptySlots: string[]; delayLabel: string }
): Promise<void> {
  if (!resend || !to) return
  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `Evidence checklist reminder: ${opts.workshopTitle}`,
    text: `Your workshop "${opts.workshopTitle}" has ${opts.emptySlots.length} unfilled evidence slot(s) (${opts.emptySlots.join(', ')}) after ${opts.delayLabel}. Upload at: /workshops/${opts.workshopId}`,
  })
}
```

The function needs the workshop title — the `workshopCompletedFn` must fetch it in the `create-checklist` step and carry it forward via the step return value or re-fetch before the nudge step.

### Pattern 9: Artifact Review Flow (WS-14 draft → approved)

New mutation `workshop.approveArtifact`:

```typescript
approveArtifact: requirePermission('workshop:manage')
  .input(z.object({
    workshopId: z.string().uuid(),
    workshopArtifactId: z.string().uuid(),  // the workshopArtifacts.id, not evidenceArtifacts.id
  }))
  .mutation(async ({ ctx, input }) => {
    await db.update(workshopArtifacts)
      .set({ reviewStatus: 'approved' })
      .where(and(
        eq(workshopArtifacts.id, input.workshopArtifactId),
        eq(workshopArtifacts.workshopId, input.workshopId),
      ))
    writeAuditLog({
      actorId: ctx.user.id,
      actorRole: ctx.user.role,
      action: ACTIONS.WORKSHOP_ARTIFACT_APPROVE,
      entityType: 'workshop',
      entityId: input.workshopId,
      payload: { workshopArtifactId: input.workshopArtifactId },
    }).catch(console.error)
    return { success: true }
  }),
```

**Visibility rule:** `listArtifacts` query must filter: non-admin/moderator roles only see artifacts where `reviewStatus = 'approved'`. Admins and workshop moderators see all including `draft`.

### Pattern 10: Admin UI — Status Transition Button

The existing `app/(workspace)/workshops/[id]/page.tsx` is a client component with `canManage` check. Add a status transition button:

```tsx
// Status badge + next-state transition button (canManage only)
{canManage && workshop.status !== 'archived' && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => transitionMutation.mutate({
      workshopId,
      toStatus: ALLOWED_TRANSITIONS[workshop.status][0],  // next valid state
    })}
    disabled={transitionMutation.isPending}
  >
    {TRANSITION_LABELS[workshop.status]}  {/* e.g. "Mark In Progress" */}
  </Button>
)}
```

The `TRANSITION_LABELS` map: `upcoming → 'Mark In Progress'`, `in_progress → 'Mark Completed'`, `completed → 'Archive'`.

### Anti-Patterns to Avoid

- **Do NOT use `step.sleep(duration)` for nudge timing** — use `step.sleepUntil(id, date)` so the sleep is keyed by a stable step ID and memoized on retry.
- **Do NOT return Buffer from a `step.run`** — Inngest JSON-serializes step results. Serialize to base64 string.
- **Do NOT call `inngest.send()` directly** — always use the `sendX()` helper from `events.ts`.
- **Do NOT use `z.uuid()` in Inngest event schemas** — use `z.guid()` per Phase 16 decision (version-0 UUIDs in test fixtures).
- **Do NOT store transcript text in `evidenceArtifacts.url`** — url is for R2 links. Store transcript text in a new `content` text column on `evidenceArtifacts`, or insert to a separate `workshopTranscripts` table. Recommendation: add `content text` to `evidenceArtifacts` in migration 0010 (nullable, only populated by LLM pipeline).
- **Do NOT use `db.transaction()`** — Neon HTTP driver compatibility.
- **Do NOT add `workshop:manage_lifecycle` as a new permission** — the existing `workshop:manage` (Admin + Workshop Moderator) is the correct guard for state transitions. Adding a new permission is unnecessary friction.

---

## Schema Summary — What Exists vs. What's New

| Object | Exists? | Phase 17 Change |
|--------|---------|-----------------|
| `workshops.status` | NO | Add `workshop_status` enum + column, default `'upcoming'` |
| `workshopEvidenceChecklist` | NO | New table with 5 enum slots |
| `workshop_artifacts.review_status` | NO | Add `artifact_review_status` enum + column, default `'approved'` |
| `workshop_artifacts.id` (PK) | NO | Currently no PK — only `(workshopId, artifactId)` composite | Must add `id uuid PK` or use composite key for approveArtifact |
| `evidenceArtifacts.content` | NO | Add nullable `content text` for transcript/summary text storage |
| `workflowTransitions` | YES | Reuse as-is for workshop transitions |

**Important schema discovery:** `workshopArtifacts` currently has NO primary key column `id` — the current schema only has `workshopId`, `artifactId`, and `artifactType`. The `approveArtifact` mutation needs to identify a specific artifact. Options:
- Option A: Add `id uuid PK DEFAULT gen_random_uuid()` to `workshopArtifacts` in migration 0010 (recommended — makes the table addressable).
- Option B: Use `(workshopId, artifactId)` composite as the address in `approveArtifact` input.

**Recommendation: Option A** — adds a proper PK, consistent with all other entity tables, and the `workshop.recording_uploaded` event already needs to reference a specific `workshopArtifacts` row.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timed nudges | Cron job + polling | `step.sleepUntil` in Inngest | Durable, survives restarts, no separate cron infra |
| Audio transcription | Custom Whisper model | `groq-sdk` `audio.transcriptions.create` | Groq handles model deployment, GPU, rate-limiting |
| LLM retries | Custom retry loop | Inngest `retries: 2` + plain Error bubble | Inngest step retry handles transient Groq failures |
| State machine enforcement | If/else chain in UI | Server-side `ALLOWED_TRANSITIONS` map + DB update | Client can be spoofed; enforce server-side |
| Workflow audit | Custom log table | Existing `workflowTransitions` table | Already used by feedback/CR; same Drizzle schema |
| Binary serialization between steps | Custom encoding | base64 string via `Buffer.toString('base64')` | JSON-safe; Inngest memoizes per step ID |

---

## Common Pitfalls

### Pitfall 1: `step.sleepUntil` vs `step.sleep` timing drift
**What goes wrong:** Using `step.sleep(duration)` with a relative duration on retry shifts the nudge timer by the retry delay. A function retried at +1h with `sleep(72h)` sends the nudge at +73h instead of +72h from completion.
**Why it happens:** `step.sleep` is relative to the moment it executes; `step.sleepUntil` is an absolute timestamp that Inngest memoizes after the first execution.
**How to avoid:** Always compute the absolute target time from `event.ts` (Inngest sets this at emit time) and pass it to `step.sleepUntil`.

### Pitfall 2: Inngest step result serialization (Buffer not JSON-safe)
**What goes wrong:** `step.run('fetch-recording', async () => { return buffer })` — Inngest serializes the return value as JSON. A Node.js `Buffer` serializes as `{"type":"Buffer","data":[...]}` which may not deserialize correctly in the next step.
**Why it happens:** Inngest checkpoints step results as JSON to its own state store.
**How to avoid:** Serialize Buffer to base64 string (`buf.toString('base64')`) inside the step and deserialize with `Buffer.from(str, 'base64')` at the start of the next step.

### Pitfall 3: Groq `response_format: 'text'` returns string not object
**What goes wrong:** TypeScript infers the return of `audio.transcriptions.create` as `Transcription` (an object with a `.text` property). When `response_format: 'text'`, Groq actually returns a raw string.
**Why it happens:** The SDK type definition doesn't differentiate by `response_format`.
**How to avoid:** Cast: `return result as unknown as string`. Documented in `llm.ts` with a comment.

### Pitfall 4: Transcript storage — evidenceArtifacts.url is for URLs, not text content
**What goes wrong:** Storing transcript text in `evidenceArtifacts.url` column passes TypeScript type check but violates the schema's intent (url is for R2 object URLs or external links) and breaks any URL-validation logic added in future phases.
**How to avoid:** Add a nullable `content text` column to `evidenceArtifacts` in migration 0010. Transcript text goes in `content`; `url` stays blank or points to a future R2 text file.

### Pitfall 5: workshopArtifacts has no standalone PK — approveArtifact cannot address rows
**What goes wrong:** The current `workshopArtifacts` table has no `id` column. `approveArtifact` needs to reference a specific row. Without a PK, you must use the composite `(workshopId, artifactId)` — but the Inngest event carries `workshopArtifactId` which won't resolve.
**How to avoid:** Add `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` to `workshopArtifacts` in migration 0010. Pass this `id` in the `workshop.recording_uploaded` event payload and in the `approveArtifact` mutation input.

### Pitfall 6: `attachArtifact` mutation must fire Inngest event but has no r2Key
**What goes wrong:** The current `attachArtifact` mutation receives `url` (the public R2 URL) but not the R2 storage `key`. The `workshopRecordingProcessedFn` needs the key to call `getDownloadUrl` (presigned GET). The public URL is not authenticated.
**Why it happens:** `attachArtifact` input was designed before the recording pipeline requirement.
**How to avoid:** Add `r2Key: z.string().optional()` to `attachArtifact` input. When `artifactType === 'recording'` and `r2Key` is provided, fire `sendWorkshopRecordingUploaded`. The client must pass the `key` returned from `POST /api/upload`.

### Pitfall 7: workshopEvidenceChecklist slot auto-fill must be triggered
**What goes wrong:** Uploading a `recording` artifact via `attachArtifact` does NOT automatically mark the `recording` checklist slot as filled. The two systems (artifacts and checklist) are disconnected.
**How to avoid:** The `attachArtifact` mutation (after the recording pipeline fires) must also update the matching checklist slot: `db.update(workshopEvidenceChecklist).set({ status: 'filled', artifactId: ..., filledAt: new Date() }).where(...)`. Same for other artifact types — each `artifactType` maps to a checklist slot.

### Pitfall 8: Groq rate limits inside Inngest
**What goes wrong:** Groq free tier has rate limits (requests/min, tokens/min). A burst of workshop completions can cause `429` errors.
**Why it happens:** Multiple Inngest function instances running concurrently can hit rate limits.
**How to avoid:** Use `retries: 2` with plain `Error` (not `NonRetriableError`) for Groq API calls — Inngest's built-in exponential backoff handles 429s. Add `concurrency: { key: 'groq-transcription', limit: 2 }` to `workshopRecordingProcessedFn` to cap parallel transcription runs.

---

## Code Examples

### Verified: workflowTransitions write for workshop transition

```typescript
// Source: src/db/schema/workflow.ts (verified) + feedback.service.ts pattern
await db.insert(workflowTransitions).values({
  entityType: 'workshop',
  entityId: input.workshopId,
  fromState: existing.status,   // current status fetched before update
  toState: input.toStatus,
  actorId: ctx.user.id,
  metadata: { triggeredBy: 'workshop.transition' },
})
```

### Verified: step.sleepUntil pattern

```typescript
// Source: Inngest official docs (verified)
// Use event.ts as the anchor timestamp — stable across retries
const completedAt = new Date(event.ts)
await step.sleepUntil('sleep-72h', new Date(completedAt.getTime() + 72 * 60 * 60 * 1000))
```

### Verified: groq-sdk audio transcription with Buffer

```typescript
// Source: groq-typescript GitHub README (verified)
import Groq, { toFile } from 'groq-sdk'
const client = new Groq({ apiKey: process.env.GROQ_API_KEY })

// audioBuf: Node.js Buffer of the audio file
const transcription = await client.audio.transcriptions.create({
  model: 'whisper-large-v3-turbo',
  file: await toFile(audioBuf, 'recording.mp3', { type: 'audio/mpeg' }),
  response_format: 'text',
})
const text = transcription as unknown as string
```

### Verified: max_completion_tokens (groq-sdk v1.x parameter name)

```typescript
// Source: groq-sdk v1.1.2 (verified parameter name)
const completion = await client.chat.completions.create({
  model: 'llama-3.1-8b-instant',
  messages: [...],
  max_completion_tokens: 1024,  // NOT max_tokens — groq-sdk v1.x naming
  temperature: 0.3,
})
```

### Verified: onConflictDoNothing for checklist row creation

```typescript
// Source: Phase 10/16 onConflictDoNothing pattern (established)
await db.insert(workshopEvidenceChecklist)
  .values({ workshopId, slot: 'recording' })
  .onConflictDoNothing()  // UNIQUE(workshop_id, slot) — idempotent on Inngest retry
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| No `workshops.status` — all workshops look the same | `upcoming → in_progress → completed → archived` state machine | Workshop lifecycle is observable and auditable |
| No evidence checklist — moderator manually tracks | Auto-created checklist rows on completion with nudge emails | 0 forgotten uploads; nudges are automatic |
| Manual recording summary — moderator writes by hand | Groq Whisper + llama pipeline generates draft; human approves | Faster evidence production; human review gate maintained |
| Inline notification dispatch (Phase 16 pattern) | Inngest durable functions with retry safety | Nudge emails survive transient failures |

---

## Open Questions

1. **Transcript storage: `evidenceArtifacts.content` column or separate table?**
   - What we know: `evidenceArtifacts.url` is for storage URLs. Transcript text can be ~10K–100K chars.
   - What's unclear: Should this be a new nullable column on `evidenceArtifacts` (simpler schema) or a new `workshopTranscripts` table (cleaner separation)?
   - Recommendation: nullable `content text` column on `evidenceArtifacts`. Simpler migration, no new join needed for display. Phase 18's evidence pack already reads `evidenceArtifacts` — transcripts just appear as a new type.

2. **Slot auto-fill: trigger in `attachArtifact` mutation or in `workshopRecordingProcessedFn`?**
   - What we know: The checklist slot for `recording` should flip to `filled` when a recording is uploaded AND processed (transcript + summary generated). But the `screenshot`, `attendance`, etc. slots should flip when the artifact is attached.
   - Recommendation: `attachArtifact` flips the matching slot for non-recording types immediately. For `recording` type, `workshopRecordingProcessedFn` flips it in the `store-artifacts` step after LLM processing succeeds.

3. **`moderatorId` in `workshop.completed` event — use `createdBy` or transition actor?**
   - What we know: The nudge email goes to the workshop moderator. `workshops.createdBy` is the original creator. The actor who triggers the `completed` transition may be an admin.
   - Recommendation: Use `workshops.createdBy` as the `moderatorId` in the `workshop.completed` event — the creator is responsible for evidence, regardless of who pressed "Complete".

4. **`workshop:manage_lifecycle` permission or reuse `workshop:manage`?**
   - What we know: `workshop:manage` covers Admin and Workshop Moderator. The status machine transitions should be guarded by the same roles.
   - Recommendation: Reuse `workshop:manage`. No new permission needed. The roadmap decision log confirms keeping permissions lean.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| groq-sdk | LLM-01/02/03 | NOT INSTALLED | 1.1.2 on npm | None — must install |
| GROQ_API_KEY | LLM-01 | NOT IN .env.example | — | Tests mock Groq; prod blocked without key |
| R2 / AWS SDK | Recording pipeline | ✓ | ^3.1017.0 | — |
| Inngest | Workshopcompleted + recording pipeline | ✓ | 4.2.1 | — |
| Resend | Nudge emails | ✓ | 6.9.4 | Silent no-op when RESEND_API_KEY unset |
| PostgreSQL (Neon) | All | ✓ | (running) | — |

**Missing dependencies with no fallback:**
- `groq-sdk` — blocking for LLM-01/02/03. Wave 0 must `npm install groq-sdk`.
- `GROQ_API_KEY` — blocking for real transcription. All LLM calls are mocked in tests. Add to `.env.example`; live key required for smoke testing.

**Missing dependencies with fallback:**
- `RESEND_API_KEY` — nudge emails silently no-op when unset (existing pattern from `src/lib/email.ts`). Tests mock email.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`. Full validation section required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.mts` |
| Quick run command | `npm test -- --run src/inngest src/lib` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WS-06 | `workshop.transition` rejects invalid transitions (e.g. `upcoming → completed`) | unit | `npm test -- --run src/server/routers/workshop-transition.test.ts` | Wave 0 |
| WS-06 | `workshop.transition` accepts valid transition, writes workflowTransitions row | unit | same | Wave 0 |
| WS-06 | `workshop.transition` fires `workshopCompleted` event when toStatus === 'completed' | unit (mock inngest.send) | same | Wave 0 |
| WS-12 | `workshopCompletedFn` creates 5 checklist rows idempotently | unit (mock DB) | `npm test -- --run src/inngest/__tests__/workshop-completed.test.ts` | Wave 0 |
| WS-12 | `workshopCompletedFn` skips nudge when all slots filled | unit (mock DB) | same | Wave 0 |
| WS-12 | `workshopCompletedFn` sends nudge email when slots empty after 72h | unit (mock DB + email) | same | Wave 0 |
| WS-13 | `workshopEvidenceChecklist` slot `UNIQUE(workshop_id, slot)` enforced | unit (onConflictDoNothing) | same | Wave 0 |
| LLM-01 | `chatComplete` throws when GROQ_API_KEY unset | unit | `npm test -- --run src/lib/llm.test.ts` | Wave 0 |
| LLM-01 | `chatComplete` requires `maxTokens` — TS compile error without it | type-check (`tsc --noEmit`) | `npx tsc --noEmit` | — |
| LLM-02 | `transcribeAudio` calls `client.audio.transcriptions.create` with `whisper-large-v3-turbo` | unit (mock groq-sdk) | `npm test -- --run src/lib/llm.test.ts` | Wave 0 |
| LLM-03 | `chatComplete` passes `max_completion_tokens` to Groq SDK | unit (mock groq-sdk) | same | Wave 0 |
| WS-14 | `workshopRecordingProcessedFn` fetches R2, calls transcribe, calls summarize, stores draft artifacts | unit (mock R2 + Groq) | `npm test -- --run src/inngest/__tests__/workshop-recording-processed.test.ts` | Wave 0 |
| WS-14 | `approveArtifact` flips `reviewStatus` to `'approved'` | unit (mock DB) | `npm test -- --run src/server/routers/workshop-transition.test.ts` | Wave 0 |

**Manual smoke walks (procedure documented, execution deferred to milestone-end batch per project workflow preference):**
- Complete a workshop (upcoming → in_progress → completed) and verify Inngest Dev UI shows `workshop-completed` run with 5 checklist rows created.
- Upload a recording file < 25MB and verify `workshop-recording-processed` run completes with transcript + summary artifacts in `draft` state in the artifact list.
- Try uploading a > 25MB file and verify 400 rejection at the presign step.
- Wait (or manually trigger) nudge step and verify email in Resend dashboard.
- Approve a transcript artifact and verify it becomes visible in the artifact list.

These procedures will be documented in a `17-SMOKE.md` placeholder with `status: deferred`.

### Sampling Rate
- **Per task commit:** `npm test -- --run src/inngest src/lib`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green (excluding 2 pre-existing failures in `feedback-permissions.test.ts` and `section-assignments.test.ts` documented in Phase 16 `deferred-items.md`) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/llm.test.ts` — covers LLM-01 (requireEnv), LLM-02 (transcribeAudio mock), LLM-03 (max_completion_tokens enforcement)
- [ ] `src/inngest/__tests__/workshop-completed.test.ts` — covers WS-12/WS-13 (checklist creation, nudge skip/fire)
- [ ] `src/inngest/__tests__/workshop-recording-processed.test.ts` — covers WS-14 (R2 fetch → transcribe → summarize → store)
- [ ] `src/server/routers/workshop-transition.test.ts` — covers WS-06 (valid/invalid transitions, audit write, event fire)
- [ ] `npm install groq-sdk` — required before any llm.ts import compiles
- [ ] `GROQ_API_KEY=` added to `.env.example`

**Mocking strategy for groq-sdk in tests:**
```typescript
// vi.mock pattern (from notification-dispatch.test.ts precedent)
const mocks = vi.hoisted(() => ({
  transcriptionsMock: vi.fn().mockResolvedValue('mocked transcript text'),
  chatCompletionsMock: vi.fn().mockResolvedValue({
    choices: [{ message: { content: '{"discussionPoints":[],"decisions":[],"actionItems":[]}' } }]
  }),
}))

vi.mock('groq-sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    audio: { transcriptions: { create: mocks.transcriptionsMock } },
    chat: { completions: { create: mocks.chatCompletionsMock } },
  })),
  toFile: vi.fn().mockResolvedValue('mock-file'),
}))
```

---

## Sources

### Primary (HIGH confidence — source code read directly)
- `src/db/schema/workshops.ts` — confirms NO `status` column, NO `id` PK on `workshopArtifacts`
- `src/server/routers/workshop.ts` — confirms existing 12 procedures, `attachArtifact` input shape
- `src/db/schema/workflow.ts` — confirms `workflowTransitions` table shape for audit writes
- `src/lib/permissions.ts` — confirms `workshop:manage` = Admin + Workshop Moderator
- `src/lib/constants.ts` — confirms ACTIONS object shape for new constants
- `src/lib/r2.ts` + `src/lib/r2-upload.ts` — confirms R2 client, `getDownloadUrl`, `generateStorageKey`
- `app/api/upload/route.ts` — confirms current categories (image/document/evidence), 32MB limits, MIME allowlists; `recording` category MISSING
- `src/inngest/events.ts` — confirms event registry pattern, `z.guid()` requirement, send helper shape
- `src/inngest/functions/feedback-reviewed.ts` — reference implementation for step.run pattern, NonRetriableError usage
- `src/inngest/functions/notification-dispatch.ts` — reference for 3-step function structure
- `src/inngest/__tests__/notification-dispatch.test.ts` — confirmed vi.hoisted + mock pattern for Inngest tests
- `src/lib/email.ts` — confirmed Resend integration shape for new nudge email function
- `package.json` — confirmed groq-sdk NOT installed; inngest@4.2.1, resend@6.9.4 installed
- `.env.example` — confirmed GROQ_API_KEY NOT present
- `.planning/config.json` — confirmed `nyquist_validation: true`
- `src/db/migrations/` — confirmed next migration number is 0010

### Secondary (MEDIUM confidence — verified with official sources)
- Groq Whisper docs at console.groq.com/docs/speech-to-text — confirmed accepted audio formats (flac/mp3/mp4/mpeg/mpga/m4a/ogg/wav/webm), 25MB free-tier limit
- groq-typescript GitHub README — confirmed `toFile` helper, `audio.transcriptions.create`, `max_completion_tokens` parameter name in v1.x
- Inngest docs at inngest.com/docs — confirmed `step.sleepUntil` for absolute-time sleeps; each step runs as an independent invocation with platform-native timeout

### Tertiary (LOW confidence — not required for planning, informational)
- WebSearch results confirming groq-sdk@1.1.2 is latest npm version

---

## Metadata

**Confidence breakdown:**
- Schema changes needed: HIGH — read workshops.ts directly; `status` column absence confirmed
- Inngest patterns: HIGH — modeled on existing feedbackReviewedFn + notificationDispatchFn source
- groq-sdk API shape: HIGH — verified via official Groq docs + GitHub README
- step.sleepUntil timing: HIGH — confirmed via Inngest official docs
- max_completion_tokens param name: MEDIUM — confirmed via groq-sdk README but not type-checked directly
- R2 recording category gap: HIGH — read upload route.ts directly

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (groq-sdk moves fast; re-verify `max_completion_tokens` vs `max_tokens` if > 30 days pass)

# Flow 5 — Revision Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the post-decision side-effects of the `feedback.decide` tRPC mutation (email + notification) into a durable Inngest background function, and add a new step that auto-drafts a change request whenever a feedback item is accepted or partially accepted.

**Architecture:** The tRPC mutation stops doing fire-and-forget side-effects inline. After `transitionFeedback` succeeds, the router emits a typed `feedback.reviewed` event via the `sendFeedbackReviewed` helper in `src/inngest/events.ts`. A new Inngest function `feedbackReviewedFn` subscribes to that event and executes the side-effects as idempotent `step.run` calls: fetch feedback context, create the in-app notification, send the email, and — only when the decision is `accept` or `partially_accept` — insert a new `drafting`-status change request linked to the feedback item and its section. Pure content-building logic (notification copy, CR title/description) lives in `src/inngest/lib/` with unit tests; DB side-effects live in thin wrappers called from inside `step.run` blocks.

**Tech Stack:** Inngest v4 (managed, already bootstrapped), Drizzle ORM, Neon Postgres, tRPC 11, Zod v4, Vitest (jsdom, `src/**/*.test.ts` glob).

---

## Scope notes (read before starting)

- **Keep Flow 5 small.** We are not touching the XState state machine, the audit log call, the `transitionFeedback` service, or the "feedback under review" notification at line 343 of `src/server/routers/feedback.ts`. Only the **post-decide** side-effects at lines 425–448 move.
- **Fire-and-forget becomes awaited.** The current router does `createNotification(...).catch(console.error)` and `sendFeedbackReviewedEmail(...).catch(console.error)` and throws those away. After this refactor, the router instead `await`s a single `sendFeedbackReviewed(...)` call that posts to Inngest. If Inngest is down, the mutation fails visibly — which is correct. Inngest itself handles retries once the event is accepted.
- **`transitionFeedback` still runs first.** The event is emitted only after `transitionFeedback` returns successfully. If the state transition fails, no event fires. Do not move the `transitionFeedback` call into the Inngest function.
- **Auto-draft CR reuses the existing `cr_id_seq` Postgres sequence.** Read `src/server/routers/changeRequest.ts:29-34` for the pattern (`SELECT nextval('cr_id_seq')` → `CR-NNN`). Do not invent a new sequence.
- **Owner of an auto-drafted CR = the reviewer.** Not the feedback submitter. The reviewer is the one who made the decision, so they own the draft until they edit or discard it.
- **CR status starts at `drafting`.** The default from the schema. Do not flip it to `in_review`.
- **Auditing is out of scope.** The existing `writeAuditLog` call for the decide action stays in the router. We are not adding an additional audit log for the auto-draft CR in this plan — that can be a follow-up if the product wants it.
- **No database migration.** All tables and sequences already exist (`feedbackItems`, `changeRequests`, `crFeedbackLinks`, `crSectionLinks`, `cr_id_seq`).

## File Structure

**New files:**
- `src/inngest/lib/feedback-reviewed-copy.ts` — pure function that builds notification title/body + email-friendly labels from a decision value and section name. Unit tested.
- `src/inngest/lib/auto-draft-cr-content.ts` — pure function that builds CR title + description from a feedback row + rationale. Unit tested.
- `src/inngest/lib/create-draft-cr.ts` — thin DB wrapper that allocates a `CR-NNN` readableId, inserts the `changeRequests` row, and inserts the `crFeedbackLinks` + `crSectionLinks` rows. Not unit tested (integration smoked).
- `src/inngest/functions/feedback-reviewed.ts` — Inngest function definition. Step chain: fetch context → notify → email → conditional auto-draft.
- `src/inngest/__tests__/feedback-reviewed-copy.test.ts` — Vitest tests for the copy builder.
- `src/inngest/__tests__/auto-draft-cr-content.test.ts` — Vitest tests for the CR content builder.

**Modified files:**
- `src/inngest/events.ts` — append `feedbackReviewedEvent` + `sendFeedbackReviewed` helper. (~35 lines added.)
- `src/inngest/functions/index.ts` — one import + append to the `functions` array. (2 lines changed.)
- `src/server/routers/feedback.ts` — replace the post-decide fire-and-forget block (lines 396–448) with a single awaited `sendFeedbackReviewed` call and tidy up the imports. (~50 lines removed, ~10 lines added.)

---

## Task 1: Declare the `feedback.reviewed` event

**Files:**
- Modify: `src/inngest/events.ts` (append after the existing `sample.hello` block)

- [ ] **Step 1: Open `src/inngest/events.ts` and read the existing `sample.hello` block for pattern reference**

The file already follows a three-step shape: Zod schema → `eventType()` instance → `sendX()` helper that calls `event.validate()` before `inngest.send(event)`. The new event MUST follow the same shape. See `src/inngest/events.ts:42-70`.

- [ ] **Step 2: Append the new event block to `src/inngest/events.ts`**

Add this block at the bottom of the file, after the existing `sendSampleHello` function:

```ts
// -- feedback.reviewed ----------------------------------------------------

const feedbackReviewedSchema = z.object({
  feedbackId: z.string().uuid(),
  decision: z.enum(['accept', 'partially_accept', 'reject']),
  // Rationale is required by the decide mutation (min 20 chars). We mirror
  // the lower bound here rather than copying the 20-char rule, because this
  // schema guards the wire contract to Inngest, not the product rule.
  rationale: z.string().min(1).max(2000),
  reviewedByUserId: z.string().uuid(),
})

export const feedbackReviewedEvent = eventType('feedback.reviewed', {
  schema: feedbackReviewedSchema,
})

export type FeedbackReviewedData = z.infer<typeof feedbackReviewedSchema>

export async function sendFeedbackReviewed(
  data: FeedbackReviewedData,
): Promise<void> {
  const event = feedbackReviewedEvent.create(data)
  await event.validate()
  await inngest.send(event)
}
```

- [ ] **Step 3: Run typecheck to confirm the new event compiles**

Run: `npx tsc --noEmit`
Expected: no errors introduced by `src/inngest/events.ts`. Pre-existing errors in unrelated files (if any) are fine; only the lines you just added must be clean.

- [ ] **Step 4: Commit**

```bash
git add src/inngest/events.ts
git commit -m "feat(inngest): declare feedback.reviewed event"
```

---

## Task 2: Pure copy builder for notification text

**Files:**
- Create: `src/inngest/lib/feedback-reviewed-copy.ts`
- Test: `src/inngest/__tests__/feedback-reviewed-copy.test.ts`

The router currently builds this map inline (see `src/server/routers/feedback.ts:408-421`). We lift it into a pure function so the Inngest function can call it, and so it can be tested in isolation.

- [ ] **Step 1: Write the failing test**

Create `src/inngest/__tests__/feedback-reviewed-copy.test.ts` with this exact content:

```ts
import { describe, it, expect } from 'vitest'
import { buildFeedbackReviewedCopy } from '../lib/feedback-reviewed-copy'

describe('buildFeedbackReviewedCopy', () => {
  it('produces an accepted-copy variant for decision=accept', () => {
    const copy = buildFeedbackReviewedCopy({
      decision: 'accept',
      sectionName: 'Section 3: Consent',
      rationale: 'Clear, actionable, well-scoped.',
    })

    expect(copy.title).toBe('Feedback accepted')
    expect(copy.body).toContain('Section 3: Consent')
    expect(copy.body).toContain('Clear, actionable, well-scoped.')
  })

  it('produces a partially-accepted variant that does NOT include rationale', () => {
    const copy = buildFeedbackReviewedCopy({
      decision: 'partially_accept',
      sectionName: 'Section 3: Consent',
      rationale: 'Some points valid, others not.',
    })

    expect(copy.title).toBe('Feedback partially accepted')
    expect(copy.body).toContain('Section 3: Consent')
    expect(copy.body).not.toContain('Some points valid')
  })

  it('produces a rejected variant that includes rationale', () => {
    const copy = buildFeedbackReviewedCopy({
      decision: 'reject',
      sectionName: 'Section 3: Consent',
      rationale: 'Out of scope for this policy.',
    })

    expect(copy.title).toBe('Feedback not accepted')
    expect(copy.body).toContain('Out of scope for this policy.')
  })

  it('truncates long rationale bodies to 80 chars plus ellipsis', () => {
    const longRationale = 'A'.repeat(200)
    const copy = buildFeedbackReviewedCopy({
      decision: 'accept',
      sectionName: 'Section 3',
      rationale: longRationale,
    })

    // 80 chars + 1 ellipsis char = 81 total for the rationale fragment
    expect(copy.body).toContain('A'.repeat(80) + '\u2026')
    expect(copy.body).not.toContain('A'.repeat(81))
  })

  it('falls back to "a section" when sectionName is empty', () => {
    const copy = buildFeedbackReviewedCopy({
      decision: 'accept',
      sectionName: '',
      rationale: 'ok',
    })

    expect(copy.body).toContain('a section')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/inngest/__tests__/feedback-reviewed-copy.test.ts`
Expected: FAIL with a module-resolution error (the implementation file does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/inngest/lib/feedback-reviewed-copy.ts` with this exact content:

```ts
export type FeedbackDecision = 'accept' | 'partially_accept' | 'reject'

export interface FeedbackReviewedCopyInput {
  decision: FeedbackDecision
  sectionName: string
  rationale: string
}

export interface FeedbackReviewedCopy {
  title: string
  body: string
}

const RATIONALE_MAX = 80

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '\u2026' : s
}

export function buildFeedbackReviewedCopy(
  input: FeedbackReviewedCopyInput,
): FeedbackReviewedCopy {
  const section = input.sectionName.trim().length > 0 ? input.sectionName : 'a section'
  const truncated = truncate(input.rationale, RATIONALE_MAX)

  switch (input.decision) {
    case 'accept':
      return {
        title: 'Feedback accepted',
        body: `Your feedback on \u201c${section}\u201d was accepted. ${truncated}`,
      }
    case 'partially_accept':
      return {
        title: 'Feedback partially accepted',
        body: `Your feedback on \u201c${section}\u201d was partially accepted.`,
      }
    case 'reject':
      return {
        title: 'Feedback not accepted',
        body: `Your feedback on \u201c${section}\u201d was not accepted. ${truncated}`,
      }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/inngest/__tests__/feedback-reviewed-copy.test.ts`
Expected: PASS, 5/5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/inngest/lib/feedback-reviewed-copy.ts src/inngest/__tests__/feedback-reviewed-copy.test.ts
git commit -m "feat(inngest): add feedback-reviewed notification copy builder"
```

---

## Task 3: Pure CR-content builder for auto-drafted change requests

**Files:**
- Create: `src/inngest/lib/auto-draft-cr-content.ts`
- Test: `src/inngest/__tests__/auto-draft-cr-content.test.ts`

When a feedback item is accepted or partially accepted, we auto-draft a change request. This function builds the `title` and `description` text from the feedback row, so the Inngest function stays declarative and the logic is unit-testable.

- [ ] **Step 1: Write the failing test**

Create `src/inngest/__tests__/auto-draft-cr-content.test.ts` with this exact content:

```ts
import { describe, it, expect } from 'vitest'
import { buildAutoDraftCRContent } from '../lib/auto-draft-cr-content'

describe('buildAutoDraftCRContent', () => {
  it('includes the feedback readable id in the title', () => {
    const result = buildAutoDraftCRContent({
      feedback: {
        readableId: 'FB-042',
        title: 'Clarify consent language',
        body: 'The word "consent" is ambiguous in paragraph 2.',
      },
      decision: 'accept',
      rationale: 'Good catch — rewriting for clarity.',
    })

    expect(result.title).toContain('FB-042')
  })

  it('truncates feedback title at 120 chars inside the CR title', () => {
    const longTitle = 'X'.repeat(300)
    const result = buildAutoDraftCRContent({
      feedback: {
        readableId: 'FB-001',
        title: longTitle,
        body: 'body',
      },
      decision: 'accept',
      rationale: 'ok',
    })

    expect(result.title.length).toBeLessThanOrEqual(200)
    expect(result.title).toContain('X'.repeat(120))
    expect(result.title).toContain('\u2026')
  })

  it('description quotes original feedback body and reviewer rationale', () => {
    const result = buildAutoDraftCRContent({
      feedback: {
        readableId: 'FB-007',
        title: 'Section is too long',
        body: 'Split paragraph 3 into two.',
      },
      decision: 'partially_accept',
      rationale: 'We will split it but reword first.',
    })

    expect(result.description).toContain('Split paragraph 3 into two.')
    expect(result.description).toContain('We will split it but reword first.')
    expect(result.description).toContain('FB-007')
  })

  it('description labels decision=accept as "Accepted"', () => {
    const result = buildAutoDraftCRContent({
      feedback: { readableId: 'FB-1', title: 't', body: 'b' },
      decision: 'accept',
      rationale: 'r',
    })
    expect(result.description).toContain('Accepted')
  })

  it('description labels decision=partially_accept as "Partially accepted"', () => {
    const result = buildAutoDraftCRContent({
      feedback: { readableId: 'FB-1', title: 't', body: 'b' },
      decision: 'partially_accept',
      rationale: 'r',
    })
    expect(result.description).toContain('Partially accepted')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/inngest/__tests__/auto-draft-cr-content.test.ts`
Expected: FAIL with a module-resolution error.

- [ ] **Step 3: Write the implementation**

Create `src/inngest/lib/auto-draft-cr-content.ts` with this exact content:

```ts
export type AutoDraftDecision = 'accept' | 'partially_accept'

export interface AutoDraftCRContentInput {
  feedback: {
    readableId: string
    title: string
    body: string
  }
  decision: AutoDraftDecision
  rationale: string
}

export interface AutoDraftCRContent {
  title: string
  description: string
}

const TITLE_MAX_FROM_FEEDBACK = 120

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '\u2026' : s
}

function decisionLabel(d: AutoDraftDecision): string {
  return d === 'accept' ? 'Accepted' : 'Partially accepted'
}

export function buildAutoDraftCRContent(
  input: AutoDraftCRContentInput,
): AutoDraftCRContent {
  const shortTitle = truncate(input.feedback.title, TITLE_MAX_FROM_FEEDBACK)
  const title = `Draft from ${input.feedback.readableId}: ${shortTitle}`

  const description = [
    `Auto-drafted from feedback ${input.feedback.readableId} (${decisionLabel(input.decision)}).`,
    '',
    'Original feedback:',
    input.feedback.body,
    '',
    'Reviewer rationale:',
    input.rationale,
  ].join('\n')

  return { title, description }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/inngest/__tests__/auto-draft-cr-content.test.ts`
Expected: PASS, 5/5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/inngest/lib/auto-draft-cr-content.ts src/inngest/__tests__/auto-draft-cr-content.test.ts
git commit -m "feat(inngest): add auto-draft CR content builder"
```

---

## Task 4: DB wrapper for creating the draft change request

**Files:**
- Create: `src/inngest/lib/create-draft-cr.ts`

This is the only non-pure library helper in the flow. It wraps the Postgres-sequence + insert + link-insert sequence so the Inngest function can call it from a single `step.run`. No unit test — it's thin glue around Drizzle, and will be integration-smoked in Task 7.

Read `src/server/routers/changeRequest.ts:28-70` for the established pattern you are mirroring. The only differences here:
- Owner = reviewer (passed in), not `ctx.user.id`
- Exactly one feedback id, not an array
- Title and description come from the pure content builder, not from user input

- [ ] **Step 1: Create `src/inngest/lib/create-draft-cr.ts` with this exact content**

```ts
import { db } from '@/src/db'
import {
  changeRequests,
  crFeedbackLinks,
  crSectionLinks,
} from '@/src/db/schema/changeRequests'
import { sql } from 'drizzle-orm'

export interface CreateDraftCRInput {
  documentId: string
  sectionId: string
  feedbackId: string
  ownerId: string
  title: string
  description: string
}

export interface CreateDraftCRResult {
  id: string
  readableId: string
}

/**
 * Allocates a CR-NNN readable id from the existing `cr_id_seq` Postgres
 * sequence, inserts a `drafting`-status change request, and inserts the
 * link rows to the triggering feedback item and its section.
 *
 * Called from inside an Inngest `step.run`, so failures bubble up to the
 * step runner and the memoized result protects against duplicate inserts
 * on retry. Do NOT call this from request-path code — use the existing
 * `changeRequest.create` tRPC mutation for that.
 */
export async function createDraftCRFromFeedback(
  input: CreateDraftCRInput,
): Promise<CreateDraftCRResult> {
  const seqRows = await db.execute(sql`SELECT nextval('cr_id_seq') AS seq`)
  const seqResult = seqRows.rows[0] as Record<string, unknown>
  const num = Number(seqResult.seq)
  const readableId = `CR-${String(num).padStart(3, '0')}`

  const [cr] = await db
    .insert(changeRequests)
    .values({
      readableId,
      documentId: input.documentId,
      ownerId: input.ownerId,
      title: input.title,
      description: input.description,
    })
    .returning({ id: changeRequests.id })

  await db.insert(crFeedbackLinks).values({
    crId: cr.id,
    feedbackId: input.feedbackId,
  })

  await db.insert(crSectionLinks).values({
    crId: cr.id,
    sectionId: input.sectionId,
  })

  return { id: cr.id, readableId }
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors in `src/inngest/lib/create-draft-cr.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/inngest/lib/create-draft-cr.ts
git commit -m "feat(inngest): add createDraftCRFromFeedback DB helper"
```

---

## Task 5: Inngest function — `feedbackReviewedFn`

**Files:**
- Create: `src/inngest/functions/feedback-reviewed.ts`
- Modify: `src/inngest/functions/index.ts`

This is the orchestrator. It listens for `feedback.reviewed`, fetches the minimum context, and runs the side effects as memoized steps. Each DB-touching block is wrapped in `step.run` so a retry does not re-execute completed work.

- [ ] **Step 1: Create `src/inngest/functions/feedback-reviewed.ts` with this exact content**

```ts
import { NonRetriableError } from 'inngest'
import { eq } from 'drizzle-orm'
import { inngest } from '../client'
import { feedbackReviewedEvent } from '../events'
import { buildFeedbackReviewedCopy } from '../lib/feedback-reviewed-copy'
import { buildAutoDraftCRContent } from '../lib/auto-draft-cr-content'
import { createDraftCRFromFeedback } from '../lib/create-draft-cr'
import { db } from '@/src/db'
import { feedbackItems } from '@/src/db/schema/feedback'
import { policySections } from '@/src/db/schema/documents'
import { users } from '@/src/db/schema/users'
import { notifications } from '@/src/db/schema/notifications'
import { sendFeedbackReviewedEmail } from '@/src/lib/email'

/**
 * Flow 5 — revision engine.
 *
 * Triggered when a reviewer decides a feedback item (accept / partially
 * accept / reject). Runs three side effects as idempotent steps:
 *
 *   1. Notify the submitter in-app (always).
 *   2. Email the submitter (always, if they have an email address).
 *   3. Auto-draft a change request (only for accept and partially_accept).
 *
 * Context is looked up inside the function rather than carried in the
 * event payload — this keeps the emit path in the router minimal, and
 * since each DB read is wrapped in `step.run` the result is memoized on
 * retry so the reads don't repeat.
 */
export const feedbackReviewedFn = inngest.createFunction(
  {
    id: 'feedback-reviewed',
    name: 'Feedback reviewed — notify, email, auto-draft CR',
    retries: 3,
    triggers: [{ event: feedbackReviewedEvent }],
  },
  async ({ event, step }) => {
    const { feedbackId, decision, rationale, reviewedByUserId } = event.data

    // Step 1: fetch the feedback row.
    const feedback = await step.run('fetch-feedback', async () => {
      const [row] = await db
        .select({
          id: feedbackItems.id,
          readableId: feedbackItems.readableId,
          submitterId: feedbackItems.submitterId,
          sectionId: feedbackItems.sectionId,
          documentId: feedbackItems.documentId,
          title: feedbackItems.title,
          body: feedbackItems.body,
        })
        .from(feedbackItems)
        .where(eq(feedbackItems.id, feedbackId))
        .limit(1)

      if (!row) {
        throw new NonRetriableError(`feedback ${feedbackId} not found`)
      }
      return row
    })

    // Step 2: fetch the section title (for notification copy).
    const sectionName = await step.run('fetch-section-name', async () => {
      const [row] = await db
        .select({ title: policySections.title })
        .from(policySections)
        .where(eq(policySections.id, feedback.sectionId))
        .limit(1)
      return row?.title ?? ''
    })

    // Step 3: fetch the submitter's email (may be null for phone-only users).
    const submitterEmail = await step.run('fetch-submitter-email', async () => {
      const [row] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, feedback.submitterId))
        .limit(1)
      return row?.email ?? null
    })

    // Step 4: insert the in-app notification.
    await step.run('insert-notification', async () => {
      const copy = buildFeedbackReviewedCopy({
        decision,
        sectionName,
        rationale,
      })
      await db.insert(notifications).values({
        userId:     feedback.submitterId,
        type:       'feedback_status_changed',
        title:      copy.title,
        body:       copy.body,
        entityType: 'feedback',
        entityId:   feedback.id,
        linkHref:   `/feedback/${feedback.id}`,
      })
    })

    // Step 5: send the email (skip if no address).
    if (submitterEmail) {
      await step.run('send-email', async () => {
        await sendFeedbackReviewedEmail(submitterEmail, {
          feedbackReadableId: feedback.readableId,
          decision,
          rationale,
        })
      })
    }

    // Step 6: auto-draft a CR for accept / partially_accept.
    if (decision === 'accept' || decision === 'partially_accept') {
      const draftCr = await step.run('auto-draft-change-request', async () => {
        const content = buildAutoDraftCRContent({
          feedback: {
            readableId: feedback.readableId,
            title: feedback.title,
            body: feedback.body,
          },
          decision,
          rationale,
        })
        return await createDraftCRFromFeedback({
          documentId: feedback.documentId,
          sectionId: feedback.sectionId,
          feedbackId: feedback.id,
          ownerId: reviewedByUserId,
          title: content.title,
          description: content.description,
        })
      })

      return {
        feedbackId: feedback.id,
        decision,
        autoDraftedCR: draftCr,
      }
    }

    return {
      feedbackId: feedback.id,
      decision,
      autoDraftedCR: null,
    }
  },
)
```

- [ ] **Step 2: Register the function in the barrel**

Open `src/inngest/functions/index.ts`. Current content:

```ts
import { helloFn } from './hello'

export const functions = [helloFn]
```

Replace with:

```ts
import { helloFn } from './hello'
import { feedbackReviewedFn } from './feedback-reviewed'

export const functions = [helloFn, feedbackReviewedFn]
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors introduced by the new function or the barrel update. If the handler shows `event.data` as `any`, the `triggers: [...]` array has been factored out to a variable — this is the v4 type-inference footgun documented in `src/inngest/README.md`. Inline the array.

- [ ] **Step 4: Commit**

```bash
git add src/inngest/functions/feedback-reviewed.ts src/inngest/functions/index.ts
git commit -m "feat(inngest): add feedback-reviewed function (Flow 5)"
```

---

## Task 6: Refactor the `feedback.decide` tRPC mutation

**Files:**
- Modify: `src/server/routers/feedback.ts` (lines 396–448, plus import cleanup near the top)

The router currently inlines section lookup + notification map + email send as fire-and-forget. We replace all of that with a single awaited `sendFeedbackReviewed` call and let the Inngest function do the work.

- [ ] **Step 1: Read the current `decide` mutation to confirm the lines you are replacing**

Open `src/server/routers/feedback.ts`. Focus on lines 357–451. The block you are **keeping** is lines 357–394 (input validation, state transition, audit log). The block you are **replacing** is lines 396–448 (the inline fire-and-forget side effects).

- [ ] **Step 2: Replace the fire-and-forget block**

In `src/server/routers/feedback.ts`, replace the entire block from the comment `// Fire-and-forget notification + email to feedback submitter` through the closing `}` of the `if (submitterUser?.email) {` block (lines 396–448 in the current file) with this exact replacement:

```ts
      // Emit Flow 5 event — the feedbackReviewedFn Inngest function handles
      // in-app notification, email, and auto-draft CR creation with retries.
      await sendFeedbackReviewed({
        feedbackId: updated.id,
        decision: input.decision,
        rationale: input.rationale,
        reviewedByUserId: ctx.user.id,
      })

      return updated
    }),
```

Note: the `return updated` line already exists at line 450. If the old `return updated` is still present after your edit, delete the duplicate. There must be exactly one `return updated` inside the `decide` mutation handler.

- [ ] **Step 3: Add the new import**

Near the top of `src/server/routers/feedback.ts`, alongside the other `@/src/inngest` or `@/src/lib` imports, add:

```ts
import { sendFeedbackReviewed } from '@/src/inngest/events'
```

- [ ] **Step 4: Remove now-unused imports**

After the refactor, the `decide` mutation no longer directly uses `sendFeedbackReviewedEmail`. Check with grep whether any OTHER mutation in the same file still uses it:

Run: `grep -n sendFeedbackReviewedEmail src/server/routers/feedback.ts`
Expected: zero matches (the only usage was in `decide`, which we just removed).

If the grep returns zero matches, delete the `sendFeedbackReviewedEmail` import line near the top of the file. If it returns matches from other mutations, leave the import alone.

Also check whether `createNotification` is still used elsewhere in the file:

Run: `grep -n 'createNotification' src/server/routers/feedback.ts`
Expected: at least one match at the earlier "feedback under review" call around line 343. Leave the `createNotification` import alone — it's still used there.

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `src/server/routers/feedback.ts`. If you see `'users' is defined but never used` or similar lint-style messages, those are fine — TypeScript typecheck does not fail on unused imports. Leave them; the next maintenance pass can clean them up.

If `tsc` actually errors about an unused import (some strict configs do), remove only the specifically named unused import from the top of the file.

- [ ] **Step 6: Run the feedback tests (if any exist)**

Run: `npx vitest run src/server/routers/feedback`
Expected: PASS or "no tests found" — either is acceptable. Do not write new router tests in this plan.

- [ ] **Step 7: Commit**

```bash
git add src/server/routers/feedback.ts
git commit -m "refactor(feedback): emit feedback.reviewed event instead of inline side effects"
```

---

## Task 7: End-to-end smoke test

**Files:**
- None modified

This task is a manual verification step that proves the refactored mutation actually drives the new Inngest function end-to-end against the dev database.

- [ ] **Step 1: Start the Next.js dev server**

Terminal 1:
```bash
npm run dev
```

Wait for the "Ready in Xms" line.

- [ ] **Step 2: Start the Inngest Dev Server**

Terminal 2:
```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Open <http://localhost:8288> in a browser. Go to the "Functions" tab. Expected: two functions listed — `sample-hello` and `feedback-reviewed`. If `feedback-reviewed` is missing, the barrel update in Task 5 did not land. Fix and re-run.

- [ ] **Step 3: Pick a real feedback item to test against**

You need a feedback item in state `under_review` (so `decide` can fire) whose submitter has an email on their user row. Any local seed data works.

If you don't have a seed feedback item, create one through the UI at <http://localhost:3000> — sign in, open a document, submit a feedback item, then as a reviewer move it to `under_review`.

Record the feedback item's UUID from the URL or the database. Call it `FEEDBACK_ID`.

- [ ] **Step 4: Trigger the decide mutation from the UI**

As a user with the `feedback:review` permission, click "Accept" on the feedback item and enter a rationale at least 20 characters long (e.g., `Good catch — will update the language in the next revision.`).

- [ ] **Step 5: Verify the Inngest run**

In the Inngest Dev UI at <http://localhost:8288>, go to the "Runs" tab. Expected:
- One run for `feedback-reviewed` in state "Completed"
- Steps visible in the timeline: `fetch-feedback`, `fetch-section-name`, `fetch-submitter-email`, `insert-notification`, `send-email` (or skipped if no email), `auto-draft-change-request`
- Run output includes `autoDraftedCR: { id: ..., readableId: "CR-XXX" }`

If the run is in "Failed" state, open it and read the failing step's error message. Common failure causes:
- Wrong feedback state (mutation wouldn't have fired the event either — check the Next.js console)
- Missing user row for `reviewedByUserId` — not a retry-worthy error, fix the seed data
- Missing section row — same

- [ ] **Step 6: Verify the DB side effects**

Pick any convenient DB inspection method (Drizzle Studio, psql, Neon dashboard). Confirm:
1. One new row in `notifications` with `userId = <submitterId>`, `type = 'feedback_status_changed'`, `title = 'Feedback accepted'`
2. One new row in `change_requests` with `readable_id` matching the run output, `status = 'drafting'`, `owner_id = <your reviewer user id>`
3. One new row in `cr_feedback_links` linking that CR to `FEEDBACK_ID`
4. One new row in `cr_section_links` linking that CR to the feedback's section

- [ ] **Step 7: Repeat with decision = reject to confirm the auto-draft step is skipped**

Repeat steps 3–5 with a different feedback item, this time clicking "Reject". Expected:
- Run completes with steps `fetch-feedback`, `fetch-section-name`, `fetch-submitter-email`, `insert-notification`, `send-email`
- NO `auto-draft-change-request` step in the timeline
- Run output: `autoDraftedCR: null`
- No new `change_requests` row was created

- [ ] **Step 8: Document the smoke test result in the commit**

This is the only task in the plan with no code to commit. Instead, write a short summary to stdout describing what you verified, then tag the last commit so the record is visible in the log:

```bash
git commit --allow-empty -m "chore: verify Flow 5 smoke test (accept + reject paths)"
```

---

## Non-goals (explicit)

These are out of scope and MUST NOT be addressed in this plan. They belong to future flows.

- Workflow reminders and deadline-based timers (Flow 7).
- Moving any other fire-and-forget email calls into Inngest (Flows 1, 2, 3).
- Adding a dashboard widget for auto-drafted CRs (frontend work, not Flow 5).
- Extending `changeRequest.service.ts` with a formal "auto-draft origin" field (schema change — separate migration).
- Adding a rate-limit / concurrency cap on `feedback-reviewed` (revisit only if product sees hot-review bursts).
- Batching multiple decisions into a single CR (explicit product decision: each decision = one CR).
- Allowing the auto-draft CR to be owned by someone other than the reviewer (no product requirement).

## Self-review checklist (run before handoff)

After finishing all tasks, confirm:
- `npx tsc --noEmit` clean across the project.
- `npx vitest run src/inngest` passes (old `buildGreeting` tests + two new suites).
- Inngest Dev UI shows `feedback-reviewed` in the Functions tab.
- Smoke test (Task 7) produced a `CR-NNN` row for accept and produced no CR for reject.
- No `.catch(console.error)` calls remain in the `decide` mutation handler body.
- The only new import added to `feedback.ts` is `sendFeedbackReviewed` from `@/src/inngest/events`.

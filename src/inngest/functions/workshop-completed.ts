import { and, eq } from 'drizzle-orm'
import { inngest } from '../client'
import { workshopCompletedEvent } from '../events'
import { db } from '@/src/db'
import {
  workshops,
  workshopEvidenceChecklist,
} from '@/src/db/schema/workshops'
import { users } from '@/src/db/schema/users'
import { sendWorkshopEvidenceNudgeEmail } from '@/src/lib/email'

/**
 * workshop-completed — evidence checklist creation + durable nudge chain.
 *
 * Triggered by `workshop.completed` events emitted from the
 * `workshop.transition` mutation (Plan 17-01) when a moderator marks a
 * workshop as completed. Runs five steps:
 *
 *   1. create-checklist: idempotently insert 5 required checklist rows,
 *      then fetch workshop title + moderator email for use in later steps
 *   2. sleep-72h: absolute-time sleep, anchored to event.ts
 *   3. nudge-72h: check for empty slots → email moderator if any
 *   4. sleep-7d: second absolute-time sleep
 *   5. nudge-7d: second check → second email
 *
 *   - WS-13: Checklist rows are created automatically on completion.
 *   - WS-12: Nudge emails fire at 72h and 7d with links back to the
 *     workshop. Empty-slot check is re-run at each wakeup.
 *
 * Timing: step.sleepUntil uses absolute timestamps computed from
 * `event.ts` (Inngest event emit time), NOT Date.now(), so retries do
 * not shift the nudge schedule. RESEARCH Pitfall 1.
 *
 * Idempotency: the checklist insert uses onConflictDoNothing against the
 * UNIQUE(workshop_id, slot) index. Safe on Inngest retry.
 */

const REQUIRED_SLOTS = [
  'registration_export',
  'screenshot',
  'recording',
  'attendance',
  'summary',
] as const

export const workshopCompletedFn = inngest.createFunction(
  {
    id: 'workshop-completed',
    name: 'Workshop completed — create checklist + nudge moderator',
    retries: 3,
    // Inlined per src/inngest/README.md §90-94 (type widening footgun).
    triggers: [{ event: workshopCompletedEvent }],
  },
  async ({ event, step }) => {
    const { workshopId, moderatorId } = event.data

    // Step 1: create the 5 checklist rows (idempotent) + fetch context for
    // later nudge steps. Return value is memoized by Inngest across retries.
    const context = await step.run('create-checklist', async () => {
      // Insert one row per required slot. onConflictDoNothing makes this
      // safe if the function is retried after partial completion.
      for (const slot of REQUIRED_SLOTS) {
        await db
          .insert(workshopEvidenceChecklist)
          .values({ workshopId, slot })
          .onConflictDoNothing()
      }

      // Fetch workshop title for the nudge email subject line.
      // A missing workshop row is treated as a soft degradation rather than
      // a hard NonRetriableError: the downstream nudge steps will short-circuit
      // on `moderatorEmail === null` and exit cleanly. This matters because
      // the checklist rows have already been written and we don't want to
      // nuke the idempotent side-effect of the first half of this step.
      const wsRows = await db
        .select({ id: workshops.id, title: workshops.title })
        .from(workshops)
        .where(eq(workshops.id, workshopId))

      const ws = Array.isArray(wsRows) ? wsRows[0] : undefined

      // Fetch moderator email (may be null for phone-only users).
      const modRows = await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, moderatorId))

      const mod = Array.isArray(modRows) ? modRows[0] : undefined

      return {
        workshopTitle: ws?.title ?? `workshop ${workshopId}`,
        moderatorEmail: mod?.email ?? null,
      }
    })

    // Step 2: absolute-time sleep to 72h after the event was emitted.
    const completedAt = new Date(event.ts)
    await step.sleepUntil(
      'sleep-72h',
      new Date(completedAt.getTime() + 72 * 60 * 60 * 1000),
    )

    // Step 3: check for empty slots and nudge if any remain.
    await step.run('nudge-72h', async () => {
      const emptyRows = await db
        .select({ slot: workshopEvidenceChecklist.slot })
        .from(workshopEvidenceChecklist)
        .where(
          and(
            eq(workshopEvidenceChecklist.workshopId, workshopId),
            eq(workshopEvidenceChecklist.status, 'empty'),
          ),
        )

      const empties = Array.isArray(emptyRows) ? emptyRows : []

      if (empties.length === 0) {
        return { skipped: true, reason: 'all-filled' }
      }
      if (!context.moderatorEmail) {
        return { skipped: true, reason: 'no-email' }
      }

      await sendWorkshopEvidenceNudgeEmail(context.moderatorEmail, {
        workshopTitle: context.workshopTitle,
        workshopId,
        emptySlots: empties.map((r) => String(r.slot)),
        delayLabel: '72 hours',
      })
      return { nudged: true, emptyCount: empties.length }
    })

    // Step 4: second absolute-time sleep, to 7d after completion.
    await step.sleepUntil(
      'sleep-7d',
      new Date(completedAt.getTime() + 7 * 24 * 60 * 60 * 1000),
    )

    // Step 5: final nudge — same shape as step 3 with different label.
    await step.run('nudge-7d', async () => {
      const emptyRows = await db
        .select({ slot: workshopEvidenceChecklist.slot })
        .from(workshopEvidenceChecklist)
        .where(
          and(
            eq(workshopEvidenceChecklist.workshopId, workshopId),
            eq(workshopEvidenceChecklist.status, 'empty'),
          ),
        )

      const empties = Array.isArray(emptyRows) ? emptyRows : []

      if (empties.length === 0) {
        return { skipped: true, reason: 'all-filled' }
      }
      if (!context.moderatorEmail) {
        return { skipped: true, reason: 'no-email' }
      }

      await sendWorkshopEvidenceNudgeEmail(context.moderatorEmail, {
        workshopTitle: context.workshopTitle,
        workshopId,
        emptySlots: empties.map((r) => String(r.slot)),
        delayLabel: '7 days',
      })
      return { nudged: true, emptyCount: empties.length }
    })

    return { workshopId, completedAt: completedAt.toISOString() }
  },
)

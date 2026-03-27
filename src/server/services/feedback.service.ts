import { createActor } from 'xstate'
import { feedbackMachine, type FeedbackEvent, type FeedbackStatus } from '@/src/server/machines/feedback.machine'
import { db } from '@/src/db'
import { feedbackItems } from '@/src/db/schema/feedback'
import { workflowTransitions } from '@/src/db/schema/workflow'
import { eq } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

/**
 * Transitions a feedback item through the XState state machine.
 * Persists the new state, logs the transition, and updates review fields.
 *
 * @param feedbackId - UUID of the feedback item
 * @param event - XState event to send
 * @param actorId - UUID of the user performing the transition
 * @returns The updated feedback row
 */
export async function transitionFeedback(
  feedbackId: string,
  event: FeedbackEvent,
  actorId: string,
) {
  // 1. Fetch the feedback row
  const [row] = await db
    .select()
    .from(feedbackItems)
    .where(eq(feedbackItems.id, feedbackId))
    .limit(1)

  if (!row) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Feedback item not found' })
  }

  // 2. Restore the XState actor from persisted snapshot (or start fresh)
  // SECURITY: Wrapped in try/catch -- if actor creation fails (e.g. corrupted snapshot),
  // fall back to deriving state from the DB status field instead of crashing.
  let previousState: string
  let newState: string
  let newSnapshot: ReturnType<ReturnType<typeof createActor>['getSnapshot']> | null = null

  try {
    const actorOptions: Parameters<typeof createActor>[1] = {
      input: {
        feedbackId: row.id,
        submitterId: row.submitterId,
      },
      ...(row.xstateSnapshot ? { snapshot: row.xstateSnapshot as Parameters<typeof createActor>[1] extends { snapshot?: infer S } ? S : never } : {}),
    }

    const actor = createActor(feedbackMachine, actorOptions as any)
    actor.start()

    // 3. Capture previous state
    previousState = actor.getSnapshot().value as string

    // 4. Send the event
    actor.send(event)

    // 5. Capture new state
    newSnapshot = actor.getSnapshot()
    newState = newSnapshot.value as string

    // 6. Verify transition happened
    if (newState === previousState) {
      actor.stop()
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Invalid transition: cannot apply ${event.type} in state ${previousState}`,
      })
    }

    actor.stop()
  } catch (error) {
    // Re-throw TRPCErrors (e.g. "Invalid transition")
    if (error instanceof TRPCError) throw error

    // Fallback: derive state from the status field stored in DB
    console.error('XState actor creation failed, falling back to status field:', error)
    previousState = row.status

    // Derive new state from event type
    const eventToStateMap: Record<string, string> = {
      START_REVIEW: 'under_review',
      ACCEPT: 'accepted',
      PARTIALLY_ACCEPT: 'partially_accepted',
      REJECT: 'rejected',
      CLOSE: 'closed',
    }
    newState = eventToStateMap[event.type] ?? row.status

    if (newState === previousState) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Invalid transition: cannot apply ${event.type} in state ${previousState}`,
      })
    }
  }

  // 7. Build update data
  const updateData: Record<string, unknown> = {
    status: newState as FeedbackStatus,
    xstateSnapshot: newSnapshot as unknown as Record<string, unknown>,
    updatedAt: new Date(),
  }

  // Add review fields for decision events
  if (event.type === 'ACCEPT' || event.type === 'PARTIALLY_ACCEPT' || event.type === 'REJECT') {
    updateData.decisionRationale = (event as { rationale: string }).rationale
    updateData.reviewedBy = (event as { reviewerId: string }).reviewerId
    updateData.reviewedAt = new Date()
  }

  if (event.type === 'START_REVIEW') {
    updateData.reviewedBy = (event as { reviewerId: string }).reviewerId
  }

  // 8. Update the feedback row
  const [updated] = await db
    .update(feedbackItems)
    .set(updateData)
    .where(eq(feedbackItems.id, feedbackId))
    .returning()

  // 9. Log the transition to workflow_transitions
  await db.insert(workflowTransitions).values({
    entityType: 'feedback',
    entityId: feedbackId,
    fromState: previousState,
    toState: newState,
    actorId,
    metadata: {
      event: event.type,
      ...('rationale' in event ? { rationale: event.rationale } : {}),
    },
  })

  // 10. Return updated row
  return updated
}

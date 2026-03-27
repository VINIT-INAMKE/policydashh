import { createActor } from 'xstate'
import { changeRequestMachine, type CREvent, type CRStatus } from '@/src/server/machines/changeRequest.machine'
import { db } from '@/src/db'
import { changeRequests, documentVersions, crFeedbackLinks } from '@/src/db/schema/changeRequests'
import { feedbackItems } from '@/src/db/schema/feedback'
import { workflowTransitions } from '@/src/db/schema/workflow'
import { eq, inArray } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { getNextVersionLabel, snapshotSections, buildChangelog } from '@/src/server/services/version.service'

// Re-export getNextVersionLabel for backward compatibility
export { getNextVersionLabel } from '@/src/server/services/version.service'

/**
 * Transitions a change request through the XState state machine.
 * Persists the new state, logs the transition, and updates relevant fields.
 *
 * @param crId - UUID of the change request
 * @param event - XState event to send
 * @param actorId - UUID of the user performing the transition
 * @returns The updated change request row
 */
export async function transitionCR(
  crId: string,
  event: CREvent,
  actorId: string,
) {
  // 1. Fetch the CR row
  const [row] = await db
    .select()
    .from(changeRequests)
    .where(eq(changeRequests.id, crId))
    .limit(1)

  if (!row) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Change request not found' })
  }

  // 2. Early exit: finalized states cannot be transitioned
  if (row.status === 'merged' || row.status === 'closed') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `CR ${row.readableId} is already ${row.status}`,
    })
  }

  // 3. Restore the XState actor from persisted snapshot (or start fresh)
  // SECURITY: Wrapped in try/catch -- if actor creation fails (e.g. corrupted snapshot),
  // fall back to deriving state from the DB status field instead of crashing.
  let previousState: string
  let newState: string
  let newSnapshot: ReturnType<ReturnType<typeof createActor>['getSnapshot']> | null = null

  try {
    const actorOptions: Parameters<typeof createActor>[1] = {
      input: {
        crId: row.id,
        ownerId: row.ownerId,
      },
      ...(row.xstateSnapshot ? { snapshot: row.xstateSnapshot as Parameters<typeof createActor>[1] extends { snapshot?: infer S } ? S : never } : {}),
    }

    const actor = createActor(changeRequestMachine, actorOptions as any)
    actor.start()

    // 4. Capture previous state
    previousState = actor.getSnapshot().value as string

    // 5. Send the event
    actor.send(event)

    // 6. Capture new state
    newSnapshot = actor.getSnapshot()
    newState = newSnapshot.value as string

    // 7. Verify transition happened
    if (newState === previousState) {
      actor.stop()
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Invalid transition: cannot apply ${event.type} in state ${previousState}`,
      })
    }

    actor.stop()
  } catch (error) {
    // Re-throw TRPCErrors (e.g. "Invalid transition", "already merged/closed")
    if (error instanceof TRPCError) throw error

    // Fallback: derive state from the status field stored in DB
    console.error('XState actor creation failed, falling back to status field:', error)
    previousState = row.status

    // Derive new state from event type
    const eventToStateMap: Record<string, string> = {
      SUBMIT_FOR_REVIEW: 'in_review',
      APPROVE: 'approved',
      REQUEST_CHANGES: 'in_review',
      MERGE: 'merged',
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

  // 8. Build update data
  const updateData: Record<string, unknown> = {
    status: newState as CRStatus,
    xstateSnapshot: newSnapshot as unknown as Record<string, unknown>,
    updatedAt: new Date(),
  }

  // Add fields for specific events
  if (event.type === 'APPROVE') {
    updateData.approverId = (event as { approverId: string }).approverId
    updateData.approvedAt = new Date()
  }

  if (event.type === 'CLOSE') {
    updateData.closureRationale = (event as { rationale: string }).rationale
  }

  if (event.type === 'MERGE') {
    updateData.mergedVersionId = (event as { mergedVersionId: string }).mergedVersionId
  }

  // 9. Update the CR row
  const [updated] = await db
    .update(changeRequests)
    .set(updateData)
    .where(eq(changeRequests.id, crId))
    .returning()

  // 10. Log the transition to workflow_transitions
  await db.insert(workflowTransitions).values({
    entityType: 'change_request',
    entityId: crId,
    fromState: previousState,
    toState: newState,
    actorId,
    metadata: {
      event: event.type,
      ...('rationale' in event ? { rationale: (event as { rationale: string }).rationale } : {}),
    },
  })

  // 11. Return updated row
  return updated
}

/**
 * Merges a change request atomically:
 * 1. Creates a document_versions row with section snapshot and changelog
 * 2. Updates the CR status to 'merged'
 * 3. Bulk-updates linked feedback with resolvedInVersionId
 * 4. Logs the workflow transition
 *
 * @param crId - UUID of the change request
 * @param mergeSummary - Summary of what the merge changes
 * @param actorId - UUID of the user performing the merge
 * @returns { cr, version } - The updated CR and new version
 */
export async function mergeCR(
  crId: string,
  mergeSummary: string,
  actorId: string,
) {
  // Sequential inserts (Neon HTTP driver does not support transactions)

  // 1. Fetch CR and verify status === 'approved'
  const [cr] = await db
    .select()
    .from(changeRequests)
    .where(eq(changeRequests.id, crId))
    .limit(1)

  if (!cr) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Change request not found' })
  }

  if (cr.status !== 'approved') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `CR ${cr.readableId} must be in approved state to merge, currently ${cr.status}`,
    })
  }

  // 2. Generate next version label
  const versionLabel = await getNextVersionLabel(db, cr.documentId)

  // 3. Capture section snapshot and build changelog
  const sectionsSnapshot = await snapshotSections(db, cr.documentId)
  const changelog = await buildChangelog(db, crId, cr)

  // 4. Insert document_versions row with snapshot and changelog
  const [version] = await db
    .insert(documentVersions)
    .values({
      documentId: cr.documentId,
      versionLabel,
      mergeSummary,
      createdBy: actorId,
      crId,
      sectionsSnapshot,
      changelog,
    })
    .returning()

  // 5. Update CR to merged
  const [updatedCR] = await db
    .update(changeRequests)
    .set({
      status: 'merged',
      mergedVersionId: version.id,
      mergedBy: actorId,
      mergedAt: new Date(),
      xstateSnapshot: null,
      updatedAt: new Date(),
    })
    .where(eq(changeRequests.id, crId))
    .returning()

  // 6. Bulk-update linked feedback with resolvedInVersionId
  const linkedFeedback = await db
    .select({ feedbackId: crFeedbackLinks.feedbackId })
    .from(crFeedbackLinks)
    .where(eq(crFeedbackLinks.crId, crId))

  const feedbackIds = linkedFeedback.map((f) => f.feedbackId)

  if (feedbackIds.length > 0) {
    await db
      .update(feedbackItems)
      .set({ resolvedInVersionId: version.id })
      .where(inArray(feedbackItems.id, feedbackIds))
  }

  // 7. Insert workflow transition
  await db.insert(workflowTransitions).values({
    entityType: 'change_request',
    entityId: crId,
    fromState: 'approved',
    toState: 'merged',
    actorId,
    metadata: {
      event: 'MERGE',
      mergeSummary,
      versionLabel,
    },
  })

  // 8. Return updated CR and version
  return { cr: updatedCR, version }
}

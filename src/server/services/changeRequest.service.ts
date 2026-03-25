import { createActor } from 'xstate'
import { changeRequestMachine, type CREvent, type CRStatus } from '@/src/server/machines/changeRequest.machine'
import { db } from '@/src/db'
import { changeRequests, documentVersions, crFeedbackLinks } from '@/src/db/schema/changeRequests'
import { feedbackItems } from '@/src/db/schema/feedback'
import { workflowTransitions } from '@/src/db/schema/workflow'
import { eq, desc, inArray, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

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
  const previousState = actor.getSnapshot().value as string

  // 5. Send the event
  actor.send(event)

  // 6. Capture new state
  const newSnapshot = actor.getSnapshot()
  const newState = newSnapshot.value as string

  // 7. Verify transition happened
  if (newState === previousState) {
    actor.stop()
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Invalid transition: cannot apply ${event.type} in state ${previousState}`,
    })
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

  // 11. Stop the actor
  actor.stop()

  // 12. Return updated row
  return updated
}

/**
 * Helper: Get the next version label for a document.
 * Queries the latest documentVersions row and increments the minor version.
 */
export async function getNextVersionLabel(
  txOrDb: typeof db,
  documentId: string,
): Promise<string> {
  const [latest] = await txOrDb
    .select({ versionLabel: documentVersions.versionLabel })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.createdAt))
    .limit(1)

  if (!latest) {
    return 'v0.1'
  }

  // Parse "v0.N" pattern and increment
  const match = latest.versionLabel.match(/^v0\.(\d+)$/)
  if (!match) {
    return 'v0.1'
  }

  const nextMinor = parseInt(match[1], 10) + 1
  return `v0.${nextMinor}`
}

/**
 * Merges a change request atomically:
 * 1. Creates a document_versions row
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
  return await db.transaction(async (tx) => {
    // 1. Fetch CR and verify status === 'approved'
    const [cr] = await tx
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
    const versionLabel = await getNextVersionLabel(tx as unknown as typeof db, cr.documentId)

    // 3. Insert document_versions row
    const [version] = await tx
      .insert(documentVersions)
      .values({
        documentId: cr.documentId,
        versionLabel,
        mergeSummary,
        createdBy: actorId,
        crId,
      })
      .returning()

    // 4. Update CR to merged
    const [updatedCR] = await tx
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

    // 5. Bulk-update linked feedback with resolvedInVersionId
    const linkedFeedback = await tx
      .select({ feedbackId: crFeedbackLinks.feedbackId })
      .from(crFeedbackLinks)
      .where(eq(crFeedbackLinks.crId, crId))

    const feedbackIds = linkedFeedback.map((f) => f.feedbackId)

    if (feedbackIds.length > 0) {
      await tx
        .update(feedbackItems)
        .set({ resolvedInVersionId: version.id })
        .where(inArray(feedbackItems.id, feedbackIds))
    }

    // 6. Insert workflow transition
    await tx.insert(workflowTransitions).values({
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

    // 7. Return updated CR and version
    return { cr: updatedCR, version }
  })
}

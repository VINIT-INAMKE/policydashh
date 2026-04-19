import { createActor } from 'xstate'
import { changeRequestMachine, type CREvent, type CRStatus } from '@/src/server/machines/changeRequest.machine'
import { db } from '@/src/db'
import { changeRequests, documentVersions, crFeedbackLinks } from '@/src/db/schema/changeRequests'
import { feedbackItems } from '@/src/db/schema/feedback'
import { workflowTransitions } from '@/src/db/schema/workflow'
import { and, eq, inArray, sql } from 'drizzle-orm'
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
 * Merges a change request.
 *
 * EVENTUALLY CONSISTENT: the Neon HTTP driver does not support transactions,
 * so this function issues its writes sequentially with per-step idempotency
 * guards. If any step fails, subsequent steps are skipped and the caller
 * (a tRPC mutation or Inngest step) will retry. On retry each guard turns
 * the already-applied write into a no-op, so the function is safe to
 * replay multiple times as long as `mergeSummary` and `actorId` stay the
 * same.
 *
 * Ordering (most-idempotent first; the first permanent write is the CR
 * status flip):
 *   1. Fetch CR; early-return if already merged (idempotent replay path).
 *   2. Dispatch MERGE through the XState machine to validate the
 *      transition (G2). Never touch the DB on invalid transitions.
 *   3. Snapshot sections + build changelog (pure reads).
 *   4. Insert or reuse the document_versions row keyed on (crId) -- an
 *      earlier retry may have already inserted it.
 *   5. Update CR to merged (only if still approved, so concurrent mergers
 *      don't race).
 *   6. Update linked feedback rows to resolvedInVersionId -- skip rows
 *      already marked for this version.
 *   7. Insert workflow transition -- skip if already recorded for this
 *      version.
 */
export async function mergeCR(
  crId: string,
  mergeSummary: string,
  actorId: string,
) {
  // 1. Fetch CR
  const [cr] = await db
    .select()
    .from(changeRequests)
    .where(eq(changeRequests.id, crId))
    .limit(1)

  if (!cr) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Change request not found' })
  }

  // Idempotent replay: if the CR is already merged, look up the existing
  // version row and return - don't throw, don't double-write.
  if (cr.status === 'merged' && cr.mergedVersionId) {
    const [existingVersion] = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.id, cr.mergedVersionId))
      .limit(1)

    if (existingVersion) {
      return { cr, version: existingVersion }
    }
  }

  if (cr.status !== 'approved') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `CR ${cr.readableId} must be in approved state to merge, currently ${cr.status}`,
    })
  }

  // 2. G2: Validate the MERGE transition through the XState machine before
  // any writes. `mergedVersionId` is a placeholder for the guard - the real
  // value is written in step 5. The machine's only job here is to assert
  // the state flow is legal; the snapshot we persist in step 5 is produced
  // with the real version id.
  const actorOptions: Parameters<typeof createActor>[1] = {
    input: { crId: cr.id, ownerId: cr.ownerId },
    ...(cr.xstateSnapshot
      ? { snapshot: cr.xstateSnapshot as Parameters<typeof createActor>[1] extends { snapshot?: infer S } ? S : never }
      : {}),
  }
  const validationActor = createActor(changeRequestMachine, actorOptions as any)
  validationActor.start()
  const beforeState = validationActor.getSnapshot().value as string
  validationActor.send({ type: 'MERGE', mergedVersionId: '00000000-0000-0000-0000-000000000000' })
  const afterState = validationActor.getSnapshot().value as string
  validationActor.stop()

  if (afterState !== 'merged') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Invalid transition: cannot apply MERGE in state ${beforeState}`,
    })
  }

  // 3. Compute version label + snapshot + changelog (pure reads).
  const versionLabel = await getNextVersionLabel(db, cr.documentId)
  const sectionsSnapshot = await snapshotSections(db, cr.documentId)
  const changelog = await buildChangelog(db, crId, cr)

  // 4. Insert the document_versions row, guarded by an existence check
  // keyed on crId. If a previous attempt of this function already created
  // the version, reuse it - Neon HTTP has no transaction semantics so
  // retries must be idempotent at the step level.
  let version: typeof documentVersions.$inferSelect | undefined

  const [existingVersion] = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.crId, crId))
    .limit(1)

  if (existingVersion) {
    version = existingVersion
  } else {
    const [inserted] = await db
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
    version = inserted
  }

  if (!version) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to create or locate merged version row',
    })
  }

  // 5. Flip CR to merged. The WHERE clause adds `status = 'approved'` so
  // concurrent mergers can't double-apply the transition (whichever one
  // lands first wins; the loser sees zero rows updated and reuses the
  // already-merged row below).
  const rebuiltSnapshot = (() => {
    const actor = createActor(changeRequestMachine, {
      input: { crId: cr.id, ownerId: cr.ownerId },
      ...(cr.xstateSnapshot
        ? { snapshot: cr.xstateSnapshot as Parameters<typeof createActor>[1] extends { snapshot?: infer S } ? S : never }
        : {}),
    } as any)
    actor.start()
    actor.send({ type: 'MERGE', mergedVersionId: version!.id })
    const snap = actor.getSnapshot()
    actor.stop()
    return snap as unknown as Record<string, unknown>
  })()

  const updatedRows = await db
    .update(changeRequests)
    .set({
      status: 'merged',
      mergedVersionId: version.id,
      mergedBy: actorId,
      mergedAt: new Date(),
      xstateSnapshot: rebuiltSnapshot,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(changeRequests.id, crId),
        eq(changeRequests.status, 'approved'),
      ),
    )
    .returning()

  let updatedCR = updatedRows[0]

  // If zero rows updated, the CR was already merged by a concurrent caller
  // or an earlier attempt of this function. Reload the current row so we
  // return a consistent snapshot without re-applying the write.
  if (!updatedCR) {
    const [current] = await db
      .select()
      .from(changeRequests)
      .where(eq(changeRequests.id, crId))
      .limit(1)

    if (!current || current.status !== 'merged') {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to merge CR ${cr.readableId}: state drift after update`,
      })
    }
    updatedCR = current
  }

  // 6. Bulk-update linked feedback rows to this version. The WHERE clause
  // filters out rows that already point at this version (the only rows
  // left to write are the new ones), making the step a no-op on retry.
  const linkedFeedback = await db
    .select({ feedbackId: crFeedbackLinks.feedbackId })
    .from(crFeedbackLinks)
    .where(eq(crFeedbackLinks.crId, crId))

  const feedbackIds = linkedFeedback.map((f) => f.feedbackId)

  if (feedbackIds.length > 0) {
    // Retry no-op: skip rows already pointing at this version. We want to
    // update rows where resolvedInVersionId IS NULL *or* != version.id;
    // the plain `!=` filter would silently drop the NULL rows we
    // actually need to write, so use an explicit IS DISTINCT FROM.
    await db
      .update(feedbackItems)
      .set({ resolvedInVersionId: version.id })
      .where(
        and(
          inArray(feedbackItems.id, feedbackIds),
          sql`${feedbackItems.resolvedInVersionId} IS DISTINCT FROM ${version.id}`,
        ),
      )
  }

  // 7. Insert workflow transition, guarded by a lookup so retries don't
  // create duplicate "approved -> merged" rows for the same version.
  const existingTransition = await db
    .select({ id: workflowTransitions.id })
    .from(workflowTransitions)
    .where(
      and(
        eq(workflowTransitions.entityType, 'change_request'),
        eq(workflowTransitions.entityId, crId),
        eq(workflowTransitions.toState, 'merged'),
      ),
    )
    .limit(1)

  if (existingTransition.length === 0) {
    await db.insert(workflowTransitions).values({
      entityType: 'change_request',
      entityId: crId,
      fromState: 'approved',
      toState: 'merged',
      actorId,
      metadata: {
        event: 'MERGE',
        mergeSummary,
        versionLabel: version.versionLabel,
      },
    })
  }

  return { cr: updatedCR, version }
}

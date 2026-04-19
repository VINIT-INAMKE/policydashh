import { db } from '@/src/db'
import {
  changeRequests,
  crFeedbackLinks,
  crSectionLinks,
} from '@/src/db/schema/changeRequests'
import { and, eq, sql } from 'drizzle-orm'

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
 * on retry. Do NOT call this from request-path code - use the existing
 * `changeRequest.create` tRPC mutation for that.
 *
 * EVENTUALLY CONSISTENT (B2): The Neon HTTP driver does not support
 * transactions, so we issue three sequential writes rather than wrapping
 * them in `db.transaction()`. Ordering is most-idempotent first:
 *
 *   1. Short-circuit if a draft CR already exists for this feedbackId
 *      (look up via crFeedbackLinks) -- inngest step.run's memoization
 *      is per-step, not per-function, so a retry of this step after a
 *      downstream step fails will otherwise generate a second CR.
 *   2. Allocate the readable id (sequence is monotonic; consuming an id
 *      only costs a counter bump on failure, never duplicates).
 *   3. Insert the changeRequests row.
 *   4. Insert crFeedbackLinks -- a UNIQUE (crId, feedbackId) guards
 *      duplicate inserts on retry.
 *   5. Insert crSectionLinks -- same UNIQUE (crId, sectionId) guard.
 *
 * On neon-http each statement is durable individually: if step 4 fails
 * after step 3 wrote the CR row, a retry replays step 1's dedupe check,
 * finds the existing CR, and returns it without re-inserting. Steps 4
 * and 5 then complete idempotently thanks to the UNIQUE constraints and
 * .onConflictDoNothing().
 */
export async function createDraftCRFromFeedback(
  input: CreateDraftCRInput,
): Promise<CreateDraftCRResult> {
  // 1. Idempotency guard: has a draft CR already been created for this
  // feedbackId? If so, reuse it - Inngest retries must not duplicate.
  const existing = await db
    .select({
      id: changeRequests.id,
      readableId: changeRequests.readableId,
    })
    .from(crFeedbackLinks)
    .innerJoin(changeRequests, eq(crFeedbackLinks.crId, changeRequests.id))
    .where(
      and(
        eq(crFeedbackLinks.feedbackId, input.feedbackId),
        eq(changeRequests.ownerId, input.ownerId),
        eq(changeRequests.documentId, input.documentId),
      ),
    )
    .limit(1)

  if (existing.length > 0) {
    return { id: existing[0].id, readableId: existing[0].readableId }
  }

  // 2. Allocate the readable id from cr_id_seq. If this throws, the
  // transaction was never opened (parity with pre-refactor behavior).
  const seqRows = await db.execute(sql`SELECT nextval('cr_id_seq') AS seq`)
  const seqResult = seqRows.rows[0] as Record<string, unknown>
  const num = Number(seqResult.seq)
  const readableId = `CR-${String(num).padStart(3, '0')}`

  // 3. Insert the changeRequests row.
  const [inserted] = await db
    .insert(changeRequests)
    .values({
      readableId,
      documentId: input.documentId,
      ownerId: input.ownerId,
      title: input.title,
      description: input.description,
    })
    .returning({ id: changeRequests.id })

  // 4. Insert crFeedbackLinks - UNIQUE(crId, feedbackId) makes this a
  // no-op on retry.
  await db
    .insert(crFeedbackLinks)
    .values({
      crId: inserted.id,
      feedbackId: input.feedbackId,
    })
    .onConflictDoNothing()

  // 5. Insert crSectionLinks - UNIQUE(crId, sectionId) makes this a
  // no-op on retry.
  await db
    .insert(crSectionLinks)
    .values({
      crId: inserted.id,
      sectionId: input.sectionId,
    })
    .onConflictDoNothing()

  return { id: inserted.id, readableId }
}

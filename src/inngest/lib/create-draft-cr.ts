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

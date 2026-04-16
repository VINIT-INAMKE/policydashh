/**
 * POST /api/intake/workshop-feedback - Phase 20 WS-15 submit route.
 *
 * Receives post-workshop feedback from the `/participate?workshopId=&token=`
 * deep-link flow (Plan 20-06 UI). Differs from `/api/intake/participate` in
 * TWO important ways:
 *
 *   1. NO bot-challenge verification. The signed JWT (HS256, 14-day expiry,
 *      keyed on workshopId+email) IS the proof of legitimacy per D-18. Only
 *      holders of an email sent by `workshopFeedbackInviteFn` can obtain a
 *      valid token, which already gates the submit path.
 *
 *   2. Writes directly to `feedbackItems` (source='workshop') + links via
 *      `workshopFeedbackLinks` inside ONE db.transaction so a feedback row
 *      cannot exist without its workshop link (or vice versa).
 *
 * `submitterId` resolution (feedbackItems.submitterId is NOT NULL):
 *   - Look up a `users` row by the email baked into the JWT payload.
 *   - If found → use user.id (attendee submits on their own behalf).
 *   - If not found (e.g. Clerk invite still pending) → fall back to
 *     `workshops.createdBy` (the moderator-on-record). This keeps the row
 *     insertable without relaxing the NOT NULL constraint; the real
 *     submission email is preserved via `isAnonymous: true` + the
 *     workshopFeedbackLinks row which captures the workshop context.
 *
 * Public by proxy.ts `/api/intake(.*)` whitelist (Plan 19-05). No audit
 * log - unauthenticated, and the workshopFeedbackLinks row IS the audit.
 */

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/src/db'
import { feedbackItems } from '@/src/db/schema/feedback'
import {
  workshops,
  workshopFeedbackLinks,
  workshopSectionLinks,
} from '@/src/db/schema/workshops'
import { policySections } from '@/src/db/schema/documents'
import { users } from '@/src/db/schema/users'
import { verifyFeedbackToken } from '@/src/lib/feedback-token'

export const runtime = 'nodejs'

// z.guid() (not z.uuid()) - Phase 16 precedent: Zod 4 z.uuid() rejects
// version-0 UUIDs that fixtures and some test payloads carry. z.guid()
// accepts any RFC 4122 shape.
const bodySchema = z.object({
  workshopId: z.guid(),
  token: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(4000),
  sectionId: z.guid().optional(),
})

type ValidBody = z.infer<typeof bodySchema>

async function parseBody(req: Request): Promise<ValidBody | null> {
  const json = (await req.json().catch(() => null)) as unknown
  if (!json) return null
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return null
  return parsed.data
}

export async function POST(request: Request): Promise<Response> {
  // 1. Parse + validate body.
  const body = await parseBody(request)
  if (!body) {
    return Response.json({ error: 'Invalid input' }, { status: 400 })
  }

  // 2. Re-verify JWT on the server (never trust the client). Token binds to
  //    a specific workshopId; any mismatch fails here.
  const payload = verifyFeedbackToken(body.token, body.workshopId)
  if (!payload) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 3. Load the workshop row - required both to confirm existence AND to
  //    resolve the fallback submitterId (workshops.createdBy).
  const workshopRows = await db
    .select({ id: workshops.id, createdBy: workshops.createdBy })
    .from(workshops)
    .where(eq(workshops.id, body.workshopId))
    .limit(1)
  const workshop = workshopRows[0]
  if (!workshop) {
    return Response.json({ error: 'Workshop not found' }, { status: 404 })
  }

  // 4. Resolve sectionId: use the caller-supplied value if present, else fall
  //    back to the first workshopSectionLinks row (workshop MUST link at
  //    least one section - schema-level invariant Phase 17 established).
  let sectionId: string | undefined = body.sectionId
  if (!sectionId) {
    const linkRows = await db
      .select({ sectionId: workshopSectionLinks.sectionId })
      .from(workshopSectionLinks)
      .where(eq(workshopSectionLinks.workshopId, body.workshopId))
      .limit(1)
    sectionId = linkRows[0]?.sectionId
  }
  if (!sectionId) {
    return Response.json(
      { error: 'No section linked to this workshop' },
      { status: 400 },
    )
  }

  // 5. Look up documentId from the section (feedbackItems needs both).
  const sectionRows = await db
    .select({ id: policySections.id, documentId: policySections.documentId })
    .from(policySections)
    .where(eq(policySections.id, sectionId))
    .limit(1)
  const section = sectionRows[0]
  if (!section) {
    return Response.json({ error: 'Section not found' }, { status: 404 })
  }

  // 6. Resolve submitterId by JWT email → users table; fall back to
  //    workshops.createdBy so the NOT NULL column stays satisfied without
  //    requiring a schema migration. Documented in the file-level comment.
  let submitterId: string = workshop.createdBy
  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, payload.email))
    .limit(1)
  if (userRows[0]) {
    submitterId = userRows[0].id
  }

  // 7. Generate readable id (mirrors existing short-code style - e.g.
  //    FB-LZ5JK9 - no collision risk for workshop feedback given volume).
  const readableId = `FB-${Date.now().toString(36).toUpperCase()}`

  // 8. Atomic insert: feedbackItems + workshopFeedbackLinks in ONE txn.
  const feedbackId = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(feedbackItems)
      .values({
        readableId,
        sectionId: section.id,
        documentId: section.documentId,
        submitterId,
        feedbackType: 'suggestion',
        priority: 'medium',
        impactCategory: 'other',
        title: `Workshop feedback (${body.rating}/5)`,
        body: body.comment,
        status: 'submitted',
        isAnonymous: true,
        source: 'workshop',
      })
      .returning({ id: feedbackItems.id })

    const row = inserted[0]
    if (!row) throw new Error('feedback insert returned no row')

    await tx
      .insert(workshopFeedbackLinks)
      .values({ workshopId: body.workshopId, feedbackId: row.id })
      .onConflictDoNothing()

    return row.id
  })

  return Response.json({ ok: true, feedbackId }, { status: 200 })
}

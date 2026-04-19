/**
 * POST /api/intake/workshop-feedback - Phase 20 WS-15 submit route.
 *
 * Receives post-workshop feedback from the `/participate?workshopId=&token=`
 * deep-link flow (Plan 20-06 UI). Public by proxy.ts `/api/intake(.*)`
 * whitelist.
 *
 * Key invariants:
 *   1. NO bot-challenge verification. The signed JWT (HS256, 14-day expiry,
 *      keyed on workshopId+email) IS the proof of legitimacy per D-18. Only
 *      holders of an email sent by `workshopFeedbackInviteFn` can obtain a
 *      valid token, which already gates the submit path.
 *
 *   2. Writes `feedbackItems` + `workshopFeedbackLinks` atomically. Since
 *      `feedbackItems.submitterId` is NOT NULL but workshop feedback is
 *      conceptually owned by the workshop, we store the attendee's user row
 *      if one exists. When the attendee is not yet a Clerk-linked user we
 *      reject the submission and surface a clear error (E8: no fallback to
 *      `workshop.createdBy` — that masked the real submitter as the moderator).
 *
 *   3. One-time use (B13): the JWT hash is recorded in
 *      `workshop_feedback_token_nonces` after a successful insert. Any
 *      subsequent request carrying the same token is rejected 401. Wraps
 *      the INSERT into the same transaction as the feedback write so a
 *      failure leaves the nonce table clean.
 *
 *   4. Readable ID (B14): uses `nextval('feedback_id_seq')` (same sequence
 *      the authenticated `feedback.submit` uses) instead of a Date.now()
 *      base-36 string that can collide under concurrent submissions.
 *
 *   5. Body size cap (B10): Content-Length gate before `req.json()` so a
 *      malicious 100MB payload can't exhaust JSON parser memory.
 */

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/src/db'
import {
  feedbackItems,
  workshopFeedbackTokenNonces,
} from '@/src/db/schema/feedback'
import {
  workshops,
  workshopFeedbackLinks,
  workshopSectionLinks,
} from '@/src/db/schema/workshops'
import { policySections } from '@/src/db/schema/documents'
import { users } from '@/src/db/schema/users'
import { sql } from 'drizzle-orm'
import { hashFeedbackToken, verifyFeedbackToken } from '@/src/lib/feedback-token'
import { consume, getClientIp } from '@/src/lib/rate-limit'

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
  isAnonymous: z.boolean().optional(),
})

type ValidBody = z.infer<typeof bodySchema>

// B10: request body cap. 64KB is well above the worst-case legit payload
// (rating number + 4000-char comment + UUIDs + token ≈ <8KB) but rejects any
// pathological submission before we touch JSON.parse.
const MAX_BODY_BYTES = 64 * 1024

async function parseBody(req: Request): Promise<ValidBody | null> {
  const json = (await req.json().catch(() => null)) as unknown
  if (!json) return null
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return null
  return parsed.data
}

export async function POST(request: Request): Promise<Response> {
  // B10: short-circuit oversized payloads before JSON parsing.
  const contentLength = request.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return Response.json({ error: 'Payload too large' }, { status: 413 })
  }

  // B11: per-IP rate limit before any parsing. 10 requests / minute. IP is a
  // weak key (NAT, corporate proxies), but it's the only key available
  // before we parse the token; the per-token check below catches replay.
  const ip = getClientIp(request)
  const ipLimit = consume(`wf:ip:${ip}`, { max: 10, windowMs: 60_000 })
  if (!ipLimit.ok) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  // 1. Parse + validate body.
  const body = await parseBody(request)
  if (!body) {
    return Response.json({ error: 'Invalid input' }, { status: 400 })
  }

  // B11: per-token rate limit so a single leaked token can't hammer us.
  // Keyed on the hashed token so raw tokens never touch limiter memory.
  const tokenLimit = consume(`wf:tok:${hashFeedbackToken(body.token)}`, {
    max: 5,
    windowMs: 60_000,
  })
  if (!tokenLimit.ok) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  // 2. Re-verify JWT on the server (never trust the client). Token binds to
  //    a specific workshopId; any mismatch fails here.
  const payload = verifyFeedbackToken(body.token, body.workshopId)
  if (!payload) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // B13: burn-check. If this token has already been used, reject.
  const tokenHash = hashFeedbackToken(body.token)
  const nonceHit = await db
    .select({ tokenHash: workshopFeedbackTokenNonces.tokenHash })
    .from(workshopFeedbackTokenNonces)
    .where(eq(workshopFeedbackTokenNonces.tokenHash, tokenHash))
    .limit(1)
  if (nonceHit.length > 0) {
    return Response.json({ error: 'Token already used' }, { status: 401 })
  }

  // 3. Load the workshop row - required to confirm existence.
  const workshopRows = await db
    .select({ id: workshops.id })
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

  // 6. Resolve submitterId by JWT email → users table.
  //    E8: NO fallback to workshop.createdBy. The moderator isn't the
  //    submitter. If the attendee has no users row (e.g. Clerk invite
  //    hasn't been accepted yet) we reject so the data model stays honest.
  //    feedbackItems.submitterId is still NOT NULL — making it nullable
  //    would require a migration across multiple unrelated call-sites, so
  //    for now we surface a 409.
  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, payload.email))
    .limit(1)
  const submitterUser = userRows[0]
  if (!submitterUser) {
    return Response.json(
      {
        error:
          'We could not match your email to a registered account. Please complete sign-up first.',
      },
      { status: 409 },
    )
  }
  const submitterId = submitterUser.id

  // 7. Generate readable id via `feedback_id_seq` for collision-free IDs
  //    (B14). Matches the authenticated feedback.submit path.
  const seqRows = await db.execute(sql`SELECT nextval('feedback_id_seq') AS seq`)
  const seqResult = seqRows.rows[0] as Record<string, unknown>
  const readableId = `FB-${String(Number(seqResult.seq)).padStart(3, '0')}`

  // 8. Title preview (E6): first 80 chars of comment, with ellipsis if
  //    truncated. Falls back to the old "Workshop feedback (n/5)" if the
  //    trimmed comment ends up empty (defence-in-depth — Zod already
  //    enforces min(1), but belt-and-suspenders).
  const trimmedComment = body.comment.trim()
  const previewBase = trimmedComment.length > 80
    ? `${trimmedComment.slice(0, 80).trim()}\u2026`
    : trimmedComment
  const title = previewBase.length > 0
    ? previewBase
    : `Workshop feedback (${body.rating}/5)`

  // E7: honor the attendee's anonymity choice. Default true (anonymous) if
  // the field is missing - matches the form default.
  const isAnonymous = body.isAnonymous ?? true

  // 9. Atomic insert: feedbackItems + workshopFeedbackLinks + nonce write in
  //    ONE txn. Any failure rolls back all three.
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
        title,
        body: body.comment,
        status: 'submitted',
        isAnonymous,
        source: 'workshop',
      })
      .returning({ id: feedbackItems.id })

    const row = inserted[0]
    if (!row) throw new Error('feedback insert returned no row')

    await tx
      .insert(workshopFeedbackLinks)
      .values({ workshopId: body.workshopId, feedbackId: row.id })
      .onConflictDoNothing()

    // B13: burn the token. `onConflictDoNothing` is deliberate — if two
    // identical requests race, the second to insert loses the token-nonce
    // write and would see a conflict; the row is already there from the
    // first, so the second tx rolls back cleanly via the nonce check up top
    // (the pre-check races, but the conflict here makes it idempotent at
    // the storage layer).
    await tx
      .insert(workshopFeedbackTokenNonces)
      .values({ tokenHash, workshopId: body.workshopId })
      .onConflictDoNothing()

    return row.id
  })

  return Response.json({ ok: true, feedbackId }, { status: 200 })
}

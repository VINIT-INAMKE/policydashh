import { type NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { feedbackItems } from '@/src/db/schema/feedback'
import { changeRequests, crFeedbackLinks, crSectionLinks, documentVersions } from '@/src/db/schema/changeRequests'
import { policySections, policyDocuments } from '@/src/db/schema/documents'
import { can } from '@/src/lib/permissions'
import { ACTIONS } from '@/src/lib/constants'
import { writeAuditLog } from '@/src/lib/audit'
import type { Role } from '@/src/lib/constants'
import { eq, and, desc, gte, lte, inArray, isNull, or } from 'drizzle-orm'

const VALID_ORG_TYPES = ['government', 'industry', 'legal', 'academia', 'civil_society', 'internal'] as const
const VALID_DECISIONS = ['submitted', 'under_review', 'accepted', 'partially_accepted', 'rejected', 'closed'] as const

type OrgType = (typeof VALID_ORG_TYPES)[number]
type DecisionOutcome = (typeof VALID_DECISIONS)[number]

function parseEnumList<T extends string>(
  searchParams: URLSearchParams,
  paramName: string,
  allowed: readonly T[],
): T[] {
  // Accept repeated OR comma-separated params. Unknown values dropped.
  const raw = searchParams.getAll(paramName)
  const tokens: string[] = []
  for (const v of raw) {
    for (const tok of v.split(',')) {
      const trimmed = tok.trim()
      if (trimmed) tokens.push(trimmed)
    }
  }
  const allowedSet = new Set<string>(allowed)
  return tokens.filter((t): t is T => allowedSet.has(t))
}

export async function GET(request: NextRequest) {
  // Auth check
  const { userId } = await auth()
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  // D3: exclude soft-deleted users so a Clerk session that survives
  // an anonymization webhook cannot keep exporting traceability.
  const user = await db.query.users.findFirst({
    where: and(eq(users.clerkId, userId), isNull(users.deletedAt)),
  })
  if (!user) {
    return new Response('User not found', { status: 401 })
  }

  if (!can(user.role as Role, 'trace:export')) {
    return new Response('Forbidden', { status: 403 })
  }

  // Parse search params
  const searchParams = request.nextUrl.searchParams
  const documentId = searchParams.get('documentId')
  if (!documentId) {
    return new Response('documentId is required', { status: 400 })
  }

  // D5: accept array filters with backward-compat for old singular keys.
  const orgTypes: OrgType[] = [
    ...parseEnumList(searchParams, 'orgTypes', VALID_ORG_TYPES),
    ...parseEnumList(searchParams, 'orgType', VALID_ORG_TYPES),
  ]
  const decisionOutcomes: DecisionOutcome[] = [
    ...parseEnumList(searchParams, 'decisionOutcomes', VALID_DECISIONS),
    ...parseEnumList(searchParams, 'decisionOutcome', VALID_DECISIONS),
  ]

  const sectionId = searchParams.get('sectionId')
  const versionFromLabel = searchParams.get('versionFromLabel')
  const versionToLabel = searchParams.get('versionToLabel')

  // Build conditions
  const conditions: ReturnType<typeof eq>[] = [
    eq(feedbackItems.documentId, documentId),
  ]

  if (sectionId) {
    conditions.push(eq(feedbackItems.sectionId, sectionId))
  }
  if (decisionOutcomes.length > 0) {
    conditions.push(inArray(feedbackItems.status, decisionOutcomes))
  }
  // R5: `inArray` alone drops users with NULL orgType. Wrap with IS NULL
  // so NULL-orgType rows stay visible under an active filter, matching
  // the feedback.list / traceability.matrix behaviour.
  if (orgTypes.length > 0) {
    conditions.push(
      or(inArray(users.orgType, orgTypes), isNull(users.orgType))!,
    )
  }

  // Version range filter — D6: wrap gte/lte with `OR IS NULL` so un-merged
  // feedback isn't silently hidden.
  let fromCreatedAt: Date | null = null
  let toCreatedAt: Date | null = null

  if (versionFromLabel) {
    const [fromVersion] = await db
      .select({ createdAt: documentVersions.createdAt })
      .from(documentVersions)
      .where(and(
        eq(documentVersions.documentId, documentId),
        eq(documentVersions.versionLabel, versionFromLabel),
      ))
      .limit(1)
    if (fromVersion) {
      fromCreatedAt = fromVersion.createdAt
    }
  }
  if (versionToLabel) {
    const [toVersion] = await db
      .select({ createdAt: documentVersions.createdAt })
      .from(documentVersions)
      .where(and(
        eq(documentVersions.documentId, documentId),
        eq(documentVersions.versionLabel, versionToLabel),
      ))
      .limit(1)
    if (toVersion) {
      toCreatedAt = toVersion.createdAt
    }
  }

  // D7: friendly rejection of inverted range.
  if (fromCreatedAt && toCreatedAt && fromCreatedAt > toCreatedAt) {
    return new Response('"From" version must be before "To" version.', { status: 400 })
  }

  if (fromCreatedAt) {
    conditions.push(
      or(
        gte(documentVersions.createdAt, fromCreatedAt),
        isNull(documentVersions.createdAt),
      )!,
    )
  }
  if (toCreatedAt) {
    conditions.push(
      or(
        lte(documentVersions.createdAt, toCreatedAt),
        isNull(documentVersions.createdAt),
      )!,
    )
  }

  // Execute the matrix query. R10: `selectDistinct` collapses
  // (feedback,CR,section,version) fan-out so a CR linked to multiple
  // sections does not duplicate feedback rows. R16: hard cap at 5000
  // rows with truncation header so a large policy cannot OOM the
  // serverless function; callers hitting the cap see `X-Truncated` on
  // the response and an on-page warning in the PDF.
  const EXPORT_ROW_LIMIT = 5000
  const rows = await db
    .selectDistinct({
      feedbackReadableId: feedbackItems.readableId,
      feedbackTitle: feedbackItems.title,
      feedbackStatus: feedbackItems.status,
      feedbackDecisionRationale: feedbackItems.decisionRationale,
      feedbackIsAnonymous: feedbackItems.isAnonymous,
      feedbackCreatedAt: feedbackItems.createdAt,
      submitterOrgType: users.orgType,
      submitterName: users.name,
      crReadableId: changeRequests.readableId,
      crTitle: changeRequests.title,
      crStatus: changeRequests.status,
      sectionTitle: policySections.title,
      versionLabel: documentVersions.versionLabel,
    })
    .from(feedbackItems)
    .leftJoin(users, eq(feedbackItems.submitterId, users.id))
    .leftJoin(crFeedbackLinks, eq(feedbackItems.id, crFeedbackLinks.feedbackId))
    .leftJoin(changeRequests, eq(crFeedbackLinks.crId, changeRequests.id))
    .leftJoin(documentVersions, eq(changeRequests.mergedVersionId, documentVersions.id))
    .leftJoin(crSectionLinks, eq(changeRequests.id, crSectionLinks.crId))
    .leftJoin(policySections, eq(crSectionLinks.sectionId, policySections.id))
    .where(and(...conditions))
    .orderBy(desc(feedbackItems.createdAt))
    .limit(EXPORT_ROW_LIMIT + 1)

  const truncated = rows.length > EXPORT_ROW_LIMIT
  const boundedRows = truncated ? rows.slice(0, EXPORT_ROW_LIMIT) : rows

  // Anonymity enforcement. R4: tighten to `admin` only -- the tRPC
  // traceability.matrix procedure restricts identity visibility to admin
  // (E5 anonymity promise). Keeping policy_lead here would let a policy
  // lead download the PDF and see the org type of anonymous rows they
  // cannot see in the matrix UI.
  const canSeeIdentity = user.role === 'admin'

  // R13: include `submitterOrgType` in the row shape so the PDF can show
  // org-type context, matching what non-anonymous rows already reveal in
  // the tRPC matrix UI and the CSV. The column is nulled when anonymity
  // rules suppress identity.
  const matrixRows = boundedRows.map((row) => ({
    feedbackReadableId: row.feedbackReadableId,
    feedbackTitle: row.feedbackTitle,
    feedbackStatus: row.feedbackStatus,
    feedbackDecisionRationale: row.feedbackDecisionRationale,
    crReadableId: row.crReadableId,
    sectionTitle: row.sectionTitle,
    versionLabel: row.versionLabel,
    submitterOrgType: (row.feedbackIsAnonymous && !canSeeIdentity) ? null : row.submitterOrgType,
  }))

  // Fetch document title
  const doc = await db.query.policyDocuments.findFirst({
    where: eq(policyDocuments.id, documentId),
    columns: { title: true },
  })
  const documentTitle = doc?.title ?? 'Untitled Document'

  // Dynamic import to handle potential ESM/CJS issues in Next.js App Router
  const { renderToBuffer } = await import('@react-pdf/renderer')
  const { default: TraceabilityPDF } = await import('./_document/traceability-pdf')

  const buffer = await renderToBuffer(
    <TraceabilityPDF
      rows={matrixRows}
      documentTitle={documentTitle}
      truncated={truncated}
      rowLimit={EXPORT_ROW_LIMIT}
    />
  )

  // Write audit log (fire-and-forget to avoid crashing export on log failure)
  writeAuditLog({
    actorId: user.id,
    actorRole: user.role,
    action: ACTIONS.TRACE_EXPORT,
    entityType: 'document',
    entityId: documentId,
    payload: { format: 'pdf' },
  }).catch(console.error)

  // R16: surface truncation to callers via a response header in addition
  // to the banner rendered inside the PDF document itself.
  const responseHeaders: Record<string, string> = {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="traceability-${documentId}.pdf"`,
  }
  if (truncated) {
    responseHeaders['X-Truncated'] = 'true'
    responseHeaders['X-Row-Limit'] = String(EXPORT_ROW_LIMIT)
  }

  return new Response(buffer as unknown as BodyInit, { headers: responseHeaders })
}

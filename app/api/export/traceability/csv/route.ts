import { type NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Papa from 'papaparse'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { feedbackItems } from '@/src/db/schema/feedback'
import { changeRequests, crFeedbackLinks, crSectionLinks, documentVersions } from '@/src/db/schema/changeRequests'
import { policySections } from '@/src/db/schema/documents'
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
  // Accept either repeated params (`?orgType=a&orgType=b`) OR a single
  // comma-separated param (`?orgType=a,b`). Unknown values are silently
  // dropped so a malformed filter can't crash the export.
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

  // D5: accept array filters via repeated / comma-separated params.
  // Backward-compat: also accept the old single-value `orgType` /
  // `decisionOutcome` keys.
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

  // Version range filter — D6: apply as `(col >= X) OR col IS NULL` so
  // feedback whose CR was never merged isn't silently dropped by the
  // left join.
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

  // Execute the matrix query.
  //
  // R10: `selectDistinct` collapses (feedback,CR,section,version) fan-out
  //      so a CR linked to multiple sections does not inflate the row
  //      count with duplicate feedback identity.
  // R16: hard cap at 5000 rows. tRPC's `matrix` proc caps at 500, but the
  //      CSV route previously materialised the entire result set into
  //      memory before serializing, inviting OOM / timeout on policies
  //      with thousands of items. Callers who hit the cap are warned via
  //      an `X-Truncated` response header below.
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
  // (E5 anonymity promise), but the CSV exporter used to also reveal
  // `orgType` to policy_lead, which would let a policy_lead download the
  // CSV and see the org type of anonymous feedback rows that they cannot
  // see in the matrix UI. Match the tRPC gate exactly.
  const canSeeIdentity = user.role === 'admin'

  // R13: include `Submitter Name` alongside `Org Type` so the CSV column
  // set matches what a reviewer sees for non-anonymous rows. The column
  // is always present; `--` shows for anonymous rows or when identity is
  // restricted.
  const csvData = boundedRows.map((row) => ({
    'Feedback ID': row.feedbackReadableId,
    'Feedback Title': row.feedbackTitle,
    'Status': row.feedbackStatus,
    'Decision Rationale': row.feedbackDecisionRationale ?? '--',
    'Submitter Name': (row.feedbackIsAnonymous && !canSeeIdentity) ? '--' : (row.submitterName ?? '--'),
    'Org Type': (row.feedbackIsAnonymous && !canSeeIdentity) ? '--' : (row.submitterOrgType ?? '--'),
    'CR ID': row.crReadableId ?? '--',
    'CR Title': row.crTitle ?? '--',
    'CR Status': row.crStatus ?? '--',
    'Section': row.sectionTitle ?? '--',
    'Version': row.versionLabel ?? '--',
    'Date Submitted': row.feedbackCreatedAt ? new Date(row.feedbackCreatedAt).toISOString().split('T')[0] : '--',
  }))

  const csv = Papa.unparse(csvData)

  // Write audit log (fire-and-forget to avoid crashing export on log failure)
  writeAuditLog({
    actorId: user.id,
    actorRole: user.role,
    action: ACTIONS.TRACE_EXPORT,
    entityType: 'document',
    entityId: documentId,
    payload: { format: 'csv' },
  }).catch(console.error)

  // R16: signal truncation via a response header so callers can surface
  // a "export capped at N rows" warning. Browsers ignore unknown headers
  // when downloading a file; integration tests or script callers can
  // check it explicitly.
  const responseHeaders: Record<string, string> = {
    'Content-Type': 'text/csv',
    'Content-Disposition': `attachment; filename="traceability-${documentId}.csv"`,
  }
  if (truncated) {
    responseHeaders['X-Truncated'] = 'true'
    responseHeaders['X-Row-Limit'] = String(EXPORT_ROW_LIMIT)
  }

  return new Response(csv, { headers: responseHeaders })
}

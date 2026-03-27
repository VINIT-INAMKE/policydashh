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
import { eq, and, desc, gte, lte } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  // Auth check
  const { userId } = await auth()
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const user = await db.query.users.findFirst({ where: eq(users.clerkId, userId) })
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

  const orgType = searchParams.get('orgType')
  const sectionId = searchParams.get('sectionId')
  const decisionOutcome = searchParams.get('decisionOutcome')
  const versionFromLabel = searchParams.get('versionFromLabel')
  const versionToLabel = searchParams.get('versionToLabel')

  // Build conditions
  const conditions: ReturnType<typeof eq>[] = [
    eq(feedbackItems.documentId, documentId),
  ]

  if (sectionId) {
    conditions.push(eq(feedbackItems.sectionId, sectionId))
  }
  if (decisionOutcome) {
    conditions.push(eq(feedbackItems.status, decisionOutcome as 'submitted' | 'under_review' | 'accepted' | 'partially_accepted' | 'rejected' | 'closed'))
  }
  if (orgType) {
    conditions.push(eq(users.orgType, orgType as 'government' | 'industry' | 'legal' | 'academia' | 'civil_society' | 'internal'))
  }

  // Version range filter
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
      conditions.push(gte(documentVersions.createdAt, fromVersion.createdAt))
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
      conditions.push(lte(documentVersions.createdAt, toVersion.createdAt))
    }
  }

  // Execute the matrix query
  const rows = await db
    .select({
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

  // Anonymity enforcement
  const canSeeIdentity = user.role === 'admin' || user.role === 'policy_lead'

  const matrixRows = rows.map((row) => ({
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
    <TraceabilityPDF rows={matrixRows} documentTitle={documentTitle} />
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

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="traceability-${documentId}.pdf"`,
    },
  })
}

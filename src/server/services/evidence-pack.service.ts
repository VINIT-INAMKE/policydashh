import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { feedbackItems } from '@/src/db/schema/feedback'
import { changeRequests, crFeedbackLinks, crSectionLinks, documentVersions } from '@/src/db/schema/changeRequests'
import { policySections, policyDocuments } from '@/src/db/schema/documents'
import { workflowTransitions } from '@/src/db/schema/workflow'
import { eq, and, asc, desc, or, inArray } from 'drizzle-orm'
import Papa from 'papaparse'

const encoder = new TextEncoder()

/**
 * Builds all evidence pack artifacts for a given document.
 * Returns a map of filename -> Uint8Array content, ready for ZIP assembly.
 */
export async function buildEvidencePack(
  documentId: string
): Promise<Record<string, Uint8Array>> {
  // Fetch document title for INDEX.md
  const doc = await db.query.policyDocuments.findFirst({
    where: eq(policyDocuments.id, documentId),
  })
  const documentTitle = doc?.title ?? 'Unknown Policy'

  // 1. Stakeholders CSV
  const stakeholderRows = await db
    .select({
      name: users.name,
      role: users.role,
      orgType: users.orgType,
      submitterId: feedbackItems.submitterId,
      isAnonymous: feedbackItems.isAnonymous,
    })
    .from(feedbackItems)
    .innerJoin(users, eq(feedbackItems.submitterId, users.id))
    .where(eq(feedbackItems.documentId, documentId))

  // Aggregate by submitter
  const stakeholderMap = new Map<
    string,
    { name: string; role: string; orgType: string | null; count: number }
  >()
  for (const row of stakeholderRows) {
    const existing = stakeholderMap.get(row.submitterId)
    if (existing) {
      existing.count++
    } else {
      stakeholderMap.set(row.submitterId, {
        name: 'Anonymous', // Always anonymize for evidence pack export
        role: row.role,
        orgType: row.orgType,
        count: 1,
      })
    }
  }

  const stakeholderCsvData = Array.from(stakeholderMap.values()).map((s) => ({
    Name: s.name,
    Role: s.role,
    'Organisation Type': s.orgType ?? '--',
    'Feedback Count': s.count,
  }))
  const stakeholdersCsv = Papa.unparse(stakeholderCsvData)

  // 2. Feedback matrix CSV
  const feedbackRows = await db
    .select({
      feedbackId: feedbackItems.readableId,
      feedbackType: feedbackItems.feedbackType,
      priority: feedbackItems.priority,
      impactCategory: feedbackItems.impactCategory,
      status: feedbackItems.status,
      decisionRationale: feedbackItems.decisionRationale,
      sectionTitle: policySections.title,
      crReadableId: changeRequests.readableId,
      versionLabel: documentVersions.versionLabel,
    })
    .from(feedbackItems)
    .leftJoin(policySections, eq(feedbackItems.sectionId, policySections.id))
    .leftJoin(crFeedbackLinks, eq(feedbackItems.id, crFeedbackLinks.feedbackId))
    .leftJoin(changeRequests, eq(crFeedbackLinks.crId, changeRequests.id))
    .leftJoin(crSectionLinks, eq(changeRequests.id, crSectionLinks.crId))
    .leftJoin(documentVersions, eq(changeRequests.mergedVersionId, documentVersions.id))
    .where(eq(feedbackItems.documentId, documentId))
    .orderBy(desc(feedbackItems.createdAt))

  const feedbackMatrixData = feedbackRows.map((row) => ({
    'Feedback ID': row.feedbackId,
    Type: row.feedbackType,
    Priority: row.priority,
    Impact: row.impactCategory,
    Status: row.status,
    'Decision Rationale': row.decisionRationale ?? '--',
    Section: row.sectionTitle ?? '--',
    'CR ID': row.crReadableId ?? '--',
    Version: row.versionLabel ?? '--',
  }))
  const feedbackMatrixCsv = Papa.unparse(feedbackMatrixData)

  // 3. Version history JSON
  const versions = await db
    .select({
      id: documentVersions.id,
      versionLabel: documentVersions.versionLabel,
      mergeSummary: documentVersions.mergeSummary,
      createdAt: documentVersions.createdAt,
      publishedAt: documentVersions.publishedAt,
      isPublished: documentVersions.isPublished,
      changelog: documentVersions.changelog,
    })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(asc(documentVersions.createdAt))

  const versionHistoryJson = JSON.stringify(versions, null, 2)

  // 4. Decision log JSON
  // Get all feedback IDs and CR IDs for this document
  const docFeedbackIds = await db
    .select({ id: feedbackItems.id })
    .from(feedbackItems)
    .where(eq(feedbackItems.documentId, documentId))

  const docCrIds = await db
    .select({ id: changeRequests.id })
    .from(changeRequests)
    .where(eq(changeRequests.documentId, documentId))

  const feedbackUuids = docFeedbackIds.map((f) => f.id)
  const crUuids = docCrIds.map((c) => c.id)

  let decisionLogEntries: Array<{
    entityType: string
    entityId: string
    fromState: string | null
    toState: string
    actorRole: string
    rationale: Record<string, unknown> | null
    timestamp: Date
  }> = []

  if (feedbackUuids.length > 0 || crUuids.length > 0) {
    const conditions = []
    if (feedbackUuids.length > 0) {
      conditions.push(
        and(
          eq(workflowTransitions.entityType, 'feedback'),
          inArray(workflowTransitions.entityId, feedbackUuids)
        )
      )
    }
    if (crUuids.length > 0) {
      conditions.push(
        and(
          eq(workflowTransitions.entityType, 'change_request'),
          inArray(workflowTransitions.entityId, crUuids)
        )
      )
    }

    const transitions = await db
      .select({
        entityType: workflowTransitions.entityType,
        entityId: workflowTransitions.entityId,
        fromState: workflowTransitions.fromState,
        toState: workflowTransitions.toState,
        actorId: workflowTransitions.actorId,
        metadata: workflowTransitions.metadata,
        timestamp: workflowTransitions.timestamp,
      })
      .from(workflowTransitions)
      .where(conditions.length === 1 ? conditions[0] : or(...conditions))
      .orderBy(asc(workflowTransitions.timestamp))

    // SECURITY: Resolve actor IDs to role names to avoid exposing raw UUIDs
    // in the exported evidence pack
    const actorIds = [...new Set(transitions.map((t) => t.actorId))]
    const actorRoleMap = new Map<string, string>()
    if (actorIds.length > 0) {
      const actorRows = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(inArray(users.id, actorIds))
      for (const row of actorRows) {
        actorRoleMap.set(row.id, row.role)
      }
    }

    decisionLogEntries = transitions.map((t) => ({
      entityType: t.entityType,
      entityId: t.entityId,
      fromState: t.fromState,
      toState: t.toState,
      actorRole: actorRoleMap.get(t.actorId) ?? 'unknown',
      rationale: t.metadata,
      timestamp: t.timestamp,
    }))
  }

  const decisionLogJson = JSON.stringify(decisionLogEntries, null, 2)

  // 5. Workshop evidence JSON (placeholder -- Phase 10 not built)
  const workshopEvidenceJson = JSON.stringify(
    {
      note: 'Workshop module is pending (Phase 10). No workshop data available at this time.',
    },
    null,
    2
  )

  // 6. INDEX.md
  const indexMd = `# Evidence Pack — ${documentTitle}

Generated: ${new Date().toISOString()}

## Contents

- stakeholders.csv — List of stakeholders who submitted feedback
- feedback-matrix.csv — Full feedback traceability matrix
- version-history.json — Complete version history with changelogs
- decision-log.json — All workflow transitions and decision rationale
- workshop-evidence.json — Workshop evidence (pending Phase 10)
`

  return {
    'INDEX.md': encoder.encode(indexMd),
    'stakeholders.csv': encoder.encode(stakeholdersCsv),
    'feedback-matrix.csv': encoder.encode(feedbackMatrixCsv),
    'version-history.json': encoder.encode(versionHistoryJson),
    'decision-log.json': encoder.encode(decisionLogJson),
    'workshop-evidence.json': encoder.encode(workshopEvidenceJson),
  }
}

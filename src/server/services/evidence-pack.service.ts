import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { feedbackItems } from '@/src/db/schema/feedback'
import { changeRequests, crFeedbackLinks, crSectionLinks, documentVersions } from '@/src/db/schema/changeRequests'
import { policySections, policyDocuments } from '@/src/db/schema/documents'
import { workflowTransitions } from '@/src/db/schema/workflow'
import { evidenceArtifacts, feedbackEvidence, sectionEvidence } from '@/src/db/schema/evidence'
import {
  workshops,
  workshopArtifacts,
  workshopRegistrations,
  workshopSectionLinks,
} from '@/src/db/schema/workshops'
import { eq, and, asc, desc, or, inArray } from 'drizzle-orm'
import Papa from 'papaparse'

const encoder = new TextEncoder()

export interface EvidencePackSections {
  stakeholders?: boolean
  feedback?: boolean
  versions?: boolean
  decisions?: boolean
  workshops?: boolean
}

/**
 * Resolve the "include this section" flag for a given key. Missing or
 * explicitly-true values include the section; only `false` excludes it.
 * Keeps the old full-export behavior when the caller passes no selection.
 */
function include(sections: EvidencePackSections | undefined, key: keyof EvidencePackSections): boolean {
  if (!sections) return true
  const value = sections[key]
  return value === undefined ? true : value
}

/**
 * Builds all evidence pack artifacts for a given document.
 * Returns a map of filename -> Uint8Array content, ready for ZIP assembly.
 */
export async function buildEvidencePack(
  documentId: string,
  sections?: EvidencePackSections,
): Promise<Record<string, Uint8Array>> {
  // Fetch document title for INDEX.md
  const doc = await db.query.policyDocuments.findFirst({
    where: eq(policyDocuments.id, documentId),
  })
  const documentTitle = doc?.title ?? 'Unknown Policy'

  const includeStakeholders = include(sections, 'stakeholders')
  const includeFeedback     = include(sections, 'feedback')
  const includeVersions     = include(sections, 'versions')
  const includeDecisions    = include(sections, 'decisions')
  const includeWorkshops    = include(sections, 'workshops')

  const outputs: Record<string, Uint8Array> = {}

  // 1. Stakeholders CSV
  if (includeStakeholders) {
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

    // Aggregate by submitter. H4: respect `isAnonymous` per-row - a submitter
    // who files one anonymous + one signed piece of feedback appears under
    // their real name (the signed rows dominate once we see any non-anon).
    const stakeholderMap = new Map<
      string,
      { name: string; role: string; orgType: string | null; count: number; anonymous: boolean }
    >()
    for (const row of stakeholderRows) {
      const existing = stakeholderMap.get(row.submitterId)
      if (existing) {
        existing.count++
        // If any row is non-anonymous, surface the real identity.
        if (!row.isAnonymous) {
          existing.anonymous = false
          existing.name = row.name ?? existing.name
        }
      } else {
        stakeholderMap.set(row.submitterId, {
          name: row.isAnonymous ? 'Anonymous' : (row.name ?? 'Unknown'),
          role: row.role,
          orgType: row.orgType,
          count: 1,
          anonymous: row.isAnonymous,
        })
      }
    }

    const stakeholderCsvData = Array.from(stakeholderMap.values()).map((s) => ({
      Name: s.anonymous ? 'Anonymous' : s.name,
      Role: s.role,
      'Organisation Type': s.orgType ?? '--',
      'Feedback Count': s.count,
    }))
    outputs['stakeholders.csv'] = encoder.encode(Papa.unparse(stakeholderCsvData))
  }

  // 2. Feedback matrix CSV
  if (includeFeedback) {
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
    outputs['feedback-matrix.csv'] = encoder.encode(Papa.unparse(feedbackMatrixData))
  }

  // 3. Version history JSON
  if (includeVersions) {
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

    outputs['version-history.json'] = encoder.encode(JSON.stringify(versions, null, 2))
  }

  // 4. Decision log JSON
  if (includeDecisions) {
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

    outputs['decision-log.json'] = encoder.encode(JSON.stringify(decisionLogEntries, null, 2))
  }

  // 5. Workshop evidence JSON (H2: real data).
  //
  // A workshop is linked to a document indirectly through its section links
  // (workshop_section_links → policy_sections.documentId). We collect every
  // workshop with at least one section belonging to this document, then pull
  // artifacts + registrations for those workshops.
  if (includeWorkshops) {
    const docWorkshops = await db
      .selectDistinct({
        id:              workshops.id,
        title:           workshops.title,
        description:     workshops.description,
        scheduledAt:     workshops.scheduledAt,
        durationMinutes: workshops.durationMinutes,
        status:          workshops.status,
        createdAt:       workshops.createdAt,
      })
      .from(workshops)
      .innerJoin(workshopSectionLinks, eq(workshopSectionLinks.workshopId, workshops.id))
      .innerJoin(policySections, eq(policySections.id, workshopSectionLinks.sectionId))
      .where(eq(policySections.documentId, documentId))

    const workshopIds = docWorkshops.map((w) => w.id)

    let artifactRows: Array<{
      workshopId:   string
      artifactType: string
      reviewStatus: string
      artifactId:   string
      title:        string
      type:         'file' | 'link'
      url:          string
      fileName:     string | null
      fileSize:     number | null
      content:      string | null
      createdAt:    Date
    }> = []

    let registrationRows: Array<{
      workshopId:       string
      email:            string
      name:             string | null
      status:           string
      attendedAt:       Date | null
      attendanceSource: string | null
      bookingStartTime: Date
      cancelledAt:      Date | null
      createdAt:        Date
    }> = []

    if (workshopIds.length > 0) {
      artifactRows = await db
        .select({
          workshopId:   workshopArtifacts.workshopId,
          artifactType: workshopArtifacts.artifactType,
          reviewStatus: workshopArtifacts.reviewStatus,
          artifactId:   evidenceArtifacts.id,
          title:        evidenceArtifacts.title,
          type:         evidenceArtifacts.type,
          url:          evidenceArtifacts.url,
          fileName:     evidenceArtifacts.fileName,
          fileSize:     evidenceArtifacts.fileSize,
          content:      evidenceArtifacts.content,
          createdAt:    evidenceArtifacts.createdAt,
        })
        .from(workshopArtifacts)
        .innerJoin(evidenceArtifacts, eq(evidenceArtifacts.id, workshopArtifacts.artifactId))
        .where(inArray(workshopArtifacts.workshopId, workshopIds))

      registrationRows = await db
        .select({
          workshopId:       workshopRegistrations.workshopId,
          email:            workshopRegistrations.email,
          name:             workshopRegistrations.name,
          status:           workshopRegistrations.status,
          attendedAt:       workshopRegistrations.attendedAt,
          attendanceSource: workshopRegistrations.attendanceSource,
          bookingStartTime: workshopRegistrations.bookingStartTime,
          cancelledAt:      workshopRegistrations.cancelledAt,
          createdAt:        workshopRegistrations.createdAt,
        })
        .from(workshopRegistrations)
        .where(inArray(workshopRegistrations.workshopId, workshopIds))
    }

    const artifactsByWorkshop = new Map<string, typeof artifactRows>()
    for (const art of artifactRows) {
      const bucket = artifactsByWorkshop.get(art.workshopId) ?? []
      bucket.push(art)
      artifactsByWorkshop.set(art.workshopId, bucket)
    }

    const registrationsByWorkshop = new Map<string, typeof registrationRows>()
    for (const reg of registrationRows) {
      const bucket = registrationsByWorkshop.get(reg.workshopId) ?? []
      bucket.push(reg)
      registrationsByWorkshop.set(reg.workshopId, bucket)
    }

    const workshopEvidence = docWorkshops.map((w) => {
      const arts = artifactsByWorkshop.get(w.id) ?? []
      const regs = registrationsByWorkshop.get(w.id) ?? []
      return {
        id:              w.id,
        title:           w.title,
        description:     w.description,
        scheduledAt:     w.scheduledAt,
        durationMinutes: w.durationMinutes,
        status:          w.status,
        createdAt:       w.createdAt,
        artifacts: arts.map((a) => ({
          artifactId:   a.artifactId,
          title:        a.title,
          type:         a.type,
          url:          a.url,
          fileName:     a.fileName,
          fileSize:     a.fileSize,
          artifactType: a.artifactType,
          reviewStatus: a.reviewStatus,
          hasInlineContent: a.content !== null && a.content.length > 0,
          createdAt:    a.createdAt,
        })),
        registrations: regs.map((r) => ({
          email:            r.email,
          name:             r.name,
          status:           r.status,
          attendedAt:       r.attendedAt,
          attendanceSource: r.attendanceSource,
          bookingStartTime: r.bookingStartTime,
          cancelledAt:      r.cancelledAt,
          createdAt:        r.createdAt,
        })),
        counts: {
          artifacts:     arts.length,
          registrations: regs.length,
          attended:      regs.filter((r) => r.attendedAt !== null).length,
        },
      }
    })

    outputs['workshop-evidence.json'] = encoder.encode(
      JSON.stringify(
        {
          workshops: workshopEvidence,
          totalWorkshops: workshopEvidence.length,
        },
        null,
        2,
      ),
    )

    // H3: inline artifact content. For evidence artifacts with non-null
    // `content`, emit the text alongside the main metadata so auditors can
    // review it without fetching the binary.
    for (const art of artifactRows) {
      if (art.content && art.content.length > 0) {
        outputs[`workshops/${art.workshopId}/${art.artifactId}-inline.txt`] =
          encoder.encode(art.content)
      }
    }
  }

  // H3: inline artifact content for feedback- and section-attached evidence
  // (not only workshops). We scope to artifacts reachable from THIS document:
  // either attached to a feedback item in the doc, or to a section in the doc.
  // The workshops branch above already emits inline files under workshops/,
  // so we dedupe by artifact id.
  {
    const feedbackInline = await db
      .select({
        id:      evidenceArtifacts.id,
        title:   evidenceArtifacts.title,
        content: evidenceArtifacts.content,
      })
      .from(evidenceArtifacts)
      .innerJoin(feedbackEvidence, eq(feedbackEvidence.artifactId, evidenceArtifacts.id))
      .innerJoin(feedbackItems, eq(feedbackItems.id, feedbackEvidence.feedbackId))
      .where(eq(feedbackItems.documentId, documentId))

    const sectionInline = await db
      .select({
        id:      evidenceArtifacts.id,
        title:   evidenceArtifacts.title,
        content: evidenceArtifacts.content,
      })
      .from(evidenceArtifacts)
      .innerJoin(sectionEvidence, eq(sectionEvidence.artifactId, evidenceArtifacts.id))
      .innerJoin(policySections, eq(policySections.id, sectionEvidence.sectionId))
      .where(eq(policySections.documentId, documentId))

    const emittedInlineIds = new Set<string>()
    // Track artifact IDs already emitted via the workshop branch so we don't
    // duplicate the same content under two prefixes.
    for (const key of Object.keys(outputs)) {
      const match = key.match(/([0-9a-fA-F-]{36})-inline\.txt$/)
      if (match) emittedInlineIds.add(match[1])
    }
    for (const row of [...feedbackInline, ...sectionInline]) {
      if (!row.content || row.content.length === 0) continue
      if (emittedInlineIds.has(row.id)) continue
      outputs[`inline/${row.id}-inline.txt`] = encoder.encode(row.content)
      emittedInlineIds.add(row.id)
    }
  }

  // 6. INDEX.md
  const indexLines: string[] = [
    `# Evidence Pack - ${documentTitle}`,
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Contents',
    '',
  ]
  if (includeStakeholders) indexLines.push('- stakeholders.csv - List of stakeholders who submitted feedback')
  if (includeFeedback)     indexLines.push('- feedback-matrix.csv - Full feedback traceability matrix')
  if (includeVersions)     indexLines.push('- version-history.json - Complete version history with changelogs')
  if (includeDecisions)    indexLines.push('- decision-log.json - All workflow transitions and decision rationale')
  if (includeWorkshops)    indexLines.push('- workshop-evidence.json - Workshop artifacts and registrations')
  indexLines.push('- inline/ - Inline text content from evidence artifacts (when present)')

  outputs['INDEX.md'] = encoder.encode(indexLines.join('\n') + '\n')

  return outputs
}

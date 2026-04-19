import { z } from 'zod'
import { router, requirePermission } from '@/src/trpc/init'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS } from '@/src/lib/constants'
import { db } from '@/src/db'
import { evidenceArtifacts, feedbackEvidence, sectionEvidence } from '@/src/db/schema/evidence'
import { users } from '@/src/db/schema/users'
import { feedbackItems } from '@/src/db/schema/feedback'
import { policySections, policyDocuments } from '@/src/db/schema/documents'
import { eq, and, isNull, desc, inArray } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { sendEvidenceExportRequested } from '@/src/inngest/events'
import { consume } from '@/src/lib/rate-limit'

export const evidenceRouter = router({
  // Attach evidence artifact (file or link) to a feedback item or section
  attach: requirePermission('evidence:upload')
    .input(z.object({
      title: z.string().min(1),
      type: z.enum(['file', 'link']),
      url: z.string().url(),
      fileName: z.string().optional(),
      fileSize: z.number().optional(),
      feedbackId: z.string().uuid().optional(),
      sectionId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!input.feedbackId && !input.sectionId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Either feedbackId or sectionId must be provided',
        })
      }

      // Insert the evidence artifact
      const [artifact] = await db
        .insert(evidenceArtifacts)
        .values({
          title: input.title,
          type: input.type,
          url: input.url,
          fileName: input.fileName ?? null,
          fileSize: input.fileSize ?? null,
          uploaderId: ctx.user.id,
        })
        .returning()

      // Insert into appropriate join table(s) -- sequential inserts (no transactions)
      if (input.feedbackId) {
        await db.insert(feedbackEvidence).values({
          feedbackId: input.feedbackId,
          artifactId: artifact.id,
        })
      }

      if (input.sectionId) {
        await db.insert(sectionEvidence).values({
          sectionId: input.sectionId,
          artifactId: artifact.id,
        })
      }

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.EVIDENCE_ATTACH,
        entityType: 'evidence',
        entityId: artifact.id,
        payload: {
          title: input.title,
          type: input.type,
          feedbackId: input.feedbackId,
          sectionId: input.sectionId,
        },
        ipAddress: ctx.requestMeta.ipAddress,
      }).catch(console.error)

      return artifact
    }),

  // List evidence attached to a feedback item (EV-04: includes uploaderName)
  listByFeedback: requirePermission('evidence:read')
    .input(z.object({ feedbackId: z.string().uuid() }))
    .query(async ({ input }) => {
      const rows = await db
        .select({
          id: evidenceArtifacts.id,
          title: evidenceArtifacts.title,
          type: evidenceArtifacts.type,
          url: evidenceArtifacts.url,
          fileName: evidenceArtifacts.fileName,
          fileSize: evidenceArtifacts.fileSize,
          uploaderId: evidenceArtifacts.uploaderId,
          createdAt: evidenceArtifacts.createdAt,
          uploaderName: users.name,
        })
        .from(feedbackEvidence)
        .innerJoin(evidenceArtifacts, eq(feedbackEvidence.artifactId, evidenceArtifacts.id))
        .innerJoin(users, eq(evidenceArtifacts.uploaderId, users.id))
        .where(eq(feedbackEvidence.feedbackId, input.feedbackId))

      return rows
    }),

  // D1: list every evidence artifact that belongs to a document (via sections
  // or feedback join tables) with `milestoneId` so the milestone detail page
  // can render the Evidence tab with per-row attached state. Results are
  // deduped by artifact id.
  listByDocument: requirePermission('evidence:read')
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ input }) => {
      const viaSections = await db
        .selectDistinct({
          id: evidenceArtifacts.id,
          title: evidenceArtifacts.title,
          type: evidenceArtifacts.type,
          url: evidenceArtifacts.url,
          fileName: evidenceArtifacts.fileName,
          fileSize: evidenceArtifacts.fileSize,
          uploaderId: evidenceArtifacts.uploaderId,
          createdAt: evidenceArtifacts.createdAt,
          milestoneId: evidenceArtifacts.milestoneId,
          uploaderName: users.name,
        })
        .from(evidenceArtifacts)
        .innerJoin(sectionEvidence, eq(sectionEvidence.artifactId, evidenceArtifacts.id))
        .innerJoin(policySections, eq(policySections.id, sectionEvidence.sectionId))
        .innerJoin(users, eq(evidenceArtifacts.uploaderId, users.id))
        .where(eq(policySections.documentId, input.documentId))

      const viaFeedback = await db
        .selectDistinct({
          id: evidenceArtifacts.id,
          title: evidenceArtifacts.title,
          type: evidenceArtifacts.type,
          url: evidenceArtifacts.url,
          fileName: evidenceArtifacts.fileName,
          fileSize: evidenceArtifacts.fileSize,
          uploaderId: evidenceArtifacts.uploaderId,
          createdAt: evidenceArtifacts.createdAt,
          milestoneId: evidenceArtifacts.milestoneId,
          uploaderName: users.name,
        })
        .from(evidenceArtifacts)
        .innerJoin(feedbackEvidence, eq(feedbackEvidence.artifactId, evidenceArtifacts.id))
        .innerJoin(feedbackItems, eq(feedbackItems.id, feedbackEvidence.feedbackId))
        .innerJoin(users, eq(evidenceArtifacts.uploaderId, users.id))
        .where(eq(feedbackItems.documentId, input.documentId))

      const byId = new Map<string, (typeof viaSections)[number]>()
      for (const row of [...viaSections, ...viaFeedback]) {
        if (!byId.has(row.id)) byId.set(row.id, row)
      }
      return Array.from(byId.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
    }),

  // List evidence attached to a section (EV-04: includes uploaderName)
  listBySection: requirePermission('evidence:read')
    .input(z.object({ sectionId: z.string().uuid() }))
    .query(async ({ input }) => {
      const rows = await db
        .select({
          id: evidenceArtifacts.id,
          title: evidenceArtifacts.title,
          type: evidenceArtifacts.type,
          url: evidenceArtifacts.url,
          fileName: evidenceArtifacts.fileName,
          fileSize: evidenceArtifacts.fileSize,
          uploaderId: evidenceArtifacts.uploaderId,
          createdAt: evidenceArtifacts.createdAt,
          uploaderName: users.name,
        })
        .from(sectionEvidence)
        .innerJoin(evidenceArtifacts, eq(sectionEvidence.artifactId, evidenceArtifacts.id))
        .innerJoin(users, eq(evidenceArtifacts.uploaderId, users.id))
        .where(eq(sectionEvidence.sectionId, input.sectionId))

      return rows
    }),

  // Remove an evidence artifact (cascades to join tables)
  remove: requirePermission('evidence:upload')
    .input(z.object({ artifactId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // SECURITY: Check ownership before deleting - only uploader, admin, or policy_lead
      const [artifact] = await db
        .select({ uploaderId: evidenceArtifacts.uploaderId })
        .from(evidenceArtifacts)
        .where(eq(evidenceArtifacts.id, input.artifactId))
        .limit(1)

      if (!artifact) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Evidence artifact not found' })
      }

      const isUploader = artifact.uploaderId === ctx.user.id
      const isPrivileged = ctx.user.role === 'admin' || ctx.user.role === 'policy_lead'
      if (!isUploader && !isPrivileged) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the uploader, admin, or policy lead can remove this evidence' })
      }

      const [deleted] = await db
        .delete(evidenceArtifacts)
        .where(eq(evidenceArtifacts.id, input.artifactId))
        .returning()

      if (!deleted) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Evidence artifact not found' })
      }

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.EVIDENCE_REMOVE,
        entityType: 'evidence',
        entityId: input.artifactId,
        ipAddress: ctx.requestMeta.ipAddress,
      }).catch(console.error)

      return { success: true }
    }),

  // EV-03: Feedback items that have no evidence artifacts attached.
  //
  // R12: restrict to actionable statuses. `rejected` and `closed` items
  //      will never need supporting evidence; leaving them in inflates the
  //      gap count and sends research leads chasing work that is already
  //      decided. The statuses filter is overridable via input so future
  //      callers (e.g. audit tooling) can opt into a wider view.
  // R23: use `isNull(feedbackEvidence.feedbackId)` rather than
  //      `feedbackEvidence.artifactId`. Both produce the same SQL today
  //      thanks to the LEFT JOIN null-padding, but the join-key null is
  //      the intent-carrying expression: it literally means "no matching
  //      feedbackEvidence row". If artifactId ever becomes nullable (e.g.
  //      soft-delete), the old expression would silently change meaning.
  claimsWithoutEvidence: requirePermission('evidence:read')
    .input(z.object({
      documentId: z.string().uuid().optional(),
      sectionId: z.string().uuid().optional(),
      feedbackType: z.enum(['issue', 'suggestion', 'endorsement', 'evidence', 'question']).optional(),
      statuses: z
        .array(z.enum(['submitted', 'under_review', 'accepted', 'partially_accepted', 'rejected', 'closed']))
        .optional(),
    }))
    .query(async ({ input }) => {
      const conditions = [isNull(feedbackEvidence.feedbackId)]

      // R12 defaults: actionable statuses only. Callers may pass an
      // explicit `statuses` array (even empty -> no status filter) if
      // they genuinely want to include decided items.
      const statusFilter = input.statuses ?? ['submitted', 'under_review', 'accepted', 'partially_accepted']
      if (statusFilter.length > 0) {
        conditions.push(inArray(feedbackItems.status, statusFilter))
      }

      if (input.documentId) {
        conditions.push(eq(policySections.documentId, input.documentId))
      }
      if (input.sectionId) {
        conditions.push(eq(feedbackItems.sectionId, input.sectionId))
      }
      if (input.feedbackType) {
        conditions.push(eq(feedbackItems.feedbackType, input.feedbackType))
      }

      const rows = await db
        .select({
          id: feedbackItems.id,
          readableId: feedbackItems.readableId,
          title: feedbackItems.title,
          feedbackType: feedbackItems.feedbackType,
          sectionId: feedbackItems.sectionId,
          sectionName: policySections.title,
          documentId: policySections.documentId,
          documentTitle: policyDocuments.title,
          createdAt: feedbackItems.createdAt,
        })
        .from(feedbackItems)
        .leftJoin(feedbackEvidence, eq(feedbackItems.id, feedbackEvidence.feedbackId))
        .innerJoin(policySections, eq(feedbackItems.sectionId, policySections.id))
        .innerJoin(policyDocuments, eq(policySections.documentId, policyDocuments.id))
        .where(and(...conditions))
        .orderBy(desc(feedbackItems.createdAt))

      return rows
    }),

  // EV-05: Async evidence pack export. Fires the evidence.export_requested
  // Inngest event and returns immediately. The Inngest function assembles the
  // pack, uploads to R2, and emails the requester a 24h presigned GET URL.
  // Replaces the deleted sync GET /api/export/evidence-pack route.
  requestExport: requirePermission('evidence:export')
    .input(z.object({
      // z.guid() (not z.uuid()) to match the Wave 0 test fixtures that use
      // version-0 UUIDs (Zod 4's z.uuid() rejects them). Identical to the
      // Phase 16 notification.create decision.
      documentId: z.guid(),
      // H1: optional per-section opt-in. Absent values default to include
      // so existing callers keep their full-export behavior.
      sections: z.object({
        stakeholders: z.boolean().optional(),
        feedback:     z.boolean().optional(),
        versions:     z.boolean().optional(),
        decisions:    z.boolean().optional(),
        workshops:    z.boolean().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // D18: per-user rate limit. Each evidence-pack export fans out DB
      // queries, R2 GET/PUT operations, and ZIP assembly inside an Inngest
      // function. A user who loops on the Request Export button (manual
      // or scripted) can trivially exhaust Inngest concurrency budget and
      // R2 bandwidth for the whole org. Limit each user to 3 export
      // requests per hour (tunable; a legitimate admin re-exporting to
      // tweak section filters will still fit well under this).
      const rl = consume(`evidence-pack-export:user:${ctx.user.id}`, {
        max: 3,
        windowMs: 60 * 60 * 1000,
      })
      if (!rl.ok) {
        const retryAfterSec = Math.max(
          1,
          Math.ceil((rl.resetAt - Date.now()) / 1000),
        )
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: `Export rate limit reached (3 per hour). Retry in ${retryAfterSec} seconds.`,
        })
      }

      // Pre-fetch user email at trigger time so the Inngest function doesn't
      // need a DB lookup for the requester's address. Mirrors the Phase 17
      // moderatorId-at-trigger-time pattern for workshop.completed.
      const userEmail = ctx.user.email ?? null

      await sendEvidenceExportRequested({
        documentId:  input.documentId,
        requestedBy: ctx.user.id,
        userEmail,
        sections:    input.sections,
      })

      // Fire-and-forget audit log for the REQUEST event (distinct from the
      // final pack-assembled audit log written inside the Inngest function).
      // Matches the Phase 9 sync route's audit pattern with async: true flag.
      writeAuditLog({
        actorId:    ctx.user.id,
        actorRole:  ctx.user.role,
        action:     ACTIONS.EVIDENCE_PACK_EXPORT,
        entityType: 'document',
        entityId:   input.documentId,
        payload:    { async: true, stage: 'requested', sections: input.sections },
        ipAddress:  ctx.requestMeta.ipAddress,
      }).catch(console.error)

      return { status: 'queued' as const }
    }),
})

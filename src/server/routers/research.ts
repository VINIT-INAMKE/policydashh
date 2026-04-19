import { z } from 'zod'
import { router, requirePermission, protectedProcedure } from '@/src/trpc/init'
import { transitionResearch } from '@/src/server/services/research.service'
import type { ResearchItemStatus } from '@/src/server/services/research.lifecycle'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS, type Role } from '@/src/lib/constants'
import { db } from '@/src/db'
import {
  researchItems,
  researchItemSectionLinks,
  researchItemVersionLinks,
  researchItemFeedbackLinks,
} from '@/src/db/schema/research'
import { eq, and, desc, asc, sql } from 'drizzle-orm'
import { workflowTransitions } from '@/src/db/schema/workflow'
import { users } from '@/src/db/schema/users'
import { evidenceArtifacts } from '@/src/db/schema/evidence'
import { TRPCError } from '@trpc/server'

/**
 * researchRouter — Phase 26 Plan 26-05 (RESEARCH-02 + RESEARCH-04).
 *
 * 15 procedures (3 queries + 12 mutations):
 *
 *   QUERIES
 *     list        — admin/policy_lead/research_lead list with optional filters
 *     listPublic  — all 7 authenticated roles, published only, anonymous-author filter
 *     getById     — single item fetch with anonymous-author filter on published
 *
 *   MUTATIONS — create / update
 *     create      — readableId via nextval('research_item_id_seq') -> RI-NNN
 *     update      — status-locked to draft (Open Q1) + ownership check (Pitfall 6)
 *
 *   MUTATIONS — lifecycle (all delegate to transitionResearch() from Plan 26-04)
 *     submitForReview — draft -> pending_review (research_lead+ own items)
 *     approve         — pending_review -> published (admin/policy_lead only)
 *     reject          — pending_review -> draft (admin/policy_lead only)
 *     retract         — published -> retracted (admin/policy_lead, reason required)
 *
 *   MUTATIONS — link tables (idempotent via onConflictDoNothing())
 *     linkSection / unlinkSection     — research_items <-> policy_sections
 *     linkVersion / unlinkVersion     — research_items <-> document_versions
 *     linkFeedback / unlinkFeedback   — research_items <-> feedback_items
 *
 * Invariants:
 *   - Pitfall 5 (anonymous-author filter): listPublic and published getById
 *     null out `authors` when isAuthorAnonymous = true.
 *   - Pitfall 6 (ownership check): research_lead can only manage items they
 *     created; admin + policy_lead bypass via assertOwnershipOrBypass().
 *   - Open Q1 (status lock): update mutation throws FORBIDDEN when
 *     status !== 'draft'. To force-edit a pending_review item, reject it
 *     first (returns to draft), then update.
 *   - Phase 16 precedent: z.guid() (NOT the deprecated UUID validator) on
 *     every UUID input — Zod 4's UUID validator rejects version-0 UUIDs
 *     used in test fixtures, so z.guid() is the project-wide choice.
 *   - Phase 1 invariant: all writeAuditLog calls are fire-and-forget via
 *     .catch(console.error) — audit failures never block the response.
 *   - Phase 10 pattern: all link-insert operations use .onConflictDoNothing()
 *     so re-linking is idempotent.
 */

// ----- Zod enum literals (must match Drizzle pgEnum order in schema/research.ts) -----

const RESEARCH_ITEM_TYPES = [
  'report',
  'paper',
  'dataset',
  'memo',
  'interview_transcript',
  'media_coverage',
  'legal_reference',
  'case_study',
] as const

const RESEARCH_STATUSES = [
  'draft',
  'pending_review',
  'published',
  'retracted',
] as const

// ----- Shared input schemas -----
//   createInput carries documentId + itemType (both immutable post-create).
//   updateInput omits documentId/itemType and makes every metadata field optional.

const createInput = z.object({
  documentId:        z.guid(),                                  // Q1: NOT NULL per-policy scope
  title:             z.string().min(1).max(500),
  itemType:          z.enum(RESEARCH_ITEM_TYPES),
  description:       z.string().max(5000).optional(),
  externalUrl:       z.string().url().optional(),
  artifactId:        z.guid().optional(),
  doi:               z.string().max(100).optional(),           // Q10: plain text
  authors:           z.array(z.string().min(1).max(200)).optional(),
  publishedDate:     z.string().date().optional(),              // ISO YYYY-MM-DD
  peerReviewed:      z.boolean().default(false),
  journalOrSource:   z.string().max(500).optional(),
  versionLabel:      z.string().max(50).optional(),
  previousVersionId: z.guid().optional(),
  isAuthorAnonymous: z.boolean().default(false),               // Q7
  // Phase 27 D-02 upload metadata. When all four are provided, the
  // server INSERTs an evidence_artifacts row inside the mutation and
  // sets artifactId to that row's id. This is the single-write-boundary
  // solution to Pitfall 1 (POST /api/upload presigns only; someone
  // must create the DB row — we do it here, not client-side).
  // NOTE: artifactR2Key is accepted in the schema for client-server
  // contract symmetry with the upload helper, but evidence_artifacts
  // has no r2_key column (Phase 26 schema choice — workshops follow the
  // same pattern, see workshop.attachArtifact). The key is silently
  // dropped server-side; only url/fileName/fileSize are persisted.
  artifactFileName:  z.string().max(500).optional(),
  artifactFileSize:  z.number().int().positive().max(32 * 1024 * 1024).optional(),
  artifactR2Key:     z.string().max(1000).optional(),
  artifactPublicUrl: z.string().url().max(2000).optional(),
})

const updateInput = z.object({
  id:                z.guid(),
  title:             z.string().min(1).max(500).optional(),
  description:       z.string().max(5000).optional(),
  externalUrl:       z.string().url().optional(),
  artifactId:        z.guid().nullable().optional(),
  doi:               z.string().max(100).optional(),
  authors:           z.array(z.string().min(1).max(200)).optional(),
  publishedDate:     z.string().date().optional(),
  peerReviewed:      z.boolean().optional(),
  journalOrSource:   z.string().max(500).optional(),
  versionLabel:      z.string().max(50).optional(),
  previousVersionId: z.guid().nullable().optional(),
  isAuthorAnonymous: z.boolean().optional(),
  // Phase 27 D-02 upload metadata — same contract as createInput.
  artifactFileName:  z.string().max(500).optional(),
  artifactFileSize:  z.number().int().positive().max(32 * 1024 * 1024).optional(),
  artifactR2Key:     z.string().max(1000).optional(),
  artifactPublicUrl: z.string().url().max(2000).optional(),
})

/**
 * Pitfall 6: secondary ownership check.
 *
 *   admin + policy_lead : bypass (they can manage ANY research item)
 *   research_lead       : must match createdBy
 *   all others          : requirePermission middleware already blocked them
 *
 * Throws FORBIDDEN when a research_lead tries to touch someone else's item.
 * Called after the row has been fetched from the DB in update + submitForReview.
 */
function assertOwnershipOrBypass(
  role: Role,
  rowCreatedBy: string,
  actorId: string,
): void {
  if (role === 'admin' || role === 'policy_lead') return
  if (role === 'research_lead' && rowCreatedBy === actorId) return
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'Can only manage your own research items',
  })
}

export const researchRouter = router({

  // ==========================================================================
  // QUERIES (3)
  // ==========================================================================

  // RESEARCH-04: admin/policy_lead/research_lead list with optional filters.
  // No anonymous-author filter here — draft/pending_review items are only
  // visible to privileged roles who can see the author regardless.
  list: requirePermission('research:read_drafts')
    .input(z.object({
      documentId: z.guid().optional(),
      itemType:   z.enum(RESEARCH_ITEM_TYPES).optional(),
      status:     z.enum(RESEARCH_STATUSES).optional(),
      // Pitfall 2 fix (RESEARCH-06 SC-1): research_lead list page passes
      // authorId=ctx.user.id so role-scoped list returns only own items.
      // Admin/policy_lead omit the filter to see all.
      authorId:   z.guid().optional(),
    }))
    .query(async ({ input }) => {
      const conditions = []
      if (input.documentId) conditions.push(eq(researchItems.documentId, input.documentId))
      if (input.itemType)   conditions.push(eq(researchItems.itemType, input.itemType))
      if (input.status)     conditions.push(eq(researchItems.status, input.status))
      if (input.authorId)   conditions.push(eq(researchItems.createdBy, input.authorId))

      const rows = await db
        .select()
        .from(researchItems)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(researchItems.createdAt))

      return rows
    }),

  // RESEARCH-04: listPublic — all 7 authenticated roles (Pitfall 4).
  // Pitfall 5: null out `authors` when isAuthorAnonymous=true. The filter
  // lives here at the query boundary so no caller can accidentally leak
  // the author array on a published item flagged anonymous.
  listPublic: protectedProcedure
    .input(z.object({
      documentId: z.guid().optional(),
      itemType:   z.enum(RESEARCH_ITEM_TYPES).optional(),
    }))
    .query(async ({ input }) => {
      const conditions = [eq(researchItems.status, 'published')]
      if (input.documentId) conditions.push(eq(researchItems.documentId, input.documentId))
      if (input.itemType)   conditions.push(eq(researchItems.itemType, input.itemType))

      const rows = await db
        .select()
        .from(researchItems)
        .where(and(...conditions))
        .orderBy(desc(researchItems.publishedDate), desc(researchItems.createdAt))

      // Pitfall 5: anonymous-author filter
      return rows.map((row) => {
        if (row.isAuthorAnonymous) {
          return { ...row, authors: null }
        }
        return row
      })
    }),

  // RESEARCH-04: getById — research_lead+ can see any status.
  // Anonymous-author filter fires ONLY when status === 'published'; draft
  // and pending_review items are internal, so the author stays visible to
  // the privileged roles that can see them.
  getById: requirePermission('research:read_drafts')
    .input(z.object({ id: z.guid() }))
    .query(async ({ input }) => {
      const [row] = await db
        .select()
        .from(researchItems)
        .where(eq(researchItems.id, input.id))
        .limit(1)

      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Research item not found' })
      }

      // Pitfall 5: anonymous-author filter applies only to PUBLISHED items
      if (row.isAuthorAnonymous && row.status === 'published') {
        return { ...row, authors: null }
      }
      return row
    }),

  // RESEARCH-06/07: decision-log data source. Returns all workflow
  // transitions for a research item (oldest first) with actorName
  // joined from users. Metadata JSONB carries { rejectionReason } on
  // reject and { retractionReason } on retract — the DecisionLog UI
  // maps these to `rationale` for rendering.
  //
  // Gated by research:read_drafts so research_lead can view the log on
  // their own items (the getById guard already blocks cross-user reads
  // at the list level, but this procedure is invoked only by the
  // detail page which has already fetched the item).
  listTransitions: requirePermission('research:read_drafts')
    .input(z.object({ id: z.guid() }))
    .query(async ({ input }) => {
      return db
        .select({
          id:        workflowTransitions.id,
          fromState: workflowTransitions.fromState,
          toState:   workflowTransitions.toState,
          actorId:   workflowTransitions.actorId,
          timestamp: workflowTransitions.timestamp,
          metadata:  workflowTransitions.metadata,
          actorName: users.name,
        })
        .from(workflowTransitions)
        .leftJoin(users, eq(workflowTransitions.actorId, users.id))
        .where(and(
          eq(workflowTransitions.entityType, 'research_item'),
          eq(workflowTransitions.entityId, input.id),
        ))
        .orderBy(asc(workflowTransitions.timestamp))
    }),

  // ==========================================================================
  // MUTATIONS — CREATE + UPDATE
  // ==========================================================================

  // RESEARCH-02 + RESEARCH-04: create with readable ID from the PostgreSQL
  // sequence. nextval() is atomic, guaranteed by PostgreSQL to never return
  // the same value twice under concurrent writes — same pattern as
  // feedback_id_seq which has been in production since Phase 4 with zero
  // collisions.
  create: requirePermission('research:create')
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      // 1. Generate the readable ID via PostgreSQL sequence (RESEARCH-02)
      //    Pattern source: src/server/routers/feedback.ts lines 40-43
      const seqRows = await db.execute(sql`SELECT nextval('research_item_id_seq') AS seq`)
      const seqResult = seqRows.rows[0] as Record<string, unknown>
      const num = Number(seqResult.seq)
      const readableId = `RI-${String(num).padStart(3, '0')}`

      // Pitfall 1 fix (Phase 27 D-02): when upload metadata provided, create
      // the evidence_artifacts row first and use its id as artifactId. This
      // keeps the write boundary inside the mutation — no orphan rows on
      // success, no FK violation on create. The r2Key (if supplied) is not
      // persisted because evidence_artifacts has no r2_key column; the
      // public URL on artifact.url is what subsequent reads consume.
      let resolvedArtifactId = input.artifactId ?? null
      if (
        !resolvedArtifactId &&
        input.artifactFileName &&
        input.artifactFileSize &&
        input.artifactR2Key &&
        input.artifactPublicUrl
      ) {
        const [artifact] = await db
          .insert(evidenceArtifacts)
          .values({
            type:       'file',
            title:      input.artifactFileName,
            url:        input.artifactPublicUrl,
            fileName:   input.artifactFileName,
            fileSize:   input.artifactFileSize,
            uploaderId: ctx.user.id,
          })
          .returning({ id: evidenceArtifacts.id })
        resolvedArtifactId = artifact.id
      }

      // 2. Insert the row. status defaults to 'draft' via pgEnum default.
      const [item] = await db
        .insert(researchItems)
        .values({
          readableId,
          documentId:        input.documentId,
          title:             input.title,
          itemType:          input.itemType,
          createdBy:         ctx.user.id,
          description:       input.description ?? null,
          externalUrl:       input.externalUrl ?? null,
          artifactId:        resolvedArtifactId,
          doi:               input.doi ?? null,
          authors:           input.authors ?? null,
          publishedDate:     input.publishedDate ?? null,
          peerReviewed:      input.peerReviewed,
          journalOrSource:   input.journalOrSource ?? null,
          versionLabel:      input.versionLabel ?? null,
          previousVersionId: input.previousVersionId ?? null,
          isAuthorAnonymous: input.isAuthorAnonymous,
        })
        .returning()

      // 3. Fire-and-forget audit write (feedback.ts pattern lines 62-74)
      writeAuditLog({
        actorId:    ctx.user.id,
        actorRole:  ctx.user.role,
        action:     ACTIONS.RESEARCH_CREATE,
        entityType: 'research_item',
        entityId:   item.id,
        payload: {
          readableId,
          documentId: input.documentId,
          itemType:   input.itemType,
        },
      }).catch(console.error)

      return { id: item.id, readableId }
    }),

  // RESEARCH-04: update metadata.
  //
  // Guards (in order):
  //   1. NOT_FOUND if row missing
  //   2. Open Q1 status lock: FORBIDDEN if row.status !== 'draft'
  //   3. Pitfall 6 ownership check: FORBIDDEN for research_lead on others' items
  //
  // To edit a pending_review item, admin must reject it first (returns to
  // draft), then research_lead can update.
  update: requirePermission('research:manage_own')
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...changes } = input

      // 1. Fetch current row
      const [row] = await db
        .select()
        .from(researchItems)
        .where(eq(researchItems.id, id))
        .limit(1)

      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Research item not found' })
      }

      // 2. Open Q1 status lock
      if (row.status !== 'draft') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `Cannot update research item in status '${row.status}' — must be in draft`,
        })
      }

      // 3. Pitfall 6 ownership check
      assertOwnershipOrBypass(ctx.user.role as Role, row.createdBy, ctx.user.id)

      // Pitfall 1 parity with create (Phase 27 D-02): allow edit-page upload
      // to create a fresh artifact row when the user replaces the file. The
      // four upload metadata fields are stripped from `changes` before the
      // UPDATE because they are not columns on research_items.
      if (
        changes.artifactFileName &&
        changes.artifactFileSize &&
        changes.artifactR2Key &&
        changes.artifactPublicUrl
      ) {
        const [artifact] = await db
          .insert(evidenceArtifacts)
          .values({
            type:       'file',
            title:      changes.artifactFileName,
            url:        changes.artifactPublicUrl,
            fileName:   changes.artifactFileName,
            fileSize:   changes.artifactFileSize,
            uploaderId: ctx.user.id,
          })
          .returning({ id: evidenceArtifacts.id })
        changes.artifactId = artifact.id
      }
      // Strip upload metadata from the update set — these are not columns on
      // research_items. Cast through Record so delete operates without
      // narrowing TypeScript's structural inference.
      delete (changes as Record<string, unknown>).artifactFileName
      delete (changes as Record<string, unknown>).artifactFileSize
      delete (changes as Record<string, unknown>).artifactR2Key
      delete (changes as Record<string, unknown>).artifactPublicUrl

      // 4. Apply update
      const [updated] = await db
        .update(researchItems)
        .set({ ...changes, updatedAt: new Date() })
        .where(eq(researchItems.id, id))
        .returning()

      writeAuditLog({
        actorId:    ctx.user.id,
        actorRole:  ctx.user.role,
        action:     ACTIONS.RESEARCH_UPDATE,
        entityType: 'research_item',
        entityId:   id,
        payload:    { changedFields: Object.keys(changes) },
      }).catch(console.error)

      return updated
    }),

  // ==========================================================================
  // MUTATIONS — LIFECYCLE (delegate to transitionResearch from Plan 26-04)
  // ==========================================================================

  // RESEARCH-05: draft -> pending_review.
  // research_lead can submit only their own drafts; admin/policy_lead bypass.
  submitForReview: requirePermission('research:submit_review')
    .input(z.object({ id: z.guid() }))
    .mutation(async ({ ctx, input }) => {
      // Pitfall 6: research_lead can only submit their own drafts
      const [row] = await db
        .select()
        .from(researchItems)
        .where(eq(researchItems.id, input.id))
        .limit(1)
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Research item not found' })
      }
      assertOwnershipOrBypass(ctx.user.role as Role, row.createdBy, ctx.user.id)

      const updated = await transitionResearch(
        input.id,
        'pending_review' as ResearchItemStatus,
        ctx.user.id,
      )

      writeAuditLog({
        actorId:    ctx.user.id,
        actorRole:  ctx.user.role,
        action:     ACTIONS.RESEARCH_SUBMIT_REVIEW,
        entityType: 'research_item',
        entityId:   input.id,
        payload:    { fromStatus: updated.previousStatus, toStatus: updated.newStatus },
      }).catch(console.error)

      return updated
    }),

  // RESEARCH-05: pending_review -> published (approve == publish per Q3).
  // RBAC-gated to admin/policy_lead via research:publish permission.
  approve: requirePermission('research:publish')
    .input(z.object({ id: z.guid() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await transitionResearch(
        input.id,
        'published' as ResearchItemStatus,
        ctx.user.id,
      )

      writeAuditLog({
        actorId:    ctx.user.id,
        actorRole:  ctx.user.role,
        action:     ACTIONS.RESEARCH_APPROVE,
        entityType: 'research_item',
        entityId:   input.id,
        payload:    { fromStatus: updated.previousStatus, toStatus: updated.newStatus },
      }).catch(console.error)

      return updated
    }),

  // RESEARCH-05: pending_review -> draft (reject returns to editable).
  // Optional rejection reason is persisted in the audit payload + workflow
  // transition metadata. Reviewer then sends the author back to edit.
  reject: requirePermission('research:publish')
    .input(z.object({
      id:              z.guid(),
      rejectionReason: z.string().min(1).max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updated = await transitionResearch(
        input.id,
        'draft' as ResearchItemStatus,
        ctx.user.id,
        input.rejectionReason ? { rejectionReason: input.rejectionReason } : undefined,
      )

      writeAuditLog({
        actorId:    ctx.user.id,
        actorRole:  ctx.user.role,
        action:     ACTIONS.RESEARCH_REJECT,
        entityType: 'research_item',
        entityId:   input.id,
        payload: {
          fromStatus: updated.previousStatus,
          toStatus:   updated.newStatus,
          ...(input.rejectionReason ? { rejectionReason: input.rejectionReason } : {}),
        },
      }).catch(console.error)

      return updated
    }),

  // RESEARCH-05: published -> retracted.
  // retractionReason is REQUIRED (not optional) — retracting a published
  // item is a significant state change and every audit trail entry needs
  // the reason for compliance and UI display.
  retract: requirePermission('research:retract')
    .input(z.object({
      id:               z.guid(),
      retractionReason: z.string().min(1).max(2000),   // REQUIRED
    }))
    .mutation(async ({ ctx, input }) => {
      const updated = await transitionResearch(
        input.id,
        'retracted' as ResearchItemStatus,
        ctx.user.id,
        { retractionReason: input.retractionReason },
      )

      writeAuditLog({
        actorId:    ctx.user.id,
        actorRole:  ctx.user.role,
        action:     ACTIONS.RESEARCH_RETRACT,
        entityType: 'research_item',
        entityId:   input.id,
        payload: {
          fromStatus:       updated.previousStatus,
          toStatus:         updated.newStatus,
          retractionReason: input.retractionReason,
        },
      }).catch(console.error)

      return updated
    }),

  // ==========================================================================
  // MUTATIONS — LINK TABLES (idempotent via onConflictDoNothing)
  // ==========================================================================

  // RESEARCH-04: link research item to policy section.
  linkSection: requirePermission('research:manage_own')
    .input(z.object({
      researchItemId: z.guid(),
      sectionId:      z.guid(),
      relevanceNote:  z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Pitfall 5 fix (RESEARCH-08 D-07): when relevanceNote is provided
      // (inline-edit on the detail page), UPSERT on conflict so the note
      // is saved for an already-linked pair. When omitted (bulk-link
      // from the picker), stay .onConflictDoNothing() so re-link is
      // idempotent.
      if (input.relevanceNote !== undefined) {
        await db
          .insert(researchItemSectionLinks)
          .values({
            researchItemId: input.researchItemId,
            sectionId:      input.sectionId,
            relevanceNote:  input.relevanceNote,
          })
          .onConflictDoUpdate({
            target: [
              researchItemSectionLinks.researchItemId,
              researchItemSectionLinks.sectionId,
            ],
            set: { relevanceNote: input.relevanceNote },
          })
      } else {
        await db
          .insert(researchItemSectionLinks)
          .values({
            researchItemId: input.researchItemId,
            sectionId:      input.sectionId,
            relevanceNote:  null,
          })
          .onConflictDoNothing()
      }

      writeAuditLog({
        actorId:    ctx.user.id,
        actorRole:  ctx.user.role,
        action:     ACTIONS.RESEARCH_SECTION_LINK,
        entityType: 'research_item',
        entityId:   input.researchItemId,
        payload:    { sectionId: input.sectionId },
      }).catch(console.error)

      return { linked: true }
    }),

  unlinkSection: requirePermission('research:manage_own')
    .input(z.object({
      researchItemId: z.guid(),
      sectionId:      z.guid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(researchItemSectionLinks)
        .where(and(
          eq(researchItemSectionLinks.researchItemId, input.researchItemId),
          eq(researchItemSectionLinks.sectionId,      input.sectionId),
        ))

      writeAuditLog({
        actorId:    ctx.user.id,
        actorRole:  ctx.user.role,
        action:     ACTIONS.RESEARCH_SECTION_UNLINK,
        entityType: 'research_item',
        entityId:   input.researchItemId,
        payload:    { sectionId: input.sectionId },
      }).catch(console.error)

      return { unlinked: true }
    }),

  // RESEARCH-04: link research item to document version.
  linkVersion: requirePermission('research:manage_own')
    .input(z.object({
      researchItemId: z.guid(),
      versionId:      z.guid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db
        .insert(researchItemVersionLinks)
        .values({
          researchItemId: input.researchItemId,
          versionId:      input.versionId,
        })
        .onConflictDoNothing()

      writeAuditLog({
        actorId:    ctx.user.id,
        actorRole:  ctx.user.role,
        action:     ACTIONS.RESEARCH_VERSION_LINK,
        entityType: 'research_item',
        entityId:   input.researchItemId,
        payload:    { versionId: input.versionId },
      }).catch(console.error)

      return { linked: true }
    }),

  unlinkVersion: requirePermission('research:manage_own')
    .input(z.object({
      researchItemId: z.guid(),
      versionId:      z.guid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(researchItemVersionLinks)
        .where(and(
          eq(researchItemVersionLinks.researchItemId, input.researchItemId),
          eq(researchItemVersionLinks.versionId,      input.versionId),
        ))

      writeAuditLog({
        actorId:    ctx.user.id,
        actorRole:  ctx.user.role,
        action:     ACTIONS.RESEARCH_VERSION_UNLINK,
        entityType: 'research_item',
        entityId:   input.researchItemId,
        payload:    { versionId: input.versionId },
      }).catch(console.error)

      return { unlinked: true }
    }),

  // RESEARCH-04: link research item to feedback item.
  linkFeedback: requirePermission('research:manage_own')
    .input(z.object({
      researchItemId: z.guid(),
      feedbackId:     z.guid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db
        .insert(researchItemFeedbackLinks)
        .values({
          researchItemId: input.researchItemId,
          feedbackId:     input.feedbackId,
        })
        .onConflictDoNothing()

      writeAuditLog({
        actorId:    ctx.user.id,
        actorRole:  ctx.user.role,
        action:     ACTIONS.RESEARCH_FEEDBACK_LINK,
        entityType: 'research_item',
        entityId:   input.researchItemId,
        payload:    { feedbackId: input.feedbackId },
      }).catch(console.error)

      return { linked: true }
    }),

  unlinkFeedback: requirePermission('research:manage_own')
    .input(z.object({
      researchItemId: z.guid(),
      feedbackId:     z.guid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(researchItemFeedbackLinks)
        .where(and(
          eq(researchItemFeedbackLinks.researchItemId, input.researchItemId),
          eq(researchItemFeedbackLinks.feedbackId,     input.feedbackId),
        ))

      writeAuditLog({
        actorId:    ctx.user.id,
        actorRole:  ctx.user.role,
        action:     ACTIONS.RESEARCH_FEEDBACK_UNLINK,
        entityType: 'research_item',
        entityId:   input.researchItemId,
        payload:    { feedbackId: input.feedbackId },
      }).catch(console.error)

      return { unlinked: true }
    }),
})

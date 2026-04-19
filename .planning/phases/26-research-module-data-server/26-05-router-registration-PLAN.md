---
phase: 26-research-module-data-server
plan: 05
type: execute
wave: 3
depends_on: ["26-01", "26-02", "26-04"]
files_modified:
  - src/server/routers/research.ts
  - src/server/routers/_app.ts
autonomous: true
requirements:
  - RESEARCH-02
  - RESEARCH-04
must_haves:
  truths:
    - "researchRouter exposes 15 procedures: list, listPublic, getById, create, update, submitForReview, approve, reject, retract, linkSection, unlinkSection, linkVersion, unlinkVersion, linkFeedback, unlinkFeedback"
    - "create procedure generates readableId via nextval('research_item_id_seq') producing RI-001, RI-002 pattern (collision-safe)"
    - "Every lifecycle mutation (submitForReview/approve/reject/retract) delegates to transitionResearch() (Plan 26-04)"
    - "listPublic nulls out authors when isAuthorAnonymous=true (Pitfall 5 anonymous author filter)"
    - "Secondary ownership check on update + submitForReview (Pitfall 6): research_lead can only manage their own drafts; admin/policy_lead bypass"
    - "update mutation locks once status != 'draft' (Open Question 1 resolution)"
    - "All mutations write audit log via fire-and-forget writeAuditLog({ action: ACTIONS.RESEARCH_* })"
    - "All link-table mutations use .onConflictDoNothing() for idempotency"
    - "All UUID inputs use z.guid() not z.uuid() (Phase 16 precedent)"
    - "appRouter.research registered in _app.ts — tRPC client can call trpc.research.* procedures"
    - "src/__tests__/research-router.test.ts flips RED -> GREEN (15 procedures + appRouter registration)"
  artifacts:
    - path: "src/server/routers/research.ts"
      provides: "tRPC router with 15 procedures covering list/create/update/lifecycle/link operations"
      min_lines: 300
      contains: "export const researchRouter"
    - path: "src/server/routers/_app.ts"
      provides: "appRouter.research sub-router registration"
      contains: "research: researchRouter"
  key_links:
    - from: "src/server/routers/research.ts"
      to: "src/server/services/research.service.ts (Plan 26-04)"
      via: "import { transitionResearch } from '@/src/server/services/research.service'"
      pattern: "from '@/src/server/services/research.service'"
    - from: "src/server/routers/research.ts"
      to: "src/db/schema/research.ts (Plan 26-01)"
      via: "import { researchItems, researchItemSectionLinks, researchItemVersionLinks, researchItemFeedbackLinks } from '@/src/db/schema/research'"
      pattern: "from '@/src/db/schema/research'"
    - from: "src/server/routers/research.ts"
      to: "src/lib/permissions.ts (Plan 26-02)"
      via: "requirePermission('research:create'), requirePermission('research:publish'), etc."
      pattern: "requirePermission\\('research:"
    - from: "src/server/routers/research.ts"
      to: "src/lib/constants.ts (Plan 26-02)"
      via: "ACTIONS.RESEARCH_CREATE / RESEARCH_APPROVE / RESEARCH_SECTION_LINK etc. in writeAuditLog calls"
      pattern: "ACTIONS.RESEARCH_"
    - from: "src/server/routers/_app.ts"
      to: "src/server/routers/research.ts"
      via: "import { researchRouter } from './research'; research: researchRouter"
      pattern: "researchRouter"
---

<objective>
Ship the tRPC `researchRouter` with all 15 procedures + register it in `_app.ts` so the client can call `trpc.research.*`. Flip src/__tests__/research-router.test.ts from RED to GREEN.

Purpose: RESEARCH-02 (readableId via sequence on create) + RESEARCH-04 (15 procedures with Zod guards + permission guards + audit writes).

This is the surface layer — the router glues together everything from Waves 1-2:
- Plan 26-01's schema tables (researchItems + 3 link tables)
- Plan 26-02's permissions (requirePermission('research:*')) + ACTIONS constants
- Plan 26-04's transitionResearch() service for lifecycle mutations

Critical invariants enforced at the router layer:
- **Pitfall 5 anonymous-author filter** — listPublic maps results and nulls `authors` when `isAuthorAnonymous=true`
- **Pitfall 6 secondary ownership check** — `research_lead` caller can only update/submit their own drafts; admin/policy_lead bypass
- **Open Question 1 status lock** — update mutation throws FORBIDDEN if `row.status !== 'draft'` (reject back to draft first)
- **Phase 16 z.guid() precedent** — all UUID inputs use z.guid() (Zod 4 z.uuid() rejects version-0 UUIDs in test fixtures)
- **Phase 10 onConflictDoNothing pattern** — idempotent link-table inserts
- **RESEARCH-02 nextval pattern** — exact pattern from feedback.ts lines 40-43

Output: `src/server/routers/research.ts` (300+ lines) + one-line append to `_app.ts` barrel.

This plan addresses RESEARCH-02 + RESEARCH-04.
</objective>

<execution_context>
@D:/aditee/policydash/.claude/get-shit-done/workflows/execute-plan.md
@D:/aditee/policydash/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/26-research-module-data-server/26-CONTEXT.md
@.planning/phases/26-research-module-data-server/26-RESEARCH.md
@.planning/research/research-module/DOMAIN.md
@.planning/research/research-module/INTEGRATION.md
@src/server/routers/feedback.ts
@src/server/routers/workshop.ts
@src/server/routers/milestone.ts
@src/server/routers/_app.ts
@src/server/services/research.service.ts
@src/server/services/research.lifecycle.ts
@src/db/schema/research.ts
@src/lib/permissions.ts
@src/lib/constants.ts
@src/lib/audit.ts
@src/trpc/init.ts
@src/__tests__/research-router.test.ts
@AGENTS.md

<interfaces>
<!-- The 15 procedures with exact signatures, permissions, and audit actions -->

```typescript
export const researchRouter = router({
  // QUERIES (3)
  list: requirePermission('research:read_drafts')
    .input(z.object({
      documentId: z.guid().optional(),
      itemType: z.enum([...8 types]).optional(),
      status: z.enum(['draft','pending_review','published','retracted']).optional(),
    }))
    .query(async ({ ctx, input }) => {...}),  // returns all items visible per read_drafts + filters

  listPublic: protectedProcedure   // Pitfall 4 + Open Question 2 — broader read
    .input(z.object({
      documentId: z.guid().optional(),
      itemType: z.enum([...8 types]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Pitfall 5: filter to status='published', map rows to null out `authors` when isAuthorAnonymous
    }),

  getById: requirePermission('research:read_drafts')    // research_lead + admin + policy_lead see any status
    .input(z.object({ id: z.guid() }))
    .query(async ({ ctx, input }) => {...}),

  // MUTATIONS — CREATE + UPDATE (2)
  create: requirePermission('research:create')
    .input(z.object({
      documentId: z.guid(),
      title: z.string().min(1).max(500),
      itemType: z.enum([...8 types]),
      description: z.string().max(5000).optional(),
      externalUrl: z.string().url().optional(),
      artifactId: z.guid().optional(),
      doi: z.string().max(100).optional(),
      authors: z.array(z.string().min(1).max(200)).optional(),
      publishedDate: z.string().date().optional(),
      peerReviewed: z.boolean().default(false),
      journalOrSource: z.string().max(500).optional(),
      versionLabel: z.string().max(50).optional(),
      previousVersionId: z.guid().optional(),
      isAuthorAnonymous: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. nextval('research_item_id_seq') -> RI-NNN
      // 2. insert researchItems row with status=draft, createdBy=ctx.user.id
      // 3. fire-and-forget writeAuditLog({ action: ACTIONS.RESEARCH_CREATE })
      // 4. return { id, readableId }
    }),

  update: requirePermission('research:manage_own')
    .input(z.object({
      id: z.guid(),
      title: z.string().min(1).max(500).optional(),
      description: z.string().max(5000).optional(),
      // ...same optional-only fields as create minus documentId/itemType
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. fetch row -> NOT_FOUND if missing
      // 2. Open Q1 status lock: if status != 'draft' -> FORBIDDEN
      // 3. Pitfall 6: if ctx.user.role === 'research_lead' && row.createdBy !== ctx.user.id -> FORBIDDEN
      // 4. db.update(researchItems).set({ ...changed, updatedAt }).where(eq(id))
      // 5. writeAuditLog ACTIONS.RESEARCH_UPDATE fire-and-forget
    }),

  // MUTATIONS — LIFECYCLE (4, all delegate to transitionResearch)
  submitForReview: requirePermission('research:submit_review')   // delegates to transitionResearch(id, 'pending_review', actor)
  approve:         requirePermission('research:publish')          // -> 'published', populates reviewedBy/At
  reject:          requirePermission('research:publish')          // -> 'draft' (returns to editable)
  retract:         requirePermission('research:retract')          // -> 'retracted', accepts retractionReason meta

  // MUTATIONS — LINKS (6, all idempotent via onConflictDoNothing)
  linkSection:    requirePermission('research:manage_own').input(z.object({ researchItemId: z.guid(), sectionId: z.guid(), relevanceNote: z.string().optional() }))
  unlinkSection:  requirePermission('research:manage_own').input(z.object({ researchItemId: z.guid(), sectionId: z.guid() }))
  linkVersion:    requirePermission('research:manage_own').input(z.object({ researchItemId: z.guid(), versionId: z.guid() }))
  unlinkVersion:  requirePermission('research:manage_own').input(z.object({ researchItemId: z.guid(), versionId: z.guid() }))
  linkFeedback:   requirePermission('research:manage_own').input(z.object({ researchItemId: z.guid(), feedbackId: z.guid() }))
  unlinkFeedback: requirePermission('research:manage_own').input(z.object({ researchItemId: z.guid(), feedbackId: z.guid() }))
})
```

Canonical pattern sources:
- feedback.ts lines 40-43: nextval readableId
- feedback.ts lines 62-74: fire-and-forget writeAuditLog
- workshop.ts: onConflictDoNothing for link tables + ownership check
- feedback.service.ts via transitionResearch (indirect): R6 invariant
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write src/server/routers/research.ts (15 procedures)</name>
  <files>src/server/routers/research.ts</files>
  <read_first>
    - src/server/routers/feedback.ts (FULL FILE — canonical pattern for: nextval readableId (lines 40-43), requirePermission attachment, writeAuditLog fire-and-forget (lines 62-75), onConflictDoNothing usage, z.string().uuid() inputs (we upgrade to z.guid() per Phase 16))
    - src/server/routers/workshop.ts (FULL FILE — link table mutations with onConflictDoNothing; ownership check pattern "creator or admin")
    - src/server/routers/milestone.ts (Phase 22 canonical — compact router using requirePermission + writeAuditLog across multiple procedures)
    - src/server/services/research.service.ts (Plan 26-04 output — transitionResearch signature)
    - src/server/services/research.lifecycle.ts (Plan 26-04 output — ResearchItemStatus type)
    - src/db/schema/research.ts (Plan 26-01 output — table + enum exports)
    - src/lib/permissions.ts (Plan 26-02 output — research:* keys must exist)
    - src/lib/constants.ts (Plan 26-02 output — ACTIONS.RESEARCH_* must exist)
    - src/lib/audit.ts (writeAuditLog signature: actorId, actorRole, action, entityType, entityId, payload)
    - src/trpc/init.ts (requirePermission, protectedProcedure, router)
    - src/__tests__/research-router.test.ts (contract — 15 procedures, appRouter.research namespace, RED test must flip GREEN)
    - .planning/phases/26-research-module-data-server/26-RESEARCH.md §Pattern 5 (full router anatomy) + §Pitfall 4,5,6,7 (router-layer enforcement)
    - .planning/research/research-module/INTEGRATION.md §8 (permission mapping per procedure)
    - AGENTS.md (Next.js — tRPC routers are pure Node.js, no Next.js App Router concerns)
  </read_first>
  <action>
    Create `src/server/routers/research.ts` with this EXACT content (long file — copy verbatim). Use this structure:

    ```typescript
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
    import { eq, and, desc, sql } from 'drizzle-orm'
    import { TRPCError } from '@trpc/server'

    // ----- Zod enum literals (match Drizzle pgEnum order in schema/research.ts) -----
    const RESEARCH_ITEM_TYPES = [
      'report', 'paper', 'dataset', 'memo', 'interview_transcript',
      'media_coverage', 'legal_reference', 'case_study',
    ] as const

    const RESEARCH_STATUSES = [
      'draft', 'pending_review', 'published', 'retracted',
    ] as const

    // ----- Shared input schemas (no documentId/itemType on update — those are immutable post-create) -----

    const createInput = z.object({
      documentId:        z.guid(),                                  // Q1: NOT NULL per-policy scope
      title:             z.string().min(1).max(500),
      itemType:          z.enum(RESEARCH_ITEM_TYPES),
      description:       z.string().max(5000).optional(),
      externalUrl:       z.string().url().optional(),
      artifactId:        z.guid().optional(),
      doi:               z.string().max(100).optional(),           // Q10: plain text
      authors:           z.array(z.string().min(1).max(200)).optional(),
      publishedDate:     z.string().date().optional(),              // ISO date string (YYYY-MM-DD)
      peerReviewed:      z.boolean().default(false),
      journalOrSource:   z.string().max(500).optional(),
      versionLabel:      z.string().max(50).optional(),
      previousVersionId: z.guid().optional(),
      isAuthorAnonymous: z.boolean().default(false),               // Q7
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
    })

    // ----- Helper: secondary ownership check (Pitfall 6) -----
    //   admin + policy_lead: bypass (can manage any item)
    //   research_lead: must match createdBy
    //   all others: Role middleware already blocked them
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

      // RESEARCH-04: admin/policy_lead/research_lead can list draft + published
      list: requirePermission('research:read_drafts')
        .input(z.object({
          documentId: z.guid().optional(),
          itemType:   z.enum(RESEARCH_ITEM_TYPES).optional(),
          status:     z.enum(RESEARCH_STATUSES).optional(),
        }))
        .query(async ({ input }) => {
          const conditions = []
          if (input.documentId) conditions.push(eq(researchItems.documentId, input.documentId))
          if (input.itemType)   conditions.push(eq(researchItems.itemType, input.itemType))
          if (input.status)     conditions.push(eq(researchItems.status, input.status))

          const rows = await db
            .select()
            .from(researchItems)
            .where(conditions.length ? and(...conditions) : undefined)
            .orderBy(desc(researchItems.createdAt))

          return rows
        }),

      // RESEARCH-04: listPublic — all 7 authenticated roles (Pitfall 4).
      // Pitfall 5: null out `authors` when isAuthorAnonymous=true.
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

          // Pitfall 5: anonymous-author filter — enforced at the query boundary.
          return rows.map((row) => {
            if (row.isAuthorAnonymous) {
              return { ...row, authors: null }
            }
            return row
          })
        }),

      // RESEARCH-04: getById — same visibility as list (draft + published + retracted)
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

          // Enforce anonymous-author filter here too (getById is also used by the detail page)
          if (row.isAuthorAnonymous && row.status === 'published') {
            return { ...row, authors: null }
          }
          return row
        }),

      // ==========================================================================
      // MUTATIONS — CREATE + UPDATE
      // ==========================================================================

      // RESEARCH-02 + RESEARCH-04: create with readable-ID from PostgreSQL sequence.
      // nextval('research_item_id_seq') is atomic (PostgreSQL guarantee) — no collision.
      create: requirePermission('research:create')
        .input(createInput)
        .mutation(async ({ ctx, input }) => {
          // 1. Generate readable ID (RESEARCH-02)
          const seqRows = await db.execute(sql`SELECT nextval('research_item_id_seq') AS seq`)
          const seqResult = seqRows.rows[0] as Record<string, unknown>
          const num = Number(seqResult.seq)
          const readableId = `RI-${String(num).padStart(3, '0')}`

          // 2. Insert row with createdBy = current user
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
              artifactId:        input.artifactId ?? null,
              doi:               input.doi ?? null,
              authors:           input.authors ?? null,
              publishedDate:     input.publishedDate ?? null,
              peerReviewed:      input.peerReviewed,
              journalOrSource:   input.journalOrSource ?? null,
              versionLabel:      input.versionLabel ?? null,
              previousVersionId: input.previousVersionId ?? null,
              isAuthorAnonymous: input.isAuthorAnonymous,
              // status defaults to 'draft' via pgEnum default
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

      // RESEARCH-04: update metadata. Locked to status='draft' (Open Q1 resolution).
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

          // 2. Status lock (Open Q1) — updates only permitted on drafts.
          //    Admin wants to force-update? Reject first, then update.
          if (row.status !== 'draft') {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: `Cannot update research item in status '${row.status}' — must be in draft`,
            })
          }

          // 3. Secondary ownership check (Pitfall 6)
          assertOwnershipOrBypass(ctx.user.role as Role, row.createdBy, ctx.user.id)

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
      // MUTATIONS — LIFECYCLE (delegate to transitionResearch)
      // ==========================================================================

      // RESEARCH-05: draft -> pending_review
      submitForReview: requirePermission('research:submit_review')
        .input(z.object({ id: z.guid() }))
        .mutation(async ({ ctx, input }) => {
          // Pitfall 6: research_lead can only submit their own drafts
          const [row] = await db.select().from(researchItems).where(eq(researchItems.id, input.id)).limit(1)
          if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Research item not found' })
          assertOwnershipOrBypass(ctx.user.role as Role, row.createdBy, ctx.user.id)

          const updated = await transitionResearch(input.id, 'pending_review' as ResearchItemStatus, ctx.user.id)

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

      // RESEARCH-05: pending_review -> published (approve). Q3: admin/policy_lead only.
      approve: requirePermission('research:publish')
        .input(z.object({ id: z.guid() }))
        .mutation(async ({ ctx, input }) => {
          const updated = await transitionResearch(input.id, 'published' as ResearchItemStatus, ctx.user.id)

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

      // RESEARCH-05: pending_review -> draft (reject returns to editable)
      reject: requirePermission('research:publish')
        .input(z.object({
          id: z.guid(),
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

      // RESEARCH-05: published -> retracted
      retract: requirePermission('research:retract')
        .input(z.object({
          id: z.guid(),
          retractionReason: z.string().min(1).max(2000),   // REQUIRED for retract
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

      // RESEARCH-04: link research item to policy section
      linkSection: requirePermission('research:manage_own')
        .input(z.object({
          researchItemId: z.guid(),
          sectionId:      z.guid(),
          relevanceNote:  z.string().max(1000).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          await db.insert(researchItemSectionLinks)
            .values({
              researchItemId: input.researchItemId,
              sectionId:      input.sectionId,
              relevanceNote:  input.relevanceNote ?? null,
            })
            .onConflictDoNothing()

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
          await db.delete(researchItemSectionLinks)
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

      linkVersion: requirePermission('research:manage_own')
        .input(z.object({
          researchItemId: z.guid(),
          versionId:      z.guid(),
        }))
        .mutation(async ({ ctx, input }) => {
          await db.insert(researchItemVersionLinks)
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
          await db.delete(researchItemVersionLinks)
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

      linkFeedback: requirePermission('research:manage_own')
        .input(z.object({
          researchItemId: z.guid(),
          feedbackId:     z.guid(),
        }))
        .mutation(async ({ ctx, input }) => {
          await db.insert(researchItemFeedbackLinks)
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
          await db.delete(researchItemFeedbackLinks)
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
    ```
  </action>
  <verify>
    <automated>
test -f src/server/routers/research.ts && grep -q "export const researchRouter" src/server/routers/research.ts && test "$(grep -cE '^\s+(create|update|submitForReview|approve|reject|retract|linkSection|unlinkSection|linkVersion|unlinkVersion|linkFeedback|unlinkFeedback):' src/server/routers/research.ts)" = "12" && test "$(grep -cE '^\s+(list|listPublic|getById):' src/server/routers/research.ts)" = "3" && ! (npx tsc --noEmit 2>&1 | grep -qE "error TS[0-9]+:.*research\.ts")
    </automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/server/routers/research.ts`
    - `grep -q "export const researchRouter = router({" src/server/routers/research.ts`
    - `grep -c "\.mutation\(" src/server/routers/research.ts` returns at least 12 (12 mutation procedures)
    - `grep -c "\.query\(" src/server/routers/research.ts` returns at least 3 (list, listPublic, getById)
    - 15 procedure names present: `for p in list listPublic getById create update submitForReview approve reject retract linkSection unlinkSection linkVersion unlinkVersion linkFeedback unlinkFeedback; do grep -q "^\s*${p}:" src/server/routers/research.ts || echo "MISSING: $p"; done` reports zero MISSING
    - `grep -q "requirePermission('research:create')" src/server/routers/research.ts`
    - `grep -q "requirePermission('research:manage_own')" src/server/routers/research.ts`
    - `grep -q "requirePermission('research:submit_review')" src/server/routers/research.ts`
    - `grep -q "requirePermission('research:publish')" src/server/routers/research.ts`
    - `grep -q "requirePermission('research:retract')" src/server/routers/research.ts`
    - `grep -q "requirePermission('research:read_drafts')" src/server/routers/research.ts`
    - `grep -q "protectedProcedure" src/server/routers/research.ts` (listPublic uses protectedProcedure per Open Q2)
    - **RESEARCH-02 nextval pattern present**: `grep -q "nextval\('research_item_id_seq'\)" src/server/routers/research.ts`
    - **Readable ID format**: `grep -q "RI-\${String(num).padStart(3, '0')}" src/server/routers/research.ts`
    - **Pitfall 5 anonymous-author filter**: `grep -q "if (row.isAuthorAnonymous)" src/server/routers/research.ts` AND `grep -q "authors: null" src/server/routers/research.ts`
    - **Pitfall 6 ownership check**: `grep -q "assertOwnershipOrBypass" src/server/routers/research.ts` AND `grep -q "'admin' || role === 'policy_lead'" src/server/routers/research.ts`
    - **Open Q1 status lock on update**: `grep -q "row.status !== 'draft'" src/server/routers/research.ts`
    - **z.guid() not z.uuid() (Phase 16 precedent)**: `grep -q "z.guid()" src/server/routers/research.ts` AND `! grep -qE "z\.uuid\(\)" src/server/routers/research.ts`
    - **onConflictDoNothing on all link tables** (Phase 10 pattern): `grep -c "onConflictDoNothing()" src/server/routers/research.ts` returns at least 3 (linkSection, linkVersion, linkFeedback)
    - **transitionResearch delegations** (Plan 26-04 contract): `grep -c "transitionResearch(input.id" src/server/routers/research.ts` returns at least 4 (submitForReview, approve, reject, retract)
    - **writeAuditLog fire-and-forget** (feedback.ts pattern): `grep -c "writeAuditLog({" src/server/routers/research.ts` returns at least 11 (1 create + 1 update + 4 lifecycle + 6 link/unlink)
    - `grep -c "\.catch(console.error)" src/server/routers/research.ts` returns at least 11 (every writeAuditLog is fire-and-forget)
    - **All ACTIONS constants used**: for each A in RESEARCH_CREATE RESEARCH_UPDATE RESEARCH_SUBMIT_REVIEW RESEARCH_APPROVE RESEARCH_REJECT RESEARCH_RETRACT RESEARCH_SECTION_LINK RESEARCH_SECTION_UNLINK RESEARCH_VERSION_LINK RESEARCH_VERSION_UNLINK RESEARCH_FEEDBACK_LINK RESEARCH_FEEDBACK_UNLINK: `grep -q "ACTIONS.${A}" src/server/routers/research.ts` passes
    - **retract requires retractionReason (not optional)**: `grep -A3 "^  retract:" src/server/routers/research.ts | grep -q "retractionReason: z.string().min(1).max(2000)"` (no `.optional()`)
    - `npx tsc --noEmit` — clean (no TS errors in research.ts or its imports)
  </acceptance_criteria>
  <done>research.ts router exports researchRouter with exactly 15 procedures, each with correct requirePermission guard, z.guid() UUID inputs, writeAuditLog fire-and-forget with correct ACTIONS enum, onConflictDoNothing on all 3 link-insert operations, transitionResearch delegation for 4 lifecycle mutations, anonymous-author filter on listPublic, status lock on update, ownership check on update + submitForReview. TypeScript clean.</done>
</task>

<task type="auto">
  <name>Task 2: Register researchRouter in src/server/routers/_app.ts</name>
  <files>src/server/routers/_app.ts</files>
  <read_first>
    - src/server/routers/_app.ts (FULL file — append-at-end pattern; milestone was added last at line 29 in the router object)
    - src/server/routers/research.ts (Task 1 output — confirm researchRouter export exists)
    - src/__tests__/research-router.test.ts (contract — `appRouter._def.procedures` must contain keys starting with 'research.')
  </read_first>
  <action>
    Make TWO edits to `src/server/routers/_app.ts`:

    **Edit 1** — Add import after the `milestoneRouter` import (line 14):
    ```typescript
    import { researchRouter } from './research'
    ```

    **Edit 2** — Add `research` sub-router inside the `router({...})` call, after the `milestone: milestoneRouter,` entry (line 29). Add a comma after milestoneRouter if not already present, then add:
    ```typescript
      research: researchRouter,
    ```

    Final `_app.ts` content should read:
    ```typescript
    import { router } from '@/src/trpc/init'
    import { userRouter } from './user'
    import { auditRouter } from './audit'
    import { documentRouter } from './document'
    import { feedbackRouter } from './feedback'
    import { sectionAssignmentRouter } from './sectionAssignment'
    import { evidenceRouter } from './evidence'
    import { changeRequestRouter } from './changeRequest'
    import { versionRouter } from './version'
    import { traceabilityRouter } from './traceability'
    import { notificationRouter } from './notification'
    import { workshopRouter } from './workshop'
    import { consultationSummaryRouter } from './consultation-summary'
    import { milestoneRouter } from './milestone'
    import { researchRouter } from './research'

    export const appRouter = router({
      user: userRouter,
      audit: auditRouter,
      document: documentRouter,
      feedback: feedbackRouter,
      sectionAssignment: sectionAssignmentRouter,
      evidence: evidenceRouter,
      changeRequest: changeRequestRouter,
      version: versionRouter,
      consultationSummary: consultationSummaryRouter,
      traceability: traceabilityRouter,
      notification: notificationRouter,
      workshop: workshopRouter,
      milestone: milestoneRouter,
      research: researchRouter,
    })

    export type AppRouter = typeof appRouter
    ```

    Do NOT reorder existing entries. Do NOT rename. Preserve the `AppRouter` type export.
  </action>
  <verify>
    <automated>grep -q "import { researchRouter } from './research'" src/server/routers/_app.ts && grep -q "research: researchRouter" src/server/routers/_app.ts && npm test -- --run src/__tests__/research-router.test.ts 2>&1 | grep -qE "(passed|Tests\s+[0-9]+ passed)"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "import { researchRouter } from './research'" src/server/routers/_app.ts`
    - `grep -q "research: researchRouter" src/server/routers/_app.ts`
    - Existing imports preserved (regression check — all 14 previous imports):
      `for name in userRouter auditRouter documentRouter feedbackRouter sectionAssignmentRouter evidenceRouter changeRequestRouter versionRouter traceabilityRouter notificationRouter workshopRouter consultationSummaryRouter milestoneRouter; do grep -q "import { ${name} }" src/server/routers/_app.ts || echo "MISSING $name"; done` reports zero MISSING
    - Existing sub-router registrations preserved:
      `grep -c ":\s*\w*Router" src/server/routers/_app.ts` returns at least 14 (13 previous + 1 new)
    - `export type AppRouter = typeof appRouter` preserved
    - `npx tsc --noEmit` — clean
    - `npm test -- --run src/__tests__/research-router.test.ts` — ALL tests GREEN including the appRouter.research namespace assertion (flips from RED to GREEN)
    - `npm test` — full suite green (no regressions in any existing router)
  </acceptance_criteria>
  <done>_app.ts imports researchRouter and registers it as research sub-router; existing 13 registrations intact; AppRouter type exported; research-router.test.ts flips RED -> GREEN; full test suite green.</done>
</task>

</tasks>

<verification>
1. `test -f src/server/routers/research.ts` — router module exists
2. 15 procedures present: `grep -cE "^  (list|listPublic|getById|create|update|submitForReview|approve|reject|retract|linkSection|unlinkSection|linkVersion|unlinkVersion|linkFeedback|unlinkFeedback):" src/server/routers/research.ts` returns 15
3. RESEARCH-02: `grep -q "nextval('research_item_id_seq')" src/server/routers/research.ts`
4. Pitfall 5: `grep -q "isAuthorAnonymous" src/server/routers/research.ts`
5. Pitfall 6: `grep -q "assertOwnershipOrBypass" src/server/routers/research.ts`
6. z.guid() used (not z.uuid()): `grep -q "z.guid()" src/server/routers/research.ts && ! grep -qE "z\.uuid\(\)" src/server/routers/research.ts`
7. onConflictDoNothing on link mutations: `grep -c "onConflictDoNothing()" src/server/routers/research.ts` >= 3
8. _app.ts updated: `grep -q "research: researchRouter" src/server/routers/_app.ts`
9. `npm test -- --run src/__tests__/research-router.test.ts` — GREEN (RED -> GREEN flip)
10. `npm test` — full suite GREEN
11. `npx tsc --noEmit` — clean
</verification>

<success_criteria>
- researchRouter exports with exactly 15 procedures (3 queries + 12 mutations)
- create uses nextval('research_item_id_seq') + RI-NNN formatting (RESEARCH-02)
- 4 lifecycle mutations delegate to transitionResearch() (RESEARCH-05 via Plan 26-04)
- 6 link-table mutations use onConflictDoNothing() for idempotency (Phase 10 pattern)
- 11+ writeAuditLog calls, all fire-and-forget via .catch(console.error) (Phase 1 invariant)
- All ACTIONS.RESEARCH_* constants from Plan 26-02 consumed
- All requirePermission('research:*') guards from Plan 26-02 consumed
- Pitfall 4 honored (listPublic uses protectedProcedure for broad read)
- Pitfall 5 honored (listPublic + getById null out authors when isAuthorAnonymous)
- Pitfall 6 honored (assertOwnershipOrBypass on update + submitForReview)
- Open Q1 resolved (update locked to status=draft)
- Phase 16 precedent honored (z.guid() not z.uuid() for all UUID inputs)
- _app.ts registers research sub-router; existing 13 routers unchanged
- research-router.test.ts flips RED -> GREEN (15 procedure assertions + appRouter.research namespace)
- Full test suite green (no regressions)
- TypeScript compiles clean
</success_criteria>

<output>
After completion, create `.planning/phases/26-research-module-data-server/26-05-SUMMARY.md` documenting:
- Final line count of research.ts (expected 300+)
- Count of procedures with their permission mapping table
- Count of writeAuditLog + onConflictDoNothing invocations
- Confirmation that all Pitfalls (4, 5, 6, 7) are enforced
- Confirmation that all Open Questions (1, 2, 3) are resolved
- research-router.test.ts pass count (should be 16+ procedure checks + namespace check)
- Full suite green confirmation + total test count delta from before Phase 26

Phase 26 complete after this summary — entire backend substrate ready for Phase 27 (UI) and Phase 28 (public listing).
</output>

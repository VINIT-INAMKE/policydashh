---
phase: 27-research-workspace-admin-ui
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - src/server/routers/research.ts
  - src/lib/r2-upload.ts
  - app/api/upload/route.ts
  - src/lib/research-utils.ts
  - src/__tests__/research-router.test.ts
  - src/__tests__/upload-research.test.ts
  - tests/research/create-edit-dialog.test.tsx
  - tests/research/link-picker.test.tsx
  - tests/research/lifecycle-actions.test.tsx
  - tests/research/anonymous-toggle.test.tsx
autonomous: true
requirements:
  - RESEARCH-06
  - RESEARCH-07
  - RESEARCH-08
requirements_addressed:
  - RESEARCH-06
  - RESEARCH-07
  - RESEARCH-08
must_haves:
  truths:
    - "Research router exposes listTransitions procedure returning workflowTransitions rows for a given research_item"
    - "research.list accepts an authorId filter that scopes to createdBy"
    - "research.linkSection upserts relevanceNote when provided (not .onConflictDoNothing)"
    - "app/api/upload/route.ts accepts 'research' category with PDF/DOCX/DOC/CSV/XLSX/XLS MIME allowlist, 32MB cap"
    - "src/lib/r2-upload.ts UploadOptions.category includes 'research' literal"
    - "src/lib/research-utils.ts exports shouldHideAuthors(item) helper"
    - "Wave 0 test scaffolds exist (RED) for create-edit dialog, link picker, lifecycle actions, anonymous toggle"
  artifacts:
    - path: "src/server/routers/research.ts"
      provides: "listTransitions query, authorId filter on list, onConflictDoUpdate on linkSection for relevanceNote"
      contains: "listTransitions:"
    - path: "src/lib/r2-upload.ts"
      provides: "research category in UploadOptions type"
      contains: "'research'"
    - path: "app/api/upload/route.ts"
      provides: "research category MAX_FILE_SIZE + ALLOWED_TYPES + EXT_TO_FAMILY entries"
      contains: "research:"
    - path: "src/lib/research-utils.ts"
      provides: "shouldHideAuthors helper"
      contains: "export function shouldHideAuthors"
    - path: "src/__tests__/upload-research.test.ts"
      provides: "RED tests for upload route research category"
    - path: "tests/research/create-edit-dialog.test.tsx"
      provides: "RED tests for RESEARCH-06 create-edit form"
    - path: "tests/research/link-picker.test.tsx"
      provides: "RED tests for RESEARCH-08 link picker multi-select"
    - path: "tests/research/lifecycle-actions.test.tsx"
      provides: "RED tests for RESEARCH-07 lifecycle action RBAC"
    - path: "tests/research/anonymous-toggle.test.tsx"
      provides: "RED tests for RESEARCH-06 anonymous preview toggle"
  key_links:
    - from: "app/research-manage/[id]/_components/research-decision-log.tsx (Plan 04)"
      to: "trpc.research.listTransitions"
      via: "tRPC query hook"
      pattern: "research\\.listTransitions"
    - from: "app/research-manage/page.tsx (Plan 02)"
      to: "trpc.research.list({ authorId })"
      via: "query parameter"
      pattern: "authorId"
    - from: "create/edit page (Plan 03) file upload"
      to: "POST /api/upload with category: 'research'"
      via: "uploadFile helper"
      pattern: "category: 'research'"
---

<objective>
Wave 0 gate — extend the Phase 26 backend surface so Phase 27 UI work can begin without scavenging for missing plumbing. Adds one new query (`listTransitions`), one filter parameter (`authorId`), one router fix (`linkSection` upsert), one upload-route category (`'research'`), one shared utility (`shouldHideAuthors`), and six Nyquist RED test scaffolds.

Purpose: Without these additions, the decision log cannot render, `research_lead` sees other authors' drafts, `relevanceNote` edits are silently ignored, research files cannot be uploaded (dataset CSV/XLSX mismatched to document/evidence categories), the anonymous-author rule has two parallel implementations, and Wave 1/2/3 plans cannot write GREEN tests. Everything else in Phase 27 depends on this plan.

Output: Fixed router + upload route + shared util + 6 RED test files committed.
</objective>

<execution_context>
@D:/aditee/policydash/.claude/get-shit-done/workflows/execute-plan.md
@D:/aditee/policydash/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/27-research-workspace-admin-ui/27-CONTEXT.md
@.planning/phases/27-research-workspace-admin-ui/27-RESEARCH.md
@.planning/phases/27-research-workspace-admin-ui/27-VALIDATION.md
@src/server/routers/research.ts
@src/server/routers/feedback.ts
@src/lib/r2-upload.ts
@app/api/upload/route.ts
@src/__tests__/research-router.test.ts

<interfaces>
<!-- Key contracts the executor needs. Extracted from codebase. -->

From src/server/routers/research.ts (existing surface — DO NOT break):
```typescript
// Current list input:
z.object({
  documentId: z.guid().optional(),
  itemType:   z.enum(RESEARCH_ITEM_TYPES).optional(),
  status:     z.enum(RESEARCH_STATUSES).optional(),
})
// EXTEND to add: authorId: z.guid().optional()

// Current linkSection mutation writes:
db.insert(researchItemSectionLinks)
  .values({ researchItemId, sectionId, relevanceNote })
  .onConflictDoNothing()
// CHANGE TO conditional upsert when relevanceNote provided
```

From src/server/routers/feedback.ts lines 611-652 (template for listTransitions):
```typescript
listTransitions: requirePermission('feedback:read_own')
  .input(z.object({ feedbackId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    // ownership check, then:
    return db.select({ id, fromState, toState, actorId, timestamp, metadata, actorName })
      .from(workflowTransitions)
      .leftJoin(users, eq(workflowTransitions.actorId, users.id))
      .where(and(
        eq(workflowTransitions.entityType, 'feedback'),
        eq(workflowTransitions.entityId, input.feedbackId),
      ))
      .orderBy(asc(workflowTransitions.timestamp))
  })
```

From src/db/schema/workflow.ts:
```typescript
workflowTransitions = pgTable('workflow_transitions', {
  id:         uuid PK
  entityType: text  // 'research_item' for this phase
  entityId:   uuid
  fromState:  text  (nullable)
  toState:    text
  actorId:    text
  timestamp:  timestamptz
  metadata:   jsonb  // { rejectionReason? } | { retractionReason? }
})
```

From src/lib/r2-upload.ts (existing — extend category union):
```typescript
interface UploadOptions {
  category?: 'image' | 'document' | 'evidence'   // ADD: | 'research'
  onProgress?: (percent: number) => void
}
```

From app/api/upload/route.ts (existing — extend MAX_FILE_SIZE + ALLOWED_TYPES + EXT_TO_FAMILY):
```typescript
const MAX_FILE_SIZE: Record<string, number> = {
  image:     16 * 1024 * 1024,
  document:  32 * 1024 * 1024,
  evidence:  32 * 1024 * 1024,
  recording: 25 * 1024 * 1024,
  // ADD: research: 32 * 1024 * 1024
}
// And ALLOWED_TYPES[category] + category union in the POST body type literal
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add listTransitions + authorId filter + linkSection upsert to research router, plus shared utility</name>
  <read_first>
    - src/server/routers/research.ts (current router — extend in place)
    - src/server/routers/feedback.ts lines 611-652 (template for listTransitions)
    - src/db/schema/workflow.ts (workflowTransitions table)
    - src/db/schema/research.ts (researchItemSectionLinks composite PK)
    - .planning/phases/27-research-workspace-admin-ui/27-UI-SPEC.md §"Component Inventory" + §"Interaction Contract — relevanceNote inline edit" (D-07)
    - .planning/phases/27-research-workspace-admin-ui/27-RESEARCH.md §"Missing procedure: listTransitions" + §"Pitfall 2" + §"Pitfall 5"
  </read_first>
  <behavior>
    - Test 1 (research-router.test.ts): `listTransitions` is defined on `mod.researchRouter._def.procedures` and `appRouter._def.procedures` contains `'research.listTransitions'`.
    - Test 2 (research-router.test.ts): `list` input schema accepts optional `authorId: z.guid()`; parsing `{ authorId: "550e8400-e29b-41d4-a716-446655440000" }` does not throw.
    - Test 3 (research-router.test.ts): `linkSection` mutation definition exists; procedure shape matches tRPC v11 MUTATION.
    - Test 4 (new — `src/__tests__/research-utils.test.ts`): `shouldHideAuthors({ isAuthorAnonymous: true })` returns `true`; `shouldHideAuthors({ isAuthorAnonymous: false })` returns `false`.
  </behavior>
  <action>
    Make FIVE concrete edits. Follow existing router conventions (z.guid(), requirePermission, writeAuditLog fire-and-forget).

    **Edit 1 — src/server/routers/research.ts: add `listTransitions` query after `getById`.**

    Add these imports at the top of the file (check existing and add only what is missing):
    ```typescript
    import { workflowTransitions } from '@/src/db/schema/workflow'
    import { users } from '@/src/db/schema/users'
    import { asc } from 'drizzle-orm'
    ```

    Insert AFTER the `getById` procedure (around line 220, before the `// MUTATIONS — CREATE + UPDATE` block):
    ```typescript
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
    ```

    **Edit 2 — src/server/routers/research.ts: extend `list` input with `authorId`.**

    Change the existing `list` input block FROM:
    ```typescript
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
    ```

    TO:
    ```typescript
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
    ```

    **Edit 3 — src/server/routers/research.ts: upgrade `linkSection` to upsert `relevanceNote`.**

    Change the existing `linkSection` mutation body FROM:
    ```typescript
          await db
            .insert(researchItemSectionLinks)
            .values({
              researchItemId: input.researchItemId,
              sectionId:      input.sectionId,
              relevanceNote:  input.relevanceNote ?? null,
            })
            .onConflictDoNothing()
    ```

    TO (conditional upsert — when relevanceNote provided, overwrite on conflict; otherwise remain idempotent-no-op):
    ```typescript
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
    ```

    **Edit 4 — src/lib/research-utils.ts: NEW FILE.**

    Create `src/lib/research-utils.ts`:
    ```typescript
    /**
     * Shared helpers for the Research Module UI surface (Phase 27 D-05).
     *
     * Single source of truth for the anonymous-author display rule. Both
     * the create/edit form's AnonymousPreviewCard AND the detail-page
     * author rendering import shouldHideAuthors so the preview never
     * disagrees with the final render (Pitfall 4).
     *
     * Phase 28 public listing will also import this for /research/items.
     */

    export interface ShouldHideAuthorsInput {
      isAuthorAnonymous: boolean
    }

    export function shouldHideAuthors(item: ShouldHideAuthorsInput): boolean {
      return item.isAuthorAnonymous === true
    }

    /**
     * Render-ready author string for display. Returns "Source: Confidential"
     * when anonymous, otherwise comma-joins the author array. Returns a
     * muted placeholder string when no authors are present AND the item is
     * not anonymous (callers should treat this as "unknown" and render in
     * muted-foreground).
     */
    export function formatAuthorsForDisplay(item: {
      isAuthorAnonymous: boolean
      authors: string[] | null
    }): string {
      if (shouldHideAuthors(item)) return 'Source: Confidential'
      if (!item.authors || item.authors.length === 0) return 'Unknown author'
      return `Authors: ${item.authors.join(', ')}`
    }
    ```

    **Edit 5 — src/__tests__/research-utils.test.ts: NEW FILE — GREEN tests for the helper.**

    Create `src/__tests__/research-utils.test.ts` with vitest assertions covering:
    - `shouldHideAuthors({ isAuthorAnonymous: true })` returns true
    - `shouldHideAuthors({ isAuthorAnonymous: false })` returns false
    - `formatAuthorsForDisplay({ isAuthorAnonymous: true, authors: ['Alice'] })` returns exactly "Source: Confidential"
    - `formatAuthorsForDisplay({ isAuthorAnonymous: false, authors: ['Alice', 'Bob'] })` returns exactly "Authors: Alice, Bob"
    - `formatAuthorsForDisplay({ isAuthorAnonymous: false, authors: null })` returns exactly "Unknown author"

    Use the canonical Vitest pattern (describe/it/expect, no file-level mocks needed since the helper is pure).

    Also add three new `it` blocks to `src/__tests__/research-router.test.ts` (at the end of the file inside a new `describe('Phase 27 router extensions (RESEARCH-06/08)')` block) — these can remain minimal shape-checks following the existing pattern:
    - `it('listTransitions is defined on _def.procedures', ...)` — `expect(mod.researchRouter._def.procedures.listTransitions).toBeDefined()`
    - `it('appRouter registers research.listTransitions', ...)` — `expect(Object.keys(appMod.appRouter._def.procedures)).toContain('research.listTransitions')`
    - `it('list input schema accepts authorId', ...)` — use the `list` procedure's `_def.inputs` if accessible, else assert procedure still works after schema extension.

    Running these tests is NOT required to pass in this task — Plan 02 wires the full list page against them. Shape-checks must pass.
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/research-utils.test.ts src/__tests__/research-router.test.ts --reporter=dot</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "listTransitions:" src/server/routers/research.ts` outputs at least one match
    - `grep -n "authorId:   z.guid().optional()" src/server/routers/research.ts` outputs exactly one match
    - `grep -n "eq(researchItems.createdBy, input.authorId)" src/server/routers/research.ts` outputs exactly one match
    - `grep -n "onConflictDoUpdate" src/server/routers/research.ts` outputs exactly one match
    - `ls src/lib/research-utils.ts` returns success
    - `grep -n "export function shouldHideAuthors" src/lib/research-utils.ts` outputs exactly one match
    - `grep -n "export function formatAuthorsForDisplay" src/lib/research-utils.ts` outputs exactly one match
    - `ls src/__tests__/research-utils.test.ts` returns success
    - `npx vitest run src/__tests__/research-utils.test.ts` exits 0 (all tests pass)
    - `npx vitest run src/__tests__/research-router.test.ts` exits 0
    - `npx tsc --noEmit` exits 0 (no new type errors)
  </acceptance_criteria>
  <done>research.listTransitions shipped, authorId filter shipped, linkSection conditional upsert shipped, shouldHideAuthors helper shipped with passing tests.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add 'research' category to upload route + r2-upload.ts, plus RED upload test</name>
  <read_first>
    - app/api/upload/route.ts (extend MAX_FILE_SIZE, ALLOWED_TYPES, EXT_TO_FAMILY, and the POST body category union)
    - src/lib/r2-upload.ts (extend UploadOptions.category union)
    - .planning/phases/27-research-workspace-admin-ui/27-CONTEXT.md §"R2 upload category" (D-04)
    - .planning/phases/27-research-workspace-admin-ui/27-UI-SPEC.md §"File upload (D-02)"
    - .planning/phases/27-research-workspace-admin-ui/27-RESEARCH.md §"File Upload Flow"
  </read_first>
  <behavior>
    - Test 1: POST /api/upload with body `{ fileName: 'x.pdf', contentType: 'application/pdf', category: 'research', fileSize: 1000 }` is accepted as category (not "Invalid category").
    - Test 2: POST /api/upload with body `{ fileName: 'x.zip', contentType: 'application/zip', category: 'research', fileSize: 1000 }` returns 400 (MIME not in research allowlist).
    - Test 3: POST /api/upload with body `{ ..., fileSize: 33554433, category: 'research' }` (> 32MB) returns 400.
    - Test 4: POST /api/upload with body `{ fileName: 'x.csv', contentType: 'text/csv', category: 'research', ... }` is accepted (EXT_TO_FAMILY.csv matches text/*).
  </behavior>
  <action>
    **Edit 1 — app/api/upload/route.ts: extend MAX_FILE_SIZE Record.**

    Change the `MAX_FILE_SIZE` block FROM:
    ```typescript
    const MAX_FILE_SIZE: Record<string, number> = {
      image: 16 * 1024 * 1024,
      document: 32 * 1024 * 1024,
      evidence: 32 * 1024 * 1024,
      recording: 25 * 1024 * 1024,
    }
    ```

    TO:
    ```typescript
    const MAX_FILE_SIZE: Record<string, number> = {
      image: 16 * 1024 * 1024,
      document: 32 * 1024 * 1024,
      evidence: 32 * 1024 * 1024,
      recording: 25 * 1024 * 1024,
      // Phase 27 D-04: research items include datasets (CSV/XLSX) that
      // don't fit 'document' or 'evidence' MIME sets. 32MB cap matches
      // document/evidence; exceeds the worst-case NITI report PDF by 2x.
      research: 32 * 1024 * 1024,
    }
    ```

    **Edit 2 — app/api/upload/route.ts: extend ALLOWED_TYPES Record.**

    Add the `research` entry AFTER `recording` in the `ALLOWED_TYPES` block:
    ```typescript
      // Phase 27 D-04: research module citable artifacts. PDF/DOCX/DOC
      // cover reports + papers + memos; CSV/XLSX/XLS cover datasets. No
      // audio/video — those remain in the recording category (WS-14).
      research: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
    ```

    **Edit 3 — app/api/upload/route.ts: extend the POST body category union.**

    Change the destructure body typing FROM:
    ```typescript
    const { fileName, contentType, category = 'evidence', fileSize } = body as {
      fileName: string
      contentType: string
      category: 'image' | 'document' | 'evidence' | 'recording'
      fileSize: number
    }
    ```

    TO:
    ```typescript
    const { fileName, contentType, category = 'evidence', fileSize } = body as {
      fileName: string
      contentType: string
      category: 'image' | 'document' | 'evidence' | 'recording' | 'research'
      fileSize: number
    }
    ```

    **Edit 4 — app/api/upload/route.ts: extend EXT_TO_FAMILY for csv/xls/xlsx.**

    Change EXT_TO_FAMILY FROM:
    ```typescript
    const EXT_TO_FAMILY: Record<string, string> = {
      png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image',
      pdf: 'application', doc: 'application', docx: 'application',
      mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', m4a: 'audio',
      mp4: 'video', webm: 'video',
    }
    ```

    TO:
    ```typescript
    const EXT_TO_FAMILY: Record<string, string> = {
      png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image',
      pdf: 'application', doc: 'application', docx: 'application',
      // Phase 27 D-04: text/csv ↔ .csv extension; xls/xlsx are application/vnd.ms-excel
      // and application/vnd.openxmlformats-officedocument.spreadsheetml.sheet respectively.
      csv: 'text',
      xls: 'application',
      xlsx: 'application',
      mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', m4a: 'audio',
      mp4: 'video', webm: 'video',
    }
    ```

    **Edit 5 — src/lib/r2-upload.ts: extend UploadOptions.category union.**

    Change FROM:
    ```typescript
    interface UploadOptions {
      category?: 'image' | 'document' | 'evidence'
      onProgress?: (percent: number) => void
    }
    ```

    TO:
    ```typescript
    interface UploadOptions {
      // Phase 27 D-04: 'research' added for citable research artifacts
      // (PDF/DOCX/DOC/CSV/XLSX/XLS, 32MB cap). Server allowlist in
      // app/api/upload/route.ts MUST stay in sync with this literal.
      category?: 'image' | 'document' | 'evidence' | 'research'
      onProgress?: (percent: number) => void
    }
    ```

    **Edit 6 — src/__tests__/upload-research.test.ts: NEW FILE (RED for Wave 0, must go GREEN in this task).**

    Create `src/__tests__/upload-research.test.ts` with vitest assertions. Mock the POST handler directly (import the handler from `@/app/api/upload/route` and call it with a NextRequest-like object). Use `vi.mock('@clerk/nextjs/server', ...)` to stub auth, `vi.mock('@/src/db', ...)` to stub `users.findFirst` returning a user with role 'research_lead', `vi.mock('@/src/lib/rate-limit', ...)` for consume(), and `vi.mock('@/src/lib/r2', ...)` to stub getUploadUrl/generateStorageKey/getPublicUrl.

    Test cases (all assert using `response.status` and `response.json()`):
    - Valid research PDF: returns 200 with `{ uploadUrl, publicUrl, key }` truthy.
    - Valid research CSV (text/csv): returns 200.
    - Invalid MIME (application/zip, category: 'research'): returns 400 with error matching /not allowed for research/.
    - File too large (fileSize: 33554433, category: 'research'): returns 400 with error matching /too large/i.
    - Missing research allowlist entries would mean category returns 400 "Invalid category" — negative-path asserts this does NOT happen (proves the category was registered).

    Follow the test style of `src/__tests__/research-router.test.ts` for mock patterns.
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/upload-research.test.ts --reporter=dot</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "research:" app/api/upload/route.ts` outputs at least two matches (MAX_FILE_SIZE and ALLOWED_TYPES)
    - `grep -n "'research'" app/api/upload/route.ts` outputs at least one match (in the body type literal)
    - `grep -n "csv: 'text'" app/api/upload/route.ts` outputs exactly one match
    - `grep -n "'research'" src/lib/r2-upload.ts` outputs exactly one match
    - `ls src/__tests__/upload-research.test.ts` returns success
    - `npx vitest run src/__tests__/upload-research.test.ts` exits 0 (all tests pass)
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Upload route accepts research category with correct MIME allowlist and size cap; GREEN test proves the category is wired.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Scaffold 4 RED Nyquist test files locking Wave 1/2/3 contracts</name>
  <read_first>
    - tests/phase-20.5/research-page-render.test.ts (reference pattern for Wave 0 RED scaffold with variable-path dynamic import)
    - src/__tests__/research-router.test.ts (reference mock pattern)
    - .planning/phases/27-research-workspace-admin-ui/27-VALIDATION.md §"Wave 0 Requirements"
    - .planning/phases/27-research-workspace-admin-ui/27-RESEARCH.md §"Phase Requirements → Test Map"
    - .planning/phases/27-research-workspace-admin-ui/27-UI-SPEC.md §"Component Inventory" + §"Copywriting Contract"
  </read_first>
  <behavior>
    - RED test files exist and are discoverable by the Vitest include glob (`tests/**/*.test.tsx`).
    - Each RED test file imports the component/module that Wave 1/2/3 plans must create; import fails with a resolvable error indicating which plan must implement the target.
    - Each test file ties its assertions to specific requirement IDs via describe-block naming.
    - Running `npx vitest run tests/research/` produces test failures (not errors that block the runner) — tests are marked `it.todo` OR written as genuine RED assertions that will flip GREEN when Wave 1/2/3 implements.
  </behavior>
  <action>
    Create four test files under `tests/research/` using the Phase 20.5/21/22 canonical pattern: variable-path dynamic import via array.join + `/* @vite-ignore */` comment so the module does not need to exist yet. Use `it.todo` for tests that require rendering infrastructure; use `it` with a `beforeAll` import catch for tests that can RED-assert the module absence.

    **File 1 — tests/research/create-edit-dialog.test.tsx (RESEARCH-06):**

    ```typescript
    /**
     * Wave 0 RED contract for RESEARCH-06: create/edit research item form.
     * Target module: `@/app/research-manage/new/page` (Plan 03 creates).
     * Also covers `@/app/research-manage/[id]/edit/page` (Plan 03).
     *
     * Per CONTEXT.md D-01 the surface is dedicated pages, not a dialog —
     * the filename keeps the 27-VALIDATION.md reference but the assertions
     * target the page module.
     *
     * Phase 16+ canonical pattern: variable-path dynamic import so the
     * module does not need to exist yet.
     */

    import { describe, it, expect, vi, beforeAll } from 'vitest'

    vi.mock('server-only', () => ({}))
    vi.mock('@/src/db', () => ({ db: {} }))

    async function _loadNewPage() {
      const segs = ['@', 'app', 'research-manage', 'new', 'page']
      const path = segs.join('/')
      return await import(/* @vite-ignore */ path).catch((e) => ({ _err: e }))
    }

    async function _loadEditPage() {
      const segs = ['@', 'app', 'research-manage', '[id]', 'edit', 'page']
      const path = segs.join('/')
      return await import(/* @vite-ignore */ path).catch((e) => ({ _err: e }))
    }

    describe('RESEARCH-06: /research-manage/new page module export', () => {
      it.todo('default-exports a React component that renders the 11-field metadata form')
      it.todo('itemType === media_coverage or legal_reference hides file input, shows externalUrl input (D-03)')
      it.todo('itemType === report shows file input, hides externalUrl input (D-03)')
      it.todo('Save Draft button disabled until title, documentId, and itemType provided')
      it.todo('file upload fires on change (not on save) — calls uploadFile with category: research (D-02/D-04)')
    })

    describe('RESEARCH-06: /research-manage/[id]/edit page module export', () => {
      it.todo('default-exports a React component that prefills form from trpc.research.getById')
      it.todo('Save Changes mutation calls trpc.research.update with only changed fields')
    })

    describe('RESEARCH-06: form validation invariants', () => {
      it.todo('title min 1 char, max 500 chars — matches router createInput schema')
      it.todo('isAuthorAnonymous toggle is a Switch, default off')
      it.todo('peerReviewed is a Checkbox, default unchecked')
    })
    ```

    **File 2 — tests/research/link-picker.test.tsx (RESEARCH-08):**

    ```typescript
    import { describe, it, expect, vi } from 'vitest'

    vi.mock('server-only', () => ({}))
    vi.mock('@/src/db', () => ({ db: {} }))

    describe('RESEARCH-08: SectionLinkPicker (research)', () => {
      it.todo('exports SectionLinkPicker with props { researchItemId, linkedSectionIds, open, onOpenChange }')
      it.todo('excludes already-linked sections from selectable list (mirrors workshop pattern)')
      it.todo('multi-select via Checkbox; selecting 3 sections fires 3 linkSection mutations via Promise.allSettled')
      it.todo('partial failure shows "Linked N of M. X failed" toast; full success shows "N sections linked" toast')
      it.todo('on close, selected state resets to empty array')
    })

    describe('RESEARCH-08: VersionLinkPicker', () => {
      it.todo('exports VersionLinkPicker with props { researchItemId, linkedVersionIds, open, onOpenChange }')
      it.todo('fetches versions via trpc.version.list per document (research items are per-document)')
      it.todo('multi-select multiple versions; linkVersion mutation fires for each via Promise.allSettled')
    })

    describe('RESEARCH-08: FeedbackLinkPicker (research)', () => {
      it.todo('exports FeedbackLinkPicker with props { researchItemId, linkedFeedbackIds, open, onOpenChange }')
      it.todo('reuses trpc.feedback.listAll (Phase 12 query)')
      it.todo('search + type filter narrow selectable list')
    })

    describe('RESEARCH-08: relevanceNote inline edit (D-07)', () => {
      it.todo('section link row renders relevanceNote text or "Add a relevance note…" placeholder')
      it.todo('clicking note text swaps in Textarea + Save/Cancel buttons')
      it.todo('Save note calls trpc.research.linkSection with { researchItemId, sectionId, relevanceNote } — relies on Plan 01 onConflictDoUpdate fix')
    })
    ```

    **File 3 — tests/research/lifecycle-actions.test.tsx (RESEARCH-07):**

    ```typescript
    import { describe, it, expect, vi } from 'vitest'

    vi.mock('server-only', () => ({}))
    vi.mock('@/src/db', () => ({ db: {} }))

    describe('RESEARCH-07: ResearchLifecycleActions RBAC (D-14)', () => {
      it.todo('research_lead viewing own draft: shows "Submit for Review" button')
      it.todo('research_lead viewing own draft: hides "Approve", "Reject", "Retract" buttons')
      it.todo("research_lead viewing another user's draft: hides all lifecycle buttons")
      it.todo('admin viewing pending_review item: shows "Approve" + "Reject" buttons, hides "Retract"')
      it.todo('policy_lead viewing pending_review item: shows "Approve" + "Reject" buttons, hides "Retract"')
      it.todo('admin viewing published item: shows "Retract" button only')
      it.todo('stakeholder: no lifecycle buttons ever visible')
    })

    describe('RESEARCH-07: Reject inline rationale expand', () => {
      it.todo('clicking "Reject" reveals Textarea + "Submit Rejection" button')
      it.todo('"Submit Rejection" disabled until rationale has ≥1 non-whitespace char')
      it.todo('submitting calls trpc.research.reject with { id, rejectionReason }')
      it.todo('Cancel collapses without mutation')
    })

    describe('RESEARCH-07: Retract Alert-Dialog', () => {
      it.todo('clicking "Retract" opens Alert-Dialog with required retractionReason textarea')
      it.todo('"Confirm Retract" disabled until reason has ≥1 non-whitespace char')
      it.todo('submitting calls trpc.research.retract with { id, retractionReason }')
    })

    describe('RESEARCH-07: Workflow transitions written on every transition', () => {
      it.todo('approve calls trpc.research.approve which delegates to transitionResearch (workflowTransitions INSERT before researchItems UPDATE — R6 invariant)')
      it.todo('after mutation, utils.research.getById and utils.research.listTransitions are both invalidated')
    })
    ```

    **File 4 — tests/research/anonymous-toggle.test.tsx (RESEARCH-06):**

    ```typescript
    import { describe, it, expect, vi } from 'vitest'
    import { shouldHideAuthors, formatAuthorsForDisplay } from '@/src/lib/research-utils'

    vi.mock('server-only', () => ({}))

    // GREEN tests — shouldHideAuthors is shipped in Plan 01 Task 1.
    // These lock the D-05 single-source-of-truth invariant: the preview
    // card AND the detail page both call this helper, so flipping the
    // Switch must change both surfaces identically.
    describe('RESEARCH-06: shouldHideAuthors pure helper (D-05)', () => {
      it('returns true when isAuthorAnonymous is true', () => {
        expect(shouldHideAuthors({ isAuthorAnonymous: true })).toBe(true)
      })

      it('returns false when isAuthorAnonymous is false', () => {
        expect(shouldHideAuthors({ isAuthorAnonymous: false })).toBe(false)
      })
    })

    describe('RESEARCH-06: formatAuthorsForDisplay (D-05 + UI-SPEC copywriting)', () => {
      it('returns exactly "Source: Confidential" when anonymous', () => {
        expect(
          formatAuthorsForDisplay({ isAuthorAnonymous: true, authors: ['Alice'] })
        ).toBe('Source: Confidential')
      })

      it('returns exactly "Authors: Alice, Bob" when named with authors', () => {
        expect(
          formatAuthorsForDisplay({ isAuthorAnonymous: false, authors: ['Alice', 'Bob'] })
        ).toBe('Authors: Alice, Bob')
      })

      it('returns "Unknown author" when not anonymous but authors is null', () => {
        expect(
          formatAuthorsForDisplay({ isAuthorAnonymous: false, authors: null })
        ).toBe('Unknown author')
      })
    })

    describe('RESEARCH-06: AnonymousPreviewCard component contract (Plan 03)', () => {
      it.todo('renders card with bg-muted, 8px padding, 12px caption text')
      it.todo('when isAuthorAnonymous=false and authors=["Alice"], renders text "Authors: Alice"')
      it.todo('when isAuthorAnonymous=true, renders text "Source: Confidential"')
      it.todo('updates live on Switch toggle — no server round-trip')
    })
    ```

    Confirm the vitest.config.mts `include` glob already covers `tests/**/*.test.tsx` (read vitest.config.mts to verify; it already includes this pattern per line 14, so no config change needed).
  </action>
  <verify>
    <automated>npx vitest run tests/research/ --reporter=dot</automated>
  </verify>
  <acceptance_criteria>
    - `ls tests/research/create-edit-dialog.test.tsx tests/research/link-picker.test.tsx tests/research/lifecycle-actions.test.tsx tests/research/anonymous-toggle.test.tsx` all return success
    - `grep -n "it.todo" tests/research/create-edit-dialog.test.tsx` outputs at least 8 matches
    - `grep -n "it.todo" tests/research/link-picker.test.tsx` outputs at least 10 matches
    - `grep -n "it.todo" tests/research/lifecycle-actions.test.tsx` outputs at least 12 matches
    - `grep -n "it.todo" tests/research/anonymous-toggle.test.tsx` outputs at least 4 matches
    - `grep -n "shouldHideAuthors" tests/research/anonymous-toggle.test.tsx` outputs at least 2 matches (import + usage)
    - `npx vitest run tests/research/` exits 0 (it.todo tests pass as todo, GREEN assertions pass)
    - `grep -n "RESEARCH-06\\|RESEARCH-07\\|RESEARCH-08" tests/research/` finds at least one requirement ID per file
  </acceptance_criteria>
  <done>Four Wave 0 test files exist, discovered by Vitest, and lock contracts for Plans 02–06.</done>
</task>

</tasks>

<verification>
- All 3 tasks pass their automated commands
- `npx vitest run` (full suite) exits 0 — no pre-existing tests broken
- `npx tsc --noEmit` exits 0
- Phase 26 surface (15 procedures) still intact: `npx vitest run src/__tests__/research-router.test.ts` still green
- Wave 0 validation flag can be flipped in 27-VALIDATION.md after this plan lands
</verification>

<success_criteria>
- `research.listTransitions` query shipped and registered in appRouter (verifies via `Object.keys(appRouter._def.procedures)` containing 'research.listTransitions')
- `research.list` accepts `authorId` filter (verifies via zod schema inspection in test)
- `research.linkSection` upserts relevanceNote via `onConflictDoUpdate` when provided (grep-verifiable)
- `'research'` category accepted by POST /api/upload with correct MIME allowlist and 32MB cap (RED→GREEN in upload-research.test.ts)
- `src/lib/r2-upload.ts` UploadOptions.category union includes 'research' literal (grep)
- `src/lib/research-utils.ts` exports `shouldHideAuthors` + `formatAuthorsForDisplay` with passing unit tests
- 4 Wave 0 RED test files exist under tests/research/ and are Vitest-discoverable
</success_criteria>

<output>
After completion, create `.planning/phases/27-research-workspace-admin-ui/27-01-SUMMARY.md` recording:
- Files modified (all 10 listed in frontmatter)
- Exact router additions (listTransitions signature, authorId filter, onConflictDoUpdate)
- Exact upload route additions (research category triplet)
- Any deviations from the plan (e.g., test mock shape changes)
- Hand-off notes for Plans 02–06: which Wave 0 contracts they must GREEN
</output>

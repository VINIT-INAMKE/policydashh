---
phase: 27-research-workspace-admin-ui
plan: 03
type: execute
wave: 1
depends_on: ["27-01"]
files_modified:
  - app/research-manage/new/page.tsx
  - app/research-manage/[id]/edit/page.tsx
  - app/research-manage/[id]/_components/anonymous-preview-card.tsx
  - app/research-manage/_components/research-item-form.tsx
  - src/server/routers/research.ts
autonomous: true
requirements:
  - RESEARCH-06
requirements_addressed:
  - RESEARCH-06
must_haves:
  truths:
    - "/research-manage/new renders a full metadata form + file upload zone"
    - "File upload fires on file-select (not on form save) — D-02 contract"
    - "itemType selector auto-drives upload mode: media_coverage/legal_reference → external URL; all others → file upload (D-03)"
    - "'research' upload category is used for file picks"
    - "AnonymousPreviewCard flips between 'Authors: X, Y' and 'Source: Confidential' as the Switch toggles (live, no server round-trip)"
    - "Create mutation persists evidence_artifacts row server-side when upload metadata provided; research_items.artifactId references it"
    - "/research-manage/[id]/edit prefills form from trpc.research.getById and uses trpc.research.update"
    - "Save success toast + router.push back to /research-manage on create, or /research-manage/[id] on edit"
  artifacts:
    - path: "app/research-manage/new/page.tsx"
      provides: "Create page shell"
      min_lines: 30
      contains: "ResearchItemForm"
    - path: "app/research-manage/[id]/edit/page.tsx"
      provides: "Edit page shell"
      min_lines: 40
      contains: "ResearchItemForm"
    - path: "app/research-manage/_components/research-item-form.tsx"
      provides: "Shared form component"
      min_lines: 300
      contains: "AnonymousPreviewCard"
    - path: "app/research-manage/[id]/_components/anonymous-preview-card.tsx"
      provides: "AnonymousPreviewCard"
      contains: "shouldHideAuthors"
    - path: "src/server/routers/research.ts"
      provides: "create/update extended to accept upload metadata and insert evidence_artifacts row"
      contains: "artifactR2Key"
  key_links:
    - from: "app/research-manage/_components/research-item-form.tsx"
      to: "POST /api/upload"
      via: "uploadFile helper with category: 'research'"
      pattern: "category: 'research'"
    - from: "app/research-manage/_components/research-item-form.tsx"
      to: "trpc.research.create"
      via: "mutateAsync with upload metadata + form fields"
      pattern: "trpc\\.research\\.create"
    - from: "app/research-manage/[id]/_components/anonymous-preview-card.tsx"
      to: "src/lib/research-utils.ts shouldHideAuthors"
      via: "import + function call"
      pattern: "shouldHideAuthors"
---

<objective>
Build the create/edit surface for research items. Implements RESEARCH-06 success criterion 2 (two-step metadata→upload flow, reduced to a single form page per D-01, with fire-on-file-select upload per D-02 and itemType-driven upload mode per D-03). Ships the `AnonymousPreviewCard` that locks the D-05 single-source-of-truth for the anonymous-author rule.

Purpose: Research authors need a refresh-safe, full-page form to author items. Dialogs lose state on accidental close; pages have a URL and browser-back that works. The form drives Plan 04's detail page (which follows from successful create).

Output: shared form component, create page, edit page, AnonymousPreviewCard, router extension for artifact row creation.
</objective>

<execution_context>
@D:/aditee/policydash/.claude/get-shit-done/workflows/execute-plan.md
@D:/aditee/policydash/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/27-research-workspace-admin-ui/27-CONTEXT.md
@.planning/phases/27-research-workspace-admin-ui/27-RESEARCH.md
@.planning/phases/27-research-workspace-admin-ui/27-UI-SPEC.md
@.planning/phases/27-research-workspace-admin-ui/27-01-router-upload-wave0-PLAN.md
@app/workshop-manage/new/page.tsx
@app/workshop-manage/[id]/_components/artifact-attach-dialog.tsx
@src/lib/r2-upload.ts
@src/server/routers/research.ts
@src/db/schema/research.ts

<interfaces>
From src/lib/r2-upload.ts (post-Plan 01):
```typescript
export async function uploadFile(file: File, options: {
  category?: 'image' | 'document' | 'evidence' | 'research'
  onProgress?: (percent: number) => void
}): Promise<{ url: string, name: string, key: string }>
```

From src/server/routers/research.ts create input (MUST extend in this plan):
```typescript
// BEFORE: artifactId: z.guid().optional()
// AFTER: artifactId remains optional AND these new fields added:
artifactFileName: z.string().optional()
artifactFileSize: z.number().int().positive().optional()
artifactR2Key:    z.string().optional()
artifactPublicUrl: z.string().url().optional()
// When all 4 are present, server INSERTs evidence_artifacts row and sets artifactId to its id
```

From src/db/schema/evidence.ts (existing):
```typescript
evidenceArtifacts = pgTable('evidence_artifacts', {
  id:         uuid PK default random
  type:       text ('file' | 'link')
  title:      text
  url:        text
  fileName:   text (nullable)
  fileSize:   integer (nullable)
  r2Key:      text (nullable)
  uploadedBy: text FK users.id
  createdAt:  timestamptz
})
```

Reference pattern: artifact-attach-dialog.tsx calls trpc.workshop.attachArtifact passing url/fileName/fileSize/r2Key — research.create should mirror this except it creates the row inline inside its own mutation.

From UI-SPEC §"/research-manage/new — Create page":
- Layout: max-w-2xl, Card container, back link, h1
- Section 1: Title, Document Select, Type Select, status chip (read-only "Draft")
- Section 2: Authors Input, isAuthorAnonymous Switch + AnonymousPreviewCard, Published Date input, DOI Input, Journal Input, Peer Reviewed Checkbox, Description Textarea
- Section 3 (D-03 conditional): External URL input OR file upload zone
- Footer: Save Draft (primary) + Cancel (ghost)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend research.create and research.update to accept upload metadata and insert evidence_artifacts row</name>
  <read_first>
    - src/server/routers/research.ts (current create/update shape, post-Plan 01)
    - src/server/routers/workshop.ts (find attachArtifact — reference for evidence_artifacts INSERT pattern)
    - src/db/schema/evidence.ts or wherever evidenceArtifacts is defined
    - .planning/phases/27-research-workspace-admin-ui/27-RESEARCH.md §"Pitfall 1: Upload before evidence_artifacts row exists"
  </read_first>
  <behavior>
    - Test 1 (shape): `create` input schema accepts `artifactFileName`, `artifactFileSize`, `artifactR2Key`, `artifactPublicUrl` as optional fields without throwing.
    - Test 2 (shape): `update` input schema accepts the same four optional fields.
    - Test 3 (runtime — covered by existing router test mock shape): mutation resolver runs without throwing when all 4 fields provided.
  </behavior>
  <action>
    **Edit 1 — src/server/routers/research.ts: extend createInput schema.**

    Locate the `createInput` const (~lines 83-98). Add these four optional fields at the end (before the closing `})`):
    ```typescript
      // Phase 27 D-02 upload metadata. When all four are provided, the
      // server INSERTs an evidence_artifacts row inside the mutation and
      // sets artifactId to that row's id. This is the single-write-boundary
      // solution to Pitfall 1 (POST /api/upload presigns only; someone
      // must create the DB row — we do it here, not client-side).
      artifactFileName:  z.string().max(500).optional(),
      artifactFileSize:  z.number().int().positive().max(32 * 1024 * 1024).optional(),
      artifactR2Key:     z.string().max(1000).optional(),
      artifactPublicUrl: z.string().url().max(2000).optional(),
    ```

    **Edit 2 — src/server/routers/research.ts: extend updateInput schema.**

    Add the same four optional fields to `updateInput` (~lines 100-114), before the closing `})`:
    ```typescript
      artifactFileName:  z.string().max(500).optional(),
      artifactFileSize:  z.number().int().positive().max(32 * 1024 * 1024).optional(),
      artifactR2Key:     z.string().max(1000).optional(),
      artifactPublicUrl: z.string().url().max(2000).optional(),
    ```

    **Edit 3 — src/server/routers/research.ts: in the `create` resolver, create the evidence_artifacts row before the research_items insert.**

    Add imports at the top of the file if missing:
    ```typescript
    import { evidenceArtifacts } from '@/src/db/schema/evidence'
    ```
    (Verify the exact path — grep for `evidenceArtifacts` in `src/db/schema/` to confirm the export location.)

    Inside the `create` resolver, BEFORE the `const [item] = await db.insert(researchItems).values(...)` block, add:
    ```typescript
      // Pitfall 1 fix: when upload metadata provided, create the
      // evidence_artifacts row first and use its id as artifactId. This
      // keeps the write boundary inside the mutation — no orphan rows on
      // success, no FK violation on create.
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
            r2Key:      input.artifactR2Key,
            uploadedBy: ctx.user.id,
          })
          .returning({ id: evidenceArtifacts.id })
        resolvedArtifactId = artifact.id
      }
    ```

    Then change the `artifactId: input.artifactId ?? null` line inside `.values({...})` to:
    ```typescript
      artifactId: resolvedArtifactId,
    ```

    **Edit 4 — src/server/routers/research.ts: apply the same evidence_artifacts creation logic to the `update` resolver.**

    Inside the `update` resolver, AFTER the ownership check and BEFORE the `.update(researchItems).set(...)` block, add equivalent logic: if the four artifact metadata fields are provided, create the row, set `changes.artifactId` to the new artifact id, and delete the four `artifact*` metadata keys from `changes` so they don't get spread into the update query (they're not columns on `research_items`).

    Concretely, BEFORE calling `db.update(researchItems).set({ ...changes, updatedAt: new Date() })`, add:
    ```typescript
      // Pitfall 1 parity with create: allow edit-page upload to create a
      // fresh artifact row when the user replaces the file.
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
            r2Key:      changes.artifactR2Key,
            uploadedBy: ctx.user.id,
          })
          .returning({ id: evidenceArtifacts.id })
        changes.artifactId = artifact.id
      }
      // Strip upload metadata from the update set — these are not columns
      // on research_items.
      delete (changes as Record<string, unknown>).artifactFileName
      delete (changes as Record<string, unknown>).artifactFileSize
      delete (changes as Record<string, unknown>).artifactR2Key
      delete (changes as Record<string, unknown>).artifactPublicUrl
    ```

    **Edit 5 — update src/__tests__/research-router.test.ts (or add a new describe block) to assert the 4 new optional fields are accepted.**

    Append inside an existing describe block or add:
    ```typescript
    describe('Phase 27 create/update artifact metadata extension (RESEARCH-06)', () => {
      it('create procedure is still defined after artifact metadata fields added', () => {
        expect(mod.researchRouter._def.procedures.create).toBeDefined()
      })
      it('update procedure is still defined after artifact metadata fields added', () => {
        expect(mod.researchRouter._def.procedures.update).toBeDefined()
      })
    })
    ```
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/research-router.test.ts --reporter=dot && npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "artifactR2Key" src/server/routers/research.ts` outputs >= 4 matches (2 schemas + 2 resolver uses)
    - `grep -n "artifactFileName" src/server/routers/research.ts` outputs >= 4 matches
    - `grep -n "artifactPublicUrl" src/server/routers/research.ts` outputs >= 4 matches
    - `grep -n "evidenceArtifacts" src/server/routers/research.ts` outputs >= 1 match (import + usage)
    - `grep -n "resolvedArtifactId" src/server/routers/research.ts` outputs >= 2 matches (declaration + usage)
    - `npx vitest run src/__tests__/research-router.test.ts` exits 0
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>create and update router mutations accept and act on upload metadata; artifact row created server-side with FK safe.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Build shared ResearchItemForm component + AnonymousPreviewCard</name>
  <read_first>
    - app/workshop-manage/new/page.tsx (layout: max-w-2xl, Card, back-arrow, footer buttons)
    - app/workshop-manage/[id]/_components/artifact-attach-dialog.tsx (uploadFile usage + error handling)
    - src/lib/r2-upload.ts (uploadFile signature with onProgress)
    - src/lib/research-utils.ts (shouldHideAuthors + formatAuthorsForDisplay from Plan 01)
    - components/ui/switch.tsx, components/ui/progress.tsx, components/ui/select.tsx
    - .planning/phases/27-research-workspace-admin-ui/27-UI-SPEC.md §"/research-manage/new — Create page" (full section + copywriting)
    - .planning/phases/27-research-workspace-admin-ui/27-CONTEXT.md D-02, D-03, D-05
  </read_first>
  <action>
    **Edit 1 — app/research-manage/[id]/_components/anonymous-preview-card.tsx: NEW FILE.**

    ```typescript
    import { Card } from '@/components/ui/card'
    import { shouldHideAuthors } from '@/src/lib/research-utils'

    export interface AnonymousPreviewCardProps {
      isAuthorAnonymous: boolean
      authors: string[]
    }

    export function AnonymousPreviewCard({
      isAuthorAnonymous,
      authors,
    }: AnonymousPreviewCardProps) {
      // D-05: single source of truth — uses shouldHideAuthors which detail
      // page and Phase 28 public listing will ALSO consume.
      const hide = shouldHideAuthors({ isAuthorAnonymous })
      const named = authors.filter((a) => a.trim().length > 0)
      const displayText = hide
        ? 'Source: Confidential'
        : named.length > 0
          ? `Authors: ${named.join(', ')}`
          : 'Authors: (none specified)'

      return (
        <Card className="bg-muted p-2">
          <p className="text-xs text-muted-foreground">
            Preview: <span className="font-medium text-foreground">{displayText}</span>
          </p>
        </Card>
      )
    }
    ```

    **Edit 2 — app/research-manage/_components/research-item-form.tsx: NEW FILE — the shared metadata form used by both create and edit pages.**

    Client component. Exports `ResearchItemForm` accepting:
    ```typescript
    export interface ResearchItemFormProps {
      mode: 'create' | 'edit'
      initialValues?: {
        id?: string
        documentId?: string
        title?: string
        itemType?: string
        description?: string
        externalUrl?: string
        artifactId?: string | null
        artifactFileName?: string | null   // for displaying existing artifact in edit mode
        artifactFileSize?: number | null
        doi?: string
        authors?: string[]
        publishedDate?: string | null
        peerReviewed?: boolean
        journalOrSource?: string
        isAuthorAnonymous?: boolean
      }
      documents: { id: string, title: string }[]
      onSuccess: (id: string) => void   // parent navigates
    }
    ```

    **Form structure** (single-column, max-w-2xl wrapper handled by parent page):

    State (all `useState`):
    - `title`, `description`, `externalUrl`, `doi`, `journalOrSource`: string
    - `documentId`, `itemType`: string (single-select, empty string = unchosen)
    - `authors`: string[] (simple comma-separated textarea stored as array; split on render, join on edit)
    - `authorsInput`: string (what the Input field displays — avoid churn on every keystroke)
    - `publishedDate`: string (YYYY-MM-DD)
    - `peerReviewed`: boolean
    - `isAuthorAnonymous`: boolean
    - Upload state: `uploadState: 'idle' | 'uploading' | 'done' | 'error'`, `uploadProgress: number`, `uploadedMeta: { name, size, key, url } | null`

    Initial hydration: on mount (or when `initialValues` changes via useEffect), set all state from `initialValues`.

    **Fields (render in order, with shadcn primitives):**

    1. Title Input — required, maxLength 500, `<Label>Title</Label>`
    2. Document Select — required; options from `props.documents`
    3. Type Select — required; 8 itemType options (report, paper, dataset, memo, interview_transcript, media_coverage, legal_reference, case_study). Label formatting via `.replace('_', ' ')` + Title Case.
    4. Status read-only chip: `<Badge variant="secondary">Draft</Badge>` (create mode) OR `<ResearchStatusBadge status={initialValues?.status} />` passed through prop (edit mode — but keep simple, create is draft).
    5. Description Textarea — rows 4, maxLength 5000
    6. Authors Input — hidden when `isAuthorAnonymous`. Placeholder "Comma-separated names". Uses `authorsInput` state; onBlur splits to `authors: string[]`.
    7. isAuthorAnonymous Switch — Label "Hide author identity on public surfaces"
    8. **`<AnonymousPreviewCard isAuthorAnonymous={isAuthorAnonymous} authors={authors} />`** — rendered right under the switch
    9. Published Date Input type="date"
    10. DOI Input — placeholder "10.1000/xyz123", maxLength 100
    11. Journal/Source Input — maxLength 500
    12. Peer Reviewed Checkbox + Label "Peer reviewed"
    13. **Conditional upload zone (D-03)**:
        - When `itemType === 'media_coverage' || itemType === 'legal_reference'`: render External URL Input (`type="url"`, required-ish — save can proceed without, but warn); HIDE the file upload zone.
        - When itemType is any other value (including empty): render file upload zone. External URL input is HIDDEN.
        - File upload zone:
          - `<Label>Attachment</Label>`
          - `<Input type="file" accept=".pdf,.docx,.doc,.csv,.xlsx,.xls" onChange={handleFileSelect} />` — hidden/replaced by "Uploaded …" row after success
          - Progress bar: `<Progress value={uploadProgress} />` when `uploadState === 'uploading'`
          - Success row: "Uploaded {name} · {size formatted}" + "Remove" ghost button that resets uploaded state
          - Error row: Alert variant="destructive" with UI-SPEC copy

    **`handleFileSelect` implementation** (D-02 fire-on-select):
    ```typescript
    async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0]
      if (!file) return
      setUploadState('uploading')
      setUploadProgress(0)
      try {
        const result = await uploadFile(file, {
          category: 'research',
          onProgress: setUploadProgress,
        })
        setUploadedMeta({
          name: result.name,
          size: file.size,
          key: result.key,
          url: result.url,
        })
        setUploadState('done')
      } catch (err) {
        setUploadState('error')
        toast.error('Upload failed. Check your connection and try again.')
      }
    }
    ```

    **Submit handler**:

    ```typescript
    const createMutation = trpc.research.create.useMutation({
      onSuccess: (result) => {
        toast.success('Research item saved as draft.')
        props.onSuccess(result.id)
      },
      onError: (err) => toast.error(err.message || "Couldn't save. Check your connection and try again."),
    })
    const updateMutation = trpc.research.update.useMutation({
      onSuccess: (result) => {
        toast.success('Changes saved.')
        props.onSuccess(result.id)
      },
      onError: (err) => toast.error(err.message || "Couldn't save. Check your connection and try again."),
    })

    function handleSubmit(e: React.FormEvent) {
      e.preventDefault()
      // client-side minimal guard: title, documentId, itemType required
      if (!title.trim() || !documentId || !itemType) return

      const commonPayload = {
        title: title.trim(),
        description: description.trim() || undefined,
        externalUrl: externalUrl.trim() || undefined,
        doi: doi.trim() || undefined,
        authors: authors.length > 0 ? authors : undefined,
        publishedDate: publishedDate || undefined,
        peerReviewed,
        journalOrSource: journalOrSource.trim() || undefined,
        isAuthorAnonymous,
        // Upload metadata flows server-side (D-02 server creates evidence_artifacts row)
        ...(uploadedMeta
          ? {
              artifactFileName:  uploadedMeta.name,
              artifactFileSize:  uploadedMeta.size,
              artifactR2Key:     uploadedMeta.key,
              artifactPublicUrl: uploadedMeta.url,
            }
          : {}),
      }

      if (mode === 'create') {
        createMutation.mutate({
          documentId,
          itemType: itemType as ResearchItemType,
          ...commonPayload,
        })
      } else if (mode === 'edit' && initialValues?.id) {
        updateMutation.mutate({
          id: initialValues.id,
          ...commonPayload,
        })
      }
    }
    ```

    Footer: `<div className="flex items-center justify-end gap-2">` with Button variant="outline" render={<Link href=... />} "Cancel" (back to list or detail) + Button type="submit" primary with text "Save Draft" (create mode) or "Save Changes" (edit mode). Disabled when `!title.trim() || !documentId || !itemType || createMutation.isPending || updateMutation.isPending`.

    Use EXACT UI-SPEC copy strings for all labels and toast messages.

    The `ResearchItemType` type: import from `@/src/server/routers/research` if exported; otherwise define a local literal union matching the 8 enum values.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `ls app/research-manage/[id]/_components/anonymous-preview-card.tsx` returns success
    - `ls app/research-manage/_components/research-item-form.tsx` returns success
    - `grep -n "shouldHideAuthors" app/research-manage/[id]/_components/anonymous-preview-card.tsx` exactly one match
    - `grep -n "'Source: Confidential'" app/research-manage/[id]/_components/anonymous-preview-card.tsx` exactly one match (UI-SPEC copy)
    - `grep -n "category: 'research'" app/research-manage/_components/research-item-form.tsx` exactly one match
    - `grep -n "uploadFile" app/research-manage/_components/research-item-form.tsx` at least one match
    - `grep -n "AnonymousPreviewCard" app/research-manage/_components/research-item-form.tsx` at least one match
    - `grep -n "artifactR2Key" app/research-manage/_components/research-item-form.tsx` at least one match
    - `grep -n "'media_coverage' \\|\\| itemType === 'legal_reference'" app/research-manage/_components/research-item-form.tsx` or equivalent D-03 branch at least one match
    - `grep -n "'Save Draft'" app/research-manage/_components/research-item-form.tsx` at least one match
    - `grep -n "'Save Changes'" app/research-manage/_components/research-item-form.tsx` at least one match
    - `grep -n "'Research item saved as draft.'" app/research-manage/_components/research-item-form.tsx` exactly one match (UI-SPEC copy)
    - `head -1 app/research-manage/_components/research-item-form.tsx` outputs `'use client'`
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Shared form with 11 fields + itemType-driven upload branch + AnonymousPreviewCard + D-02 fire-on-select upload + submit wiring.</done>
</task>

<task type="auto">
  <name>Task 3: Create /research-manage/new and /research-manage/[id]/edit page shells</name>
  <read_first>
    - app/workshop-manage/new/page.tsx (page shell + role redirect + router usage)
    - app/research-manage/_components/research-item-form.tsx (from Task 2)
    - .planning/phases/27-research-workspace-admin-ui/27-UI-SPEC.md §"/research-manage/new" and §"/research-manage/[id]/edit"
  </read_first>
  <action>
    **Edit 1 — app/research-manage/new/page.tsx: NEW FILE.**

    Client component. Structure:
    ```typescript
    'use client'

    import { useEffect } from 'react'
    import Link from 'next/link'
    import { useRouter } from 'next/navigation'
    import { ArrowLeft } from 'lucide-react'
    import { trpc } from '@/src/trpc/client'
    import { can } from '@/src/lib/permissions'
    import { Button } from '@/components/ui/button'
    import { Card } from '@/components/ui/card'
    import { ResearchItemForm } from '../_components/research-item-form'

    export default function NewResearchItemPage() {
      const router = useRouter()
      const meQuery = trpc.user.getMe.useQuery()
      const documentsQuery = trpc.document.list.useQuery({})

      const role = meQuery.data?.role
      const allowed = role ? can(role, 'research:create') : undefined

      // Role redirect: if the user has no create permission, bounce to list.
      useEffect(() => {
        if (meQuery.data && allowed === false) {
          router.replace('/research-manage')
        }
      }, [meQuery.data, allowed, router])

      if (meQuery.isLoading || documentsQuery.isLoading) {
        return null  // keep loading blank; parent layout shows nav skeleton
      }

      if (!allowed) return null

      return (
        <div className="mx-auto max-w-2xl">
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/research-manage" />}
            className="mb-4"
          >
            <ArrowLeft className="size-3.5" />
            Back to Research Items
          </Button>

          <h1 className="mb-6 text-xl font-semibold">New Research Item</h1>

          <Card className="p-6">
            <ResearchItemForm
              mode="create"
              documents={documentsQuery.data ?? []}
              onSuccess={(id) => router.push(`/research-manage/${id}`)}
            />
          </Card>
        </div>
      )
    }
    ```

    **Edit 2 — app/research-manage/[id]/edit/page.tsx: NEW FILE.**

    Client component. Structure:
    ```typescript
    'use client'

    import { useEffect } from 'react'
    import Link from 'next/link'
    import { useParams, useRouter } from 'next/navigation'
    import { ArrowLeft } from 'lucide-react'
    import { trpc } from '@/src/trpc/client'
    import { can } from '@/src/lib/permissions'
    import { Button } from '@/components/ui/button'
    import { Card } from '@/components/ui/card'
    import { Skeleton } from '@/components/ui/skeleton'
    import { ResearchItemForm } from '../../_components/research-item-form'

    export default function EditResearchItemPage() {
      const router = useRouter()
      const params = useParams<{ id: string }>()
      const id = params.id

      const meQuery = trpc.user.getMe.useQuery()
      const itemQuery = trpc.research.getById.useQuery({ id })
      const documentsQuery = trpc.document.list.useQuery({})

      const role = meQuery.data?.role
      // Use permission helper — server enforces ownership + status lock
      const allowed = role ? can(role, 'research:manage_own') : undefined

      useEffect(() => {
        if (meQuery.data && allowed === false) {
          router.replace('/research-manage')
        }
      }, [meQuery.data, allowed, router])

      if (itemQuery.isLoading || meQuery.isLoading || documentsQuery.isLoading) {
        return (
          <div className="mx-auto max-w-2xl space-y-4">
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-96 w-full" />
          </div>
        )
      }

      if (!allowed) return null
      if (!itemQuery.data) return null

      const item = itemQuery.data

      return (
        <div className="mx-auto max-w-2xl">
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={`/research-manage/${id}`} />}
            className="mb-4"
          >
            <ArrowLeft className="size-3.5" />
            Back to Research Item
          </Button>

          <h1 className="mb-6 text-xl font-semibold">Edit Research Item</h1>

          <Card className="p-6">
            <ResearchItemForm
              mode="edit"
              initialValues={{
                id: item.id,
                documentId: item.documentId,
                title: item.title,
                itemType: item.itemType,
                description: item.description ?? undefined,
                externalUrl: item.externalUrl ?? undefined,
                artifactId: item.artifactId ?? undefined,
                doi: item.doi ?? undefined,
                authors: item.authors ?? [],
                publishedDate: item.publishedDate ?? null,
                peerReviewed: item.peerReviewed,
                journalOrSource: item.journalOrSource ?? undefined,
                isAuthorAnonymous: item.isAuthorAnonymous,
              }}
              documents={documentsQuery.data ?? []}
              onSuccess={() => router.push(`/research-manage/${id}`)}
            />
          </Card>
        </div>
      )
    }
    ```

    Note on `artifactFileName`/`Size` prefill for edit mode: we omit these because reading the linked `evidence_artifacts` row would require a join on `research.getById` (not in scope — the router currently returns just the research_items row). Leave undefined — the form will not show the "Uploaded X" row for existing items, but the user can upload a fresh file to replace the artifact. Document this in the summary as an acceptable shortcut; a follow-up can denormalize artifactFileName/Size onto research_items or extend getById to join.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `ls app/research-manage/new/page.tsx` returns success
    - `ls app/research-manage/[id]/edit/page.tsx` returns success
    - `grep -n "ResearchItemForm" app/research-manage/new/page.tsx` exactly one match
    - `grep -n "ResearchItemForm" app/research-manage/[id]/edit/page.tsx` exactly one match
    - `grep -n "mode=\"create\"" app/research-manage/new/page.tsx` exactly one match
    - `grep -n "mode=\"edit\"" app/research-manage/[id]/edit/page.tsx` exactly one match
    - `grep -n "can(role, 'research:create')" app/research-manage/new/page.tsx` exactly one match
    - `grep -n "New Research Item" app/research-manage/new/page.tsx` exactly one match
    - `grep -n "Edit Research Item" app/research-manage/[id]/edit/page.tsx` exactly one match
    - `head -1 app/research-manage/new/page.tsx` outputs `'use client'`
    - `head -1 app/research-manage/[id]/edit/page.tsx` outputs `'use client'`
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Both pages render, role-gated, prefill or start blank, call ResearchItemForm, navigate on success.</done>
</task>

</tasks>

<verification>
- `/research-manage/new` loads for admin/policy_lead/research_lead
- itemType switch toggles upload zone vs external URL input (D-03)
- File select triggers upload progress → "Uploaded X" row (D-02)
- isAuthorAnonymous Switch toggles AnonymousPreviewCard text live (D-05)
- Save Draft creates research_item AND evidence_artifacts row when file uploaded
- Navigates to /research-manage/[id] on success
- Edit page prefills and saves updates
- `npx tsc --noEmit` passes
- `npx vitest run` full suite still green
</verification>

<success_criteria>
- RESEARCH-06 SC-2 satisfied: create AND edit flows functional with file upload fire-on-select
- D-02, D-03, D-05 invariants verifiable in code
- No orphan evidence_artifacts rows on happy path
- Shared ResearchItemForm used by both create and edit pages (no duplication)
</success_criteria>

<output>
Create `.planning/phases/27-research-workspace-admin-ui/27-03-SUMMARY.md` recording:
- Files created/modified
- Edit-mode artifact prefill shortcut (documented above)
- Any adjustments to the itemType branch logic
- Hand-off for Plan 04: detail page navigation targets (`router.push('/research-manage/${id}')` from create, `/research-manage/${id}/edit` from edit)
</output>

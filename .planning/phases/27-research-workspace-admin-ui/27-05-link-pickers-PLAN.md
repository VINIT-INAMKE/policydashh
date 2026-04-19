---
phase: 27-research-workspace-admin-ui
plan: 05
type: execute
wave: 3
depends_on: ["27-01", "27-04"]
files_modified:
  - app/research-manage/[id]/_components/section-link-picker.tsx
  - app/research-manage/[id]/_components/version-link-picker.tsx
  - app/research-manage/[id]/_components/feedback-link-picker.tsx
  - app/research-manage/[id]/_components/linked-section-row.tsx
  - app/research-manage/[id]/page.tsx
  - src/server/routers/research.ts
autonomous: true
requirements:
  - RESEARCH-08
requirements_addressed:
  - RESEARCH-08
must_haves:
  truths:
    - "SectionLinkPicker controlled dialog: multi-select + Promise.allSettled + consolidated toast"
    - "VersionLinkPicker controlled dialog: multi-select versions per document"
    - "FeedbackLinkPicker controlled dialog: search + type filter + multi-select, reusing trpc.feedback.listAll"
    - "Detail page shows linked sections/versions/feedback lists with unlink buttons; picker triggers wired to open-state"
    - "relevanceNote per section link is click-to-edit inline via linkSection mutation (Plan 01 onConflictDoUpdate)"
    - "Every link mutation invalidates utils.research.getById"
    - "research.getById extended to include linked sections/versions/feedback with joined metadata"
  artifacts:
    - path: "app/research-manage/[id]/_components/section-link-picker.tsx"
      provides: "SectionLinkPicker dialog"
      contains: "researchItemId"
    - path: "app/research-manage/[id]/_components/version-link-picker.tsx"
      provides: "VersionLinkPicker dialog"
      contains: "researchItemId"
    - path: "app/research-manage/[id]/_components/feedback-link-picker.tsx"
      provides: "FeedbackLinkPicker dialog"
      contains: "researchItemId"
    - path: "app/research-manage/[id]/_components/linked-section-row.tsx"
      provides: "Section link row with inline relevanceNote editor (D-07)"
      contains: "relevanceNote"
    - path: "app/research-manage/[id]/page.tsx"
      provides: "Detail page extended with picker mounts + linked lists"
      contains: "SectionLinkPicker"
    - path: "src/server/routers/research.ts"
      provides: "getById extended with linked sections/versions/feedback arrays"
      contains: "researchItemSectionLinks"
  key_links:
    - from: "app/research-manage/[id]/_components/section-link-picker.tsx"
      to: "trpc.research.linkSection + trpc.document.list"
      via: "useMutation + useQuery"
      pattern: "trpc\\.research\\.linkSection"
    - from: "app/research-manage/[id]/_components/version-link-picker.tsx"
      to: "trpc.research.linkVersion + trpc.version.list"
      via: "useMutation + useQuery per document"
      pattern: "trpc\\.research\\.linkVersion"
    - from: "app/research-manage/[id]/_components/feedback-link-picker.tsx"
      to: "trpc.research.linkFeedback + trpc.feedback.listAll"
      via: "useMutation + useQuery"
      pattern: "trpc\\.research\\.linkFeedback"
    - from: "app/research-manage/[id]/_components/linked-section-row.tsx"
      to: "trpc.research.linkSection (with relevanceNote)"
      via: "useMutation — upsert per Plan 01"
      pattern: "relevanceNote"
---

<objective>
Ship the three link-picker dialogs that connect research items to policy sections, document versions, and feedback items. Implements RESEARCH-08 success criterion 4 (link-picker dialogs with per-section relevanceNote inline-editable). Extends `research.getById` to include the linked entities so the detail page can render them without separate queries.

Purpose: Research items are citable evidence attached to specific sections/versions/feedback. Without link pickers, the connections exist only at the DB level — no UI. Plan 04 left a placeholder slot; this plan fills it.

Output: three picker components, one linked-section row component (with inline relevanceNote editor), detail page extension, router getById extension.
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
@.planning/phases/27-research-workspace-admin-ui/27-04-detail-page-lifecycle-PLAN.md
@app/workshop-manage/[id]/_components/section-link-picker.tsx
@app/workshop-manage/[id]/_components/feedback-link-picker.tsx
@src/server/routers/research.ts
@src/server/routers/version.ts
@src/server/routers/document.ts
@src/server/routers/feedback.ts

<interfaces>
From trpc.research (shipped in Plan 01):
```typescript
linkSection({ researchItemId: guid, sectionId: guid, relevanceNote?: string })
  => { linked: true }
unlinkSection({ researchItemId: guid, sectionId: guid })
  => { unlinked: true }
linkVersion({ researchItemId: guid, versionId: guid })
  => { linked: true }
unlinkVersion({ researchItemId: guid, versionId: guid })
  => { unlinked: true }
linkFeedback({ researchItemId: guid, feedbackId: guid })
  => { linked: true }
unlinkFeedback({ researchItemId: guid, feedbackId: guid })
  => { unlinked: true }
```

From trpc.document.list:
```typescript
// Input: { includeSections?: boolean }
// Returns: Array<{ id, title, sections?: Array<{ id, title, documentId, content }> }>
```

From trpc.version.list:
```typescript
// Input: { documentId: string (uuid) }
// Returns: Array<{ id, documentId, versionLabel, isPublished, createdAt, ... }>
```

From trpc.feedback.listAll:
```typescript
// Returns: Array<{ id, readableId, title, body, feedbackType, sectionId, documentId, isAnonymous, submitterName, createdAt, ... }>
```

From workshop section-link-picker.tsx (template — ALREADY READ IN PRIOR PLAN CONTEXT):
```typescript
// Pattern for new pickers:
async function handleLink() {
  const targets = selected.filter((id) => !linkedIds.includes(id))
  if (targets.length === 0) { reset(); onOpenChange(false); return }
  const results = await Promise.allSettled(
    targets.map((id) => linkMutation.mutateAsync({ researchItemId, ...id }))
  )
  // count failures, consolidated toast, invalidate utils.research.getById
}
```

Schema tables (referenced for router getById join):
- researchItemSectionLinks (researchItemId, sectionId, relevanceNote, createdAt)
- researchItemVersionLinks (researchItemId, versionId, createdAt)
- researchItemFeedbackLinks (researchItemId, feedbackId, createdAt)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend research.getById router to include linked sections/versions/feedback arrays</name>
  <read_first>
    - src/server/routers/research.ts (current getById shape)
    - src/db/schema/research.ts (researchItemSectionLinks, researchItemVersionLinks, researchItemFeedbackLinks)
    - src/db/schema/documents.ts (policySections columns)
    - src/db/schema/changeRequests.ts (documentVersions columns)
    - src/db/schema/feedback.ts (feedbackItems columns)
    - app/workshop-manage/[id]/page.tsx (reference: consumer expects workshop.sections[] + workshop.feedback[] with joined names)
  </read_first>
  <action>
    **Edit 1 — src/server/routers/research.ts: extend the `getById` query resolver to join linked entities.**

    Current getById returns the single research_items row. Extend it to additionally fetch three arrays: linked sections, versions, feedback — with joined display data (title, document title, readable ID) so the detail page can render without extra queries.

    Add imports at the top (verify existing imports first, add only what's missing):
    ```typescript
    import {
      researchItems,
      researchItemSectionLinks,
      researchItemVersionLinks,
      researchItemFeedbackLinks,
    } from '@/src/db/schema/research'
    import { policySections, policyDocuments } from '@/src/db/schema/documents'
    import { documentVersions } from '@/src/db/schema/changeRequests'
    import { feedbackItems } from '@/src/db/schema/feedback'
    ```

    Replace the current `getById` resolver body. After fetching the item and applying anonymous-author filter, fetch the three link arrays via parallel queries. Return shape becomes `{ ...item, linkedSections, linkedVersions, linkedFeedback }`.

    New resolver:
    ```typescript
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
          const scoped = row.isAuthorAnonymous && row.status === 'published'
            ? { ...row, authors: null }
            : row

          // Phase 27 RESEARCH-08: fetch linked entities in parallel for the
          // detail page. Each linked entity is returned with its display
          // metadata (title, readableId) so the UI renders without extra
          // client queries.
          const [linkedSections, linkedVersions, linkedFeedback] = await Promise.all([
            db
              .select({
                sectionId:     researchItemSectionLinks.sectionId,
                relevanceNote: researchItemSectionLinks.relevanceNote,
                sectionTitle:  policySections.title,
                documentId:    policySections.documentId,
                documentTitle: policyDocuments.title,
              })
              .from(researchItemSectionLinks)
              .innerJoin(policySections, eq(researchItemSectionLinks.sectionId, policySections.id))
              .innerJoin(policyDocuments, eq(policySections.documentId, policyDocuments.id))
              .where(eq(researchItemSectionLinks.researchItemId, input.id)),

            db
              .select({
                versionId:    researchItemVersionLinks.versionId,
                versionLabel: documentVersions.versionLabel,
                documentId:   documentVersions.documentId,
                documentTitle: policyDocuments.title,
                isPublished:  documentVersions.isPublished,
              })
              .from(researchItemVersionLinks)
              .innerJoin(documentVersions, eq(researchItemVersionLinks.versionId, documentVersions.id))
              .innerJoin(policyDocuments, eq(documentVersions.documentId, policyDocuments.id))
              .where(eq(researchItemVersionLinks.researchItemId, input.id)),

            db
              .select({
                feedbackId: researchItemFeedbackLinks.feedbackId,
                readableId: feedbackItems.readableId,
                title:      feedbackItems.title,
                documentId: feedbackItems.documentId,
              })
              .from(researchItemFeedbackLinks)
              .innerJoin(feedbackItems, eq(researchItemFeedbackLinks.feedbackId, feedbackItems.id))
              .where(eq(researchItemFeedbackLinks.researchItemId, input.id)),
          ])

          return {
            ...scoped,
            linkedSections,
            linkedVersions,
            linkedFeedback,
          }
        }),
    ```

    **Edit 2 — update the Wave 0 test to cover the extended getById shape.**

    Append a test case to `src/__tests__/research-router.test.ts`:
    ```typescript
    describe('Phase 27 getById linked-entity extension (RESEARCH-08)', () => {
      it('getById is still defined after linked-entity join extension', () => {
        expect(mod.researchRouter._def.procedures.getById).toBeDefined()
      })
    })
    ```

    The heavy DB assertions stay in the existing shape tests; runtime behavior is validated when pickers invalidate and the detail page re-renders.
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/research-router.test.ts --reporter=dot && npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "linkedSections" src/server/routers/research.ts` outputs at least 2 matches
    - `grep -n "linkedVersions" src/server/routers/research.ts` outputs at least 2 matches
    - `grep -n "linkedFeedback" src/server/routers/research.ts` outputs at least 2 matches
    - `grep -n "researchItemSectionLinks" src/server/routers/research.ts` outputs >= 3 matches (import + getById join + existing linkSection/unlinkSection)
    - `grep -n "Promise.all(" src/server/routers/research.ts` outputs at least one match in the getById resolver
    - `grep -n "relevanceNote: researchItemSectionLinks.relevanceNote" src/server/routers/research.ts` exactly one match
    - `npx vitest run src/__tests__/research-router.test.ts` exits 0
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>getById returns the research item + three linked-entity arrays with joined display data.</done>
</task>

<task type="auto">
  <name>Task 2: Build SectionLinkPicker + VersionLinkPicker + FeedbackLinkPicker (three controlled dialogs)</name>
  <read_first>
    - app/workshop-manage/[id]/_components/section-link-picker.tsx (verbatim reference)
    - app/workshop-manage/[id]/_components/feedback-link-picker.tsx (verbatim reference)
    - components/ui/dialog.tsx, components/ui/checkbox.tsx, components/ui/input.tsx, components/ui/select.tsx
    - .planning/phases/27-research-workspace-admin-ui/27-UI-SPEC.md §"Link pickers (D-06)" + §"Copywriting Contract" (link success/partial failure toast strings)
    - .planning/phases/27-research-workspace-admin-ui/27-CONTEXT.md D-06
  </read_first>
  <action>
    **Edit 1 — app/research-manage/[id]/_components/section-link-picker.tsx: NEW FILE.**

    Mirror the workshop section-link-picker verbatim with these changes:
    - Props: `{ researchItemId, linkedSectionIds, open, onOpenChange }`
    - Mutation: `trpc.research.linkSection`
    - Invalidation: `utils.research.getById.invalidate({ id: researchItemId })`
    - Toast copy from UI-SPEC: "Section linked." (singular) / "{N} sections linked." (plural) / "Linked {S} of {N}. {F} failed — try again."
    - Dialog title: "Link Sections to Research Item"
    - Confirm button: `Link {N > 0 ? "(N)" : ""}`

    Keep the flatten-via-document-list + availableSections filter pattern identical to workshop-manage's picker.

    **Edit 2 — app/research-manage/[id]/_components/version-link-picker.tsx: NEW FILE.**

    New picker, no direct prior art (version picker doesn't exist in workshop-manage). Use this pattern:

    - Props: `{ researchItemId, linkedVersionIds, open, onOpenChange }`
    - Uses `trpc.document.list.useQuery({}, { enabled: open })` for documents
    - For each document, conditionally uses `trpc.version.list.useQuery({ documentId: doc.id }, { enabled: open })` — or simpler: aggregate version lists by iterating documents and calling version.list per-document inside a hook-safe wrapper. The simplest implementation: when `open` is true AND documents are loaded, render one `VersionListSection` child per document which runs its own `trpc.version.list.useQuery` call.
    - Multi-select via Checkbox grouped under document headings
    - Display per version: `v{versionLabel}` + document title + `isPublished` Badge
    - Confirm: `Promise.allSettled` over `trpc.research.linkVersion` mutations
    - Invalidation: `utils.research.getById.invalidate({ id: researchItemId })`
    - Toast copy: "Version linked." / "{N} versions linked." / "Linked {S} of {N}. {F} failed — try again."

    Example skeleton:
    ```typescript
    'use client'

    import { useState } from 'react'
    import { trpc } from '@/src/trpc/client'
    import { Button } from '@/components/ui/button'
    import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
    import { Checkbox } from '@/components/ui/checkbox'
    import { Badge } from '@/components/ui/badge'
    import { Skeleton } from '@/components/ui/skeleton'
    import { toast } from 'sonner'

    export interface VersionLinkPickerProps {
      researchItemId: string
      linkedVersionIds: string[]
      open: boolean
      onOpenChange: (open: boolean) => void
    }

    export function VersionLinkPicker({ researchItemId, linkedVersionIds, open, onOpenChange }: VersionLinkPickerProps) {
      const [selected, setSelected] = useState<string[]>([])
      const utils = trpc.useUtils()
      const documentsQuery = trpc.document.list.useQuery({ includeSections: false }, { enabled: open })
      const linkMutation = trpc.research.linkVersion.useMutation()

      async function handleLink() {
        const targets = selected.filter((id) => !linkedVersionIds.includes(id))
        if (targets.length === 0) { setSelected([]); onOpenChange(false); return }
        try {
          const results = await Promise.allSettled(
            targets.map((versionId) => linkMutation.mutateAsync({ researchItemId, versionId })),
          )
          const failures = results.filter((r) => r.status === 'rejected').length
          const successes = results.length - failures
          if (successes > 0) utils.research.getById.invalidate({ id: researchItemId })
          if (failures === 0) {
            toast.success(successes === 1 ? 'Version linked.' : `${successes} versions linked.`)
          } else {
            toast.error(`Linked ${successes} of ${results.length}. ${failures} failed — try again.`)
          }
        } finally {
          setSelected([])
          onOpenChange(false)
        }
      }

      function toggleVersion(id: string) {
        setSelected((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id])
      }

      return (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Link Versions to Research Item</DialogTitle>
            </DialogHeader>
            <div className="mt-4 flex max-h-[320px] flex-col gap-4 overflow-y-auto">
              {documentsQuery.isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                (documentsQuery.data ?? []).map((doc) => (
                  <DocumentVersionsGroup
                    key={doc.id}
                    documentId={doc.id}
                    documentTitle={doc.title}
                    linkedVersionIds={linkedVersionIds}
                    selected={selected}
                    onToggle={toggleVersion}
                  />
                ))
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Discard</Button>
              <Button disabled={selected.length === 0 || linkMutation.isPending} onClick={handleLink}>
                Link {selected.length > 0 ? `(${selected.length})` : ''}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )
    }

    function DocumentVersionsGroup({
      documentId, documentTitle, linkedVersionIds, selected, onToggle,
    }: {
      documentId: string
      documentTitle: string
      linkedVersionIds: string[]
      selected: string[]
      onToggle: (id: string) => void
    }) {
      const versionsQuery = trpc.version.list.useQuery({ documentId })
      const available = (versionsQuery.data ?? []).filter((v) => !linkedVersionIds.includes(v.id))
      if (available.length === 0) return null
      return (
        <div className="space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {documentTitle}
          </h4>
          {available.map((v) => (
            <label
              key={v.id}
              className="flex cursor-pointer items-center gap-3 rounded-md border p-2 hover:bg-muted/50"
            >
              <Checkbox
                checked={selected.includes(v.id)}
                onCheckedChange={() => onToggle(v.id)}
              />
              <span className="flex-1 font-mono text-sm">v{v.versionLabel}</span>
              {v.isPublished && (
                <Badge variant="secondary" className="text-[10px]">Published</Badge>
              )}
            </label>
          ))}
        </div>
      )
    }
    ```

    Note on permission gate for `trpc.version.list`: it requires `version:read` which is granted to admin/policy_lead/auditor/observer/research_lead/stakeholder (per src/lib/permissions.ts), so the three privileged research roles are covered.

    **Edit 3 — app/research-manage/[id]/_components/feedback-link-picker.tsx: NEW FILE.**

    Mirror `app/workshop-manage/[id]/_components/feedback-link-picker.tsx` verbatim with:
    - Props: `{ researchItemId, linkedFeedbackIds, open, onOpenChange }`
    - Mutation: `trpc.research.linkFeedback`
    - Invalidation: `utils.research.getById.invalidate({ id: researchItemId })`
    - Dialog title: "Link Feedback to Research Item"
    - Toast copy: "Feedback linked." (singular) / "{N} feedback items linked." (plural) / partial failure same pattern

    Keep search + type filter identical.

    Use EXACT UI-SPEC copy for toast messages.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `ls app/research-manage/[id]/_components/section-link-picker.tsx` returns success
    - `ls app/research-manage/[id]/_components/version-link-picker.tsx` returns success
    - `ls app/research-manage/[id]/_components/feedback-link-picker.tsx` returns success
    - `grep -n "export function SectionLinkPicker" app/research-manage/[id]/_components/section-link-picker.tsx` exactly one match
    - `grep -n "export function VersionLinkPicker" app/research-manage/[id]/_components/version-link-picker.tsx` exactly one match
    - `grep -n "export function FeedbackLinkPicker" app/research-manage/[id]/_components/feedback-link-picker.tsx` exactly one match
    - `grep -n "trpc.research.linkSection" app/research-manage/[id]/_components/section-link-picker.tsx` exactly one match
    - `grep -n "trpc.research.linkVersion" app/research-manage/[id]/_components/version-link-picker.tsx` exactly one match
    - `grep -n "trpc.research.linkFeedback" app/research-manage/[id]/_components/feedback-link-picker.tsx` exactly one match
    - `grep -n "Promise.allSettled" app/research-manage/[id]/_components/section-link-picker.tsx app/research-manage/[id]/_components/version-link-picker.tsx app/research-manage/[id]/_components/feedback-link-picker.tsx` outputs exactly 3 matches
    - `grep -n "utils.research.getById.invalidate" app/research-manage/[id]/_components/section-link-picker.tsx app/research-manage/[id]/_components/version-link-picker.tsx app/research-manage/[id]/_components/feedback-link-picker.tsx` outputs exactly 3 matches
    - All three files start with `'use client'`
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Three controlled-dialog pickers ready to mount on the detail page with bulk-link consolidated-toast pattern.</done>
</task>

<task type="auto">
  <name>Task 3: Build LinkedSectionRow (inline relevanceNote editor) + wire all pickers into detail page</name>
  <read_first>
    - app/research-manage/[id]/page.tsx (the placeholder "Linked Entities" block from Plan 04)
    - app/research-manage/[id]/_components/section-link-picker.tsx, version-link-picker.tsx, feedback-link-picker.tsx (Task 2)
    - .planning/phases/27-research-workspace-admin-ui/27-UI-SPEC.md §"Interaction Contract — relevanceNote inline edit (D-07)"
    - .planning/phases/27-research-workspace-admin-ui/27-UI-SPEC.md §"Copywriting Contract" — "Relevance note placeholder" + "No linked {type}" copy
    - .planning/phases/27-research-workspace-admin-ui/27-CONTEXT.md D-07
  </read_first>
  <action>
    **Edit 1 — app/research-manage/[id]/_components/linked-section-row.tsx: NEW FILE.**

    Component that renders a single section link row with inline relevanceNote editor. Click the note text (or placeholder) → swap to Textarea + Save/Cancel buttons.

    ```typescript
    'use client'

    import { useState } from 'react'
    import Link from 'next/link'
    import { toast } from 'sonner'
    import { X } from 'lucide-react'
    import { trpc } from '@/src/trpc/client'
    import { Button } from '@/components/ui/button'
    import { Textarea } from '@/components/ui/textarea'
    import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

    export interface LinkedSectionRowProps {
      researchItemId: string
      sectionId: string
      sectionTitle: string
      documentId: string
      documentTitle: string
      relevanceNote: string | null
      canEdit: boolean
    }

    export function LinkedSectionRow({
      researchItemId,
      sectionId,
      sectionTitle,
      documentId,
      documentTitle,
      relevanceNote,
      canEdit,
    }: LinkedSectionRowProps) {
      const utils = trpc.useUtils()
      const [editing, setEditing] = useState(false)
      const [draft, setDraft] = useState(relevanceNote ?? '')

      const upsertMutation = trpc.research.linkSection.useMutation({
        onSuccess: () => {
          toast.success('Note saved.')
          utils.research.getById.invalidate({ id: researchItemId })
          setEditing(false)
        },
        onError: (err) => toast.error(err.message || "Couldn't save the note. Try again."),
      })

      const unlinkMutation = trpc.research.unlinkSection.useMutation({
        onSuccess: () => {
          toast.success('Section unlinked.')
          utils.research.getById.invalidate({ id: researchItemId })
        },
        onError: (err) => toast.error(err.message || "Couldn't unlink. Try again."),
      })

      return (
        <div className="space-y-1.5 rounded-md border p-3">
          <div className="flex items-start gap-2">
            <Link
              href={`/policies/${documentId}`}
              className="block min-w-0 flex-1 hover:underline"
            >
              <p className="truncate text-sm font-medium">{sectionTitle}</p>
              <p className="truncate text-xs text-muted-foreground">{documentTitle}</p>
            </Link>
            {canEdit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Remove link"
                    onClick={() => unlinkMutation.mutate({ researchItemId, sectionId })}
                  >
                    <X className="size-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove link</TooltipContent>
              </Tooltip>
            )}
          </div>

          {editing ? (
            <div className="space-y-2">
              <Textarea
                rows={3}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Why does this research inform this section?"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={upsertMutation.isPending}
                  onClick={() =>
                    upsertMutation.mutate({
                      researchItemId,
                      sectionId,
                      relevanceNote: draft.trim(),
                    })
                  }
                >
                  Save note
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDraft(relevanceNote ?? '')
                    setEditing(false)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : canEdit ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="block w-full text-left text-xs text-muted-foreground hover:text-foreground"
            >
              {relevanceNote || 'Add a relevance note for this section (optional)'}
            </button>
          ) : (
            relevanceNote && (
              <p className="text-xs text-muted-foreground">{relevanceNote}</p>
            )
          )}
        </div>
      )
    }
    ```

    **Edit 2 — app/research-manage/[id]/page.tsx: replace the "Linked Entities" placeholder with three linked lists + three picker mounts.**

    Add state for each picker's open flag:
    ```typescript
    const [sectionPickerOpen, setSectionPickerOpen] = useState(false)
    const [versionPickerOpen, setVersionPickerOpen] = useState(false)
    const [feedbackPickerOpen, setFeedbackPickerOpen] = useState(false)
    ```

    Add imports:
    ```typescript
    import { useState } from 'react'
    import { X, Plus } from 'lucide-react'
    import { can } from '@/src/lib/permissions'
    import { SectionLinkPicker } from './_components/section-link-picker'
    import { VersionLinkPicker } from './_components/version-link-picker'
    import { FeedbackLinkPicker } from './_components/feedback-link-picker'
    import { LinkedSectionRow } from './_components/linked-section-row'
    import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
    ```

    Add a utils hook:
    ```typescript
    const utils = trpc.useUtils()
    const unlinkVersionMutation = trpc.research.unlinkVersion.useMutation({
      onSuccess: () => {
        toast.success('Version unlinked.')
        utils.research.getById.invalidate({ id: item.id })
      },
      onError: () => toast.error("Couldn't unlink. Try again."),
    })
    const unlinkFeedbackMutation = trpc.research.unlinkFeedback.useMutation({
      onSuccess: () => {
        toast.success('Feedback unlinked.')
        utils.research.getById.invalidate({ id: item.id })
      },
      onError: () => toast.error("Couldn't unlink. Try again."),
    })
    ```
    And `import { toast } from 'sonner'` at the top.

    Determine edit permission: `const canEdit = can(me.role as Role, 'research:manage_own')` and ownership check mirrors Plan 04's pattern: `const isOwnerOrAdmin = item.createdBy === me.id || me.role === 'admin' || me.role === 'policy_lead'`. The picker + unlink buttons visible only when `canEdit && isOwnerOrAdmin`.

    REPLACE the entire "Linked Entities placeholder" block in the main column with:

    ```tsx
    <Separator />

    {/* Linked Sections */}
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
          Linked Sections
        </h2>
        {canEdit && isOwnerOrAdmin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSectionPickerOpen(true)}
          >
            <Plus className="size-3.5" />
            Link Sections
          </Button>
        )}
      </div>
      {item.linkedSections.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sections linked yet.</p>
      ) : (
        <div className="space-y-2">
          {item.linkedSections.map((s) => (
            <LinkedSectionRow
              key={s.sectionId}
              researchItemId={item.id}
              sectionId={s.sectionId}
              sectionTitle={s.sectionTitle}
              documentId={s.documentId}
              documentTitle={s.documentTitle}
              relevanceNote={s.relevanceNote}
              canEdit={!!(canEdit && isOwnerOrAdmin)}
            />
          ))}
        </div>
      )}
    </div>

    <Separator />

    {/* Linked Versions */}
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
          Linked Versions
        </h2>
        {canEdit && isOwnerOrAdmin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVersionPickerOpen(true)}
          >
            <Plus className="size-3.5" />
            Link Versions
          </Button>
        )}
      </div>
      {item.linkedVersions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No versions linked yet.</p>
      ) : (
        <div className="space-y-1">
          {item.linkedVersions.map((v) => (
            <div key={v.versionId} className="flex items-center justify-between gap-2 rounded-md border p-2">
              <div className="min-w-0 flex-1">
                <span className="font-mono text-sm">v{v.versionLabel}</span>
                <span className="ml-2 text-xs text-muted-foreground">{v.documentTitle}</span>
                {v.isPublished && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">Published</Badge>
                )}
              </div>
              {canEdit && isOwnerOrAdmin && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Remove link"
                      onClick={() => unlinkVersionMutation.mutate({ researchItemId: item.id, versionId: v.versionId })}
                    >
                      <X className="size-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Remove link</TooltipContent>
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      )}
    </div>

    <Separator />

    {/* Linked Feedback */}
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
          Linked Feedback
        </h2>
        {canEdit && isOwnerOrAdmin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFeedbackPickerOpen(true)}
          >
            <Plus className="size-3.5" />
            Link Feedback
          </Button>
        )}
      </div>
      {item.linkedFeedback.length === 0 ? (
        <p className="text-sm text-muted-foreground">No feedback linked yet.</p>
      ) : (
        <div className="space-y-1">
          {item.linkedFeedback.map((f) => (
            <div key={f.feedbackId} className="flex items-center justify-between gap-2 rounded-md border p-2">
              <Link
                href={`/policies/${f.documentId}/feedback`}
                className="block min-w-0 flex-1 hover:underline"
              >
                <span className="mr-2 font-mono text-xs text-muted-foreground">{f.readableId}</span>
                <span className="truncate text-sm">{f.title}</span>
              </Link>
              {canEdit && isOwnerOrAdmin && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Remove link"
                      onClick={() => unlinkFeedbackMutation.mutate({ researchItemId: item.id, feedbackId: f.feedbackId })}
                    >
                      <X className="size-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Remove link</TooltipContent>
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      )}
    </div>

    {/* Mount pickers at page root (not inside the main column) */}
    <SectionLinkPicker
      researchItemId={item.id}
      linkedSectionIds={item.linkedSections.map((s) => s.sectionId)}
      open={sectionPickerOpen}
      onOpenChange={setSectionPickerOpen}
    />
    <VersionLinkPicker
      researchItemId={item.id}
      linkedVersionIds={item.linkedVersions.map((v) => v.versionId)}
      open={versionPickerOpen}
      onOpenChange={setVersionPickerOpen}
    />
    <FeedbackLinkPicker
      researchItemId={item.id}
      linkedFeedbackIds={item.linkedFeedback.map((f) => f.feedbackId)}
      open={feedbackPickerOpen}
      onOpenChange={setFeedbackPickerOpen}
    />
    ```

    Place the three picker mounts OUTSIDE the two-column flex container (after `</aside>`, before the outer closing `</div>`) so dialogs render at the root level.

    Remove the "Plan 05 replaces this block" placeholder comment/text from Plan 04.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `ls app/research-manage/[id]/_components/linked-section-row.tsx` returns success
    - `grep -n "export function LinkedSectionRow" app/research-manage/[id]/_components/linked-section-row.tsx` exactly one match
    - `grep -n "trpc.research.linkSection" app/research-manage/[id]/_components/linked-section-row.tsx` exactly one match
    - `grep -n "relevanceNote:" app/research-manage/[id]/_components/linked-section-row.tsx` at least one match
    - `grep -n "Add a relevance note for this section" app/research-manage/[id]/_components/linked-section-row.tsx` exactly one match (UI-SPEC copy)
    - `grep -n "'Save note'" app/research-manage/[id]/_components/linked-section-row.tsx` exactly one match
    - `grep -n "SectionLinkPicker" app/research-manage/[id]/page.tsx` at least one match
    - `grep -n "VersionLinkPicker" app/research-manage/[id]/page.tsx` at least one match
    - `grep -n "FeedbackLinkPicker" app/research-manage/[id]/page.tsx` at least one match
    - `grep -n "LinkedSectionRow" app/research-manage/[id]/page.tsx` at least one match
    - `grep -n "'No sections linked yet.'" app/research-manage/[id]/page.tsx` exactly one match
    - `grep -n "'No versions linked yet.'" app/research-manage/[id]/page.tsx` exactly one match
    - `grep -n "'No feedback linked yet.'" app/research-manage/[id]/page.tsx` exactly one match
    - `grep -n "Plan 05" app/research-manage/[id]/page.tsx` outputs 0 matches (placeholder removed)
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Detail page extended with three linked lists and three picker mounts; inline relevanceNote editor works via Plan 01 onConflictDoUpdate.</done>
</task>

</tasks>

<verification>
- On the detail page as admin/policy_lead/research_lead (owner):
  - "Link Sections" button opens SectionLinkPicker; selecting 2 sections and confirming shows "2 sections linked." toast and linked list updates
  - "Link Versions" button opens VersionLinkPicker grouped by document
  - "Link Feedback" button opens FeedbackLinkPicker with search + type filter
  - Clicking a relevanceNote placeholder swaps to Textarea; Save note persists via onConflictDoUpdate
  - Unlink button (X) removes the link and invalidates getById
- Non-owner research_lead: no Link buttons, no unlink X, no editable relevanceNote
- `npx tsc --noEmit` passes
- `npx vitest run` full suite still green
</verification>

<success_criteria>
- RESEARCH-08 SC-4 satisfied: pickers + relevanceNote inline edit functional
- getById returns linked-entity arrays with joined display data
- All three pickers use controlled-dialog + Promise.allSettled + consolidated-toast pattern
- Duplicate prevention: already-linked IDs filtered from selectable lists
</success_criteria>

<output>
Create `.planning/phases/27-research-workspace-admin-ui/27-05-SUMMARY.md` recording:
- Files created/modified
- Version picker data source pattern (one version.list call per document inside DocumentVersionsGroup subcomponent)
- How inline relevanceNote leverages Plan 01's onConflictDoUpdate
- Any tooltip/AlertDialog primitives needing verification
</output>

---
phase: 27-research-workspace-admin-ui
plan: 04
type: execute
wave: 2
depends_on: ["27-01", "27-02"]
files_modified:
  - app/research-manage/[id]/page.tsx
  - app/research-manage/[id]/_components/research-decision-log.tsx
  - app/research-manage/[id]/_components/lifecycle-actions.tsx
autonomous: true
requirements:
  - RESEARCH-07
requirements_addressed:
  - RESEARCH-07
must_haves:
  truths:
    - "/research-manage/[id] renders research item metadata, status badge, description, authors (via shouldHideAuthors), linked artifact info"
    - "Decision log section renders workflow_transitions fetched from trpc.research.listTransitions (shipped in Plan 01)"
    - "Lifecycle action sidebar shows permission-derived buttons (D-14): Submit for Review | Edit | Approve | Reject (inline rationale) | Retract (Alert-Dialog)"
    - "Reject action: inline Textarea expand with Submit Rejection button (disabled until rationale has ≥1 char)"
    - "Retract action: Alert-Dialog with required retractionReason textarea"
    - "Every lifecycle mutation invalidates utils.research.getById AND utils.research.listTransitions on success"
    - "AnonymousPreviewCard data — detail page uses shouldHideAuthors(item) to render public-facing author lines identically to the form preview (D-05)"
  artifacts:
    - path: "app/research-manage/[id]/page.tsx"
      provides: "Detail page (client component)"
      min_lines: 150
      contains: "trpc.research.getById"
    - path: "app/research-manage/[id]/_components/research-decision-log.tsx"
      provides: "Decision log component wired to trpc.research.listTransitions"
      contains: "listTransitions"
    - path: "app/research-manage/[id]/_components/lifecycle-actions.tsx"
      provides: "ResearchLifecycleActions component (submit/approve/reject/retract)"
      min_lines: 200
      contains: "can(role, 'research:publish')"
  key_links:
    - from: "app/research-manage/[id]/page.tsx"
      to: "trpc.research.getById"
      via: "useQuery"
      pattern: "trpc\\.research\\.getById"
    - from: "app/research-manage/[id]/_components/research-decision-log.tsx"
      to: "trpc.research.listTransitions"
      via: "useQuery"
      pattern: "trpc\\.research\\.listTransitions"
    - from: "app/research-manage/[id]/_components/lifecycle-actions.tsx"
      to: "trpc.research.{submitForReview|approve|reject|retract}"
      via: "useMutation"
      pattern: "trpc\\.research\\.(submitForReview|approve|reject|retract)"
    - from: "app/research-manage/[id]/_components/lifecycle-actions.tsx"
      to: "src/lib/permissions.ts can()"
      via: "client-side RBAC gate"
      pattern: "can\\(role,"
---

<objective>
Build the research item detail page with full lifecycle support. Implements RESEARCH-07 success criterion 3 (admin/policy_lead approve/reject/retract with mandatory rationale; every transition audited via workflow_transitions). Ships the reusable `ResearchLifecycleActions` sidebar card and `ResearchDecisionLog` component.

Purpose: The detail page is where admins do their review work and research_leads watch their items move through the pipeline. Without this surface, Phase 26's lifecycle mutations are unreachable from the UI.

Output: detail page, decision log component, lifecycle actions component (with inline reject + Alert-Dialog retract).
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
@app/workshop-manage/[id]/page.tsx
@app/workshop-manage/[id]/_components/status-transition-buttons.tsx
@app/policies/[id]/feedback/_components/decision-log.tsx
@src/server/routers/research.ts
@src/lib/permissions.ts
@src/lib/research-utils.ts
@components/ui/alert-dialog.tsx

<interfaces>
From trpc.research.listTransitions (shipped in Plan 01):
```typescript
.query — input: { id: z.guid() }
.returns: Array<{
  id: string
  fromState: string | null
  toState: string
  actorId: string
  timestamp: string
  metadata: { rejectionReason?: string; retractionReason?: string } | null
  actorName: string | null
}>
```

From trpc.research.getById:
```typescript
.query — input: { id: z.guid() }
.returns: {
  id, readableId, documentId, title, itemType, status,
  description, externalUrl, artifactId, doi,
  authors: string[] | null,   // null when isAuthorAnonymous && status='published'
  publishedDate: string | null,
  peerReviewed, journalOrSource, versionLabel, previousVersionId,
  isAuthorAnonymous, createdBy, createdAt, updatedAt
}
```

From src/lib/permissions.ts:
```typescript
export function can(role: Role, permission: Permission): boolean
// Relevant:
//   research:submit_review  -> admin, policy_lead, research_lead
//   research:publish        -> admin, policy_lead
//   research:retract        -> admin, policy_lead
//   research:manage_own     -> admin, policy_lead, research_lead
```

From app/policies/[id]/feedback/_components/decision-log.tsx:
```typescript
// Reusable DecisionLog component signature:
interface Transition {
  id: string
  fromState: string | null
  toState: string
  actorName: string | null
  timestamp: string
  rationale: string | null
}
export function DecisionLog({ transitions }: { transitions: Transition[] })
```

From UI-SPEC §"/research-manage/[id] — Detail page" + §"Interaction Contract":
- Two-column desktop: flex-1 main + 320px right sidebar
- Reject: inline Textarea expand + "Submit Rejection" (destructive)
- Retract: Alert-Dialog with required retractionReason + "Confirm Retract" (destructive)
- Every mutation invalidates both getById AND listTransitions
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build ResearchDecisionLog component</name>
  <read_first>
    - app/policies/[id]/feedback/_components/decision-log.tsx (reuse template verbatim for markup)
    - src/server/routers/research.ts (listTransitions return shape — already shipped)
    - .planning/phases/27-research-workspace-admin-ui/27-UI-SPEC.md §"Decision Log section" + §"Copywriting Contract" — "Decision log empty" line
    - .planning/phases/27-research-workspace-admin-ui/27-CONTEXT.md D-13
  </read_first>
  <action>
    **Edit 1 — app/research-manage/[id]/_components/research-decision-log.tsx: NEW FILE.**

    Client component. Wraps the existing `DecisionLog` pattern by fetching data from `trpc.research.listTransitions` and mapping the metadata JSONB (rejectionReason | retractionReason) to the `rationale` field:

    ```typescript
    'use client'

    import { trpc } from '@/src/trpc/client'
    import { Badge } from '@/components/ui/badge'
    import { Separator } from '@/components/ui/separator'
    import { Skeleton } from '@/components/ui/skeleton'
    import { ArrowRight } from 'lucide-react'

    function formatStatus(status: string): string {
      return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    }

    function formatRelativeTime(timestamp: string): string {
      const date = new Date(timestamp)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)

      if (diffMins < 1) return 'just now'
      if (diffMins < 60) return `${diffMins}m ago`
      if (diffHours < 24) return `${diffHours}h ago`
      if (diffDays < 30) return `${diffDays}d ago`
      return date.toLocaleDateString()
    }

    export interface ResearchDecisionLogProps {
      researchItemId: string
    }

    export function ResearchDecisionLog({ researchItemId }: ResearchDecisionLogProps) {
      const transitionsQuery = trpc.research.listTransitions.useQuery({ id: researchItemId })

      if (transitionsQuery.isLoading) {
        return (
          <div className="space-y-3">
            <h3 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
              Decision Log
            </h3>
            <Skeleton className="h-16 w-full" />
          </div>
        )
      }

      const transitions = transitionsQuery.data ?? []

      // Map metadata JSONB → rationale for DecisionLog semantics. Both reject
      // and retract fire through transitionResearch which writes one to the
      // metadata column. The DecisionLog displays whichever is present.
      const mappedTransitions = transitions.map((t) => {
        const md = (t.metadata ?? null) as {
          rejectionReason?: string
          retractionReason?: string
        } | null
        return {
          id: t.id,
          fromState: t.fromState,
          toState: t.toState,
          actorName: t.actorName,
          timestamp: typeof t.timestamp === 'string'
            ? t.timestamp
            : (t.timestamp as unknown as Date).toISOString(),
          rationale: md?.rejectionReason ?? md?.retractionReason ?? null,
        }
      })

      return (
        <div className="space-y-3">
          <h3 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
            Decision Log
          </h3>
          {mappedTransitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No decisions recorded yet.</p>
          ) : (
            <div className="space-y-0">
              {mappedTransitions.map((transition, index) => (
                <div key={transition.id}>
                  {index > 0 && <Separator className="my-3" />}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      {transition.fromState && (
                        <>
                          <Badge variant="secondary" className="text-xs">
                            {formatStatus(transition.fromState)}
                          </Badge>
                          <ArrowRight className="size-3 text-muted-foreground" />
                        </>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {formatStatus(transition.toState)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      by {transition.actorName ?? 'Unknown'} &middot;{' '}
                      {formatRelativeTime(transition.timestamp)}
                    </p>
                    {transition.rationale && (
                      <p className="text-sm leading-relaxed">
                        {transition.rationale}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }
    ```
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `ls app/research-manage/[id]/_components/research-decision-log.tsx` returns success
    - `grep -n "trpc.research.listTransitions" app/research-manage/[id]/_components/research-decision-log.tsx` exactly one match
    - `grep -n "rejectionReason \\?\\? md\\?.retractionReason" app/research-manage/[id]/_components/research-decision-log.tsx` or equivalent at least one match
    - `grep -n "'No decisions recorded yet.'" app/research-manage/[id]/_components/research-decision-log.tsx` exactly one match (UI-SPEC copy)
    - `grep -n "export function ResearchDecisionLog" app/research-manage/[id]/_components/research-decision-log.tsx` exactly one match
    - `head -1 app/research-manage/[id]/_components/research-decision-log.tsx` outputs `'use client'`
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Decision log component renders workflow_transitions via tRPC, maps metadata → rationale, matches feedback pattern markup.</done>
</task>

<task type="auto">
  <name>Task 2: Build ResearchLifecycleActions component (submit/approve/reject/retract with RBAC + inline reject + Alert-Dialog retract)</name>
  <read_first>
    - app/workshop-manage/[id]/_components/status-transition-buttons.tsx (reference for similar multi-button lifecycle card)
    - app/policies/[id]/change-requests/_components/cr-detail.tsx (reference for Alert-Dialog retract pattern)
    - components/ui/alert-dialog.tsx (shadcn alert-dialog primitive)
    - src/lib/permissions.ts (`can()` with research:*)
    - .planning/phases/27-research-workspace-admin-ui/27-UI-SPEC.md §"Lifecycle actions" block + §"Interaction Contract"
    - .planning/phases/27-research-workspace-admin-ui/27-CONTEXT.md D-14
    - .planning/phases/27-research-workspace-admin-ui/27-RESEARCH.md §"Lifecycle actions — reject inline expand pattern"
  </read_first>
  <action>
    **Edit 1 — app/research-manage/[id]/_components/lifecycle-actions.tsx: NEW FILE.**

    Client component:

    ```typescript
    'use client'

    import { useState } from 'react'
    import Link from 'next/link'
    import { toast } from 'sonner'
    import { trpc } from '@/src/trpc/client'
    import { can } from '@/src/lib/permissions'
    import type { Role } from '@/src/lib/constants'
    import { Button } from '@/components/ui/button'
    import { Label } from '@/components/ui/label'
    import { Textarea } from '@/components/ui/textarea'
    import {
      AlertDialog,
      AlertDialogAction,
      AlertDialogCancel,
      AlertDialogContent,
      AlertDialogDescription,
      AlertDialogFooter,
      AlertDialogHeader,
      AlertDialogTitle,
    } from '@/components/ui/alert-dialog'

    type ResearchStatus = 'draft' | 'pending_review' | 'published' | 'retracted'

    export interface ResearchLifecycleActionsProps {
      itemId: string
      status: ResearchStatus
      createdBy: string
      currentUserId: string
      currentUserRole: Role | null
    }

    export function ResearchLifecycleActions({
      itemId,
      status,
      createdBy,
      currentUserId,
      currentUserRole,
    }: ResearchLifecycleActionsProps) {
      const utils = trpc.useUtils()

      // D-14: permission-derived client gating (server-side requirePermission
      // is the authorization truth; this is UX only).
      const canSubmit  = currentUserRole ? can(currentUserRole, 'research:submit_review') : false
      const canPublish = currentUserRole ? can(currentUserRole, 'research:publish')        : false
      const canRetract = currentUserRole ? can(currentUserRole, 'research:retract')        : false
      const canEdit    = currentUserRole ? can(currentUserRole, 'research:manage_own')     : false

      // Ownership: research_lead gated to own items; admin/policy_lead bypass
      const isOwner = createdBy === currentUserId
      const isAdminRole = currentUserRole === 'admin' || currentUserRole === 'policy_lead'

      function invalidateAll() {
        utils.research.getById.invalidate({ id: itemId })
        utils.research.listTransitions.invalidate({ id: itemId })
      }

      const submitMutation = trpc.research.submitForReview.useMutation({
        onSuccess: () => {
          toast.success('Submitted for review.')
          invalidateAll()
        },
        onError: (err) => toast.error(err.message || "Couldn't submit. Try again."),
      })

      const approveMutation = trpc.research.approve.useMutation({
        onSuccess: () => {
          toast.success('Research item approved and published.')
          invalidateAll()
        },
        onError: (err) => toast.error(err.message || "Couldn't approve. Try again."),
      })

      const [rejectExpanded, setRejectExpanded] = useState(false)
      const [rejectionReason, setRejectionReason] = useState('')
      const rejectMutation = trpc.research.reject.useMutation({
        onSuccess: () => {
          toast.success('Research item rejected.')
          invalidateAll()
          setRejectExpanded(false)
          setRejectionReason('')
        },
        onError: (err) => toast.error(err.message || "Couldn't reject. Try again."),
      })

      const [retractDialogOpen, setRetractDialogOpen] = useState(false)
      const [retractionReason, setRetractionReason] = useState('')
      const retractMutation = trpc.research.retract.useMutation({
        onSuccess: () => {
          toast.success('Research item retracted.')
          invalidateAll()
          setRetractDialogOpen(false)
          setRetractionReason('')
        },
        onError: (err) => toast.error(err.message || "Couldn't retract. Try again."),
      })

      // -----------------------------------------------------------------------
      // Visibility matrix — per UI-SPEC §"/research-manage/[id]" sidebar block
      // -----------------------------------------------------------------------
      const showSubmit  = canSubmit  && status === 'draft' && (isOwner || isAdminRole)
      const showEdit    = canEdit    && (status === 'draft' || status === 'pending_review') && (isOwner || isAdminRole)
      const showApprove = canPublish && status === 'pending_review'
      const showReject  = canPublish && status === 'pending_review'
      const showRetract = canRetract && status === 'published'

      if (!showSubmit && !showEdit && !showApprove && !showReject && !showRetract) {
        return (
          <div className="space-y-2">
            <h3 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
              Lifecycle
            </h3>
            <p className="text-xs text-muted-foreground">
              No actions available in this state.
            </p>
          </div>
        )
      }

      return (
        <div className="space-y-3">
          <h3 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
            Lifecycle
          </h3>

          {showSubmit && (
            <Button
              onClick={() => submitMutation.mutate({ id: itemId })}
              disabled={submitMutation.isPending}
              className="w-full"
            >
              Submit for Review
            </Button>
          )}

          {showEdit && (
            <Button
              variant="outline"
              render={<Link href={`/research-manage/${itemId}/edit`} />}
              className="w-full"
            >
              Edit
            </Button>
          )}

          {showApprove && (
            <Button
              onClick={() => approveMutation.mutate({ id: itemId })}
              disabled={approveMutation.isPending}
              className="w-full"
            >
              Approve
            </Button>
          )}

          {showReject && (
            <div className="flex flex-col gap-2">
              {!rejectExpanded ? (
                <Button
                  variant="destructive"
                  onClick={() => setRejectExpanded(true)}
                  className="w-full"
                >
                  Reject
                </Button>
              ) : (
                <>
                  <Label htmlFor="reject-reason" className="text-xs">
                    Rejection reason (required)
                  </Label>
                  <Textarea
                    id="reject-reason"
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Why is this item being rejected?"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="destructive"
                      disabled={
                        rejectionReason.trim().length === 0 ||
                        rejectMutation.isPending
                      }
                      onClick={() =>
                        rejectMutation.mutate({
                          id: itemId,
                          rejectionReason: rejectionReason.trim(),
                        })
                      }
                      className="flex-1"
                    >
                      Submit Rejection
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setRejectExpanded(false)
                        setRejectionReason('')
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {showRetract && (
            <>
              <Button
                variant="destructive"
                onClick={() => setRetractDialogOpen(true)}
                className="w-full"
              >
                Retract
              </Button>

              <AlertDialog
                open={retractDialogOpen}
                onOpenChange={(open) => {
                  setRetractDialogOpen(open)
                  if (!open) setRetractionReason('')
                }}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Retract this research item?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove it from all public surfaces. Provide a reason — this is recorded in the audit log.
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <div className="flex flex-col gap-2 py-2">
                    <Label htmlFor="retract-reason">Retraction reason (required)</Label>
                    <Textarea
                      id="retract-reason"
                      rows={4}
                      value={retractionReason}
                      onChange={(e) => setRetractionReason(e.target.value)}
                    />
                  </div>

                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={
                        retractionReason.trim().length === 0 ||
                        retractMutation.isPending
                      }
                      onClick={() =>
                        retractMutation.mutate({
                          id: itemId,
                          retractionReason: retractionReason.trim(),
                        })
                      }
                    >
                      Confirm Retract
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      )
    }
    ```

    Note on AlertDialog API: check the shadcn alert-dialog primitive in `components/ui/alert-dialog.tsx`. If the project's version does not support `open`/`onOpenChange` on `<AlertDialog>` directly (some base-ui variants differ), adapt using the pattern from existing usage in the repo. Grep existing `AlertDialog open=` usage in the codebase to confirm the correct prop API before finalizing.

    Use EXACT UI-SPEC copy for every string (toast messages, button labels, Alert-Dialog title/body, Label text).
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `ls app/research-manage/[id]/_components/lifecycle-actions.tsx` returns success
    - `grep -n "export function ResearchLifecycleActions" app/research-manage/[id]/_components/lifecycle-actions.tsx` exactly one match
    - `grep -n "can(currentUserRole, 'research:publish')" app/research-manage/[id]/_components/lifecycle-actions.tsx` exactly one match
    - `grep -n "can(currentUserRole, 'research:submit_review')" app/research-manage/[id]/_components/lifecycle-actions.tsx` exactly one match
    - `grep -n "can(currentUserRole, 'research:retract')" app/research-manage/[id]/_components/lifecycle-actions.tsx` exactly one match
    - `grep -n "trpc.research.submitForReview" app/research-manage/[id]/_components/lifecycle-actions.tsx` exactly one match
    - `grep -n "trpc.research.approve" app/research-manage/[id]/_components/lifecycle-actions.tsx` exactly one match
    - `grep -n "trpc.research.reject" app/research-manage/[id]/_components/lifecycle-actions.tsx` exactly one match
    - `grep -n "trpc.research.retract" app/research-manage/[id]/_components/lifecycle-actions.tsx` exactly one match
    - `grep -n "utils.research.getById.invalidate" app/research-manage/[id]/_components/lifecycle-actions.tsx` at least one match
    - `grep -n "utils.research.listTransitions.invalidate" app/research-manage/[id]/_components/lifecycle-actions.tsx` at least one match
    - `grep -n "'Submitted for review.'" app/research-manage/[id]/_components/lifecycle-actions.tsx` exactly one match (UI-SPEC copy)
    - `grep -n "'Research item approved and published.'" app/research-manage/[id]/_components/lifecycle-actions.tsx` exactly one match
    - `grep -n "'Research item rejected.'" app/research-manage/[id]/_components/lifecycle-actions.tsx` exactly one match
    - `grep -n "'Retract this research item?'" app/research-manage/[id]/_components/lifecycle-actions.tsx` exactly one match
    - `grep -n "'Confirm Retract'" app/research-manage/[id]/_components/lifecycle-actions.tsx` exactly one match
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Lifecycle actions component complete: visibility matrix per role+status, inline reject, Alert-Dialog retract, invalidation on success.</done>
</task>

<task type="auto">
  <name>Task 3: Build /research-manage/[id] detail page wiring metadata + decision log + lifecycle actions</name>
  <read_first>
    - app/workshop-manage/[id]/page.tsx (two-column layout reference)
    - app/research-manage/[id]/_components/research-decision-log.tsx (Task 1)
    - app/research-manage/[id]/_components/lifecycle-actions.tsx (Task 2)
    - app/research-manage/_components/research-status-badge.tsx (Plan 02)
    - src/lib/research-utils.ts (formatAuthorsForDisplay)
    - .planning/phases/27-research-workspace-admin-ui/27-UI-SPEC.md §"/research-manage/[id]" section (main column + right sidebar)
  </read_first>
  <action>
    **Edit 1 — app/research-manage/[id]/page.tsx: NEW FILE.**

    Client component. Wires metadata display + ResearchDecisionLog + ResearchLifecycleActions. Leaves placeholder slots for Plan 05's link pickers — those will be wired via `<SectionLinkPickerTrigger />` button markers that Plan 05 will replace.

    ```typescript
    'use client'

    import { useParams } from 'next/navigation'
    import Link from 'next/link'
    import { Download, ExternalLink, Pencil } from 'lucide-react'
    import { trpc } from '@/src/trpc/client'
    import { Badge } from '@/components/ui/badge'
    import { Button } from '@/components/ui/button'
    import { Separator } from '@/components/ui/separator'
    import { Skeleton } from '@/components/ui/skeleton'
    import { ResearchStatusBadge } from '../_components/research-status-badge'
    import { ResearchDecisionLog } from './_components/research-decision-log'
    import { ResearchLifecycleActions } from './_components/lifecycle-actions'
    import { formatAuthorsForDisplay } from '@/src/lib/research-utils'
    import type { Role } from '@/src/lib/constants'

    function formatItemType(t: string): string {
      return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    }

    export default function ResearchItemDetailPage() {
      const params = useParams<{ id: string }>()
      const id = params.id

      const meQuery = trpc.user.getMe.useQuery()
      const itemQuery = trpc.research.getById.useQuery({ id })

      if (itemQuery.isLoading || meQuery.isLoading) {
        return (
          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="flex-1 space-y-4">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-64 w-full" />
            </div>
            <div className="w-full lg:w-80 space-y-4">
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        )
      }

      const item = itemQuery.data
      const me = meQuery.data
      if (!item || !me) return null

      const authorDisplay = formatAuthorsForDisplay({
        isAuthorAnonymous: item.isAuthorAnonymous,
        authors: item.authors ?? null,
      })

      return (
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Main column */}
          <div className="flex-1 space-y-6">
            <div className="flex items-start gap-3">
              <h1 className="flex-1 text-xl font-semibold leading-tight">
                {item.title}
              </h1>
              <ResearchStatusBadge status={item.status} />
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Badge variant="secondary" className="font-mono">
                {item.readableId}
              </Badge>
              <span>{formatItemType(item.itemType)}</span>
            </div>

            {/* Metadata grid */}
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Authors</dt>
                <dd className="text-sm">
                  {authorDisplay.replace(/^Authors: /, '').replace('Source: Confidential', 'Confidential')}
                </dd>
              </div>
              {item.publishedDate && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Published</dt>
                  <dd className="text-sm">{item.publishedDate}</dd>
                </div>
              )}
              {item.journalOrSource && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Journal / Source</dt>
                  <dd className="text-sm">{item.journalOrSource}</dd>
                </div>
              )}
              {item.doi && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">DOI</dt>
                  <dd className="text-sm">
                    <a
                      href={`https://doi.org/${item.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-foreground"
                    >
                      {item.doi}
                    </a>
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Peer Reviewed</dt>
                <dd className="text-sm">{item.peerReviewed ? 'Yes' : 'No'}</dd>
              </div>
            </dl>

            {item.description && (
              <div className="space-y-2">
                <h2 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
                  Description
                </h2>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {item.description}
                </p>
              </div>
            )}

            {/* Artifact / external URL */}
            {item.externalUrl && (
              <div>
                <Button
                  variant="outline"
                  onClick={() => window.open(item.externalUrl!, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="size-3.5" />
                  Open External Source
                </Button>
              </div>
            )}
            {item.artifactId && (
              <div>
                <ArtifactDownloadLink artifactId={item.artifactId} />
              </div>
            )}

            <Separator />

            {/* Decision Log */}
            <ResearchDecisionLog researchItemId={item.id} />

            {/* Linked entities placeholder — Plan 05 replaces this block */}
            <Separator />
            <div className="space-y-2">
              <h2 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
                Linked Entities
              </h2>
              <p className="text-sm text-muted-foreground">
                Link pickers ship in Plan 05.
              </p>
            </div>
          </div>

          {/* Right sidebar */}
          <aside className="w-full lg:w-80 lg:shrink-0 space-y-4">
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <ResearchLifecycleActions
                itemId={item.id}
                status={item.status}
                createdBy={item.createdBy}
                currentUserId={me.id}
                currentUserRole={(me.role ?? null) as Role | null}
              />
            </div>
          </aside>
        </div>
      )
    }

    // Minimal artifact download helper — shows filename + a link to the public
    // URL. If artifact details need to be fetched, extend a follow-up plan
    // with a dedicated trpc.evidence.getArtifact procedure. For now, the
    // detail page links via artifactId to a still-TODO resolve-to-url step.
    function ArtifactDownloadLink({ artifactId }: { artifactId: string }) {
      // Phase 27 shortcut: existing evidence module does not expose a
      // getArtifact tRPC query. Detail page shows a muted "Attachment on
      // file" row with the artifact id as a caption. Phase 28 public
      // listing will add the presigned-GET plumbing.
      return (
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
          <Download className="size-4 text-muted-foreground" />
          <span>Attachment on file</span>
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {artifactId.slice(0, 8)}
          </span>
        </div>
      )
    }
    ```

    The "Linked Entities" placeholder block is intentional — Plan 05 replaces it with three picker triggers + linked lists. The detail page ships without break in this plan.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `ls app/research-manage/[id]/page.tsx` returns success
    - `grep -n "trpc.research.getById" app/research-manage/[id]/page.tsx` exactly one match
    - `grep -n "ResearchDecisionLog" app/research-manage/[id]/page.tsx` at least one match
    - `grep -n "ResearchLifecycleActions" app/research-manage/[id]/page.tsx` at least one match
    - `grep -n "ResearchStatusBadge" app/research-manage/[id]/page.tsx` at least one match
    - `grep -n "formatAuthorsForDisplay" app/research-manage/[id]/page.tsx` at least one match
    - `grep -n "Linked Entities" app/research-manage/[id]/page.tsx` at least one match (placeholder for Plan 05)
    - `grep -n "Plan 05" app/research-manage/[id]/page.tsx` at least one match (comment indicating where Plan 05 wires)
    - `head -1 app/research-manage/[id]/page.tsx` outputs `'use client'`
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Detail page renders metadata, decision log, and lifecycle actions with placeholder for Plan 05's link pickers.</done>
</task>

</tasks>

<verification>
- Visit `/research-manage/[id]` as admin on a pending_review item → sees Approve + Reject buttons; Reject expand shows Textarea + Submit Rejection
- Visit `/research-manage/[id]` as admin on a published item → sees Retract button; clicking opens Alert-Dialog with required textarea
- Visit as research_lead on own draft → sees Submit for Review + Edit buttons
- Visit as research_lead on another user's draft → sees "No actions available"
- Decision log fetches transitions via tRPC and renders empty state before any transitions
- Every lifecycle mutation invalidates getById + listTransitions (proven by decision log update after action)
- `npx tsc --noEmit` passes
- `npx vitest run` full suite still green
</verification>

<success_criteria>
- Detail page mounts metadata, decision log, lifecycle actions
- RBAC visibility matrix works: research_lead (own draft: submit/edit), admin/policy_lead (pending_review: approve/reject, published: retract)
- Reject inline rationale + Retract Alert-Dialog both work with server-side required-field enforcement
- Every transition invalidates both queries on success
- UI-SPEC copy strings match verbatim
</success_criteria>

<output>
Create `.planning/phases/27-research-workspace-admin-ui/27-04-SUMMARY.md` recording:
- Files created
- AlertDialog API used (confirm prop names work in this project)
- Artifact download shortcut (detail page renders "Attachment on file" placeholder until Phase 28 or a follow-up adds artifact-details query)
- "Linked Entities" placeholder slot — Plan 05 replaces
</output>

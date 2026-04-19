'use client'

import { useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { trpc } from '@/src/trpc/client'
import { MilestoneEntityTab } from './milestone-entity-tab'

interface MilestoneDetailTabsProps {
  milestoneId: string
  documentId: string
  isReadOnly: boolean
  onMutated: () => void
}

export function MilestoneDetailTabs({
  milestoneId,
  documentId,
  isReadOnly,
  onMutated,
}: MilestoneDetailTabsProps) {
  // Versions: scoped to document via version.list({ documentId })
  const versionsQuery = trpc.version.list.useQuery({ documentId })

  // D2: Workshops are a global resource (no documentId column). Show workshops
  // that are either unattached OR already linked to a milestone belonging to
  // this document, plus any workshop already attached to this specific
  // milestone. That matches the "gate attach by policy match" intent.
  const workshopsQuery = trpc.workshop.list.useQuery({ filter: 'all' })
  const milestonesForDocQuery = trpc.milestone.list.useQuery({ documentId })

  // Feedback: scoped to document via feedback.list({ documentId })
  const feedbackQuery = trpc.feedback.list.useQuery({ documentId })

  // D1: Evidence is now listed via a document-scoped join query that returns
  // the `milestoneId` so we can compute the `attached` flag per row.
  const evidenceQuery = trpc.evidence.listByDocument.useQuery({ documentId })

  const versionRows = useMemo(
    () =>
      (versionsQuery.data ?? []).map((v) => ({
        id: v.id,
        displayName: v.versionLabel,
        metadata: new Date(v.createdAt).toLocaleDateString(),
        attached: v.milestoneId === milestoneId,
      })),
    [versionsQuery.data, milestoneId],
  )

  const workshopRows = useMemo(() => {
    const milestonesForDoc = milestonesForDocQuery.data ?? []
    const milestoneIdsForDoc = new Set(milestonesForDoc.map((m) => m.id))
    const allowed = (workshopsQuery.data ?? []).filter((w) => {
      // Always include anything already attached to *this* milestone so the
      // user can detach it.
      if (w.milestoneId === milestoneId) return true
      // Unattached workshops are candidates for this milestone.
      if (!w.milestoneId) return true
      // Already attached to a sibling milestone within the same policy.
      return milestoneIdsForDoc.has(w.milestoneId)
    })
    return allowed.map((w) => ({
      id: w.id,
      displayName: w.title,
      metadata: new Date(w.scheduledAt).toLocaleDateString(),
      attached: w.milestoneId === milestoneId,
    }))
  }, [workshopsQuery.data, milestonesForDocQuery.data, milestoneId])

  const feedbackRows = useMemo(
    () =>
      (feedbackQuery.data ?? []).map((f) => ({
        id: f.id,
        displayName: `${f.readableId} - ${f.title}`,
        attached: f.milestoneId === milestoneId,
      })),
    [feedbackQuery.data, milestoneId],
  )

  const evidenceRows = useMemo(
    () =>
      (evidenceQuery.data ?? []).map((e) => ({
        id: e.id,
        displayName: e.title,
        metadata: e.fileName ?? e.type,
        attached: e.milestoneId === milestoneId,
      })),
    [evidenceQuery.data, milestoneId],
  )

  return (
    <Tabs defaultValue="versions" className="pt-4">
      <TabsList variant="line">
        <TabsTrigger value="versions">Versions</TabsTrigger>
        <TabsTrigger value="workshops">Workshops</TabsTrigger>
        <TabsTrigger value="feedback">Feedback</TabsTrigger>
        <TabsTrigger value="evidence">Evidence</TabsTrigger>
      </TabsList>

      <TabsContent value="versions" className="min-h-[240px]">
        <MilestoneEntityTab
          milestoneId={milestoneId}
          documentId={documentId}
          entityType="version"
          rows={versionRows}
          isLoading={versionsQuery.isLoading}
          isReadOnly={isReadOnly}
          onMutated={onMutated}
        />
      </TabsContent>
      <TabsContent value="workshops" className="min-h-[240px]">
        <MilestoneEntityTab
          milestoneId={milestoneId}
          documentId={documentId}
          entityType="workshop"
          rows={workshopRows}
          isLoading={workshopsQuery.isLoading || milestonesForDocQuery.isLoading}
          isReadOnly={isReadOnly}
          onMutated={onMutated}
        />
      </TabsContent>
      <TabsContent value="feedback" className="min-h-[240px]">
        <MilestoneEntityTab
          milestoneId={milestoneId}
          documentId={documentId}
          entityType="feedback"
          rows={feedbackRows}
          isLoading={feedbackQuery.isLoading}
          isReadOnly={isReadOnly}
          onMutated={onMutated}
        />
      </TabsContent>
      <TabsContent value="evidence" className="min-h-[240px]">
        <MilestoneEntityTab
          milestoneId={milestoneId}
          documentId={documentId}
          entityType="evidence"
          rows={evidenceRows}
          isLoading={evidenceQuery.isLoading}
          isReadOnly={isReadOnly}
          onMutated={onMutated}
        />
      </TabsContent>
    </Tabs>
  )
}

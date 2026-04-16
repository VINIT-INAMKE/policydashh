'use client'

import { useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { trpc } from '@/src/trpc/client'
import { MilestoneEntityTab, type EntityType } from './milestone-entity-tab'

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

  // Workshops: global (no documentId column). List all workshops.
  const workshopsQuery = trpc.workshop.list.useQuery({ filter: 'all' })

  // Feedback: scoped to document via feedback.list({ documentId })
  const feedbackQuery = trpc.feedback.list.useQuery({ documentId })

  // Evidence: no document-scoped list procedure exists.
  // Evidence tab renders empty with explanation until Phase 23 wires a
  // document-scoped evidence listing. Attach/detach still works via
  // milestone.attachEntity/detachEntity for evidence entities whose IDs
  // are known. The evidence.listByFeedback and evidence.listBySection
  // are scoped to specific feedback/section, not a whole document.
  const evidenceRows: { id: string; displayName: string; metadata?: string; attached: boolean }[] = []

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

  const workshopRows = useMemo(
    () =>
      (workshopsQuery.data ?? []).map((w) => ({
        id: w.id,
        displayName: w.title,
        metadata: new Date(w.scheduledAt).toLocaleDateString(),
        attached: w.milestoneId === milestoneId,
      })),
    [workshopsQuery.data, milestoneId],
  )

  const feedbackRows = useMemo(
    () =>
      (feedbackQuery.data ?? []).map((f) => ({
        id: f.id,
        displayName: `${f.readableId} - ${f.title}`,
        attached: f.milestoneId === milestoneId,
      })),
    [feedbackQuery.data, milestoneId],
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
          isLoading={workshopsQuery.isLoading}
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
          isLoading={false}
          isReadOnly={isReadOnly}
          onMutated={onMutated}
        />
      </TabsContent>
    </Tabs>
  )
}

'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import {
  Calendar,
  Clock,
  ExternalLink,
  Pencil,
  Paperclip,
  Plus,
  X,
} from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ArtifactList } from './_components/artifact-list'
import { ArtifactAttachDialog } from './_components/artifact-attach-dialog'
import { SectionLinkPicker } from './_components/section-link-picker'
import { FeedbackLinkPicker } from './_components/feedback-link-picker'

export default function WorkshopDetailPage() {
  const params = useParams<{ id: string }>()
  const workshopId = params.id

  const meQuery = trpc.user.getMe.useQuery()
  const workshopQuery = trpc.workshop.getById.useQuery({ workshopId })
  const utils = trpc.useUtils()

  const [attachDialogOpen, setAttachDialogOpen] = useState(false)
  const [sectionPickerOpen, setSectionPickerOpen] = useState(false)
  const [feedbackPickerOpen, setFeedbackPickerOpen] = useState(false)

  const canManage =
    meQuery.data?.role === 'workshop_moderator' || meQuery.data?.role === 'admin'

  const unlinkSectionMutation = trpc.workshop.unlinkSection.useMutation({
    onSuccess: () => {
      toast.success('Section unlinked.')
      utils.workshop.getById.invalidate({ workshopId })
    },
    onError: () => {
      toast.error("Couldn't unlink the section. Try again.")
    },
  })

  const unlinkFeedbackMutation = trpc.workshop.unlinkFeedback.useMutation({
    onSuccess: () => {
      toast.success('Feedback item unlinked.')
      utils.workshop.getById.invalidate({ workshopId })
    },
    onError: () => {
      toast.error("Couldn't unlink the feedback item. Try again.")
    },
  })

  if (workshopQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="w-full space-y-4 rounded-lg border-r bg-muted p-4 lg:w-80 lg:shrink-0">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="flex-1 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    )
  }

  const workshop = workshopQuery.data
  if (!workshop) return null

  const dateStr = typeof workshop.scheduledAt === 'string'
    ? workshop.scheduledAt
    : workshop.scheduledAt.toISOString()
  const formattedDate = format(parseISO(dateStr), 'MMM d, yyyy \u00b7 h:mm a')

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Left panel */}
      <div className="w-full space-y-4 rounded-lg border-r bg-muted p-4 lg:w-80 lg:shrink-0">
        <h1 className="text-[28px] font-semibold leading-tight">{workshop.title}</h1>

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Calendar className="size-3.5" />
          <span>{formattedDate}</span>
        </div>

        {workshop.durationMinutes && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-3.5" />
            <span>{workshop.durationMinutes} minutes</span>
          </div>
        )}

        {workshop.registrationLink && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(workshop.registrationLink!, '_blank')}
          >
            <ExternalLink className="size-3.5" />
            Registration Link
          </Button>
        )}

        {canManage && (
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/workshops/${workshopId}/edit`} />}
          >
            <Pencil className="size-3.5" />
            Edit
          </Button>
        )}

        {workshop.description && (
          <p className="text-sm text-muted-foreground">{workshop.description}</p>
        )}

        <Separator />

        {/* Linked Sections */}
        <div className="space-y-2">
          <h2 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
            LINKED SECTIONS
          </h2>
          {canManage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSectionPickerOpen(true)}
            >
              <Plus className="size-3.5" />
              Link Section
            </Button>
          )}
          {workshop.sections.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sections linked yet.</p>
          ) : (
            <div className="space-y-1">
              {workshop.sections.map((section) => (
                <div
                  key={section.sectionId}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-background/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{section.sectionTitle}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {section.documentTitle}
                    </p>
                  </div>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Unlink section ${section.sectionTitle}`}
                      onClick={() =>
                        unlinkSectionMutation.mutate({
                          workshopId,
                          sectionId: section.sectionId,
                        })
                      }
                    >
                      <X className="size-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Linked Feedback */}
        <div className="space-y-2">
          <h2 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
            LINKED FEEDBACK
          </h2>
          {canManage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFeedbackPickerOpen(true)}
            >
              <Plus className="size-3.5" />
              Link Feedback
            </Button>
          )}
          {workshop.feedback.length === 0 ? (
            <p className="text-xs text-muted-foreground">No feedback items linked yet.</p>
          ) : (
            <div className="space-y-1">
              {workshop.feedback.map((fb) => (
                <div
                  key={fb.feedbackId}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-background/50"
                >
                  <div className="min-w-0 flex-1">
                    <span className="mr-2 font-mono text-xs text-muted-foreground">
                      {fb.readableId}
                    </span>
                    <span className="truncate text-sm">{fb.title}</span>
                  </div>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Unlink feedback ${fb.readableId}`}
                      onClick={() =>
                        unlinkFeedbackMutation.mutate({
                          workshopId,
                          feedbackId: fb.feedbackId,
                        })
                      }
                    >
                      <X className="size-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right content area */}
      <div className="flex-1">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Artifacts</h2>
          {canManage && (
            <Button onClick={() => setAttachDialogOpen(true)}>
              <Paperclip className="size-4" />
              Attach Artifact
            </Button>
          )}
        </div>

        <ArtifactList workshopId={workshopId} canManage={canManage} />
      </div>

      {/* Dialogs / Pickers */}
      <ArtifactAttachDialog
        workshopId={workshopId}
        open={attachDialogOpen}
        onOpenChange={setAttachDialogOpen}
      />
      <SectionLinkPicker
        workshopId={workshopId}
        linkedSectionIds={workshop.sections.map((s) => s.sectionId)}
        open={sectionPickerOpen}
        onOpenChange={setSectionPickerOpen}
      />
      <FeedbackLinkPicker
        workshopId={workshopId}
        linkedFeedbackIds={workshop.feedback.map((f) => f.feedbackId)}
        open={feedbackPickerOpen}
        onOpenChange={setFeedbackPickerOpen}
      />
    </div>
  )
}

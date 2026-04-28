'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Calendar,
  Clock,
  ExternalLink,
  Globe,
  Pencil,
  Paperclip,
  Plus,
  X,
} from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { formatWorkshopTime } from '@/src/lib/format-workshop-time'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ArtifactList } from './_components/artifact-list'
import { ArtifactAttachDialog } from './_components/artifact-attach-dialog'
import { SectionLinkPicker } from './_components/section-link-picker'
import { FeedbackLinkPicker } from './_components/feedback-link-picker'
import { StatusTransitionButtons } from './_components/status-transition-buttons'
import { EvidenceChecklist } from './_components/evidence-checklist'
import { AttendeeList } from './_components/attendee-list'

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

  const endWorkshopMutation = trpc.workshop.endWorkshop.useMutation({
    onSuccess: () => {
      toast.success('Workshop ended. Feedback emails are on their way.')
      utils.workshop.getById.invalidate({ workshopId })
    },
    onError: (err) => {
      toast.error(`Couldn't end workshop: ${err.message}`)
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

  const formattedDate = formatWorkshopTime(workshop.scheduledAt, workshop.timezone)

  // End Workshop CTA is visible 30 minutes before the scheduled start and
  // while the workshop is still upcoming or in progress.
  const showEndWorkshop =
    (workshop.status === 'upcoming' || workshop.status === 'in_progress') &&
    Date.now() > new Date(workshop.scheduledAt).getTime() - 30 * 60_000

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Left panel */}
      <div className="w-full space-y-4 rounded-lg border-r bg-muted p-4 lg:w-80 lg:shrink-0">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-[28px] font-semibold leading-tight">{workshop.title}</h1>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => window.open(`/workshops/${workshopId}`, '_blank')}
          >
            Public preview ↗
          </Button>
        </div>

        {/* Meeting source badge */}
        <Badge
          variant={workshop.meetingProvisionedBy === 'google_meet' ? 'default' : 'secondary'}
        >
          {workshop.meetingProvisionedBy === 'google_meet' ? 'Google Meet' : 'Custom link'}
        </Badge>

        <StatusTransitionButtons
          workshopId={workshopId}
          currentStatus={workshop.status}
          canManage={canManage}
        />

        {/* End Workshop CTA */}
        {canManage && showEndWorkshop && (
          <Button
            variant="default"
            size="sm"
            disabled={endWorkshopMutation.isPending}
            onClick={() => {
              if (
                confirm(
                  'End workshop now? This will send feedback emails to all registered attendees.',
                )
              ) {
                endWorkshopMutation.mutate({ workshopId })
              }
            }}
          >
            {endWorkshopMutation.isPending ? 'Ending…' : 'End Workshop'}
          </Button>
        )}

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

        {/* F17: timezone chip + capacity readout */}
        {workshop.timezone && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Globe className="size-3.5" />
            <span>{workshop.timezone}</span>
          </div>
        )}

        {workshop.maxSeats != null && (
          <div className="text-sm text-muted-foreground">
            Capacity: <span className="font-medium text-foreground">{workshop.maxSeats}</span>
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

        {/* Open in Google Calendar — deep-links to the event in edit mode for the organizer */}
        {workshop.googleCalendarEventId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              window.open(
                `https://calendar.google.com/calendar/u/0/r/eventedit/${workshop.googleCalendarEventId}`,
                '_blank',
                'noopener,noreferrer',
              )
            }
          >
            <ExternalLink className="size-3.5" />
            Open in Google Calendar
          </Button>
        )}

        {canManage && (
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/workshop-manage/${workshopId}/edit`} />}
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
                  <Link
                    href={`/policies/${section.documentId}`}
                    className="block min-w-0 flex-1 hover:underline"
                  >
                    <p className="truncate text-sm">{section.sectionTitle}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {section.documentTitle}
                    </p>
                  </Link>
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
                  <Link
                    href={`/policies/${fb.documentId}/feedback`}
                    className="block min-w-0 flex-1 hover:underline"
                  >
                    <span className="mr-2 font-mono text-xs text-muted-foreground">
                      {fb.readableId}
                    </span>
                    <span className="truncate text-sm">{fb.title}</span>
                  </Link>
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

      {/* Right content area - F18: Artifacts + Attendees + Checklist tabs.
          D21: Attendees tab is admin/moderator-only. The tRPC guard on
          workshop.listRegistrations (D1) rejects the fetch for other roles,
          but we also gate the trigger + content here so a stakeholder who
          knows the workshop UUID never even sees the tab. */}
      <div className="flex-1">
        <Tabs defaultValue="artifacts">
          <TabsList>
            <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
            {canManage && (
              <TabsTrigger value="attendees">Attendees</TabsTrigger>
            )}
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
          </TabsList>
          <TabsContent value="artifacts" className="mt-4">
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
          </TabsContent>
          {canManage && (
            <TabsContent value="attendees" className="mt-4">
              <h2 className="mb-4 text-xl font-semibold">Attendees</h2>
              <AttendeeList workshopId={workshopId} />
            </TabsContent>
          )}
          <TabsContent value="checklist" className="mt-4">
            <EvidenceChecklist workshopId={workshopId} />
          </TabsContent>
        </Tabs>
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

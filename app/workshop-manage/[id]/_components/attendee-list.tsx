'use client'

/**
 * F18 / Task 20: Attendee list tab for the workshop manage detail page.
 *
 * Surfaces the `workshop.listRegistrations` router procedure output.
 * Adds five admin actions:
 *   1. Per-row Attended checkbox  → markAttendance
 *   2. Mark all present button    → markAllPresent
 *   3. Add walk-in modal          → addWalkIn
 *   4. Per-row Resend invite      → resendInvite  (shown when inviteSentAt == null && not cancelled)
 *   5. Per-row Cancel action      → cancelRegistration (with notify checkbox)
 */

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { trpc } from '@/src/trpc/client'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Users } from 'lucide-react'

interface AttendeeListProps {
  workshopId: string
}

interface RegistrationRow {
  id: string
  email: string
  name: string | null
  status: string
  bookingUid: string | null
  bookingStartTime: Date | string | null
  registeredAt: Date | string
  cancelledAt: Date | string | null
  attendedAt: Date | string | null
  attendanceSource: string | null
  inviteSentAt: Date | string | null
}

const STATUS_VARIANT: Record<string, string> = {
  registered:  'bg-blue-100 text-blue-800',
  rescheduled: 'bg-amber-100 text-amber-800',
  cancelled:   'bg-slate-100 text-slate-600 line-through',
}

function formatWhen(input: string | Date): string {
  const iso = typeof input === 'string' ? input : input.toISOString()
  return format(parseISO(iso), 'MMM d, yyyy · h:mm a')
}

export function AttendeeList({ workshopId }: AttendeeListProps) {
  const utils = trpc.useUtils()
  const query = trpc.workshop.listRegistrations.useQuery({ workshopId })

  // Walk-in modal state
  const [walkInDialogOpen, setWalkInDialogOpen] = useState(false)
  const [walkInEmail, setWalkInEmail] = useState('')
  const [walkInName, setWalkInName] = useState('')

  // Cancel registration modal state
  const [cancelTarget, setCancelTarget] = useState<RegistrationRow | null>(null)
  const [cancelNotify, setCancelNotify] = useState(true)

  // Mutations
  const markAttendanceMutation = trpc.workshop.markAttendance.useMutation({
    onSuccess: () => {
      utils.workshop.listRegistrations.invalidate({ workshopId })
    },
    onError: (err) => {
      toast.error(`Could not update attendance: ${err.message}`)
    },
  })

  const markAllPresentMutation = trpc.workshop.markAllPresent.useMutation({
    onSuccess: (data) => {
      toast.success(`Marked ${data.affected} attendee${data.affected === 1 ? '' : 's'} present.`)
      utils.workshop.listRegistrations.invalidate({ workshopId })
    },
    onError: (err) => {
      toast.error(`Could not mark all present: ${err.message}`)
    },
  })

  const addWalkInMutation = trpc.workshop.addWalkIn.useMutation({
    onSuccess: (data) => {
      if (data.added) {
        toast.success('Walk-in added and marked as attended.')
      } else {
        toast.success('Existing registration found — attendance marked.')
      }
      setWalkInDialogOpen(false)
      setWalkInEmail('')
      setWalkInName('')
      utils.workshop.listRegistrations.invalidate({ workshopId })
    },
    onError: (err) => {
      toast.error(`Could not add walk-in: ${err.message}`)
    },
  })

  const resendInviteMutation = trpc.workshop.resendInvite.useMutation({
    onSuccess: () => {
      toast.success('Invite resent.')
      utils.workshop.listRegistrations.invalidate({ workshopId })
    },
    onError: (err) => {
      toast.error(`Resend failed: ${err.message}`)
    },
  })

  const cancelRegistrationMutation = trpc.workshop.cancelRegistration.useMutation({
    onError: (err) => {
      toast.error(`Could not cancel registration: ${err.message}`)
    },
  })

  // Loading skeleton
  if (query.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  const rows = query.data ?? []

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => markAllPresentMutation.mutate({ workshopId })}
          disabled={markAllPresentMutation.isPending || rows.length === 0}
        >
          Mark all present
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWalkInDialogOpen(true)}
        >
          Add walk-in
        </Button>
      </div>

      {/* Empty state */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="size-10 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">No registrations yet</p>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            Attendees will appear here once they register through the public workshop
            listing or book via Google Calendar.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium w-10">Present</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Status / Invite</th>
                <th className="px-3 py-2 font-medium">Registered</th>
                <th className="px-3 py-2 font-medium">Attended</th>
                <th className="px-3 py-2 font-medium w-24"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  {/* Attended checkbox */}
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={!!r.attendedAt}
                      disabled={r.status === 'cancelled' || markAttendanceMutation.isPending}
                      onCheckedChange={(checked) =>
                        markAttendanceMutation.mutate({
                          workshopId,
                          registrationId: r.id,
                          attended: !!checked,
                        })
                      }
                      aria-label={`Mark ${r.email} as ${r.attendedAt ? 'not attended' : 'attended'}`}
                    />
                  </td>

                  {/* Email */}
                  <td className="px-3 py-2 font-mono text-xs">{r.email}</td>

                  {/* Name */}
                  <td className="px-3 py-2 text-sm">
                    {r.name ?? <span className="text-muted-foreground">&mdash;</span>}
                  </td>

                  {/* Status / Invite badge */}
                  <td className="px-3 py-2">
                    {r.status === 'cancelled' ? (
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_VARIANT['cancelled']}`}
                      >
                        cancelled
                      </span>
                    ) : !r.inviteSentAt ? (
                      <span className="inline-flex items-center gap-1 flex-wrap">
                        <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 text-[11px]">
                          ⚠ Invite pending
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={() =>
                            resendInviteMutation.mutate({
                              workshopId,
                              registrationId: r.id,
                            })
                          }
                          disabled={resendInviteMutation.isPending}
                        >
                          Resend
                        </Button>
                      </span>
                    ) : (
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_VARIANT[r.status] ?? 'bg-slate-100 text-slate-800'}`}
                      >
                        {r.status}
                      </span>
                    )}
                  </td>

                  {/* Registered at */}
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {formatWhen(r.registeredAt)}
                  </td>

                  {/* Attended at */}
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {r.attendedAt ? (
                      <div className="flex flex-col gap-0.5">
                        <span>{formatWhen(r.attendedAt)}</span>
                        {r.attendanceSource ? (
                          <Badge variant="outline" className="w-fit text-[10px]">
                            {r.attendanceSource === 'cal_meeting_ended' ? 'cal.com' : r.attendanceSource}
                          </Badge>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">&mdash;</span>
                    )}
                  </td>

                  {/* Cancel action */}
                  <td className="px-3 py-2">
                    {r.status !== 'cancelled' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => {
                          setCancelNotify(true)
                          setCancelTarget(r)
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Walk-in modal */}
      <Dialog open={walkInDialogOpen} onOpenChange={setWalkInDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add walk-in attendee</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label htmlFor="walkin-email">Email</Label>
              <Input
                id="walkin-email"
                type="email"
                placeholder="email@example.com"
                value={walkInEmail}
                onChange={(e) => setWalkInEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="walkin-name">Full name</Label>
              <Input
                id="walkin-name"
                placeholder="Full name"
                value={walkInName}
                onChange={(e) => setWalkInName(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setWalkInDialogOpen(false)
                  setWalkInEmail('')
                  setWalkInName('')
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  addWalkInMutation.mutate({
                    workshopId,
                    email: walkInEmail,
                    name: walkInName,
                  })
                }
                disabled={
                  !walkInEmail.trim() ||
                  !walkInName.trim() ||
                  addWalkInMutation.isPending
                }
              >
                Add walk-in
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel registration modal */}
      <Dialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel registration?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to cancel{' '}
              <span className="font-medium text-foreground">
                {cancelTarget?.name ?? cancelTarget?.email}
              </span>
              's registration? This action cannot be undone.
            </p>
            <div className="flex items-center gap-2">
              <Checkbox
                id="notify-cancel"
                checked={cancelNotify}
                onCheckedChange={(c) => setCancelNotify(!!c)}
              />
              <Label htmlFor="notify-cancel" className="font-normal text-sm">
                Notify the attendee via Google Calendar
              </Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setCancelTarget(null)}
              >
                Keep registration
              </Button>
              <Button
                variant="destructive"
                disabled={cancelRegistrationMutation.isPending}
                onClick={() => {
                  if (!cancelTarget) return
                  cancelRegistrationMutation.mutate(
                    {
                      workshopId,
                      registrationId: cancelTarget.id,
                      notify: cancelNotify,
                    },
                    {
                      onSuccess: (result) => {
                        setCancelTarget(null)
                        utils.workshop.listRegistrations.invalidate({ workshopId })
                        if (result.googleSyncFailed) {
                          toast.warning(
                            'Registration cancelled. Google Calendar sync failed — the attendee may still see reminders. Remove them manually from the event in Google Calendar.',
                          )
                        } else {
                          toast.success('Registration cancelled.')
                        }
                      },
                    },
                  )
                }}
              >
                Cancel registration
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

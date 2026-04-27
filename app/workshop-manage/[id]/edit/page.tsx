'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { utcToWallTime } from '@/src/lib/wall-time'

export default function EditWorkshopPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const workshopId = params.id

  const meQuery = trpc.user.getMe.useQuery()
  const role = meQuery.data?.role
  const canManageWorkshops = role === 'admin' || role === 'workshop_moderator'

  // Role gate: redirect unauthorized users
  useEffect(() => {
    if (meQuery.data && !canManageWorkshops) {
      router.replace(`/workshop-manage/${workshopId}`)
    }
  }, [meQuery.data, canManageWorkshops, router, workshopId])

  const workshopQuery = trpc.workshop.getById.useQuery({ workshopId })

  // Load registrations to determine mode-switch lock. Enabled only once we
  // know the user has permission (avoids a 403 flash before role check fires).
  const registrationsQuery = trpc.workshop.listRegistrations.useQuery(
    { workshopId },
    { enabled: canManageWorkshops },
  )
  const activeRegistrationCount =
    registrationsQuery.data?.filter((r) => r.status !== 'cancelled').length ?? 0
  const modeSwitchLocked = activeRegistrationCount > 0

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  // F11: maxSeats editable on the update path. F9: timezone editable too.
  const [maxSeats, setMaxSeats] = useState('')
  const [timezone, setTimezone] = useState('')
  const [meetingMode, setMeetingMode] = useState<'auto_meet' | 'manual'>('auto_meet')
  const [manualMeetingUrl, setManualMeetingUrl] = useState('')
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (workshopQuery.data && !initialized) {
      const w = workshopQuery.data
      const tz = w.timezone ?? 'Asia/Kolkata'
      setTitle(w.title)
      setDescription(w.description ?? '')
      // Render the stored UTC instant in the workshop's OWN tz, not the
      // browser's. Old `toDatetimeLocalValue` used `d.getHours()` etc which
      // is browser-local — admin in Singapore editing a Mumbai workshop
      // would see the wrong time and round-trip-corrupt it on save.
      setScheduledAt(utcToWallTime(w.scheduledAt, tz))
      setDurationMinutes(w.durationMinutes ? String(w.durationMinutes) : '')
      setMaxSeats(w.maxSeats != null ? String(w.maxSeats) : '')
      setTimezone(tz)
      // Translate meetingProvisionedBy ('google_meet' | 'manual') → meetingMode
      // ('auto_meet' | 'manual'). The column stores the provisioning result;
      // the input enum names the requested source.
      setMeetingMode(w.meetingProvisionedBy === 'manual' ? 'manual' : 'auto_meet')
      setManualMeetingUrl(
        w.meetingProvisionedBy === 'manual' ? (w.meetingUrl ?? '') : '',
      )
      setInitialized(true)
    }
  }, [workshopQuery.data, initialized])

  const updateMutation = trpc.workshop.update.useMutation({
    onSuccess: () => {
      toast.success('Workshop updated.')
      router.push(`/workshop-manage/${workshopId}`)
    },
    onError: (err) => {
      // See workshop-create's identical handler for rationale; v4 ZodError
      // shape is `{ issues, tree }`, not `{ fieldErrors }`.
      const issues = err.data?.zodError?.issues
      if (issues && issues.length > 0) {
        const first = issues[0]
        const field = first.path.join('.')
        toast.error(field ? `${field}: ${first.message}` : first.message)
        return
      }
      toast.error(err.message || "Couldn't save changes. Please try again.")
    },
  })

  const canSubmit = title.trim().length > 0 && scheduledAt.length > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    const dur = durationMinutes ? parseInt(durationMinutes, 10) : null
    // F11: blank maxSeats clears the cap (open registration). Non-numeric
    // input is treated as "no change" - the server-side z.number() guard
    // rejects stringified garbage either way.
    const seats = maxSeats.trim() === '' ? null : parseInt(maxSeats, 10)
    const tz = timezone.trim() || undefined

    // Send the wall-clock string AS-IS. The server converts it to UTC
    // using the (possibly updated) timezone field — see workshop.update's
    // `effectiveTz` for the same-call tz+time semantics.
    updateMutation.mutate({
      workshopId,
      title: title.trim(),
      description: description.trim() || undefined,
      scheduledAt: scheduledAt,
      durationMinutes: dur && dur > 0 ? dur : null,
      maxSeats: seats === null ? null : seats > 0 ? seats : null,
      timezone: tz,
      meetingMode,
      // registrationLink is not exposed in the edit UI (Task 18 cleanup);
      // pass undefined so the server keeps the existing value unchanged.
      registrationLink: undefined,
      manualMeetingUrl: meetingMode === 'manual' ? manualMeetingUrl : undefined,
    })
  }

  if (workshopQuery.isLoading) {
    return (
      <div className="mx-auto max-w-[640px] space-y-4">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  // Derive display-time URL editability from provisioning state + registrant count.
  // Switching mode is gated by modeSwitchLocked; editing a URL within the same
  // manual mode is allowed only when there are no active registrations.
  const existingProvisionedBy = workshopQuery.data?.meetingProvisionedBy
  const manualUrlEditable =
    existingProvisionedBy === 'manual' && activeRegistrationCount === 0

  return (
    <div className="mx-auto max-w-[640px]">
      <Button variant="ghost" size="sm" render={<Link href={`/workshop-manage/${workshopId}`} />} className="mb-4">
        <ArrowLeft className="size-3.5" />
        Back to Workshop
      </Button>

      <h1 className="mb-6 text-xl font-semibold">Edit Workshop</h1>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader className="border-b">
            <span className="text-sm font-medium text-muted-foreground">Workshop Details</span>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="workshop-title">Title</Label>
              <Input
                id="workshop-title"
                placeholder="e.g., Stakeholder Consultation Session 1"
                required
                autoFocus
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="workshop-description">Description</Label>
              <Textarea
                id="workshop-description"
                placeholder="Brief overview of the workshop's agenda and objectives"
                rows={4}
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="workshop-datetime">
                Date &amp; Time{' '}
                <span className="text-muted-foreground text-xs">(in IST)</span>
              </Label>
              <input
                id="workshop-datetime"
                type="datetime-local"
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Editing the time will update Google Calendar and notify all registered attendees.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="workshop-duration">Duration (minutes)</Label>
              <Input
                id="workshop-duration"
                type="number"
                min="1"
                placeholder="e.g., 90"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="workshop-maxseats">
                Maximum seats{' '}
                <span className="text-xs text-muted-foreground">
                  (leave blank for open registration)
                </span>
              </Label>
              <Input
                id="workshop-maxseats"
                type="number"
                min="1"
                max="10000"
                placeholder="e.g., 50"
                value={maxSeats}
                onChange={(e) => setMaxSeats(e.target.value)}
              />
            </div>

            {/* H-4 (audit 2026-04-27 wide review): timezone is locked to
                Asia/Kolkata via the create form (parity here so an edit
                doesn't silently drift away from IST). The schema allows
                any IANA tz for legacy rows; we display the stored value
                read-only so admins editing a non-IST legacy workshop can
                see what's there but can't accidentally change it. */}
            <div className="flex flex-col gap-2">
              <Label>Timezone</Label>
              <div className="rounded-md border border-input bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground">
                {timezone || 'Asia/Kolkata'}
              </div>
              <p className="text-xs text-muted-foreground">
                Workshops are stored in IST. Cal.com converts to each
                attendee&apos;s local timezone at booking time.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Meeting source</Label>
              <RadioGroup
                value={meetingMode}
                onValueChange={(v) => !modeSwitchLocked && setMeetingMode(v as 'auto_meet' | 'manual')}
                className="flex flex-col gap-2"
                disabled={modeSwitchLocked}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="auto_meet" id="mode-auto" />
                  <Label htmlFor="mode-auto" className="font-normal cursor-pointer">
                    Auto-provision Google Meet
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="manual" id="mode-manual" />
                  <Label htmlFor="mode-manual" className="font-normal cursor-pointer">
                    Use my own meeting link
                  </Label>
                </div>
              </RadioGroup>
              {modeSwitchLocked && (
                <p className="text-xs text-muted-foreground">
                  Cannot switch meeting mode after registrations exist — delete and recreate the workshop.
                </p>
              )}
            </div>

            {meetingMode === 'manual' && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="manual-meeting-url">Meeting URL</Label>
                {manualUrlEditable ? (
                  <Input
                    id="manual-meeting-url"
                    type="url"
                    placeholder="https://zoom.us/j/123456789"
                    value={manualMeetingUrl}
                    onChange={(e) => setManualMeetingUrl(e.target.value)}
                    required
                  />
                ) : (
                  <>
                    <div className="rounded-md border border-input bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground break-all">
                      {manualMeetingUrl || '—'}
                    </div>
                    {existingProvisionedBy === 'manual' && activeRegistrationCount > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Meeting URL is locked while registrations exist.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {meetingMode === 'auto_meet' && workshopQuery.data?.meetingUrl && (
              <div className="flex flex-col gap-2">
                <Label>Google Meet link</Label>
                <div className="rounded-md border border-input bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground break-all">
                  {workshopQuery.data.meetingUrl}
                </div>
                <p className="text-xs text-muted-foreground">
                  Managed by Google — update via Google Calendar directly.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <div className="flex w-full items-center justify-end gap-2">
              <Button variant="outline" render={<Link href={`/workshop-manage/${workshopId}`} />}>
                Discard
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit || updateMutation.isPending}
              >
                {updateMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}

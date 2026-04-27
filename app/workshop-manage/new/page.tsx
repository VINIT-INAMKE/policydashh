'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export default function CreateWorkshopPage() {
  const router = useRouter()
  const meQuery = trpc.user.getMe.useQuery()
  const role = meQuery.data?.role
  const canManageWorkshops = role === 'admin' || role === 'workshop_moderator'

  // Role gate: redirect unauthorized users
  useEffect(() => {
    if (meQuery.data && !canManageWorkshops) {
      router.replace('/workshop-manage')
    }
  }, [meQuery.data, canManageWorkshops, router])

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  // Phase 20 WS-07 (D-07): optional capacity; blank string → undefined → null
  // in DB which means "open registration" on the public listing.
  const [maxSeats, setMaxSeats] = useState('')
  const [registrationLink, setRegistrationLink] = useState('')
  // Workshop times are always entered in IST (admin's working tz). Cal.com
  // converts to each attendee's local tz at booking time, so the source-of-
  // truth tz on our row is fixed at Asia/Kolkata. No selector needed.
  const WORKSHOP_TZ = 'Asia/Kolkata'

  const createMutation = trpc.workshop.create.useMutation({
    onSuccess: (workshop) => {
      toast.success('Workshop created.')
      router.push(`/workshop-manage/${workshop.id}`)
    },
    onError: (err) => {
      // Surface ZodError field-level detail instead of a generic
      // "check your connection" toast — prior behaviour buried real
      // input errors and made every 400 look like a transport failure.
      // Project's tRPC errorFormatter (src/trpc/init.ts) emits the v4 shape
      // `{ issues, tree }` — issues[].path is the field path, .message the reason.
      const issues = err.data?.zodError?.issues
      if (issues && issues.length > 0) {
        const first = issues[0]
        const field = first.path.join('.')
        toast.error(field ? `${field}: ${first.message}` : first.message)
        return
      }
      toast.error(err.message || "Couldn't create the workshop. Please try again.")
    },
  })

  const canSubmit = title.trim().length > 0 && scheduledAt.length > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    const dur = durationMinutes ? parseInt(durationMinutes, 10) : undefined
    const seats = maxSeats ? parseInt(maxSeats, 10) : undefined

    // Send the wall-clock string AS-IS. The server converts it to UTC
    // using the workshop's timezone, so the admin's browser locale never
    // factors in (the old `new Date(scheduledAt).toISOString()` reinterpreted
    // the value in browser-local tz, silently mangling cross-tz workshops).
    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      scheduledAt: scheduledAt,
      durationMinutes: dur && dur > 0 ? dur : undefined,
      maxSeats: seats && seats > 0 ? seats : undefined,
      registrationLink: registrationLink,
      timezone: WORKSHOP_TZ,
    })
  }

  return (
    <div className="mx-auto max-w-[640px]">
      <Button variant="ghost" size="sm" render={<Link href="/workshop-manage" />} className="mb-4">
        <ArrowLeft className="size-3.5" />
        Back to Workshops
      </Button>

      <h1 className="mb-6 text-xl font-semibold">Create Workshop</h1>

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
                Stored as Asia/Kolkata. Cal.com converts the time into each
                attendee&apos;s local timezone when they book.
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
                Maximum seats <span className="text-muted-foreground text-xs">(optional - leave blank for open registration)</span>
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

            <div className="flex flex-col gap-2">
              <Label htmlFor="workshop-reglink">Registration Link</Label>
              <Input
                id="workshop-reglink"
                type="url"
                placeholder="https://..."
                value={registrationLink}
                onChange={(e) => setRegistrationLink(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <div className="flex w-full items-center justify-end gap-2">
              <Button variant="outline" render={<Link href="/workshop-manage" />}>
                Discard
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit || createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Create Workshop
              </Button>
            </div>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}

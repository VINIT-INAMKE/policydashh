'use client'

import { useState } from 'react'
import { trpc } from '@/src/trpc/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'

// M5 (audit 2026-04-27): admin recovery surface for the case where
// `workshopCreatedFn` provisioned the cal.com event-type + booking but
// the booking response was missing both `meetingUrl` and `location`.
// The "join meeting" button on the detail page is then disabled forever
// unless the admin pastes the link manually here.
//
// Only renders when calcomBookingUid is set (provisioning succeeded) and
// meetingUrl is null. Once a URL lands the parent re-renders without us.
export function MissingMeetingUrlAlert({
  workshopId,
}: {
  workshopId: string
}) {
  const [url, setUrl] = useState('')
  const utils = trpc.useUtils()
  const setMeetingUrlMutation = trpc.workshop.setMeetingUrl.useMutation({
    onSuccess: () => {
      toast.success('Meeting URL saved.')
      setUrl('')
      utils.workshop.getById.invalidate({ workshopId })
    },
    onError: (err) => {
      const issues = err.data?.zodError?.issues
      if (issues && issues.length > 0) {
        toast.error(issues[0].message)
        return
      }
      toast.error(err.message || "Couldn't save the meeting URL.")
    },
  })

  return (
    <div
      role="alert"
      className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      <p className="mb-2 font-medium">Meeting URL missing</p>
      <p className="mb-2 text-xs leading-relaxed">
        Cal.com provisioned this workshop but didn&apos;t return a Meet link
        in its booking response. Open the cal.com event in a new tab, copy
        the meeting URL, and paste it below so attendees can join.
      </p>
      <div className="flex items-center gap-2">
        <Input
          type="url"
          placeholder="https://meet.google.com/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="h-8 flex-1 bg-white"
        />
        <Button
          size="sm"
          disabled={url.trim().length === 0 || setMeetingUrlMutation.isPending}
          onClick={() =>
            setMeetingUrlMutation.mutate({
              workshopId,
              meetingUrl: url.trim(),
            })
          }
        >
          {setMeetingUrlMutation.isPending && (
            <Loader2 className="size-4 animate-spin" />
          )}
          Save
        </Button>
      </div>
    </div>
  )
}

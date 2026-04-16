/**
 * Phase 20 Plan 20-05 - Cal.com registration modal.
 *
 * Client component. Wraps the shadcn <Dialog> primitive with a lazy-loaded
 * <CalEmbed> island. The cal.com React package (`@calcom/embed-react`) is
 * only fetched AFTER the user clicks Register - it is not shipped in the
 * public /workshops initial chunk (D-05, UI-SPEC Surface A §Cal.com Modal).
 *
 * Sizing (UI-SPEC Surface A §Cal.com Modal):
 *   - DialogContent: max-w-2xl  (overrides shadcn default sm:max-w-sm)
 *   - inner embed container: min-h-[400px] max-h-[70vh] with internal scroll
 *
 * Accessibility (UI-SPEC Surface A Dimension 2):
 *   - Register button carries aria-label="Register for {workshopTitle}"
 *   - DialogTitle is always rendered for screen reader announcement
 *   - Disabled state (disabled=true) renders "Fully booked" label and does
 *     not open the dialog on click
 */
'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

// Lazy-load the cal.com embed - browser-only, avoids SSR crash and keeps
// the initial /workshops chunk free of the cal.com vendor bundle.
const LazyCalEmbed = dynamic(() => import('./cal-embed'), {
  ssr: false,
  loading: () => <CalEmbedSkeleton />,
})

function CalEmbedSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-6 animate-pulse">
      <Skeleton className="h-8 w-3/4 rounded-md" />
      <Skeleton className="h-4 w-1/2 rounded-md" />
      <Skeleton className="h-48 w-full rounded-md" />
      <Skeleton className="h-10 w-full rounded-md" />
    </div>
  )
}

export interface CalEmbedModalProps {
  workshopId: string
  workshopTitle: string
  calLink: string
  scheduledAtFormatted: string
  durationMinutes: number | null
  disabled?: boolean
}

export function CalEmbedModal({
  workshopId,
  workshopTitle,
  calLink,
  scheduledAtFormatted,
  durationMinutes,
  disabled,
}: CalEmbedModalProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        className="h-12 w-full text-base font-semibold"
        style={
          disabled
            ? undefined
            : { backgroundColor: 'var(--cl-primary, #000a1e)', color: '#ffffff' }
        }
        onClick={() => {
          if (!disabled) setOpen(true)
        }}
        disabled={disabled}
        aria-label={`Register for ${workshopTitle}`}
      >
        {disabled ? 'Fully booked' : 'Register'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 border-b">
            <DialogTitle>{workshopTitle}</DialogTitle>
            <DialogDescription>
              {scheduledAtFormatted}
              {durationMinutes ? ` \u00b7 ${durationMinutes} min` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-[400px] max-h-[70vh] overflow-y-auto">
            {open ? (
              <LazyCalEmbed calLink={calLink} workshopId={workshopId} />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

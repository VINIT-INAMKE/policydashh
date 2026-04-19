'use client'

/**
 * F15: "Reprovision cal.com seats" admin action.
 *
 * Surfaces the `workshop.reprovisionCalSeats` router procedure behind a
 * confirm dialog so an admin can't accidentally fire it. The procedure
 * itself validates that the workshop has a numeric cal.com event type id
 * and pushes the current maxSeats (fallback 100) to cal.com.
 */

import { useState } from 'react'
import { trpc } from '@/src/trpc/client'
import { toast } from 'sonner'
import { Loader2, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'

export interface ReprovisionCalButtonProps {
  workshopId: string
  calcomEventTypeId: string | null
  maxSeats: number | null
}

export function ReprovisionCalButton({
  workshopId,
  calcomEventTypeId,
  maxSeats,
}: ReprovisionCalButtonProps) {
  const [open, setOpen] = useState(false)
  const hasNumericId = !!calcomEventTypeId && /^\d+$/.test(calcomEventTypeId)

  const mutation = trpc.workshop.reprovisionCalSeats.useMutation({
    onSuccess: (result) => {
      toast.success(`cal.com seats set to ${result.seatsPerTimeSlot}.`)
      setOpen(false)
    },
    onError: (err) => {
      toast.error(`Reprovision failed: ${err.message}`)
    },
  })

  if (!hasNumericId) return null

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Reprovision cal.com seats"
      >
        <Wrench className="size-3.5" />
        Reprovision cal.com seats
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reprovision cal.com seats</AlertDialogTitle>
            <AlertDialogDescription>
              This will push the current seat cap ({maxSeats ?? 100}) to cal.com so
              multiple attendees can book the same time slot. Existing bookings
              are not affected. Use this if the cal.com event type was created
              before seat support was added.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ workshopId })}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Working&hellip;
                </>
              ) : (
                'Reprovision'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

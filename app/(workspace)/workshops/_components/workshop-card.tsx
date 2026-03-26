'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { Calendar, ExternalLink, MoreHorizontal } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { DeleteWorkshopDialog } from './delete-workshop-dialog'

interface WorkshopData {
  id: string
  title: string
  description: string | null
  scheduledAt: string | Date
  durationMinutes: number | null
  registrationLink: string | null
}

interface WorkshopCardProps {
  workshop: WorkshopData
  canManage: boolean
}

export function WorkshopCard({ workshop, canManage }: WorkshopCardProps) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const dateStr = typeof workshop.scheduledAt === 'string'
    ? workshop.scheduledAt
    : workshop.scheduledAt.toISOString()
  const formattedDate = format(parseISO(dateStr), 'MMM d, yyyy \u00b7 h:mm a')

  return (
    <>
      <Card
        className="cursor-pointer transition-all hover:border-primary/20 hover:shadow-sm"
        onClick={() => router.push(`/workshops/${workshop.id}`)}
        aria-label={`${workshop.title}, scheduled ${formattedDate}`}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <span className="text-base font-semibold leading-snug">{workshop.title}</span>
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 rounded-md p-1 hover:bg-muted"
                >
                  <MoreHorizontal className="size-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/workshops/${workshop.id}/edit`)
                    }}
                  >
                    Edit Workshop
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteOpen(true)
                    }}
                  >
                    Delete Workshop
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="size-3.5" />
            <span>{formattedDate}</span>
          </div>
        </CardHeader>
        <CardContent>
          {workshop.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {workshop.description}
            </p>
          )}
        </CardContent>
        <CardFooter>
          <div className="flex w-full items-center justify-between">
            {workshop.durationMinutes ? (
              <Badge variant="secondary">{workshop.durationMinutes} min</Badge>
            ) : (
              <span />
            )}
            {workshop.registrationLink && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(workshop.registrationLink!, '_blank')
                }}
              >
                <ExternalLink className="size-3.5" />
                Register
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      <DeleteWorkshopDialog
        workshopId={workshop.id}
        workshopTitle={workshop.title}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  )
}

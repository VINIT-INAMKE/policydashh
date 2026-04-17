/**
 * Phase 20 Plan 20-05 - public workshop listing card.
 *
 * Three visual variants per UI-SPEC Surface A §Card Anatomy:
 *   - "upcoming": full card + CalEmbedModal + spots-left badge
 *   - "live":     full card + CalEmbedModal + "Live now" header badge (no spots)
 *   - "past":     compact card (title + date), optional "View summary" link
 *
 * Register CTA is only wired when the workshop has a non-null
 * `calcomEventTypeId` (D-03 - failed cal.com provisioning hides the embed).
 * The server query `listPublicWorkshops` already filters out null cases, so
 * every card that reaches this component is expected to have a cal link,
 * but we defensively guard on the prop anyway.
 */
import { Calendar } from 'lucide-react'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RegisterForm } from './register-form'
import { SpotsLeftBadge } from './spots-left-badge'

export interface WorkshopCardData {
  id: string
  title: string
  description: string | null
  scheduledAt: Date
  durationMinutes: number | null
  calcomEventTypeId: string | null
  maxSeats: number | null
  registeredCount: number
  hasApprovedSummary: boolean
}

export type WorkshopCardVariant = 'upcoming' | 'live' | 'past'

function formatWorkshopDate(d: Date): string {
  // Deterministic server-side formatting. Mirrors Phase 19 /participate date
  // handling - ISO parse on the server, locale-aware display on the client
  // would need useEffect; keeping it simple and SSR-stable.
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function WorkshopCard({
  workshop,
  variant,
  currentUser,
  alreadyRegistered,
}: {
  workshop: WorkshopCardData
  variant: WorkshopCardVariant
  currentUser?: { name: string | null; email: string | null } | null
  alreadyRegistered?: boolean
}) {
  const formattedDate = formatWorkshopDate(workshop.scheduledAt)

  if (variant === 'past') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold leading-snug">
            {workshop.title}
          </CardTitle>
          <CardDescription className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            {formattedDate}
          </CardDescription>
        </CardHeader>
        {workshop.hasApprovedSummary ? (
          <CardFooter>
            <a
              href={`/portal/workshops/${workshop.id}/summary`}
              className="text-sm font-medium hover:underline"
              style={{ color: 'var(--cl-primary, #000a1e)' }}
            >
              View summary &rarr;
            </a>
          </CardFooter>
        ) : null}
      </Card>
    )
  }

  // upcoming | live
  const hasCalLink = workshop.calcomEventTypeId !== null
  const available =
    workshop.maxSeats === null
      ? null
      : Math.max(0, workshop.maxSeats - workshop.registeredCount)
  const isFullyBooked = available === 0
  const disabled = !hasCalLink || isFullyBooked

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold leading-snug">
          {workshop.title}
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            {formattedDate}
          </span>
          {variant === 'live' ? (
            <Badge
              className="font-semibold"
              style={{
                backgroundColor: 'var(--status-accepted-bg)',
                color: 'var(--status-accepted-text)',
              }}
            >
              Live now
            </Badge>
          ) : null}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {workshop.description ? (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {workshop.description}
          </p>
        ) : null}
        {variant === 'upcoming' ? (
          <div>
            <SpotsLeftBadge
              maxSeats={workshop.maxSeats}
              registeredCount={workshop.registeredCount}
            />
          </div>
        ) : null}
      </CardContent>

      <CardFooter>
        {alreadyRegistered ? (
          <div className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm font-medium text-emerald-800">
              You&apos;re registered
            </p>
          </div>
        ) : (
          <RegisterForm
            workshopId={workshop.id}
            workshopTitle={workshop.title}
            disabled={disabled}
            prefillName={currentUser?.name}
            prefillEmail={currentUser?.email}
          />
        )}
      </CardFooter>
    </Card>
  )
}

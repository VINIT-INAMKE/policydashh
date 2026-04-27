/**
 * Phase 20 Plan 20-05 - public workshop listing card.
 *
 * Three visual variants per UI-SPEC Surface A §Card Anatomy:
 *   - "upcoming": full card + RegisterForm + spots-left badge
 *   - "live":     full card + RegisterForm + "Live now" header badge (no spots)
 *   - "past":     compact card (title + date), optional "Summary available" note
 *
 * Register CTA is always enabled for upcoming/live workshops — the server
 * query `listPublicWorkshops` gates on `googleCalendarEventId IS NOT NULL`
 * so every card reaching this component is provisioned end-to-end.
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
import { formatWorkshopTime } from '@/src/lib/format-workshop-time'

export interface WorkshopCardData {
  id: string
  title: string
  description: string | null
  scheduledAt: Date
  durationMinutes: number | null
  googleCalendarEventId: string
  maxSeats: number | null
  // F23: external registration URL. When set, the card offers a secondary
  // "Register elsewhere" link below the register form.
  registrationLink: string | null
  // Source-of-truth IANA tz for the date label below. Without this the
  // formatter rendered in server tz (UTC on Vercel) instead of the
  // workshop's own zone, mismatching the admin's typed time + the email.
  timezone: string | null
  registeredCount: number
  hasApprovedSummary: boolean
}

export type WorkshopCardVariant = 'upcoming' | 'live' | 'past'

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
  const formattedDate = formatWorkshopTime(workshop.scheduledAt, workshop.timezone)

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
            <span className="text-sm text-muted-foreground">
              Summary available on request
            </span>
          </CardFooter>
        ) : null}
      </Card>
    )
  }

  // upcoming | live
  const available =
    workshop.maxSeats === null
      ? null
      : Math.max(0, workshop.maxSeats - workshop.registeredCount)
  const isFullyBooked = available === 0
  const disabled = isFullyBooked

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
          <div className="flex w-full flex-col items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm font-medium text-emerald-800">
                You&apos;re registered
              </p>
            </div>
            <p className="text-xs text-emerald-900/80">
              Need to cancel? Use the link in your confirmation email.
            </p>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-2">
            <RegisterForm
              workshopId={workshop.id}
              workshopTitle={workshop.title}
              disabled={disabled}
              prefillName={currentUser?.name}
              prefillEmail={currentUser?.email}
            />
            {/* F23: external registration link fallback. Admins can set this
                when they want to route attendees to another system (e.g.
                Eventbrite); we surface it as a secondary action below the
                primary register button. */}
            {workshop.registrationLink ? (
              <a
                href={workshop.registrationLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-center text-xs text-muted-foreground underline decoration-dotted hover:text-foreground"
              >
                Or register via external link
              </a>
            ) : null}
          </div>
        )}
      </CardFooter>
    </Card>
  )
}

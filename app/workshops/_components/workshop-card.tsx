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
 *
 * Redesign (breathing-room pass): wider container in page.tsx, accent bar at
 * top of upcoming/live cards, register form separated from browsing content
 * via border-t CardFooter, reduced line-clamp, tighter already-registered block.
 */
import Link from 'next/link'
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
import { cn } from '@/lib/utils'
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
      <Link
        href={`/workshops/${workshop.id}`}
        className="block rounded-lg transition-colors hover:bg-muted/30"
      >
        <Card className="h-full transition-all duration-150 hover:border-foreground/30 hover:shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold leading-snug">
              {workshop.title}
            </CardTitle>
            <CardDescription className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              {formattedDate}
            </CardDescription>
          </CardHeader>
          {workshop.description ? (
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {workshop.description}
              </p>
            </CardContent>
          ) : null}
          <CardFooter className="flex items-center justify-between">
            {workshop.hasApprovedSummary ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                Summary available
              </span>
            ) : <span />}
            <span className="text-sm font-medium text-foreground">
              View details →
            </span>
          </CardFooter>
        </Card>
      </Link>
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
    <Card className="relative overflow-hidden transition-all duration-150 hover:shadow-md">
      {/* Status accent bar — 4px band at the very top of the card */}
      <div
        className={cn(
          'absolute inset-x-0 top-0 h-1',
          variant === 'live' ? 'bg-emerald-500' : 'bg-slate-200',
        )}
        aria-hidden="true"
      />

      {/* Push content below the accent bar */}
      <CardHeader className="pt-6">
        <CardTitle className="text-lg font-semibold leading-snug">
          <Link
            href={`/workshops/${workshop.id}`}
            className="hover:underline decoration-foreground/40 underline-offset-2"
          >
            {workshop.title}
          </Link>
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
          <p className="text-sm text-muted-foreground line-clamp-2">
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

      {/* Action zone — visually separated from browsing content */}
      <CardFooter className="border-t pt-4">
        {alreadyRegistered ? (
          <div className="flex w-full flex-col gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm font-medium text-emerald-800">
                You&apos;re registered
              </p>
            </div>
            <p className="text-xs text-emerald-900/80">
              Need to cancel? Use the link in your confirmation email.
            </p>
            <Link
              href={`/workshops/${workshop.id}`}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-900 hover:underline"
            >
              View details →
            </Link>
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
            {/* F23: external registration link fallback. Right-aligned inline
                with the form footer so it doesn't stack awkwardly below. */}
            {workshop.registrationLink ? (
              <a
                href={workshop.registrationLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-right text-xs text-muted-foreground underline decoration-dotted hover:text-foreground"
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

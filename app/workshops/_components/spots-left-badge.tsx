/**
 * Phase 20 Plan 20-05 - Spots-left badge for public workshop cards.
 *
 * Tint rules (UI-SPEC Surface A §Upcoming/Live Workshop Card Anatomy):
 *   maxSeats is null       -> render nothing (open registration)
 *   available === 0        -> "Fully booked" (secondary Badge)
 *   1 <= available <= 3    -> destructive tint via --status-rejected-bg
 *   available > 3          -> "{n} spots left" (secondary Badge)
 *
 * Source of `registeredCount`: the server-side per-workshop unstable_cache
 * query in `src/server/queries/workshops-public.ts` - see Plan 20-05 Task 2.
 * Low-stock tint uses `--status-rejected-bg` + `text-destructive` to stay
 * within the existing design-token surface area (no new color tokens).
 */
import { Badge } from '@/components/ui/badge'

export interface SpotsLeftBadgeProps {
  maxSeats: number | null
  registeredCount: number
}

export function SpotsLeftBadge({
  maxSeats,
  registeredCount,
}: SpotsLeftBadgeProps) {
  if (maxSeats === null) return null

  const available = Math.max(0, maxSeats - registeredCount)

  if (available === 0) {
    return <Badge variant="secondary">Fully booked</Badge>
  }

  const plural = available === 1 ? 'spot' : 'spots'

  if (available <= 3) {
    return (
      <Badge
        className="font-semibold"
        style={{
          backgroundColor: 'var(--status-rejected-bg)',
          color: 'var(--destructive)',
        }}
      >
        {available} {plural} left
      </Badge>
    )
  }

  return (
    <Badge variant="secondary">
      {available} {plural} left
    </Badge>
  )
}

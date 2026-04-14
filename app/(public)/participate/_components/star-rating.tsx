'use client'

/**
 * StarRating — 1-5 star radiogroup input for the workshop feedback form (Phase 20).
 *
 * Built in-phase from lucide `Star` icons to avoid a third-party dependency.
 * Visual contract per 20-UI-SPEC.md Surface B "Star Rating Input Component":
 *   - `role="radiogroup"` container
 *   - Each star: `<button>` with `role="radio"` + `aria-checked` + `aria-label="N stars"`
 *   - 44x44px touch target (`h-11 w-11`) — WCAG 2.5.5 minimum
 *   - Active fill: `var(--cl-primary, #000a1e)`
 *   - Empty stroke: `var(--cl-outline, #74777f)`
 */

import { Star } from 'lucide-react'

interface StarRatingProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}

const STARS = [1, 2, 3, 4, 5] as const

export function StarRating({ value, onChange, disabled = false }: StarRatingProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Rating"
      className="flex gap-1"
    >
      {STARS.map((n) => {
        const active = value >= n
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            disabled={disabled}
            onClick={() => onChange(n)}
            className="h-11 w-11 flex items-center justify-center rounded-md transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Star
              className="h-7 w-7 transition-colors"
              style={
                active
                  ? { fill: 'var(--cl-primary,#000a1e)', color: 'var(--cl-primary,#000a1e)' }
                  : { fill: 'none', color: 'var(--cl-outline,#74777f)' }
              }
            />
          </button>
        )
      })}
    </div>
  )
}

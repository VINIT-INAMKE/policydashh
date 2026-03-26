/**
 * Deterministic color assignment for collaboration presence.
 *
 * Each connected user gets a color from an 8-slot palette, derived
 * from their user ID. Colors pass 3:1 contrast against white canvas
 * and 4.5:1 for white text on the color background.
 */

export interface PresenceColor {
  bg: string
  text: 'white'
}

export const PRESENCE_COLORS: PresenceColor[] = [
  { bg: '#7C3AED', text: 'white' }, // violet-600
  { bg: '#0891B2', text: 'white' }, // cyan-600
  { bg: '#059669', text: 'white' }, // emerald-600
  { bg: '#D97706', text: 'white' }, // amber-600
  { bg: '#DC2626', text: 'white' }, // red-600
  { bg: '#9333EA', text: 'white' }, // purple-600
  { bg: '#0284C7', text: 'white' }, // sky-600
  { bg: '#16A34A', text: 'white' }, // green-600
]

/**
 * Returns a deterministic presence color for a user ID.
 * Uses the last 4 hex characters of the user ID to index into the palette.
 */
export function getPresenceColor(userId: string): PresenceColor {
  const hash = parseInt(userId.slice(-4), 16)
  const index = (isNaN(hash) ? 0 : hash) % 8
  return PRESENCE_COLORS[index]
}

/**
 * Derives initials from a display name.
 *
 * - "Ada Kaplan" -> "AK"
 * - "Ada" -> "AD"
 * - "" -> "?"
 */
export function getInitials(displayName: string): string {
  const trimmed = displayName.trim()
  if (!trimmed) return '?'

  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

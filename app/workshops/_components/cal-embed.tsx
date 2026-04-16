/**
 * Phase 20 Plan 20-05 - cal.com embed client wrapper.
 *
 * Loaded lazily by `cal-embed-modal.tsx` via `next/dynamic({ ssr: false })`.
 * The cal.com JS bundle touches `window` at mount, so SSR would crash.
 *
 * Pitfall 6 (20-RESEARCH.md): each embed instance needs a unique `namespace`
 * string, otherwise reopening the modal after navigation triggers cal.com's
 * "Inline embed already exists. Ignoring this call." silent failure. We use
 * the workshopId as the namespace.
 */
'use client'

import Cal from '@calcom/embed-react'

export default function CalEmbed({
  calLink,
  workshopId,
  prefillDate,
}: {
  calLink: string
  workshopId: string
  prefillDate?: string
}) {
  return (
    <Cal
      calLink={calLink}
      namespace={workshopId}
      style={{ width: '100%', minHeight: 400 }}
      config={{
        ...(prefillDate ? { date: prefillDate } : {}),
      }}
    />
  )
}

// Single-source formatter for workshop date/time strings shown in our UI.
//
// `Date.toLocaleString` without an explicit `timeZone` falls back to the
// runtime's local zone — which is the SERVER's tz on SSR (UTC on Vercel)
// and the browser's tz on hydration. Both diverge from the workshop's own
// `timezone` field, so wall times rendered to stakeholders disagreed with
// what the admin typed and what cal.com showed in the email.
//
// Always pass the workshop's `timezone` (defaulting to Asia/Kolkata for
// rows that predate F9 / for legacy null values). The `timeZoneName: 'short'`
// suffix renders the actual zone (e.g. "IST", "EDT") so attendees see the
// source-of-truth tz next to the time, not just a bare "10:00 AM".

export function formatWorkshopTime(
  d: Date | string,
  timeZone: string | null | undefined,
): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timeZone || 'Asia/Kolkata',
    timeZoneName: 'short',
  })
}

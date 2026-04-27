// Wall-clock <-> UTC conversion in a specific IANA timezone.
//
// HTML <input type="datetime-local"> produces "YYYY-MM-DDTHH:mm" with NO
// timezone. `new Date(value)` interprets that string in the BROWSER's
// local timezone, which is wrong when the workshop has its own IANA
// timezone (admin in Singapore creates a workshop in Asia/Kolkata →
// stored as 02:00 UTC instead of 04:30 UTC).
//
// These helpers do the conversion server-side using only `Intl`, so the
// workshop's own timezone field is the source of truth, never the admin's
// browser locale.

const WALL_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

export function wallTimeToUtc(wallTime: string, timeZone: string): Date {
  const m = WALL_TIME_RE.exec(wallTime)
  if (!m) {
    throw new Error(`Invalid wall time: "${wallTime}" (expected YYYY-MM-DDTHH:mm)`)
  }
  const Y  = Number(m[1])
  const Mo = Number(m[2])
  const D  = Number(m[3])
  const H  = Number(m[4])
  const Mi = Number(m[5])
  const S  = m[6] ? Number(m[6]) : 0

  // 1) Treat the wall time AS IF it were UTC and get its ms value.
  const guessUtcMs = Date.UTC(Y, Mo - 1, D, H, Mi, S)

  // 2) Ask Intl what wall clock the target zone would display for that
  //    same instant. The diff between the two is the zone's offset at
  //    that wall time (positive = zone is ahead of UTC, e.g. IST = +5:30).
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year:   'numeric',
    month:  '2-digit',
    day:    '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(new Date(guessUtcMs))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0')
  let zH = get('hour')
  if (zH === 24) zH = 0 // some locales render midnight as "24"
  const zonedAsUtcMs = Date.UTC(get('year'), get('month') - 1, get('day'), zH, get('minute'), get('second'))
  const offsetMs = guessUtcMs - zonedAsUtcMs

  // 3) The TRUE UTC for the requested wall time is guess + offset.
  return new Date(guessUtcMs + offsetMs)
}

export function utcToWallTime(utc: Date | string, timeZone: string): string {
  const d = typeof utc === 'string' ? new Date(utc) : utc
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year:   'numeric',
    month:  '2-digit',
    day:    '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  let hh = get('hour')
  if (hh === '24') hh = '00'
  return `${get('year')}-${get('month')}-${get('day')}T${hh}:${get('minute')}`
}

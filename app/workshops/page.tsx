/**
 * Phase 20 Plan 20-05 - public `/workshops` listing page.
 *
 * Server component, unauthenticated (see proxy.ts PUBLIC_ROUTES whitelist
 * added in Plan 20-03 - `/workshops(.*)`). Renders three sections per D-06:
 *
 *   - Upcoming: status='upcoming' AND scheduledAt > now()
 *   - Live Now: status='in_progress'
 *   - Past:     status='completed' AND scheduledAt < now()
 *
 * Layout + copy come from UI-SPEC Surface A verbatim (max-w-3xl wrapper,
 * 28px page headline with Newsreader headline font; CL design tokens global in :root).
 *
 * Caching: the listPublicWorkshops helper caches the per-workshop registered
 * count via unstable_cache (60s revalidate). `export const dynamic` below
 * still uses force-dynamic because we want every request to re-run the
 * sectioning filter against `now()` - the cache sits at the query level.
 */
import { createHash } from 'node:crypto'
import type { Metadata } from 'next'
import { and, eq, inArray } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { CalendarX } from 'lucide-react'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { workshopRegistrations } from '@/src/db/schema/workshops'
import { listPublicWorkshops } from '@/src/server/queries/workshops-public'
import { WorkshopCard } from './_components/workshop-card'

export const metadata: Metadata = {
  title: 'Register for a Workshop | Civilization Lab',
  description:
    'Join a live consultation session and share your expertise directly with the policy team.',
}

// SSR every request. Spot-count cache lives at the unstable_cache layer inside
// `listPublicWorkshops`, so this export does not negate the 60s TTL - it only
// ensures the section filter (which depends on Date.now()) re-evaluates.
export const dynamic = 'force-dynamic'

export default async function WorkshopsPage() {
  const all = await listPublicWorkshops()
  const now = Date.now()

  // Pre-fill registration for logged-in users + track which workshops they're registered for
  const { userId } = await auth()
  let currentUser: { name: string | null; email: string | null } | null = null
  const registeredWorkshopIds = new Set<string>()
  if (userId) {
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
      columns: { name: true, email: true },
    })
    currentUser = user ?? null

    if (user?.email) {
      const emailHash = createHash('sha256')
        .update(user.email.toLowerCase().trim())
        .digest('hex')
      const workshopIds = all.map((w) => w.id)
      if (workshopIds.length > 0) {
        // S2: treat both 'registered' and 'rescheduled' as active so a
        // rescheduled booking still shows the "You're registered" card
        // instead of re-offering the register form (which would 409 on
        // double-submit with a confusing "already registered" error).
        const regs = await db
          .select({ workshopId: workshopRegistrations.workshopId })
          .from(workshopRegistrations)
          .where(
            and(
              eq(workshopRegistrations.emailHash, emailHash),
              inArray(workshopRegistrations.status, ['registered', 'rescheduled']),
              inArray(workshopRegistrations.workshopId, workshopIds),
            ),
          )
        regs.forEach((r) => registeredWorkshopIds.add(r.workshopId))
      }
    }
  }

  // Buffer for "the workshop has clearly ended even if admin hasn't clicked End"
  const STALE_BUFFER_MS = 30 * 60_000  // 30 min after estimated end

  const isStale = (w: typeof all[number]): boolean => {
    const endTime = w.scheduledAt.getTime() + (w.durationMinutes ?? 60) * 60_000
    return endTime + STALE_BUFFER_MS < now
  }

  const upcoming = all.filter(
    (w) => w.status === 'upcoming' && w.scheduledAt.getTime() > now,
  )
  const live = all.filter(
    (w) => w.status === 'in_progress' && !isStale(w),
  )
  // "Past" catches: explicitly-completed workshops, plus upcoming/in_progress
  // workshops where the admin forgot to click "End Workshop" and the scheduled
  // end time has clearly passed.
  const past = all
    .filter((w) => {
      if (w.status === 'archived') return false  // hidden by design
      if (w.status === 'completed') return true
      return isStale(w)
    })
    // Sort most recent first so users see the newest past workshop on top
    .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())

  const isEmpty = upcoming.length === 0 && live.length === 0 && past.length === 0

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-4 pt-16 pb-16 sm:px-6 sm:pt-24">
        <header className="mb-12 text-center sm:mb-16">
          <h1
            className="text-[28px] font-semibold leading-[1.2] text-[var(--cl-on-surface)]"
            style={{ fontFamily: 'var(--font-cl-headline, Newsreader, serif)' }}
          >
            Register for a Workshop
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Join a live consultation session and share your expertise directly with the policy team.
          </p>
        </header>

        {isEmpty ? (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <div className="rounded-full bg-muted p-4">
              <CalendarX className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-base font-semibold text-[var(--cl-on-surface)]">
              No workshops scheduled yet
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Check back soon &mdash; upcoming consultation sessions will appear here.
            </p>
          </div>
        ) : (
          <>
            {upcoming.length > 0 ? (
              <section className="mb-16">
                <div className="mb-6 flex items-baseline justify-between">
                  <h2
                    className="text-2xl font-semibold leading-[1.15] text-[var(--cl-on-surface)]"
                    style={{ fontFamily: 'var(--font-cl-headline, Newsreader, serif)' }}
                  >
                    Upcoming Workshops
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {upcoming.length} {upcoming.length === 1 ? 'session' : 'sessions'}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
                  {upcoming.map((w) => (
                    <WorkshopCard key={w.id} workshop={w} variant="upcoming" currentUser={currentUser} alreadyRegistered={registeredWorkshopIds.has(w.id)} />
                  ))}
                </div>
              </section>
            ) : null}

            {live.length > 0 ? (
              <section className="mb-16">
                <div className="mb-6 flex items-baseline justify-between">
                  <h2
                    className="text-2xl font-semibold leading-[1.15] text-[var(--cl-on-surface)]"
                    style={{ fontFamily: 'var(--font-cl-headline, Newsreader, serif)' }}
                  >
                    Live Now
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {live.length} {live.length === 1 ? 'session' : 'sessions'}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
                  {live.map((w) => (
                    <WorkshopCard key={w.id} workshop={w} variant="live" currentUser={currentUser} alreadyRegistered={registeredWorkshopIds.has(w.id)} />
                  ))}
                </div>
              </section>
            ) : null}

            {past.length > 0 ? (
              <section>
                <div className="mb-6 flex items-baseline justify-between">
                  <h2
                    className="text-2xl font-semibold leading-[1.15] text-[var(--cl-on-surface)]"
                    style={{ fontFamily: 'var(--font-cl-headline, Newsreader, serif)' }}
                  >
                    Past Workshops
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {past.length} {past.length === 1 ? 'session' : 'sessions'}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
                  {past.map((w) => (
                    <WorkshopCard key={w.id} workshop={w} variant="past" currentUser={currentUser} />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </main>
    </div>
  )
}

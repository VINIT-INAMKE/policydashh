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
 * 28px page headline with Newsreader headline font; .cl-landing inherited from (public)/layout.tsx per Phase 21 D-02).
 *
 * Caching: the listPublicWorkshops helper caches the per-workshop registered
 * count via unstable_cache (60s revalidate). `export const dynamic` below
 * still uses force-dynamic because we want every request to re-run the
 * sectioning filter against `now()` - the cache sits at the query level.
 */
import type { Metadata } from 'next'
import { CalendarX } from 'lucide-react'
import { listPublicWorkshops } from '@/src/server/queries/workshops-public'
import { WorkshopCard } from './_components/workshop-card'

export const metadata: Metadata = {
  title: 'Register for a Workshop | PolicyDash',
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

  const upcoming = all.filter(
    (w) => w.status === 'upcoming' && w.scheduledAt.getTime() > now,
  )
  const live = all.filter((w) => w.status === 'in_progress')
  const past = all.filter(
    (w) => w.status === 'completed' && w.scheduledAt.getTime() < now,
  )

  const isEmpty = upcoming.length === 0 && live.length === 0 && past.length === 0

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-3xl px-4 pt-12 pb-16 sm:px-6 sm:pt-16">
        <header className="mb-8 text-center sm:mb-12">
          <h1
            className="text-[28px] font-semibold leading-[1.2] text-[var(--cl-on-surface)]"
            style={{ fontFamily: 'var(--font-cl-headline, Newsreader, serif)' }}
          >
            Register for a Workshop
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Join a live consultation session and share your expertise directly with the policy team.
          </p>
        </header>

        {isEmpty ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <CalendarX className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
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
              <section className="mb-12">
                <h2 className="mb-4 text-xl font-semibold leading-[1.2] text-[var(--cl-on-surface)]">
                  Upcoming Workshops
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {upcoming.map((w) => (
                    <WorkshopCard key={w.id} workshop={w} variant="upcoming" />
                  ))}
                </div>
              </section>
            ) : null}

            {live.length > 0 ? (
              <section className="mb-12">
                <h2 className="mb-4 text-xl font-semibold leading-[1.2] text-[var(--cl-on-surface)]">
                  Live Now
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {live.map((w) => (
                    <WorkshopCard key={w.id} workshop={w} variant="live" />
                  ))}
                </div>
              </section>
            ) : null}

            {past.length > 0 ? (
              <section>
                <h2 className="mb-4 text-xl font-semibold leading-[1.2] text-[var(--cl-on-surface)]">
                  Past Workshops
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {past.map((w) => (
                    <WorkshopCard key={w.id} workshop={w} variant="past" />
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

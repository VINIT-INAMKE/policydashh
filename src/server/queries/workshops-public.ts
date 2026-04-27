/**
 * Phase 20 Plan 20-05 - public `/workshops` listing query.
 *
 * NOT a tRPC procedure: the public listing is server-rendered and does not
 * need a caller-side tRPC client hop. This is a plain async helper consumed
 * directly by `app/(public)/workshops/page.tsx`.
 *
 * Caching strategy (D-07, 20-RESEARCH.md §Pattern 4 Option B):
 *   - `unstable_cache` is deprecated but still functional in Next.js 16.
 *   - `'use cache'` requires `cacheComponents: true` in next.config.ts, which
 *     this project does NOT enable - so `unstable_cache` is the correct
 *     choice for this phase.
 *   - Per-workshop `getRegisteredCount` is cached with a 60s revalidate and
 *     tag keyed on the workshopId, so future Plan 20-04 / Plan 20-06 writes
 *     can invalidate granularly via `revalidateTag(`workshop-spots-${id}`)`.
 *
 * Gating (D-03): only workshops with a non-null `calcomEventTypeId` are
 * returned - the admin-side Inngest cal.com provisioning flow (Plan 20-02)
 * backfills this column asynchronously, so a workshop only surfaces to the
 * public listing AFTER its cal.com event type exists.
 *
 * Spots-left math (D-07, Plan 20-05 critical corrections):
 *   maxSeats IS NULL  -> no badge (open registration, registeredCount ignored)
 *   otherwise         -> max(0, maxSeats - registeredCount)
 *   registeredCount   -> COUNT(workshop_registrations WHERE status != 'cancelled')
 */
import { unstable_cache } from 'next/cache'
import { and, eq, ne, isNotNull, count } from 'drizzle-orm'
import { db } from '@/src/db'
import {
  workshops,
  workshopRegistrations,
  workshopArtifacts,
} from '@/src/db/schema/workshops'

export type PublicWorkshopStatus =
  | 'upcoming'
  | 'in_progress'
  | 'completed'
  | 'archived'

export interface PublicWorkshop {
  id: string
  title: string
  description: string | null
  scheduledAt: Date
  durationMinutes: number | null
  status: PublicWorkshopStatus
  calcomEventTypeId: string | null
  maxSeats: number | null
  // F23: external registration override. Surfaced to the card as a fallback
  // when cal.com is not wired for this workshop. Admins set this on the
  // create/edit form when they want to route registrations to another
  // system entirely (e.g. Eventbrite).
  registrationLink: string | null
  // Source-of-truth IANA tz for rendering scheduledAt. Without this the
  // public card formatter would fall back to server tz (UTC on Vercel),
  // showing wall times that disagree with what the admin typed.
  timezone: string | null
  registeredCount: number
  hasApprovedSummary: boolean
}

/**
 * Per-workshop registered-count lookup. Cached for 60 seconds and tagged so
 * the cal.com webhook handler (BOOKING_CREATED / _CANCELLED / _RESCHEDULED)
 * can `revalidateTag('workshop-spots-${workshopId}')` after writes land.
 *
 * F5: `unstable_cache` options.tags is a static string[] in Next.js 16, so
 * we must build a per-workshopId cache closure on demand rather than sharing
 * one function with dynamic tags. The outer wrapper below memoizes these
 * closures per workshopId to avoid re-allocating them on every SSR pass.
 */
// L4 (audit 2026-04-27): bound the closure cache so a long-lived Vercel
// function process touching many workshop ids doesn't leak unbounded.
// Map preserves insertion order, so deleting `keys().next().value` evicts
// the oldest entry — simple LRU that's fine for our scale (~hundreds of
// workshops over the platform's lifetime).
const PER_WORKSHOP_CACHE_MAX = 200
const perWorkshopCountCache = new Map<string, () => Promise<number>>()

export function getRegisteredCount(workshopId: string): Promise<number> {
  let fn = perWorkshopCountCache.get(workshopId)
  if (!fn) {
    if (perWorkshopCountCache.size >= PER_WORKSHOP_CACHE_MAX) {
      const oldest = perWorkshopCountCache.keys().next().value
      if (oldest !== undefined) perWorkshopCountCache.delete(oldest)
    }
    fn = unstable_cache(
      async () => {
        const [row] = await db
          .select({ n: count() })
          .from(workshopRegistrations)
          .where(
            and(
              eq(workshopRegistrations.workshopId, workshopId),
              ne(workshopRegistrations.status, 'cancelled'),
            ),
          )
        return Number(row?.n ?? 0)
      },
      ['workshop-registered-count', workshopId],
      { revalidate: 60, tags: [`workshop-spots-${workshopId}`] },
    )
    perWorkshopCountCache.set(workshopId, fn)
  }
  return fn()
}

/**
 * Load all public-visible workshops with spot counts and summary flags.
 * Sectioning (upcoming / live / past) happens in the page component - this
 * helper is status-agnostic and returns everything with a cal.com link.
 */
export async function listPublicWorkshops(): Promise<PublicWorkshop[]> {
  const rows = await db
    .select({
      id: workshops.id,
      title: workshops.title,
      description: workshops.description,
      scheduledAt: workshops.scheduledAt,
      durationMinutes: workshops.durationMinutes,
      status: workshops.status,
      calcomEventTypeId: workshops.calcomEventTypeId,
      maxSeats: workshops.maxSeats,
      registrationLink: workshops.registrationLink,
      timezone: workshops.timezone,
    })
    .from(workshops)
    .where(isNotNull(workshops.calcomEventTypeId))

  const results: PublicWorkshop[] = []
  for (const w of rows) {
    const registeredCount = await getRegisteredCount(w.id)
    const [summary] = await db
      .select({ n: count() })
      .from(workshopArtifacts)
      .where(
        and(
          eq(workshopArtifacts.workshopId, w.id),
          eq(workshopArtifacts.artifactType, 'summary'),
          eq(workshopArtifacts.reviewStatus, 'approved'),
        ),
      )
    results.push({
      id: w.id,
      title: w.title,
      description: w.description,
      scheduledAt: w.scheduledAt,
      durationMinutes: w.durationMinutes,
      status: w.status,
      calcomEventTypeId: w.calcomEventTypeId,
      maxSeats: w.maxSeats,
      registrationLink: w.registrationLink,
      timezone: w.timezone,
      registeredCount,
      hasApprovedSummary: Number(summary?.n ?? 0) > 0,
    })
  }
  return results
}

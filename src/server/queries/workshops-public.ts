/**
 * Phase 20 Plan 20-05 — public `/workshops` listing query.
 *
 * NOT a tRPC procedure: the public listing is server-rendered and does not
 * need a caller-side tRPC client hop. This is a plain async helper consumed
 * directly by `app/(public)/workshops/page.tsx`.
 *
 * Caching strategy (D-07, 20-RESEARCH.md §Pattern 4 Option B):
 *   - `unstable_cache` is deprecated but still functional in Next.js 16.
 *   - `'use cache'` requires `cacheComponents: true` in next.config.ts, which
 *     this project does NOT enable — so `unstable_cache` is the correct
 *     choice for this phase.
 *   - Per-workshop `getRegisteredCount` is cached with a 60s revalidate and
 *     tag keyed on the workshopId, so future Plan 20-04 / Plan 20-06 writes
 *     can invalidate granularly via `revalidateTag(`workshop-spots-${id}`)`.
 *
 * Gating (D-03): only workshops with a non-null `calcomEventTypeId` are
 * returned — the admin-side Inngest cal.com provisioning flow (Plan 20-02)
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
  registeredCount: number
  hasApprovedSummary: boolean
}

/**
 * Per-workshop registered-count lookup. Cached for 60 seconds and tagged so
 * Plan 20-04 (BOOKING_CREATED Inngest fn) can `revalidateTag` after a new
 * registration lands.
 */
export const getRegisteredCount = unstable_cache(
  async (workshopId: string): Promise<number> => {
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
  ['workshop-registered-count'],
  { revalidate: 60 },
)

/**
 * Load all public-visible workshops with spot counts and summary flags.
 * Sectioning (upcoming / live / past) happens in the page component — this
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
      registeredCount,
      hasApprovedSummary: Number(summary?.n ?? 0) > 0,
    })
  }
  return results
}

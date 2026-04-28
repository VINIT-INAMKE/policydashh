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
 * Gating (D-03): only workshops with a non-null `googleCalendarEventId` are
 * returned - every workshop has this populated at create time (NOT NULL after
 * migration 0032), so the gate is technically vacuous but kept for defensive
 * forward-compat: only list workshops that have been provisioned end-to-end.
 *
 * Spots-left math (D-07, Plan 20-05 critical corrections):
 *   maxSeats IS NULL  -> no badge (open registration, registeredCount ignored)
 *   otherwise         -> max(0, maxSeats - registeredCount)
 *   registeredCount   -> COUNT(workshop_registrations WHERE status != 'cancelled')
 */
import { unstable_cache } from 'next/cache'
import { and, eq, ne, or, isNotNull, count } from 'drizzle-orm'
import { db } from '@/src/db'
import {
  workshops,
  workshopRegistrations,
  workshopArtifacts,
  workshopSectionLinks,
} from '@/src/db/schema/workshops'
import { evidenceArtifacts } from '@/src/db/schema/evidence'
import { policySections, policyDocuments } from '@/src/db/schema/documents'

/**
 * Tag for per-workshop detail cache. Workshop mutations call
 * `revalidateTag(workshopDetailTag(id), 'max')` to bust this.
 * Keep in lockstep with every call site that mutates workshops.
 */
export function workshopDetailTag(workshopId: string): string {
  return `workshop:${workshopId}`
}

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
  googleCalendarEventId: string
  maxSeats: number | null
  // F23: external registration override. Admins set this on the create/edit
  // form when they want to route registrations to another system (e.g. Eventbrite).
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
 * registration mutations can `revalidateTag('workshop-spots-${workshopId}')`
 * after writes land.
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
 * helper is status-agnostic and returns everything provisioned end-to-end.
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
      googleCalendarEventId: workshops.googleCalendarEventId,
      maxSeats: workshops.maxSeats,
      registrationLink: workshops.registrationLink,
      timezone: workshops.timezone,
    })
    .from(workshops)
    .where(isNotNull(workshops.googleCalendarEventId))

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
      googleCalendarEventId: w.googleCalendarEventId,
      maxSeats: w.maxSeats,
      registrationLink: w.registrationLink,
      timezone: w.timezone,
      registeredCount,
      hasApprovedSummary: Number(summary?.n ?? 0) > 0,
    })
  }
  return results
}

// ---------------------------------------------------------------------------
// Public workshop detail (single-workshop permalink)
// ---------------------------------------------------------------------------

export type PublicWorkshopDetail = {
  id: string
  title: string
  description: string | null
  scheduledAt: Date
  durationMinutes: number | null
  status: 'upcoming' | 'in_progress' | 'completed' | 'archived'
  timezone: string
  maxSeats: number | null
  registrationLink: string | null
  meetingUrl: string | null  // nullable: hidden from unauthorized viewers
  meetingProvisionedBy: 'google_meet' | 'manual'
  googleCalendarEventId: string
  registeredCount: number
  hasApprovedSummary: boolean
  /** Approved summary artifact text, promoted to top-level, or null if none. */
  summary: string | null
  sections: Array<{
    sectionId: string
    sectionTitle: string
    documentId: string
    documentTitle: string
  }>
  artifacts: Array<{
    id: string
    title: string
    artifactType: 'promo' | 'recording' | 'transcript' | 'summary' | 'attendance' | 'other'
    /** Direct URL from evidenceArtifacts.url — null if missing. */
    downloadUrl: string | null
  }>
}

/**
 * Fetch a single public-safe workshop detail row. Cached per-workshopId and
 * tagged with both the spots tag (busted by registration changes) and the
 * workshop detail tag (busted by any workshop mutation).
 *
 * Returns null when the workshop is not found or has no googleCalendarEventId
 * (not provisioned end-to-end).
 */
export async function getPublicWorkshopById(
  workshopId: string,
  opts?: { viewerHasMeetingAccess?: boolean },
): Promise<PublicWorkshopDetail | null> {
  // C7: separate cache lanes for authorized vs anonymous viewers so a cached
  // auth=true response never leaks meetingUrl to an unauthorized request.
  const accessFlag = opts?.viewerHasMeetingAccess ? 'auth' : 'anon'
  // Use a closure-per-workshopId pattern (same as getRegisteredCount) so the
  // unstable_cache tags array is statically knowable at build time.
  const cached = unstable_cache(
    async () => {
      // 1. Core workshop row
      const [row] = await db
        .select({
          id: workshops.id,
          title: workshops.title,
          description: workshops.description,
          scheduledAt: workshops.scheduledAt,
          durationMinutes: workshops.durationMinutes,
          status: workshops.status,
          timezone: workshops.timezone,
          maxSeats: workshops.maxSeats,
          registrationLink: workshops.registrationLink,
          meetingUrl: workshops.meetingUrl,
          meetingProvisionedBy: workshops.meetingProvisionedBy,
          googleCalendarEventId: workshops.googleCalendarEventId,
        })
        .from(workshops)
        .where(
          and(
            eq(workshops.id, workshopId),
            isNotNull(workshops.googleCalendarEventId),
          ),
        )

      if (!row) return null

      // 2. Registered count (non-cancelled)
      const registeredCount = await getRegisteredCount(workshopId)

      // 3. Linked sections -> policyDocuments for nav URL
      const sectionRows = await db
        .select({
          sectionId: workshopSectionLinks.sectionId,
          sectionTitle: policySections.title,
          documentId: policySections.documentId,
          documentTitle: policyDocuments.title,
        })
        .from(workshopSectionLinks)
        .innerJoin(policySections, eq(workshopSectionLinks.sectionId, policySections.id))
        .innerJoin(policyDocuments, eq(policySections.documentId, policyDocuments.id))
        .where(eq(workshopSectionLinks.workshopId, workshopId))

      // 4. Approved artifacts only (defense in depth — filter in SQL)
      const artifactRows = await db
        .select({
          id: evidenceArtifacts.id,
          title: evidenceArtifacts.title,
          artifactType: workshopArtifacts.artifactType,
          url: evidenceArtifacts.url,
        })
        .from(workshopArtifacts)
        .innerJoin(evidenceArtifacts, eq(workshopArtifacts.artifactId, evidenceArtifacts.id))
        .where(
          and(
            eq(workshopArtifacts.workshopId, workshopId),
            eq(workshopArtifacts.reviewStatus, 'approved'),
            ne(workshopArtifacts.artifactType, 'summary'),
          ),
        )

      // 5. Approved summary artifact — find the most recent one by id
      // (UUIDs are v4 random, so we just take any one; in practice there
      // should be at most one approved summary per workshop).
      const [summaryRow] = await db
        .select({
          url: evidenceArtifacts.url,
          content: evidenceArtifacts.content,
        })
        .from(workshopArtifacts)
        .innerJoin(evidenceArtifacts, eq(workshopArtifacts.artifactId, evidenceArtifacts.id))
        .where(
          and(
            eq(workshopArtifacts.workshopId, workshopId),
            eq(workshopArtifacts.artifactType, 'summary'),
            eq(workshopArtifacts.reviewStatus, 'approved'),
          ),
        )
        .limit(1)

      // Summary: prefer the text `content` field on the artifact; fall back
      // to the url string so callers can at least check truthiness.
      const summary: string | null =
        summaryRow?.content ?? summaryRow?.url ?? null

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        scheduledAt: row.scheduledAt,
        durationMinutes: row.durationMinutes,
        status: row.status,
        timezone: row.timezone,
        maxSeats: row.maxSeats,
        registrationLink: row.registrationLink,
        meetingUrl: opts?.viewerHasMeetingAccess ? row.meetingUrl : null,
        meetingProvisionedBy: row.meetingProvisionedBy as 'google_meet' | 'manual',
        googleCalendarEventId: row.googleCalendarEventId,
        registeredCount,
        hasApprovedSummary: !!summary,
        summary,
        sections: sectionRows.map((s) => ({
          sectionId: s.sectionId,
          sectionTitle: s.sectionTitle,
          documentId: s.documentId,
          documentTitle: s.documentTitle,
        })),
        artifacts: artifactRows.map((a) => ({
          id: a.id,
          title: a.title,
          artifactType: a.artifactType as PublicWorkshopDetail['artifacts'][number]['artifactType'],
          downloadUrl: a.url ?? null,
        })),
      } satisfies PublicWorkshopDetail
    },
    ['public-workshop-detail', workshopId, accessFlag],
    {
      revalidate: 60,
      tags: [spotsTag(workshopId), workshopDetailTag(workshopId)],
    },
  )
  return cached()
}

/**
 * Check whether a given internal user id (or email hash) has an active
 * (non-cancelled) registration for the workshop. Used server-side to gate
 * meeting URL display. Not cached — called per-request after auth() resolves.
 *
 * C5: accept an optional viewerEmailHash so registrations made before the
 * user row existed in our DB (userId=null) still resolve correctly. Either
 * condition matching is sufficient — OR semantics.
 */
export async function isViewerRegistered(
  workshopId: string,
  viewerUserId: string | undefined,
  viewerEmailHash?: string,
): Promise<boolean> {
  if (!viewerUserId && !viewerEmailHash) return false
  const idMatch = viewerUserId ? eq(workshopRegistrations.userId, viewerUserId) : undefined
  const emailMatch = viewerEmailHash ? eq(workshopRegistrations.emailHash, viewerEmailHash) : undefined
  const identityClause = idMatch && emailMatch
    ? or(idMatch, emailMatch)
    : (idMatch ?? emailMatch)
  const [row] = await db
    .select({ id: workshopRegistrations.id })
    .from(workshopRegistrations)
    .where(
      and(
        eq(workshopRegistrations.workshopId, workshopId),
        identityClause,
        ne(workshopRegistrations.status, 'cancelled'),
      ),
    )
    .limit(1)
  return !!row
}

// Re-export the tag builder so router files can import from one place without
// a circular dep.
export function spotsTag(workshopId: string): string {
  return `workshop-spots-${workshopId}`
}

import { z } from 'zod'
import { router, requirePermission, publicProcedure } from '@/src/trpc/init'
import { listPublicWorkshops } from '@/src/server/queries/workshops-public'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS } from '@/src/lib/constants'
import { db } from '@/src/db'
import {
  workshops,
  workshopArtifacts,
  workshopSectionLinks,
  workshopFeedbackLinks,
  workshopEvidenceChecklist,
  workshopRegistrations,
} from '@/src/db/schema/workshops'
import { evidenceArtifacts } from '@/src/db/schema/evidence'
import { users } from '@/src/db/schema/users'
import { policySections, policyDocuments } from '@/src/db/schema/documents'
import { feedbackItems } from '@/src/db/schema/feedback'
import { workflowTransitions } from '@/src/db/schema/workflow'
import {
  sendWorkshopCompleted,
  sendWorkshopRecordingUploaded,
  sendWorkshopCreated,
  sendWorkshopRemindersRescheduled,
  sendWorkshopFeedbackInvitesBatch,
} from '@/src/inngest/events'
import { revalidateTag } from 'next/cache'
import {
  createWorkshopEvent,
  cancelEvent,
  rescheduleEvent,
  addAttendeeToEvent,
  removeAttendeeFromEvent,
  GoogleCalendarError,
} from '@/src/lib/google-calendar'
import { sha256Hex } from '@/src/lib/hashing'
import { randomUUID } from 'node:crypto'
import { wallTimeToUtc } from '@/src/lib/wall-time'
import { eq, gte, lt, desc, and, count, ne, isNull, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

// C1: keep tag prefix in lockstep with the public listing query and the
// cal.com webhook handler — see `src/server/queries/workshops-public.ts`
// and `app/api/webhooks/cal/route.ts`.
function spotsTag(workshopId: string): string {
  return `workshop-spots-${workshopId}`
}

// Validate IANA timezone input by attempting `Intl.DateTimeFormat`. We
// previously used `Intl.supportedValuesOf('timeZone').has(tz)` for an
// O(1) set lookup, but that returns ONLY canonical IANA names — `Asia/
// Calcutta` is canonical, while the alias `Asia/Kolkata` (which the
// project uses everywhere as the default) was rejected even though
// `DateTimeFormat` accepts both. Cache the result per-tz so repeat
// validations stay constant-time without losing alias support.
const _tzValidationCache = new Map<string, boolean>()
function isValidTimezone(tz: string): boolean {
  const cached = _tzValidationCache.get(tz)
  if (cached !== undefined) return cached
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format()
    _tzValidationCache.set(tz, true)
    return true
  } catch {
    _tzValidationCache.set(tz, false)
    return false
  }
}
const timezoneField = z
  .string()
  .min(1)
  .max(64)
  .refine(isValidTimezone, { message: 'Invalid IANA timezone' })

// Wall-clock datetime: "YYYY-MM-DDTHH:mm" with NO timezone. The tz comes
// from the workshop's `timezone` field; the conversion happens server-side
// via `wallTimeToUtc`. We deliberately reject the strict-ISO format because
// the form's old `new Date(value).toISOString()` would silently reinterpret
// the wall time in the BROWSER's tz instead of the workshop's — corrupting
// every meeting time when admin and workshop are in different zones.
const wallTimeField = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/,
    'Expected wall time in YYYY-MM-DDTHH:mm format',
  )

// Optional URL that tolerates and trims empty/whitespace input. Plain
// `z.string().url().optional()` rejects "" — which 400'd the entire
// workshop.create mutation if the admin typed-then-deleted the field.
const optionalUrlField = z.preprocess(
  (v) => {
    if (typeof v !== 'string') return v
    const trimmed = v.trim()
    return trimmed === '' ? undefined : trimmed
  },
  z.string().url().optional(),
)

// Update variant: blank means "clear" (null), absent means "no change"
// (undefined), non-empty must be a valid URL.
const optionalNullableUrlField = z.preprocess(
  (v) => {
    if (v === undefined || v === null) return v
    if (typeof v === 'string') {
      const trimmed = v.trim()
      return trimmed === '' ? null : trimmed
    }
    return v
  },
  z.string().url().nullable().optional(),
)

// F8: mirror the webhook's transition set so the tRPC UI and the cal.com
// webhook agree on legality. The webhook jumps `upcoming -> completed`
// directly when MEETING_ENDED fires without a moderator having manually
// clicked "Start"; we accept the same jump here. `archived` can be reached
// from either `completed` (normal flow) or `upcoming` (cancelled-before-start).
// F24: `archived` -> `completed` re-opens an accidentally-archived workshop.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  upcoming:    ['in_progress', 'completed', 'archived'],
  in_progress: ['completed'],
  completed:   ['archived'],
  archived:    ['completed'],
}

// Input schema for workshop.create. Extracted from the inline .input() call
// so tests can reference it without going through the full router.
const createWorkshopInput = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  // Wall-clock time in the workshop's timezone (NOT UTC). See
  // wallTimeField above for why we don't accept strict ISO here.
  scheduledAt: wallTimeField,
  durationMinutes: z.number().int().min(15).max(480).optional(),
  registrationLink: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z.union([z.url(), z.literal('')]).optional(),
  ),
  // Phase 20 WS-07 (D-07): optional per-workshop capacity. NULL in the DB
  // means "open registration" (no "X spots left" badge on the public
  // listing). Admins set this on the create form.
  maxSeats: z.number().int().positive().optional(),
  // F9: IANA timezone name. Defaults to 'Asia/Kolkata' (project's prior
  // hardcoded value). B6-4: validated against Intl.DateTimeFormat so typos
  // can't poison downstream Google Calendar calls.
  timezone: z.string().optional(),
  // Google Calendar pivot: admin chooses whether to auto-provision a Meet
  // link ('auto_meet') or paste their own URL ('manual').
  meetingMode: z.enum(['auto_meet', 'manual']).default('auto_meet'),
  manualMeetingUrl: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z.url().optional(),
  ),
}).refine(
  (input) => input.meetingMode !== 'manual' || (input.manualMeetingUrl && input.manualMeetingUrl.length > 0),
  { message: 'manualMeetingUrl is required when meetingMode is manual', path: ['manualMeetingUrl'] },
)

export const workshopRouter = router({
  // Create a new workshop event — synchronous Google Calendar integration.
  // Steps: validate → createWorkshopEvent (GCal) → DB INSERT → Inngest fan-out.
  // On DB failure: best-effort cancelEvent to undo the GCal side.
  create: requirePermission('workshop:manage')
    .input(createWorkshopInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id
      const tz = input.timezone || 'Asia/Kolkata'
      if (!isValidTimezone(tz)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Invalid IANA timezone: ${tz}` })
      }
      const startUtc = wallTimeToUtc(input.scheduledAt, tz)
      const durationMinutes = input.durationMinutes ?? 60
      const endUtc = new Date(startUtc.getTime() + durationMinutes * 60_000)

      const organizerEmail = process.env.WORKSHOP_ORGANIZER_EMAIL
      if (!organizerEmail) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'WORKSHOP_ORGANIZER_EMAIL not configured',
        })
      }

      // 1) Create Google Calendar event synchronously
      let gcResult: { eventId: string; meetingUrl: string; htmlLink: string }
      try {
        gcResult = await createWorkshopEvent({
          title: input.title,
          description: input.description ?? null,
          startUtc,
          endUtc,
          timezone: tz,
          organizerEmail,
          meetingMode: input.meetingMode,
          manualMeetingUrl: input.meetingMode === 'manual' ? input.manualMeetingUrl : undefined,
          reminderMinutesBefore: [1440, 60],
        })
      } catch (err) {
        if (err instanceof GoogleCalendarError) {
          const code = err.status >= 500 ? 'BAD_GATEWAY' : 'BAD_REQUEST'
          throw new TRPCError({ code, message: `Google Calendar: ${err.message}` })
        }
        throw err
      }

      // 2) Insert workshop row
      let workshopId: string
      try {
        const [row] = await db.insert(workshops).values({
          title: input.title,
          description: input.description ?? null,
          scheduledAt: startUtc,
          durationMinutes,
          registrationLink: input.registrationLink || null,
          maxSeats: input.maxSeats ?? null,
          timezone: tz,
          googleCalendarEventId: gcResult.eventId,
          meetingProvisionedBy: input.meetingMode === 'auto_meet' ? 'google_meet' : 'manual',
          meetingUrl: gcResult.meetingUrl,
          createdBy: userId,
        }).returning({ id: workshops.id })
        workshopId = row.id
      } catch (dbErr) {
        // 3) Best-effort Google undo
        try {
          await cancelEvent({ eventId: gcResult.eventId })
        } catch (undoErr) {
          console.error('[workshop.create] DB INSERT failed AND Google cancel failed — orphan calendar event', {
            eventId: gcResult.eventId,
            dbErr,
            undoErr,
          })
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to persist workshop' })
      }

      // 4) Audit + Inngest reminder fan-out
      writeAuditLog({
        actorId: userId,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_CREATE,
        entityType: 'workshop',
        entityId: workshopId,
        payload: { title: input.title },
      }).catch(console.error)

      await sendWorkshopCreated({ workshopId, moderatorId: userId })

      return { id: workshopId, meetingUrl: gcResult.meetingUrl, htmlLink: gcResult.htmlLink }
    }),

  // List workshops with upcoming/past/all filter
  list: requirePermission('workshop:read')
    .input(z.object({
      filter: z.enum(['upcoming', 'past', 'all']).default('all'),
    }))
    .query(async ({ input }) => {
      const now = new Date()
      const conditions = []

      if (input.filter === 'upcoming') {
        conditions.push(gte(workshops.scheduledAt, now))
      } else if (input.filter === 'past') {
        conditions.push(lt(workshops.scheduledAt, now))
      }

      // F16: include status + Google Calendar fields so the manage page can
      // render provisioning state badges without a second lookup per card.
      const rows = await db
        .select({
          id: workshops.id,
          title: workshops.title,
          description: workshops.description,
          scheduledAt: workshops.scheduledAt,
          durationMinutes: workshops.durationMinutes,
          registrationLink: workshops.registrationLink,
          status: workshops.status,
          googleCalendarEventId: workshops.googleCalendarEventId,
          meetingUrl: workshops.meetingUrl,
          meetingProvisionedBy: workshops.meetingProvisionedBy,
          // Surfaced so the admin card formatter renders in the workshop's
          // own tz. Without this the card fell back to runtime tz (UTC on
          // Vercel SSR / browser-local on hydration), mismatching what the
          // admin typed and what Google Calendar showed in invitation emails.
          timezone: workshops.timezone,
          createdBy: workshops.createdBy,
          createdAt: workshops.createdAt,
          updatedAt: workshops.updatedAt,
          milestoneId: workshops.milestoneId,
          creatorName: users.name,
        })
        .from(workshops)
        .leftJoin(users, eq(workshops.createdBy, users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(workshops.scheduledAt))

      return rows
    }),

  // Get a single workshop by ID with linked sections, feedback, and artifact count
  getById: requirePermission('workshop:read')
    .input(z.object({ workshopId: z.string().uuid() }))
    .query(async ({ input }) => {
      // F17: include Google Calendar fields + maxSeats + timezone so the
      // detail page can render the meeting link, timezone chip, and
      // provisioning state without extra lookups.
      const [workshop] = await db
        .select({
          id: workshops.id,
          title: workshops.title,
          description: workshops.description,
          scheduledAt: workshops.scheduledAt,
          durationMinutes: workshops.durationMinutes,
          registrationLink: workshops.registrationLink,
          status: workshops.status,
          googleCalendarEventId: workshops.googleCalendarEventId,
          meetingProvisionedBy: workshops.meetingProvisionedBy,
          meetingUrl: workshops.meetingUrl,
          maxSeats: workshops.maxSeats,
          timezone: workshops.timezone,
          createdBy: workshops.createdBy,
          createdAt: workshops.createdAt,
          updatedAt: workshops.updatedAt,
          creatorName: users.name,
        })
        .from(workshops)
        .leftJoin(users, eq(workshops.createdBy, users.id))
        .where(eq(workshops.id, input.workshopId))
        .limit(1)

      if (!workshop) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workshop not found' })
      }

      // Fetch linked sections with document title
      const sections = await db
        .select({
          sectionId: workshopSectionLinks.sectionId,
          sectionTitle: policySections.title,
          documentId: policySections.documentId,
          documentTitle: policyDocuments.title,
        })
        .from(workshopSectionLinks)
        .innerJoin(policySections, eq(workshopSectionLinks.sectionId, policySections.id))
        .innerJoin(policyDocuments, eq(policySections.documentId, policyDocuments.id))
        .where(eq(workshopSectionLinks.workshopId, input.workshopId))

      // Fetch linked feedback with readableId, title, status, documentId
      // documentId enables cross-navigation from workshop detail to the
      // originating policy's feedback view (D-13).
      const feedback = await db
        .select({
          feedbackId: workshopFeedbackLinks.feedbackId,
          readableId: feedbackItems.readableId,
          title: feedbackItems.title,
          status: feedbackItems.status,
          documentId: feedbackItems.documentId,
        })
        .from(workshopFeedbackLinks)
        .innerJoin(feedbackItems, eq(workshopFeedbackLinks.feedbackId, feedbackItems.id))
        .where(eq(workshopFeedbackLinks.workshopId, input.workshopId))

      // Artifact count
      const [artifactCountResult] = await db
        .select({ count: count() })
        .from(workshopArtifacts)
        .where(eq(workshopArtifacts.workshopId, input.workshopId))

      return {
        ...workshop,
        sections,
        feedback,
        artifactCount: artifactCountResult?.count ?? 0,
      }
    }),

  // Update a workshop — propagates changes to Google Calendar before DB write
  // so a GCal failure aborts cleanly without leaving DB and calendar out of sync.
  update: requirePermission('workshop:manage')
    .input(z.object({
      workshopId: z.string().uuid(),
      title: z.string().min(2).max(120).optional(),
      description: z.string().max(2000).nullable().optional(),
      // Wall-clock time in the workshop's timezone (NOT UTC). Combined
      // with the timezone field (or the existing tz if unchanged) to
      // produce the stored UTC instant. See wallTimeField above.
      scheduledAt: wallTimeField.optional(),
      durationMinutes: z.number().int().min(15).max(480).nullable().optional(),
      registrationLink: optionalNullableUrlField,
      // F11: expose maxSeats on the update path so admins can bump capacity
      // after launch. Updating maxSeats adjusts the DB row only (no GCal
      // call needed — Google Calendar has no seat concept).
      maxSeats: z.number().int().positive().nullable().optional(),
      // F9: per-workshop timezone. Changing this triggers a Google Calendar
      // reschedule so the event displays in the correct zone for all
      // attendees. B6-4: validate against IANA so typos can't poison
      // downstream GCal calls (matches the create-path behaviour).
      timezone: timezoneField.optional(),
      // Google Calendar pivot: allow switching meeting mode on update.
      // Blocked server-side when non-cancelled registrations exist.
      meetingMode: z.enum(['auto_meet', 'manual']).optional(),
      manualMeetingUrl: z.preprocess(
        (v) => (typeof v === 'string' ? v.trim() : v),
        z.url().optional(),
      ),
    }))
    .mutation(async ({ ctx, input }) => {
      // Fetch workshop for ownership check + existing Google fields.
      // D13: pull every mutable field so we can capture a proper before/after
      // diff in the audit payload below.
      const [existing] = await db
        .select({
          createdBy: workshops.createdBy,
          googleCalendarEventId: workshops.googleCalendarEventId,
          meetingProvisionedBy: workshops.meetingProvisionedBy,
          title: workshops.title,
          description: workshops.description,
          scheduledAt: workshops.scheduledAt,
          durationMinutes: workshops.durationMinutes,
          registrationLink: workshops.registrationLink,
          maxSeats: workshops.maxSeats,
          timezone: workshops.timezone,
        })
        .from(workshops)
        .where(eq(workshops.id, input.workshopId))
        .limit(1)

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workshop not found' })
      }

      if (existing.createdBy !== ctx.user.id && ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the workshop creator or admin can update this workshop' })
      }

      const tz = input.timezone ?? existing.timezone ?? 'Asia/Kolkata'
      if (input.timezone && !isValidTimezone(tz)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Invalid IANA timezone: ${tz}` })
      }

      const newScheduledAt = input.scheduledAt
        ? wallTimeToUtc(input.scheduledAt, tz)
        : existing.scheduledAt
      const newDuration =
        input.durationMinutes !== undefined ? input.durationMinutes : existing.durationMinutes
      const newEndUtc = newDuration
        ? new Date(newScheduledAt.getTime() + newDuration * 60_000)
        : null

      const titleChanged = input.title !== undefined && input.title !== existing.title
      const descriptionChanged =
        input.description !== undefined &&
        (input.description ?? null) !== existing.description
      const scheduledAtChanged =
        newScheduledAt.getTime() !== existing.scheduledAt.getTime()
      const timezoneChanged = tz !== existing.timezone

      // Switching meeting mode mid-workshop is not supported — registrants
      // would get conflicting calendar invites. Force admin to delete + recreate.
      if (input.meetingMode && input.meetingMode !== existing.meetingProvisionedBy) {
        const [registeredRow] = await db
          .select({ n: count() })
          .from(workshopRegistrations)
          .where(
            and(
              eq(workshopRegistrations.workshopId, input.workshopId),
              ne(workshopRegistrations.status, 'cancelled'),
            ),
          )
        const registered = Number(registeredRow?.n ?? 0)
        if (registered > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'Cannot switch meeting mode after registrations exist — delete and recreate the workshop',
          })
        }
      }

      // B5-8: refuse to lower maxSeats below the current registered headcount.
      if (
        input.maxSeats !== undefined &&
        input.maxSeats !== null &&
        (existing.maxSeats === null || input.maxSeats < existing.maxSeats)
      ) {
        const [registeredRow] = await db
          .select({ n: count() })
          .from(workshopRegistrations)
          .where(
            and(
              eq(workshopRegistrations.workshopId, input.workshopId),
              ne(workshopRegistrations.status, 'cancelled'),
            ),
          )
        const registered = Number(registeredRow?.n ?? 0)
        if (input.maxSeats < registered) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Cannot lower maxSeats to ${input.maxSeats}: ${registered} attendee(s) are already registered. Cancel registrations first.`,
          })
        }
      }

      // Propagate to Google FIRST so a failure aborts before DB drift.
      if (titleChanged || descriptionChanged || scheduledAtChanged || timezoneChanged) {
        if (!existing.googleCalendarEventId) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Workshop has no Google Calendar event',
          })
        }
        if (newEndUtc === null && scheduledAtChanged) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'durationMinutes required for Google reschedule',
          })
        }
        try {
          await rescheduleEvent({
            eventId: existing.googleCalendarEventId,
            newStartUtc: scheduledAtChanged ? newScheduledAt : undefined,
            newEndUtc: scheduledAtChanged && newEndUtc ? newEndUtc : undefined,
            newTitle: titleChanged ? input.title : undefined,
            newDescription: descriptionChanged ? (input.description ?? null) : undefined,
            newTimezone: timezoneChanged ? tz : undefined,
          })
        } catch (err) {
          if (err instanceof GoogleCalendarError) {
            throw new TRPCError({
              code: err.status >= 500 ? 'BAD_GATEWAY' : 'BAD_REQUEST',
              message: `Google Calendar reschedule failed: ${err.message}`,
            })
          }
          throw err
        }
      }

      // DB update
      const [updated] = await db
        .update(workshops)
        .set({
          title: input.title ?? existing.title,
          description:
            input.description !== undefined ? input.description : existing.description,
          scheduledAt: newScheduledAt,
          durationMinutes: newDuration,
          registrationLink:
            input.registrationLink !== undefined
              ? (input.registrationLink || null)
              : existing.registrationLink,
          maxSeats: input.maxSeats !== undefined ? input.maxSeats : existing.maxSeats,
          timezone: tz,
          updatedAt: new Date(),
        })
        .where(eq(workshops.id, input.workshopId))
        .returning()

      // Reminders re-schedule fan-out — only when timing changed.
      if (scheduledAtChanged || timezoneChanged) {
        await sendWorkshopRemindersRescheduled({ workshopId: input.workshopId })
      }

      // C1: bust the spots-left cache when capacity changed (raise/lower
      // both shift the badge math) so the public /workshops listing
      // reflects the new cap immediately rather than 60s later.
      if (input.maxSeats !== undefined) {
        revalidateTag(spotsTag(input.workshopId), 'max')
      }

      // D13: capture the full before/after diff of every mutable field.
      // Evidence-pack reviewers rely on this log to reconstruct the
      // workshop's change history (scheduledAt, timezone, maxSeats, etc).
      const before: Record<string, unknown> = {}
      const after: Record<string, unknown> = {}
      const existingScheduledAtIso =
        existing.scheduledAt instanceof Date
          ? existing.scheduledAt.toISOString()
          : (existing.scheduledAt as unknown as string | null)
      if (titleChanged) { before.title = existing.title; after.title = updated.title }
      if (descriptionChanged) { before.description = existing.description; after.description = updated.description }
      if (scheduledAtChanged) {
        before.scheduledAt = existingScheduledAtIso
        // Audit log records resolved UTC ISO (not the wall-time input) so
        // reviewers compare apples to apples regardless of which tz the
        // admin typed in.
        after.scheduledAt = newScheduledAt.toISOString()
      }
      if (input.durationMinutes !== undefined) {
        before.durationMinutes = existing.durationMinutes
        after.durationMinutes = updated.durationMinutes
      }
      if (input.registrationLink !== undefined) {
        before.registrationLink = existing.registrationLink
        after.registrationLink = updated.registrationLink
      }
      if (input.maxSeats !== undefined) {
        before.maxSeats = existing.maxSeats
        after.maxSeats = updated.maxSeats
      }
      if (timezoneChanged) { before.timezone = existing.timezone; after.timezone = updated.timezone }

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_UPDATE,
        entityType: 'workshop',
        entityId: input.workshopId,
        payload: { before, after },
      }).catch(console.error)

      return updated
    }),

  // Delete a workshop (ownership check, cascades to artifacts and links)
  delete: requirePermission('workshop:manage')
    .input(z.object({
      workshopId: z.string().uuid(),
      // F12: require explicit `force: true` to delete a workshop that has
      // active (non-cancelled) registrations. Default behavior is to reject
      // with a clear error listing the affected attendee count, so admins
      // don't accidentally nuke a fully-booked upcoming workshop.
      force: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Fetch workshop for ownership check + Google Calendar event id
      const [existing] = await db
        .select({
          createdBy: workshops.createdBy,
          googleCalendarEventId: workshops.googleCalendarEventId,
          title: workshops.title,
        })
        .from(workshops)
        .where(eq(workshops.id, input.workshopId))
        .limit(1)

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workshop not found' })
      }

      if (existing.createdBy !== ctx.user.id && ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the workshop creator or admin can delete this workshop' })
      }

      // F12: active-registration guard.
      // D12: the client parses `activeCount` from the error message so the
      // DeleteWorkshopDialog can render a force-confirm with the exact count.
      // Keep the "ACTIVE_REGISTRATIONS:<n>:" prefix stable - the UI greps for it.
      if (!input.force) {
        const [activeCount] = await db
          .select({ n: count() })
          .from(workshopRegistrations)
          .where(
            and(
              eq(workshopRegistrations.workshopId, input.workshopId),
              ne(workshopRegistrations.status, 'cancelled'),
            ),
          )
        const activeN = Number(activeCount?.n ?? 0)
        if (activeN > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `ACTIVE_REGISTRATIONS:${activeN}:Workshop has ${activeN} active registration(s). Cancel them first, or pass force: true to delete anyway.`,
          })
        }
      }

      // Cancel the Google Calendar event BEFORE the DB delete so a GCal
      // failure aborts cleanly without leaving the row orphaned.
      // cancelEvent already swallows 404 internally, so a missing-in-Google
      // event won't block the DB delete.
      if (existing.googleCalendarEventId) {
        try {
          await cancelEvent({ eventId: existing.googleCalendarEventId })
        } catch (err) {
          if (err instanceof GoogleCalendarError) {
            throw new TRPCError({
              code: err.status >= 500 ? 'BAD_GATEWAY' : 'BAD_REQUEST',
              message: `Google Calendar cancel failed: ${err.message}`,
            })
          }
          throw err
        }
      }

      await db.delete(workshops).where(eq(workshops.id, input.workshopId))
      // ON DELETE CASCADE handles workshop_registrations rows.

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_DELETE,
        entityType: 'workshop',
        entityId: input.workshopId,
        payload: { forced: Boolean(input.force) },
      }).catch(console.error)

      return { success: true }
    }),

  // Attach an artifact to a workshop (creates evidence artifact + workshop link)
  attachArtifact: requirePermission('workshop:manage')
    .input(z.object({
      workshopId: z.string().uuid(),
      title: z.string().min(1),
      type: z.enum(['file', 'link']),
      url: z.string().url(),
      artifactType: z.enum(['promo', 'recording', 'transcript', 'summary', 'attendance', 'other']),
      fileName: z.string().optional(),
      fileSize: z.number().optional(),
      // r2Key is required for the recording pipeline (WS-14): the Inngest
      // function needs the raw R2 object key to call getDownloadUrl on,
      // because the public URL is not signed and not useful to Groq's fetch.
      r2Key: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Insert into evidenceArtifacts first
      const [artifact] = await db
        .insert(evidenceArtifacts)
        .values({
          title: input.title,
          type: input.type,
          url: input.url,
          fileName: input.fileName ?? null,
          fileSize: input.fileSize ?? null,
          uploaderId: ctx.user.id,
        })
        .returning()

      // Then link to workshop - sequential, no transaction (Neon HTTP driver).
      // Capture the inserted workshopArtifact row id so we can pass it to the
      // recording pipeline event below (it identifies the link-row, not the
      // underlying evidence artifact).
      const [workshopArtifact] = await db
        .insert(workshopArtifacts)
        .values({
          workshopId: input.workshopId,
          artifactId: artifact.id,
          artifactType: input.artifactType,
        })
        .returning({ id: workshopArtifacts.id })

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_ARTIFACT_ATTACH,
        entityType: 'workshop',
        entityId: input.workshopId,
        payload: { artifactId: artifact.id, artifactType: input.artifactType, title: input.title },
      }).catch(console.error)

      // Fire the Inngest pipeline for recording uploads (WS-14). We only
      // emit when the caller supplied both artifactType='recording' and a
      // usable r2Key - uploads via the public URL form (e.g. external link
      // artifacts) never enter the Groq pipeline.
      if (input.artifactType === 'recording' && input.r2Key) {
        await sendWorkshopRecordingUploaded({
          workshopId:         input.workshopId,
          workshopArtifactId: workshopArtifact.id,
          r2Key:              input.r2Key,
          moderatorId:        ctx.user.id,
        })
      }

      return artifact
    }),

  // Remove an artifact link from a workshop (preserves evidence record)
  removeArtifact: requirePermission('workshop:manage')
    .input(z.object({
      workshopId: z.string().uuid(),
      artifactId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(workshopArtifacts)
        .where(
          and(
            eq(workshopArtifacts.workshopId, input.workshopId),
            eq(workshopArtifacts.artifactId, input.artifactId),
          ),
        )

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_ARTIFACT_REMOVE,
        entityType: 'workshop',
        entityId: input.workshopId,
        payload: { artifactId: input.artifactId },
      }).catch(console.error)

      return { success: true }
    }),

  // List artifacts for a workshop with uploader name
  listArtifacts: requirePermission('workshop:read')
    .input(z.object({ workshopId: z.string().uuid() }))
    .query(async ({ input }) => {
      const rows = await db
        .select({
          id: evidenceArtifacts.id,
          title: evidenceArtifacts.title,
          type: evidenceArtifacts.type,
          url: evidenceArtifacts.url,
          fileName: evidenceArtifacts.fileName,
          fileSize: evidenceArtifacts.fileSize,
          uploaderId: evidenceArtifacts.uploaderId,
          createdAt: evidenceArtifacts.createdAt,
          artifactType: workshopArtifacts.artifactType,
          reviewStatus: workshopArtifacts.reviewStatus,
          workshopArtifactId: workshopArtifacts.id,
          uploaderName: users.name,
        })
        .from(workshopArtifacts)
        .innerJoin(evidenceArtifacts, eq(workshopArtifacts.artifactId, evidenceArtifacts.id))
        .leftJoin(users, eq(evidenceArtifacts.uploaderId, users.id))
        .where(eq(workshopArtifacts.workshopId, input.workshopId))

      return rows
    }),

  // List evidence checklist for a workshop (WS-13)
  listChecklist: requirePermission('workshop:read')
    .input(z.object({ workshopId: z.string().uuid() }))
    .query(async ({ input }) => {
      const rows = await db
        .select({
          id:         workshopEvidenceChecklist.id,
          slot:       workshopEvidenceChecklist.slot,
          status:     workshopEvidenceChecklist.status,
          artifactId: workshopEvidenceChecklist.artifactId,
          filledAt:   workshopEvidenceChecklist.filledAt,
          createdAt:  workshopEvidenceChecklist.createdAt,
        })
        .from(workshopEvidenceChecklist)
        .where(eq(workshopEvidenceChecklist.workshopId, input.workshopId))

      return rows
    }),

  // Link a section to a workshop
  linkSection: requirePermission('workshop:manage')
    .input(z.object({
      workshopId: z.string().uuid(),
      sectionId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db
        .insert(workshopSectionLinks)
        .values({ workshopId: input.workshopId, sectionId: input.sectionId })
        .onConflictDoNothing()

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_SECTION_LINK,
        entityType: 'workshop',
        entityId: input.workshopId,
        payload: { sectionId: input.sectionId },
      }).catch(console.error)

      return { success: true }
    }),

  // Unlink a section from a workshop
  unlinkSection: requirePermission('workshop:manage')
    .input(z.object({
      workshopId: z.string().uuid(),
      sectionId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(workshopSectionLinks)
        .where(
          and(
            eq(workshopSectionLinks.workshopId, input.workshopId),
            eq(workshopSectionLinks.sectionId, input.sectionId),
          ),
        )

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_SECTION_UNLINK,
        entityType: 'workshop',
        entityId: input.workshopId,
        payload: { sectionId: input.sectionId },
      }).catch(console.error)

      return { success: true }
    }),

  // Link a feedback item to a workshop
  linkFeedback: requirePermission('workshop:manage')
    .input(z.object({
      workshopId: z.string().uuid(),
      feedbackId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db
        .insert(workshopFeedbackLinks)
        .values({ workshopId: input.workshopId, feedbackId: input.feedbackId })
        .onConflictDoNothing()

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_FEEDBACK_LINK,
        entityType: 'workshop',
        entityId: input.workshopId,
        payload: { feedbackId: input.feedbackId },
      }).catch(console.error)

      return { success: true }
    }),

  // Unlink a feedback item from a workshop
  unlinkFeedback: requirePermission('workshop:manage')
    .input(z.object({
      workshopId: z.string().uuid(),
      feedbackId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(workshopFeedbackLinks)
        .where(
          and(
            eq(workshopFeedbackLinks.workshopId, input.workshopId),
            eq(workshopFeedbackLinks.feedbackId, input.feedbackId),
          ),
        )

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_FEEDBACK_UNLINK,
        entityType: 'workshop',
        entityId: input.workshopId,
        payload: { feedbackId: input.feedbackId },
      }).catch(console.error)

      return { success: true }
    }),

  // Transition workshop through its status lifecycle (WS-06)
  transition: requirePermission('workshop:manage')
    .input(z.object({
      workshopId: z.string().uuid(),
      toStatus: z.enum(['in_progress', 'completed', 'archived']),
    }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select({
          id: workshops.id,
          status: workshops.status,
          createdBy: workshops.createdBy,
        })
        .from(workshops)
        .where(eq(workshops.id, input.workshopId))
        .limit(1)

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workshop not found' })
      }

      const allowedNext = ALLOWED_TRANSITIONS[existing.status] ?? []
      if (!allowedNext.includes(input.toStatus)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Invalid transition: ${existing.status} → ${input.toStatus}. Allowed next states: ${allowedNext.join(', ') || '(none - terminal)'}`,
        })
      }

      await db
        .update(workshops)
        .set({ status: input.toStatus, updatedAt: new Date() })
        .where(eq(workshops.id, input.workshopId))

      await db.insert(workflowTransitions).values({
        entityType: 'workshop',
        entityId:   input.workshopId,
        fromState:  existing.status,
        toState:    input.toStatus,
        actorId:    ctx.user.id,
        metadata:   { triggeredBy: 'workshop.transition' },
      })

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_TRANSITION,
        entityType: 'workshop',
        entityId: input.workshopId,
        payload: { fromStatus: existing.status, toStatus: input.toStatus },
      }).catch(console.error)

      if (input.toStatus === 'completed') {
        // D5: dispatch the evidence-nudge to the ACTING user (ctx.user.id),
        // not existing.createdBy. If an admin completes a workshop for a
        // creator who has since left or been anonymized, the nudge email
        // still reaches someone responsible for the next-step artifacts.
        await sendWorkshopCompleted({
          workshopId: input.workshopId,
          moderatorId: ctx.user.id,
        })
        // H-1 (audit 2026-04-27 wide review): stamp completionPipelineSentAt
        // here so a subsequent MEETING_ENDED webhook delivery doesn't see
        // the column null and re-fire `sendWorkshopCompleted` (which would
        // double-send the evidence-nudge emails). Single canonical writer
        // shared between this admin transition path and the cal.com
        // webhook handler.
        await db
          .update(workshops)
          .set({ completionPipelineSentAt: new Date() })
          .where(
            and(
              eq(workshops.id, input.workshopId),
              isNull(workshops.completionPipelineSentAt),
            ),
          )
      }

      return { success: true, fromStatus: existing.status, toStatus: input.toStatus }
    }),

  // Task 14 (Google Calendar pivot): admin-triggered manual completion.
  // Mirrors the post-completion fan-out logic from the cal.com MEETING_ENDED
  // webhook handler (app/api/webhooks/cal/route.ts) which will be removed in
  // Task 22. Both paths stamp `completionPipelineSentAt` so repeated calls are
  // idempotent and the webhook can't double-fire the evidence-nudge pipeline.
  endWorkshop: requirePermission('workshop:manage')
    .input(z.object({ workshopId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(workshops)
        .where(eq(workshops.id, input.workshopId))
        .limit(1)

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workshop not found' })
      }

      // Idempotent re-run: already completed AND pipeline already fired.
      if (existing.status === 'completed' && existing.completionPipelineSentAt != null) {
        return { alreadyCompleted: true, registrantsNotified: 0 }
      }

      if (existing.status === 'archived') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot end an archived workshop',
        })
      }

      const now = new Date()
      const fromStatus = existing.status

      await db
        .update(workshops)
        .set({
          status: 'completed',
          completionPipelineSentAt: now,
          updatedAt: now,
        })
        .where(eq(workshops.id, input.workshopId))

      await db.insert(workflowTransitions).values({
        entityType: 'workshop',
        entityId:   input.workshopId,
        fromState:  fromStatus,
        toState:    'completed',
        actorId:    ctx.user.id,
        metadata:   { triggeredBy: 'workshop.endWorkshop' },
      })

      // Collect all non-cancelled registrants for feedback invites.
      const registrants = await db
        .select({
          email:  workshopRegistrations.email,
          name:   workshopRegistrations.name,
          userId: workshopRegistrations.userId,
        })
        .from(workshopRegistrations)
        .where(
          and(
            eq(workshopRegistrations.workshopId, input.workshopId),
            ne(workshopRegistrations.status, 'cancelled'),
          ),
        )

      await sendWorkshopCompleted({
        workshopId:  input.workshopId,
        moderatorId: ctx.user.id,
      })

      await sendWorkshopFeedbackInvitesBatch(
        registrants.map((r) => ({
          workshopId:     input.workshopId,
          email:          r.email,
          name:           r.name ?? '',
          attendeeUserId: r.userId ?? null,
        })),
      )

      writeAuditLog({
        actorId:    ctx.user.id,
        actorRole:  ctx.user.role,
        action:     ACTIONS.WORKSHOP_END,
        entityType: 'workshop',
        entityId:   input.workshopId,
        payload:    { fromStatus, registrantsNotified: registrants.length },
      }).catch(console.error)

      return { alreadyCompleted: false, registrantsNotified: registrants.length }
    }),

  // Task 15: Mark a single registration as attended or not attended.
  markAttendance: requirePermission('workshop:manage')
    .input(z.object({
      workshopId: z.string().uuid(),
      registrationId: z.string().uuid(),
      attended: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date()
      await db.update(workshopRegistrations).set({
        attendedAt: input.attended ? now : null,
        attendanceSource: input.attended ? 'manual' : null,
        updatedAt: now,
      }).where(eq(workshopRegistrations.id, input.registrationId))

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_MARK_ATTENDANCE,
        entityType: 'workshop_registration',
        entityId: input.registrationId,
        payload: { workshopId: input.workshopId, attended: input.attended },
      }).catch(console.error)

      return { ok: true as const }
    }),

  // Task 15: Bulk-mark all non-cancelled, not-yet-attended registrants as present.
  markAllPresent: requirePermission('workshop:manage')
    .input(z.object({ workshopId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date()
      const result = await db.update(workshopRegistrations).set({
        attendedAt: now,
        attendanceSource: 'manual',
        updatedAt: now,
      }).where(
        and(
          eq(workshopRegistrations.workshopId, input.workshopId),
          ne(workshopRegistrations.status, 'cancelled'),
          sql`${workshopRegistrations.attendedAt} IS NULL`,
        ),
      ).returning({ id: workshopRegistrations.id })

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_MARK_ALL_PRESENT,
        entityType: 'workshop',
        entityId: input.workshopId,
        payload: { affected: result.length },
      }).catch(console.error)

      return { affected: result.length }
    }),

  // Task 15: Register a walk-in attendee who didn't pre-register via cal.com.
  // Does NOT call addAttendeeToEvent — the workshop has already happened.
  // On email collision with an existing non-cancelled row: stamps attendance
  // instead of inserting a duplicate.
  addWalkIn: requirePermission('workshop:manage')
    .input(z.object({
      workshopId: z.string().uuid(),
      email: z.string().email(),
      name: z.string().min(1).max(120),
    }))
    .mutation(async ({ ctx, input }) => {
      const emailNorm = input.email.toLowerCase().trim()
      const emailHash = sha256Hex(emailNorm)
      const now = new Date()

      // Check for existing non-cancelled registration with the same email.
      const [existing] = await db
        .select({ id: workshopRegistrations.id })
        .from(workshopRegistrations)
        .where(
          and(
            eq(workshopRegistrations.workshopId, input.workshopId),
            eq(workshopRegistrations.emailHash, emailHash),
            ne(workshopRegistrations.status, 'cancelled'),
          ),
        )
        .limit(1)

      if (existing) {
        await db.update(workshopRegistrations).set({
          attendedAt: now,
          attendanceSource: 'manual',
          updatedAt: now,
        }).where(eq(workshopRegistrations.id, existing.id))

        writeAuditLog({
          actorId: ctx.user.id,
          actorRole: ctx.user.role,
          action: ACTIONS.WORKSHOP_ADD_WALK_IN,
          entityType: 'workshop_registration',
          entityId: existing.id,
          payload: { workshopId: input.workshopId, collisionExisting: true },
        }).catch(console.error)

        return { added: false as const, attendanceMarked: true, registrationId: existing.id }
      }

      // No existing row — fetch workshop for bookingStartTime, then insert.
      const [workshop] = await db
        .select({ scheduledAt: workshops.scheduledAt })
        .from(workshops)
        .where(eq(workshops.id, input.workshopId))
        .limit(1)
      if (!workshop) throw new TRPCError({ code: 'NOT_FOUND' })

      const [inserted] = await db.insert(workshopRegistrations).values({
        workshopId: input.workshopId,
        bookingUid: `walkin_${randomUUID()}`,
        email: emailNorm,
        emailHash,
        name: input.name,
        status: 'registered',
        attendedAt: now,
        attendanceSource: 'manual',
        bookingStartTime: workshop.scheduledAt,
        inviteSentAt: null,
      }).returning({ id: workshopRegistrations.id })

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_ADD_WALK_IN,
        entityType: 'workshop_registration',
        entityId: inserted.id,
        payload: { workshopId: input.workshopId, collisionExisting: false },
      }).catch(console.error)

      return { added: true as const, registrationId: inserted.id }
    }),

  // Task 15: Retry sending a Google Calendar invite to a registrant whose
  // initial invite failed at registration time (inviteSentAt IS NULL).
  resendInvite: requirePermission('workshop:manage')
    .input(z.object({
      workshopId: z.string().uuid(),
      registrationId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [reg] = await db
        .select()
        .from(workshopRegistrations)
        .where(eq(workshopRegistrations.id, input.registrationId))
        .limit(1)
      if (!reg) throw new TRPCError({ code: 'NOT_FOUND', message: 'Registration not found' })
      if (reg.inviteSentAt) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invite already sent' })
      }

      const [w] = await db
        .select({ googleCalendarEventId: workshops.googleCalendarEventId })
        .from(workshops)
        .where(eq(workshops.id, input.workshopId))
        .limit(1)
      if (!w?.googleCalendarEventId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workshop event missing' })
      }

      try {
        await addAttendeeToEvent({
          eventId: w.googleCalendarEventId,
          attendeeEmail: reg.email,
          attendeeName: reg.name ?? '',
        })
      } catch (err) {
        if (err instanceof GoogleCalendarError) {
          throw new TRPCError({
            code: err.status >= 500 ? 'BAD_GATEWAY' : 'BAD_REQUEST',
            message: `Resend failed: ${err.message}`,
          })
        }
        throw err
      }

      const now = new Date()
      await db.update(workshopRegistrations).set({
        inviteSentAt: now,
        updatedAt: now,
      }).where(eq(workshopRegistrations.id, input.registrationId))

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_RESEND_INVITE,
        entityType: 'workshop_registration',
        entityId: input.registrationId,
        payload: { workshopId: input.workshopId },
      }).catch(console.error)

      return { ok: true as const }
    }),

  // Task 15: Cancel a single registration. When notify=true, removes the
  // attendee from the Google Calendar event (best-effort — errors are logged
  // but never block the DB cancel). Busts the spots-left cache tag.
  cancelRegistration: requirePermission('workshop:manage')
    .input(z.object({
      workshopId: z.string().uuid(),
      registrationId: z.string().uuid(),
      notify: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [reg] = await db
        .select()
        .from(workshopRegistrations)
        .where(eq(workshopRegistrations.id, input.registrationId))
        .limit(1)
      if (!reg) throw new TRPCError({ code: 'NOT_FOUND', message: 'Registration not found' })

      if (input.notify) {
        const [w] = await db
          .select({ googleCalendarEventId: workshops.googleCalendarEventId })
          .from(workshops)
          .where(eq(workshops.id, input.workshopId))
          .limit(1)
        if (w?.googleCalendarEventId) {
          try {
            await removeAttendeeFromEvent({
              eventId: w.googleCalendarEventId,
              attendeeEmail: reg.email,
            })
          } catch (err) {
            console.error('[cancelRegistration] Google removeAttendee failed (non-blocking)', err)
          }
        }
      }

      const now = new Date()
      await db.update(workshopRegistrations).set({
        status: 'cancelled',
        cancelledAt: now,
        updatedAt: now,
      }).where(eq(workshopRegistrations.id, input.registrationId))

      revalidateTag(spotsTag(input.workshopId), 'max')

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_CANCEL_REGISTRATION,
        entityType: 'workshop_registration',
        entityId: input.registrationId,
        payload: { workshopId: input.workshopId, notify: input.notify },
      }).catch(console.error)

      return { ok: true as const }
    }),

  // Approve a draft artifact (flip reviewStatus from 'draft' to 'approved') - WS-14
  approveArtifact: requirePermission('workshop:manage')
    .input(z.object({
      workshopId: z.string().uuid(),
      workshopArtifactId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(workshopArtifacts)
        .set({ reviewStatus: 'approved' })
        .where(
          and(
            eq(workshopArtifacts.id, input.workshopArtifactId),
            eq(workshopArtifacts.workshopId, input.workshopId),
          ),
        )

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_ARTIFACT_APPROVE,
        entityType: 'workshop',
        entityId: input.workshopId,
        payload: { workshopArtifactId: input.workshopArtifactId },
      }).catch(console.error)

      return { success: true }
    }),

  // F18: attendee list for a workshop. Used by the manage detail page's
  // Attendees tab. Returns email/name/status/registration time/attendance so
  // moderators can verify who's coming + who actually showed up.
  // D1: gated on `workshop:read_attendees` (admin + workshop_moderator only).
  // `workshop:read` would also admit stakeholder/observer/auditor/research_lead,
  // who must not enumerate registrant PII by workshop UUID. Keep `workshop:read`
  // on list/getById for the public-facing detail views.
  listRegistrations: requirePermission('workshop:read_attendees')
    .input(z.object({ workshopId: z.string().uuid() }))
    .query(async ({ input }) => {
      const rows = await db
        .select({
          id:                 workshopRegistrations.id,
          email:              workshopRegistrations.email,
          name:               workshopRegistrations.name,
          status:             workshopRegistrations.status,
          bookingUid:         workshopRegistrations.bookingUid,
          bookingStartTime:   workshopRegistrations.bookingStartTime,
          registeredAt:       workshopRegistrations.createdAt,
          cancelledAt:        workshopRegistrations.cancelledAt,
          attendedAt:         workshopRegistrations.attendedAt,
          attendanceSource:   workshopRegistrations.attendanceSource,
        })
        .from(workshopRegistrations)
        .where(eq(workshopRegistrations.workshopId, input.workshopId))
        .orderBy(desc(workshopRegistrations.createdAt))
      return rows
    }),

  // Phase 20 Plan 20-05 (D-05, D-06, D-07, D-08, WS-08):
  // Public listing of workshops with cal.com event types, unauthenticated.
  // Wraps the `listPublicWorkshops` helper in `src/server/queries/workshops-public.ts`
  // so tRPC clients (future admin preview, /workshops SSR page can also call
  // directly) share the same cached spots-left query. unstable_cache handles
  // the 60s revalidate + per-workshopId tagging (research Option B).
  listPublicWorkshops: publicProcedure.query(async () => {
    return listPublicWorkshops()
  }),
})

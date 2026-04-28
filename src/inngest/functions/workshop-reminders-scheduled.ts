import { eq, and, ne } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { inngest } from '../client'
import { db } from '@/src/db'
import { workshops, workshopRegistrations } from '@/src/db/schema/workshops'
import { sendWorkshopReminderEmail } from '@/src/lib/email'
import { formatWorkshopTime } from '@/src/lib/format-workshop-time'

/**
 * workshopRemindersScheduledFn — 24h + 1h reminder fan-out.
 *
 * Triggered by `workshop.created` (initial) and `workshop.reminders_rescheduled`
 * (after `workshop.update` propagates a time change to Google Calendar).
 *
 * Cancellation pattern: each run captures `scheduledAt` at schedule time as
 * `scheduledAtAtSchedule`. After every `sleepUntil` it re-queries the DB
 * and exits silently if (a) the workshop was deleted, (b) status='archived',
 * or (c) `scheduledAt !== scheduledAtAtSchedule` (a newer reschedule run
 * is now responsible). The old `sleepUntil` slot wastes Inngest sleep but
 * Inngest pricing isn't sleep-bound — this beats wiring up the
 * invocation-cancel API.
 *
 * Pitfall 4 (Inngest v4): `triggers` MUST be inlined in createFunction
 * options. Do not refactor into a const.
 */

type ReminderHandlerArgs = {
  event: { data: { workshopId: string } }
  step: {
    run: <T>(id: string, fn: () => Promise<T>) => Promise<T>
    sleepUntil: (id: string, time: Date) => Promise<void>
  }
}

async function loadWorkshop(workshopId: string) {
  const [row] = await db
    .select({
      id: workshops.id,
      title: workshops.title,
      scheduledAt: workshops.scheduledAt,
      timezone: workshops.timezone,
      meetingUrl: workshops.meetingUrl,
      status: workshops.status,
    })
    .from(workshops)
    .where(eq(workshops.id, workshopId))
    .limit(1)
  return row ?? null
}

async function loadActiveRegistrations(workshopId: string) {
  return db
    .select({
      email: workshopRegistrations.email,
      name: workshopRegistrations.name,
    })
    .from(workshopRegistrations)
    .where(
      and(
        eq(workshopRegistrations.workshopId, workshopId),
        ne(workshopRegistrations.status, 'cancelled'),
      ),
    )
}

/**
 * I8: Hash email address to a short, safe step id segment.
 * Inngest memoizes step.run results by id — giving each email its own
 * step.run means a retry only re-executes the failing step, not all
 * previously-sent emails. SHA-256 first 16 hex chars is collision-safe
 * for the ~hundreds of recipients per workshop we expect.
 */
function stepKey(email: string): string {
  return createHash('sha256').update(email).digest('hex').slice(0, 16)
}

export async function _internal_handler(args: ReminderHandlerArgs) {
  const { workshopId } = args.event.data

  const initial = await args.step.run('load-workshop-initial', async () => loadWorkshop(workshopId))
  if (!initial || initial.status === 'archived') return
  const scheduledAtAtSchedule = initial.scheduledAt.toISOString()

  // C6: 30-minute safety buffer. When scheduledAt is too close to now, the
  // target sleep time is already in the past — sleepUntil would resolve
  // immediately and fire reminder emails with a stale/wrong window label.
  // Skip each reminder individually so a workshop scheduled 2h out still
  // gets its 1h reminder even though 24h is skipped.
  // Workshops with <30min lead get NO reminders — acceptable for ad-hoc events.
  const SAFETY_BUFFER_MS = 30 * 60_000
  const now = Date.now()
  const t24 = new Date(initial.scheduledAt.getTime() - 24 * 60 * 60 * 1000)
  const t1 = new Date(initial.scheduledAt.getTime() - 60 * 60 * 1000)

  // 24h reminder — only if t24 is at least SAFETY_BUFFER_MS in the future
  if (t24.getTime() > now + SAFETY_BUFFER_MS) {
    await args.step.sleepUntil('sleep-24h', t24)
    const at24h = await args.step.run('check-and-send-24h', async () => {
      const fresh = await loadWorkshop(workshopId)
      if (!fresh || fresh.status === 'archived') return null
      if (fresh.scheduledAt.toISOString() !== scheduledAtAtSchedule) return null
      return fresh
    })
    if (at24h) {
      // I8: load recipients as a memoized step so we don't re-query on retry.
      const recipients24 = await args.step.run('load-recipients-24h', async () =>
        loadActiveRegistrations(workshopId)
      )
      // I8: each email gets its own memoized step so Inngest retries skip
      // already-sent emails (memoized by step id = prefix + hash(email)).
      for (const r of recipients24) {
        await args.step.run(`send-24h-${stepKey(r.email)}`, async () => {
          try {
            await sendWorkshopReminderEmail(r.email, {
              name: r.name,
              workshopTitle: at24h.title,
              meetingUrl: at24h.meetingUrl,
              scheduledAtLabel: formatWorkshopTime(at24h.scheduledAt, at24h.timezone),
              windowLabel: 'in 24 hours',
            })
          } catch (err) {
            console.error('[reminders] 24h send failed', { email: r.email, err })
            // Swallow per-recipient failures so other recipients still get their
            // step.run memoized successfully on this run, and a retry only
            // re-fires the failing step rather than the entire batch.
          }
        })
      }
    }
  }

  // 1h reminder — only if t1 is at least SAFETY_BUFFER_MS in the future
  if (t1.getTime() > now + SAFETY_BUFFER_MS) {
    await args.step.sleepUntil('sleep-1h', t1)
    const at1h = await args.step.run('check-and-send-1h', async () => {
      const fresh = await loadWorkshop(workshopId)
      if (!fresh || fresh.status === 'archived') return null
      if (fresh.scheduledAt.toISOString() !== scheduledAtAtSchedule) return null
      return fresh
    })
    if (at1h) {
      // I8: same per-email step pattern as the 24h block.
      const recipients1h = await args.step.run('load-recipients-1h', async () =>
        loadActiveRegistrations(workshopId)
      )
      for (const r of recipients1h) {
        await args.step.run(`send-1h-${stepKey(r.email)}`, async () => {
          try {
            await sendWorkshopReminderEmail(r.email, {
              name: r.name,
              workshopTitle: at1h.title,
              meetingUrl: at1h.meetingUrl,
              scheduledAtLabel: formatWorkshopTime(at1h.scheduledAt, at1h.timezone),
              windowLabel: 'in 1 hour',
            })
          } catch (err) {
            console.error('[reminders] 1h send failed', { email: r.email, err })
          }
        })
      }
    }
  }
}

export const workshopRemindersScheduledFn = inngest.createFunction(
  {
    id: 'workshop-reminders-scheduled',
    name: 'Workshop reminders — 24h + 1h fan-out via sleepUntil',
    retries: 3,
    // INLINE triggers - Pitfall 4.
    triggers: [
      { event: 'workshop.created' },
      { event: 'workshop.reminders_rescheduled' },
    ],
  },
  _internal_handler as any,
)

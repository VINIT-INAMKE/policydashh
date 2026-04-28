import { eq, and, ne } from 'drizzle-orm'
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

async function sendBatch(
  args: { workshopId: string; windowLabel: string },
  snap: { title: string; scheduledAt: Date; timezone: string; meetingUrl: string },
) {
  const recipients = await loadActiveRegistrations(args.workshopId)
  for (const r of recipients) {
    try {
      await sendWorkshopReminderEmail(r.email, {
        name: r.name,
        workshopTitle: snap.title,
        meetingUrl: snap.meetingUrl,
        scheduledAtLabel: formatWorkshopTime(snap.scheduledAt, snap.timezone),
        windowLabel: args.windowLabel,
      })
    } catch (err) {
      console.error('[reminders] send failed', { email: r.email, err })
    }
  }
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
      await args.step.run('send-24h-batch', async () => {
        await sendBatch({ workshopId, windowLabel: 'in 24 hours' }, at24h)
      })
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
      await args.step.run('send-1h-batch', async () => {
        await sendBatch({ workshopId, windowLabel: 'in 1 hour' }, at1h)
      })
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

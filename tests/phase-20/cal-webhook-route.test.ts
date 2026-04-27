import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { createHmac, createHash } from 'node:crypto'

/**
 * Plan 20-03 Task 1 RED contract:
 * POST /api/webhooks/cal must
 *   - read raw body BEFORE JSON.parse
 *   - verify x-cal-signature-256 via verifyCalSignature helper
 *   - return 401 on missing / invalid signature (NOT 400)
 *   - return 500 when CAL_WEBHOOK_SECRET is unset
 *   - dispatch by triggerEvent { BOOKING_CREATED, BOOKING_CANCELLED, BOOKING_RESCHEDULED, MEETING_ENDED }
 *   - parse payload defensively: `body.payload ?? body`
 *   - BOOKING_RESCHEDULED matches on payload.rescheduleUid (NOT payload.uid)
 *   - MEETING_ENDED synthesizes walk-in rows with bookingUid = `walkin:{workshopId}:{sha256(email)}`
 *   - MEETING_ENDED transitions workshop through workflowTransitions insert with actorId='system:cal-webhook'
 *   - fires one sendWorkshopFeedbackInvite per attendee
 */

// --- DB mock builder ------------------------------------------------
// Drizzle query-builder calls are chained; we return a thenable proxy.
function makeChainMock(resolveValue: unknown) {
  const chain: Record<string, unknown> = {}
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(target, prop: string) {
      if (prop === 'then') {
        return (onFulfilled: (v: unknown) => unknown) => Promise.resolve(resolveValue).then(onFulfilled)
      }
      if (prop === 'catch') {
        return (onRejected: (e: unknown) => unknown) => Promise.resolve(resolveValue).catch(onRejected)
      }
      return (..._args: unknown[]) => new Proxy(chain, handler)
    },
  }
  return new Proxy(chain, handler)
}

const mocks = vi.hoisted(() => ({
  dbSelectResults: [] as unknown[][],
  dbInsertCalls: [] as Array<{ table: string; values: unknown }>,
  dbUpdateCalls: [] as Array<{
    table: string
    set: unknown
    where: string
    returning?: unknown[]
  }>,
  sendWorkshopRegistrationReceived: vi.fn().mockResolvedValue(undefined),
  sendWorkshopFeedbackInvite: vi.fn().mockResolvedValue(undefined),
  sendWorkshopFeedbackInvitesBatch: vi.fn().mockResolvedValue(undefined),
  sendWorkshopCompleted: vi.fn().mockResolvedValue(undefined),
  revalidateTag: vi.fn(),
  // Audit 2026-04-27 M2: when true, the processed_webhook_events insert
  // returns [] from .returning(...) — the handler short-circuits to 200
  // (replay). Default false so existing tests see "fresh event, proceed".
  processedWebhookReplay: false,
}))

vi.mock('next/cache', () => ({
  revalidateTag: mocks.revalidateTag,
}))

// Batch-1 exports mirrored so the route-under-test resolves them against
// this mock instead of touching the real calcom module (which imports
// 'server-only' and blocks in tests).
vi.mock('@/src/lib/calcom', () => ({
  UID_SAFE: /^[A-Za-z0-9_-]+$/,
  COMPOSITE_BOOKING_UID_DELIMITER: ':',
  DEFAULT_SEATS_PER_TIME_SLOT: 100,
  WORKSHOP_CREATED_EVENT: 'workshop.created',
  buildCompositeBookingUid: (rootUid: string, attendeeId: number) =>
    `${rootUid}:${attendeeId}`,
  cascadePattern: (rootUid: string) => `${rootUid}:%`,
}))

vi.mock('@/src/inngest/events', () => ({
  sendWorkshopRegistrationReceived: mocks.sendWorkshopRegistrationReceived,
  sendWorkshopFeedbackInvite: mocks.sendWorkshopFeedbackInvite,
  sendWorkshopFeedbackInvitesBatch: mocks.sendWorkshopFeedbackInvitesBatch,
  sendWorkshopCompleted: mocks.sendWorkshopCompleted,
}))

// Build a db mock that tracks select results (queue), insert calls, update calls.
vi.mock('@/src/db', () => {
  // B7-4: drizzle's internal table-name symbol is exposed (and re-exported
  // for hackery like this) via `Table.Symbol.Name`. Reaching through the
  // public symbol object rather than `.toString()`-matching on every
  // global symbol keeps the mock robust across drizzle version bumps —
  // the earlier `Symbol(drizzle:Name)` string match broke silently if
  // drizzle renamed the symbol.
  const tableNameFor = (t: unknown): string => {
    if (t && typeof t === 'object') {
      try {
        // Lazy require so the mock factory remains synchronous.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { Table } = require('drizzle-orm')
        const nameSym = Table?.Symbol?.Name as symbol | undefined
        if (nameSym) {
          const val = (t as unknown as Record<symbol, unknown>)[nameSym]
          if (typeof val === 'string') return val
        }
      } catch {
        /* drizzle unavailable in this context — fall through */
      }
      // Legacy fallback — still matches older drizzle releases that
      // only exposed the symbol via .toString().
      const sym = Object.getOwnPropertySymbols(t).find(
        (s) => s.toString() === 'Symbol(drizzle:Name)',
      )
      if (sym) {
        const val = (t as unknown as Record<symbol, unknown>)[sym]
        if (typeof val === 'string') return val
      }
    }
    return 'unknown'
  }

  const selectMock = vi.fn(() => {
    // queue-based return: pop next result or [] if empty
    const next = mocks.dbSelectResults.shift() ?? []
    const whereShape = {
      limit: () => Promise.resolve(next),
      orderBy: () => ({
        limit: () => Promise.resolve(next),
        then: (r: (v: unknown) => unknown) => Promise.resolve(next).then(r),
      }),
      // Support direct thenable (no limit())
      then: (r: (v: unknown) => unknown) => Promise.resolve(next).then(r),
    }
    return {
      from: () => ({
        where: () => whereShape,
      }),
    }
  })

  const insertMock = vi.fn((table: unknown) => {
    const tName = tableNameFor(table)
    return {
      values: (values: unknown) => {
        mocks.dbInsertCalls.push({ table: tName, values })
        // Audit 2026-04-27 M2: handler now uses
        //   .insert(processedWebhookEvents).values(...)
        //     .onConflictDoNothing({ target }).returning({ eventId })
        // for replay protection. Returning [] = replay (handler short-
        // circuits to 200). Default to [{eventId}] so existing tests see
        // "fresh event, proceed". Tests that want to assert the replay
        // path should set `mocks.processedWebhookReplay = true`.
        return {
          onConflictDoNothing: (_opts?: unknown) => ({
            returning: (_cols?: unknown) =>
              Promise.resolve(
                mocks.processedWebhookReplay && tName === 'processed_webhook_events'
                  ? []
                  : [{ eventId: 'fresh-event' }],
              ),
            then: (r: (v: unknown) => unknown) =>
              Promise.resolve(undefined).then(r),
          }),
          onConflictDoUpdate: () => Promise.resolve(undefined),
          catch: (_fn: unknown) => Promise.resolve(undefined),
          then: (r: (v: unknown) => unknown) => Promise.resolve(undefined).then(r),
        }
      },
    }
  })

  // Extract string literal values from a drizzle SQL expression tree without
  // tripping on circular PgTable ↔ Column references. We walk the object and
  // concatenate every string / number primitive we encounter.
  const extractWhereText = (node: unknown, seen = new WeakSet<object>()): string => {
    if (node === null || node === undefined) return ''
    if (typeof node === 'string') return node + ' '
    if (typeof node === 'number' || typeof node === 'boolean') return String(node) + ' '
    if (typeof node !== 'object') return ''
    if (seen.has(node as object)) return ''
    seen.add(node as object)
    let out = ''
    for (const key of Object.keys(node as Record<string, unknown>)) {
      // Skip table/column back-references that cause cycles
      if (key === 'table' || key === 'columns') continue
      try {
        out += extractWhereText((node as Record<string, unknown>)[key], seen)
      } catch {
        // ignore unserializable branches
      }
    }
    return out
  }

  const updateMock = vi.fn((table: unknown) => {
    const tName = tableNameFor(table)
    return {
      set: (setArg: unknown) => ({
        where: (whereArg: unknown) => {
          const entry: {
            table: string
            set: unknown
            where: string
            returning?: unknown[]
          } = {
            table: tName,
            set: setArg,
            where: typeof whereArg === 'object' ? extractWhereText(whereArg) : String(whereArg),
          }
          mocks.dbUpdateCalls.push(entry)
          return {
            // returning(): emit the select-queue next value OR [] so
            // callers doing `.where(...).returning(...)` can iterate.
            returning: (_cols?: unknown) => {
              const rows = mocks.dbSelectResults.shift() ?? []
              entry.returning = rows
              return Promise.resolve(rows)
            },
            catch: (_fn: unknown) => Promise.resolve(undefined),
            then: (r: (v: unknown) => unknown) => Promise.resolve(undefined).then(r),
          }
        },
      }),
    }
  })

  return {
    db: {
      select: selectMock,
      insert: insertMock,
      update: updateMock,
    },
  }
})

const TEST_SECRET = 'test-cal-webhook-secret'

function signBody(body: string, secret = TEST_SECRET): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex')
}

function makeReq(body: unknown, sig: string | null): Request {
  const rawBody = typeof body === 'string' ? body : JSON.stringify(body)
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (sig !== null) headers['x-cal-signature-256'] = sig
  return new Request('http://test/api/webhooks/cal', {
    method: 'POST',
    body: rawBody,
    headers,
  })
}

let POST: ((req: Request) => Promise<Response>) | null = null

beforeAll(async () => {
  vi.stubEnv('CAL_WEBHOOK_SECRET', TEST_SECRET)
  const segments = ['@', 'app', 'api', 'webhooks', 'cal', 'route']
  const modPath = segments.join('/')
  try {
    const mod = await import(/* @vite-ignore */ modPath)
    POST = (mod as { POST?: (req: Request) => Promise<Response> }).POST ?? null
  } catch {
    POST = null
  }
})

beforeEach(() => {
  mocks.dbSelectResults.length = 0
  mocks.dbInsertCalls.length = 0
  mocks.dbUpdateCalls.length = 0
  mocks.sendWorkshopRegistrationReceived.mockClear()
  mocks.sendWorkshopFeedbackInvite.mockClear()
  mocks.sendWorkshopFeedbackInvitesBatch.mockClear()
  mocks.sendWorkshopCompleted.mockClear()
  mocks.revalidateTag.mockClear()
})

describe('POST /api/webhooks/cal', () => {
  it('RED: module is importable', () => {
    expect(POST).not.toBeNull()
  })

  // --- Signature / routing guards ---------------------------------

  it('T1: missing signature header → 401', async () => {
    expect(POST).not.toBeNull()
    const body = JSON.stringify({ triggerEvent: 'BOOKING_CREATED', payload: {} })
    const res = await POST!(makeReq(body, null))
    expect(res.status).toBe(401)
  })

  it('T2: invalid signature (tampered body) → 401', async () => {
    expect(POST).not.toBeNull()
    const original = JSON.stringify({ triggerEvent: 'BOOKING_CREATED', payload: {} })
    const sig = signBody(original)
    const tampered = JSON.stringify({ triggerEvent: 'BOOKING_CREATED', payload: { uid: 'evil' } })
    const res = await POST!(makeReq(tampered, sig))
    expect(res.status).toBe(401)
  })

  it('T3: missing CAL_WEBHOOK_SECRET → 500', async () => {
    expect(POST).not.toBeNull()
    vi.stubEnv('CAL_WEBHOOK_SECRET', '')
    const body = JSON.stringify({ triggerEvent: 'BOOKING_CREATED', payload: {} })
    const res = await POST!(makeReq(body, signBody(body, 'anything')))
    expect(res.status).toBe(500)
    vi.stubEnv('CAL_WEBHOOK_SECRET', TEST_SECRET)
  })

  it('T4: unknown triggerEvent → 200 (ignore)', async () => {
    expect(POST).not.toBeNull()
    const body = JSON.stringify({ triggerEvent: 'SOMETHING_ELSE', payload: { uid: 'x' } })
    const res = await POST!(makeReq(body, signBody(body)))
    expect(res.status).toBe(200)
  })

  // --- BOOKING_CREATED (Task 7: now a no-op) ----------------------
  // In the addAttendeeToBooking model the root booking is created
  // server-side by workshopCreatedFn and subsequent per-attendee adds do
  // NOT fire a BOOKING_CREATED webhook. If cal.com ever does deliver one
  // we still must return 200 to satisfy the delivery contract, but we
  // MUST NOT insert a duplicate registration row.

  it('T5: BOOKING_CREATED is a no-op under the new seated-booking model (no insert, returns 200)', async () => {
    expect(POST).not.toBeNull()
    const body = JSON.stringify({
      triggerEvent: 'BOOKING_CREATED',
      payload: {
        uid: 'booking-uid-abc',
        startTime: '2026-05-01T10:00:00.000Z',
        endTime: '2026-05-01T11:00:00.000Z',
        eventTypeId: 12345,
        attendees: [{ email: 'priya@example.com', name: 'Priya Sharma' }],
      },
    })
    const res = await POST!(makeReq(body, signBody(body)))
    expect(res.status).toBe(200)
    const regInsert = mocks.dbInsertCalls.find(c => c.table === 'workshop_registrations')
    expect(regInsert).toBeUndefined()
    expect(mocks.sendWorkshopRegistrationReceived).not.toHaveBeenCalled()
  })

  // --- BOOKING_CANCELLED ------------------------------------------

  it('T8: BOOKING_CANCELLED updates row by booking_uid → status=cancelled', async () => {
    expect(POST).not.toBeNull()
    const body = JSON.stringify({
      triggerEvent: 'BOOKING_CANCELLED',
      payload: { uid: 'to-cancel' },
    })
    const res = await POST!(makeReq(body, signBody(body)))
    expect(res.status).toBe(200)
    const upd = mocks.dbUpdateCalls.find(c => c.table === 'workshop_registrations')
    expect(upd).toBeDefined()
    const setArg = upd!.set as Record<string, unknown>
    expect(setArg.status).toBe('cancelled')
    expect(setArg.cancelledAt).toBeInstanceOf(Date)
  })

  // --- BOOKING_RESCHEDULED (CRITICAL research correction) ----------

  it('T9: BOOKING_RESCHEDULED matches on rescheduleUid (NOT payload.uid)', async () => {
    expect(POST).not.toBeNull()
    const body = JSON.stringify({
      triggerEvent: 'BOOKING_RESCHEDULED',
      payload: {
        uid: 'NEW-uid-after-reschedule',
        rescheduleUid: 'ORIGINAL-uid',
        startTime: '2026-05-02T15:00:00.000Z',
      },
    })
    const res = await POST!(makeReq(body, signBody(body)))
    expect(res.status).toBe(200)
    const upd = mocks.dbUpdateCalls.find(c => c.table === 'workshop_registrations')
    expect(upd).toBeDefined()
    // The WHERE clause must reference the ORIGINAL uid, not the new one.
    expect(upd!.where).toContain('ORIGINAL-uid')
    expect(upd!.where).not.toContain('NEW-uid-after-reschedule')
  })

  it('T10: BOOKING_RESCHEDULED SET includes new booking_uid + new booking_start_time + status=rescheduled', async () => {
    expect(POST).not.toBeNull()
    const body = JSON.stringify({
      triggerEvent: 'BOOKING_RESCHEDULED',
      payload: {
        uid: 'NEW-uid',
        rescheduleUid: 'ORIG-uid',
        startTime: '2026-05-02T15:00:00.000Z',
      },
    })
    await POST!(makeReq(body, signBody(body)))
    const upd = mocks.dbUpdateCalls.find(c => c.table === 'workshop_registrations')
    expect(upd).toBeDefined()
    const setArg = upd!.set as Record<string, unknown>
    expect(setArg.bookingUid).toBe('NEW-uid')
    expect(setArg.status).toBe('rescheduled')
    expect(setArg.bookingStartTime).toBeInstanceOf(Date)
    expect((setArg.bookingStartTime as Date).toISOString()).toBe('2026-05-02T15:00:00.000Z')
  })

  // --- MEETING_ENDED ----------------------------------------------

  it('T11: MEETING_ENDED accepts defensive flat payload (no wrapping)', async () => {
    expect(POST).not.toBeNull()
    // Flat: eventTypeId at root, no `payload` wrapper
    mocks.dbSelectResults.push([{ id: 'ws-1' }])  // findWorkshopByCalEventTypeId
    mocks.dbSelectResults.push([{ id: 'ws-1', status: 'upcoming', createdBy: 'mod-1', scheduledAt: new Date('2026-05-01T10:00:00Z') }]) // workshop select
    const body = JSON.stringify({
      triggerEvent: 'MEETING_ENDED',
      uid: 'meeting-x',
      eventTypeId: 999,
      attendees: [],
    })
    const res = await POST!(makeReq(body, signBody(body)))
    expect(res.status).toBe(200)
  })

  it('T12: MEETING_ENDED transitions workshop → completed via workflow_transitions insert', async () => {
    expect(POST).not.toBeNull()
    mocks.dbSelectResults.push([{ id: 'ws-2' }])
    mocks.dbSelectResults.push([{ id: 'ws-2', status: 'upcoming', createdBy: 'mod-2', scheduledAt: new Date('2026-05-01T10:00:00Z') }])
    const body = JSON.stringify({
      triggerEvent: 'MEETING_ENDED',
      payload: { uid: 'm', eventTypeId: 999, attendees: [] },
    })
    const res = await POST!(makeReq(body, signBody(body)))
    expect(res.status).toBe(200)
    // workshops UPDATE to completed
    const wsUpdate = mocks.dbUpdateCalls.find(c => c.table === 'workshops')
    expect(wsUpdate).toBeDefined()
    expect((wsUpdate!.set as Record<string, unknown>).status).toBe('completed')
    // workflow_transitions INSERT with actorId=SYSTEM_ACTOR_UUID. Migration
    // 0029 tightened actor_id from text to uuid; the prior 'system:cal-webhook'
    // string would now fail the type check, so we use the all-zeros sentinel
    // (see src/lib/constants.ts SYSTEM_ACTOR_UUID).
    const auditInsert = mocks.dbInsertCalls.find(c => c.table === 'workflow_transitions')
    expect(auditInsert).toBeDefined()
    const auditValues = auditInsert!.values as Record<string, unknown>
    expect(auditValues.entityType).toBe('workshop')
    expect(auditValues.fromState).toBe('upcoming')
    expect(auditValues.toState).toBe('completed')
    expect(auditValues.actorId).toBe('00000000-0000-0000-0000-000000000000')
    // Phase 17 workshop-completed chain fired
    expect(mocks.sendWorkshopCompleted).toHaveBeenCalledTimes(1)
  })

  it('T13: MEETING_ENDED on already-completed workshop with fan-out sent short-circuits (no duplicate transition)', async () => {
    expect(POST).not.toBeNull()
    mocks.dbSelectResults.push([{ id: 'ws-3' }])
    // Audit 2026-04-27 M3: a fully-processed workshop has BOTH
    // status='completed' AND completionPipelineSentAt set. The status
    // guard short-circuits the audit insert; the new
    // completionPipelineSentAt guard short-circuits the fan-out. A
    // workshow row with status='completed' but completionPipelineSentAt
    // NULL is the "resume" scenario covered separately.
    mocks.dbSelectResults.push([{
      id: 'ws-3',
      status: 'completed',
      createdBy: 'mod-3',
      scheduledAt: new Date('2026-05-01T10:00:00Z'),
      completionPipelineSentAt: new Date('2026-05-01T11:30:00Z'),
    }])
    const body = JSON.stringify({
      triggerEvent: 'MEETING_ENDED',
      payload: { uid: 'm', eventTypeId: 999, attendees: [] },
    })
    await POST!(makeReq(body, signBody(body)))
    const wsUpdate = mocks.dbUpdateCalls.find(c => c.table === 'workshops')
    expect(wsUpdate).toBeUndefined()
    const auditInsert = mocks.dbInsertCalls.find(c => c.table === 'workflow_transitions')
    expect(auditInsert).toBeUndefined()
    expect(mocks.sendWorkshopCompleted).not.toHaveBeenCalled()
  })

  it('M3 (audit 2026-04-27): MEETING_ENDED resume — completed workshop with NULL completionPipelineSentAt re-fires fan-out', async () => {
    expect(POST).not.toBeNull()
    mocks.dbSelectResults.push([{ id: 'ws-resume' }])
    // The "transient Inngest send failure" scenario: status was flipped
    // to completed (audit row written) but sendWorkshopCompleted threw
    // and completionPipelineSentAt never landed. A redelivered MEETING_ENDED
    // should NOT re-flip status (already completed) but SHOULD re-fire
    // sendWorkshopCompleted so the evidence-nudge pipeline isn't dropped.
    mocks.dbSelectResults.push([{
      id: 'ws-resume',
      status: 'completed',
      createdBy: 'mod-r',
      scheduledAt: new Date('2026-05-01T10:00:00Z'),
      completionPipelineSentAt: null,
    }])
    const body = JSON.stringify({
      triggerEvent: 'MEETING_ENDED',
      payload: { uid: 'm-resume', eventTypeId: 9001, attendees: [] },
    })
    const res = await POST!(makeReq(body, signBody(body)))
    expect(res.status).toBe(200)
    // No status flip (status was already completed) — only the
    // completionPipelineSentAt stamp UPDATE happens after the resume.
    const wsUpdates = mocks.dbUpdateCalls.filter(c => c.table === 'workshops')
    const flipUpdate = wsUpdates.find(
      u => (u.set as Record<string, unknown>).status === 'completed',
    )
    expect(flipUpdate).toBeUndefined()
    // Fan-out re-fired so the Phase 17 evidence pipeline doesn't drop.
    expect(mocks.sendWorkshopCompleted).toHaveBeenCalledTimes(1)
  })

  it('T14: MEETING_ENDED backfills attendedAt + attendanceSource for matched attendee', async () => {
    expect(POST).not.toBeNull()
    mocks.dbSelectResults.push([{ id: 'ws-4' }])  // findWorkshopByCalEventTypeId
    mocks.dbSelectResults.push([{ id: 'ws-4', status: 'upcoming', createdBy: 'mod-4', scheduledAt: new Date('2026-05-01T10:00:00Z') }]) // workshop row
    // Attendee lookup: existing registration with no attendedAt
    mocks.dbSelectResults.push([{ id: 'reg-1', attendedAt: null }])
    const body = JSON.stringify({
      triggerEvent: 'MEETING_ENDED',
      payload: {
        uid: 'm',
        eventTypeId: 999,
        attendees: [{ email: 'attendee@example.com', name: 'Attendee' }],
      },
    })
    await POST!(makeReq(body, signBody(body)))
    // An update on workshop_registrations setting attendedAt + attendanceSource
    const attendUpdates = mocks.dbUpdateCalls.filter(
      c => c.table === 'workshop_registrations'
        && (c.set as Record<string, unknown>).attendanceSource === 'cal_meeting_ended',
    )
    expect(attendUpdates.length).toBeGreaterThanOrEqual(1)
    const setArg = attendUpdates[0].set as Record<string, unknown>
    expect(setArg.attendedAt).toBeInstanceOf(Date)
  })

  it('T15: MEETING_ENDED walk-in synthesizes row with bookingUid=walkin:{workshopId}:{sha256(email)}', async () => {
    expect(POST).not.toBeNull()
    mocks.dbSelectResults.push([{ id: 'ws-5' }])
    mocks.dbSelectResults.push([{ id: 'ws-5', status: 'upcoming', createdBy: 'mod-5', scheduledAt: new Date('2026-05-01T10:00:00Z') }])
    // Attendee lookup: no matching registration
    mocks.dbSelectResults.push([])
    const body = JSON.stringify({
      triggerEvent: 'MEETING_ENDED',
      payload: {
        uid: 'm',
        eventTypeId: 999,
        attendees: [{ email: 'WalkIn@Example.com', name: 'Walk In' }],
      },
    })
    await POST!(makeReq(body, signBody(body)))
    // Synthetic insert
    const synthInsert = mocks.dbInsertCalls.find(c => {
      if (c.table !== 'workshop_registrations') return false
      const v = c.values as Record<string, unknown>
      return typeof v.bookingUid === 'string' && (v.bookingUid as string).startsWith('walkin:')
    })
    expect(synthInsert).toBeDefined()
    const values = synthInsert!.values as Record<string, unknown>
    const expectedHash = createHash('sha256').update('walkin@example.com').digest('hex')
    expect(values.bookingUid).toBe(`walkin:ws-5:${expectedHash}`)
    expect(values.attendanceSource).toBe('cal_meeting_ended')
    // Walk-in also emits workshop.registration.received
    expect(mocks.sendWorkshopRegistrationReceived).toHaveBeenCalled()
    const call = mocks.sendWorkshopRegistrationReceived.mock.calls[0][0] as { source: string }
    expect(call.source).toBe('walk_in')
  })

  it('T16: MEETING_ENDED fires a single batch sendWorkshopFeedbackInvitesBatch with one entry per attendee', async () => {
    expect(POST).not.toBeNull()
    mocks.dbSelectResults.push([{ id: 'ws-6' }])
    mocks.dbSelectResults.push([{ id: 'ws-6', status: 'upcoming', createdBy: 'mod-6', scheduledAt: new Date('2026-05-01T10:00:00Z') }])
    // Two attendee lookups
    mocks.dbSelectResults.push([{ id: 'r-1', attendedAt: null }])
    mocks.dbSelectResults.push([{ id: 'r-2', attendedAt: null }])
    const body = JSON.stringify({
      triggerEvent: 'MEETING_ENDED',
      payload: {
        uid: 'm',
        eventTypeId: 999,
        attendees: [
          { email: 'one@example.com', name: 'One' },
          { email: 'two@example.com', name: 'Two' },
        ],
      },
    })
    await POST!(makeReq(body, signBody(body)))
    // P3: batched send — single invocation carrying both attendees.
    expect(mocks.sendWorkshopFeedbackInvitesBatch).toHaveBeenCalledTimes(1)
    const batch = mocks.sendWorkshopFeedbackInvitesBatch.mock.calls[0][0] as Array<{ email: string }>
    expect(batch).toHaveLength(2)
    expect(batch.map(b => b.email).sort()).toEqual(['one@example.com', 'two@example.com'])
  })

  // --- BOOKING_CANCELLED: root-uid cascade (Task 7) ----------------

  describe('BOOKING_CANCELLED — root-uid cascade', () => {
    it('cancels every registration row when uid matches workshops.calcomBookingUid', async () => {
      // First select: workshop lookup by calcomBookingUid
      mocks.dbSelectResults.push([{ id: 'ws-1' }])

      const body = JSON.stringify({
        triggerEvent: 'BOOKING_CANCELLED',
        payload: { uid: 'root-abc' },
      })
      const res = await POST!(makeReq(body, signBody(body)))
      expect(res.status).toBe(200)

      const upd = mocks.dbUpdateCalls.find(
        (c) => c.table === 'workshop_registrations',
      )
      expect(upd).toBeTruthy()
      expect((upd?.set as { status?: string }).status).toBe('cancelled')
      // Assert the LIKE pattern targets `root-abc:%` specifically — this is
      // the whole point of the cascade and regressions here would silently
      // miss every child seat.
      expect(upd?.where).toContain('root-abc:%')
      // And confirm the spots-left cache was busted for the right workshop.
      expect(mocks.revalidateTag).toHaveBeenCalledWith(
        'workshop-spots-ws-1',
        'max',
      )
    })
  })

  // --- BOOKING_CANCELLED: seat-level fallback (Task 7) -------------

  describe('BOOKING_CANCELLED — seat-level', () => {
    it('matches the seat booking_uid exactly when root lookup returns no workshop', async () => {
      // First select: no workshop for that uid → falls back to exact match.
      mocks.dbSelectResults.push([])
      // returning(): no rows matched (seat uid not in our table) → no
      // revalidateTag fires. OK — test only needs to verify the fallback
      // path dispatched the right UPDATE shape.
      mocks.dbSelectResults.push([])

      const body = JSON.stringify({
        triggerEvent: 'BOOKING_CANCELLED',
        payload: { uid: 'root-abc:777' },
      })
      const res = await POST!(makeReq(body, signBody(body)))
      expect(res.status).toBe(200)

      const upd = mocks.dbUpdateCalls.find(
        (c) => c.table === 'workshop_registrations',
      )
      expect(upd).toBeTruthy()
      // Fallback must not use LIKE wildcards (that would be the cascade
      // branch) — assert the seat-uid appears literally in the WHERE.
      expect(upd?.where).toContain('root-abc:777')
      expect(upd?.where).not.toContain('%')
    })

    it('honours payload.seatUid when present (cal.com seat-cancel shape)', async () => {
      // Cal.com sometimes ships seat-cancels with `seatUid` distinct from
      // `uid`. The handler should skip the root-lookup (seat uid is not
      // a root uid) and go straight to exact-match with seatUid as a
      // candidate.
      mocks.dbSelectResults.push([])

      const body = JSON.stringify({
        triggerEvent: 'BOOKING_CANCELLED',
        payload: {
          uid:     'root-abc',       // root booking uid (not used)
          seatUid: 'root-abc:777',   // the seat actually being cancelled
        },
      })
      const res = await POST!(makeReq(body, signBody(body)))
      expect(res.status).toBe(200)

      const upd = mocks.dbUpdateCalls.find(
        (c) => c.table === 'workshop_registrations',
      )
      expect(upd).toBeTruthy()
      // Must target the seatUid, not the root uid.
      expect(upd?.where).toContain('root-abc:777')
    })
  })

  // --- BOOKING_RESCHEDULED: root booking cascade (Task 7) ----------

  describe('BOOKING_RESCHEDULED — root booking', () => {
    it('updates workshops.scheduledAt + calcomBookingUid + cascades booking_uid prefix atomically', async () => {
      mocks.dbSelectResults.push([{ id: 'ws-1' }])
      const body = JSON.stringify({
        triggerEvent: 'BOOKING_RESCHEDULED',
        payload: {
          rescheduleUid: 'root-abc',
          uid:           'root-xyz',
          startTime:     '2026-05-15T12:00:00.000Z',
        },
      })
      const res = await POST!(makeReq(body, signBody(body)))
      expect(res.status).toBe(200)

      const workshopUpdate = mocks.dbUpdateCalls.find(
        (c) => c.table === 'workshops',
      )
      const wsSet = workshopUpdate?.set as {
        calcomBookingUid?: string
        scheduledAt?: Date
      } | undefined
      expect(wsSet?.calcomBookingUid).toBe('root-xyz')
      expect(wsSet?.scheduledAt).toBeInstanceOf(Date)

      // Children: exactly ONE UPDATE on workshop_registrations, matching
      // `root-abc:%` via LIKE. The prior N+1-loop implementation would fire
      // N updates; the atomic rewrite fires exactly one.
      const regUpdates = mocks.dbUpdateCalls.filter(
        (c) => c.table === 'workshop_registrations',
      )
      expect(regUpdates).toHaveLength(1)
      expect(regUpdates[0].where).toContain('root-abc:%')

      expect(mocks.revalidateTag).toHaveBeenCalledWith(
        'workshop-spots-ws-1',
        'max',
      )
    })
  })

  // --- Punchlist B2-14..B2-18 coverage ----------------------------

  describe('punchlist B2-14..B2-18', () => {
    it('B2-14: BOOKING_CANCELLED honours payload.seatReferenceUid (not just seatUid)', async () => {
      // No workshop match on root lookup — fallback to exact match using
      // seatReferenceUid as the seat identity.
      mocks.dbSelectResults.push([])
      mocks.dbSelectResults.push([])
      const body = JSON.stringify({
        triggerEvent: 'BOOKING_CANCELLED',
        payload: {
          uid:              'root-abc',
          seatReferenceUid: 'root-abc:seat-42',
        },
      })
      const res = await POST!(makeReq(body, signBody(body)))
      expect(res.status).toBe(200)
      const upd = mocks.dbUpdateCalls.find(
        (c) => c.table === 'workshop_registrations',
      )
      expect(upd?.where).toContain('root-abc:seat-42')
      expect(upd?.where).not.toContain('%')
    })

    it('B2-15: BOOKING_CANCELLED with unsafe uid falls through to exact-match (not LIKE)', async () => {
      // `abc%def` contains a `%` wildcard — must NOT interpolate into LIKE.
      mocks.dbSelectResults.push([])
      const body = JSON.stringify({
        triggerEvent: 'BOOKING_CANCELLED',
        payload: { uid: 'abc%def' },
      })
      const res = await POST!(makeReq(body, signBody(body)))
      expect(res.status).toBe(200)
      const upd = mocks.dbUpdateCalls.find(
        (c) => c.table === 'workshop_registrations',
      )
      // Must land in the exact-match fallback: WHERE has the raw uid but
      // not a `%:` wildcard pattern.
      expect(upd?.where).toContain('abc%def')
      expect(upd?.where).not.toContain('abc%def:%')
    })

    it('B2-16: BOOKING_RESCHEDULED seat-level fallback ORs across seatUid/seatReferenceUid/rescheduleUid', async () => {
      // No root workshop match → falls through to seat-level exact rewrite.
      mocks.dbSelectResults.push([])
      const body = JSON.stringify({
        triggerEvent: 'BOOKING_RESCHEDULED',
        payload: {
          uid:              'new-xyz',
          rescheduleUid:    'orig-abc',
          seatUid:          'seat-1',
          seatReferenceUid: 'seat-1-ref',
          startTime:        '2026-06-01T12:00:00.000Z',
        },
      })
      const res = await POST!(makeReq(body, signBody(body)))
      expect(res.status).toBe(200)
      const regUpdates = mocks.dbUpdateCalls.filter(
        (c) => c.table === 'workshop_registrations',
      )
      expect(regUpdates).toHaveLength(1)
      // All three originals should appear in the WHERE (drizzle inArray),
      // and the NEW uid must NOT be a candidate.
      expect(regUpdates[0].where).toContain('orig-abc')
      expect(regUpdates[0].where).toContain('seat-1')
      expect(regUpdates[0].where).toContain('seat-1-ref')
      expect(regUpdates[0].where).not.toContain('new-xyz:')
    })

    it('B2-17: BOOKING_RESCHEDULED with unsafe newUid short-circuits without an UPDATE', async () => {
      const body = JSON.stringify({
        triggerEvent: 'BOOKING_RESCHEDULED',
        payload: {
          uid:           'bad%new',
          rescheduleUid: 'orig-abc',
          startTime:     '2026-06-01T12:00:00.000Z',
        },
      })
      const res = await POST!(makeReq(body, signBody(body)))
      expect(res.status).toBe(200)
      // No workshop_registrations or workshops UPDATE fired.
      const anyUpdate = mocks.dbUpdateCalls.find(
        (c) => c.table === 'workshop_registrations' || c.table === 'workshops',
      )
      expect(anyUpdate).toBeUndefined()
    })

    it('B2-18: MEETING_ENDED batch payload items carry attendeeUserId=null', async () => {
      mocks.dbSelectResults.push([{ id: 'ws-b' }])
      mocks.dbSelectResults.push([{ id: 'ws-b', status: 'upcoming', createdBy: 'mod-b', scheduledAt: new Date('2026-05-01T10:00:00Z') }])
      mocks.dbSelectResults.push([{ id: 'r-1', attendedAt: null }])
      const body = JSON.stringify({
        triggerEvent: 'MEETING_ENDED',
        payload: {
          uid: 'm',
          eventTypeId: 999,
          attendees: [{ email: 'one@example.com', name: 'One' }],
        },
      })
      await POST!(makeReq(body, signBody(body)))
      expect(mocks.sendWorkshopFeedbackInvitesBatch).toHaveBeenCalledTimes(1)
      const batch = mocks.sendWorkshopFeedbackInvitesBatch.mock.calls[0][0] as Array<{
        attendeeUserId: unknown
      }>
      expect(batch).toHaveLength(1)
      expect(batch[0].attendeeUserId).toBeNull()
    })
  })
})

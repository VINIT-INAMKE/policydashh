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
  dbUpdateCalls: [] as Array<{ table: string; set: unknown; where: string }>,
  sendWorkshopRegistrationReceived: vi.fn().mockResolvedValue(undefined),
  sendWorkshopFeedbackInvite: vi.fn().mockResolvedValue(undefined),
  sendWorkshopCompleted: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/src/inngest/events', () => ({
  sendWorkshopRegistrationReceived: mocks.sendWorkshopRegistrationReceived,
  sendWorkshopFeedbackInvite: mocks.sendWorkshopFeedbackInvite,
  sendWorkshopCompleted: mocks.sendWorkshopCompleted,
}))

// Build a db mock that tracks select results (queue), insert calls, update calls.
vi.mock('@/src/db', () => {
  const tableNameFor = (t: unknown): string => {
    if (t && typeof t === 'object') {
      const maybeName = (t as { _?: { name?: string } })._?.name
      if (maybeName) return maybeName
    }
    return 'unknown'
  }

  const selectMock = vi.fn(() => {
    // queue-based return: pop next result or [] if empty
    const next = mocks.dbSelectResults.shift() ?? []
    return {
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(next),
          // Support direct thenable (no limit())
          then: (r: (v: unknown) => unknown) => Promise.resolve(next).then(r),
        }),
      }),
    }
  })

  const insertMock = vi.fn((table: unknown) => {
    const tName = tableNameFor(table)
    return {
      values: (values: unknown) => {
        mocks.dbInsertCalls.push({ table: tName, values })
        return {
          onConflictDoNothing: () => Promise.resolve(undefined),
          onConflictDoUpdate: () => Promise.resolve(undefined),
          catch: (_fn: unknown) => Promise.resolve(undefined),
          then: (r: (v: unknown) => unknown) => Promise.resolve(undefined).then(r),
        }
      },
    }
  })

  const updateMock = vi.fn((table: unknown) => {
    const tName = tableNameFor(table)
    return {
      set: (setArg: unknown) => ({
        where: (whereArg: unknown) => {
          mocks.dbUpdateCalls.push({
            table: tName,
            set: setArg,
            where: typeof whereArg === 'object' ? JSON.stringify(whereArg) : String(whereArg),
          })
          return {
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
  mocks.sendWorkshopCompleted.mockClear()
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

  // --- BOOKING_CREATED --------------------------------------------

  it('T5: BOOKING_CREATED inserts a workshop_registrations row', async () => {
    expect(POST).not.toBeNull()
    // First select: workshop lookup by eventTypeId → returns a row
    mocks.dbSelectResults.push([{ id: 'workshop-uuid-1' }])
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
    expect(regInsert).toBeDefined()
    const values = regInsert!.values as Record<string, unknown>
    expect(values.workshopId).toBe('workshop-uuid-1')
    expect(values.bookingUid).toBe('booking-uid-abc')
    expect(values.email).toBe('priya@example.com')
    expect(values.name).toBe('Priya Sharma')
    expect(values.status).toBe('registered')
  })

  it('T6: BOOKING_CREATED with duplicate bookingUid → ON CONFLICT DO NOTHING (no throw)', async () => {
    expect(POST).not.toBeNull()
    mocks.dbSelectResults.push([{ id: 'workshop-uuid-1' }])
    const body = JSON.stringify({
      triggerEvent: 'BOOKING_CREATED',
      payload: {
        uid: 'dup-uid',
        startTime: '2026-05-01T10:00:00.000Z',
        eventTypeId: 12345,
        attendees: [{ email: 'a@b.com', name: 'A' }],
      },
    })
    const res = await POST!(makeReq(body, signBody(body)))
    expect(res.status).toBe(200)
  })

  it('T7: BOOKING_CREATED fires sendWorkshopRegistrationReceived once with source=cal_booking', async () => {
    expect(POST).not.toBeNull()
    mocks.dbSelectResults.push([{ id: 'workshop-uuid-1' }])
    const body = JSON.stringify({
      triggerEvent: 'BOOKING_CREATED',
      payload: {
        uid: 'booking-7',
        startTime: '2026-05-01T10:00:00.000Z',
        eventTypeId: 12345,
        attendees: [{ email: 'X@example.com', name: 'X' }],
      },
    })
    await POST!(makeReq(body, signBody(body)))
    expect(mocks.sendWorkshopRegistrationReceived).toHaveBeenCalledTimes(1)
    const call = mocks.sendWorkshopRegistrationReceived.mock.calls[0][0] as { source: string; emailHash: string; email: string }
    expect(call.source).toBe('cal_booking')
    expect(call.email).toBe('X@example.com')
    // emailHash must be sha256 hex of lowercased trimmed email
    const expected = createHash('sha256').update('x@example.com').digest('hex')
    expect(call.emailHash).toBe(expected)
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
    // workflow_transitions INSERT with actorId='system:cal-webhook'
    const auditInsert = mocks.dbInsertCalls.find(c => c.table === 'workflow_transitions')
    expect(auditInsert).toBeDefined()
    const auditValues = auditInsert!.values as Record<string, unknown>
    expect(auditValues.entityType).toBe('workshop')
    expect(auditValues.fromState).toBe('upcoming')
    expect(auditValues.toState).toBe('completed')
    expect(auditValues.actorId).toBe('system:cal-webhook')
    // Phase 17 workshop-completed chain fired
    expect(mocks.sendWorkshopCompleted).toHaveBeenCalledTimes(1)
  })

  it('T13: MEETING_ENDED on already-completed workshop short-circuits (no duplicate transition)', async () => {
    expect(POST).not.toBeNull()
    mocks.dbSelectResults.push([{ id: 'ws-3' }])
    mocks.dbSelectResults.push([{ id: 'ws-3', status: 'completed', createdBy: 'mod-3', scheduledAt: new Date('2026-05-01T10:00:00Z') }])
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

  it('T16: MEETING_ENDED fires sendWorkshopFeedbackInvite once per attendee', async () => {
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
    expect(mocks.sendWorkshopFeedbackInvite).toHaveBeenCalledTimes(2)
  })
})

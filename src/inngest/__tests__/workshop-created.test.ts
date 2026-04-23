import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'

/**
 * Plan 20-02 test contract for workshopCreatedFn (WS-07).
 *
 * Covers five behaviors (T1-T5 from the plan):
 *   T1 - successful cal.com response backfills calcomEventTypeId.
 *   T2 - missing workshop row → NonRetriableError.
 *   T3 - cal.com 500 → plain Error bubbles (retry path).
 *   T4 - cal.com 400 → NonRetriableError (no retry).
 *   T5 - missing CAL_API_KEY → NonRetriableError (caught and rewrapped by fn).
 *
 * Mock strategy: `vi.hoisted` for shared handles; `vi.mock('@/src/db')` with a
 * chain-mock and `vi.mock('@/src/lib/calcom')` so the tests never fire a real
 * fetch. Variable-path dynamic import (Plan 16 Pattern 2) bypasses Vite static
 * analysis so this file still compiles even if the target module is unshipped
 * in some Wave-0 intermediate state.
 */

const mocks = vi.hoisted(() => {
  // db.select().from().where().limit() chain for load-workshop step
  const limitMock = vi.fn()
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock })
  const fromMock = vi.fn().mockReturnValue({ where: whereMock })
  const selectMock = vi.fn().mockReturnValue({ from: fromMock })

  // db.update().set().where() chain for backfill step
  const updateWhereMock = vi.fn().mockResolvedValue(undefined)
  const setMock = vi.fn().mockReturnValue({ where: updateWhereMock })
  const updateMock = vi.fn().mockReturnValue({ set: setMock })

  const createCalEventTypeMock = vi.fn()
  const createCalBookingMock = vi.fn()

  return {
    limitMock,
    whereMock,
    fromMock,
    selectMock,
    setMock,
    updateWhereMock,
    updateMock,
    createCalEventTypeMock,
    createCalBookingMock,
  }
})

vi.mock('@/src/db', () => ({
  db: {
    select: mocks.selectMock,
    update: mocks.updateMock,
  },
}))

// Mock the cal.com client so the fn under test never issues a real fetch.
// We redefine CalApiError inside the mock factory (rather than importActual
// the real module) because `src/lib/calcom.ts` imports `server-only`, which
// blocks test-context module loads. The mocked CalApiError ctor must match
// the real shape - status getter + Error subclass - so the fn under test's
// `err instanceof CalApiError` check resolves against this same constructor.
vi.mock('@/src/lib/calcom', () => {
  class CalApiError extends Error {
    public readonly status: number
    constructor(status: number, message: string) {
      super(message)
      this.name = 'CalApiError'
      this.status = status
    }
  }
  return {
    CalApiError,
    createCalEventType: mocks.createCalEventTypeMock,
    createCalBooking:   mocks.createCalBookingMock,
    // Mirror the shared constants added in Batch 1 (2026-04-23 punchlist)
    // so the function-under-test resolves them against this mock rather
    // than the real module (which imports 'server-only' and blocks in
    // test context).
    DEFAULT_SEATS_PER_TIME_SLOT: 100,
    WORKSHOP_CREATED_EVENT: 'workshop.created',
    UID_SAFE: /^[A-Za-z0-9_-]+$/,
    COMPOSITE_BOOKING_UID_DELIMITER: ':',
    buildCompositeBookingUid: (rootUid: string, attendeeId: number) =>
      `${rootUid}:${attendeeId}`,
    cascadePattern: (rootUid: string) => `${rootUid}:%`,
  }
})

let fnModule: { workshopCreatedFn?: unknown } | null = null
let CalApiErrorCtor: (new (status: number, message: string) => Error) | null = null

beforeAll(async () => {
  // Variable path bypasses Vite static analysis - lets the test file load
  // even if the target is temporarily broken mid-refactor.
  const targetPath = ['..', 'functions', 'workshop-created'].join('/')
  try {
    fnModule = (await import(/* @vite-ignore */ targetPath)) as {
      workshopCreatedFn?: unknown
    }
  } catch (err) {
    fnModule = null
    // eslint-disable-next-line no-console
    console.warn('[workshop-created.test] target module not yet implemented:', (err as Error).message)
  }
  // Resolve CalApiError through the same module path the fn under test uses
  // so the ctor identity matches (the mock factory above intercepts this).
  try {
    const mod = (await import('@/src/lib/calcom')) as {
      CalApiError?: new (status: number, message: string) => Error
    }
    CalApiErrorCtor = mod.CalApiError ?? null
  } catch {
    CalApiErrorCtor = null
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  // Default: CAL_API_KEY is set (tests that need it absent clear it explicitly).
  vi.stubEnv('CAL_API_KEY', 'test-key')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

type StepRunFn = (id: string, fn: () => Promise<unknown>) => Promise<unknown>

function makeStep() {
  const run: StepRunFn = vi.fn(async (_id, fn) => await fn())
  return { step: { run } }
}

function makeEvent() {
  return {
    name: 'workshop.created',
    ts: Date.now(),
    data: {
      workshopId:  '00000000-0000-0000-0000-000000000001',
      moderatorId: '00000000-0000-0000-0000-000000000002',
    },
  }
}

async function invoke(event: ReturnType<typeof makeEvent>, step: ReturnType<typeof makeStep>['step']) {
  const fn = (fnModule as { workshopCreatedFn?: Record<string, unknown> } | null)?.workshopCreatedFn
  if (!fn) throw new Error('workshopCreatedFn not yet implemented')
  const handler = (fn['fn'] ?? (fn as { handler?: unknown }).handler) as
    | ((args: unknown) => Promise<unknown>)
    | undefined
  if (typeof handler !== 'function') throw new Error('workshopCreatedFn handler not exposed')
  return await handler({ event, step, runId: 'test', attempt: 0, logger: console })
}

describe('workshopCreatedFn - cal.com event-type provisioning (WS-07)', () => {
  it('T1: backfills calcomEventTypeId on successful cal.com response', async () => {
    mocks.limitMock.mockResolvedValueOnce([
      {
        id:                '00000000-0000-0000-0000-000000000001',
        title:             'Policy Roundtable',
        durationMinutes:   60,
        calcomEventTypeId: null,
        calcomBookingUid:  null,
        scheduledAt:       new Date('2026-05-01T10:00:00.000Z'),
        timezone:          'Asia/Kolkata',
        maxSeats:          50,
      },
    ])
    mocks.createCalEventTypeMock.mockResolvedValueOnce({ id: 12345 })
    mocks.createCalBookingMock.mockResolvedValueOnce({
      uid: 'root-uid-abc',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
    })
    vi.stubEnv('CAL_PRIMARY_ATTENDEE_EMAIL', 'vinay@konma.io')
    vi.stubEnv('CAL_PRIMARY_ATTENDEE_NAME', 'Vinay (PolicyDash)')

    const { step } = makeStep()
    const result = await invoke(makeEvent(), step)

    expect(mocks.createCalEventTypeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Policy Roundtable',
        durationMinutes: 60,
      }),
    )
    // The fn must call db.update → .set with calcomEventTypeId set to the returned id.
    expect(mocks.updateMock).toHaveBeenCalled()
    const setArg = mocks.setMock.mock.calls[0]?.[0] as { calcomEventTypeId?: string } | undefined
    expect(setArg?.calcomEventTypeId).toBe('12345')
    expect(result).toMatchObject({ ok: true, eventTypeId: 12345 })

    expect(mocks.createCalBookingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventTypeId: 12345,
        email:       'vinay@konma.io',
        name:        'Vinay (PolicyDash)',
        timeZone:    'Asia/Kolkata',
      }),
    )
    const bookingCall = mocks.createCalBookingMock.mock.calls[0]?.[0] as { startTime?: string } | undefined
    expect(bookingCall?.startTime).toBe('2026-05-01T10:00:00.000Z')

    const backfillSet = mocks.setMock.mock.calls[0]?.[0] as {
      calcomEventTypeId?: string
      calcomBookingUid?: string
      meetingUrl?: string
    } | undefined
    expect(backfillSet?.calcomEventTypeId).toBe('12345')
    expect(backfillSet?.calcomBookingUid).toBe('root-uid-abc')
    expect(backfillSet?.meetingUrl).toBe('https://meet.google.com/abc-defg-hij')
  })

  it('T2: NonRetriableError when workshop row is missing', async () => {
    mocks.limitMock.mockResolvedValueOnce([])  // no rows

    const { step } = makeStep()
    await expect(invoke(makeEvent(), step)).rejects.toThrow(/not found/i)
    // Must NOT have called cal.com or update path.
    expect(mocks.createCalEventTypeMock).not.toHaveBeenCalled()
    expect(mocks.updateMock).not.toHaveBeenCalled()
  })

  it('T3: 5xx bubbles a plain Error (retry path - NOT NonRetriableError)', async () => {
    mocks.limitMock.mockResolvedValueOnce([
      {
        id: 'w', title: 'x', durationMinutes: 60,
        calcomEventTypeId: null, calcomBookingUid: null,
        scheduledAt: new Date('2026-05-01T10:00:00.000Z'),
        timezone: 'Asia/Kolkata', maxSeats: 50,
      },
    ])
    if (!CalApiErrorCtor) throw new Error('CalApiError ctor not resolved - calcom module missing')
    mocks.createCalEventTypeMock.mockRejectedValueOnce(new CalApiErrorCtor(500, 'cal.com API 500: boom'))

    const { step } = makeStep()
    let thrown: unknown
    try {
      await invoke(makeEvent(), step)
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(Error)
    // Must NOT be NonRetriableError - Inngest needs the retry path.
    const { NonRetriableError } = await import('inngest')
    expect(thrown).not.toBeInstanceOf(NonRetriableError)
    // Backfill must not have run.
    expect(mocks.updateMock).not.toHaveBeenCalled()
  })

  it('T4: 4xx wraps to NonRetriableError (no retry)', async () => {
    mocks.limitMock.mockResolvedValueOnce([
      {
        id: 'w', title: 'x', durationMinutes: 60,
        calcomEventTypeId: null, calcomBookingUid: null,
        scheduledAt: new Date('2026-05-01T10:00:00.000Z'),
        timezone: 'Asia/Kolkata', maxSeats: 50,
      },
    ])
    if (!CalApiErrorCtor) throw new Error('CalApiError ctor not resolved')
    mocks.createCalEventTypeMock.mockRejectedValueOnce(new CalApiErrorCtor(400, 'cal.com API 400: bad slug'))

    const { step } = makeStep()
    const { NonRetriableError } = await import('inngest')
    let thrown: unknown
    try {
      await invoke(makeEvent(), step)
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(NonRetriableError)
    expect(mocks.updateMock).not.toHaveBeenCalled()
  })

  it('T5: missing CAL_API_KEY surfaces as NonRetriableError', async () => {
    mocks.limitMock.mockResolvedValueOnce([
      {
        id: 'w', title: 'x', durationMinutes: 60,
        calcomEventTypeId: null, calcomBookingUid: null,
        scheduledAt: new Date('2026-05-01T10:00:00.000Z'),
        timezone: 'Asia/Kolkata', maxSeats: 50,
      },
    ])
    if (!CalApiErrorCtor) throw new Error('CalApiError ctor not resolved')
    // A missing env surfaces from the real createCalEventType as CalApiError(400, ...).
    // The mocked createCalEventType can simulate that shape here.
    mocks.createCalEventTypeMock.mockRejectedValueOnce(new CalApiErrorCtor(400, 'CAL_API_KEY not set'))
    vi.stubEnv('CAL_API_KEY', '')

    const { step } = makeStep()
    const { NonRetriableError } = await import('inngest')
    let thrown: unknown
    try {
      await invoke(makeEvent(), step)
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(NonRetriableError)
    expect((thrown as Error).message).toMatch(/CAL_API_KEY/i)
  })

  it('short-circuits when calcomEventTypeId is already set', async () => {
    mocks.limitMock.mockResolvedValueOnce([
      {
        id: 'w', title: 'x', durationMinutes: 60,
        calcomEventTypeId: 'already-set-9999',
        calcomBookingUid:  'already-booked-uid',
        scheduledAt:       new Date('2026-05-01T10:00:00.000Z'),
        timezone:          'Asia/Kolkata',
        maxSeats:          50,
      },
    ])

    const { step } = makeStep()
    const result = await invoke(makeEvent(), step)

    expect(mocks.createCalEventTypeMock).not.toHaveBeenCalled()
    expect(mocks.updateMock).not.toHaveBeenCalled()
    expect(result).toMatchObject({ skipped: 'already-provisioned' })
  })

  it('T6: cal.com 5xx on root-booking step bubbles a plain Error (retry path)', async () => {
    mocks.limitMock.mockResolvedValueOnce([
      {
        id:                'w', title: 'x', durationMinutes: 60,
        calcomEventTypeId: null, calcomBookingUid: null,
        scheduledAt:       new Date('2026-05-01T10:00:00.000Z'),
        timezone:          'Asia/Kolkata', maxSeats: 50,
      },
    ])
    vi.stubEnv('CAL_PRIMARY_ATTENDEE_EMAIL', 'vinay@konma.io')
    vi.stubEnv('CAL_PRIMARY_ATTENDEE_NAME', 'Vinay (PolicyDash)')
    mocks.createCalEventTypeMock.mockResolvedValueOnce({ id: 7777 })
    if (!CalApiErrorCtor) throw new Error('CalApiError ctor not resolved')
    mocks.createCalBookingMock.mockRejectedValueOnce(new CalApiErrorCtor(500, 'cal.com 500'))

    const { step } = makeStep()
    const { NonRetriableError } = await import('inngest')
    const thrown = await invoke(makeEvent(), step).catch((e) => e)
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown).not.toBeInstanceOf(NonRetriableError)
    // Backfill must not have run because booking failed.
    expect(mocks.updateMock).not.toHaveBeenCalled()
  })

  it('B4-5: non-UTC timezone round-trips through step.run JSON serialization as canonical ISO', async () => {
    // `workshop.scheduledAt` is stored as a timestamptz. When Inngest's
    // step.run boundary JSON-encodes the value, `Date` instances become
    // ISO strings and are revived as strings on re-entry. The function
    // wraps them in `new Date(...).toISOString()` to normalize either
    // shape to UTC ISO, so the cal.com API receives a deterministic value
    // regardless of the workshop's timezone field.
    mocks.limitMock.mockResolvedValueOnce([
      {
        id: '00000000-0000-0000-0000-000000000001',
        title: 'Test workshop',
        durationMinutes: 60,
        calcomEventTypeId: null,
        calcomBookingUid:  null,
        // 15:30 IST (UTC+5:30) == 10:00 UTC. Whichever the raw value is,
        // the cal.com call should receive the UTC ISO form.
        scheduledAt: '2026-05-01T10:00:00.000Z',
        timezone: 'America/Los_Angeles',
        maxSeats: 50,
      },
    ])
    vi.stubEnv('CAL_PRIMARY_ATTENDEE_EMAIL', 'vinay@konma.io')
    vi.stubEnv('CAL_PRIMARY_ATTENDEE_NAME', 'Vinay (PolicyDash)')
    mocks.createCalEventTypeMock.mockResolvedValueOnce({ id: 4242 })
    mocks.createCalBookingMock.mockResolvedValueOnce({ uid: 'root', meetingUrl: null })

    const { step } = makeStep()
    await invoke(makeEvent(), step)

    const bookingCall = mocks.createCalBookingMock.mock.calls[0]?.[0] as {
      startTime: string
      timeZone:  string
    }
    // Timezone field propagates verbatim — it's cal.com's attendee-invite
    // renderer that localizes; the startTime itself is always UTC ISO.
    expect(bookingCall.timeZone).toBe('America/Los_Angeles')
    expect(bookingCall.startTime).toBe('2026-05-01T10:00:00.000Z')
  })

  it('B4-7: calcomEventTypeId populated but calcomBookingUid null resumes booking without re-creating event-type', async () => {
    // Resume path for a half-provisioned row: event-type was backfilled
    // but the booking step never ran (or ran and died before the final
    // update). Re-firing `workshop.created` should reuse the stored id
    // and only run steps 3 + 4.
    mocks.limitMock.mockResolvedValueOnce([
      {
        id: '00000000-0000-0000-0000-000000000001',
        title: 'Partial workshop',
        durationMinutes:   60,
        calcomEventTypeId: '9999',
        calcomBookingUid:  null,
        scheduledAt: new Date('2026-05-01T10:00:00.000Z'),
        timezone:    'Asia/Kolkata',
        maxSeats:    50,
      },
    ])
    vi.stubEnv('CAL_PRIMARY_ATTENDEE_EMAIL', 'vinay@konma.io')
    vi.stubEnv('CAL_PRIMARY_ATTENDEE_NAME', 'Vinay (PolicyDash)')
    mocks.createCalBookingMock.mockResolvedValueOnce({
      uid: 'root-resumed',
      meetingUrl: 'https://meet.google.com/resumed-xxx-yyy',
    })

    const { step } = makeStep()
    const result = await invoke(makeEvent(), step)

    // Event-type creation skipped — reused from the stored id.
    expect(mocks.createCalEventTypeMock).not.toHaveBeenCalled()
    // Booking step fires with the parsed numeric id.
    expect(mocks.createCalBookingMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventTypeId: 9999 }),
    )
    // Backfill writes BOTH identifiers + the meetingUrl so the next
    // invocation short-circuits on the idempotency guard.
    const backfillSet = mocks.setMock.mock.calls[0]?.[0] as {
      calcomEventTypeId?: string
      calcomBookingUid?:  string
      meetingUrl?: string | null
    } | undefined
    expect(backfillSet?.calcomEventTypeId).toBe('9999')
    expect(backfillSet?.calcomBookingUid).toBe('root-resumed')
    expect(backfillSet?.meetingUrl).toBe('https://meet.google.com/resumed-xxx-yyy')
    expect(result).toMatchObject({ ok: true, eventTypeId: 9999, bookingUid: 'root-resumed' })
  })

  it('B4-7b: malformed calcomEventTypeId (non-numeric) throws NonRetriableError', async () => {
    mocks.limitMock.mockResolvedValueOnce([
      {
        id: '00000000-0000-0000-0000-000000000001',
        title: 'Broken',
        durationMinutes: 60,
        calcomEventTypeId: 'not-a-number',
        calcomBookingUid:  null,
        scheduledAt: new Date('2026-05-01T10:00:00.000Z'),
        timezone:    'Asia/Kolkata',
        maxSeats:    50,
      },
    ])

    const { step } = makeStep()
    const { NonRetriableError } = await import('inngest')
    const thrown = await invoke(makeEvent(), step).catch((e) => e)
    expect(thrown).toBeInstanceOf(NonRetriableError)
    expect((thrown as Error).message).toMatch(/non-numeric/i)
    // No cal.com call and no backfill.
    expect(mocks.createCalEventTypeMock).not.toHaveBeenCalled()
    expect(mocks.createCalBookingMock).not.toHaveBeenCalled()
    expect(mocks.updateMock).not.toHaveBeenCalled()
  })

  it('B4-8: missing CAL_PRIMARY_ATTENDEE_EMAIL throws NonRetriableError from the booking step', async () => {
    mocks.limitMock.mockResolvedValueOnce([
      {
        id: '00000000-0000-0000-0000-000000000001',
        title: 'Workshop',
        durationMinutes: 60,
        calcomEventTypeId: null,
        calcomBookingUid:  null,
        scheduledAt: new Date('2026-05-01T10:00:00.000Z'),
        timezone:    'Asia/Kolkata',
        maxSeats:    50,
      },
    ])
    mocks.createCalEventTypeMock.mockResolvedValueOnce({ id: 12345 })
    vi.stubEnv('CAL_PRIMARY_ATTENDEE_EMAIL', '')
    vi.stubEnv('CAL_PRIMARY_ATTENDEE_NAME', 'Vinay (PolicyDash)')

    const { step } = makeStep()
    const { NonRetriableError } = await import('inngest')
    const thrown = await invoke(makeEvent(), step).catch((e) => e)
    expect(thrown).toBeInstanceOf(NonRetriableError)
    expect((thrown as Error).message).toMatch(/CAL_PRIMARY_ATTENDEE_EMAIL/)
    // Backfill must not have run.
    expect(mocks.updateMock).not.toHaveBeenCalled()
  })

  it('T7: meetingUrl=null from createCalBooking lands as literal null in the backfill', async () => {
    // End-to-end coverage for the "cal.com response did not include a Meet
    // URL" branch: backfill MUST still run and MUST write null (not
    // undefined, not the string "null") into workshops.meeting_url.
    mocks.limitMock.mockResolvedValueOnce([
      {
        id:                '00000000-0000-0000-0000-000000000001',
        title:             'Policy Roundtable',
        durationMinutes:   60,
        calcomEventTypeId: null, calcomBookingUid: null,
        scheduledAt:       new Date('2026-05-01T10:00:00.000Z'),
        timezone:          'Asia/Kolkata', maxSeats: 50,
      },
    ])
    vi.stubEnv('CAL_PRIMARY_ATTENDEE_EMAIL', 'vinay@konma.io')
    vi.stubEnv('CAL_PRIMARY_ATTENDEE_NAME', 'Vinay (PolicyDash)')
    mocks.createCalEventTypeMock.mockResolvedValueOnce({ id: 12345 })
    mocks.createCalBookingMock.mockResolvedValueOnce({
      uid: 'root-null-meet',
      meetingUrl: null,
    })

    const { step } = makeStep()
    const result = await invoke(makeEvent(), step)

    expect(result).toMatchObject({ ok: true, bookingUid: 'root-null-meet' })

    const backfillSet = mocks.setMock.mock.calls[0]?.[0] as {
      calcomBookingUid?: string
      meetingUrl?: string | null
    } | undefined
    expect(backfillSet?.calcomBookingUid).toBe('root-null-meet')
    // Critical: must be literal null, not undefined (undefined would cause
    // drizzle to omit the column from the SET clause and leave any prior
    // value intact on a retry).
    expect(backfillSet?.meetingUrl).toBeNull()
  })
})

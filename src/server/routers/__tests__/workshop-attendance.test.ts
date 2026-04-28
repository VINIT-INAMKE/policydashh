/**
 * Tests for attendance-related mutations added in Task 15:
 *   markAttendance, markAllPresent, addWalkIn, resendInvite, cancelRegistration
 *
 * Pattern mirrors workshop-end.test.ts:
 *   - vi.hoisted for shared mock fns
 *   - vi.mock for db, google-calendar, lib/audit, next/cache
 *   - createCaller with a plain ctx object
 *   - assertions on call shape + return value
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

// -------------------------------------------------------------------
// Shared mock functions — hoisted so vi.mock factories can reference them.
// -------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
  addAttendeeToEvent: vi.fn().mockResolvedValue(undefined),
  removeAttendeeFromEvent: vi.fn().mockResolvedValue(undefined),
}))

// -------------------------------------------------------------------
// Google Calendar client stub
// -------------------------------------------------------------------
vi.mock('@/src/lib/google-calendar', () => ({
  createWorkshopEvent: vi.fn(),
  cancelEvent: vi.fn(),
  rescheduleEvent: vi.fn(),
  addAttendeeToEvent: mocks.addAttendeeToEvent,
  removeAttendeeFromEvent: mocks.removeAttendeeFromEvent,
  GoogleCalendarError: class GoogleCalendarError extends Error {
    status: number
    constructor(status: number, msg: string) { super(msg); this.status = status }
  },
}))

vi.mock('@/src/lib/wall-time', () => ({
  wallTimeToUtc: vi.fn().mockReturnValue(new Date('2026-05-01T09:00:00Z')),
}))

vi.mock('@/src/inngest/events', () => ({
  sendWorkshopCompleted: vi.fn().mockResolvedValue(undefined),
  sendWorkshopFeedbackInvitesBatch: vi.fn().mockResolvedValue(undefined),
  sendWorkshopCreated: vi.fn().mockResolvedValue(undefined),
  sendWorkshopRecordingUploaded: vi.fn().mockResolvedValue(undefined),
  sendWorkshopRemindersRescheduled: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/src/lib/audit', () => ({
  writeAuditLog: mocks.writeAuditLog,
}))

vi.mock('@/src/lib/constants', async (orig) => {
  const actual = await orig<typeof import('@/src/lib/constants')>()
  return { ...actual }
})

// -------------------------------------------------------------------
// DB stub — configurable per-test via rebuildDbMock helper below.
// -------------------------------------------------------------------
vi.mock('@/src/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}))

// -------------------------------------------------------------------
// Hashing stub — deterministic for tests
// -------------------------------------------------------------------
vi.mock('@/src/lib/hashing', () => ({
  sha256Hex: vi.fn().mockImplementation((s: string) => `hash:${s}`),
}))

// -------------------------------------------------------------------
// Per-test DB mock builder. Returns a db mock configured with specific
// sequences of select/update/insert results.
// -------------------------------------------------------------------
async function rebuildDbMock(opts: {
  selectResults?: unknown[][]   // one entry per sequential select() call
  updateReturning?: unknown[]   // returned from .returning() on first update
  insertReturning?: unknown[]   // returned from .returning() on first insert
} = {}) {
  const { db } = await import('@/src/db')
  const dbMock = db as any

  let selectIdx = 0
  const selects = opts.selectResults ?? []

  // Clear call history so each test gets a clean slate for assertions.
  dbMock.select.mockClear()
  dbMock.update.mockClear()
  dbMock.insert.mockClear()
  dbMock.delete.mockClear()

  dbMock.select.mockImplementation(() => ({
    from: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => ({
        limit: vi.fn().mockImplementation(() => {
          const rows = selects[selectIdx++] ?? []
          return Promise.resolve(rows)
        }),
        // orderBy().limit() chain — consume one slot from selects (same as
        // the plain limit() path so cancelled-row lookups work correctly).
        orderBy: vi.fn().mockImplementation(() => ({
          limit: vi.fn().mockImplementation(() => {
            const rows = selects[selectIdx++] ?? []
            return Promise.resolve(rows)
          }),
        })),
      })),
    })),
  }))

  dbMock.update.mockImplementation(() => ({
    set: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => {
        // Must be a real Promise (so .catch() works for trpc touchActivity
        // middleware) AND expose .returning() for mutations that need counts.
        const returningResult = opts.updateReturning ?? []
        const p = Promise.resolve(returningResult) as any
        p.returning = vi.fn().mockResolvedValue(returningResult)
        return p
      }),
    })),
  }))

  dbMock.insert.mockImplementation(() => ({
    values: vi.fn().mockImplementation(() => ({
      returning: vi.fn().mockResolvedValue(opts.insertReturning ?? []),
    })),
  }))

  dbMock.delete.mockImplementation(() => ({
    where: vi.fn().mockResolvedValue([]),
  }))
}

// -------------------------------------------------------------------
// Router module — loaded once after all mocks are in place.
// -------------------------------------------------------------------
let workshopRouterModule: any

beforeAll(async () => {
  const path = ['@', 'src', 'server', 'routers', 'workshop'].join('/')
  try {
    workshopRouterModule = await import(/* @vite-ignore */ path)
  } catch (err) {
    workshopRouterModule = undefined
    console.warn('[workshop-attendance.test] router load failed:', (err as Error).message)
  }
})

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------
const WORKSHOP_ID      = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const REGISTRATION_ID  = 'b1fecbaa-9c0b-4ef8-bb6d-6bb9bd380b22'
const ACTOR_ID         = 'c2ffd777-8e2d-4fa9-ab8f-8dd1df490c33'
const GCAL_EVENT_ID    = 'gcal-event-1'

function makeCtx() {
  return {
    userId: ACTOR_ID,
    user: {
      id:    ACTOR_ID,
      role:  'admin' as const,
      email: 'admin@example.com',
      name:  'Test Admin',
    },
    requestMeta: { ipAddress: '127.0.0.1', userAgent: 'vitest' },
  }
}

function makeRegistration(overrides: Record<string, unknown> = {}) {
  return {
    id:              REGISTRATION_ID,
    workshopId:      WORKSHOP_ID,
    email:           'attendee@example.com',
    name:            'Attendee One',
    status:          'registered',
    inviteSentAt:    null,
    attendedAt:      null,
    attendanceSource: null,
    ...overrides,
  }
}

function makeWorkshop(overrides: Record<string, unknown> = {}) {
  return {
    id:                    WORKSHOP_ID,
    scheduledAt:           new Date('2026-05-01T09:00:00Z'),
    googleCalendarEventId: GCAL_EVENT_ID,
    ...overrides,
  }
}

// -------------------------------------------------------------------
// Helpers: caller
// -------------------------------------------------------------------
function getCaller() {
  if (!workshopRouterModule?.workshopRouter) return null
  return workshopRouterModule.workshopRouter.createCaller(makeCtx())
}

// -------------------------------------------------------------------
// describe: markAttendance
// -------------------------------------------------------------------
describe('workshop.markAttendance', () => {
  beforeEach(async () => {
    mocks.writeAuditLog.mockClear()
    await rebuildDbMock()
  })

  it('procedure exists on the router', () => {
    expect(workshopRouterModule?.workshopRouter).toBeDefined()
    const procs = (workshopRouterModule.workshopRouter as any)._def.procedures
    expect(procs.markAttendance).toBeDefined()
  })

  it('stamps attendedAt + attendanceSource=manual when attended=true', async () => {
    const caller = getCaller()
    if (!caller) return

    // M10: updateReturning must be non-empty so the NOT_FOUND guard doesn't fire.
    await rebuildDbMock({ updateReturning: [{ id: REGISTRATION_ID }] })
    const { db } = await import('@/src/db')
    const result = await caller.markAttendance({
      workshopId: WORKSHOP_ID,
      registrationId: REGISTRATION_ID,
      attended: true,
    })

    expect(result).toEqual({ ok: true })

    // Find our mutation's db.update call by matching the set() args (not lastActivityAt)
    const allUpdateCalls = (db.update as any).mock.results
      .map((r: any) => r?.value?.set?.mock?.calls?.[0]?.[0])
      .filter((args: any) => args && !('lastActivityAt' in args))
    const setArgs = allUpdateCalls[0]
    expect(setArgs).toMatchObject({
      attendedAt: expect.any(Date),
      attendanceSource: 'manual',
    })
  })

  it('clears attendedAt and attendanceSource when attended=false', async () => {
    const caller = getCaller()
    if (!caller) return

    // M10: updateReturning must be non-empty so the NOT_FOUND guard doesn't fire.
    await rebuildDbMock({ updateReturning: [{ id: REGISTRATION_ID }] })
    const { db } = await import('@/src/db')
    const result = await caller.markAttendance({
      workshopId: WORKSHOP_ID,
      registrationId: REGISTRATION_ID,
      attended: false,
    })

    expect(result).toEqual({ ok: true })

    // Find our mutation's db.update call by matching the set() args (not lastActivityAt)
    const allUpdateCalls = (db.update as any).mock.results
      .map((r: any) => r?.value?.set?.mock?.calls?.[0]?.[0])
      .filter((args: any) => args && !('lastActivityAt' in args))
    const setArgs = allUpdateCalls[0]
    expect(setArgs).toMatchObject({
      attendedAt: null,
      attendanceSource: null,
    })
  })

  it('writes audit log with WORKSHOP_MARK_ATTENDANCE action', async () => {
    const caller = getCaller()
    if (!caller) return

    await rebuildDbMock({ updateReturning: [{ id: REGISTRATION_ID }] })
    await caller.markAttendance({
      workshopId: WORKSHOP_ID,
      registrationId: REGISTRATION_ID,
      attended: true,
    })
    await new Promise((r) => setTimeout(r, 0))

    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'workshop.mark_attendance',
        entityType: 'workshop_registration',
        entityId: REGISTRATION_ID,
      }),
    )
  })
})

// -------------------------------------------------------------------
// describe: markAllPresent
// -------------------------------------------------------------------
describe('workshop.markAllPresent', () => {
  beforeEach(async () => {
    mocks.writeAuditLog.mockClear()
  })

  it('procedure exists on the router', () => {
    expect(workshopRouterModule?.workshopRouter).toBeDefined()
    const procs = (workshopRouterModule.workshopRouter as any)._def.procedures
    expect(procs.markAllPresent).toBeDefined()
  })

  it('returns affected count from .returning()', async () => {
    const caller = getCaller()
    if (!caller) return

    await rebuildDbMock({
      updateReturning: [{ id: 'id-1' }, { id: 'id-2' }],
    })

    const result = await caller.markAllPresent({ workshopId: WORKSHOP_ID })
    expect(result).toEqual({ affected: 2 })
  })

  it('returns affected: 0 when no rows matched', async () => {
    const caller = getCaller()
    if (!caller) return

    await rebuildDbMock({ updateReturning: [] })
    const result = await caller.markAllPresent({ workshopId: WORKSHOP_ID })
    expect(result).toEqual({ affected: 0 })
  })

  it('writes audit log with affected count', async () => {
    const caller = getCaller()
    if (!caller) return

    await rebuildDbMock({ updateReturning: [{ id: 'id-1' }] })
    await caller.markAllPresent({ workshopId: WORKSHOP_ID })
    await new Promise((r) => setTimeout(r, 0))

    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'workshop.mark_all_present',
        entityType: 'workshop',
        entityId: WORKSHOP_ID,
        payload: expect.objectContaining({ affected: 1 }),
      }),
    )
  })
})

// -------------------------------------------------------------------
// describe: addWalkIn
// -------------------------------------------------------------------
describe('workshop.addWalkIn', () => {
  beforeEach(async () => {
    mocks.writeAuditLog.mockClear()
    mocks.addAttendeeToEvent.mockClear()
  })

  it('procedure exists on the router', () => {
    expect(workshopRouterModule?.workshopRouter).toBeDefined()
    const procs = (workshopRouterModule.workshopRouter as any)._def.procedures
    expect(procs.addWalkIn).toBeDefined()
  })

  it('inserts new registration with attendedAt=now, returns added=true', async () => {
    const caller = getCaller()
    if (!caller) return

    // First select: no non-cancelled collision; second select: no cancelled row;
    // third select: workshop row
    await rebuildDbMock({
      selectResults: [
        [],                              // non-cancelled collision check → none
        [],                              // cancelled row check → none
        [makeWorkshop()],                // workshop lookup
      ],
      insertReturning: [{ id: REGISTRATION_ID }],
    })

    const result = await caller.addWalkIn({
      workshopId: WORKSHOP_ID,
      email: 'newwalkin@example.com',
      name: 'Walk In Person',
    })

    expect(result).toEqual({ added: true, registrationId: REGISTRATION_ID })
  })

  it('does NOT call addAttendeeToEvent (workshop already ended)', async () => {
    const caller = getCaller()
    if (!caller) return

    await rebuildDbMock({
      selectResults: [[], [], [makeWorkshop()]],
      insertReturning: [{ id: REGISTRATION_ID }],
    })

    await caller.addWalkIn({
      workshopId: WORKSHOP_ID,
      email: 'newwalkin@example.com',
      name: 'Walk In',
    })

    expect(mocks.addAttendeeToEvent).not.toHaveBeenCalled()
  })

  it('on email collision: UPDATEs existing row and returns added=false', async () => {
    const caller = getCaller()
    if (!caller) return

    // First select returns existing row (collision)
    await rebuildDbMock({
      selectResults: [
        [{ id: REGISTRATION_ID }],       // collision found
      ],
    })

    const result = await caller.addWalkIn({
      workshopId: WORKSHOP_ID,
      email: 'existing@example.com',
      name: 'Existing Person',
    })

    expect(result).toEqual({
      added: false,
      attendanceMarked: true,
      registrationId: REGISTRATION_ID,
    })
  })

  it('on email collision: stamps attendance on the existing row', async () => {
    const caller = getCaller()
    if (!caller) return

    await rebuildDbMock({
      selectResults: [[{ id: REGISTRATION_ID }]],
    })

    const { db } = await import('@/src/db')
    await caller.addWalkIn({
      workshopId: WORKSHOP_ID,
      email: 'existing@example.com',
      name: 'Existing Person',
    })

    // Find our mutation's db.update call by matching the set() args (not lastActivityAt)
    const allUpdateCalls = (db.update as any).mock.results
      .map((r: any) => r?.value?.set?.mock?.calls?.[0]?.[0])
      .filter((args: any) => args && !('lastActivityAt' in args))
    const setArgs = allUpdateCalls[0]
    expect(setArgs).toMatchObject({
      attendedAt: expect.any(Date),
      attendanceSource: 'manual',
    })
  })

  it('throws NOT_FOUND when workshop does not exist (new attendee path)', async () => {
    const caller = getCaller()
    if (!caller) return

    await rebuildDbMock({
      selectResults: [
        [],   // no non-cancelled collision
        [],   // no cancelled row
        [],   // workshop not found
      ],
    })

    let caught: any
    await caller.addWalkIn({
      workshopId: WORKSHOP_ID,
      email: 'new@example.com',
      name: 'New Person',
    }).catch((e: any) => { caught = e })

    expect(caught).toBeDefined()
    expect(caught.code).toBe('NOT_FOUND')
  })

  it('C4: reactivates a cancelled row instead of inserting a duplicate', async () => {
    const caller = getCaller()
    if (!caller) return

    const CANCELLED_REG_ID = 'reg-old-cancelled-uuid'

    await rebuildDbMock({
      selectResults: [
        [],                                                    // non-cancelled lookup → none
        [{ id: CANCELLED_REG_ID, name: 'Alice' }],            // cancelled row found
      ],
    })

    const { db } = await import('@/src/db')
    const result = await caller.addWalkIn({
      workshopId: WORKSHOP_ID,
      email: 'alice@example.com',
      name: 'Alice',
    })

    // Returns reactivated=true, NOT added=true
    expect(result).toEqual({
      added: false,
      reactivated: true,
      registrationId: CANCELLED_REG_ID,
    })

    // db.update called with reactivation fields
    const allUpdateCalls = (db.update as any).mock.results
      .map((r: any) => r?.value?.set?.mock?.calls?.[0]?.[0])
      .filter((args: any) => args && !('lastActivityAt' in args))
    const setArgs = allUpdateCalls[0]
    expect(setArgs).toMatchObject({
      status: 'registered',
      cancelledAt: null,
      attendedAt: expect.any(Date),
      attendanceSource: 'manual',
    })

    // db.insert must NOT have been called
    expect(db.insert as any).not.toHaveBeenCalled()
  })
})

// -------------------------------------------------------------------
// describe: resendInvite
// -------------------------------------------------------------------
describe('workshop.resendInvite', () => {
  beforeEach(async () => {
    mocks.writeAuditLog.mockClear()
    mocks.addAttendeeToEvent.mockClear()
  })

  it('procedure exists on the router', () => {
    expect(workshopRouterModule?.workshopRouter).toBeDefined()
    const procs = (workshopRouterModule.workshopRouter as any)._def.procedures
    expect(procs.resendInvite).toBeDefined()
  })

  it('calls addAttendeeToEvent and stamps inviteSentAt on success', async () => {
    const caller = getCaller()
    if (!caller) return

    await rebuildDbMock({
      selectResults: [
        [makeRegistration({ inviteSentAt: null })],
        [makeWorkshop()],
      ],
    })

    const { db } = await import('@/src/db')
    const result = await caller.resendInvite({
      workshopId: WORKSHOP_ID,
      registrationId: REGISTRATION_ID,
    })

    expect(result).toEqual({ ok: true })
    expect(mocks.addAttendeeToEvent).toHaveBeenCalledWith({
      eventId: GCAL_EVENT_ID,
      attendeeEmail: 'attendee@example.com',
      attendeeName: 'Attendee One',
    })

    // Find our mutation's db.update call by matching the set() args (not lastActivityAt)
    const allUpdateCalls = (db.update as any).mock.results
      .map((r: any) => r?.value?.set?.mock?.calls?.[0]?.[0])
      .filter((args: any) => args && !('lastActivityAt' in args))
    const setArgs = allUpdateCalls[0]
    expect(setArgs).toMatchObject({ inviteSentAt: expect.any(Date) })
  })

  it('throws BAD_REQUEST when inviteSentAt is already set', async () => {
    const caller = getCaller()
    if (!caller) return

    await rebuildDbMock({
      selectResults: [
        [makeRegistration({ inviteSentAt: new Date() })],
      ],
    })

    let caught: any
    await caller.resendInvite({
      workshopId: WORKSHOP_ID,
      registrationId: REGISTRATION_ID,
    }).catch((e: any) => { caught = e })

    expect(caught).toBeDefined()
    expect(caught.code).toBe('BAD_REQUEST')
    expect(caught.message).toMatch(/already sent/i)
    expect(mocks.addAttendeeToEvent).not.toHaveBeenCalled()
  })

  it('throws NOT_FOUND when registration does not exist', async () => {
    const caller = getCaller()
    if (!caller) return

    await rebuildDbMock({ selectResults: [[]] })

    let caught: any
    await caller.resendInvite({
      workshopId: WORKSHOP_ID,
      registrationId: REGISTRATION_ID,
    }).catch((e: any) => { caught = e })

    expect(caught).toBeDefined()
    expect(caught.code).toBe('NOT_FOUND')
  })

  it('throws NOT_FOUND when workshop has no googleCalendarEventId', async () => {
    const caller = getCaller()
    if (!caller) return

    await rebuildDbMock({
      selectResults: [
        [makeRegistration()],
        [{ googleCalendarEventId: null }],
      ],
    })

    let caught: any
    await caller.resendInvite({
      workshopId: WORKSHOP_ID,
      registrationId: REGISTRATION_ID,
    }).catch((e: any) => { caught = e })

    expect(caught).toBeDefined()
    expect(caught.code).toBe('NOT_FOUND')
  })

  it('translates GoogleCalendarError(status>=500) to BAD_GATEWAY', async () => {
    const caller = getCaller()
    if (!caller) return

    await rebuildDbMock({
      selectResults: [
        [makeRegistration()],
        [makeWorkshop()],
      ],
    })

    const { GoogleCalendarError } = await import('@/src/lib/google-calendar')
    mocks.addAttendeeToEvent.mockRejectedValueOnce(
      new GoogleCalendarError(503, 'upstream error'),
    )

    let caught: any
    await caller.resendInvite({
      workshopId: WORKSHOP_ID,
      registrationId: REGISTRATION_ID,
    }).catch((e: any) => { caught = e })

    expect(caught).toBeDefined()
    expect(caught.code).toBe('BAD_GATEWAY')
  })

  it('translates GoogleCalendarError(status<500) to BAD_REQUEST', async () => {
    const caller = getCaller()
    if (!caller) return

    await rebuildDbMock({
      selectResults: [
        [makeRegistration()],
        [makeWorkshop()],
      ],
    })

    const { GoogleCalendarError } = await import('@/src/lib/google-calendar')
    mocks.addAttendeeToEvent.mockRejectedValueOnce(
      new GoogleCalendarError(403, 'not authorized'),
    )

    let caught: any
    await caller.resendInvite({
      workshopId: WORKSHOP_ID,
      registrationId: REGISTRATION_ID,
    }).catch((e: any) => { caught = e })

    expect(caught).toBeDefined()
    expect(caught.code).toBe('BAD_REQUEST')
  })

  it('writes audit log with WORKSHOP_RESEND_INVITE action', async () => {
    const caller = getCaller()
    if (!caller) return

    await rebuildDbMock({
      selectResults: [
        [makeRegistration()],
        [makeWorkshop()],
      ],
    })

    await caller.resendInvite({ workshopId: WORKSHOP_ID, registrationId: REGISTRATION_ID })
    await new Promise((r) => setTimeout(r, 0))

    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'workshop.resend_invite',
        entityType: 'workshop_registration',
        entityId: REGISTRATION_ID,
      }),
    )
  })
})

// -------------------------------------------------------------------
// describe: cancelRegistration
// -------------------------------------------------------------------
describe('workshop.cancelRegistration', () => {
  beforeEach(async () => {
    mocks.writeAuditLog.mockClear()
    mocks.removeAttendeeFromEvent.mockClear()
    const { revalidateTag } = await import('next/cache')
    ;(revalidateTag as any).mockClear()
  })

  it('procedure exists on the router', () => {
    expect(workshopRouterModule?.workshopRouter).toBeDefined()
    const procs = (workshopRouterModule.workshopRouter as any)._def.procedures
    expect(procs.cancelRegistration).toBeDefined()
  })

  it('with notify=true: sets status=cancelled and calls removeAttendeeFromEvent', async () => {
    const caller = getCaller()
    if (!caller) return

    await rebuildDbMock({
      selectResults: [
        [makeRegistration()],
        [makeWorkshop()],
      ],
    })

    const result = await caller.cancelRegistration({
      workshopId: WORKSHOP_ID,
      registrationId: REGISTRATION_ID,
      notify: true,
    })

    expect(result).toEqual({ ok: true, googleSyncFailed: false })
    expect(mocks.removeAttendeeFromEvent).toHaveBeenCalledWith({
      eventId: GCAL_EVENT_ID,
      attendeeEmail: 'attendee@example.com',
    })

    const { db } = await import('@/src/db')
    // Find our mutation's db.update call by matching the set() args (not lastActivityAt)
    const allUpdateCalls = (db.update as any).mock.results
      .map((r: any) => r?.value?.set?.mock?.calls?.[0]?.[0])
      .filter((args: any) => args && !('lastActivityAt' in args))
    const setArgs = allUpdateCalls[0]
    expect(setArgs).toMatchObject({ status: 'cancelled', cancelledAt: expect.any(Date) })
  })

  it('with notify=false: sets status=cancelled, no Google call', async () => {
    const caller = getCaller()
    if (!caller) return

    await rebuildDbMock({
      selectResults: [[makeRegistration()]],
    })

    const result = await caller.cancelRegistration({
      workshopId: WORKSHOP_ID,
      registrationId: REGISTRATION_ID,
      notify: false,
    })

    expect(result).toEqual({ ok: true, googleSyncFailed: false })
    expect(mocks.removeAttendeeFromEvent).not.toHaveBeenCalled()
  })

  it('does not block cancel when removeAttendeeFromEvent throws', async () => {
    const caller = getCaller()
    if (!caller) return

    mocks.removeAttendeeFromEvent.mockRejectedValueOnce(new Error('Google exploded'))

    await rebuildDbMock({
      selectResults: [
        [makeRegistration()],
        [makeWorkshop()],
      ],
    })

    // Should resolve successfully despite the Google error, with googleSyncFailed=true
    const result = await caller.cancelRegistration({
      workshopId: WORKSHOP_ID,
      registrationId: REGISTRATION_ID,
      notify: true,
    })

    expect(result).toEqual({ ok: true, googleSyncFailed: true })

    // DB update must still have happened
    const { db } = await import('@/src/db')
    const allUpdateCalls = (db.update as any).mock.results
      .map((r: any) => r?.value?.set?.mock?.calls?.[0]?.[0])
      .filter((args: any) => args && !('lastActivityAt' in args))
    const setArgs = allUpdateCalls[0]
    expect(setArgs).toMatchObject({ status: 'cancelled', cancelledAt: expect.any(Date) })
  })

  it('throws NOT_FOUND when registration does not exist', async () => {
    const caller = getCaller()
    if (!caller) return

    await rebuildDbMock({ selectResults: [[]] })

    let caught: any
    await caller.cancelRegistration({
      workshopId: WORKSHOP_ID,
      registrationId: REGISTRATION_ID,
      notify: false,
    }).catch((e: any) => { caught = e })

    expect(caught).toBeDefined()
    expect(caught.code).toBe('NOT_FOUND')
  })

  it('calls revalidateTag to bust spots cache', async () => {
    const caller = getCaller()
    if (!caller) return

    await rebuildDbMock({ selectResults: [[makeRegistration()]] })

    await caller.cancelRegistration({
      workshopId: WORKSHOP_ID,
      registrationId: REGISTRATION_ID,
      notify: false,
    })

    const { revalidateTag } = await import('next/cache')
    expect(revalidateTag).toHaveBeenCalledWith(
      `workshop-spots-${WORKSHOP_ID}`,
      'max',
    )
  })

  it('writes audit log with WORKSHOP_CANCEL_REGISTRATION action', async () => {
    const caller = getCaller()
    if (!caller) return

    await rebuildDbMock({ selectResults: [[makeRegistration()]] })
    await caller.cancelRegistration({
      workshopId: WORKSHOP_ID,
      registrationId: REGISTRATION_ID,
      notify: false,
    })
    await new Promise((r) => setTimeout(r, 0))

    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'workshop.cancel_registration',
        entityType: 'workshop_registration',
        entityId: REGISTRATION_ID,
        payload: expect.objectContaining({ notify: false }),
      }),
    )
  })

  it('M11: throws NOT_FOUND when registration belongs to a different workshop', async () => {
    // Simulate: registration exists in DB but for a different workshopId.
    // The WHERE clause (registrationId AND workshopId) returns no rows.
    const caller = getCaller()
    if (!caller) return

    // mock SELECT returns [] — registration exists but belongs to a different workshop
    await rebuildDbMock({ selectResults: [[]] })

    let caught: any
    await caller.cancelRegistration({
      workshopId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      registrationId: REGISTRATION_ID,
      notify: false,
    }).catch((e: any) => { caught = e })

    expect(caught).toBeDefined()
    expect(caught.code).toBe('NOT_FOUND')
    // The google removeAttendee and revalidateTag must NOT have been called
    expect(mocks.removeAttendeeFromEvent).not.toHaveBeenCalled()
    const { revalidateTag } = await import('next/cache')
    expect(revalidateTag as any).not.toHaveBeenCalled()
  })
})

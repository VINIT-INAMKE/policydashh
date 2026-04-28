/**
 * Tests for workshop.endWorkshop mutation (Task 14, Google Calendar pivot).
 *
 * Pattern mirrors evidence-request-export.test.ts:
 *   - vi.hoisted for shared mock fns
 *   - vi.mock for db, inngest/events, lib/audit
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
  sendWorkshopCompleted:          vi.fn().mockResolvedValue(undefined),
  sendWorkshopFeedbackInvitesBatch: vi.fn().mockResolvedValue(undefined),
  writeAuditLog:                  vi.fn().mockResolvedValue(undefined),

  // DB select chain — returns configurable rows
  dbSelectResult: [] as unknown[],
  // DB update/insert — no-op by default
  dbUpdateResult: [] as unknown[],
  dbInsertResult: [] as unknown[],
}))

// -------------------------------------------------------------------
// Google Calendar client — not exercised by endWorkshop but the router
// module imports it, so we need to satisfy the import boundary.
// -------------------------------------------------------------------
vi.mock('@/src/lib/google-calendar', () => ({
  createWorkshopEvent:  vi.fn(),
  cancelEvent:          vi.fn(),
  rescheduleEvent:      vi.fn(),
  GoogleCalendarError:  class GoogleCalendarError extends Error {
    status: number
    constructor(msg: string, status = 500) { super(msg); this.status = status }
  },
}))

vi.mock('@/src/lib/wall-time', () => ({
  wallTimeToUtc: vi.fn().mockReturnValue(new Date('2026-05-01T09:00:00Z')),
}))

vi.mock('@/src/inngest/events', async (orig) => {
  const actual = await orig<typeof import('@/src/inngest/events')>()
  return {
    ...actual,
    sendWorkshopCompleted:            mocks.sendWorkshopCompleted,
    sendWorkshopFeedbackInvitesBatch: mocks.sendWorkshopFeedbackInvitesBatch,
    // Other helpers used by sibling mutations — keep real so the module loads.
    sendWorkshopCreated:              vi.fn().mockResolvedValue(undefined),
    sendWorkshopRecordingUploaded:    vi.fn().mockResolvedValue(undefined),
    sendWorkshopRemindersRescheduled: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('@/src/lib/audit', () => ({
  writeAuditLog: mocks.writeAuditLog,
}))

vi.mock('@/src/lib/constants', async (orig) => {
  const actual = await orig<typeof import('@/src/lib/constants')>()
  return { ...actual }
})

// -------------------------------------------------------------------
// DB stub — endWorkshop calls: select (load workshop), update, insert
// (workflowTransitions), select (registrants).
// We expose a configurable `dbSelectResult` that the select chain returns
// on the FIRST call; subsequent select calls return registrant rows.
// -------------------------------------------------------------------

// Track select call count so we can return different rows per call.
let selectCallCount = 0

vi.mock('@/src/db', () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => ({
          limit: vi.fn().mockImplementation(() => {
            // First select = load workshop row
            selectCallCount++
            if (selectCallCount === 1) return Promise.resolve(mocks.dbSelectResult)
            // Subsequent selects = should not be reached in endWorkshop flow,
            // but some sibling mutations use them — return empty.
            return Promise.resolve([])
          }),
          orderBy: vi.fn().mockImplementation(() => Promise.resolve([])),
        })),
        // Registrant select uses .where() without .limit()
        // — we handle this by returning registrant rows on the second call.
      })),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => Promise.resolve(mocks.dbUpdateResult)),
      })),
    })),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation(() => ({
        returning: vi.fn().mockResolvedValue(mocks.dbInsertResult),
        onConflictDoNothing: vi.fn().mockResolvedValue(mocks.dbInsertResult),
      })),
    })),
    delete: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => ({
        returning: vi.fn().mockResolvedValue([]),
      })),
    })),
  },
}))

// -------------------------------------------------------------------
// The router's registrant query: .select().from().where() with no .limit()
// We need to intercept that second select chain differently.
// Rewrite db mock with a smarter select that tracks call order.
// -------------------------------------------------------------------

// We'll use a fresh per-test approach: override the db mock's select to
// return the right data based on call order.
async function rebuildDbMock(
  workshopRow: object | null,
  registrantRows: object[],
) {
  const { db } = await import('@/src/db')
  const dbMock = db as any

  let callIdx = 0
  dbMock.select.mockImplementation(() => {
    const thisCall = callIdx++
    if (thisCall === 0) {
      // Load workshop
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(workshopRow ? [workshopRow] : []),
          }),
        }),
      }
    }
    // Load registrants (second select, no limit)
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(Promise.resolve(registrantRows)),
      }),
    }
  })
}

// -------------------------------------------------------------------
// Workshop router module — loaded once after all mocks are in place.
// -------------------------------------------------------------------
let workshopRouterModule: any

beforeAll(async () => {
  const path = ['@', 'src', 'server', 'routers', 'workshop'].join('/')
  try {
    workshopRouterModule = await import(/* @vite-ignore */ path)
  } catch (err) {
    workshopRouterModule = undefined
    console.warn('[workshop-end.test] router load failed:', (err as Error).message)
  }
})

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
const WORKSHOP_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const ACTOR_ID    = 'c2ffd777-8e2d-4fa9-ab8f-8dd1df490c33'

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

function upcomingWorkshop(overrides: Record<string, unknown> = {}) {
  return {
    id:                      WORKSHOP_ID,
    status:                  'upcoming',
    completionPipelineSentAt: null,
    createdBy:               ACTOR_ID,
    title:                   'Test Workshop',
    googleCalendarEventId:   'gcal-event-1',
    ...overrides,
  }
}

function makeRegistrants(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    email:  `user${i}@example.com`,
    name:   `User ${i}`,
    userId: null,
  }))
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------
describe('workshop.endWorkshop', () => {
  beforeEach(() => {
    mocks.sendWorkshopCompleted.mockClear()
    mocks.sendWorkshopFeedbackInvitesBatch.mockClear()
    mocks.writeAuditLog.mockClear()
    selectCallCount = 0
  })

  it('procedure exists on the router', () => {
    expect(workshopRouterModule?.workshopRouter).toBeDefined()
    const procs = (workshopRouterModule.workshopRouter as any)._def.procedures
    expect(procs.endWorkshop).toBeDefined()
  })

  it('flips status to completed, stamps completionPipelineSentAt, fires both events', async () => {
    expect(workshopRouterModule?.workshopRouter).toBeDefined()
    await rebuildDbMock(upcomingWorkshop(), makeRegistrants(3))

    const { db } = await import('@/src/db')
    const caller = workshopRouterModule.workshopRouter.createCaller(makeCtx())
    const result = await caller.endWorkshop({ workshopId: WORKSHOP_ID })

    // Return value
    expect(result).toEqual({ alreadyCompleted: false, registrantsNotified: 3 })

    // DB update called with completed status + completionPipelineSentAt
    const updateSetArgs = (db.update as any).mock.results[0]?.value?.set?.mock?.calls[0]?.[0]
    expect(updateSetArgs).toMatchObject({
      status: 'completed',
      completionPipelineSentAt: expect.any(Date),
    })

    // workflow_transitions insert
    expect(db.insert).toHaveBeenCalled()

    // Events fired
    expect(mocks.sendWorkshopCompleted).toHaveBeenCalledTimes(1)
    expect(mocks.sendWorkshopCompleted).toHaveBeenCalledWith({
      workshopId:  WORKSHOP_ID,
      moderatorId: ACTOR_ID,
    })
    expect(mocks.sendWorkshopFeedbackInvitesBatch).toHaveBeenCalledTimes(1)
    const batchArg = mocks.sendWorkshopFeedbackInvitesBatch.mock.calls[0][0]
    expect(batchArg).toHaveLength(3)
    expect(batchArg[0]).toMatchObject({ workshopId: WORKSHOP_ID, email: 'user0@example.com' })
  })

  it('is a no-op when completionPipelineSentAt is set (regardless of status)', async () => {
    // I1/C3: idempotency guard gates purely on completionPipelineSentAt now —
    // status being 'completed' is no longer required. This prevents re-firing
    // when status was set via transition but this column was also stamped.
    expect(workshopRouterModule?.workshopRouter).toBeDefined()
    await rebuildDbMock(
      upcomingWorkshop({ status: 'completed', completionPipelineSentAt: new Date() }),
      [],
    )

    const caller = workshopRouterModule.workshopRouter.createCaller(makeCtx())
    const result = await caller.endWorkshop({ workshopId: WORKSHOP_ID })

    expect(result).toEqual({ alreadyCompleted: true, registrantsNotified: 0 })
    expect(mocks.sendWorkshopCompleted).not.toHaveBeenCalled()
    expect(mocks.sendWorkshopFeedbackInvitesBatch).not.toHaveBeenCalled()
  })

  it('is a no-op when completionPipelineSentAt is set even if status is not completed', async () => {
    // I1: the column alone is the gate — a transient status discrepancy
    // (e.g. DB write of status failed after column was stamped) must not
    // cause a re-fire of the fan-out pipeline.
    expect(workshopRouterModule?.workshopRouter).toBeDefined()
    await rebuildDbMock(
      upcomingWorkshop({ status: 'upcoming', completionPipelineSentAt: new Date() }),
      [],
    )

    const caller = workshopRouterModule.workshopRouter.createCaller(makeCtx())
    const result = await caller.endWorkshop({ workshopId: WORKSHOP_ID })

    expect(result).toEqual({ alreadyCompleted: true, registrantsNotified: 0 })
    expect(mocks.sendWorkshopCompleted).not.toHaveBeenCalled()
    expect(mocks.sendWorkshopFeedbackInvitesBatch).not.toHaveBeenCalled()
  })

  it('rejects with BAD_REQUEST when status is archived', async () => {
    expect(workshopRouterModule?.workshopRouter).toBeDefined()
    await rebuildDbMock(upcomingWorkshop({ status: 'archived' }), [])

    const caller = workshopRouterModule.workshopRouter.createCaller(makeCtx())
    let caught: any
    await caller.endWorkshop({ workshopId: WORKSHOP_ID }).catch((e: any) => { caught = e })

    expect(caught).toBeDefined()
    expect(caught.code).toBe('BAD_REQUEST')
    expect(mocks.sendWorkshopCompleted).not.toHaveBeenCalled()
  })

  it('throws NOT_FOUND when workshop does not exist', async () => {
    expect(workshopRouterModule?.workshopRouter).toBeDefined()
    await rebuildDbMock(null, [])

    const caller = workshopRouterModule.workshopRouter.createCaller(makeCtx())
    let caught: any
    await caller.endWorkshop({ workshopId: WORKSHOP_ID }).catch((e: any) => { caught = e })

    expect(caught).toBeDefined()
    expect(caught.code).toBe('NOT_FOUND')
  })

  it('fires sendWorkshopFeedbackInvitesBatch with zero items when no registrants', async () => {
    expect(workshopRouterModule?.workshopRouter).toBeDefined()
    await rebuildDbMock(upcomingWorkshop(), [])

    const caller = workshopRouterModule.workshopRouter.createCaller(makeCtx())
    const result = await caller.endWorkshop({ workshopId: WORKSHOP_ID })

    expect(result).toEqual({ alreadyCompleted: false, registrantsNotified: 0 })
    // sendWorkshopFeedbackInvitesBatch still called — empty array short-circuits inside the helper
    expect(mocks.sendWorkshopFeedbackInvitesBatch).toHaveBeenCalledWith([])
  })

  it('runs completion pipeline when status is completed but completionPipelineSentAt is null', async () => {
    // I1/C3: completionPipelineSentAt=null means the fan-out was never fired
    // (e.g. transition path stamped status but the column write failed).
    // endWorkshop must proceed and fire the pipeline in this case.
    expect(workshopRouterModule?.workshopRouter).toBeDefined()
    await rebuildDbMock(
      upcomingWorkshop({ status: 'completed', completionPipelineSentAt: null }),
      makeRegistrants(2),
    )

    const caller = workshopRouterModule.workshopRouter.createCaller(makeCtx())
    const result = await caller.endWorkshop({ workshopId: WORKSHOP_ID })

    expect(result).toEqual({ alreadyCompleted: false, registrantsNotified: 2 })
    expect(mocks.sendWorkshopCompleted).toHaveBeenCalledTimes(1)
    expect(mocks.sendWorkshopFeedbackInvitesBatch).toHaveBeenCalledTimes(1)
  })

  it('writes an audit log entry with WORKSHOP_END action', async () => {
    expect(workshopRouterModule?.workshopRouter).toBeDefined()
    await rebuildDbMock(upcomingWorkshop(), makeRegistrants(1))

    const caller = workshopRouterModule.workshopRouter.createCaller(makeCtx())
    await caller.endWorkshop({ workshopId: WORKSHOP_ID })

    // writeAuditLog is fire-and-forget (.catch()); wait a tick for it to run.
    await new Promise((r) => setTimeout(r, 0))
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action:     'workshop.end',
        entityType: 'workshop',
        entityId:   WORKSHOP_ID,
        actorId:    ACTOR_ID,
      }),
    )
  })
})

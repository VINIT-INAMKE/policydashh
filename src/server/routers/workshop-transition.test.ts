import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

/**
 * Wave 0 RED contract for Plan 01 (WS-06).
 * Goes GREEN when src/server/routers/workshop.ts exports a router that
 * includes `transition` and `approveArtifact` procedures.
 *
 * Strategy: dynamic import of the workshop router module + invoke the
 * procedure handlers directly with a fake ctx. We do NOT go through
 * tRPC createCaller because that adds too much indirection for a
 * Wave 0 contract test. Plan 01 is free to add a createCaller-based
 * test alongside.
 */

// The workshop router transitively imports src/lib/calcom.ts which has
// `import 'server-only'` at the top. Defang it so the module loads under
// vitest.
vi.mock('server-only', () => ({}))

// calcom.ts also constructs things at module load; stub it out entirely so
// its env-var requirements don't trip the test env.
vi.mock('@/src/lib/calcom', () => ({
  createCalEventType: vi.fn(),
  updateCalEventType: vi.fn(),
  createCalBooking: vi.fn(),
  addAttendeeToBooking: vi.fn(),
  cancelCalBooking: vi.fn(),
  rescheduleCalBooking: vi.fn(),
  deleteCalEventType: vi.fn(),
  getCalBooking: vi.fn(),
}))

const mocks = vi.hoisted(() => {
  // db.select().from().where().limit() chain
  const limitMock = vi.fn()
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock })
  const fromMock = vi.fn().mockReturnValue({ where: whereMock })
  const selectMock = vi.fn().mockReturnValue({ from: fromMock })

  // db.update().set().where() chain
  const updateWhereMock = vi.fn().mockResolvedValue(undefined)
  const updateSetMock = vi.fn().mockReturnValue({ where: updateWhereMock })
  const updateMock = vi.fn().mockReturnValue({ set: updateSetMock })

  // db.insert().values() chain
  const insertValuesMock = vi.fn().mockResolvedValue(undefined)
  const insertMock = vi.fn().mockReturnValue({ values: insertValuesMock })

  return {
    selectMock, fromMock, whereMock, limitMock,
    updateMock, updateSetMock, updateWhereMock,
    insertMock, insertValuesMock,
    sendWorkshopCompletedMock: vi.fn().mockResolvedValue(undefined),
    writeAuditLogMock: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('@/src/db', () => ({
  db: {
    select: mocks.selectMock,
    update: mocks.updateMock,
    insert: mocks.insertMock,
  },
}))

vi.mock('@/src/inngest/events', () => ({
  sendWorkshopCompleted: mocks.sendWorkshopCompletedMock,
  // Re-export other names that workshop.ts may import
  sendWorkshopRecordingUploaded: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/src/lib/audit', () => ({
  writeAuditLog: mocks.writeAuditLogMock,
}))

let workshopRouterModule: { workshopRouter?: unknown } | null = null

beforeAll(async () => {
  // Variable-path dynamic import (Plan 16 Pattern 2). Even though
  // src/server/routers/workshop.ts already exists, we use the same
  // indirection to keep the pattern consistent with the other Wave 0
  // RED contracts and to tolerate transient breakage during Plan 01.
  const targetPath = ['.', 'workshop'].join('/')
  try {
    workshopRouterModule = (await import(/* @vite-ignore */ targetPath)) as {
      workshopRouter?: unknown
    }
  } catch (err) {
    workshopRouterModule = null
    // eslint-disable-next-line no-console
    console.warn('[workshop-transition.test] target module not yet loadable:', (err as Error).message)
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

function makeCtx() {
  return {
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      role: 'workshop_moderator',
      clerkId: 'clerk_test',
    },
  }
}

// Invoke a procedure handler directly by reaching through the router's _def
async function invoke(procName: string, input: unknown) {
  const router = (workshopRouterModule as { workshopRouter?: Record<string, unknown> } | null)
    ?.workshopRouter
  if (!router) {
    throw new Error('workshopRouter not yet exporting transition/approveArtifact - Wave 0 RED')
  }
  const def = (router as { _def?: { procedures?: Record<string, unknown> } })._def
  const proc = def?.procedures?.[procName] as
    | { _def?: { resolver?: unknown }; resolver?: unknown }
    | undefined
  if (!proc) {
    throw new Error(`procedure ${procName} does not exist on workshopRouter - Wave 0 RED`)
  }
  // tRPC v11 procedure resolver path
  const resolver = (proc._def?.resolver ?? proc.resolver) as
    | ((args: unknown) => Promise<unknown>)
    | undefined
  if (typeof resolver !== 'function') {
    throw new Error(`procedure ${procName} has no resolver - Wave 0 RED`)
  }
  return await resolver({ ctx: makeCtx(), input, type: 'mutation', path: `workshop.${procName}`, rawInput: input })
}

describe('workshop.transition - Wave 0 RED contract (WS-06)', () => {
  it('accepts upcoming → in_progress', async () => {
    mocks.limitMock.mockResolvedValue([{ id: 'w1', status: 'upcoming', createdBy: 'mod1' }])
    const result = await invoke('transition', {
      workshopId: '00000000-0000-0000-0000-000000000001',
      toStatus: 'in_progress',
    })
    expect(mocks.updateMock).toHaveBeenCalled()
    expect(mocks.insertMock).toHaveBeenCalled()  // workflowTransitions row
    expect(result).toBeDefined()
  })

  it('rejects invalid transition in_progress → in_progress', async () => {
    // ALLOWED_TRANSITIONS in workshop.ts now permits upcoming → completed
    // (cancelled-before-start flow). in_progress → in_progress is still
    // genuinely invalid because `in_progress` can only advance to `completed`.
    mocks.limitMock.mockResolvedValue([{ id: 'w1', status: 'in_progress', createdBy: 'mod1' }])
    await expect(
      invoke('transition', {
        workshopId: '00000000-0000-0000-0000-000000000001',
        toStatus: 'in_progress',
      }),
    ).rejects.toThrow()
  })

  it('fires sendWorkshopCompleted when toStatus === completed', async () => {
    mocks.limitMock.mockResolvedValue([{ id: 'w1', status: 'in_progress', createdBy: 'mod1' }])
    await invoke('transition', {
      workshopId: '00000000-0000-0000-0000-000000000001',
      toStatus: 'completed',
    })
    expect(mocks.sendWorkshopCompletedMock).toHaveBeenCalledTimes(1)
    const arg = mocks.sendWorkshopCompletedMock.mock.calls[0][0]
    expect(arg.workshopId).toBe('00000000-0000-0000-0000-000000000001')
  })

  it('does NOT fire sendWorkshopCompleted for non-completed transitions', async () => {
    mocks.limitMock.mockResolvedValue([{ id: 'w1', status: 'upcoming', createdBy: 'mod1' }])
    await invoke('transition', {
      workshopId: '00000000-0000-0000-0000-000000000001',
      toStatus: 'in_progress',
    })
    expect(mocks.sendWorkshopCompletedMock).not.toHaveBeenCalled()
  })

  it('writes audit log for every transition', async () => {
    mocks.limitMock.mockResolvedValue([{ id: 'w1', status: 'upcoming', createdBy: 'mod1' }])
    await invoke('transition', {
      workshopId: '00000000-0000-0000-0000-000000000001',
      toStatus: 'in_progress',
    })
    expect(mocks.writeAuditLogMock).toHaveBeenCalled()
  })
})

describe('workshop.approveArtifact - Wave 0 RED contract (WS-14)', () => {
  it('flips reviewStatus to approved', async () => {
    await invoke('approveArtifact', {
      workshopId: '00000000-0000-0000-0000-000000000001',
      workshopArtifactId: '00000000-0000-0000-0000-000000000002',
    })
    expect(mocks.updateMock).toHaveBeenCalled()
    // The update.set call should include review_status / reviewStatus: 'approved'
    const setCall = mocks.updateSetMock.mock.calls[0]?.[0]
    expect(setCall).toBeDefined()
    // Accept either camelCase or snake_case
    const approvedValue = setCall.reviewStatus ?? setCall.review_status
    expect(approvedValue).toBe('approved')
  })
})

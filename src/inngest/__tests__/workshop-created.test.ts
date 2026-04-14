import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'

/**
 * Plan 20-02 test contract for workshopCreatedFn (WS-07).
 *
 * Covers five behaviors (T1-T5 from the plan):
 *   T1 — successful cal.com response backfills calcomEventTypeId.
 *   T2 — missing workshop row → NonRetriableError.
 *   T3 — cal.com 500 → plain Error bubbles (retry path).
 *   T4 — cal.com 400 → NonRetriableError (no retry).
 *   T5 — missing CAL_API_KEY → NonRetriableError (caught and rewrapped by fn).
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

  return {
    limitMock,
    whereMock,
    fromMock,
    selectMock,
    setMock,
    updateWhereMock,
    updateMock,
    createCalEventTypeMock,
  }
})

vi.mock('@/src/db', () => ({
  db: {
    select: mocks.selectMock,
    update: mocks.updateMock,
  },
}))

// Mock the cal.com client so the fn under test never issues a real fetch.
// We still import and re-export the real CalApiError class so instanceof
// checks inside the function under test resolve against the same constructor
// the tests throw. The trick: import the real module synchronously at the
// top of the mock factory via vi.importActual.
vi.mock('@/src/lib/calcom', async () => {
  const actual = await vi.importActual<typeof import('@/src/lib/calcom')>('@/src/lib/calcom')
  return {
    ...actual,
    createCalEventType: mocks.createCalEventTypeMock,
  }
})

let fnModule: { workshopCreatedFn?: unknown } | null = null
let CalApiErrorCtor: (new (status: number, message: string) => Error) | null = null

beforeAll(async () => {
  // Variable path bypasses Vite static analysis — lets the test file load
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
  const calcomPath = ['..', '..', 'lib', 'calcom'].join('/')
  try {
    const mod = (await import(/* @vite-ignore */ calcomPath)) as {
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

describe('workshopCreatedFn — cal.com event-type provisioning (WS-07)', () => {
  it('T1: backfills calcomEventTypeId on successful cal.com response', async () => {
    mocks.limitMock.mockResolvedValueOnce([
      {
        id:               '00000000-0000-0000-0000-000000000001',
        title:            'Policy Roundtable',
        durationMinutes:  60,
        calcomEventTypeId: null,
      },
    ])
    mocks.createCalEventTypeMock.mockResolvedValueOnce({ id: 12345 })

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
  })

  it('T2: NonRetriableError when workshop row is missing', async () => {
    mocks.limitMock.mockResolvedValueOnce([])  // no rows

    const { step } = makeStep()
    await expect(invoke(makeEvent(), step)).rejects.toThrow(/not found/i)
    // Must NOT have called cal.com or update path.
    expect(mocks.createCalEventTypeMock).not.toHaveBeenCalled()
    expect(mocks.updateMock).not.toHaveBeenCalled()
  })

  it('T3: 5xx bubbles a plain Error (retry path — NOT NonRetriableError)', async () => {
    mocks.limitMock.mockResolvedValueOnce([
      { id: 'w', title: 'x', durationMinutes: 60, calcomEventTypeId: null },
    ])
    if (!CalApiErrorCtor) throw new Error('CalApiError ctor not resolved — calcom module missing')
    mocks.createCalEventTypeMock.mockRejectedValueOnce(new CalApiErrorCtor(500, 'cal.com API 500: boom'))

    const { step } = makeStep()
    let thrown: unknown
    try {
      await invoke(makeEvent(), step)
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(Error)
    // Must NOT be NonRetriableError — Inngest needs the retry path.
    const { NonRetriableError } = await import('inngest')
    expect(thrown).not.toBeInstanceOf(NonRetriableError)
    // Backfill must not have run.
    expect(mocks.updateMock).not.toHaveBeenCalled()
  })

  it('T4: 4xx wraps to NonRetriableError (no retry)', async () => {
    mocks.limitMock.mockResolvedValueOnce([
      { id: 'w', title: 'x', durationMinutes: 60, calcomEventTypeId: null },
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
      { id: 'w', title: 'x', durationMinutes: 60, calcomEventTypeId: null },
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
      { id: 'w', title: 'x', durationMinutes: 60, calcomEventTypeId: 'already-set-9999' },
    ])

    const { step } = makeStep()
    const result = await invoke(makeEvent(), step)

    expect(mocks.createCalEventTypeMock).not.toHaveBeenCalled()
    expect(mocks.updateMock).not.toHaveBeenCalled()
    expect(result).toMatchObject({ skipped: 'already-provisioned' })
  })
})

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'

/**
 * Plan 20-04 test contract for workshopRegistrationReceivedFn (WS-10).
 *
 * Covers six behaviors (T1-T6 from 20-04-PLAN.md):
 *   T1 — successful Clerk invite + sendWorkshopRegistrationEmail(email, {...}).
 *   T2 — Clerk 500 → plain Error thrown (Inngest retry path).
 *   T3 — Clerk 400 → NonRetriableError thrown (no retry).
 *   T4 — rateLimit config: key='event.data.emailHash', limit=1, period='15m'.
 *   T5 — triggers inlined as [{ event: 'workshop.registration.received' }]
 *        (Pitfall 4 — string literal inside createFunction options).
 *   T6 — publicMetadata passed to Clerk is { role: 'stakeholder', orgType: null }.
 *
 * Mock strategy mirrors workshop-created.test.ts:
 *   - vi.hoisted for shared mock handles
 *   - vi.mock('@/src/db') with drizzle select chain
 *   - vi.mock('@/src/lib/email') so JSX dynamic import never runs
 *   - vi.mock('@clerk/nextjs/server') with a factory that returns our
 *     createInvitation mock; factory defines isClerkAPIResponseError too
 *     via vi.mock('@clerk/shared/error').
 *   - Variable-path dynamic import of the target module (Plan 16 Pattern 2).
 */

const mocks = vi.hoisted(() => {
  // db.select().from().where().limit() chain for load-workshop step
  const limitMock = vi.fn()
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock })
  const fromMock = vi.fn().mockReturnValue({ where: whereMock })
  const selectMock = vi.fn().mockReturnValue({ from: fromMock })

  const createInvitationMock = vi.fn()
  const sendWorkshopRegistrationEmailMock = vi.fn().mockResolvedValue(undefined)

  // Clerk API error class — matches the shape isClerkAPIResponseError expects.
  class ClerkAPIError extends Error {
    public readonly status: number
    public readonly clerkError: boolean
    constructor(status: number, message: string) {
      super(message)
      this.name = 'ClerkAPIError'
      this.status = status
      this.clerkError = true
    }
  }

  return {
    limitMock,
    whereMock,
    fromMock,
    selectMock,
    createInvitationMock,
    sendWorkshopRegistrationEmailMock,
    ClerkAPIError,
  }
})

vi.mock('@/src/db', () => ({
  db: {
    select: mocks.selectMock,
  },
}))

vi.mock('@/src/lib/email', () => ({
  sendWorkshopRegistrationEmail: mocks.sendWorkshopRegistrationEmailMock,
}))

vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: vi.fn(async () => ({
    invitations: {
      createInvitation: mocks.createInvitationMock,
    },
  })),
}))

vi.mock('@clerk/shared/error', () => ({
  isClerkAPIResponseError: (err: unknown) =>
    err instanceof mocks.ClerkAPIError ||
    (typeof err === 'object' && err !== null && (err as { clerkError?: boolean }).clerkError === true),
}))

let fnModule: { workshopRegistrationReceivedFn?: unknown } | null = null

beforeAll(async () => {
  const targetPath = ['..', 'functions', 'workshop-registration-received'].join('/')
  try {
    fnModule = (await import(/* @vite-ignore */ targetPath)) as {
      workshopRegistrationReceivedFn?: unknown
    }
  } catch (err) {
    fnModule = null
    // eslint-disable-next-line no-console
    console.warn(
      '[workshop-registration-received.test] target module not yet implemented:',
      (err as Error).message,
    )
  }
})

beforeEach(() => {
  vi.clearAllMocks()
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
    name: 'workshop.registration.received',
    ts: Date.now(),
    data: {
      workshopId: '00000000-0000-0000-0000-000000000001',
      email: 'alice@example.com',
      emailHash: 'a'.repeat(64),
      name: 'Alice Example',
      bookingUid: 'booking-uid-1',
      source: 'cal_booking' as const,
    },
  }
}

async function invoke(
  event: ReturnType<typeof makeEvent>,
  step: ReturnType<typeof makeStep>['step'],
) {
  const fn = (fnModule as { workshopRegistrationReceivedFn?: Record<string, unknown> } | null)
    ?.workshopRegistrationReceivedFn
  if (!fn) throw new Error('workshopRegistrationReceivedFn not yet implemented')
  const handler = (fn['fn'] ?? (fn as { handler?: unknown }).handler) as
    | ((args: unknown) => Promise<unknown>)
    | undefined
  if (typeof handler !== 'function')
    throw new Error('workshopRegistrationReceivedFn handler not exposed')
  return await handler({ event, step, runId: 'test', attempt: 0, logger: console })
}

describe('workshopRegistrationReceivedFn — Clerk invite + confirmation email (WS-10)', () => {
  const workshopRow = {
    title: 'Policy Roundtable',
    scheduledAt: new Date('2026-05-01T15:00:00Z'),
  }

  it('T1: Clerk invite + sendWorkshopRegistrationEmail called with resolved workshop', async () => {
    mocks.limitMock.mockResolvedValueOnce([workshopRow])
    mocks.createInvitationMock.mockResolvedValueOnce({ id: 'inv_1' })

    const { step } = makeStep()
    const result = await invoke(makeEvent(), step)

    expect(mocks.createInvitationMock).toHaveBeenCalledTimes(1)
    const callArg = mocks.createInvitationMock.mock.calls[0]?.[0] as {
      emailAddress: string
      ignoreExisting: boolean
      publicMetadata: { role: string; orgType: string | null }
    }
    expect(callArg.emailAddress).toBe('alice@example.com')
    expect(callArg.ignoreExisting).toBe(true)
    // T6: publicMetadata shape
    expect(callArg.publicMetadata).toEqual({ role: 'stakeholder', orgType: null })

    expect(mocks.sendWorkshopRegistrationEmailMock).toHaveBeenCalledTimes(1)
    const [emailTo, emailOpts] = mocks.sendWorkshopRegistrationEmailMock.mock.calls[0] as [
      string,
      { name: string; workshopTitle: string; scheduledAt: string },
    ]
    expect(emailTo).toBe('alice@example.com')
    expect(emailOpts.workshopTitle).toBe('Policy Roundtable')
    expect(emailOpts.name).toBe('Alice Example')
    expect(emailOpts.scheduledAt).toBe(workshopRow.scheduledAt.toISOString())

    expect(result).toMatchObject({ ok: true, email: 'alice@example.com' })
  })

  it('T2: Clerk 500 bubbles a plain Error (retry path — NOT NonRetriableError)', async () => {
    mocks.limitMock.mockResolvedValueOnce([workshopRow])
    mocks.createInvitationMock.mockRejectedValueOnce(
      new mocks.ClerkAPIError(500, 'clerk: internal error'),
    )

    const { step } = makeStep()
    let thrown: unknown
    try {
      await invoke(makeEvent(), step)
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(Error)
    const { NonRetriableError } = await import('inngest')
    expect(thrown).not.toBeInstanceOf(NonRetriableError)
    // email must NOT be sent if invite failed
    expect(mocks.sendWorkshopRegistrationEmailMock).not.toHaveBeenCalled()
  })

  it('T3: Clerk 400 wraps to NonRetriableError (no retry)', async () => {
    mocks.limitMock.mockResolvedValueOnce([workshopRow])
    mocks.createInvitationMock.mockRejectedValueOnce(
      new mocks.ClerkAPIError(400, 'clerk: invalid email'),
    )

    const { step } = makeStep()
    const { NonRetriableError } = await import('inngest')
    let thrown: unknown
    try {
      await invoke(makeEvent(), step)
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(NonRetriableError)
    expect(mocks.sendWorkshopRegistrationEmailMock).not.toHaveBeenCalled()
  })

  it('T4: rateLimit config is { key: event.data.emailHash, limit: 1, period: 15m }', async () => {
    const fn = (fnModule as { workshopRegistrationReceivedFn?: Record<string, unknown> } | null)
      ?.workshopRegistrationReceivedFn
    if (!fn) throw new Error('workshopRegistrationReceivedFn not yet implemented')
    // Inngest createFunction stores options under `opts` (v4). Fallback to `options`.
    const opts = (fn as { opts?: Record<string, unknown>; options?: Record<string, unknown> }).opts
      ?? (fn as { options?: Record<string, unknown> }).options
    expect(opts).toBeDefined()
    const rateLimit = (opts as { rateLimit?: { key: string; limit: number; period: string } })
      .rateLimit
    expect(rateLimit).toBeDefined()
    expect(rateLimit?.key).toBe('event.data.emailHash')
    expect(rateLimit?.limit).toBe(1)
    expect(rateLimit?.period).toBe('15m')
  })

  it('T5: triggers inlined as [{ event: "workshop.registration.received" }]', async () => {
    const fn = (fnModule as { workshopRegistrationReceivedFn?: Record<string, unknown> } | null)
      ?.workshopRegistrationReceivedFn
    if (!fn) throw new Error('workshopRegistrationReceivedFn not yet implemented')
    // Inngest v4 normalizes triggers via `trigger` (single) or `triggers` (array).
    // `fn.trigger` is the legacy field; `fn.opts.triggers` is the authoritative new field.
    const opts = (fn as { opts?: Record<string, unknown>; options?: Record<string, unknown> }).opts
      ?? (fn as { options?: Record<string, unknown> }).options
    const triggers =
      ((opts as { triggers?: Array<{ event?: string }> }).triggers) ??
      (Array.isArray((fn as { triggers?: unknown }).triggers)
        ? ((fn as { triggers: Array<{ event?: string }> }).triggers)
        : undefined) ??
      ((fn as { trigger?: { event?: string } }).trigger
        ? [(fn as { trigger: { event?: string } }).trigger]
        : undefined)
    expect(triggers).toBeDefined()
    expect(triggers?.[0]?.event).toBe('workshop.registration.received')
  })

  it('T6 (explicit): publicMetadata = { role: stakeholder, orgType: null }', async () => {
    mocks.limitMock.mockResolvedValueOnce([workshopRow])
    mocks.createInvitationMock.mockResolvedValueOnce({ id: 'inv_1' })

    const { step } = makeStep()
    await invoke(makeEvent(), step)

    const callArg = mocks.createInvitationMock.mock.calls[0]?.[0] as {
      publicMetadata: { role: string; orgType: string | null }
    }
    expect(callArg.publicMetadata.role).toBe('stakeholder')
    expect(callArg.publicMetadata.orgType).toBeNull()
  })

  it('bonus: missing workshop row → NonRetriableError', async () => {
    mocks.limitMock.mockResolvedValueOnce([])  // no rows

    const { step } = makeStep()
    const { NonRetriableError } = await import('inngest')
    let thrown: unknown
    try {
      await invoke(makeEvent(), step)
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(NonRetriableError)
    expect((thrown as Error).message).toMatch(/not found/i)
    expect(mocks.createInvitationMock).not.toHaveBeenCalled()
    expect(mocks.sendWorkshopRegistrationEmailMock).not.toHaveBeenCalled()
  })
})

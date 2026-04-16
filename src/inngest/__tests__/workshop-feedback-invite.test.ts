import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'

/**
 * Plan 20-04 test contract for workshopFeedbackInviteFn (WS-15).
 *
 * Covers six behaviors (T1-T6 from 20-04-PLAN.md):
 *   T1 - event.data → workshop looked up from DB (title + scheduledAt).
 *   T2 - signFeedbackToken called with (workshopId, email); token embedded
 *        in feedbackUrl.
 *   T3 - feedbackUrl format: ${baseUrl}/participate?workshopId=X&token=Y.
 *   T4 - sendWorkshopFeedbackInviteEmail called with to=email, workshopTitle,
 *        feedbackUrl.
 *   T5 - missing workshop → NonRetriableError.
 *   T6 - triggers inlined as [{ event: 'workshop.feedback.invite' }].
 *
 * Mock strategy mirrors workshop-registration-received.test.ts.
 */

const mocks = vi.hoisted(() => {
  const limitMock = vi.fn()
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock })
  const fromMock = vi.fn().mockReturnValue({ where: whereMock })
  const selectMock = vi.fn().mockReturnValue({ from: fromMock })

  const signFeedbackTokenMock = vi.fn()
  const sendWorkshopFeedbackInviteEmailMock = vi.fn().mockResolvedValue(undefined)

  return {
    limitMock,
    whereMock,
    fromMock,
    selectMock,
    signFeedbackTokenMock,
    sendWorkshopFeedbackInviteEmailMock,
  }
})

vi.mock('@/src/db', () => ({
  db: {
    select: mocks.selectMock,
  },
}))

vi.mock('@/src/lib/feedback-token', () => ({
  signFeedbackToken: mocks.signFeedbackTokenMock,
}))

vi.mock('@/src/lib/email', () => ({
  sendWorkshopFeedbackInviteEmail: mocks.sendWorkshopFeedbackInviteEmailMock,
}))

let fnModule: { workshopFeedbackInviteFn?: unknown } | null = null

beforeAll(async () => {
  const targetPath = ['..', 'functions', 'workshop-feedback-invite'].join('/')
  try {
    fnModule = (await import(/* @vite-ignore */ targetPath)) as {
      workshopFeedbackInviteFn?: unknown
    }
  } catch (err) {
    fnModule = null
    // eslint-disable-next-line no-console
    console.warn(
      '[workshop-feedback-invite.test] target module not yet implemented:',
      (err as Error).message,
    )
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://policydash.test')
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
    name: 'workshop.feedback.invite',
    ts: Date.now(),
    data: {
      workshopId: '00000000-0000-0000-0000-000000000001',
      email: 'alice@example.com',
      name: 'Alice Example',
      attendeeUserId: null,
    },
  }
}

async function invoke(
  event: ReturnType<typeof makeEvent>,
  step: ReturnType<typeof makeStep>['step'],
) {
  const fn = (fnModule as { workshopFeedbackInviteFn?: Record<string, unknown> } | null)
    ?.workshopFeedbackInviteFn
  if (!fn) throw new Error('workshopFeedbackInviteFn not yet implemented')
  const handler = (fn['fn'] ?? (fn as { handler?: unknown }).handler) as
    | ((args: unknown) => Promise<unknown>)
    | undefined
  if (typeof handler !== 'function')
    throw new Error('workshopFeedbackInviteFn handler not exposed')
  return await handler({ event, step, runId: 'test', attempt: 0, logger: console })
}

describe('workshopFeedbackInviteFn - JWT-signed deep-link email (WS-15)', () => {
  const workshopRow = {
    title: 'Policy Roundtable',
    scheduledAt: new Date('2026-05-01T15:00:00Z'),
  }

  it('T1: loads workshop title + scheduledAt from DB by workshopId', async () => {
    mocks.limitMock.mockResolvedValueOnce([workshopRow])
    mocks.signFeedbackTokenMock.mockReturnValueOnce('header.body.sig')

    const { step } = makeStep()
    const result = await invoke(makeEvent(), step)

    expect(mocks.selectMock).toHaveBeenCalled()
    expect(result).toMatchObject({ ok: true, email: 'alice@example.com' })
  })

  it('T2: signFeedbackToken called with (workshopId, email)', async () => {
    mocks.limitMock.mockResolvedValueOnce([workshopRow])
    mocks.signFeedbackTokenMock.mockReturnValueOnce('header.body.sig')

    const { step } = makeStep()
    await invoke(makeEvent(), step)

    expect(mocks.signFeedbackTokenMock).toHaveBeenCalledTimes(1)
    const args = mocks.signFeedbackTokenMock.mock.calls[0] as [string, string]
    expect(args[0]).toBe('00000000-0000-0000-0000-000000000001')
    expect(args[1]).toBe('alice@example.com')
  })

  it('T3: feedbackUrl format is /participate?workshopId=X&token=Y', async () => {
    mocks.limitMock.mockResolvedValueOnce([workshopRow])
    mocks.signFeedbackTokenMock.mockReturnValueOnce('header.body.sig')

    const { step } = makeStep()
    await invoke(makeEvent(), step)

    const [, emailOpts] = mocks.sendWorkshopFeedbackInviteEmailMock.mock.calls[0] as [
      string,
      { feedbackUrl: string },
    ]
    expect(emailOpts.feedbackUrl).toContain('/participate?workshopId=')
    expect(emailOpts.feedbackUrl).toContain('00000000-0000-0000-0000-000000000001')
    expect(emailOpts.feedbackUrl).toContain('&token=')
    expect(emailOpts.feedbackUrl).toContain('header.body.sig')
    // Base URL from env
    expect(emailOpts.feedbackUrl).toContain('https://policydash.test')
  })

  it('T4: sendWorkshopFeedbackInviteEmail called with to, name, workshopTitle, feedbackUrl', async () => {
    mocks.limitMock.mockResolvedValueOnce([workshopRow])
    mocks.signFeedbackTokenMock.mockReturnValueOnce('header.body.sig')

    const { step } = makeStep()
    await invoke(makeEvent(), step)

    expect(mocks.sendWorkshopFeedbackInviteEmailMock).toHaveBeenCalledTimes(1)
    const [emailTo, emailOpts] = mocks.sendWorkshopFeedbackInviteEmailMock.mock.calls[0] as [
      string,
      { name: string; workshopTitle: string; feedbackUrl: string },
    ]
    expect(emailTo).toBe('alice@example.com')
    expect(emailOpts.name).toBe('Alice Example')
    expect(emailOpts.workshopTitle).toBe('Policy Roundtable')
    expect(typeof emailOpts.feedbackUrl).toBe('string')
    expect(emailOpts.feedbackUrl.length).toBeGreaterThan(0)
  })

  it('T5: missing workshop → NonRetriableError', async () => {
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
    expect(mocks.signFeedbackTokenMock).not.toHaveBeenCalled()
    expect(mocks.sendWorkshopFeedbackInviteEmailMock).not.toHaveBeenCalled()
  })

  it('T6: triggers inlined as [{ event: "workshop.feedback.invite" }]', async () => {
    const fn = (fnModule as { workshopFeedbackInviteFn?: Record<string, unknown> } | null)
      ?.workshopFeedbackInviteFn
    if (!fn) throw new Error('workshopFeedbackInviteFn not yet implemented')
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
    expect(triggers?.[0]?.event).toBe('workshop.feedback.invite')
  })
})

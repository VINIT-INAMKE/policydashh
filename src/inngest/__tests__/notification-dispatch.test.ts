import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

/**
 * Wave 0 test scaffold for Plan 02 Task 02-01 (NOTIF-05, NOTIF-06).
 *
 * This file is RED until `src/inngest/functions/notification-dispatch.ts`
 * ships `notificationDispatchFn`. Plan 02 Task 02-01 will create the file;
 * this scaffold locks the step-semantics contract:
 *
 *   1. An `insert-notification` step that performs an onConflictDoNothing
 *      insert into the `notifications` table (NOTIF-06 idempotency guard).
 *   2. A conditional `send-email` step for email-capable users.
 *   3. Graceful skip of the email step when the user has no email address.
 *
 * Strategy: invoke the handler directly with a synthesized `{ event, step }`
 * argument where `step.run` is a vi.fn() that immediately runs its callback
 * and returns the result. Inspect `step.run.mock.calls` to assert step
 * names and order.
 */

const mocks = vi.hoisted(() => {
  const onConflictDoNothingMock = vi.fn().mockResolvedValue(undefined)
  const valuesMock = vi.fn().mockReturnValue({
    onConflictDoNothing: onConflictDoNothingMock,
  })
  const insertMock = vi.fn().mockReturnValue({ values: valuesMock })

  // db.select(...).from(...).where(...).limit(1) chain for the user lookup
  const userLookupLimitMock = vi.fn()
  const userLookupWhereMock = vi.fn().mockReturnValue({ limit: userLookupLimitMock })
  const userLookupFromMock = vi.fn().mockReturnValue({ where: userLookupWhereMock })
  const selectMock = vi.fn().mockReturnValue({ from: userLookupFromMock })

  return {
    insertMock,
    valuesMock,
    onConflictDoNothingMock,
    selectMock,
    userLookupLimitMock,
    sendFeedbackReviewedEmailMock: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('@/src/db', () => ({
  db: {
    insert: mocks.insertMock,
    select: mocks.selectMock,
  },
}))

vi.mock('@/src/lib/email', () => ({
  sendFeedbackReviewedEmail: mocks.sendFeedbackReviewedEmailMock,
}))

/**
 * Dynamic import binding. Wave 0: the target module does not yet exist, so
 * a static `import ... from '../functions/notification-dispatch'` would
 * fail Vite's import-analysis pass at parse time and prevent Vitest from
 * discovering this test file at all. A dynamic import deferred into
 * `beforeAll` lets Vitest register the tests, mark them RED when the
 * module resolution fails, and then flip to GREEN the moment Plan 02
 * Task 02-01 creates `src/inngest/functions/notification-dispatch.ts`.
 */
let notificationDispatchFn: unknown

type StepRunFn = (stepId: string, fn: () => Promise<unknown>) => Promise<unknown>

/**
 * Build a fake Inngest step context whose `.run()` immediately invokes the
 * provided callback and records (stepId, result). This lets the test assert
 * on the sequence and names of `step.run` calls without spinning up the
 * real Inngest runtime.
 */
function makeStep() {
  const callLog: Array<{ id: string; result?: unknown; error?: unknown }> = []
  const run: StepRunFn = vi.fn(async (stepId, fn) => {
    try {
      const result = await fn()
      callLog.push({ id: stepId, result })
      return result
    } catch (err) {
      callLog.push({ id: stepId, error: err })
      throw err
    }
  })
  return { step: { run }, callLog }
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    name: 'notification.create',
    data: {
      userId: '00000000-0000-0000-0000-000000000001',
      type: 'feedback_status_changed',
      title: 'Feedback under review',
      body: 'Your feedback is being reviewed.',
      entityType: 'feedback',
      entityId: '00000000-0000-0000-0000-000000000002',
      linkHref: '/feedback/00000000-0000-0000-0000-000000000002',
      createdBy: '00000000-0000-0000-0000-000000000003',
      action: 'startReview',
      ...overrides,
    },
  }
}

/**
 * Extract the handler function from an Inngest function definition. Inngest
 * v4 stores the handler on the function instance; the exact property name
 * may vary, so we resolve it defensively and fall back to a direct invoke
 * if `notificationDispatchFn` is itself callable.
 */
function getHandler(fn: unknown): (ctx: { event: unknown; step: unknown }) => Promise<unknown> {
  if (fn == null) {
    throw new Error(
      'notificationDispatchFn is not yet implemented - Wave 0 RED. ' +
        'Plan 02 Task 02-01 must create src/inngest/functions/notification-dispatch.ts',
    )
  }
  if (typeof fn === 'function') {
    return fn as (ctx: { event: unknown; step: unknown }) => Promise<unknown>
  }
  const anyFn = fn as Record<string, unknown>
  for (const key of ['fn', 'handler', '_fn', 'runFn']) {
    const candidate = anyFn[key]
    if (typeof candidate === 'function') {
      return candidate as (ctx: { event: unknown; step: unknown }) => Promise<unknown>
    }
  }
  throw new Error(
    `Could not locate handler on notificationDispatchFn. Keys: ${Object.keys(anyFn).join(', ')}`,
  )
}

describe('notificationDispatchFn', () => {
  beforeAll(async () => {
    // Dynamic import with variable indirection - see the
    // `let notificationDispatchFn` comment above. The indirection is
    // required because Vite's static import-analysis pass walks literal
    // string arguments to `import()` and would fail the whole transform
    // at parse time (before Vitest discovers the describe block) if the
    // module does not yet exist. Building the path at runtime hides it
    // from the analyzer while still resolving through the normal loader
    // when Plan 02 Task 02-01 creates the target file.
    const targetPath = ['..', 'functions', 'notification-dispatch'].join('/')
    try {
      const mod = await import(/* @vite-ignore */ targetPath)
      notificationDispatchFn = (mod as { notificationDispatchFn: unknown })
        .notificationDispatchFn
    } catch (err) {
      // Wave 0 RED: target module does not exist yet. Leave
      // notificationDispatchFn undefined so the test assertions below
      // fail with a clear "handler not found" message, which is the
      // intended Nyquist RED signal for Plan 02.
      notificationDispatchFn = undefined
      // eslint-disable-next-line no-console
      console.warn('[notification-dispatch.test] target module not yet implemented:', (err as Error).message)
    }
  })

  beforeEach(() => {
    mocks.insertMock.mockClear()
    mocks.valuesMock.mockClear()
    mocks.onConflictDoNothingMock.mockClear()
    mocks.selectMock.mockClear()
    mocks.userLookupLimitMock.mockReset()
    mocks.sendFeedbackReviewedEmailMock.mockClear()
  })

  // Inngest v4 does not expose options on the function instance in a stable
  // shape - the dev UI and `inngest.createFunction` config object are the
  // canonical source. Plan 02 verification covers id/retries via the Inngest
  // Dev UI smoke walk; here we leave the metadata assertion as todo.
  it.todo('has options.id === "notification-dispatch" and options.retries === 3')

  it('calls step.run("insert-notification", ...) exactly once and uses onConflictDoNothing', async () => {
    // User has an email → send-email step will also run, but we only assert
    // on the insert-notification step in this test.
    mocks.userLookupLimitMock.mockResolvedValueOnce([{ email: 'user@example.org' }])

    const { step, callLog } = makeStep()
    const handler = getHandler(notificationDispatchFn)
    await handler({ event: makeEvent(), step })

    const insertSteps = callLog.filter((c) => c.id === 'insert-notification')
    expect(insertSteps).toHaveLength(1)
    expect(mocks.insertMock).toHaveBeenCalledTimes(1)
    expect(mocks.onConflictDoNothingMock).toHaveBeenCalledTimes(1)
  })

  it('calls step.run("send-email", ...) exactly once when the user has an email', async () => {
    mocks.userLookupLimitMock.mockResolvedValueOnce([{ email: 'user@example.org' }])

    const { step, callLog } = makeStep()
    const handler = getHandler(notificationDispatchFn)
    await handler({
      event: makeEvent({ type: 'feedback_status_changed' }),
      step,
    })

    const emailSteps = callLog.filter((c) => c.id === 'send-email')
    expect(emailSteps).toHaveLength(1)
    expect(mocks.sendFeedbackReviewedEmailMock).toHaveBeenCalledTimes(1)
  })

  it('does NOT call the send-email step when the looked-up user has email: null (phone-only user)', async () => {
    mocks.userLookupLimitMock.mockResolvedValueOnce([{ email: null }])

    const { step, callLog } = makeStep()
    const handler = getHandler(notificationDispatchFn)
    await handler({ event: makeEvent(), step })

    const emailSteps = callLog.filter((c) => c.id === 'send-email')
    expect(emailSteps).toHaveLength(0)
    expect(mocks.sendFeedbackReviewedEmailMock).not.toHaveBeenCalled()
  })

  it('on duplicate dispatch (same idempotency key), the insert step resolves without error via onConflictDoNothing (NOTIF-06)', async () => {
    mocks.userLookupLimitMock.mockResolvedValueOnce([{ email: 'user@example.org' }])
    // Simulate the onConflictDoNothing path: no error thrown, resolves void.
    mocks.onConflictDoNothingMock.mockResolvedValueOnce(undefined)

    const { step, callLog } = makeStep()
    const handler = getHandler(notificationDispatchFn)
    await expect(handler({ event: makeEvent(), step })).resolves.not.toThrow()

    const insertSteps = callLog.filter((c) => c.id === 'insert-notification')
    expect(insertSteps).toHaveLength(1)
    expect(insertSteps[0].error).toBeUndefined()
    expect(mocks.onConflictDoNothingMock).toHaveBeenCalledTimes(1)
  })
})

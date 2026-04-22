import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

/**
 * Wave 0 RED contract for Plan 19-03 (updated post-a425676):
 * `participateIntakeFn` Inngest function must
 *   - be declared with id 'participate-intake'
 *   - declare rateLimit { key: 'event.data.emailHash', limit: 1, period: '15m' }
 *   - call clerkClient().invitations.createInvitation with ignoreExisting:true
 *     and publicMetadata:{ role:'stakeholder', orgType, ... }
 *   - retry on Clerk 5xx (plain Error)
 *   - NonRetriableError on Clerk 4xx
 *   - write an audit log entry after successful Clerk invitation
 *
 * Historical note: an earlier draft of this contract required a follow-up
 * `sendWelcomeEmail` call. That behaviour was intentionally removed in
 * commit a425676 ("drop duplicate welcome/confirmation emails") because
 * users were getting two back-to-back emails (Clerk invite + Resend
 * welcome). Clerk's invitation template now carries the welcome copy.
 */

const mocks = vi.hoisted(() => {
  const createInvitationMock = vi.fn().mockResolvedValue({ id: 'inv_test' })
  const clerkClientMock = vi.fn().mockResolvedValue({
    invitations: { createInvitation: createInvitationMock },
  })
  return {
    createInvitationMock,
    clerkClientMock,
    writeAuditLogMock: vi.fn().mockResolvedValue(undefined),
    isClerkAPIResponseErrorMock: vi.fn(),
  }
})

vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: mocks.clerkClientMock,
}))

vi.mock('@clerk/shared/error', () => ({
  isClerkAPIResponseError: mocks.isClerkAPIResponseErrorMock,
}))

vi.mock('@/src/lib/audit', () => ({
  writeAuditLog: mocks.writeAuditLogMock,
}))

let mod: Record<string, unknown> | null = null

beforeAll(async () => {
  const segments = ['@', 'src', 'inngest', 'functions', 'participate-intake']
  const modPath = segments.join('/')
  try {
    mod = (await import(/* @vite-ignore */ modPath)) as Record<string, unknown>
  } catch {
    mod = null
  }
})

beforeEach(() => {
  mocks.createInvitationMock.mockClear()
  mocks.createInvitationMock.mockResolvedValue({ id: 'inv_test' })
  mocks.writeAuditLogMock.mockClear()
  mocks.isClerkAPIResponseErrorMock.mockReset()
})

const fakeEvent = {
  name: 'participate.intake',
  data: {
    emailHash: 'a'.repeat(64),
    email: 'alice@test.org',
    name: 'Alice Example',
    orgType: 'academia',
    expertise: 'Constitutional law and digital rights research.',
  },
}

const fakeStep = {
  run: async <T>(_id: string, fn: () => Promise<T> | T): Promise<T> => fn(),
}

describe('participateIntakeFn', () => {
  it('RED: module is importable', () => {
    expect(mod).not.toBeNull()
  })

  it('Test 2.1: exports participateIntakeFn with id participate-intake', () => {
    expect(mod).not.toBeNull()
    const fn = mod!.participateIntakeFn as
      | { id?: (() => string) | string; opts?: { id?: string } }
      | undefined
    expect(fn).toBeDefined()
    const id =
      typeof fn?.id === 'function'
        ? (fn.id as () => string)()
        : (fn?.id as string | undefined) ?? fn?.opts?.id
    expect(id).toBe('participate-intake')
  })

  it('Test 2.2: function options include rateLimit { key, limit:1, period:15m }', () => {
    expect(mod).not.toBeNull()
    const fn = mod!.participateIntakeFn as { opts?: Record<string, unknown> }
    const rateLimit = (
      fn.opts as { rateLimit?: { key: string; limit: number; period: string } } | undefined
    )?.rateLimit
    expect(rateLimit).toBeDefined()
    expect(rateLimit!.key).toBe('event.data.emailHash')
    expect(rateLimit!.limit).toBe(1)
    expect(rateLimit!.period).toBe('15m')
  })

  it('Test 2.3: handler calls clerkClient().invitations.createInvitation with ignoreExisting + publicMetadata', async () => {
    expect(mod).not.toBeNull()
    const fn = mod!.participateIntakeFn as { fn: (ctx: unknown) => Promise<unknown> }
    await fn.fn({ event: fakeEvent, step: fakeStep })
    expect(mocks.createInvitationMock).toHaveBeenCalledTimes(1)
    const args = mocks.createInvitationMock.mock.calls[0][0]
    expect(args).toMatchObject({
      emailAddress: 'alice@test.org',
      ignoreExisting: true,
      publicMetadata: { role: 'stakeholder', orgType: 'academia' },
    })
  })

  it('Test 2.4: after successful Clerk invite, writes an audit log entry', async () => {
    expect(mod).not.toBeNull()
    const fn = mod!.participateIntakeFn as { fn: (ctx: unknown) => Promise<unknown> }
    await fn.fn({ event: fakeEvent, step: fakeStep })
    expect(mocks.writeAuditLogMock).toHaveBeenCalledTimes(1)
    const audit = mocks.writeAuditLogMock.mock.calls[0][0]
    expect(audit).toMatchObject({
      entityType: 'participate_intake',
      entityId: 'a'.repeat(64),
    })
    expect(audit.payload).toMatchObject({
      email: 'alice@test.org',
      name: 'Alice Example',
      orgType: 'academia',
    })
  })

  it('Test 2.5: Clerk 5xx throws plain Error (retry)', async () => {
    expect(mod).not.toBeNull()
    mocks.createInvitationMock.mockRejectedValueOnce({ status: 503 })
    mocks.isClerkAPIResponseErrorMock.mockReturnValue(true)
    const fn = mod!.participateIntakeFn as { fn: (ctx: unknown) => Promise<unknown> }
    await expect(fn.fn({ event: fakeEvent, step: fakeStep })).rejects.toThrow()
  })

  it('Test 2.6: Clerk 4xx throws NonRetriableError', async () => {
    expect(mod).not.toBeNull()
    mocks.createInvitationMock.mockRejectedValueOnce({ status: 422 })
    mocks.isClerkAPIResponseErrorMock.mockReturnValue(true)
    const { NonRetriableError } = await import('inngest')
    const fn = mod!.participateIntakeFn as { fn: (ctx: unknown) => Promise<unknown> }
    await expect(fn.fn({ event: fakeEvent, step: fakeStep })).rejects.toBeInstanceOf(
      NonRetriableError,
    )
  })

  it('Test 2.7: still writes audit log on ignoreExisting success (INTAKE-06)', async () => {
    expect(mod).not.toBeNull()
    mocks.createInvitationMock.mockResolvedValueOnce({ id: 'inv_existing' })
    const fn = mod!.participateIntakeFn as { fn: (ctx: unknown) => Promise<unknown> }
    await fn.fn({ event: fakeEvent, step: fakeStep })
    expect(mocks.writeAuditLogMock).toHaveBeenCalledTimes(1)
  })
})

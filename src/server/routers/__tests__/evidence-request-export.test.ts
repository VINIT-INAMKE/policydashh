/**
 * Wave 0 RED contract for evidence.requestExport (EV-05 trigger surface).
 *
 * Targets the mutation added to evidenceRouter in Plan 18-02 Task 1:
 *
 *   requestExport: requirePermission('evidence:export')
 *     .input(z.object({ documentId: z.string().uuid() }))
 *     .mutation(async ({ ctx, input }): Promise<{ status: 'queued' }>) => {
 *       await sendEvidenceExportRequested({ ... })
 *       writeAuditLog({ ..., payload: { async: true, stage: 'requested' } })
 *       return { status: 'queued' }
 *     })
 *
 * Pattern 2 (variable-path dynamic import) is used so this file compiles
 * even before the mutation lands. The router module already exists, so the
 * import resolves; the assertions go RED because the procedure does not yet
 * exist on the router.
 *
 * sendEvidenceExportRequested and writeAuditLog are mocked via vi.hoisted +
 * vi.mock so the assertions can verify call shape without a real Inngest
 * client or audit DB. The drizzle/db module is mocked with no-op stubs to
 * keep the router import boundary side-effect-free.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'

// The evidence router transitively imports modules with `import 'server-only'`.
vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => ({
  sendEvidenceExportRequested: vi.fn().mockResolvedValue(undefined),
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/src/inngest/events', async (orig) => {
  const actual = await orig<typeof import('@/src/inngest/events')>()
  return {
    ...actual,
    sendEvidenceExportRequested: mocks.sendEvidenceExportRequested,
  }
})

vi.mock('@/src/lib/audit', () => ({
  writeAuditLog: mocks.writeAuditLog,
}))

vi.mock('@/src/lib/constants', async (orig) => {
  const actual = await orig<typeof import('@/src/lib/constants')>()
  return { ...actual }
})

// db is touched by the existing evidenceRouter procedures at import time
// only via schema references, but other procedures reach into db.* - so we
// stub the surface to avoid triggering real Neon connections.
vi.mock('@/src/db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'mock-artifact-id' }]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
        leftJoin: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'mock' }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          catch: vi.fn(),
        }),
      }),
    }),
  },
}))

let evidenceRouterModule: any

beforeAll(async () => {
  // Pattern 2: variable-path dynamic import. The router file exists at this
  // path, but it does NOT yet expose `requestExport`; the assertions go RED
  // when caller.requestExport is undefined.
  const path = ['@', 'src', 'server', 'routers', 'evidence'].join('/')
  try {
    evidenceRouterModule = await import(/* @vite-ignore */ path)
  } catch (err) {
    evidenceRouterModule = undefined
    // eslint-disable-next-line no-console
    console.warn('[evidence-request-export.test] router load failed:', (err as Error).message)
  }
})

function makeCtx(role: 'auditor' | 'stakeholder' = 'auditor') {
  return {
    userId: '00000000-0000-0000-0000-000000000001',
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      role,
      email: 'auditor@example.com',
      name: 'Test Auditor',
    },
    // requestMeta is populated by the Phase 9 tRPC middleware; the
    // requestExport mutation writes ctx.requestMeta.ipAddress into the audit
    // log (for /audit's ipAddress column).
    requestMeta: {
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    },
  }
}

describe('evidence.requestExport mutation', () => {
  beforeEach(() => {
    mocks.sendEvidenceExportRequested.mockClear()
    mocks.writeAuditLog.mockClear()
  })

  it('returns { status: "queued" } when called by an authorized auditor', async () => {
    expect(evidenceRouterModule?.evidenceRouter).toBeDefined()
    const caller = evidenceRouterModule.evidenceRouter.createCaller(makeCtx('auditor'))
    expect(caller.requestExport).toBeDefined()
    const res = await caller.requestExport({
      documentId: '00000000-0000-0000-0000-000000000002',
    })
    expect(res).toEqual({ status: 'queued' })
  })

  it('calls sendEvidenceExportRequested exactly once with { documentId, requestedBy, userEmail }', async () => {
    expect(evidenceRouterModule?.evidenceRouter).toBeDefined()
    const caller = evidenceRouterModule.evidenceRouter.createCaller(makeCtx('auditor'))
    expect(caller.requestExport).toBeDefined()
    await caller.requestExport({
      documentId: '00000000-0000-0000-0000-000000000002',
    })
    expect(mocks.sendEvidenceExportRequested).toHaveBeenCalledTimes(1)
    // The mutation also forwards `sections` (optional; undefined when not
    // supplied). Use objectContaining so the added field doesn't break the
    // shape assertion.
    expect(mocks.sendEvidenceExportRequested).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: '00000000-0000-0000-0000-000000000002',
        requestedBy: '00000000-0000-0000-0000-000000000001',
        userEmail: 'auditor@example.com',
      }),
    )
  })

  it('fires writeAuditLog with action evidence_pack.export, stage="requested", async=true', async () => {
    expect(evidenceRouterModule?.evidenceRouter).toBeDefined()
    const caller = evidenceRouterModule.evidenceRouter.createCaller(makeCtx('auditor'))
    expect(caller.requestExport).toBeDefined()
    await caller.requestExport({
      documentId: '00000000-0000-0000-0000-000000000002',
    })
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'evidence_pack.export',
        entityType: 'document',
        entityId: '00000000-0000-0000-0000-000000000002',
        payload: expect.objectContaining({ async: true, stage: 'requested' }),
      }),
    )
  })

  it('rejects { } missing documentId with a Zod input validation error (BAD_REQUEST), not a procedure-missing error', async () => {
    expect(evidenceRouterModule?.evidenceRouter).toBeDefined()
    // Procedure must exist on the router definition for this to be RED at
    // Wave 0 - we probe the internal _def to avoid passing on a Proxy hit.
    const def = (evidenceRouterModule.evidenceRouter as any)._def
    expect(def?.procedures?.requestExport).toBeDefined()
    const caller = evidenceRouterModule.evidenceRouter.createCaller(makeCtx('auditor'))
    let caught: any
    await caller.requestExport({} as any).catch((e: any) => {
      caught = e
    })
    expect(caught).toBeDefined()
    // Must be a tRPC BAD_REQUEST (Zod input validation), not NOT_FOUND
    // (procedure missing) or INTERNAL_SERVER_ERROR.
    expect(caught.code).toBe('BAD_REQUEST')
    expect(mocks.sendEvidenceExportRequested).not.toHaveBeenCalled()
  })

  it('rejects non-uuid documentId with a Zod input validation error (BAD_REQUEST)', async () => {
    expect(evidenceRouterModule?.evidenceRouter).toBeDefined()
    const def = (evidenceRouterModule.evidenceRouter as any)._def
    expect(def?.procedures?.requestExport).toBeDefined()
    const caller = evidenceRouterModule.evidenceRouter.createCaller(makeCtx('auditor'))
    let caught: any
    await caller
      .requestExport({ documentId: 'not-a-uuid' })
      .catch((e: any) => {
        caught = e
      })
    expect(caught).toBeDefined()
    expect(caught.code).toBe('BAD_REQUEST')
    expect(mocks.sendEvidenceExportRequested).not.toHaveBeenCalled()
  })
})

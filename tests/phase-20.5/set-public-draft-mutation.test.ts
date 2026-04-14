import { describe, it, expect, vi, beforeAll } from 'vitest'

/**
 * Phase 20.5 Wave 0 — RED contract for PUB-07 document.setPublicDraft mutation.
 *
 * Locks two rules Plan 20.5-01 must satisfy:
 *   1. `setPublicDraft` is registered on documentRouter._def.procedures.
 *   2. Successful invocation writes an audit log with
 *      action='document.set_public_draft', entityType='document',
 *      entityId='doc-1', payload={ isPublicDraft: true }.
 *
 * The router is loaded via variable-path dynamic import so vitest collection
 * does not fail when document.setPublicDraft has not yet been wired.
 * tRPC's createCaller is a Proxy that returns undefined for unknown procedures,
 * so we must probe _def.procedures directly (canonical Phase 18 pattern from
 * evidence-request-export.test.ts).
 */

const { dbMock, writeAuditLogMock } = vi.hoisted(() => ({
  dbMock: { update: vi.fn() },
  writeAuditLogMock: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/src/db', () => ({ db: dbMock }))
vi.mock('@/src/lib/audit', () => ({ writeAuditLog: writeAuditLogMock }))

let documentRouter: any
beforeAll(async () => {
  const segs = ['@', 'src', 'server', 'routers', 'document']
  const mod = await import(/* @vite-ignore */ segs.join('/'))
  documentRouter = mod.documentRouter
})

describe('document.setPublicDraft — PUB-07 mutation contract', () => {
  it('is registered as a procedure on documentRouter', () => {
    expect(documentRouter._def.procedures.setPublicDraft).toBeDefined()
  })

  it('writes audit log with action document.set_public_draft on success', async () => {
    dbMock.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockResolvedValue([{ id: 'doc-1', isPublicDraft: true }]),
        }),
      }),
    })
    const caller = documentRouter.createCaller({
      user: { id: 'u-admin', role: 'admin' },
    })
    await caller.setPublicDraft({
      id: '00000000-0000-4000-8000-000000000001',
      isPublicDraft: true,
    })
    expect(writeAuditLogMock).toHaveBeenCalled()
    const call = writeAuditLogMock.mock.calls[0][0]
    expect(call.action).toBe('document.set_public_draft')
    expect(call.entityType).toBe('document')
    expect(call.entityId).toBe('doc-1')
    expect(call.payload).toEqual({ isPublicDraft: true })
  })
})

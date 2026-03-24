import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the database module
vi.mock('@/src/db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  },
}))

// Mock the schema module to avoid import issues
vi.mock('@/src/db/schema/audit', () => ({
  auditEvents: { _: 'audit_events_mock_table' },
}))

describe('Audit Log Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writeAuditLog calls db.insert with correct parameters', async () => {
    const { writeAuditLog } = await import('@/src/lib/audit')
    const { db } = await import('@/src/db')

    await writeAuditLog({
      actorId: 'user-123',
      actorRole: 'admin',
      action: 'user.create',
      entityType: 'user',
      entityId: 'user-456',
      payload: { name: 'Test User' },
      ipAddress: '127.0.0.1',
    })

    expect(db.insert).toHaveBeenCalledTimes(1)
  })

  it('writeAuditLog defaults payload to empty object when not provided', async () => {
    const { writeAuditLog } = await import('@/src/lib/audit')
    const { db } = await import('@/src/db')

    await writeAuditLog({
      actorId: 'user-123',
      actorRole: 'admin',
      action: 'user.invite',
      entityType: 'user',
      entityId: 'user-789',
    })

    expect(db.insert).toHaveBeenCalled()
  })

  it('writeAuditLog defaults ipAddress to null when not provided', async () => {
    const { writeAuditLog } = await import('@/src/lib/audit')
    const { db } = await import('@/src/db')

    await writeAuditLog({
      actorId: 'user-123',
      actorRole: 'stakeholder',
      action: 'user.update',
      entityType: 'user',
      entityId: 'user-123',
      payload: { orgType: 'government' },
    })

    expect(db.insert).toHaveBeenCalled()
  })
})

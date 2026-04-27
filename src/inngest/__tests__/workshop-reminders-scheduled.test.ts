import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/db', () => ({ db: {} }))
vi.mock('@/src/lib/email', () => ({
  sendWorkshopReminderEmail: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/src/lib/format-workshop-time', () => ({
  formatWorkshopTime: vi.fn((d: Date) => `formatted-${d.toISOString()}`),
}))

describe('workshopRemindersScheduledFn', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('schedules sleepUntil at scheduledAt-24h and scheduledAt-1h', async () => {
    const startsAt = new Date('2026-05-10T10:00:00Z')
    const workshopRow = {
      id: 'wks1',
      title: 'Test',
      scheduledAt: startsAt,
      timezone: 'Asia/Kolkata',
      meetingUrl: 'https://meet.google.com/x',
      status: 'upcoming',
    }
    const registrants = [{ email: 'alice@x.com', name: 'Alice' }]
    const dbModule = await import('@/src/db')
    ;(dbModule.db as any).select = vi.fn((cols?: any) => {
      const isRegQuery = cols && Object.keys(cols).join(',') === 'email,name'
      if (isRegQuery) {
        return {
          from: vi.fn(() => ({
            where: vi.fn(async () => registrants),
          })),
        }
      }
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [workshopRow]),
          })),
        })),
      }
    })
    const mockStep = {
      run: vi.fn(async (_id: string, fn: () => unknown) => fn()),
      sleepUntil: vi.fn().mockResolvedValue(undefined),
    }

    const { _internal_handler } = await import('../functions/workshop-reminders-scheduled')
    await _internal_handler({ event: { data: { workshopId: 'wks1' } }, step: mockStep as any })

    const sleepCalls = mockStep.sleepUntil.mock.calls
    expect(sleepCalls).toHaveLength(2)
    expect((sleepCalls[0][1] as Date).toISOString()).toBe('2026-05-09T10:00:00.000Z')
    expect((sleepCalls[1][1] as Date).toISOString()).toBe('2026-05-10T09:00:00.000Z')
  })

  it('exits early if workshop was rescheduled (scheduledAt changed between schedule + wake)', async () => {
    const originalAt = new Date('2026-05-10T10:00:00Z')
    const newAt = new Date('2026-05-12T10:00:00Z')
    const dbModule = await import('@/src/db')
    let queryNum = 0
    ;(dbModule.db as any).select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => {
            queryNum++
            const at = queryNum === 1 ? originalAt : newAt
            return [{
              id: 'wks1',
              title: 'Test',
              scheduledAt: at,
              timezone: 'Asia/Kolkata',
              meetingUrl: 'https://meet.google.com/x',
              status: 'upcoming',
            }]
          }),
        })),
      })),
    }))
    const emailModule = await import('@/src/lib/email')
    const mockStep = {
      run: vi.fn(async (_id: string, fn: () => unknown) => fn()),
      sleepUntil: vi.fn().mockResolvedValue(undefined),
    }
    const { _internal_handler } = await import('../functions/workshop-reminders-scheduled')
    await _internal_handler({ event: { data: { workshopId: 'wks1' } }, step: mockStep as any })
    expect(emailModule.sendWorkshopReminderEmail).not.toHaveBeenCalled()
  })

  it('exits silently if workshop was deleted (no row)', async () => {
    const dbModule = await import('@/src/db')
    ;(dbModule.db as any).select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => []),
        })),
      })),
    }))
    const mockStep = {
      run: vi.fn(async (_id: string, fn: () => unknown) => fn()),
      sleepUntil: vi.fn(),
    }
    const { _internal_handler } = await import('../functions/workshop-reminders-scheduled')
    await _internal_handler({ event: { data: { workshopId: 'wks1' } }, step: mockStep as any })
    expect(mockStep.sleepUntil).not.toHaveBeenCalled()
  })

  it('exits silently if status is archived', async () => {
    const dbModule = await import('@/src/db')
    ;(dbModule.db as any).select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{
            id: 'wks1',
            title: 'Archived',
            scheduledAt: new Date('2026-05-10T10:00:00Z'),
            timezone: 'Asia/Kolkata',
            meetingUrl: 'https://meet.google.com/x',
            status: 'archived',
          }]),
        })),
      })),
    }))
    const mockStep = {
      run: vi.fn(async (_id: string, fn: () => unknown) => fn()),
      sleepUntil: vi.fn(),
    }
    const { _internal_handler } = await import('../functions/workshop-reminders-scheduled')
    await _internal_handler({ event: { data: { workshopId: 'wks1' } }, step: mockStep as any })
    expect(mockStep.sleepUntil).not.toHaveBeenCalled()
  })

  it('sends reminder email to each non-cancelled registration at the 24h wake', async () => {
    const startsAt = new Date('2026-05-10T10:00:00Z')
    const workshopRow = {
      id: 'wks1',
      title: 'Privacy',
      scheduledAt: startsAt,
      timezone: 'Asia/Kolkata',
      meetingUrl: 'https://meet.google.com/abc',
      status: 'upcoming',
    }
    const registrants = [
      { email: 'alice@x.com', name: 'Alice' },
      { email: 'bob@x.com', name: 'Bob' },
    ]
    const dbModule = await import('@/src/db')
    // Need to also handle the registrations query that doesn't end with .limit().
    // Re-shape: the registrations select chain ends with .where(...) returning the array.
    ;(dbModule.db as any).select = vi.fn((cols?: any) => {
      const isRegQuery = cols && Object.keys(cols).join(',') === 'email,name'
      if (isRegQuery) {
        return {
          from: vi.fn(() => ({
            where: vi.fn(async () => registrants),
          })),
        }
      }
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [workshopRow]),
          })),
        })),
      }
    })

    const emailModule = await import('@/src/lib/email')
    const mockStep = {
      run: vi.fn(async (_id: string, fn: () => unknown) => fn()),
      sleepUntil: vi.fn().mockResolvedValue(undefined),
    }
    const { _internal_handler } = await import('../functions/workshop-reminders-scheduled')
    await _internal_handler({ event: { data: { workshopId: 'wks1' } }, step: mockStep as any })

    expect(emailModule.sendWorkshopReminderEmail).toHaveBeenCalledTimes(4)  // 2 registrants × (24h + 1h)
    expect(emailModule.sendWorkshopReminderEmail).toHaveBeenCalledWith(
      'alice@x.com',
      expect.objectContaining({ workshopTitle: 'Privacy', windowLabel: 'in 24 hours' }),
    )
    expect(emailModule.sendWorkshopReminderEmail).toHaveBeenCalledWith(
      'bob@x.com',
      expect.objectContaining({ workshopTitle: 'Privacy', windowLabel: 'in 1 hour' }),
    )
  })
})

import { describe, it, expect } from 'vitest'
import { buildGreeting } from '../lib/greeting'

describe('buildGreeting', () => {
  it('includes the recipient name in the greeting', () => {
    const result = buildGreeting({
      recipientName: 'Civilization Lab',
      deliveredAt: new Date('2026-04-12T12:00:00.000Z'),
    })

    expect(result).toContain('Civilization Lab')
  })

  it('includes the ISO timestamp of delivery', () => {
    const result = buildGreeting({
      recipientName: 'Test User',
      deliveredAt: new Date('2026-04-12T12:00:00.000Z'),
    })

    expect(result).toContain('2026-04-12T12:00:00.000Z')
  })

  it('rejects an empty recipient name with a clear error', () => {
    expect(() =>
      buildGreeting({ recipientName: '', deliveredAt: new Date() }),
    ).toThrow(/recipientName/)
  })
})

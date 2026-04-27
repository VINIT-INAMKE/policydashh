import { describe, it, expect } from 'vitest'
import { wallTimeToUtc, utcToWallTime } from '../wall-time'

describe('wallTimeToUtc', () => {
  it('converts an IST wall time to UTC (positive offset, no DST)', () => {
    // 10:00 IST = 04:30 UTC (IST is +5:30, no DST)
    const utc = wallTimeToUtc('2026-05-01T10:00', 'Asia/Kolkata')
    expect(utc.toISOString()).toBe('2026-05-01T04:30:00.000Z')
  })

  it('converts an EDT wall time to UTC (negative offset, in DST)', () => {
    // May 1 is EDT (UTC-4): 09:00 EDT = 13:00 UTC
    const utc = wallTimeToUtc('2026-05-01T09:00', 'America/New_York')
    expect(utc.toISOString()).toBe('2026-05-01T13:00:00.000Z')
  })

  it('converts an EST wall time to UTC (negative offset, no DST)', () => {
    // Jan 15 is EST (UTC-5): 09:00 EST = 14:00 UTC
    const utc = wallTimeToUtc('2026-01-15T09:00', 'America/New_York')
    expect(utc.toISOString()).toBe('2026-01-15T14:00:00.000Z')
  })

  it('handles UTC zone identity (offset is 0)', () => {
    const utc = wallTimeToUtc('2026-06-15T12:00', 'UTC')
    expect(utc.toISOString()).toBe('2026-06-15T12:00:00.000Z')
  })

  it('accepts optional seconds', () => {
    const utc = wallTimeToUtc('2026-05-01T10:00:30', 'Asia/Kolkata')
    expect(utc.toISOString()).toBe('2026-05-01T04:30:30.000Z')
  })

  it('throws on malformed input', () => {
    expect(() => wallTimeToUtc('2026-05-01 10:00', 'UTC')).toThrow(/Invalid wall time/)
    expect(() => wallTimeToUtc('not a date', 'UTC')).toThrow(/Invalid wall time/)
  })
})

describe('utcToWallTime', () => {
  it('renders a UTC instant in IST wall clock', () => {
    expect(utcToWallTime('2026-05-01T04:30:00.000Z', 'Asia/Kolkata')).toBe('2026-05-01T10:00')
  })

  it('renders a UTC instant in EDT wall clock', () => {
    expect(utcToWallTime('2026-05-01T13:00:00.000Z', 'America/New_York')).toBe('2026-05-01T09:00')
  })

  it('round-trips wallTimeToUtc + utcToWallTime', () => {
    const original = '2026-07-15T14:45'
    const utc = wallTimeToUtc(original, 'Asia/Kolkata')
    expect(utcToWallTime(utc, 'Asia/Kolkata')).toBe(original)
  })
})

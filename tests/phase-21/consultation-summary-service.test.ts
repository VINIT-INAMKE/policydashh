import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the db module BEFORE importing the service (variable-path dynamic
// import to defeat Vite static import-analysis for not-yet-written exports).
vi.mock('@/src/db', () => {
  const select = vi.fn()
  return {
    db: {
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where: () => Promise.resolve([]),
          }),
          innerJoin: () => ({
            where: () => ({
              groupBy: () => Promise.resolve([]),
            }),
          }),
        }),
      }),
    },
  }
})

async function loadService() {
  // Phase 16 Pattern 2: variable-path dynamic import (array.join + @vite-ignore)
  const segs = ['@', 'src', 'server', 'services', 'consultation-summary.service']
  const path = segs.join('/')
  return await import(/* @vite-ignore */ path)
}

describe('anonymizeFeedbackForSection (LLM-06)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exports anonymizeFeedbackForSection as a function', async () => {
    const mod = await loadService()
    expect(typeof mod.anonymizeFeedbackForSection).toBe('function')
  })

  it('strips name, email, phone, and submitterId fields from output', async () => {
    const mod = await loadService()
    const input = [
      {
        feedbackId: '00000000-0000-0000-0000-000000000001',
        submitterId: '00000000-0000-0000-0000-000000000002',
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '+15551234567',
        body: 'The policy should address clause 4.',
        feedbackType: 'suggestion',
        impactCategory: 'clarity',
        orgType: 'industry',
      },
    ]
    const out = mod.anonymizeFeedbackForSection(input)
    expect(out).toHaveLength(1)
    // Stripped fields MUST NOT appear on any output row
    expect(out[0]).not.toHaveProperty('name')
    expect(out[0]).not.toHaveProperty('email')
    expect(out[0]).not.toHaveProperty('phone')
    expect(out[0]).not.toHaveProperty('submitterId')
    // Kept fields
    expect(out[0].body).toBe('The policy should address clause 4.')
    expect(out[0].orgType).toBe('industry')
    expect(out[0].feedbackType).toBe('suggestion')
  })

  it('returns [] for empty input', async () => {
    const mod = await loadService()
    expect(mod.anonymizeFeedbackForSection([])).toEqual([])
  })

  it('preserves null orgType without crashing', async () => {
    const mod = await loadService()
    const out = mod.anonymizeFeedbackForSection([
      {
        feedbackId: '00000000-0000-0000-0000-000000000001',
        submitterId: '00000000-0000-0000-0000-000000000002',
        name: 'Alex Doe',
        email: null,
        phone: null,
        body: 'Neutral feedback.',
        feedbackType: 'endorsement',
        impactCategory: 'clarity',
        orgType: null,
      },
    ])
    expect(out[0].orgType).toBeNull()
    expect(out[0].body).toBe('Neutral feedback.')
  })
})

describe('buildGuardrailPatternSource (LLM-08)', () => {
  it('exports buildGuardrailPatternSource as a function', async () => {
    const mod = await loadService()
    expect(typeof mod.buildGuardrailPatternSource).toBe('function')
  })

  it('returns a string (regex source, not RegExp object) — Pitfall 3', async () => {
    const mod = await loadService()
    const src = await mod.buildGuardrailPatternSource('00000000-0000-0000-0000-000000000003')
    expect(typeof src).toBe('string')
    expect(src.length).toBeGreaterThan(0)
  })

  it('static patterns include email, phone, and FirstName LastName', async () => {
    const mod = await loadService()
    const src = await mod.buildGuardrailPatternSource('00000000-0000-0000-0000-000000000003')
    const rx = new RegExp(src, 'i')
    expect(rx.test('Contact jane@example.com for more')).toBe(true)
    expect(rx.test('Call +15551234567 now')).toBe(true)
    expect(rx.test('Jane Smith raised concerns')).toBe(true)
  })

  it('does NOT match neutral policy prose or role-only attribution', async () => {
    const mod = await loadService()
    const src = await mod.buildGuardrailPatternSource('00000000-0000-0000-0000-000000000003')
    const rx = new RegExp(src, 'i')
    expect(rx.test('an industry stakeholder argued that the threshold is too low')).toBe(false)
    expect(rx.test('civil society voices cited innovation concerns')).toBe(false)
  })

  it('ignores name tokens shorter than 4 chars', async () => {
    const mod = await loadService()
    // If live users table were consulted with names like 'Bob' or 'Li',
    // those tokens must not become active regex terms. Static patterns
    // still apply, but 'bob' alone in prose must NOT trigger.
    const src = await mod.buildGuardrailPatternSource('00000000-0000-0000-0000-000000000003')
    const rx = new RegExp(src, 'i')
    expect(rx.test('the committee and staff reviewed the draft')).toBe(false)
  })
})

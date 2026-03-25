import { describe, it, expect } from 'vitest'
import { can } from '@/src/lib/permissions'
import { ROLES } from '@/src/lib/constants'
import { z } from 'zod'

// ── Permission matrix tests for traceability ──────────────────────

describe('traceability permissions', () => {
  const traceReadRoles = [
    ROLES.ADMIN,
    ROLES.POLICY_LEAD,
    ROLES.AUDITOR,
  ]

  const traceExportRoles = [
    ROLES.ADMIN,
    ROLES.POLICY_LEAD,
    ROLES.AUDITOR,
  ]

  const deniedReadRoles = [ROLES.OBSERVER, ROLES.RESEARCH_LEAD, ROLES.WORKSHOP_MODERATOR, ROLES.STAKEHOLDER]
  const deniedExportRoles = [ROLES.OBSERVER, ROLES.STAKEHOLDER, ROLES.WORKSHOP_MODERATOR, ROLES.RESEARCH_LEAD]

  it.each(traceReadRoles)('%s can read traceability', (role) => {
    expect(can(role, 'trace:read')).toBe(true)
  })

  it.each(deniedReadRoles)('%s cannot read traceability', (role) => {
    expect(can(role, 'trace:read')).toBe(false)
  })

  it.each(traceExportRoles)('%s can export traceability', (role) => {
    expect(can(role, 'trace:export')).toBe(true)
  })

  it.each(deniedExportRoles)('%s cannot export traceability', (role) => {
    expect(can(role, 'trace:export')).toBe(false)
  })
})

// ── Input schema validation tests ─────────────────────────────────

describe('traceability matrix input schema', () => {
  const matrixInput = z.object({
    documentId: z.string().uuid(),
    sectionId: z.string().uuid().optional(),
    orgType: z.enum(['government', 'industry', 'legal', 'academia', 'civil_society', 'internal']).optional(),
    decisionOutcome: z.enum(['submitted', 'under_review', 'accepted', 'partially_accepted', 'rejected', 'closed']).optional(),
    versionFromLabel: z.string().max(20).optional(),
    versionToLabel: z.string().max(20).optional(),
    limit: z.number().int().min(1).max(500).default(200),
    offset: z.number().int().min(0).default(0),
  })

  it('accepts valid input with all fields', () => {
    const result = matrixInput.safeParse({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      sectionId: '550e8400-e29b-41d4-a716-446655440001',
      orgType: 'government',
      decisionOutcome: 'accepted',
      versionFromLabel: 'v0.1',
      versionToLabel: 'v0.3',
      limit: 100,
      offset: 0,
    })
    expect(result.success).toBe(true)
  })

  it('accepts minimal input (documentId only)', () => {
    const result = matrixInput.safeParse({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(200)
      expect(result.data.offset).toBe(0)
    }
  })

  it('rejects invalid documentId', () => {
    const result = matrixInput.safeParse({ documentId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid orgType', () => {
    const result = matrixInput.safeParse({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      orgType: 'invalid_type',
    })
    expect(result.success).toBe(false)
  })

  it('rejects limit over 500', () => {
    const result = matrixInput.safeParse({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      limit: 501,
    })
    expect(result.success).toBe(false)
  })
})

// ── Search input schema tests ─────────────────────────────────────

describe('search input schemas', () => {
  const searchInput = z.object({
    documentId: z.string().uuid(),
    query: z.string().min(2).max(200),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
  })

  it('accepts valid search query', () => {
    const result = searchInput.safeParse({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      query: 'tax compliance',
    })
    expect(result.success).toBe(true)
  })

  it('rejects query shorter than 2 characters', () => {
    const result = searchInput.safeParse({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      query: 'a',
    })
    expect(result.success).toBe(false)
  })

  it('rejects query longer than 200 characters', () => {
    const result = searchInput.safeParse({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      query: 'x'.repeat(201),
    })
    expect(result.success).toBe(false)
  })
})

// ── ILIKE escape utility ──────────────────────────────────────────

describe('ILIKE escape', () => {
  function escapeIlike(input: string): string {
    return input.replace(/%/g, '\\%').replace(/_/g, '\\_')
  }

  it('escapes % characters', () => {
    expect(escapeIlike('100% complete')).toBe('100\\% complete')
  })

  it('escapes _ characters', () => {
    expect(escapeIlike('user_name')).toBe('user\\_name')
  })

  it('leaves normal text unchanged', () => {
    expect(escapeIlike('tax compliance')).toBe('tax compliance')
  })

  it('escapes multiple special characters', () => {
    expect(escapeIlike('50%_done')).toBe('50\\%\\_done')
  })
})

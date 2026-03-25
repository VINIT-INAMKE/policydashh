import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { can } from '@/src/lib/permissions'
import { ROLE_VALUES, type Role } from '@/src/lib/constants'

/**
 * Tests for the updateSectionContent mutation.
 *
 * Tests the permission model (section:manage) and input schema validation.
 * The actual mutation is tested via permission checks and schema parsing
 * (not integration-level DB calls) following the pattern from
 * document-permissions.test.ts.
 */

// Replicate the input schema used by updateSectionContent mutation
const updateSectionContentInput = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  content: z.record(z.string(), z.unknown()),
})

describe('updateSectionContent permissions', () => {
  it('allows admin via section:manage', () => {
    expect(can('admin', 'section:manage')).toBe(true)
  })

  it('allows policy_lead via section:manage', () => {
    expect(can('policy_lead', 'section:manage')).toBe(true)
  })

  it('denies stakeholder via section:manage', () => {
    expect(can('stakeholder', 'section:manage')).toBe(false)
  })

  it('denies observer via section:manage', () => {
    expect(can('observer', 'section:manage')).toBe(false)
  })

  it('denies auditor via section:manage', () => {
    expect(can('auditor', 'section:manage')).toBe(false)
  })

  it('denies research_lead via section:manage', () => {
    expect(can('research_lead', 'section:manage')).toBe(false)
  })

  it('denies workshop_moderator via section:manage', () => {
    expect(can('workshop_moderator', 'section:manage')).toBe(false)
  })

  it('only admin and policy_lead have section:manage', () => {
    const allowed = ROLE_VALUES.filter((role) => can(role as Role, 'section:manage'))
    expect(allowed).toEqual(expect.arrayContaining(['admin', 'policy_lead']))
    expect(allowed.length).toBe(2)
  })
})

describe('updateSectionContent input schema', () => {
  const validUUID = '550e8400-e29b-41d4-a716-446655440000'

  it('accepts valid input with Tiptap JSON structure', () => {
    const result = updateSectionContentInput.safeParse({
      id: validUUID,
      documentId: validUUID,
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty content object', () => {
    const result = updateSectionContentInput.safeParse({
      id: validUUID,
      documentId: validUUID,
      content: {},
    })
    expect(result.success).toBe(true)
  })

  it('accepts complex nested content', () => {
    const result = updateSectionContentInput.safeParse({
      id: validUUID,
      documentId: validUUID,
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Hello' }],
          },
          {
            type: 'callout',
            attrs: { type: 'info', emoji: '\u{1F4A1}' },
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Important note' }],
              },
            ],
          },
        ],
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing id field', () => {
    const result = updateSectionContentInput.safeParse({
      documentId: validUUID,
      content: { type: 'doc', content: [] },
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-uuid id', () => {
    const result = updateSectionContentInput.safeParse({
      id: 'not-a-uuid',
      documentId: validUUID,
      content: { type: 'doc', content: [] },
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing documentId field', () => {
    const result = updateSectionContentInput.safeParse({
      id: validUUID,
      content: { type: 'doc', content: [] },
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-uuid documentId', () => {
    const result = updateSectionContentInput.safeParse({
      id: validUUID,
      documentId: 'not-a-uuid',
      content: { type: 'doc', content: [] },
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing content field', () => {
    const result = updateSectionContentInput.safeParse({
      id: validUUID,
      documentId: validUUID,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-object content (string)', () => {
    const result = updateSectionContentInput.safeParse({
      id: validUUID,
      documentId: validUUID,
      content: 'not an object',
    })
    expect(result.success).toBe(false)
  })
})

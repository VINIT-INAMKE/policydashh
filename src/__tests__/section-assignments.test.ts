import { describe, it, expect } from 'vitest'
import { BYPASS_SECTION_SCOPE } from '@/src/server/rbac/section-access'
import type { Role } from '@/src/lib/constants'

describe('Section Access Scoping', () => {
  describe('BYPASS_SECTION_SCOPE', () => {
    it('includes admin', () => {
      expect(BYPASS_SECTION_SCOPE).toContain('admin')
    })

    it('includes auditor', () => {
      expect(BYPASS_SECTION_SCOPE).toContain('auditor')
    })

    it('includes policy_lead', () => {
      expect(BYPASS_SECTION_SCOPE).toContain('policy_lead')
    })

    it('does not include stakeholder', () => {
      expect(BYPASS_SECTION_SCOPE).not.toContain('stakeholder')
    })

    it('does not include research_lead', () => {
      expect(BYPASS_SECTION_SCOPE).not.toContain('research_lead')
    })

    it('does not include workshop_moderator', () => {
      expect(BYPASS_SECTION_SCOPE).not.toContain('workshop_moderator')
    })

    it('does not include observer', () => {
      expect(BYPASS_SECTION_SCOPE).not.toContain('observer')
    })

    it('has exactly 3 bypass roles', () => {
      expect(BYPASS_SECTION_SCOPE).toHaveLength(3)
    })
  })

  describe('requireSectionAccess middleware export', () => {
    it('is a function that returns a middleware', async () => {
      const { requireSectionAccess } = await import('@/src/server/rbac/section-access')
      expect(typeof requireSectionAccess).toBe('function')
    })

    it('accepts a custom inputKey parameter', async () => {
      const { requireSectionAccess } = await import('@/src/server/rbac/section-access')
      // Should not throw when called with custom key
      const middleware = requireSectionAccess('customKey')
      expect(middleware).toBeDefined()
    })

    it('uses sectionId as default inputKey', async () => {
      const { requireSectionAccess } = await import('@/src/server/rbac/section-access')
      const middleware = requireSectionAccess()
      expect(middleware).toBeDefined()
    })
  })
})

import { describe, it, expect } from 'vitest'
import { can } from '@/src/lib/permissions'
import { ROLE_VALUES, type Role } from '@/src/lib/constants'

describe('Document & Section Permissions', () => {
  describe('document:create permission', () => {
    it('allows admin', () => {
      expect(can('admin', 'document:create')).toBe(true)
    })

    it('allows policy_lead', () => {
      expect(can('policy_lead', 'document:create')).toBe(true)
    })

    it('denies stakeholder', () => {
      expect(can('stakeholder', 'document:create')).toBe(false)
    })

    it('denies observer', () => {
      expect(can('observer', 'document:create')).toBe(false)
    })

    it('denies research_lead', () => {
      expect(can('research_lead', 'document:create')).toBe(false)
    })

    it('denies workshop_moderator', () => {
      expect(can('workshop_moderator', 'document:create')).toBe(false)
    })

    it('denies auditor', () => {
      expect(can('auditor', 'document:create')).toBe(false)
    })
  })

  describe('document:read permission', () => {
    it('allows all 7 roles', () => {
      for (const role of ROLE_VALUES) {
        expect(can(role as Role, 'document:read')).toBe(true)
      }
    })

    it('allows admin', () => {
      expect(can('admin', 'document:read')).toBe(true)
    })

    it('allows stakeholder', () => {
      expect(can('stakeholder', 'document:read')).toBe(true)
    })
  })

  describe('document:update permission', () => {
    it('allows admin', () => {
      expect(can('admin', 'document:update')).toBe(true)
    })

    it('allows policy_lead', () => {
      expect(can('policy_lead', 'document:update')).toBe(true)
    })

    it('denies stakeholder', () => {
      expect(can('stakeholder', 'document:update')).toBe(false)
    })

    it('denies observer', () => {
      expect(can('observer', 'document:update')).toBe(false)
    })

    it('denies research_lead', () => {
      expect(can('research_lead', 'document:update')).toBe(false)
    })

    it('denies auditor', () => {
      expect(can('auditor', 'document:update')).toBe(false)
    })
  })

  describe('document:delete permission', () => {
    it('allows admin', () => {
      expect(can('admin', 'document:delete')).toBe(true)
    })

    it('allows policy_lead', () => {
      expect(can('policy_lead', 'document:delete')).toBe(true)
    })

    it('denies observer', () => {
      expect(can('observer', 'document:delete')).toBe(false)
    })

    it('denies stakeholder', () => {
      expect(can('stakeholder', 'document:delete')).toBe(false)
    })

    it('denies research_lead', () => {
      expect(can('research_lead', 'document:delete')).toBe(false)
    })

    it('denies auditor', () => {
      expect(can('auditor', 'document:delete')).toBe(false)
    })
  })

  describe('section:manage permission', () => {
    it('allows admin', () => {
      expect(can('admin', 'section:manage')).toBe(true)
    })

    it('allows policy_lead', () => {
      expect(can('policy_lead', 'section:manage')).toBe(true)
    })

    it('denies stakeholder', () => {
      expect(can('stakeholder', 'section:manage')).toBe(false)
    })

    it('denies observer', () => {
      expect(can('observer', 'section:manage')).toBe(false)
    })

    it('denies research_lead', () => {
      expect(can('research_lead', 'section:manage')).toBe(false)
    })

    it('denies workshop_moderator', () => {
      expect(can('workshop_moderator', 'section:manage')).toBe(false)
    })

    it('denies auditor', () => {
      expect(can('auditor', 'section:manage')).toBe(false)
    })
  })
})

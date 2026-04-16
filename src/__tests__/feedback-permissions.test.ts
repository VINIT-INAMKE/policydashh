import { describe, it, expect } from 'vitest'
import { can, type Permission } from '@/src/lib/permissions'
import { ROLES, type Role } from '@/src/lib/constants'

describe('Feedback Permission Matrix', () => {
  describe('section:assign permission', () => {
    it('allows admin', () => {
      expect(can('admin', 'section:assign')).toBe(true)
    })

    it('allows policy_lead', () => {
      expect(can('policy_lead', 'section:assign')).toBe(true)
    })

    it('denies research_lead', () => {
      expect(can('research_lead', 'section:assign')).toBe(false)
    })

    it('denies workshop_moderator', () => {
      expect(can('workshop_moderator', 'section:assign')).toBe(false)
    })

    it('denies stakeholder', () => {
      expect(can('stakeholder', 'section:assign')).toBe(false)
    })

    it('denies observer', () => {
      expect(can('observer', 'section:assign')).toBe(false)
    })

    it('denies auditor', () => {
      expect(can('auditor', 'section:assign')).toBe(false)
    })
  })

  describe('section:read_assignments permission', () => {
    it('allows admin', () => {
      expect(can('admin', 'section:read_assignments')).toBe(true)
    })

    it('allows policy_lead', () => {
      expect(can('policy_lead', 'section:read_assignments')).toBe(true)
    })

    it('denies stakeholder', () => {
      expect(can('stakeholder', 'section:read_assignments')).toBe(false)
    })

    it('denies observer', () => {
      expect(can('observer', 'section:read_assignments')).toBe(false)
    })
  })

  describe('feedback:submit permission', () => {
    it('allows stakeholder', () => {
      expect(can('stakeholder', 'feedback:submit')).toBe(true)
    })

    it('allows research_lead', () => {
      expect(can('research_lead', 'feedback:submit')).toBe(true)
    })

    it('allows workshop_moderator', () => {
      expect(can('workshop_moderator', 'feedback:submit')).toBe(true)
    })

    it('denies admin', () => {
      expect(can('admin', 'feedback:submit')).toBe(false)
    })

    it('denies policy_lead', () => {
      expect(can('policy_lead', 'feedback:submit')).toBe(false)
    })

    it('denies observer', () => {
      expect(can('observer', 'feedback:submit')).toBe(false)
    })

    it('denies auditor', () => {
      expect(can('auditor', 'feedback:submit')).toBe(false)
    })
  })

  describe('feedback:read_own permission', () => {
    it('allows stakeholder', () => {
      expect(can('stakeholder', 'feedback:read_own')).toBe(true)
    })

    it('allows research_lead', () => {
      expect(can('research_lead', 'feedback:read_own')).toBe(true)
    })

    it('allows workshop_moderator', () => {
      expect(can('workshop_moderator', 'feedback:read_own')).toBe(true)
    })

    it('allows observer', () => {
      expect(can('observer', 'feedback:read_own')).toBe(true)
    })

    it('allows admin', () => {
      expect(can('admin', 'feedback:read_own')).toBe(true)
    })

    it('allows auditor', () => {
      expect(can('auditor', 'feedback:read_own')).toBe(true)
    })
  })

  describe('feedback:read_all permission', () => {
    it('allows admin', () => {
      expect(can('admin', 'feedback:read_all')).toBe(true)
    })

    it('allows policy_lead', () => {
      expect(can('policy_lead', 'feedback:read_all')).toBe(true)
    })

    it('allows auditor', () => {
      expect(can('auditor', 'feedback:read_all')).toBe(true)
    })

    it('denies stakeholder', () => {
      expect(can('stakeholder', 'feedback:read_all')).toBe(false)
    })

    it('denies research_lead', () => {
      expect(can('research_lead', 'feedback:read_all')).toBe(false)
    })

    it('denies observer', () => {
      expect(can('observer', 'feedback:read_all')).toBe(false)
    })
  })

  describe('feedback:review permission', () => {
    it('allows admin', () => {
      expect(can('admin', 'feedback:review')).toBe(true)
    })

    it('allows policy_lead', () => {
      expect(can('policy_lead', 'feedback:review')).toBe(true)
    })

    it('denies research_lead', () => {
      expect(can('research_lead', 'feedback:review')).toBe(false)
    })

    it('denies stakeholder', () => {
      expect(can('stakeholder', 'feedback:review')).toBe(false)
    })

    it('denies workshop_moderator', () => {
      expect(can('workshop_moderator', 'feedback:review')).toBe(false)
    })

    it('denies observer', () => {
      expect(can('observer', 'feedback:review')).toBe(false)
    })

    it('denies auditor', () => {
      expect(can('auditor', 'feedback:review')).toBe(false)
    })
  })

  describe('evidence:upload permission', () => {
    it('allows stakeholder', () => {
      expect(can('stakeholder', 'evidence:upload')).toBe(true)
    })

    it('allows research_lead', () => {
      expect(can('research_lead', 'evidence:upload')).toBe(true)
    })

    it('allows workshop_moderator', () => {
      expect(can('workshop_moderator', 'evidence:upload')).toBe(true)
    })

    it('allows admin', () => {
      expect(can('admin', 'evidence:upload')).toBe(true)
    })

    it('allows policy_lead', () => {
      expect(can('policy_lead', 'evidence:upload')).toBe(true)
    })

    it('denies observer', () => {
      expect(can('observer', 'evidence:upload')).toBe(false)
    })

    it('denies auditor', () => {
      expect(can('auditor', 'evidence:upload')).toBe(false)
    })
  })

  describe('evidence:read permission', () => {
    it('allows all 7 roles', () => {
      const allRoles: Role[] = ['admin', 'policy_lead', 'research_lead', 'workshop_moderator', 'stakeholder', 'observer', 'auditor']
      for (const role of allRoles) {
        expect(can(role, 'evidence:read')).toBe(true)
      }
    })
  })
})

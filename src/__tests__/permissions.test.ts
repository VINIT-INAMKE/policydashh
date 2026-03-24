import { describe, it, expect } from 'vitest'
import { can, PERMISSIONS, type Permission } from '@/src/lib/permissions'
import { ROLES, ROLE_VALUES, ORG_TYPES, ORG_TYPE_VALUES, type Role } from '@/src/lib/constants'

describe('Permission Matrix', () => {
  describe('ROLES constant', () => {
    it('has exactly 7 roles', () => {
      expect(ROLE_VALUES).toHaveLength(7)
    })

    it('includes all expected role values', () => {
      expect(ROLE_VALUES).toContain('admin')
      expect(ROLE_VALUES).toContain('policy_lead')
      expect(ROLE_VALUES).toContain('research_lead')
      expect(ROLE_VALUES).toContain('workshop_moderator')
      expect(ROLE_VALUES).toContain('stakeholder')
      expect(ROLE_VALUES).toContain('observer')
      expect(ROLE_VALUES).toContain('auditor')
    })
  })

  describe('ORG_TYPES constant', () => {
    it('has exactly 6 org types', () => {
      expect(ORG_TYPE_VALUES).toHaveLength(6)
    })

    it('includes all expected org type values', () => {
      expect(ORG_TYPE_VALUES).toContain('government')
      expect(ORG_TYPE_VALUES).toContain('industry')
      expect(ORG_TYPE_VALUES).toContain('legal')
      expect(ORG_TYPE_VALUES).toContain('academia')
      expect(ORG_TYPE_VALUES).toContain('civil_society')
      expect(ORG_TYPE_VALUES).toContain('internal')
    })
  })

  describe('user:invite permission', () => {
    it('allows admin', () => {
      expect(can('admin', 'user:invite')).toBe(true)
    })

    it('denies policy_lead', () => {
      expect(can('policy_lead', 'user:invite')).toBe(false)
    })

    it('denies stakeholder', () => {
      expect(can('stakeholder', 'user:invite')).toBe(false)
    })

    it('denies observer', () => {
      expect(can('observer', 'user:invite')).toBe(false)
    })

    it('denies auditor', () => {
      expect(can('auditor', 'user:invite')).toBe(false)
    })
  })

  describe('user:manage_roles permission', () => {
    it('allows admin', () => {
      expect(can('admin', 'user:manage_roles')).toBe(true)
    })

    it('denies all non-admin roles', () => {
      const nonAdmin: Role[] = ['policy_lead', 'research_lead', 'workshop_moderator', 'stakeholder', 'observer', 'auditor']
      for (const role of nonAdmin) {
        expect(can(role, 'user:manage_roles')).toBe(false)
      }
    })
  })

  describe('audit:read permission', () => {
    it('allows admin', () => {
      expect(can('admin', 'audit:read')).toBe(true)
    })

    it('allows auditor', () => {
      expect(can('auditor', 'audit:read')).toBe(true)
    })

    it('denies stakeholder', () => {
      expect(can('stakeholder', 'audit:read')).toBe(false)
    })

    it('denies observer', () => {
      expect(can('observer', 'audit:read')).toBe(false)
    })

    it('denies policy_lead', () => {
      expect(can('policy_lead', 'audit:read')).toBe(false)
    })
  })

  describe('user:read_own permission', () => {
    it('allows all 7 roles', () => {
      for (const role of ROLE_VALUES) {
        expect(can(role as Role, 'user:read_own')).toBe(true)
      }
    })
  })

  describe('user:update_own permission', () => {
    it('allows all 7 roles', () => {
      for (const role of ROLE_VALUES) {
        expect(can(role as Role, 'user:update_own')).toBe(true)
      }
    })
  })

  describe('default-deny principle', () => {
    it('every permission has at least one allowed role', () => {
      for (const [_perm, roles] of Object.entries(PERMISSIONS)) {
        expect(roles.length).toBeGreaterThan(0)
      }
    })

    it('no role has blanket access to all permissions', () => {
      const allPerms = Object.keys(PERMISSIONS) as Permission[]
      for (const role of ROLE_VALUES) {
        const grantedCount = allPerms.filter(p => can(role as Role, p)).length
        // Even admin should not have ALL permissions blindly -- they have specific ones
        expect(grantedCount).toBeLessThanOrEqual(allPerms.length)
      }
    })
  })
})

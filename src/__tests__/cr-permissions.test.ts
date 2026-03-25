import { describe, it, expect } from 'vitest'
import { can } from '@/src/lib/permissions'
import type { Role } from '@/src/lib/constants'

describe('CR Permission Matrix', () => {
  describe('cr:create permission', () => {
    it('allows admin', () => {
      expect(can('admin', 'cr:create')).toBe(true)
    })

    it('allows policy_lead', () => {
      expect(can('policy_lead', 'cr:create')).toBe(true)
    })

    it('denies auditor', () => {
      expect(can('auditor', 'cr:create')).toBe(false)
    })

    it('denies stakeholder', () => {
      expect(can('stakeholder', 'cr:create')).toBe(false)
    })

    it('denies observer', () => {
      expect(can('observer', 'cr:create')).toBe(false)
    })

    it('denies research_lead', () => {
      expect(can('research_lead', 'cr:create')).toBe(false)
    })

    it('denies workshop_moderator', () => {
      expect(can('workshop_moderator', 'cr:create')).toBe(false)
    })
  })

  describe('cr:read permission', () => {
    it('allows admin', () => {
      expect(can('admin', 'cr:read')).toBe(true)
    })

    it('allows policy_lead', () => {
      expect(can('policy_lead', 'cr:read')).toBe(true)
    })

    it('allows auditor', () => {
      expect(can('auditor', 'cr:read')).toBe(true)
    })

    it('denies stakeholder', () => {
      expect(can('stakeholder', 'cr:read')).toBe(false)
    })

    it('denies observer', () => {
      expect(can('observer', 'cr:read')).toBe(false)
    })

    it('denies research_lead', () => {
      expect(can('research_lead', 'cr:read')).toBe(false)
    })

    it('denies workshop_moderator', () => {
      expect(can('workshop_moderator', 'cr:read')).toBe(false)
    })
  })

  describe('cr:manage permission', () => {
    it('allows admin', () => {
      expect(can('admin', 'cr:manage')).toBe(true)
    })

    it('allows policy_lead', () => {
      expect(can('policy_lead', 'cr:manage')).toBe(true)
    })

    it('denies auditor', () => {
      expect(can('auditor', 'cr:manage')).toBe(false)
    })

    it('denies stakeholder', () => {
      expect(can('stakeholder', 'cr:manage')).toBe(false)
    })

    it('denies observer', () => {
      expect(can('observer', 'cr:manage')).toBe(false)
    })

    it('denies research_lead', () => {
      expect(can('research_lead', 'cr:manage')).toBe(false)
    })

    it('denies workshop_moderator', () => {
      expect(can('workshop_moderator', 'cr:manage')).toBe(false)
    })
  })
})

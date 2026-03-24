import { describe, it, expect } from 'vitest'
import { ROLE_VALUES } from '@/src/lib/constants'

// Test the webhook's role extraction logic (pure function behavior)
// We test the logic, not the HTTP handler itself (that requires Clerk webhook verification)
describe('Webhook Role Extraction Logic', () => {
  function extractRole(publicMetadata?: { role?: string }): string {
    const metadataRole = publicMetadata?.role
    if (metadataRole && ROLE_VALUES.includes(metadataRole as any)) {
      return metadataRole
    }
    return 'stakeholder'
  }

  it('returns role from publicMetadata when valid', () => {
    expect(extractRole({ role: 'admin' })).toBe('admin')
    expect(extractRole({ role: 'policy_lead' })).toBe('policy_lead')
    expect(extractRole({ role: 'auditor' })).toBe('auditor')
  })

  it('defaults to stakeholder when publicMetadata has no role', () => {
    expect(extractRole({})).toBe('stakeholder')
    expect(extractRole(undefined)).toBe('stakeholder')
  })

  it('defaults to stakeholder when role value is invalid', () => {
    expect(extractRole({ role: 'superadmin' })).toBe('stakeholder')
    expect(extractRole({ role: '' })).toBe('stakeholder')
    expect(extractRole({ role: 'ADMIN' })).toBe('stakeholder') // case-sensitive
  })

  it('handles all 7 valid roles from publicMetadata', () => {
    for (const role of ROLE_VALUES) {
      expect(extractRole({ role })).toBe(role)
    }
  })
})

describe('Webhook Phone Extraction Logic', () => {
  function extractPhone(phoneNumbers?: Array<{ phone_number: string }>): string | null {
    return phoneNumbers?.[0]?.phone_number ?? null
  }

  it('extracts first phone number from array', () => {
    expect(extractPhone([{ phone_number: '+1234567890' }])).toBe('+1234567890')
  })

  it('returns null when phone_numbers is empty', () => {
    expect(extractPhone([])).toBeNull()
  })

  it('returns null when phone_numbers is undefined', () => {
    expect(extractPhone(undefined)).toBeNull()
  })

  it('extracts first phone when multiple exist', () => {
    expect(extractPhone([
      { phone_number: '+1111111111' },
      { phone_number: '+2222222222' },
    ])).toBe('+1111111111')
  })
})

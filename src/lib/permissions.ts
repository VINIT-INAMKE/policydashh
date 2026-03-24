import { ROLES, type Role } from './constants'

// Permission matrix -- default-deny: anything not listed = FORBIDDEN
// Add new permissions here as features ship in later phases.
export const PERMISSIONS = {
  // User management
  'user:invite':          [ROLES.ADMIN] as readonly Role[],
  'user:manage_roles':    [ROLES.ADMIN] as readonly Role[],
  'user:list':            [ROLES.ADMIN] as readonly Role[],
  'user:read_own':        [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD, ROLES.WORKSHOP_MODERATOR, ROLES.STAKEHOLDER, ROLES.OBSERVER, ROLES.AUDITOR] as readonly Role[],
  'user:update_own':      [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD, ROLES.WORKSHOP_MODERATOR, ROLES.STAKEHOLDER, ROLES.OBSERVER, ROLES.AUDITOR] as readonly Role[],

  // Audit log access
  'audit:read':           [ROLES.ADMIN, ROLES.AUDITOR] as readonly Role[],
} as const

export type Permission = keyof typeof PERMISSIONS

export function can(role: Role, permission: Permission): boolean {
  const allowed = PERMISSIONS[permission]
  return (allowed as readonly string[]).includes(role)
}

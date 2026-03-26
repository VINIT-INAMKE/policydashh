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

  // Document management
  'document:create':      [ROLES.ADMIN, ROLES.POLICY_LEAD] as readonly Role[],
  'document:read':        [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD, ROLES.WORKSHOP_MODERATOR, ROLES.STAKEHOLDER, ROLES.OBSERVER, ROLES.AUDITOR] as readonly Role[],
  'document:update':      [ROLES.ADMIN, ROLES.POLICY_LEAD] as readonly Role[],
  'document:delete':      [ROLES.ADMIN, ROLES.POLICY_LEAD] as readonly Role[],

  // Section management
  'section:manage':       [ROLES.ADMIN, ROLES.POLICY_LEAD] as readonly Role[],

  // Section assignments (Phase 4)
  'section:assign':            [ROLES.ADMIN, ROLES.POLICY_LEAD] as readonly Role[],
  'section:read_assignments':  [ROLES.ADMIN, ROLES.POLICY_LEAD] as readonly Role[],

  // Feedback (Phase 4)
  'feedback:submit':           [ROLES.STAKEHOLDER, ROLES.RESEARCH_LEAD, ROLES.WORKSHOP_MODERATOR] as readonly Role[],
  'feedback:read_own':         [ROLES.STAKEHOLDER, ROLES.RESEARCH_LEAD, ROLES.WORKSHOP_MODERATOR, ROLES.OBSERVER] as readonly Role[],
  'feedback:read_all':         [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.AUDITOR] as readonly Role[],
  'feedback:review':           [ROLES.ADMIN, ROLES.POLICY_LEAD] as readonly Role[],

  // Evidence (Phase 4)
  'evidence:upload':           [ROLES.STAKEHOLDER, ROLES.RESEARCH_LEAD, ROLES.WORKSHOP_MODERATOR, ROLES.ADMIN, ROLES.POLICY_LEAD] as readonly Role[],
  'evidence:read':             [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD, ROLES.WORKSHOP_MODERATOR, ROLES.STAKEHOLDER, ROLES.OBSERVER, ROLES.AUDITOR] as readonly Role[],

  // Change Requests (Phase 5)
  'cr:create':                 [ROLES.ADMIN, ROLES.POLICY_LEAD] as readonly Role[],
  'cr:read':                   [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.AUDITOR] as readonly Role[],
  'cr:manage':                 [ROLES.ADMIN, ROLES.POLICY_LEAD] as readonly Role[],

  // Versioning (Phase 6)
  'version:read':              [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.AUDITOR, ROLES.OBSERVER, ROLES.RESEARCH_LEAD, ROLES.STAKEHOLDER] as readonly Role[],
  'version:manage':            [ROLES.ADMIN, ROLES.POLICY_LEAD] as readonly Role[],
  'version:publish':           [ROLES.ADMIN, ROLES.POLICY_LEAD] as readonly Role[],

  // Traceability (Phase 7)
  'trace:read':                [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.AUDITOR] as readonly Role[],
  'trace:export':              [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.AUDITOR] as readonly Role[],

  // Notifications (Phase 8)
  'notification:read':         [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD, ROLES.WORKSHOP_MODERATOR, ROLES.STAKEHOLDER, ROLES.OBSERVER, ROLES.AUDITOR] as readonly Role[],
  'notification:manage':       [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD, ROLES.WORKSHOP_MODERATOR, ROLES.STAKEHOLDER, ROLES.OBSERVER, ROLES.AUDITOR] as readonly Role[],

  // Evidence export (Phase 9)
  'evidence:export':           [ROLES.ADMIN, ROLES.AUDITOR] as readonly Role[],

  // Workshops (Phase 10)
  'workshop:manage':           [ROLES.ADMIN, ROLES.WORKSHOP_MODERATOR] as readonly Role[],
  'workshop:read':             [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD, ROLES.WORKSHOP_MODERATOR, ROLES.STAKEHOLDER, ROLES.OBSERVER, ROLES.AUDITOR] as readonly Role[],
} as const

export type Permission = keyof typeof PERMISSIONS

export function can(role: Role, permission: Permission): boolean {
  const allowed = PERMISSIONS[permission]
  return (allowed as readonly string[]).includes(role)
}

export const ROLES = {
  ADMIN: 'admin',
  POLICY_LEAD: 'policy_lead',
  RESEARCH_LEAD: 'research_lead',
  WORKSHOP_MODERATOR: 'workshop_moderator',
  STAKEHOLDER: 'stakeholder',
  OBSERVER: 'observer',
  AUDITOR: 'auditor',
} as const

export type Role = typeof ROLES[keyof typeof ROLES]

export const ROLE_VALUES = Object.values(ROLES)

export const ORG_TYPES = {
  GOVERNMENT: 'government',
  INDUSTRY: 'industry',
  LEGAL: 'legal',
  ACADEMIA: 'academia',
  CIVIL_SOCIETY: 'civil_society',
  INTERNAL: 'internal',
} as const

export type OrgType = typeof ORG_TYPES[keyof typeof ORG_TYPES]

export const ORG_TYPE_VALUES = Object.values(ORG_TYPES)

// Audit action constants
export const ACTIONS = {
  USER_CREATE: 'user.create',
  USER_ROLE_ASSIGN: 'user.role_assign',
  USER_INVITE: 'user.invite',
  USER_ORG_TYPE_SET: 'user.org_type_set',
  USER_UPDATE: 'user.update',
  DOCUMENT_CREATE: 'document.create',
  DOCUMENT_UPDATE: 'document.update',
  DOCUMENT_DELETE: 'document.delete',
  SECTION_CREATE: 'section.create',
  SECTION_DELETE: 'section.delete',
  SECTION_REORDER: 'section.reorder',
  SECTION_RENAME: 'section.rename',
  DOCUMENT_IMPORT: 'document.import',
} as const

export type Action = typeof ACTIONS[keyof typeof ACTIONS]

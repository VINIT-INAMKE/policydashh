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
  SECTION_ASSIGN: 'section.assign',
  SECTION_UNASSIGN: 'section.unassign',
  FEEDBACK_SUBMIT: 'feedback.submit',
  FEEDBACK_START_REVIEW: 'feedback.start_review',
  FEEDBACK_ACCEPT: 'feedback.accept',
  FEEDBACK_PARTIAL: 'feedback.partially_accept',
  FEEDBACK_REJECT: 'feedback.reject',
  FEEDBACK_CLOSE: 'feedback.close',
  EVIDENCE_UPLOAD: 'evidence.upload',
  EVIDENCE_ATTACH: 'evidence.attach',
  EVIDENCE_REMOVE: 'evidence.remove',
  PRIVACY_PREF_UPDATE: 'user.privacy_pref_update',
  CR_CREATE:          'cr.create',
  CR_UPDATE:          'cr.update',
  CR_SUBMIT_REVIEW:   'cr.submit_for_review',
  CR_APPROVE:         'cr.approve',
  CR_REQUEST_CHANGES: 'cr.request_changes',
  CR_MERGE:           'cr.merge',
  CR_CLOSE:           'cr.close',
  VERSION_CREATE:     'version.create',
  VERSION_PUBLISH:    'version.publish',
  TRACE_EXPORT:       'trace.export',
  EVIDENCE_PACK_EXPORT: 'evidence_pack.export',
  NOTIFICATION_READ:  'notification.read',
  NOTIFICATION_MARK_READ: 'notification.mark_read',
  WORKSHOP_CREATE:          'workshop.create',
  WORKSHOP_UPDATE:          'workshop.update',
  WORKSHOP_DELETE:          'workshop.delete',
  WORKSHOP_ARTIFACT_ATTACH: 'workshop.artifact_attach',
  WORKSHOP_ARTIFACT_REMOVE: 'workshop.artifact_remove',
  WORKSHOP_SECTION_LINK:    'workshop.section_link',
  WORKSHOP_SECTION_UNLINK:  'workshop.section_unlink',
  WORKSHOP_FEEDBACK_LINK:   'workshop.feedback_link',
  WORKSHOP_FEEDBACK_UNLINK: 'workshop.feedback_unlink',
  COMMENT_CREATE:           'comment.create',
  COMMENT_REPLY:            'comment.reply',
  COMMENT_RESOLVE:          'comment.resolve',
  COMMENT_REOPEN:           'comment.reopen',
  COMMENT_DELETE:            'comment.delete',
} as const

export type Action = typeof ACTIONS[keyof typeof ACTIONS]

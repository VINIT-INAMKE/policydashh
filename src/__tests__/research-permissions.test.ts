/**
 * RED TDD stub for RESEARCH-03 — research permission matrix contract
 *
 * Wave 0 contract lock for Phase 26 Plan 26-02. All tests here are `it.todo`
 * (pending) — they describe the behavior Plan 26-02 must make GREEN without
 * failing the test suite at Wave 0 time.
 *
 * Canonical source: .planning/research/research-module/INTEGRATION.md §8
 * Research grounding: .planning/phases/26-research-module-data-server/26-RESEARCH.md §Pattern 6
 *
 * Seven new permissions + exact grant table:
 *   'research:create'          → ADMIN, POLICY_LEAD, RESEARCH_LEAD
 *   'research:manage_own'      → ADMIN, POLICY_LEAD, RESEARCH_LEAD
 *   'research:submit_review'   → ADMIN, POLICY_LEAD, RESEARCH_LEAD
 *   'research:publish'         → ADMIN, POLICY_LEAD (moderation gate — Q3)
 *   'research:retract'         → ADMIN, POLICY_LEAD
 *   'research:read_drafts'     → ADMIN, POLICY_LEAD, RESEARCH_LEAD
 *   'research:read_published'  → ALL 7 authenticated roles
 *
 * Q3 decision: moderation gate enforced — research_lead cannot self-publish (expect false).
 */

import { describe, it } from 'vitest'
import { can } from '@/src/lib/permissions'
import type { Role } from '@/src/lib/constants'

// Reference to silence unused-import warnings under strict settings.
// Wave 1 (Plan 26-02) will exercise can() inside it() bodies.
void can
const _ALL_ROLES: readonly Role[] = [
  'admin', 'policy_lead', 'research_lead',
  'workshop_moderator', 'stakeholder', 'observer', 'auditor',
] as const
void _ALL_ROLES

describe("'research:create' permission (RESEARCH-03)", () => {
  it.todo("expect(can('admin', 'research:create')).toBe(true)")
  it.todo("expect(can('policy_lead', 'research:create')).toBe(true)")
  it.todo("expect(can('research_lead', 'research:create')).toBe(true)")
  it.todo("expect(can('workshop_moderator', 'research:create')).toBe(false)")
  it.todo("expect(can('stakeholder', 'research:create')).toBe(false)")
  it.todo("expect(can('observer', 'research:create')).toBe(false)")
  it.todo("expect(can('auditor', 'research:create')).toBe(false)")
})

describe("'research:manage_own' permission (RESEARCH-03)", () => {
  it.todo("expect(can('admin', 'research:manage_own')).toBe(true)")
  it.todo("expect(can('policy_lead', 'research:manage_own')).toBe(true)")
  it.todo("expect(can('research_lead', 'research:manage_own')).toBe(true)")
  it.todo("expect(can('workshop_moderator', 'research:manage_own')).toBe(false)")
  it.todo("expect(can('stakeholder', 'research:manage_own')).toBe(false)")
  it.todo("expect(can('observer', 'research:manage_own')).toBe(false)")
  it.todo("expect(can('auditor', 'research:manage_own')).toBe(false)")
})

describe("'research:submit_review' permission (RESEARCH-03)", () => {
  it.todo("expect(can('admin', 'research:submit_review')).toBe(true)")
  it.todo("expect(can('policy_lead', 'research:submit_review')).toBe(true)")
  it.todo("expect(can('research_lead', 'research:submit_review')).toBe(true)")
  it.todo("expect(can('workshop_moderator', 'research:submit_review')).toBe(false)")
  it.todo("expect(can('stakeholder', 'research:submit_review')).toBe(false)")
  it.todo("expect(can('observer', 'research:submit_review')).toBe(false)")
  it.todo("expect(can('auditor', 'research:submit_review')).toBe(false)")
})

describe("'research:publish' permission (RESEARCH-03 — Q3 moderation gate)", () => {
  it.todo("expect(can('admin', 'research:publish')).toBe(true)")
  it.todo("expect(can('policy_lead', 'research:publish')).toBe(true)")
  it.todo("Q3 moderation gate: research_lead cannot self-publish — expect false for research_lead 'research:publish'")
  it.todo("expect(can('workshop_moderator', 'research:publish')).toBe(false)")
  it.todo("expect(can('stakeholder', 'research:publish')).toBe(false)")
  it.todo("expect(can('observer', 'research:publish')).toBe(false)")
  it.todo("expect(can('auditor', 'research:publish')).toBe(false)")
})

describe("'research:retract' permission (RESEARCH-03)", () => {
  it.todo("expect(can('admin', 'research:retract')).toBe(true)")
  it.todo("expect(can('policy_lead', 'research:retract')).toBe(true)")
  it.todo("research_lead 'research:retract' must be false (admin + policy_lead only)")
  it.todo("expect(can('workshop_moderator', 'research:retract')).toBe(false)")
  it.todo("expect(can('stakeholder', 'research:retract')).toBe(false)")
  it.todo("expect(can('observer', 'research:retract')).toBe(false)")
  it.todo("expect(can('auditor', 'research:retract')).toBe(false)")
})

describe("'research:read_drafts' permission (RESEARCH-03)", () => {
  it.todo("expect(can('admin', 'research:read_drafts')).toBe(true)")
  it.todo("expect(can('policy_lead', 'research:read_drafts')).toBe(true)")
  it.todo("expect(can('research_lead', 'research:read_drafts')).toBe(true)")
  it.todo("expect(can('workshop_moderator', 'research:read_drafts')).toBe(false)")
  it.todo("expect(can('stakeholder', 'research:read_drafts')).toBe(false)")
  it.todo("expect(can('observer', 'research:read_drafts')).toBe(false)")
  it.todo("expect(can('auditor', 'research:read_drafts')).toBe(false)")
})

describe("'research:read_published' permission (RESEARCH-03 — broadest grant per Pitfall 4)", () => {
  it.todo("expect(can('admin', 'research:read_published')).toBe(true)")
  it.todo("expect(can('policy_lead', 'research:read_published')).toBe(true)")
  it.todo("expect(can('research_lead', 'research:read_published')).toBe(true)")
  it.todo("expect(can('workshop_moderator', 'research:read_published')).toBe(true)")
  it.todo("expect(can('stakeholder', 'research:read_published')).toBe(true)")
  it.todo("expect(can('observer', 'research:read_published')).toBe(true)")
  it.todo("expect(can('auditor', 'research:read_published')).toBe(true)")
})

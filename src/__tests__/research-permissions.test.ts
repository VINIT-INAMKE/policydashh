/**
 * GREEN permissions matrix contract for RESEARCH-03.
 *
 * Plan 26-02 flipped this file from RED (it.todo) to GREEN (it + expect)
 * after adding the 7 new `research:*` entries to src/lib/permissions.ts per
 * INTEGRATION.md §8 grant matrix and CONTEXT.md Q3 moderation gate.
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
 * Q3 decision: moderation gate enforced — research_lead cannot self-publish or retract.
 */

import { describe, it, expect } from 'vitest'
import { can } from '@/src/lib/permissions'
import type { Role } from '@/src/lib/constants'

const ALL_ROLES: readonly Role[] = [
  'admin', 'policy_lead', 'research_lead',
  'workshop_moderator', 'stakeholder', 'observer', 'auditor',
] as const

describe("'research:create' permission (RESEARCH-03)", () => {
  it("allows admin", () => {
    expect(can('admin', 'research:create')).toBe(true)
  })
  it("allows policy_lead", () => {
    expect(can('policy_lead', 'research:create')).toBe(true)
  })
  it("allows research_lead", () => {
    expect(can('research_lead', 'research:create')).toBe(true)
  })
  it("denies workshop_moderator", () => {
    expect(can('workshop_moderator', 'research:create')).toBe(false)
  })
  it("denies stakeholder", () => {
    expect(can('stakeholder', 'research:create')).toBe(false)
  })
  it("denies observer", () => {
    expect(can('observer', 'research:create')).toBe(false)
  })
  it("denies auditor", () => {
    expect(can('auditor', 'research:create')).toBe(false)
  })
})

describe("'research:manage_own' permission (RESEARCH-03)", () => {
  it("allows admin", () => {
    expect(can('admin', 'research:manage_own')).toBe(true)
  })
  it("allows policy_lead", () => {
    expect(can('policy_lead', 'research:manage_own')).toBe(true)
  })
  it("allows research_lead", () => {
    expect(can('research_lead', 'research:manage_own')).toBe(true)
  })
  it("denies workshop_moderator", () => {
    expect(can('workshop_moderator', 'research:manage_own')).toBe(false)
  })
  it("denies stakeholder", () => {
    expect(can('stakeholder', 'research:manage_own')).toBe(false)
  })
  it("denies observer", () => {
    expect(can('observer', 'research:manage_own')).toBe(false)
  })
  it("denies auditor", () => {
    expect(can('auditor', 'research:manage_own')).toBe(false)
  })
})

describe("'research:submit_review' permission (RESEARCH-03)", () => {
  it("allows admin", () => {
    expect(can('admin', 'research:submit_review')).toBe(true)
  })
  it("allows policy_lead", () => {
    expect(can('policy_lead', 'research:submit_review')).toBe(true)
  })
  it("allows research_lead", () => {
    expect(can('research_lead', 'research:submit_review')).toBe(true)
  })
  it("denies workshop_moderator", () => {
    expect(can('workshop_moderator', 'research:submit_review')).toBe(false)
  })
  it("denies stakeholder", () => {
    expect(can('stakeholder', 'research:submit_review')).toBe(false)
  })
  it("denies observer", () => {
    expect(can('observer', 'research:submit_review')).toBe(false)
  })
  it("denies auditor", () => {
    expect(can('auditor', 'research:submit_review')).toBe(false)
  })
})

describe("'research:publish' permission (RESEARCH-03 — Q3 moderation gate)", () => {
  it("allows admin", () => {
    expect(can('admin', 'research:publish')).toBe(true)
  })
  it("allows policy_lead", () => {
    expect(can('policy_lead', 'research:publish')).toBe(true)
  })
  it("Q3 moderation gate: research_lead cannot self-publish", () => {
    expect(can('research_lead', 'research:publish')).toBe(false)
  })
  it("denies workshop_moderator", () => {
    expect(can('workshop_moderator', 'research:publish')).toBe(false)
  })
  it("denies stakeholder", () => {
    expect(can('stakeholder', 'research:publish')).toBe(false)
  })
  it("denies observer", () => {
    expect(can('observer', 'research:publish')).toBe(false)
  })
  it("denies auditor", () => {
    expect(can('auditor', 'research:publish')).toBe(false)
  })
})

describe("'research:retract' permission (RESEARCH-03)", () => {
  it("allows admin", () => {
    expect(can('admin', 'research:retract')).toBe(true)
  })
  it("allows policy_lead", () => {
    expect(can('policy_lead', 'research:retract')).toBe(true)
  })
  it("research_lead cannot retract — admin + policy_lead only", () => {
    expect(can('research_lead', 'research:retract')).toBe(false)
  })
  it("denies workshop_moderator", () => {
    expect(can('workshop_moderator', 'research:retract')).toBe(false)
  })
  it("denies stakeholder", () => {
    expect(can('stakeholder', 'research:retract')).toBe(false)
  })
  it("denies observer", () => {
    expect(can('observer', 'research:retract')).toBe(false)
  })
  it("denies auditor", () => {
    expect(can('auditor', 'research:retract')).toBe(false)
  })
})

describe("'research:read_drafts' permission (RESEARCH-03)", () => {
  it("allows admin", () => {
    expect(can('admin', 'research:read_drafts')).toBe(true)
  })
  it("allows policy_lead", () => {
    expect(can('policy_lead', 'research:read_drafts')).toBe(true)
  })
  it("allows research_lead", () => {
    expect(can('research_lead', 'research:read_drafts')).toBe(true)
  })
  it("denies workshop_moderator", () => {
    expect(can('workshop_moderator', 'research:read_drafts')).toBe(false)
  })
  it("denies stakeholder", () => {
    expect(can('stakeholder', 'research:read_drafts')).toBe(false)
  })
  it("denies observer", () => {
    expect(can('observer', 'research:read_drafts')).toBe(false)
  })
  it("denies auditor", () => {
    expect(can('auditor', 'research:read_drafts')).toBe(false)
  })
})

describe("'research:read_published' permission (RESEARCH-03 — broadest grant per Pitfall 4)", () => {
  it("allows all 7 authenticated roles", () => {
    for (const role of ALL_ROLES) {
      expect(can(role, 'research:read_published')).toBe(true)
    }
  })
  it("allows admin", () => {
    expect(can('admin', 'research:read_published')).toBe(true)
  })
  it("allows policy_lead", () => {
    expect(can('policy_lead', 'research:read_published')).toBe(true)
  })
  it("allows research_lead", () => {
    expect(can('research_lead', 'research:read_published')).toBe(true)
  })
  it("allows workshop_moderator", () => {
    expect(can('workshop_moderator', 'research:read_published')).toBe(true)
  })
  it("allows stakeholder", () => {
    expect(can('stakeholder', 'research:read_published')).toBe(true)
  })
  it("allows observer", () => {
    expect(can('observer', 'research:read_published')).toBe(true)
  })
  it("allows auditor", () => {
    expect(can('auditor', 'research:read_published')).toBe(true)
  })
})

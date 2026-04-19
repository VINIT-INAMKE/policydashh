/**
 * Wave 0 RED contract for RESEARCH-07: lifecycle action buttons.
 * Target module: ResearchLifecycleActions component (Plan 27-04 creates).
 *
 * D-14 RBAC: research_lead sees Submit on own drafts only;
 * admin/policy_lead see Approve/Reject on pending_review and Retract on
 * published; stakeholder never sees lifecycle buttons. Reject expands
 * inline rationale; Retract opens AlertDialog. All transitions write to
 * workflowTransitions via the Phase 26 transitionResearch service (R6).
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/src/db', () => ({ db: {} }))

describe('RESEARCH-07: ResearchLifecycleActions RBAC (D-14)', () => {
  it.todo('research_lead viewing own draft: shows "Submit for Review" button')
  it.todo('research_lead viewing own draft: hides "Approve", "Reject", "Retract" buttons')
  it.todo("research_lead viewing another user's draft: hides all lifecycle buttons")
  it.todo('admin viewing pending_review item: shows "Approve" + "Reject" buttons, hides "Retract"')
  it.todo('policy_lead viewing pending_review item: shows "Approve" + "Reject" buttons, hides "Retract"')
  it.todo('admin viewing published item: shows "Retract" button only')
  it.todo('stakeholder: no lifecycle buttons ever visible')
})

describe('RESEARCH-07: Reject inline rationale expand', () => {
  it.todo('clicking "Reject" reveals Textarea + "Submit Rejection" button')
  it.todo('"Submit Rejection" disabled until rationale has ≥1 non-whitespace char')
  it.todo('submitting calls trpc.research.reject with { id, rejectionReason }')
  it.todo('Cancel collapses without mutation')
})

describe('RESEARCH-07: Retract Alert-Dialog', () => {
  it.todo('clicking "Retract" opens Alert-Dialog with required retractionReason textarea')
  it.todo('"Confirm Retract" disabled until reason has ≥1 non-whitespace char')
  it.todo('submitting calls trpc.research.retract with { id, retractionReason }')
})

describe('RESEARCH-07: Workflow transitions written on every transition', () => {
  it.todo('approve calls trpc.research.approve which delegates to transitionResearch (workflowTransitions INSERT before researchItems UPDATE — R6 invariant)')
  it.todo('after mutation, utils.research.getById and utils.research.listTransitions are both invalidated')
})

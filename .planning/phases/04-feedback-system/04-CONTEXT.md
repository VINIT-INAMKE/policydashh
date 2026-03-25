# Phase 4: Feedback System - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Stakeholders can submit structured, traceable feedback on policy sections with full lifecycle management, evidence support, and privacy controls. This includes: structured feedback submission (FB-XXX) tied to sections, feedback types/priority/impact, feedback lifecycle (Submitted → Under Review → Accepted/Rejected → Closed), mandatory decision rationale, evidence attachment, anonymity controls, section-level scoping (stakeholders see only assigned sections), and filtering.

Requirements: FB-01 through FB-10, AUTH-05, AUTH-08, EV-01, EV-02

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from prior phases:
- Drizzle ORM with Neon PostgreSQL (Phase 1)
- tRPC v11 with default-deny middleware via requirePermission() (Phase 1)
- Audit logging via writeAuditLog() on all mutations (Phase 1)
- Policy documents and sections with stable UUIDs (Phase 2)
- Block editor with Tiptap 3 for section content (Phase 3)
- XState 5 recommended for workflow state machines (project research)
- State transition table exists in schema (workflow_transitions from Phase 1)

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

- Feedback is the CORE of PolicyDash — the FB → CR → Section → Version traceability chain starts here
- Human-readable IDs (FB-001, FB-002) are essential for stakeholder communication
- Section-level scoping (AUTH-05) means stakeholders only see sections they're assigned to
- Privacy preferences (AUTH-08) let stakeholders choose anonymous or named attribution
- XState state machines for feedback lifecycle (from project research recommendations)

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>

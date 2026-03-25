# Phase 5: Change Requests - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Policy Leads can create governed change requests from feedback, manage them through a PR-style lifecycle, and link them to affected sections. CR-XXX human-readable IDs, XState lifecycle (Drafting → In Review → Approved → Merged → Closed), CR-to-feedback and CR-to-section linking, atomic merge creating new version, CR closure without merge with rationale.

Requirements: CR-01 through CR-08

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from prior phases:
- XState 5 already installed and pattern established in Phase 4 (feedback machine)
- State transition table (workflow_transitions) exists from Phase 1
- transitionFeedback service pattern from Phase 4 — follow same pattern for CRs
- Human-readable IDs via PostgreSQL nextval() sequence (established in Phase 4 for FB-NNN)
- tRPC with requirePermission() for all procedures
- Audit logging via writeAuditLog() on all mutations

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

- CR workflow is modeled after pull requests: create from feedback → draft changes → review → approve → merge into new version
- Merging a CR atomically creates a new document version (CR-06) — this bridges to Phase 6 (Versioning)
- All feedback items linked to a merged CR are auto-updated to reflect the version they influenced (CR-07)

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>

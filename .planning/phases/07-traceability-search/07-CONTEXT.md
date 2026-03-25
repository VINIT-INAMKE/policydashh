# Phase 7: Traceability & Search - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

The full feedback-to-version traceability chain is visible, queryable, and exportable — proving the platform's core value proposition. Traceability matrix view (FB → CR → Section → Version grid), per-section "What changed and why", per-stakeholder "Your feedback outcomes", full-text search across feedback and policy content, filtering CRs by status/section/feedback, CSV/PDF export.

Requirements: TRACE-01 through TRACE-06, SRCH-01 through SRCH-04

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting.

Key constraints from prior phases:
- FB → CR links in cr_feedback_links table (Phase 5)
- CR → Section links in cr_section_links table (Phase 5)
- CR → Version via mergedVersionId (Phase 5)
- Feedback → Version via resolvedInVersionId (Phase 5)
- All data needed for traceability chain already exists in the database

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

- The traceability matrix is the most visible manifestation of PolicyDash's core value
- Export as CSV/PDF for auditors and governance reporting
- Full-text search likely needs PostgreSQL tsvector or simple ILIKE for v1

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>

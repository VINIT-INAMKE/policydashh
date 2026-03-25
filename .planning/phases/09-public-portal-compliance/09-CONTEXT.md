# Phase 9: Public Portal & Compliance - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Published policies are publicly accessible with full privacy controls, and auditors can review the complete audit trail and export governance evidence packs. Read-only public portal, public changelog, sanitized consultation summaries, PDF export, audit trail viewer with filtering, milestone evidence pack export as ZIP.

Requirements: PUB-01 through PUB-05, AUDIT-04 through AUDIT-06

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion.

Key constraints:
- Published versions exist from Phase 6 (isPublished flag, immutable snapshots)
- Audit log exists from Phase 1 (partitioned, immutable)
- Privacy preferences exist from Phase 4 (AUTH-08)
- PDF export route exists from Phase 7 (traceability CSV/PDF)
- Public routes must NOT require authentication

</decisions>

<code_context>
## Existing Code Insights
Codebase context will be gathered during plan-phase research.
</code_context>

<specifics>
## Specific Ideas
- Public portal is a separate route group (no auth required)
- Sanitized consultation summaries: aggregate feedback by section without exposing stakeholder identities
- Evidence pack ZIP: bundle stakeholder list, feedback matrix, version history, workshop evidence, decision logs
</specifics>

<deferred>
## Deferred Ideas
None.
</deferred>

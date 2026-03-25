# Phase 10: Workshops & Evidence Management - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Workshop Moderators can manage consultation events as first-class entities with artifacts and insight linking, and Research Leads can identify claims lacking evidence. Workshop CRUD, artifact management (promo, recordings, summaries, attendance), section linking, feedback-to-workshop provenance, "claims without evidence" view, evidence metadata.

Requirements: WS-01 through WS-05, EV-03, EV-04

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion.

Key constraints:
- Workshop Moderator dashboard stub exists from Phase 8
- Evidence artifacts + join tables exist from Phase 4
- Uploadthing infrastructure exists from Phase 3
- Workshop permissions defined in Phase 1 constants

</decisions>

<code_context>
## Existing Code Insights
Codebase context will be gathered during plan-phase research.
</code_context>

<specifics>
## Specific Ideas
- Workshops are first-class entities linked to sections and feedback
- "Claims without evidence" = feedback items with no evidence attachments
</specifics>

<deferred>
## Deferred Ideas
None.
</deferred>

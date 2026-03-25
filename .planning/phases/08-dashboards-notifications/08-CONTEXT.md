# Phase 8: Dashboards & Notifications - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Every role has a tailored dashboard showing relevant content and tasks, and users are notified of important events in-app and via email. 7 role-specific dashboards, in-app notifications, email notifications, "what changed since last visit" indicators.

Requirements: UX-01 through UX-07, NOTIF-01 through NOTIF-03

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion.

Key constraints from prior phases:
- 7 roles with defined permissions (Phase 1)
- All data entities exist: policies, sections, feedback, CRs, versions, evidence, workshops (Phases 2-7)
- tRPC with role-based permission checks (Phase 1)
- Clerk auth provider handles user sessions (Phase 1)

</decisions>

<code_context>
## Existing Code Insights
Codebase context will be gathered during plan-phase research.
</code_context>

<specifics>
## Specific Ideas
- Each of 7 roles sees different dashboard content on login
- Policy Lead: feedback inbox, active CRs, section health
- Stakeholder: assigned sections, pending feedback, upcoming workshops, "what changed"
- Admin: user management, publish controls, system overview
- Email notifications via Resend or similar service
</specifics>

<deferred>
## Deferred Ideas
None — discuss phase skipped.
</deferred>

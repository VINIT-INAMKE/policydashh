# Phase 2: Policy Documents & Sections - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Policy Leads can create and structure policy documents with sections that carry stable identities for all downstream workflow references. Multiple policy documents can coexist. Sections have stable UUIDs that persist across all operations. Content is stored as block-based Tiptap JSON. Existing markdown content can be imported.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from prior phases:
- Drizzle ORM with Neon PostgreSQL (established in Phase 1)
- tRPC v11 with default-deny middleware (established in Phase 1)
- Permission checks via requirePermission() on all procedures
- Audit logging via writeAuditLog() on all mutations

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — discuss phase skipped. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>

# Phase 6: Versioning - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Policy documents have a complete version history with diffs, changelogs, and immutable archives so any stakeholder can see exactly what changed and why. Semantic versioning (v0.1, v0.2), auto-generated changelogs with linked feedback IDs, section-level diff view, archived read-only versions, publish to public portal, immutable published snapshots.

Requirements: VER-01 through VER-07

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting.

Key constraints from prior phases:
- document_versions STUB table already exists from Phase 5 (CR merge creates versions)
- Phase 5 mergeCR already creates version records with documentId, versionLabel, mergeSummary, crId
- Need to EXTEND document_versions with: sectionsSnapshot (JSONB), changelog, publishedAt, isPublished
- Section-level diffs should compare stored snapshots, not live content
- Published versions must be immutable (no edits allowed after publish)

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

- Version snapshots should store full section content at time of version creation (for diff comparison)
- Changelog auto-generated from linked CRs and their source feedback items
- Diff algorithm: compare section content JSON between two version snapshots

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>

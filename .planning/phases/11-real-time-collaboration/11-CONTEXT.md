# Phase 11: Real-Time Collaboration - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Multiple users can simultaneously edit the same policy section with live presence awareness and inline discussion via comments. Yjs/Hocuspocus CRDT sync, presence indicators, inline comments anchored to text selections.

Requirements: EDIT-06, EDIT-07, EDIT-08

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion.

Key constraints:
- Tiptap 3 editor exists from Phase 3 (single-user)
- BlockEditor component with useEditor, buildExtensions, auto-save
- Content stored as Tiptap JSON in policySections.content
- Research recommended Yjs + Hocuspocus for real-time sync
- immediatelyRender: false already set on useEditor

</decisions>

<code_context>
## Existing Code Insights
Codebase context will be gathered during plan-phase research.
</code_context>

<specifics>
## Specific Ideas
- Layer Yjs collaboration on existing single-user editor (don't rewrite)
- Hocuspocus server for WebSocket sync
- Presence shows cursor + name of other editors
- Inline comments: select text → comment bubble → threaded discussion
</specifics>

<deferred>
## Deferred Ideas
None.
</deferred>

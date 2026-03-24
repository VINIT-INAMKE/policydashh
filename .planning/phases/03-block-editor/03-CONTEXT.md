# Phase 3: Block Editor - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Users editing policy sections have a Notion-quality block editing experience with all core block types, formatting, and media support. This phase installs Tiptap 3, creates the block editor component with slash commands, drag-and-drop block reordering, rich text formatting, and media embeds. The editor replaces the read-only section content view from Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from prior phases:
- Section content stored as Tiptap JSON (JSONB) in policySections table (Phase 2)
- Read-only renderer exists at src/lib/tiptap-renderer.ts (Phase 2) — editor replaces this for edit mode
- tRPC document router has section CRUD procedures (Phase 2)
- Tiptap 3 chosen as editor (project research STACK.md)
- Real-time collab (Yjs/Hocuspocus) is Phase 11 — this phase is single-user editing only

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

- User explicitly requested "complete notion editing" — slash commands, drag-and-drop, block types are all essential
- Block types from requirements: text, heading (H1-H3), callout, table, toggle/collapsible, quote, divider, code block
- Media support: images, file attachments, rich link previews

</specifics>

<deferred>
## Deferred Ideas

- Real-time collaborative editing (Phase 11)
- Inline comments on selected text (Phase 11)
- Presence indicators (Phase 11)

</deferred>

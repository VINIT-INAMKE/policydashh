# Phase 12: Workshop System Fix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 12-workshop-system-fix
**Areas discussed:** Section picker fix, Feedback picker UI, Duplicate rendering cleanup, DialogTrigger cleanup

---

## Section Picker Fix

### How should the section picker get sections data?

| Option | Description | Selected |
|--------|-------------|----------|
| Expand document.list (Recommended) | Add an include option to document.list so it returns sections when needed. Keeps one endpoint. | ✓ |
| New endpoint: document.listWithSections | Separate query specifically for the picker. Keeps document.list lean but adds API surface. | |
| Lazy-load on expand | Document.list stays lean. When user expands a document, fetch its sections on demand. | |

**User's choice:** Expand document.list (Recommended)
**Notes:** Single endpoint with opt-in sections inclusion.

### What info should show per section in the picker list?

| Option | Description | Selected |
|--------|-------------|----------|
| Title + order number | Minimal — just section title and position. | |
| Title + preview snippet | First ~50 chars of section content as subtitle. | |
| Title + block count + status | Section title, number of content blocks, and status (draft/published). | ✓ |

**User's choice:** Title + block count + status
**Notes:** Provides enough context for informed linking decisions.

---

## Feedback Picker UI

### How should feedback items be displayed in the picker?

| Option | Description | Selected |
|--------|-------------|----------|
| Compact list with author + excerpt | Each row: submitter name, first ~80 chars, date. Multi-select checkboxes. | |
| Card per feedback item | Small cards showing author, excerpt, sentiment/type badge, and date. | ✓ |
| Grouped by section | Feedback items grouped under related section. | |

**User's choice:** Card per feedback item
**Notes:** Visual cards with author, excerpt, type badge, and date.

### Should the feedback picker have search/filter capabilities?

| Option | Description | Selected |
|--------|-------------|----------|
| Search + type filter (Recommended) | Text search across feedback content + filter by feedback type. | ✓ |
| Search only | Simple text search, no filters. | |
| No search | Just a scrollable list. | |

**User's choice:** Search + type filter (Recommended)
**Notes:** Standard search and type filter for finding specific feedback items.

---

## Duplicate Rendering Cleanup

### How should duplicate section/feedback rendering be resolved?

| Option | Description | Selected |
|--------|-------------|----------|
| Detail page owns display (Recommended) | Picker only handles selection/linking. Clean separation. | ✓ |
| Shared item component | Extract shared SectionItem/FeedbackItem used by both. | |
| Picker owns both select + display | Picker handles display on detail page too (read-only mode). | |

**User's choice:** Detail page owns display (Recommended)
**Notes:** Clean separation — picker = select, page = display.

---

## DialogTrigger Cleanup

### How should the orphaned DialogTrigger pattern be fixed?

| Option | Description | Selected |
|--------|-------------|----------|
| Remove internal triggers (Recommended) | Pickers become pure dialog content. Parent owns Dialog + trigger button. | ✓ |
| Pickers own their Dialog fully | Move Dialog state into each picker. Parent just renders picker. | |
| Keep triggers, wire them up | Connect internal DialogTrigger to parent state. Adds prop drilling. | |

**User's choice:** Remove internal triggers (Recommended)
**Notes:** Cleanest separation — parent page owns Dialog, pickers are content-only.

---

## Claude's Discretion

- Exact card layout and spacing for feedback items in picker
- Search debounce timing and filter UI placement
- How to handle includeSections in the document router
- Error states for failed fetches in pickers
- Loading skeleton design for picker dialogs

## Deferred Ideas

None — discussion stayed within phase scope

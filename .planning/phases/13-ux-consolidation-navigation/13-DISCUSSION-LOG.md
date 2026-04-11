# Phase 13: UX Consolidation & Navigation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 13-ux-consolidation-navigation
**Areas discussed:** Breadcrumb design, Tab bar conversion, Feedback view consolidation, Cross-navigation & shortcuts

---

## Breadcrumb Design

### Breadcrumb Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Full depth | Every nesting level shown (Policies / Digital Economy / Section 3 / Feedback) | ✓ |
| Two-level max | Only show parent > current | |
| Context-adaptive | Full depth for policies, two-level for shallow routes | |

**User's choice:** Full depth
**Notes:** Matches route hierarchy exactly.

### Breadcrumb Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Below header bar | Dedicated breadcrumb row below main nav header | ✓ |
| Inside page content | At top of content area per page | |
| Replace back buttons | Breadcrumbs as sole upward-navigation | |

**User's choice:** Below header bar

### Breadcrumb Labels

| Option | Description | Selected |
|--------|-------------|----------|
| Entity names | Real names like "Digital Economy Policy" — requires data fetching | |
| Route labels | Static labels like "Policy Detail" | |
| Hybrid | Entity names where available, route labels as fallback | ✓ |

**User's choice:** Hybrid

### Back Button Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Replace back buttons | Breadcrumbs replace all "Back to X" buttons | ✓ |
| Keep both | Breadcrumbs for orientation, back buttons for quick action | |

**User's choice:** Replace back buttons

---

## Tab Bar Conversion

### Tab Organization

| Option | Description | Selected |
|--------|-------------|----------|
| Tab bar for all sub-pages | Content, Feedback, CRs, Traceability, Versions as horizontal tabs | ✓ |
| Tabs for related pages only | Only group closely related views as tabs | |
| Keep as links, restyle | Restyle as horizontal nav bar, no tab behavior | |

**User's choice:** Tab bar for all sub-pages

### Tab Routing

| Option | Description | Selected |
|--------|-------------|----------|
| Route-based | Each tab maps to existing route, tab bar as shared layout | ✓ |
| Client-side tabs | All content on one page, client-side switching | |

**User's choice:** Route-based

### Tab Access Control

| Option | Description | Selected |
|--------|-------------|----------|
| Role-gated tabs | Only show tabs user has permission to access | ✓ |
| Show all, gate content | All tabs visible, restricted tabs show access denied | |

**User's choice:** Role-gated tabs

---

## Feedback View Consolidation

### Global /feedback Route

| Option | Description | Selected |
|--------|-------------|----------|
| Cross-policy overview | Real page showing feedback from ALL policies, filterable | ✓ |
| Smart redirect | Redirect to most recently active policy's feedback | |
| Remove global /feedback | Drop from nav, feedback always document-scoped | |

**User's choice:** Cross-policy overview

### Sub-route Organization

| Option | Description | Selected |
|--------|-------------|----------|
| Fold into tabs | outcomes and evidence-gaps as tabs within /feedback | ✓ |
| Keep as separate routes | Stay at current URLs | |

**User's choice:** Fold into tabs

### Per-policy Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Keep both | Global overview + per-policy tab coexist | ✓ |
| Global only | Remove per-policy tab, all through /feedback | |

**User's choice:** Keep both

---

## Cross-Navigation & Shortcuts

### Give Feedback Action

| Option | Description | Selected |
|--------|-------------|----------|
| Inline button per section | Button at top/bottom of section content, opens pre-filled form | ✓ |
| Floating action button | Persistent floating button (bottom-right) | |
| Context menu on text selection | Select text → context menu with "Give Feedback" | |

**User's choice:** Inline button per section

### Workspace Nav Items

| Option | Description | Selected |
|--------|-------------|----------|
| Add /users and /notifications | Both added to nav | |
| Add /users only | Notifications redundant with bell icon | |
| Add all + reorganize | Add both and reorganize nav order | ✓ |

**User's choice:** Add all + reorganize

### Workshop Cross-Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Clickable links in workshop detail | Linked sections/feedback are clickable, navigate to target | ✓ |
| Back-links too | Bidirectional: workshop → section AND section → workshops | |
| You decide | Claude picks best approach | |

**User's choice:** Clickable links in workshop detail

### Nav Order

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard, Policies, Feedback, Workshops, Users, Audit | Primary workflow order | ✓ |
| Dashboard, Policies, Feedback, Users, Workshops, Audit | Users before Workshops | |
| You decide | Claude picks based on IA best practices | |

**User's choice:** Dashboard, Policies, Feedback, Workshops, Users, Audit

---

## Claude's Discretion

- Breadcrumb separator style and typography
- Tab bar active/inactive styling
- Mobile responsive behavior for tab bar
- Exact placement of "Give Feedback" button within section content
- Loading states for breadcrumb entity names

## Deferred Ideas

None — discussion stayed within phase scope.

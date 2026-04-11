# Phase 13: UX Consolidation & Navigation - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

App navigation feels coherent with breadcrumbs, tab bars, consolidated views, and the primary user flows (read → feedback → track) take 2-3 clicks instead of 5-6. Includes: breadcrumbs across all nested routes, policy sub-page tab bar navigation, consolidated global feedback view, cross-navigation between workshops and linked sections/feedback, workspace nav reorganization with /users and /notifications, rename uploadthing.ts to r2-upload.ts, and direct "Give Feedback" action from section content view.

</domain>

<decisions>
## Implementation Decisions

### Breadcrumb Design
- **D-01:** Full-depth breadcrumbs showing every nesting level (e.g., Policies / Digital Economy Policy / Section 3 / Feedback)
- **D-02:** Breadcrumbs placed in a dedicated row below the main header bar — consistent across all workspace pages
- **D-03:** Hybrid labels — use entity names where data is already loaded (e.g., policy title, section title), fall back to route labels (e.g., "Feedback", "Versions") where entity data isn't readily available
- **D-04:** Breadcrumbs replace all existing "Back to X" ghost buttons — no redundant navigation elements

### Tab Bar Conversion
- **D-05:** Convert all policy sub-pages to horizontal tab bar: Content (default), Feedback, Change Requests, Traceability, Versions
- **D-06:** Route-based tab navigation — each tab maps to its existing route (/policies/[id]/feedback, etc.). Tab bar is a shared layout component. No client-side tab switching.
- **D-07:** Role-gated tabs — only show tabs the user has permission to access (matching current canViewCR, canViewTrace logic). Stakeholders won't see Change Requests tab, etc.
- **D-08:** Section sidebar remains for the Content tab only

### Feedback View Consolidation
- **D-09:** Global /feedback becomes a real cross-policy overview page showing feedback from ALL policies, filterable by policy, status, type. Admin/policy lead sees everything, stakeholders see their own.
- **D-10:** /feedback/outcomes and /feedback/evidence-gaps fold into tabs within /feedback: [All Feedback] [My Outcomes] [Evidence Gaps]. Tab visibility is role-gated.
- **D-11:** Per-policy feedback tab (/policies/[id]/feedback) stays — serves focused policy-scoped work. Both global and per-policy views coexist.

### Cross-Navigation & Shortcuts
- **D-12:** Inline "Give Feedback" button per section — appears at the top or bottom of section content area. Opens feedback submission form pre-filled with the section reference. 1 click from reading to feedback.
- **D-13:** Workshop detail page: linked sections and feedback items are clickable links navigating directly to /policies/[id]/sections/[sectionId] or feedback detail
- **D-14:** Workspace nav reorganized to: Dashboard, Policies, Feedback, Workshops, Users, Audit. Users link visible to admin/policy_lead only. Audit link visible to admin/auditor (existing logic).
- **D-15:** Notifications stays as bell icon in header only — no nav link added
- **D-16:** Rename uploadthing.ts to r2-upload.ts and update all 5 importing files

### Claude's Discretion
- Breadcrumb separator style and typography
- Tab bar active/inactive styling (use existing tabs.tsx component patterns)
- Mobile responsive behavior for tab bar (scroll vs dropdown)
- Exact placement of "Give Feedback" button within section content (top vs bottom)
- Loading states for breadcrumb entity names

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Key implementation files
- `app/(workspace)/layout.tsx` — Workspace layout with header, nav, and content area (breadcrumb row goes here)
- `app/(workspace)/_components/workspace-nav.tsx` — Current nav component to reorganize
- `app/(workspace)/policies/[id]/page.tsx` — Policy detail page with button links to convert to tab bar
- `app/(workspace)/feedback/page.tsx` — Current redirect-based global feedback (to rewrite as cross-policy overview)
- `app/(workspace)/feedback/outcomes/` — Outcomes sub-route to fold into /feedback tabs
- `app/(workspace)/feedback/evidence-gaps/` — Evidence-gaps sub-route to fold into /feedback tabs
- `app/(workspace)/policies/[id]/feedback/page.tsx` — Per-policy feedback inbox (stays)
- `components/ui/tabs.tsx` — Existing tab component to use for tab bar navigation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ui/tabs.tsx` — Tab component available for both policy tab bar and feedback tab views
- `components/ui/badge.tsx` — Can be used for breadcrumb badges or count indicators
- Phase 7 `?tab=` URL sync pattern — Established approach for tab state in URL query params

### Established Patterns
- WorkspaceNav uses `usePathname()` for active state detection — breadcrumb component can follow same pattern
- Role-gating via `trpc.user.getMe` query on client pages (Phase 4+ pattern)
- Server Component layout fetches user role and passes as prop (workspace layout pattern)
- `canViewCR`, `canViewTrace` permission booleans on policy detail page — reuse for tab visibility

### Integration Points
- Breadcrumb component integrates into `app/(workspace)/layout.tsx` below the header
- Policy tab bar becomes a shared layout in `app/(workspace)/policies/[id]/layout.tsx` (may need to create)
- "Give Feedback" button integrates into `SectionContentView` component
- Global feedback page reuses `FeedbackInbox` component with cross-policy data source
- uploadthing.ts rename affects: `block-editor.tsx`, `image-block-view.tsx`, `file-attachment-view.tsx`, `evidence-attachment.tsx`, `artifact-attach-dialog.tsx`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 13-ux-consolidation-navigation*
*Context gathered: 2026-04-12*

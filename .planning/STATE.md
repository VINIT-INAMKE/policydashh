---
gsd_state_version: 1.0
milestone: v0.1
milestone_name: milestone
status: Ready to execute
stopped_at: Completed 08-02-PLAN.md
last_updated: "2026-03-25T09:56:25.265Z"
progress:
  total_phases: 11
  completed_phases: 7
  total_plans: 23
  completed_plans: 22
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-25)

**Core value:** Every piece of stakeholder feedback is traceable from submission through to the policy version it influenced -- or recorded with rationale for why it wasn't adopted.
**Current focus:** Phase 08 — Dashboards & Notifications

## Current Position

Phase: 08 (Dashboards & Notifications) — EXECUTING
Plan: 3 of 3

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01-foundation-auth P01 | 8min | 2 tasks | 15 files |
| Phase 01-foundation-auth P02 | 7min | 2 tasks | 15 files |
| Phase 01-foundation-auth P03 | 6min | 2 tasks | 7 files |
| Phase 02 P01 | 5min | 2 tasks | 11 files |
| Phase 02 P02 | 13min | 2 tasks | 20 files |
| Phase 02 P03 | 18min | 3 tasks | 9 files |
| Phase 03-block-editor P01 | 7min | 2 tasks | 7 files |
| Phase 03 P02 | 9min | 3 tasks | 8 files |
| Phase 03-block-editor P03 | 6min | 2 tasks | 11 files |
| Phase 04-feedback-system P03 | 8min | 2 tasks | 8 files |
| Phase 04 P02 | 15min | 2 tasks | 17 files |
| Phase 05-change-requests P01 | 6min | 2 tasks | 12 files |
| Phase 05-change-requests P03 | 6min | 2 tasks | 9 files |
| Phase 06 P01 | 9min | 2 tasks | 11 files |
| Phase 06-versioning P02 | 11min | 2 tasks | 10 files |
| Phase 07-traceability-search P02 | 12min | 2 tasks | 7 files |
| Phase 08 P01 | 19min | 2 tasks | 13 files |
| Phase 08 P02 | 18min | 2 tasks | 11 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 11-phase build following core pipeline: Foundation -> Documents -> Editor -> Feedback -> CRs -> Versioning -> Traceability -> Dashboards -> Public Portal -> Workshops -> Collaboration
- [Roadmap]: Audit logging infrastructure ships in Phase 1, first write operations in Phase 4 produce audit entries
- [Roadmap]: Single-user editor (Phase 3) before real-time collaboration (Phase 11) per research recommendation
- [Roadmap]: Section-level scoping enforcement deferred to Phase 4 where it becomes observable with feedback
- [Phase 01-foundation-auth]: Hand-written initial migration for partition DDL (Drizzle cannot generate PARTITION BY RANGE)
- [Phase 01-foundation-auth]: Composite PK on audit_events (id, timestamp) required for PostgreSQL partitioned tables
- [Phase 01-foundation-auth]: Phone-first auth: users.phone is primary, users.email is optional (Clerk phone-only auth)
- [Phase 01-foundation-auth]: tRPC v11 uses createTRPCReact (not createReactTRPCContext) and t.createCallerFactory (not @trpc/server export)
- [Phase 01-foundation-auth]: Phone-only auth configured in Clerk Dashboard settings, not in code-level component props
- [Phase 01-foundation-auth]: proxy.ts uses default export per Next.js 16 convention; Clerk clerkMiddleware returns NextMiddleware compatible with this
- [Phase 01-foundation-auth]: Phone invite uses clerk.users.createUser (not invitations API which only supports email)
- [Phase 01-foundation-auth]: Every tRPC mutation writes audit log via writeAuditLog -- no publicProcedure in application routers
- [Phase 02]: Sequential updates for section reorder instead of transactions (Neon HTTP driver compatibility)
- [Phase 02]: Empty Tiptap doc as default section content; markdown preamble auto-creates Introduction section
- [Phase 02]: Toaster imported from sonner directly (not shadcn wrapper) to avoid next-themes ThemeProvider requirement
- [Phase 02]: WorkspaceNav extracted as client component for usePathname active state in server layout
- [Phase 02]: shadcn base-nova style uses @base-ui/react (not Radix) as default primitives
- [Phase 02]: tRPC serializes dates as strings; section UI interfaces use string types for createdAt/updatedAt
- [Phase 02]: Base-ui DropdownMenuTrigger uses native props instead of Radix asChild pattern in shadcn v4
- [Phase 03-block-editor]: CodeBlockLowlight registers as 'codeBlock' not 'codeBlockLowlight' in Tiptap extension name
- [Phase 03-block-editor]: Zod v4 requires z.record(z.string(), z.unknown()) -- single-arg z.record(z.unknown()) crashes
- [Phase 03-block-editor]: lowlight v3 createLowlight(common) provides ~35 languages; no manual registration needed
- [Phase 03-block-editor]: No audit log for updateSectionContent -- high-frequency saves; Phase 6 versioning as audit
- [Phase 03]: Callout.extend() used to add ReactNodeViewRenderer in block-editor rather than modifying headless callout-node.ts
- [Phase 03]: Portal-based slash command menu via createPortal + clientRect instead of tippy.js (not installed)
- [Phase 03]: Auto-save fires on every editor update with 1.5s debounce, flushes on blur
- [Phase 03-block-editor]: ext.extend({ addNodeView }) in block-editor.tsx for all media NodeViews, keeping lib/ extensions React-free
- [Phase 03-block-editor]: FileAttachment custom atom node created for file uploads (no @tiptap/extension-file-attachment exists)
- [Phase 04-feedback-system]: Base-ui Dialog primitive used directly for sheet panel (slide-in from right) instead of shadcn Sheet wrapper
- [Phase 04-feedback-system]: listTransitions query added to feedback router for decision log data from workflowTransitions table
- [Phase 04-feedback-system]: canTriage defaults to true client-side; server-side requirePermission on mutations is real guard
- [Phase 04-feedback-system]: Evidence placeholder in submit form (Option A) -- evidence requires feedbackId, attach post-submission
- [Phase 04-feedback-system]: render prop pattern for Button-as-anchor (base-nova uses render, not asChild)
- [Phase 04]: Select.Root.Props requires generic type argument in base-ui -- typed as string for feedback select components
- [Phase 04]: Client-side multi-filter for checkbox groups (server API accepts single value; client filters for multi-select)
- [Phase 04]: Outcomes page uses inline accordion pattern for decision log (click to expand, no separate page)
- [Phase 05-change-requests]: documentVersions defined before changeRequests in schema to allow mergedVersionId FK without forward-reference
- [Phase 05-change-requests]: resolvedInVersionId on feedback as plain uuid (no .references()) to avoid circular import; FK in SQL migration only
- [Phase 05-change-requests]: mergeCR uses db.transaction for atomic version create + CR update + feedback bulk-update + transition log
- [Phase 05-change-requests]: getNextVersionLabel parses v0.N pattern from documentVersions table; defaults to v0.1 for first version
- [Phase 05-change-requests]: Import Phase 4 StatusBadge directly for feedback status in LinkedFeedbackList (visual consistency)
- [Phase 05-change-requests]: CRDecisionLog encapsulated data fetching via useQuery rather than props pattern
- [Phase 06]: getNextVersionLabel moved to version.service.ts with backward-compat re-export from changeRequest.service.ts
- [Phase 06]: computeSectionDiff uses JSON.stringify content comparison + diffWords for word-level diff
- [Phase 06]: Published versions immutable: publishVersion idempotent (returns as-is if already published)
- [Phase 06]: version:read includes STAKEHOLDER role for section-scoped version history access
- [Phase 06-versioning]: canManage defaults true client-side (Phase 4 pattern); server enforces version:manage and version:publish
- [Phase 06-versioning]: Inline word-level diff rendering for both desktop and mobile; two-column header on desktop only
- [Phase 07-traceability-search]: Tab state synced to URL query param ?tab= for direct linking and browser back/forward
- [Phase 07-traceability-search]: Client-side multi-filter pattern reused from Phase 4: server accepts single value, client filters for multi-select
- [Phase 07-traceability-search]: workspace-nav.tsx unchanged: traceability is document-scoped, no global nav pattern for per-policy pages
- [Phase 07-traceability-search]: Phase 4 outcomes page preserved: Phase 7 By Stakeholder tab is document-scoped extension, not replacement
- [Phase 08]: Notification inserts are fire-and-forget outside transaction boundaries; email sends gracefully no-op when RESEND_API_KEY missing or user email null
- [Phase 08]: Plain text emails for now; React Email templates can be enhanced later with @react-email/components
- [Phase 08]: No audit log for markRead/markAllRead/updateLastVisited (operational, not business events)
- [Phase 08]: Role-switch via switch in async Server Component; each dashboard does direct DB queries with Promise.all
- [Phase 08]: Workshop Moderator dashboard is explicit stub (Phase 10); Auditor View Full Audit Trail disabled (Phase 9)
- [Phase 08]: NotificationBell: tRPC client hooks with 10s refetchInterval for unread count; popover list only fetched when open

### Pending Todos

None yet.

### Blockers/Concerns

- Research flags Tiptap 3 custom section node patterns may need deeper investigation during Phase 2/3 planning
- Hocuspocus deployment topology (separate from Vercel) needs early validation in Phase 3
- Clerk 7-role to 3-4 Clerk Organization role mapping must be decided explicitly in Phase 1

## Session Continuity

Last session: 2026-03-25T09:56:25.252Z
Stopped at: Completed 08-02-PLAN.md
Resume file: None

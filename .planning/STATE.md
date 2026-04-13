---
gsd_state_version: 1.0
milestone: v0.2
milestone_name: verifiable-policy-os
status: Defining requirements
stopped_at: —
last_updated: "2026-04-13T00:00:00.000Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-13)

**Core value:** Every piece of stakeholder feedback is traceable from submission through to the policy version it influenced -- or recorded with rationale for why it wasn't adopted.
**Current focus:** Milestone v0.2 — Verifiable Policy OS — Public Consultation & On-Chain Anchoring (defining requirements)

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-13 — Milestone v0.2 started

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
| Phase 08 P03 | 14min | 2 tasks | 7 files |
| Phase 09 P02 | 15min | 2 tasks | 14 files |
| Phase 09 P01 | 17min | 2 tasks | 15 files |
| Phase 10 P01 | 4min | 2 tasks | 8 files |
| Phase 10 P03 | 3min | 1 tasks | 3 files |
| Phase 11 P01 | 19min | 2 tasks | 18 files |
| Phase 11 P02 | 8min | 2 tasks | 6 files |
| Phase 11-real-time-collaboration P03 | 8min | 3 tasks | 5 files |
| Phase 12-workshop-system-fix P01 | 3min | 2 tasks | 3 files |
| Phase 12-workshop-system-fix P02 | 7min | 2 tasks | 2 files |
| Phase 13-ux-consolidation-navigation P02 | 11min | 2 tasks | 3 files |
| Phase 13 P05 | 25m | 2 tasks | 4 files |
| Phase 13-ux-consolidation-navigation P04 | 2min | 2 tasks | 7 files |
| Phase 13-ux-consolidation-navigation P03 | 4min | 3 tasks | 4 files |

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
- [Phase 08]: React Query v5 removed onSuccess from useQuery; used useEffect + ref pattern for load-more pagination
- [Phase 09]: actorRole filter added to auditRouter.list for server-side audit trail filtering
- [Phase 09]: WorkspaceNav takes userRole prop from layout for conditional nav items
- [Phase 09]: Evidence pack always anonymizes stakeholder names for compliance export
- [Phase 09]: Tiptap HTML renderer is a pure string-concatenation function with no React dependencies
- [Phase 09]: Public portal uses (public) route group with zero Clerk/auth imports, standalone layout
- [Phase 09]: Privacy enforcement: unconditionally null identity for anonymous on public routes, never render CR/feedback IDs in changelog
- [Phase 10]: Ownership check on workshop update/delete: creator or admin only
- [Phase 10]: onConflictDoNothing for idempotent workshop section/feedback linking
- [Phase 10]: removeArtifact preserves evidenceArtifacts record; only deletes workshop link
- [Phase 10]: Client-side multi-filter for evidence-gaps page (fetch all, filter locally) matching Phase 4 pattern
- [Phase 10]: Role-gated client page via trpc.user.getMe with router.replace redirect for evidence-gaps
- [Phase 11]: Hocuspocus runs as standalone Node.js process (hocuspocus-server/) not inside Next.js -- Vercel cannot hold WebSocket connections
- [Phase 11]: Y.Doc persistence uses BYTEA custom type for binary Uint8Array storage, not JSON reconstruction
- [Phase 11]: InlineComment mark always included in buildExtensions (not gated on collaboration) -- comments work in single-user mode
- [Phase 11]: JSON bootstrap from policySections.content happens once in onLoadDocument when Y.Doc is empty (first-time migration)
- [Phase 11]: Auto-save disabled when collaboration is active AND connected; re-enables on disconnect (offline fallback)
- [Phase 11]: Content prop skipped when collaboration active -- Yjs document is sole source of truth
- [Phase 11]: PresenceBar hidden when only current user present -- no visual noise in single-user mode
- [Phase 11-real-time-collaboration]: CommentBubble uses manual selection detection (selectionUpdate + getBoundingClientRect) rather than Tiptap BubbleMenu for positioning control
- [Phase 11-real-time-collaboration]: Comment anchor highlighting via CSS class on EditorContent rather than ProseMirror decoration plugin -- mark already renders .inline-comment-mark class
- [Phase 12-workshop-system-fix]: Optional includeSections parameter preserves backward compatibility for all existing document.list callers
- [Phase 12-workshop-system-fix]: Pure dialog content pattern: picker components render only Dialog+DialogContent, parent owns trigger and state
- [Phase 12-workshop-system-fix]: listAll guarded by workshop:manage (not feedback:read_all) so workshop moderators can access feedback for linking
- [Phase 13-ux-consolidation-navigation]: Breadcrumb uses null-label sentinel for loading state (renders Skeleton); entity detection limited to segments[1] under /policies and /workshops to avoid stray tRPC queries on deep UUID paths
- [Phase 13-ux-consolidation-navigation]: Workspace layout refactored to flex h-screen flex-col with shrink-0 header/breadcrumb and flex-1 overflow-y-auto main -- enables Plan 03 policy tab bar without hardcoded pixel offsets
- [Phase 13]: Plan 13-05: feedback:submit permission derived from src/lib/permissions.ts (stakeholder, research_lead, workshop_moderator). Give Feedback CTA hidden during edit mode.
- [Phase 13-ux-consolidation-navigation]: Plan 13-04: Role gating consolidated at GlobalFeedbackTabs level via server-fetched canSeeAll/canSeeEvidenceGaps props; tab components skip their own role checks
- [Phase 13-ux-consolidation-navigation]: Plan 13-04: Legacy /feedback/outcomes and /feedback/evidence-gaps redirect to /feedback?tab= URLs to preserve old notification deep links
- [Phase 13-ux-consolidation-navigation]: Plan 13-03: PolicyTabBar uses plain nav+Link (not base-ui Tabs) per Research Pitfall 3 to avoid route/state fight; role gating computed in server layout; content h-full with min-h-0 flex-1 shell leveraging Plan 02's flex-column chain

### Pending Todos

None yet.

### Roadmap Evolution

- Phase 12 added: Workshop System Fix — fix broken section/feedback linking, duplicate UI, orphaned triggers
- Phase 13 added: UX Consolidation & Navigation — breadcrumbs, tabs, feedback view consolidation, cross-nav, rename uploadthing.ts

### Blockers/Concerns

- Research flags Tiptap 3 custom section node patterns may need deeper investigation during Phase 2/3 planning
- Hocuspocus deployment topology (separate from Vercel) needs early validation in Phase 3
- Clerk 7-role to 3-4 Clerk Organization role mapping must be decided explicitly in Phase 1

## Session Continuity

Last session: 2026-04-12T07:18:07.856Z
Stopped at: Completed 13-03-PLAN.md
Resume file: None

# Phase 1: Foundation & Auth - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the complete project scaffolding: Next.js 16 App Router with Clerk auth, Drizzle ORM + Neon PostgreSQL, tRPC API layer with default-deny RBAC middleware, and an immutable partitioned audit log. Users can sign up, log in, receive role assignments, and be invited by admin. All API endpoints enforce permission checks from day one. This phase produces zero user-facing features beyond auth — it's the foundation everything else builds on.

</domain>

<decisions>
## Implementation Decisions

### Auth & Role Architecture
- **Phone number only** for signup/login via Clerk (no email auth)
- Roles modeled via Clerk publicMetadata + mirrored in Drizzle users table for queryability
- Invite flow uses Clerk Invitations API with phone number — admin creates invite with role in metadata, user arrives pre-configured
- Org type (Government, Industry, Legal, Academia, Civil Society, Internal) stored in app DB users table only (not Clerk)
- Session validation via Clerk middleware + tRPC context — Clerk middleware validates JWT, tRPC context extracts user+role for every procedure

### Database & Schema Foundation
- Neon PostgreSQL for hosting (serverless, branching for dev, Drizzle first-class support)
- Drizzle Kit push for dev, generate + migrate for production deployments
- Audit log partitioned monthly from day one — auto-create partitions
- State transition table pattern: `workflow_transitions(id, entity_type, entity_id, from_state, to_state, actor_id, timestamp)` alongside status columns for all workflow entities

### API & Middleware Architecture
- tRPC v11 for API layer — end-to-end type safety, middleware chains for auth/RBAC/audit
- Default-deny enforcement via tRPC middleware chain: auth → role check → audit. No procedure accessible without explicit permission declaration
- Project scaffolded with create-next-app + manual setup (Next.js 16 App Router, add Drizzle/tRPC/Clerk/Tailwind incrementally)
- Deployment target: Vercel (first-class Next.js support, edge middleware for Clerk)

### Claude's Discretion
- Exact Drizzle schema column types and indexes
- tRPC router organization (flat vs nested)
- Tailwind/shadcn configuration details
- Test setup and tooling choices

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, clean directory

### Established Patterns
- None yet — this phase establishes all patterns

### Integration Points
- Clerk webhook endpoint needed for invite acceptance sync
- tRPC client setup in Next.js App Router (React Server Components + client components)
- Drizzle schema as single source of truth for all database types

</code_context>

<specifics>
## Specific Ideas

- Research recommended XState 5 for workflow state machines — but that's Phase 4+. This phase should lay the transition table schema that XState will write to later.
- Pitfalls research flagged: "Clerk handles auth but NOT content-level scoping" — section-level RBAC is Phase 4, but the permission framework must be extensible for it.
- Research flagged: default-deny is critical — previous attempt defaulted to ALLOW and had security holes.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

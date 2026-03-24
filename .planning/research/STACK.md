# Stack Research

**Domain:** Stakeholder Policy Consultation Platform
**Researched:** 2026-03-25
**Confidence:** HIGH (core stack) / MEDIUM (some supporting libraries)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.2 | Full-stack React framework | Current stable release (March 2026). Turbopack stable by default for 50%+ faster builds. React Compiler built-in for automatic memoization. App Router with RSC for initial load performance on the public portal. Cache Components + PPR for instant navigation. The previous PolicyDash attempt already used Next.js -- the team has familiarity. |
| React | 19 | UI library | Ships with Next.js 16. Required for React Compiler, `use` hook, Server Components, and Server Actions. |
| TypeScript | 5.7+ | Type safety | Required by XState v5, Tiptap 3, and Drizzle ORM for full type inference. Catches RBAC and workflow bugs at compile time. Non-negotiable for a system where traceability and correctness matter. |
| PostgreSQL | 16+ | Primary database | Relational model fits the FB->CR->Section->Version traceability chain perfectly. JSONB for block editor document storage. Strong audit/compliance story. Row-level security available when multi-tenant comes later. |
| Neon | (managed) | Serverless PostgreSQL hosting | Native Vercel integration (powers Vercel Postgres). Serverless driver works without configuration. Database branching for preview environments. Scale-to-zero on free tier for development. Separates compute/storage for cost efficiency. Choose over Supabase because PolicyDash doesn't need a BaaS -- we're assembling a custom stack with Clerk auth and Drizzle ORM. |

### Block Editor & Real-Time Collaboration

This is the most architecturally significant decision. The choice here shapes 40%+ of the codebase.

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Tiptap | 3.20.x | Headless block editor framework | **Use Tiptap, not BlockNote.** Tiptap 3 is stable with 9M+ monthly npm downloads. PolicyDash needs deep customization: custom block types for policy sections with stable identity, section-level metadata, inline comment anchors, and custom slash commands for feedback/CR linking. BlockNote (0.47.x) is built ON TOP of Tiptap+ProseMirror -- it adds a convenient abstraction but locks you out of the control needed here. PolicyDash is not a generic note-taking app; the editor IS the product. Tiptap's headless architecture means full control over UI, data layer, and security model. Tiptap 3 adds enhanced TypeScript support, SSR, JSX, and unified extension packages (e.g. TableKit). |
| Yjs | 13.6.x | CRDT engine for real-time collaboration | Industry standard CRDT library. 900K+ weekly downloads. Powers Google-Docs-level collaboration. Open source (MIT), self-hostable, no vendor lock-in. Works with Tiptap via `@tiptap/extension-collaboration`. Offline-first capability built in. |
| Hocuspocus | 2.x | Yjs WebSocket server | Purpose-built Yjs WebSocket backend by the Tiptap team. MIT licensed. Self-hostable. Provides auth hooks, persistence hooks (store Yjs docs to PostgreSQL), and scales with room-based architecture. Avoids paying for Tiptap Cloud or Liveblocks. Use over raw `y-websocket` because Hocuspocus adds authentication, persistence, and lifecycle hooks out of the box. |
| @tiptap/extension-collaboration | 3.x | Tiptap <-> Yjs bridge | Official binding between Tiptap and Yjs. Handles Y.Doc synchronization, awareness (cursor positions), and collaborative undo/redo. |

**Why NOT Liveblocks:** Liveblocks is a managed service with per-seat/per-room pricing. PolicyDash has diverse stakeholder types (government, industry, academia) with varying engagement levels. A per-seat model becomes expensive quickly. Liveblocks also doesn't allow self-hosting or customizing CRDT behavior, which matters for the document versioning workflow where we need to snapshot Y.Doc state to create immutable versions.

**Why NOT BlockNote:** BlockNote (0.47.x) is pre-1.0 and built on top of Tiptap+ProseMirror. It provides a Notion-like experience faster for simple use cases but introduces a third abstraction layer. PolicyDash requires: (1) custom block types for policy sections with stable IDs across versions, (2) custom marks for feedback anchors, (3) custom serialization for diff views, (4) control over the document schema for audit logging. BlockNote's opinionated block model makes these harder, not easier. If you know you need ProseMirror-level control eventually, start with Tiptap.

**Why NOT Novel:** Novel is a thin wrapper around Tiptap optimized for blog-style AI writing. No real collaboration story. Wrong tool for this job.

### Authentication & Authorization

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Clerk | latest | Auth provider + user management | **Use Clerk, not Auth0.** Purpose-built for Next.js with drop-in `<SignIn/>`, `<UserButton/>` components that work with Server Components, middleware, and edge runtime from day one. 50K free MAUs (expanded Feb 2026). Organizations feature provides the workspace/tenant model needed for multi-tenant later. Custom Roles (up to 10) and fine-grained Permissions via the Backend API cover the 7 PolicyDash roles. SOC 2 Type II certified. 5-minute setup vs days/weeks for Auth0. |

**RBAC architecture note:** Clerk Organizations handles the role layer (Admin, Policy Lead, Research Lead, etc.) but section-level scoping (stakeholders see only assigned sections) must be implemented in the application layer. Store section-access grants in PostgreSQL (`section_assignments` table) and check both Clerk role AND section assignment in middleware/API routes. Clerk's `publicMetadata` can cache section IDs for fast client-side checks, with the DB as source of truth.

**Why NOT Auth0:** Auth0's Next.js SDK v4 is still in beta for Next.js 16 (requires `--legacy-peer-deps`). Enterprise-grade but over-engineered for a startup-phase product. More expensive, slower to integrate, and the organization/RBAC model requires more custom code. Auth0 makes sense when you need enterprise SSO federation (SAML/OIDC with corporate IdPs) -- PolicyDash doesn't need this now.

### Database & ORM

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Drizzle ORM | 0.45.x | TypeScript ORM / query builder | **Use Drizzle, not Prisma.** Zero codegen -- type changes are instant. ~7.4KB bundle, zero binary dependencies, no Rust engine overhead. SQL-first API ("if you know SQL, you know Drizzle") gives precise control for complex traceability queries (FB->CR->Section->Version joins). 14x lower latency on complex joins vs ORMs with N+1 problems. Interactive migration rename detection solves a long-standing Prisma pain point. Drizzle is heading to 1.0 (beta available). For PolicyDash's audit log queries and traceability matrix, SQL control is essential -- Prisma's abstraction would fight us. |
| Drizzle Kit | 0.45.x | Migration tooling | Auto-generates SQL migrations from schema changes. Interactive CLI for renames. Pairs with drizzle-orm. |

**Why NOT Prisma:** Prisma 7 (late 2025) removed the Rust engine and improved significantly, but still requires codegen (`prisma generate`), has a larger footprint, and its abstraction layer makes complex multi-table joins harder to optimize. PolicyDash's traceability matrix view requires joining feedback, change requests, sections, and versions with filtering by stakeholder type, section, and decision outcome. Drizzle's SQL-first approach handles this naturally. Also: the previous PolicyDash attempt used Prisma -- switching to Drizzle avoids carrying over assumptions from the failed architecture.

### State Management

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| XState | 5.28.x | Workflow state machines | Models feedback lifecycle (Submitted->Under Review->Accepted/Partially/Rejected->Closed) and CR lifecycle (Drafting->In Review->Approved->Merged->Closed) as formal statecharts. Type-safe with TypeScript 5+. Visual editor at stately.ai for designing/debugging machines. Actor model enables composing machines (e.g., CR machine spawns child feedback review actors). Guards enforce business rules (e.g., "cannot merge CR without at least one approved feedback"). Persisted state snapshots enable audit logging of every state transition. |
| @xstate/react | 6.1.x | XState React bindings | `useMachine` and `useActor` hooks for connecting state machines to UI components. |
| Zustand | 5.0.x | Client-side UI state | Lightweight (< 1KB) store for UI state that doesn't belong in state machines: sidebar open/closed, active filters, selected section, notification toasts. NOT for workflow state -- XState handles that. Use Zustand for the 90% of UI state that is simple toggle/filter/selection patterns. |
| TanStack Query | 5.x | Server state / data fetching | Handles caching, background refetch, optimistic updates, and pagination for all API data. Hybrid pattern: RSC for initial loads (public portal, dashboard), TanStack Query for interactive client-side data (feedback list filtering, real-time status updates, infinite scroll). Suspense integration with `useSuspenseQuery` for streaming SSR. |

### UI & Styling

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Tailwind CSS | 4.1 | Utility-first CSS | Ships with Next.js 16. Oxide engine (Rust) for faster builds. CSS-only config via `@theme` -- no `tailwind.config.js`. Required by shadcn/ui. |
| shadcn/ui | CLI v4 | UI component library | Not a dependency -- copies components into your project. Full Tailwind v4 + React 19 compatibility. Radix UI primitives underneath for accessibility (WCAG). `data-slot` attributes for styling. Provides Dialog, Table, Dropdown, Command, Sheet, Tabs, Badge, and other components PolicyDash needs. Avoids vendor lock-in since you own the component code. |
| Radix UI | (via shadcn) | Accessible primitives | Headless, unstyled accessible components. Comes through shadcn/ui. Handles keyboard navigation, focus management, screen reader support for RBAC dropdowns, modal dialogs, menus. |
| Lucide React | latest | Icon library | Default icon set for shadcn/ui. Consistent, tree-shakeable SVG icons. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @react-pdf/renderer | 4.3.x | PDF generation | Export published policy versions and milestone evidence packs as PDF. React component API for defining PDF layouts. Works server-side in API routes. |
| papaparse | 5.x | CSV parsing/generation | Export traceability matrix and feedback data as CSV. Lightweight, battle-tested. Use `papaparse` directly (not `react-papaparse` which hasn't been updated in 2 years). |
| diff | 7.x (jsdiff) | Text diffing | Generate diffs between policy section versions. Use `diffWords` or `diffLines` for human-readable diff output. Powers the version comparison view. Lighter and more appropriate than google's diff-match-patch for structured section content. |
| react-diff-viewer-continued | 3.x | Diff visualization UI | Renders side-by-side or unified diff views in React. Used for the version comparison feature. Fork of react-diff-viewer with active maintenance and JSON diff support. |
| Zod | 3.x | Schema validation | Runtime validation for API inputs, form data, and webhook payloads. Pairs with TypeScript for end-to-end type safety. Use with Drizzle for form validation matching DB schema. |
| nuqs | 2.x | URL search params state | Type-safe URL query parameter management for filter state (feedback list, traceability matrix filters). Keeps filter state in URL for shareability and back-button support. |
| date-fns | 4.x | Date utilities | Lightweight, tree-shakeable date formatting and manipulation. For audit log timestamps, version dates, workshop scheduling. Use over dayjs or moment. |
| Uploadthing | latest | File uploads | Evidence artifact and document file uploads. Handles S3 under the hood without IAM/CORS configuration. Type-safe file routes. Works with Next.js App Router. Use for the evidence/file management feature. |
| Resend | latest | Transactional email | Invite emails, feedback status notifications, CR review requests. Developer-friendly API, React email templates. Free tier of 3K emails/month. |
| Sonner | latest | Toast notifications | Accessible toast notifications for action confirmations, errors. Default toast component in shadcn/ui. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Turbopack | Bundler (Next.js 16 default) | Stable in Next.js 16. Used for both dev and build. No configuration needed. |
| ESLint 9 | Linting | Flat config format. Use `@next/eslint-plugin-next` for Next.js rules. |
| Prettier | Code formatting | With `prettier-plugin-tailwindcss` for class sorting. |
| Vitest | Unit/integration testing | Fast, Vite-based test runner. Compatible with React Testing Library. Use over Jest for speed. |
| Playwright | E2E testing | Cross-browser E2E testing. Critical for testing collaborative editing (multi-tab/multi-user scenarios), workflow transitions, and RBAC enforcement. |
| Drizzle Studio | Database GUI | Built into `drizzle-kit`. Visual database browser during development. |
| Stately Visual Editor | XState machine design | Web-based visual editor at stately.ai for designing and debugging state machines. Export machines directly to code. |

## Installation

```bash
# Core framework
npm install next@latest react@latest react-dom@latest

# Editor & Collaboration
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-collaboration @tiptap/pm yjs @hocuspocus/provider
# Hocuspocus server (separate process or API route)
npm install @hocuspocus/server

# Auth
npm install @clerk/nextjs

# Database
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit

# State Management & Data Fetching
npm install xstate @xstate/react zustand @tanstack/react-query

# UI
npm install tailwindcss @tailwindcss/postcss
npx shadcn@latest init
npm install lucide-react

# Validation
npm install zod

# Supporting
npm install @react-pdf/renderer papaparse diff react-diff-viewer-continued
npm install nuqs date-fns uploadthing @uploadthing/react
npm install resend sonner

# Dev dependencies
npm install -D typescript @types/react @types/node
npm install -D eslint @next/eslint-plugin-next prettier prettier-plugin-tailwindcss
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D playwright @playwright/test
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Tiptap 3 | BlockNote 0.47.x | If you want a Notion-like editor in days, not weeks, and don't need custom block schemas, section-level identity, or deep serialization control. Good for internal tools or note-taking apps. |
| Tiptap 3 | Lexical (Meta) | If you're building a social media-style editor with mentions, hashtags, and embed-heavy content. Lexical has a different architecture (not ProseMirror-based) and a smaller extension ecosystem. |
| Yjs + Hocuspocus | Liveblocks | If you want zero infrastructure management and are OK with per-seat pricing. Good for collaborative design tools (Figma-like) where the collaboration IS the product and you don't need document versioning snapshots. |
| Yjs + Hocuspocus | Tiptap Cloud | If budget allows and you want managed collaboration infrastructure from the Tiptap team. Removes the need to run Hocuspocus yourself. Consider when team grows past 3 engineers and ops burden matters. |
| Clerk | Auth0 | If you need enterprise SAML/OIDC federation with corporate identity providers (Active Directory, Okta). Auth0's strength is complex identity federation -- overkill for PolicyDash now but relevant if enterprise orgs demand it later. |
| Clerk | Better Auth | If you want fully self-hosted auth with no SaaS dependency. More work to set up but zero ongoing cost and full data sovereignty. Consider if government stakeholders require on-premise auth. |
| Drizzle | Prisma 7 | If your team already knows Prisma and the traceability queries turn out to be simpler than expected. Prisma 7 removed the Rust engine and improved performance. The codegen step is still slower for iteration. |
| Neon | Supabase | If you want an integrated BaaS with auth, real-time subscriptions, and storage built in. Since PolicyDash uses Clerk for auth and custom APIs for everything else, Supabase's extras are redundant and add coupling. |
| XState 5 | Custom state machine | If the only workflow is a simple linear status progression. XState's power shows in parallel states, guards, and composed actors -- overkill for a 4-step linear flow, essential for PolicyDash's interconnected FB/CR workflows with conditional transitions and guard clauses. |
| Zustand 5 | Jotai 2 | If your UI has deeply nested, interdependent atomic state (like a spreadsheet). Jotai's atomic model excels there. For PolicyDash's relatively flat UI state (filters, sidebar, selections), Zustand's centralized store is simpler. |
| TanStack Query 5 | SWR | If you only need basic data fetching with caching. SWR is lighter but lacks mutations, optimistic updates, and the suspense integration depth that TanStack Query provides. PolicyDash needs all of these. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Novel.sh | Thin Tiptap wrapper for AI blog writing. No collaboration, no custom blocks, no real extensibility. | Tiptap 3 directly |
| Slate.js | Abandoned by Notion (they built their own). Unstable API, breaking changes, smaller ecosystem than ProseMirror/Tiptap. | Tiptap 3 |
| Draft.js | Deprecated by Meta. Replaced by Lexical. No updates since 2022. | Tiptap 3 |
| CKEditor / TinyMCE | Legacy rich text editors. Not block-based. Notion-style UX impossible without fighting the framework. Licensing costs. | Tiptap 3 |
| Prisma (as first choice) | Codegen step slows iteration. Abstraction fights complex joins. Previous PolicyDash failure used Prisma -- fresh start means fresh tooling. | Drizzle ORM |
| Redux / Redux Toolkit | Massive boilerplate for what PolicyDash needs. Zustand does the same with 1/10th the code. Redux only makes sense for very large teams with strict conventions. | Zustand 5 for UI state, XState 5 for workflows |
| NextAuth.js / Auth.js | Requires building your own UI, managing sessions, handling edge cases. PolicyDash needs user management (invite flows, role assignment, org membership) not just auth. | Clerk |
| Moment.js | Deprecated, 300KB+ bundle, mutable API. | date-fns |
| Socket.IO | General-purpose WebSocket library. Yjs needs CRDT-aware sync, not raw message passing. Socket.IO adds overhead and doesn't handle CRDT merge. | Yjs + Hocuspocus |
| MongoDB | Document DB doesn't fit the relational traceability model (FB->CR->Section->Version). Joins are essential. Also loses PostgreSQL's audit-friendly transaction semantics. | PostgreSQL via Neon |
| Supabase Auth | Tight coupling to Supabase platform. We chose Neon for DB and Clerk for auth -- adding Supabase Auth creates split identity management. | Clerk |

## Stack Patterns by Variant

**If deploying to Vercel (recommended for MVP):**
- Use Neon as database (native Vercel Postgres integration)
- Use Vercel Blob for file storage instead of Uploadthing (tighter integration)
- Hocuspocus server runs as a separate Node.js process on Railway/Render (Vercel is serverless, can't hold WebSocket connections)
- Use Vercel's built-in analytics and Web Vitals

**If self-hosting (government/enterprise requirement):**
- PostgreSQL direct (no Neon -- use standard PG on the host)
- Switch Clerk to Better Auth for full data sovereignty
- Hocuspocus runs as a Node.js service alongside the Next.js app
- Use MinIO for S3-compatible file storage
- Consider Docker Compose for the full stack

**If real-time collaboration proves too complex for MVP:**
- Phase 1: Single-user editing with Tiptap (no Yjs)
- Phase 2: Add Yjs + Hocuspocus for collaboration
- The Tiptap editor works identically with or without the Collaboration extension -- this is a safe deferral

**If Tiptap Comments pricing is prohibitive:**
- Build custom inline comments using Tiptap marks (decorations) + a comments table in PostgreSQL
- The open-source `tiptap-comment-extension` community package provides a starting point
- This is more work but avoids Tiptap Cloud subscription costs

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Next.js 16.2 | React 19, Tailwind CSS 4.1 | Ships together. React Compiler stable. |
| Tiptap 3.20.x | Yjs 13.6.x, ProseMirror latest | Unified extension packages in v3 (e.g., TableKit). Disable built-in history when using Collaboration extension. |
| Drizzle ORM 0.45.x | Neon serverless driver, PostgreSQL 16+ | Use `@neondatabase/serverless` driver. Drizzle Kit 0.45.x must match ORM version. |
| Clerk latest | Next.js 16.x | First-class App Router + middleware support. Works with edge runtime. |
| XState 5.28.x | TypeScript 5.0+ | Requires TS 5+ for `setup().createMachine()` type inference. |
| shadcn/ui CLI v4 | Tailwind CSS 4.1, React 19 | Auto-generates v4-compatible components. OKLCH colors by default. |
| TanStack Query 5.x | React 19, Next.js 16 | Experimental streaming SSR integration for App Router. |
| Zustand 5.0.x | React 19 | Breaking change from v4: different default store creation API. |

## Key Architecture Decisions Driven by Stack

1. **Hocuspocus runs as a separate process** -- not inside Next.js API routes. WebSocket connections are long-lived; serverless functions are not. Deploy Hocuspocus on Railway, Render, or a VPS alongside the Vercel deployment.

2. **Yjs documents are persisted to PostgreSQL** via Hocuspocus `onStoreDocument` hook. The CRDT state is stored as a binary blob. This enables: (a) loading documents when no collaborators are online, (b) snapshotting document state for version creation, (c) surviving Hocuspocus restarts.

3. **Dual state model** -- XState for workflow state (persisted to DB, drives business logic, auditable), Zustand for UI state (ephemeral, client-only). TanStack Query bridges server/client data.

4. **Clerk Organizations = workspace** -- maps to single workspace now, multi-tenant later. Section-level scoping is app-layer logic on top of Clerk's role/permission system.

5. **Editor JSON is the source of truth** -- Tiptap outputs JSON (not HTML). Store document content as JSONB in PostgreSQL. Render to HTML only for the public portal. This enables programmatic diffing, section extraction, and structured queries.

## Confidence Assessment

| Area | Confidence | Reasoning |
|------|------------|-----------|
| Next.js 16 + React 19 | HIGH | Verified via nextjs.org release notes. Stable since October 2025. |
| Tiptap 3 over BlockNote | HIGH | Verified versions, architecture comparison, and PolicyDash's need for deep customization. 9M+ monthly downloads. |
| Yjs + Hocuspocus | HIGH | Industry standard CRDT. Hocuspocus is MIT-licensed, purpose-built for Tiptap. Verified on npm and GitHub. |
| Clerk for auth | HIGH | Verified pricing (50K free MAUs), RBAC capabilities (custom roles/permissions via API), and Next.js 16 compatibility. |
| Drizzle over Prisma | MEDIUM | Strong technical rationale, but Drizzle is pre-1.0 (0.45.x). The team may have Prisma experience from the previous attempt. Risk is mitigated by Drizzle's rapid maturation and 1.0-beta availability. |
| XState 5 for workflows | HIGH | Verified v5.28.x. Perfect fit for the FB/CR lifecycle state machines with guards and actors. Visual editor aids design. |
| Neon for PostgreSQL | MEDIUM | Strong Vercel integration story, but acquired by Databricks (May 2025). Long-term product direction uncertain. Mitigated by using standard PostgreSQL -- migration to any PG host is trivial. |
| Zustand 5 for UI state | HIGH | 20M+ weekly downloads. v5.0.12 verified. Lightweight, simple API. |
| TanStack Query 5 | HIGH | Industry standard for React data fetching. Verified streaming SSR support with Next.js. |
| Tailwind v4 + shadcn/ui | HIGH | Verified compatibility. CLI v4 (March 2026) generates v4-compatible components. |
| PDF/CSV export | MEDIUM | @react-pdf/renderer 4.3.x works but has SSR quirks with Next.js App Router. May need API route workarounds. |

## Sources

- [Next.js 16 Release Blog](https://nextjs.org/blog/next-16) -- verified features, Turbopack stability, React Compiler
- [Next.js 16.2 Release](https://medium.com/@onix_react/release-next-js-16-2-377798369d25) -- latest stable version confirmed
- [Tiptap 3.0 Stable Release](https://tiptap.dev/blog/release-notes/tiptap-3-0-is-stable) -- v3 release notes, feature list
- [@tiptap/core npm](https://www.npmjs.com/package/@tiptap/core) -- version 3.20.4 confirmed
- [Tiptap vs BlockNote comparison](https://tiptap.dev/alternatives/blocknote-vs-tiptap) -- architectural differences
- [BlockNote npm](https://www.npmjs.com/package/@blocknote/core) -- version 0.47.2, pre-1.0 status confirmed
- [Yjs GitHub](https://github.com/yjs/yjs) -- 900K+ weekly downloads, CRDT architecture
- [Yjs npm](https://www.npmjs.com/package/yjs) -- version 13.6.30 confirmed
- [Hocuspocus GitHub](https://github.com/ueberdosis/hocuspocus) -- MIT license, self-hosting capability
- [Liveblocks Rich Text Editor Guide](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025) -- editor framework comparison
- [Clerk Pricing](https://clerk.com/pricing) -- 50K free MAUs, updated Feb 2026
- [Clerk RBAC Docs](https://clerk.com/docs/guides/organizations/control-access/roles-and-permissions) -- custom roles/permissions
- [Clerk vs Auth0 Comparison](https://clerk.com/articles/clerk-vs-auth0-for-nextjs) -- DX, pricing, integration comparison
- [Drizzle ORM npm](https://www.npmjs.com/package/drizzle-orm) -- version 0.45.1, 7.4KB bundle
- [Drizzle vs Prisma (Bytebase)](https://www.bytebase.com/blog/drizzle-vs-prisma/) -- performance benchmarks, DX comparison
- [Neon vs Supabase (Bytebase)](https://www.bytebase.com/blog/neon-vs-supabase/) -- architecture, Vercel integration
- [XState npm](https://www.npmjs.com/package/xstate) -- version 5.28.0 confirmed
- [XState v5 Announcement](https://stately.ai/blog/2023-12-01-xstate-v5) -- actor model, TypeScript improvements
- [Zustand npm](https://www.npmjs.com/package/zustand) -- version 5.0.12, 20M+ weekly downloads
- [TanStack Query SSR Guide](https://tanstack.com/query/v5/docs/react/guides/advanced-ssr) -- streaming SSR with Next.js
- [shadcn/ui CLI v4](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4) -- Tailwind v4 compatibility, March 2026
- [Tailwind CSS v4 on shadcn](https://ui.shadcn.com/docs/tailwind-v4) -- migration notes, OKLCH colors
- [Tiptap Comments Pricing](https://tiptap.dev/pricing) -- paid extension, requires subscription
- [@react-pdf/renderer npm](https://www.npmjs.com/package/@react-pdf/renderer) -- version 4.3.2 confirmed
- [Uploadthing Docs](https://docs.uploadthing.com/) -- file upload API, Next.js integration

---
*Stack research for: PolicyDash -- Stakeholder Policy Consultation Platform*
*Researched: 2026-03-25*

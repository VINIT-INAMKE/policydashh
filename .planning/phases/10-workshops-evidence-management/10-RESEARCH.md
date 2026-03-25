# Phase 10: Workshops & Evidence Management - Research

**Researched:** 2026-03-25
**Domain:** Workshop CRUD + artifact management + evidence metadata / "claims without evidence" view
**Confidence:** HIGH

## Summary

Phase 10 adds two first-class capabilities that have been stubbed or partially wired since earlier phases.
The Workshop module gives Workshop Moderators a dedicated CRUD surface — workshop events linked to
policy sections and feedback items. The Evidence module completes the metadata story started in Phase 4
and adds a dedicated "claims without evidence" view consumed by Research Leads.

All the infrastructure this phase needs already exists in the codebase: the `evidenceArtifacts`,
`feedbackEvidence`, and `sectionEvidence` tables (Phase 4 schema), the `evidenceUploader` Uploadthing
route (Phase 3), the `evidence:upload` / `evidence:read` permissions (Phase 1 constants), and the
`WorkshopModeratorDashboard` stub (Phase 8). The Research Lead dashboard already shows a working
"Claims Without Evidence" widget — EV-03 promotes that query into a full filterable page.

The primary new DB objects are the `workshops` table, a `workshop_artifacts` join/metadata table,
a `workshop_feedback_links` join table, and a `workshop_section_links` join table. Migration number
is `0006_workshops.sql`. No new npm packages are required.

**Primary recommendation:** Model workshops identically to Change Requests — a top-level entity with
separate join tables for each relationship type. Keep the router in `src/server/routers/workshop.ts`
and the UI under `app/(workspace)/workshops/`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None — all implementation choices are at Claude's discretion.

### Claude's Discretion
All implementation choices are at Claude's discretion.

Key constraints:
- Workshop Moderator dashboard stub exists from Phase 8
- Evidence artifacts + join tables exist from Phase 4
- Uploadthing infrastructure exists from Phase 3
- Workshop permissions defined in Phase 1 constants

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WS-01 | Workshop Moderator can create workshop events with title, description, date, duration, registration link | New `workshops` table + tRPC `workshop.create` + CRUD UI under `/workshops` |
| WS-02 | Workshop artifacts: upload/attach promo materials, recordings, summaries, attendance records | New `workshop_artifacts` table with artifact type enum + reuse `evidenceUploader` UT route |
| WS-03 | Link workshop insights to specific policy sections | `workshop_section_links` join table + tRPC manage procedure |
| WS-04 | Link feedback items to workshops (feedback originating from workshop sessions) | `workshop_feedback_links` join table + tRPC manage procedure |
| WS-05 | Workshop list view with upcoming/past filtering | `/workshops` page with tab/filter; server query with `scheduledAt` comparison |
| EV-03 | Research Lead has "Claims without evidence" view surfacing feedback lacking supporting evidence | Full page at `/feedback/evidence-gaps` — promotes existing dashboard widget query |
| EV-04 | Evidence artifacts have metadata: title, type (Link, File), uploader, timestamp | `evidenceArtifacts` schema already has all fields; EV-04 = dedicated metadata display UI |
</phase_requirements>

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.1 | ORM for new workshop schema tables | Already in use throughout |
| @trpc/server / @trpc/react-query | 11.15.0 | Workshop tRPC router + client hooks | Project-wide RPC layer |
| uploadthing + @uploadthing/react | 7.7.4 / 7.3.3 | Artifact file uploads for workshops | Already configured with `evidenceUploader` route |
| zod | 4.3.6 | Input validation on all tRPC procedures | Project-wide; note single-arg `z.record` crashes (use `z.record(z.string(), z.unknown())`) |
| date-fns | 4.1.0 | Date formatting for workshop scheduled date / duration | Already installed |
| lucide-react | 1.6.0 | Icons (Calendar, Paperclip, etc.) | Already in use in workshop stub |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @base-ui/react | 1.3.0 | Dialog primitives for create/edit workshop modal | Phase 4 established base-ui Dialog pattern directly |
| sonner | 2.0.7 | Toast notifications on mutation success/failure | Project-wide toast; import from `sonner` directly (not shadcn wrapper) |
| @tanstack/react-query | 5.95.2 | Query invalidation after mutations | Via tRPC utils pattern (`trpc.useUtils()`) |

### No New Packages Required

All required libraries are installed. Do not add packages for:
- Date pickers — use `<input type="datetime-local">` (standard HTML5, no lib needed)
- Rich text editors — workshop description is plain text, not block-editor content
- File upload — reuse existing `evidenceUploader` Uploadthing route

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── db/
│   ├── schema/
│   │   └── workshops.ts          # workshops, workshop_artifacts, workshop_section_links, workshop_feedback_links
│   │   └── index.ts              # export * from './workshops'
│   └── migrations/
│       └── 0006_workshops.sql    # DDL for all workshop tables
├── server/
│   └── routers/
│       ├── workshop.ts           # CRUD + artifact attach + section/feedback links
│       └── _app.ts               # add workshopRouter
├── lib/
│   └── constants.ts              # add ACTIONS.WORKSHOP_* audit constants
│   └── permissions.ts            # add workshop:* permissions

app/(workspace)/
├── workshops/
│   ├── page.tsx                  # list with upcoming/past tabs (WS-05)
│   ├── new/
│   │   └── page.tsx              # create workshop form
│   └── [id]/
│       ├── page.tsx              # workshop detail: artifacts, section links, feedback links
│       └── _components/
│           ├── workshop-artifact-list.tsx
│           ├── artifact-upload.tsx
│           ├── section-link-picker.tsx
│           └── feedback-link-picker.tsx
├── feedback/
│   └── evidence-gaps/
│       └── page.tsx              # EV-03 full page (Research Lead only)
└── dashboard/
    └── _components/
        └── workshop-moderator-dashboard.tsx  # replace stub with real data
```

### Pattern 1: Schema — workshops table

Model workshops as a first-class entity with join tables for each relationship, exactly as Change Requests are structured (`crSectionLinks`, `crFeedbackLinks`).

```typescript
// src/db/schema/workshops.ts
import { pgTable, uuid, text, timestamp, integer, pgEnum, primaryKey } from 'drizzle-orm/pg-core'
import { users } from './users'
import { policySections } from './documents'
import { feedbackItems } from './feedback'
import { evidenceArtifacts } from './evidence'

export const workshopArtifactTypeEnum = pgEnum('workshop_artifact_type', [
  'promo', 'recording', 'summary', 'attendance', 'other',
])

export const workshops = pgTable('workshops', {
  id:               uuid('id').primaryKey().defaultRandom(),
  title:            text('title').notNull(),
  description:      text('description'),
  scheduledAt:      timestamp('scheduled_at', { withTimezone: true }).notNull(),
  durationMinutes:  integer('duration_minutes'),
  registrationLink: text('registration_link'),
  createdBy:        uuid('created_by').notNull().references(() => users.id),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Artifacts attached to a workshop (uploaded files or links)
export const workshopArtifacts = pgTable('workshop_artifacts', {
  id:          uuid('id').primaryKey().defaultRandom(),
  workshopId:  uuid('workshop_id').notNull().references(() => workshops.id, { onDelete: 'cascade' }),
  artifactId:  uuid('artifact_id').notNull().references(() => evidenceArtifacts.id, { onDelete: 'cascade' }),
  artifactType: workshopArtifactTypeEnum('artifact_type').notNull().default('other'),
})

// Workshop → Section links
export const workshopSectionLinks = pgTable('workshop_section_links', {
  workshopId: uuid('workshop_id').notNull().references(() => workshops.id, { onDelete: 'cascade' }),
  sectionId:  uuid('section_id').notNull().references(() => policySections.id, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.workshopId, t.sectionId] }),
])

// Workshop → Feedback links (provenance)
export const workshopFeedbackLinks = pgTable('workshop_feedback_links', {
  workshopId:  uuid('workshop_id').notNull().references(() => workshops.id, { onDelete: 'cascade' }),
  feedbackId:  uuid('feedback_id').notNull().references(() => feedbackItems.id, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.workshopId, t.feedbackId] }),
])
```

### Pattern 2: Migration file

Name: `0006_workshops.sql`. Use raw SQL (no Drizzle migration generator) — consistent with project convention of hand-written SQL migrations.

```sql
-- Phase 10: Workshop module
CREATE TYPE workshop_artifact_type AS ENUM (
  'promo', 'recording', 'summary', 'attendance', 'other'
);

CREATE TABLE workshops (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  description       TEXT,
  scheduled_at      TIMESTAMPTZ NOT NULL,
  duration_minutes  INTEGER,
  registration_link TEXT,
  created_by        UUID NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workshops_scheduled ON workshops(scheduled_at);

CREATE TABLE workshop_artifacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id   UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  artifact_id   UUID NOT NULL REFERENCES evidence_artifacts(id) ON DELETE CASCADE,
  artifact_type workshop_artifact_type NOT NULL DEFAULT 'other'
);

CREATE TABLE workshop_section_links (
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  section_id  UUID NOT NULL REFERENCES policy_sections(id) ON DELETE CASCADE,
  PRIMARY KEY (workshop_id, section_id)
);

CREATE TABLE workshop_feedback_links (
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  PRIMARY KEY (workshop_id, feedback_id)
);
```

### Pattern 3: Workshop tRPC router skeleton

Follow the exact same conventions as `src/server/routers/changeRequest.ts`:
- `requirePermission('workshop:manage')` for mutations
- `requirePermission('workshop:read')` for queries
- Sequential inserts, no transactions (Neon HTTP driver compatibility — same as Phase 2 decision)
- `writeAuditLog` on every mutation

```typescript
// src/server/routers/workshop.ts (skeleton)
export const workshopRouter = router({
  create: requirePermission('workshop:manage')
    .input(z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(2000).optional(),
      scheduledAt: z.string().datetime(),  // ISO string; tRPC serializes dates as strings
      durationMinutes: z.number().int().positive().optional(),
      registrationLink: z.string().url().optional(),
    }))
    .mutation(async ({ ctx, input }) => { ... }),

  list: requirePermission('workshop:read')
    .input(z.object({
      filter: z.enum(['upcoming', 'past', 'all']).default('all'),
    }))
    .query(async ({ input }) => { ... }),

  getById: requirePermission('workshop:read')
    .input(z.object({ workshopId: z.string().uuid() }))
    .query(async ({ input }) => { ... }),

  update: requirePermission('workshop:manage')
    .input(z.object({ workshopId: z.string().uuid(), ... }))
    .mutation(async ({ ctx, input }) => { ... }),

  delete: requirePermission('workshop:manage')
    .input(z.object({ workshopId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => { ... }),

  attachArtifact: requirePermission('workshop:manage')
    .input(z.object({
      workshopId: z.string().uuid(),
      title: z.string().min(1),
      type: z.enum(['file', 'link']),
      url: z.string().url(),
      artifactType: z.enum(['promo', 'recording', 'summary', 'attendance', 'other']),
      fileName: z.string().optional(),
      fileSize: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => { ... }),

  listArtifacts: requirePermission('workshop:read')
    .input(z.object({ workshopId: z.string().uuid() }))
    .query(async ({ input }) => { ... }),

  linkSection: requirePermission('workshop:manage')
    .input(z.object({ workshopId: z.string().uuid(), sectionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => { ... }),

  unlinkSection: requirePermission('workshop:manage')
    .input(z.object({ workshopId: z.string().uuid(), sectionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => { ... }),

  linkFeedback: requirePermission('workshop:manage')
    .input(z.object({ workshopId: z.string().uuid(), feedbackId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => { ... }),

  unlinkFeedback: requirePermission('workshop:manage')
    .input(z.object({ workshopId: z.string().uuid(), feedbackId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => { ... }),
})
```

### Pattern 4: Permissions to add

Add to `src/lib/permissions.ts`:

```typescript
// Workshop (Phase 10)
'workshop:manage': [ROLES.ADMIN, ROLES.WORKSHOP_MODERATOR] as readonly Role[],
'workshop:read':   [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD,
                   ROLES.WORKSHOP_MODERATOR, ROLES.STAKEHOLDER, ROLES.OBSERVER, ROLES.AUDITOR] as readonly Role[],
```

Note: `workshop:manage` is restricted to Workshop Moderator and Admin. Policy Lead and Research Lead
only get `workshop:read`. This aligns with the UX-07 requirement ("Workshop Moderator dashboard:
workshop management, artifact uploads, section linking").

### Pattern 5: Audit constants to add

Add to `src/lib/constants.ts` ACTIONS object:

```typescript
WORKSHOP_CREATE:        'workshop.create',
WORKSHOP_UPDATE:        'workshop.update',
WORKSHOP_DELETE:        'workshop.delete',
WORKSHOP_ARTIFACT_ATTACH: 'workshop.artifact_attach',
WORKSHOP_SECTION_LINK:  'workshop.section_link',
WORKSHOP_SECTION_UNLINK: 'workshop.section_unlink',
WORKSHOP_FEEDBACK_LINK: 'workshop.feedback_link',
WORKSHOP_FEEDBACK_UNLINK: 'workshop.feedback_unlink',
```

### Pattern 6: Workshop list — upcoming/past filter

Use server-side comparison against `scheduledAt`. `date-fns` is available but a plain `new Date()` comparison in Drizzle is sufficient:

```typescript
// upcoming: scheduledAt >= now
// past: scheduledAt < now
import { gte, lt } from 'drizzle-orm'
const now = new Date()
const condition = filter === 'upcoming'
  ? gte(workshops.scheduledAt, now)
  : filter === 'past'
  ? lt(workshops.scheduledAt, now)
  : undefined
```

### Pattern 7: Artifact upload flow (workshop context)

Reuse the existing `evidenceUploader` Uploadthing route without modification. The workshop artifact
attach flow is:
1. Client calls `useUploadThing('evidenceUploader')` to get the file URL.
2. Client calls `trpc.workshop.attachArtifact.mutate(...)` with the URL + metadata.
3. Server inserts into `evidence_artifacts` then `workshop_artifacts`.

This reuses the identical pattern established in `evidence-attachment.tsx` for feedback evidence.

### Pattern 8: EV-03 — "Claims without evidence" full page

The Research Lead dashboard (`research-lead-dashboard.tsx`) already has the correct query using
`leftJoin(feedbackEvidence, ...).where(isNull(feedbackEvidence.artifactId))`. The full EV-03 page
at `/feedback/evidence-gaps` is a promoted version of that widget with:
- All feedback items without evidence (not just the top 5)
- Filter by document / section / feedback type
- Link directly to attach evidence on each item

The dashboard widget can keep its limit-5 preview and link to this page. No query logic needs to be
invented — copy the dashboard query and remove the `.limit(5)`.

### Pattern 9: EV-04 — Evidence artifact metadata display

`evidenceArtifacts` already has: `title`, `type`, `url`, `fileName`, `fileSize`, `uploaderId`,
`createdAt`. EV-04 = display this metadata properly in the evidence list UI. The `evidence-list.tsx`
already shows most of it. EV-04 primarily means:
- Show uploader name (join to `users` table for display name)
- Show formatted timestamp
- Show file type badge

The `listByFeedback` and `listBySection` queries in `evidence.ts` do not currently join `users`.
They need a join to return `uploaderName: users.name`.

### Pattern 10: WorkshopModeratorDashboard — replace stub

`workshop-moderator-dashboard.tsx` is currently a pure placeholder (no data fetching). Phase 10
replaces it with real data:
- Upcoming workshops count + list (top 3)
- Total artifacts count
- "Manage Workshops" button linking to `/workshops`

This is a Server Component (like `ResearchLeadDashboard`) — direct DB queries with `Promise.all`.

### Anti-Patterns to Avoid

- **Don't create a separate Uploadthing route for workshop artifacts.** Reuse `evidenceUploader` — workshop artifacts go through `evidence_artifacts` first, then `workshop_artifacts` links them.
- **Don't add `workshop_id` column to `feedback` table.** WS-04 is a many-to-many link (`workshop_feedback_links` join table), not a foreign key on feedback.
- **Don't use `db.transaction()`.** Neon HTTP driver compatibility — sequential inserts as established in Phase 2.
- **Don't add `react-datepicker` or similar.** Use `<input type="datetime-local">` with Zod `.datetime()` validation.
- **Don't use `z.record(z.unknown())` single arg in Zod v4** — use `z.record(z.string(), z.unknown())` per Phase 03 decision.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File upload UI | Custom drag-drop + fetch | `useUploadThing('evidenceUploader')` | Uploadthing handles progress, chunking, CDN storage; pattern established in `evidence-attachment.tsx` |
| Date/time input | Custom calendar picker | `<input type="datetime-local">` | HTML5 native; no library overhead; works with Zod `.datetime()` |
| Evidence query (no-evidence filter) | Custom SQL | Copy pattern from `research-lead-dashboard.tsx` leftJoin isNull | Exact pattern already proven correct |
| Permission check | Manual role comparison | `requirePermission('workshop:manage')` middleware | Centralized permission matrix, default-deny |
| Audit logging | Custom log writer | `writeAuditLog(...)` from `@/src/lib/audit` | Every mutation must write audit log per project rule |

---

## Common Pitfalls

### Pitfall 1: Forgetting to export workshop schema from index.ts
**What goes wrong:** Drizzle relations and router imports fail with "cannot find X" at runtime.
**Why it happens:** `src/db/schema/index.ts` re-exports all schema files. New schema files must be added.
**How to avoid:** After creating `workshops.ts`, immediately add `export * from './workshops'` to `index.ts`.
**Warning signs:** TypeScript error "Module has no exported member 'workshops'" in router files.

### Pitfall 2: tRPC date serialization
**What goes wrong:** `scheduledAt` arrives as a string in client code, not a Date object.
**Why it happens:** tRPC v11 serializes Date as ISO string (Phase 02 decision: "tRPC serializes dates as strings").
**How to avoid:** Type `scheduledAt` as `string` in client-facing interfaces. Use `date-fns` `parseISO()` or `new Date(scheduledAt)` when displaying.
**Warning signs:** `scheduledAt.toLocaleDateString is not a function` in client component.

### Pitfall 3: Missing workshopRouter in _app.ts
**What goes wrong:** `trpc.workshop.*` calls throw "No procedure found" 404 at runtime.
**Why it happens:** New routers must be registered in `src/server/routers/_app.ts`.
**How to avoid:** Add `workshop: workshopRouter` to the `appRouter` object in `_app.ts` immediately after creating the router file.

### Pitfall 4: EV-03 page accessible to wrong roles
**What goes wrong:** Non-Research-Lead users can navigate to `/feedback/evidence-gaps`.
**Why it happens:** Next.js route access is open by default unless protected.
**How to avoid:** Add role check in the page Server Component (same pattern as other dashboard components — check `user.role` and redirect if not `research_lead` or `admin`).

### Pitfall 5: Workshop artifacts bypassing audit log
**What goes wrong:** File attachments to workshops are not recorded in the audit trail.
**Why it happens:** `writeAuditLog` must be called manually in every mutation — there is no middleware that auto-logs.
**How to avoid:** Every mutation in `workshop.ts` must call `writeAuditLog(...)` with an appropriate `ACTIONS.WORKSHOP_*` constant.

### Pitfall 6: Navigator to /workshops not added to WorkspaceNav
**What goes wrong:** Workshop Moderators have no nav link to workshops.
**Why it happens:** `workspace-nav.tsx` has a conditional nav items list by role that must be updated.
**How to avoid:** Add `{ href: '/workshops', label: 'Workshops' }` to nav items when `userRole === 'workshop_moderator' || userRole === 'admin'`.

### Pitfall 7: base-ui Dialog vs. shadcn Sheet
**What goes wrong:** Using wrong component primitive causes style inconsistencies or missing `render` prop.
**Why it happens:** Phase 4 established: "Base-ui Dialog primitive used directly for sheet panel". The `render` prop pattern (not `asChild`) applies to Button-as-anchor.
**How to avoid:** Use `@base-ui/react` Dialog directly for modals. For Button-as-Link, use `render={<Link href="..." />}` not `asChild`.

---

## Code Examples

### EV-04: Uploader name join in evidence router

```typescript
// Verified pattern: join users table to get uploader name
// Source: existing evidence.ts listByFeedback query (extend with join)
const rows = await db
  .select({
    id: evidenceArtifacts.id,
    title: evidenceArtifacts.title,
    type: evidenceArtifacts.type,
    url: evidenceArtifacts.url,
    fileName: evidenceArtifacts.fileName,
    fileSize: evidenceArtifacts.fileSize,
    uploaderId: evidenceArtifacts.uploaderId,
    uploaderName: users.name,       // new join
    createdAt: evidenceArtifacts.createdAt,
  })
  .from(feedbackEvidence)
  .innerJoin(evidenceArtifacts, eq(feedbackEvidence.artifactId, evidenceArtifacts.id))
  .innerJoin(users, eq(evidenceArtifacts.uploaderId, users.id))   // new join
  .where(eq(feedbackEvidence.feedbackId, input.feedbackId))
```

### Workshop list query with upcoming/past filter

```typescript
// Source: codebase analysis of existing list patterns (feedback.ts list query)
import { gte, lt, desc } from 'drizzle-orm'

const now = new Date()
const conditions = []
if (input.filter === 'upcoming') conditions.push(gte(workshops.scheduledAt, now))
if (input.filter === 'past')     conditions.push(lt(workshops.scheduledAt, now))

const rows = await db
  .select({
    id: workshops.id,
    title: workshops.title,
    scheduledAt: workshops.scheduledAt,
    durationMinutes: workshops.durationMinutes,
    registrationLink: workshops.registrationLink,
    createdBy: workshops.createdBy,
  })
  .from(workshops)
  .where(conditions.length ? and(...conditions) : undefined)
  .orderBy(desc(workshops.scheduledAt))
```

### WorkshopModeratorDashboard — real data

```typescript
// Source: research-lead-dashboard.tsx pattern (Server Component, direct DB, Promise.all)
export async function WorkshopModeratorDashboard({ userId }: WorkshopModeratorDashboardProps) {
  const now = new Date()
  const [upcomingWorkshops, [artifactCountResult]] = await Promise.all([
    db
      .select({ id: workshops.id, title: workshops.title, scheduledAt: workshops.scheduledAt })
      .from(workshops)
      .where(gte(workshops.scheduledAt, now))
      .orderBy(asc(workshops.scheduledAt))
      .limit(3),
    db.select({ count: count() }).from(workshopArtifacts),
  ])
  // ... render
}
```

### Workshop artifact attach (server mutation pattern)

```typescript
// Source: evidence.ts attach mutation pattern — reuse evidence_artifacts, then link
const [artifact] = await db
  .insert(evidenceArtifacts)
  .values({
    title: input.title,
    type: input.type,
    url: input.url,
    fileName: input.fileName ?? null,
    fileSize: input.fileSize ?? null,
    uploaderId: ctx.user.id,
  })
  .returning()

// Sequential inserts (no transaction — Neon HTTP driver compatibility)
await db.insert(workshopArtifacts).values({
  workshopId: input.workshopId,
  artifactId: artifact.id,
  artifactType: input.artifactType,
})

await writeAuditLog({
  actorId: ctx.user.id,
  actorRole: ctx.user.role,
  action: ACTIONS.WORKSHOP_ARTIFACT_ATTACH,
  entityType: 'workshop',
  entityId: input.workshopId,
  payload: { artifactId: artifact.id, artifactType: input.artifactType },
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Workshop dashboard stub (empty, no data) | Real WorkshopModeratorDashboard with DB queries | Phase 10 | Dashboard becomes functional |
| Evidence list missing uploader name | listByFeedback / listBySection join users for name | Phase 10 (EV-04) | Evidence metadata complete |
| "Claims without evidence" widget (top 5, dashboard only) | Full filterable page at /feedback/evidence-gaps | Phase 10 (EV-03) | Research Leads can action all gaps |

**Deprecated/outdated:**
- `WorkshopModeratorDashboard` placeholder: replaced entirely — keep the component file but overwrite body.

---

## Open Questions

1. **Registration link validation**
   - What we know: WS-01 specifies "registration link" as a field. It could be a URL to an external form or video call.
   - What's unclear: Should it be HTTPS-only like the evidence link validator? Should it allow nullability?
   - Recommendation: Make it optional + HTTPS-only URL validation (same as evidence link). Null when not provided.

2. **Workshop edit / delete permissions**
   - What we know: `workshop:manage` allows Admin and Workshop Moderator. WS-01 says "Workshop Moderator can create".
   - What's unclear: Can a Workshop Moderator edit/delete workshops created by other Moderators?
   - Recommendation: Server-side check `workshop.createdBy === ctx.user.id || ctx.user.role === 'admin'` for edit/delete. This matches standard ownership pattern.

3. **Section picker scope for workshop linking**
   - What we know: Sections are document-scoped. WS-03 links workshop insights to "specific policy sections" without specifying which document.
   - What's unclear: Should section linking be constrained to a single document, or cross-document?
   - Recommendation: Cross-document — the section picker should load all sections (with document grouping for UX clarity). `workshop_section_links` stores only `(workshop_id, section_id)`.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 10 is purely code and database changes. All external dependencies (Neon DB, Uploadthing, Clerk) are already provisioned from earlier phases.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.mts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

Note: test glob is `src/**/*.test.ts` and `src/**/*.test.tsx`. No project tests exist currently (`passWithNoTests: true`).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WS-01 | Workshop creation with valid input | unit | `npm test -- src/server/routers/workshop.test.ts` | Wave 0 |
| WS-01 | Workshop creation rejected without workshop:manage permission | unit | same | Wave 0 |
| WS-02 | Artifact attach creates evidence_artifacts + workshop_artifacts row | unit | same | Wave 0 |
| WS-03 | Section link creates workshop_section_links row | unit | same | Wave 0 |
| WS-04 | Feedback link creates workshop_feedback_links row | unit | same | Wave 0 |
| WS-05 | Upcoming filter returns only future workshops | unit | same | Wave 0 |
| WS-05 | Past filter returns only past workshops | unit | same | Wave 0 |
| EV-03 | Claims without evidence query returns only feedback with no evidence join | unit | `npm test -- src/server/routers/evidence.test.ts` | Wave 0 |
| EV-04 | listByFeedback returns uploaderName field | unit | same | Wave 0 |

Note: tRPC routers are tested via caller-factory unit tests (no HTTP layer needed). Pattern: `createCallerFactory(appRouter)(mockCtx).workshop.create(...)`. No existing test files to reference — all are Wave 0 gaps.

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/server/routers/workshop.test.ts` — covers WS-01 through WS-05
- [ ] `src/server/routers/evidence.test.ts` — covers EV-03, EV-04 uploader join

---

## Sources

### Primary (HIGH confidence)
- Direct codebase read — `src/db/schema/evidence.ts` — confirms evidence table structure
- Direct codebase read — `src/server/routers/evidence.ts` — confirms router patterns and permission names
- Direct codebase read — `src/lib/permissions.ts` — confirms all existing permissions and role assignments
- Direct codebase read — `src/lib/constants.ts` — confirms ACTIONS constants and ROLES
- Direct codebase read — `app/(workspace)/dashboard/_components/research-lead-dashboard.tsx` — confirms "claims without evidence" query pattern using `leftJoin + isNull`
- Direct codebase read — `app/(workspace)/dashboard/_components/workshop-moderator-dashboard.tsx` — confirms stub extent and what must be replaced
- Direct codebase read — `app/api/uploadthing/core.ts` + `src/lib/uploadthing.ts` — confirms `evidenceUploader` route exists and is reusable
- Direct codebase read — `src/db/schema/changeRequests.ts` — confirms join-table pattern for linking (crFeedbackLinks, crSectionLinks)
- Direct codebase read — `.planning/STATE.md` — confirms project decisions including sequential inserts, no transactions
- Direct codebase read — `src/trpc/init.ts` — confirms `requirePermission` pattern
- Direct codebase read — `vitest.config.mts` — confirms test framework and glob patterns

### Secondary (MEDIUM confidence)
- REQUIREMENTS.md WS-01 through WS-05, EV-03, EV-04 — requirements text
- STATE.md accumulated decisions — Neon HTTP driver no-transaction, tRPC date serialization, base-ui patterns

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use
- Schema design: HIGH — mirrors established patterns from changeRequests schema
- Architecture: HIGH — derived directly from existing router and component patterns
- Pitfalls: HIGH — derived from STATE.md accumulated project decisions
- Permissions: HIGH — permission matrix already has workshop:manage/read stubs implied by role definitions

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable — no new external dependencies)

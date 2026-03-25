# Phase 4: Feedback System - Research

**Researched:** 2026-03-25
**Domain:** Feedback lifecycle management, section-level RBAC scoping, XState 5 state machines, evidence file attachments
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Drizzle ORM with Neon PostgreSQL (Phase 1)
- tRPC v11 with default-deny middleware via requirePermission() (Phase 1)
- Audit logging via writeAuditLog() on all mutations (Phase 1)
- Policy documents and sections with stable UUIDs (Phase 2)
- Block editor with Tiptap 3 for section content (Phase 3)
- XState 5 recommended for feedback lifecycle state machine (project research)
- State transition table exists in schema (workflow_transitions from Phase 1)

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Deferred Ideas (OUT OF SCOPE)
None — discuss phase skipped.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FB-01 | Authenticated user (with permission) can submit feedback tied to a specific policy section | Stakeholder + section scoping via requireSectionAccess middleware; new `feedback:submit` permission in matrix |
| FB-02 | Feedback has a human-readable ID (FB-001, FB-002, etc.) | PostgreSQL sequence or counter table; format on read via zero-pad |
| FB-03 | Feedback captures: type (Issue, Suggestion, Endorsement, Evidence, Question), priority (Low, Medium, High), impact category (7 categories) | pgEnum types in Drizzle schema; Zod validation on input |
| FB-04 | Feedback captures: title, body text, and optional suggested change | Standard text fields in schema |
| FB-05 | Feedback can have evidence artifacts attached (files or links) | New `evidence_artifacts` table; reuse existing Uploadthing `documentUploader` route; add `evidenceUploader` endpoint |
| FB-06 | Feedback lifecycle: Submitted → Under Review → Accepted / Partially Accepted / Rejected → Closed | XState 5 `feedbackMachine`; status persisted in `feedback.status` column; transitions logged to `workflow_transitions` |
| FB-07 | Every accept/reject/partial decision requires mandatory rationale | XState `hasRationale` guard; `decision_rationale` column in schema; enforced before state transition fires |
| FB-08 | Stakeholder can choose anonymous or named attribution per feedback item | `is_anonymous` boolean on feedback row; display name resolution at query time based on this flag |
| FB-09 | Stakeholder can view status and outcome of their own feedback items | `feedback:read_own` permission; filtered query WHERE submitter_id = ctx.user.id |
| FB-10 | Policy Lead can filter feedback by section, stakeholder org type, priority, status, impact, and feedback type | Multi-column filter query in tRPC; nuqs for URL-synced filter state on client |
| AUTH-05 | Stakeholder can only view and interact with sections they are assigned to (section-level scoping) | New `section_assignments` table; `requireSectionAccess` tRPC middleware; enforced on all feedback queries |
| AUTH-08 | Privacy preferences: user can choose named or anonymous attribution for public outputs | `privacy_preference` column on users table (default: named); per-feedback `is_anonymous` override |
| EV-01 | User can upload evidence artifacts (files) or add links as evidence | Uploadthing `evidenceUploader` route; `evidence_artifacts` table with type enum (File, Link) |
| EV-02 | Evidence can be attached to feedback items and policy sections | `feedback_evidence` join table; also `section_evidence` join table for section-level attachments |
</phase_requirements>

---

## Summary

Phase 4 introduces the core data capture layer of PolicyDash: feedback items. This is the first phase where stakeholders actively create structured data, which means it must simultaneously establish section-level scoping (AUTH-05), privacy controls (AUTH-08), evidence attachments (EV-01/EV-02), and the feedback lifecycle state machine (FB-06/FB-07). These 14 requirements form a tightly coupled unit — they must all ship together to produce a coherent, usable feedback experience.

The codebase is well-prepared for this phase. Three prior phases have established: Drizzle schema with `policySections` as stable UUID primary keys, the `requirePermission()` tRPC middleware pattern, `writeAuditLog()` for every mutation, Uploadthing routes for file uploads, the `workflowTransitions` table for state machine history, and a permissions matrix that Phase 4 must extend. The primary new infrastructure is: (1) the `feedback` schema with all supporting tables, (2) XState 5 installed and wired, (3) the `section_assignments` table for scoping, and (4) a `requireSectionAccess` middleware composing role check + section membership.

Section-level scoping (AUTH-05) is the architecturally novel piece. The prior permission system checks role only. Phase 4 must add a second dimension: does this user have an assignment to this specific section? This requires a new `section_assignments` table, an admin/policy_lead endpoint to create assignments, and a middleware that queries the DB before allowing submit/read operations on any feedback. Importantly, scoping must apply to the feedback submission form visibility, feedback list queries (stakeholders see only their assigned sections' feedback), AND the section content visibility on the editor page.

**Primary recommendation:** Build in three waves: (1) schema + XState machine + base tRPC procedures, (2) feedback submission form + section scoping enforcement + evidence upload, (3) policy lead triage UI + filtering. All three waves contribute to a shippable feature set.

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md contains `@AGENTS.md` which states: "This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices."

**Directive enforcement for Phase 4:**
- Before writing any Next.js App Router page or layout, read `node_modules/next/dist/docs/` for the applicable pattern
- Do not assume standard Next.js 14/15 patterns — always verify against the installed Next.js 16.2.1 docs
- Do not use patterns deprecated in Next.js 16 (e.g., verify `use client` + RSC data fetching patterns match 16.x)
- Phase 4 adds new pages under `app/(workspace)/feedback/` — verify route group conventions per the installed docs

---

## Standard Stack

### New Packages Required (Phase 4)

| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| xstate | 5.29.0 | Feedback lifecycle state machine | NOT YET INSTALLED — must add |
| @xstate/react | 6.1.0 | React hooks for state machines | NOT YET INSTALLED — must add |

**All other stack dependencies are already installed** (see `package.json`):
- Drizzle ORM 0.45.1 — schema, migrations, queries
- tRPC 11.15.0 — API procedures, middleware
- Zod 4.3.6 — schema validation
- Uploadthing 7.7.4 — evidence file uploads
- date-fns 4.1.0 — timestamp formatting
- Vitest 4.1.1 — test framework

**Installation:**
```bash
npm install xstate@5.29.0 @xstate/react@6.1.0
```

**Version verification (confirmed 2026-03-25):**
```
xstate: 5.29.0 (npm view xstate version)
@xstate/react: 6.1.0 (npm view @xstate/react version)
```

### Zod v4 Constraint (known codebase issue)
The project uses Zod 4.3.6. The codebase has an established constraint: use `z.record(z.string(), z.unknown())` not `z.record(z.unknown())` (single-arg crashes in Zod v4). All new schema definitions must follow this pattern.

---

## Architecture Patterns

### New Schema Tables Required

**Migration file:** `src/db/migrations/0002_feedback_system.sql`

```sql
-- Human-readable ID counter
CREATE SEQUENCE feedback_id_seq START 1;

-- Section assignments (AUTH-05: scoping)
CREATE TABLE section_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section_id  UUID NOT NULL REFERENCES policy_sections(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, section_id)
);
CREATE INDEX idx_section_assignments_user ON section_assignments(user_id);
CREATE INDEX idx_section_assignments_section ON section_assignments(section_id);

-- Feedback items
CREATE TYPE feedback_type    AS ENUM ('issue', 'suggestion', 'endorsement', 'evidence', 'question');
CREATE TYPE feedback_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE impact_category   AS ENUM ('legal', 'security', 'tax', 'consumer', 'innovation', 'clarity', 'governance', 'other');
CREATE TYPE feedback_status   AS ENUM ('submitted', 'under_review', 'accepted', 'partially_accepted', 'rejected', 'closed');

CREATE TABLE feedback (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  readable_id        TEXT NOT NULL UNIQUE,        -- 'FB-001'
  section_id         UUID NOT NULL REFERENCES policy_sections(id),
  document_id        UUID NOT NULL REFERENCES policy_documents(id),
  submitter_id       UUID NOT NULL REFERENCES users(id),
  feedback_type      feedback_type NOT NULL,
  priority           feedback_priority NOT NULL DEFAULT 'medium',
  impact_category    impact_category NOT NULL DEFAULT 'other',
  title              TEXT NOT NULL,
  body               TEXT NOT NULL,
  suggested_change   TEXT,
  status             feedback_status NOT NULL DEFAULT 'submitted',
  is_anonymous       BOOLEAN NOT NULL DEFAULT false,
  decision_rationale TEXT,
  reviewed_by        UUID REFERENCES users(id),
  reviewed_at        TIMESTAMPTZ,
  xstate_snapshot    JSONB,                       -- persisted XState machine state
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_feedback_section ON feedback(section_id);
CREATE INDEX idx_feedback_document ON feedback(document_id);
CREATE INDEX idx_feedback_submitter ON feedback(submitter_id);
CREATE INDEX idx_feedback_status ON feedback(status);

-- Evidence artifacts (EV-01, EV-02)
CREATE TYPE evidence_type AS ENUM ('file', 'link');

CREATE TABLE evidence_artifacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  type        evidence_type NOT NULL,
  url         TEXT NOT NULL,                      -- Uploadthing ufsUrl or link URL
  file_name   TEXT,                               -- only for type=file
  file_size   INTEGER,                            -- bytes, only for type=file
  uploader_id UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Feedback <-> Evidence join (EV-02: attach to feedback items)
CREATE TABLE feedback_evidence (
  feedback_id  UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  artifact_id  UUID NOT NULL REFERENCES evidence_artifacts(id) ON DELETE CASCADE,
  PRIMARY KEY (feedback_id, artifact_id)
);

-- Section <-> Evidence join (EV-02: attach to sections)
CREATE TABLE section_evidence (
  section_id  UUID NOT NULL REFERENCES policy_sections(id) ON DELETE CASCADE,
  artifact_id UUID NOT NULL REFERENCES evidence_artifacts(id) ON DELETE CASCADE,
  PRIMARY KEY (section_id, artifact_id)
);
```

### Drizzle Schema Files Required

New files to create:
- `src/db/schema/feedback.ts` — feedback table + enums
- `src/db/schema/sectionAssignments.ts` — section_assignments table
- `src/db/schema/evidence.ts` — evidence_artifacts + join tables

Update `src/db/schema/index.ts` to export all new schemas.

### Human-Readable ID Pattern

Use a PostgreSQL sequence + a formatted trigger:

```typescript
// In feedback.ts tRPC router
async function generateFeedbackId(db: DB): Promise<string> {
  const [row] = await db.execute(sql`SELECT nextval('feedback_id_seq') AS seq`)
  const num = Number(row.seq)
  return `FB-${String(num).padStart(3, '0')}`  // FB-001, FB-002, ..., FB-999, FB-1000
}
```

**Why this approach:** Simple, sequential, readable. The sequence is crash-safe in PostgreSQL (no rollback on failure). Zero-pads to 3 digits, overflows gracefully at 1000+. No custom counter table needed; `nextval()` is atomic.

**Alternative considered:** Custom `feedback_counter` table with `FOR UPDATE` row lock. More complex, no advantage for this use case.

### XState 5 Feedback Machine Pattern

XState 5 uses `setup().createMachine()` — NOT the deprecated `createMachine()` top-level export from v4.

```typescript
// src/server/machines/feedback.machine.ts
import { setup, assign } from 'xstate'

export type FeedbackStatus =
  | 'submitted' | 'under_review' | 'accepted'
  | 'partially_accepted' | 'rejected' | 'closed'

export const feedbackMachine = setup({
  types: {
    context: {} as {
      feedbackId: string
      submitterId: string
      reviewerId: string | null
      rationale: string | null
    },
    events: {} as
      | { type: 'START_REVIEW'; reviewerId: string }
      | { type: 'ACCEPT'; rationale: string; reviewerId: string }
      | { type: 'PARTIALLY_ACCEPT'; rationale: string; reviewerId: string }
      | { type: 'REJECT'; rationale: string; reviewerId: string }
      | { type: 'CLOSE' },
  },
  guards: {
    hasRationale: ({ event }) =>
      'rationale' in event && event.rationale.trim().length > 0,
  },
  actions: {
    setReviewer: assign(({ event }) => ({
      reviewerId: 'reviewerId' in event ? event.reviewerId : null,
    })),
    setRationale: assign(({ event }) => ({
      rationale: 'rationale' in event ? event.rationale : null,
    })),
  },
}).createMachine({
  id: 'feedback',
  initial: 'submitted',
  states: {
    submitted: {
      on: {
        START_REVIEW: {
          target: 'under_review',
          actions: 'setReviewer',
        },
      },
    },
    under_review: {
      on: {
        ACCEPT: {
          target: 'accepted',
          guard: 'hasRationale',
          actions: 'setRationale',
        },
        PARTIALLY_ACCEPT: {
          target: 'partially_accepted',
          guard: 'hasRationale',
          actions: 'setRationale',
        },
        REJECT: {
          target: 'rejected',
          guard: 'hasRationale',
          actions: 'setRationale',
        },
      },
    },
    accepted:           { on: { CLOSE: 'closed' } },
    partially_accepted: { on: { CLOSE: 'closed' } },
    rejected:           { on: { CLOSE: 'closed' } },
    closed:             { type: 'final' },
  },
})
```

**Persistence pattern:** XState 5 machines must be persisted server-side. The pattern:
1. On state transition, call `actor.getSnapshot()` → JSON
2. Store snapshot in `feedback.xstate_snapshot` column
3. On next transition, restore via `createActor(feedbackMachine, { snapshot: storedSnapshot })`
4. Also update `feedback.status` to the string state name for direct SQL filtering

**Critical:** The `feedback.status` column drives all SQL queries and indexes. The `xstate_snapshot` is only used to resume the machine for transition validation — it is NOT the source of truth for status (the SQL column is).

### Section-Level Scoping Pattern (AUTH-05)

This is the most significant new middleware pattern in Phase 4.

```typescript
// src/server/rbac/section-access.ts
import { db } from '@/src/db'
import { sectionAssignments } from '@/src/db/schema/sectionAssignments'
import { and, eq } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import type { TRPCContext } from '@/src/trpc/init'
import type { Role } from '@/src/lib/constants'
import { t } from '@/src/trpc/init'  // access internal t instance

// Roles that bypass section-level scoping (see everything)
const BYPASS_SECTION_SCOPE: Role[] = ['admin', 'auditor', 'policy_lead']

export const requireSectionAccess = (inputKey: string = 'sectionId') =>
  t.middleware(async ({ ctx, rawInput, next }) => {
    const user = ctx.user
    if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' })

    // Admin/Policy Lead/Auditor bypass section scoping
    if (BYPASS_SECTION_SCOPE.includes(user.role as Role)) {
      return next({ ctx })
    }

    const sectionId = (rawInput as Record<string, unknown>)[inputKey] as string
    if (!sectionId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'sectionId required' })

    const [assignment] = await db
      .select()
      .from(sectionAssignments)
      .where(and(
        eq(sectionAssignments.userId, user.id),
        eq(sectionAssignments.sectionId, sectionId),
      ))
      .limit(1)

    if (!assignment) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Not assigned to this section' })
    }

    return next({ ctx })
  })
```

**Usage in router:**
```typescript
submit: requirePermission('feedback:submit')
  .use(requireSectionAccess('sectionId'))
  .input(feedbackSubmitSchema)
  .mutation(...)
```

**Scoping on list queries:** When fetching feedback for a stakeholder, the query must also filter by sections the user is assigned to:
```typescript
// If role is stakeholder, add subquery filter
const assignedSectionIds = await db
  .select({ id: sectionAssignments.sectionId })
  .from(sectionAssignments)
  .where(eq(sectionAssignments.userId, user.id))

const items = await db
  .select()
  .from(feedback)
  .where(inArray(feedback.sectionId, assignedSectionIds.map(r => r.id)))
```

### Privacy / Anonymous Attribution Pattern (AUTH-08)

Two layers of privacy:
1. **User-level default** (`users.privacy_preference` column): the user's default for new feedback submissions ('named' | 'anonymous')
2. **Per-feedback override** (`feedback.is_anonymous` boolean): can override the default at submission time

At display time:
```typescript
function resolveDisplayName(feedback: FeedbackRow, users: Map<string, User>): string {
  if (feedback.is_anonymous) return 'Anonymous Stakeholder'
  const user = users.get(feedback.submitter_id)
  return user?.name ?? 'Unknown'
}
```

**Important:** `is_anonymous` hides the submitter's name from the UI display. It does NOT hide the submitter from the DB — Policy Leads can still see who submitted (they need this for audit). The public portal sanitization (Phase 9) handles removing names from published output.

### Evidence Upload Pattern (EV-01, EV-02)

Extend the existing Uploadthing core router at `app/api/uploadthing/core.ts`:

```typescript
evidenceUploader: f({
  image: { maxFileSize: '16MB', maxFileCount: 5 },
  pdf:   { maxFileSize: '32MB', maxFileCount: 5 },
  blob:  { maxFileSize: '32MB', maxFileCount: 5 },
})
  .middleware(async () => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    return { userId }
  })
  .onUploadComplete(async ({ metadata, file }) => {
    return { url: file.ufsUrl, name: file.name, size: file.size }
  }),
```

After upload completes, call a separate tRPC mutation to register the artifact in `evidence_artifacts` and link to feedback:
```typescript
evidence.attach: requirePermission('evidence:upload')
  .input(z.object({
    feedbackId: z.string().uuid(),
    title: z.string().min(1),
    type: z.enum(['file', 'link']),
    url: z.string().url(),
    fileName: z.string().optional(),
    fileSize: z.number().optional(),
  }))
  .mutation(...)
```

### New Permissions Required

Extend `src/lib/permissions.ts`:

```typescript
// Section assignments management
'section:assign':         [ROLES.ADMIN, ROLES.POLICY_LEAD],
'section:read_assignments': [ROLES.ADMIN, ROLES.POLICY_LEAD],

// Feedback
'feedback:submit':        [ROLES.STAKEHOLDER, ROLES.RESEARCH_LEAD, ROLES.WORKSHOP_MODERATOR],
'feedback:read_own':      [ROLES.STAKEHOLDER, ROLES.RESEARCH_LEAD, ROLES.WORKSHOP_MODERATOR, ROLES.OBSERVER],
'feedback:read_all':      [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.AUDITOR],
'feedback:review':        [ROLES.ADMIN, ROLES.POLICY_LEAD],

// Evidence
'evidence:upload':        [ROLES.STAKEHOLDER, ROLES.RESEARCH_LEAD, ROLES.WORKSHOP_MODERATOR, ROLES.ADMIN, ROLES.POLICY_LEAD],
'evidence:read':          [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD, ROLES.WORKSHOP_MODERATOR, ROLES.STAKEHOLDER, ROLES.OBSERVER, ROLES.AUDITOR],
```

### New Audit Actions Required

Extend `src/lib/constants.ts` ACTIONS:

```typescript
// Section scoping
SECTION_ASSIGN:        'section.assign',
SECTION_UNASSIGN:      'section.unassign',

// Feedback lifecycle
FEEDBACK_SUBMIT:       'feedback.submit',
FEEDBACK_START_REVIEW: 'feedback.start_review',
FEEDBACK_ACCEPT:       'feedback.accept',
FEEDBACK_PARTIAL:      'feedback.partially_accept',
FEEDBACK_REJECT:       'feedback.reject',
FEEDBACK_CLOSE:        'feedback.close',

// Evidence
EVIDENCE_UPLOAD:       'evidence.upload',
EVIDENCE_ATTACH:       'evidence.attach',

// Privacy
PRIVACY_PREF_UPDATE:   'user.privacy_pref_update',
```

### New tRPC Router Structure

New router: `src/server/routers/feedback.ts`
New router: `src/server/routers/sectionAssignment.ts`
New router: `src/server/routers/evidence.ts`

Register all in `src/server/routers/_app.ts`:
```typescript
export const appRouter = router({
  user: userRouter,
  audit: auditRouter,
  document: documentRouter,
  feedback: feedbackRouter,         // NEW
  sectionAssignment: sectionAssignmentRouter, // NEW
  evidence: evidenceRouter,          // NEW
})
```

### New App Routes (Workspace)

New pages under `app/(workspace)/feedback/`:
```
app/(workspace)/feedback/
├── page.tsx                  # Policy Lead: feedback inbox (filterable list)
└── [id]/
    └── page.tsx              # Individual feedback detail/review
```

Stakeholder feedback visibility is via the section view (section page shows submit button + "my feedback" list). No separate `/feedback` route for stakeholders in Phase 4 — that is part of the UX dashboards (Phase 8).

### Recommended Project Structure for Phase 4

```
src/
├── db/schema/
│   ├── feedback.ts           # NEW: feedback table + enums
│   ├── sectionAssignments.ts # NEW: section_assignments table
│   ├── evidence.ts           # NEW: evidence_artifacts + join tables
│   └── index.ts              # UPDATED: export new schemas
├── db/migrations/
│   └── 0002_feedback_system.sql  # NEW: all Phase 4 tables
├── server/
│   ├── routers/
│   │   ├── feedback.ts       # NEW: submit, list, getById, review
│   │   ├── sectionAssignment.ts # NEW: assign, unassign, list
│   │   ├── evidence.ts       # NEW: attach, list, remove
│   │   └── _app.ts           # UPDATED: register new routers
│   ├── machines/
│   │   └── feedback.machine.ts # NEW: XState 5 feedback lifecycle
│   └── rbac/
│       └── section-access.ts # NEW: requireSectionAccess middleware
├── lib/
│   ├── permissions.ts        # UPDATED: add feedback/evidence/section permissions
│   └── constants.ts          # UPDATED: add feedback/evidence audit actions
└── __tests__/
    ├── feedback-permissions.test.ts  # NEW: permission matrix tests
    ├── feedback-machine.test.ts      # NEW: XState state machine unit tests
    └── section-assignments.test.ts   # NEW: scoping logic tests

app/(workspace)/
└── feedback/
    ├── page.tsx              # NEW: Policy Lead feedback inbox
    └── [id]/
        └── page.tsx          # NEW: Feedback detail + review

app/(workspace)/policies/[id]/_components/
└── feedback-panel.tsx        # NEW: Submit feedback form + my feedback list (per section)

app/api/uploadthing/
└── core.ts                   # UPDATED: add evidenceUploader endpoint
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Feedback lifecycle state machine | Custom status string + ad-hoc transition logic | XState 5 `setup().createMachine()` | Guards enforce mandatory rationale; impossible to reach invalid states; transitions are auditable |
| File upload handling | S3 presigned URLs + IAM config | Uploadthing (already installed) | One-line React hook `useUploadThing('evidenceUploader')`; handles CORS, CDN, type checking |
| Human-readable ID generation | UUID substring or timestamp-based IDs | PostgreSQL `nextval()` sequence | Atomic, crash-safe, sequential; readable IDs like FB-001 |
| Permission matrix | Per-route role checks | Extend existing PERMISSIONS object in `src/lib/permissions.ts` | Pattern is established; `requirePermission('feedback:submit')` composes with `requireSectionAccess` |
| Filtering UI state | Custom query param handling | `nuqs` (already in STACK.md) | URL-synced filter state; back-button works; shareable filter URLs |
| Form components | Custom form inputs | shadcn/ui Select, Textarea, Badge, Checkbox (already installed) | Accessible, styled, keyboard-navigable; matches existing UI |

**Key insight:** The most expensive trap in this phase is building a custom state machine for feedback lifecycle. Even a 6-state linear flow has guard conditions (rationale required before accept/reject), side effects (audit log, workflow_transitions write), and needs to be resumed from persisted state. XState 5 handles all of this with ~60 lines of type-safe code.

---

## Common Pitfalls

### Pitfall 1: Section Scoping Applied Inconsistently
**What goes wrong:** Apply `requireSectionAccess` to `feedback.submit` but forget to scope the `feedback.list` query. Stakeholder can list feedback from all sections even though they can only submit to assigned sections.
**Why it happens:** Submission gating is obvious; query filtering is easy to overlook.
**How to avoid:** All feedback queries for non-admin/non-policy_lead users MUST add a subquery filtering by the user's `section_assignments`. Write a test that verifies a stakeholder with one section assignment cannot see feedback from a different section.
**Warning signs:** No test covers "stakeholder sees only their sections' feedback in list."

### Pitfall 2: XState Machine Not Persisted Correctly
**What goes wrong:** Machine runs in memory, transition fires and returns success, but snapshot is not written to DB. On the next request (new serverless function instance), machine starts from `initial` state instead of `under_review`, allowing double-submission of a decision.
**Why it happens:** Serverless functions are stateless. XState actors do not persist themselves.
**How to avoid:** Every transition handler must: (1) restore actor from `feedback.xstate_snapshot`, (2) send event, (3) read new snapshot via `actor.getSnapshot()`, (4) write snapshot + status to DB atomically before returning. Never trust the in-memory actor state across requests.
**Warning signs:** Feedback can be accepted twice in a row without error.

### Pitfall 3: Rationale Guard Bypassed via Direct DB Update
**What goes wrong:** tRPC mutation `feedback.accept` correctly checks XState guard. But a future mutation (e.g., bulk operations in Phase 5) updates `feedback.status` directly without going through the machine, bypassing the rationale guard.
**Why it happens:** Direct SQL `UPDATE feedback SET status = 'accepted'` doesn't know about XState.
**How to avoid:** Create a single `transitionFeedback(id, event, db)` service function in `src/server/services/feedback.service.ts`. All status transitions MUST go through this function. Never write raw SQL updates to `feedback.status` from routers — call the service.
**Warning signs:** `feedback.status` is updated in a file that doesn't import `feedback.machine.ts`.

### Pitfall 4: Anonymous Feedback Leaks Submitter Identity
**What goes wrong:** Feedback list query returns `submitter_id` in the response payload. Client-side code resolves the name. For anonymous feedback, the is_anonymous flag is checked client-side only. API response still contains the real submitter UUID — a savvy user can look up the name from the user list.
**Why it happens:** Anonymization logic placed on the client rather than the server.
**How to avoid:** Server-side query must NULL out `submitter_id` for anonymous feedback before returning the response. Only Policy Lead and Admin see the real submitter (they need it for audit). Stakeholder and Observer list queries must apply:
```typescript
submitterId: feedback.isAnonymous ? null : feedback.submitterId
```
**Warning signs:** The tRPC `feedback.list` procedure returns `submitter_id` unconditionally.

### Pitfall 5: Uploadthing Returns URL Before DB Record Created
**What goes wrong:** `useUploadThing` hook fires `onUploadComplete` callback. The handler calls tRPC `evidence.attach`. But if the tRPC mutation fails (network error, validation error), the file exists in Uploadthing storage but has no DB record. Over time, orphaned files accumulate.
**Why it happens:** Uploadthing upload and DB record creation are two separate async operations with no transaction boundary.
**How to avoid:** In `onUploadComplete` handler, always create the DB record. If the tRPC call fails, surface an error to the user and log it. Accept that some orphaned files may exist — add a periodic cleanup job (Phase 10+). Do NOT try to delete from Uploadthing on failure (adds complexity and race conditions).
**Warning signs:** No error handling on the tRPC call inside `onUploadComplete`.

### Pitfall 6: Feedback Counter Gap on Transaction Rollback
**What goes wrong:** `nextval('feedback_id_seq')` is called and returns 42. The feedback INSERT fails. The sequence never returns 42 again. You get FB-041, FB-043 — a gap in the sequence.
**Why it happens:** PostgreSQL sequences are not transactional (by design, to avoid contention).
**How to avoid:** Accept gaps. FB-001 through FB-999 are human-readable IDs, not integrity-critical numbers. Document this behavior. Do NOT use the sequence gap as evidence of a deleted record. Gaps are normal.
**Warning signs:** Code that checks `MAX(sequence) + 1` to detect missing feedback — don't do this.

### Pitfall 7: `requireSectionAccess` Middleware Cannot Read `rawInput` for All Input Shapes
**What goes wrong:** The middleware accesses `rawInput[inputKey]` to get the `sectionId`. But some procedures nest input (e.g., `input.data.sectionId`). The middleware gets `undefined` and either throws BAD_REQUEST or silently passes.
**Why it happens:** tRPC `rawInput` is the raw unvalidated object — shape depends on how the procedure is called.
**How to avoid:** Always design feedback-related input schemas to have `sectionId` at the top level. Document this contract. Enforce it in tests.
**Warning signs:** A feedback procedure has `input.sectionData.sectionId` instead of `input.sectionId`.

---

## Code Examples

### XState 5 Machine Persistence in a tRPC Mutation

```typescript
// Source: XState 5 docs + project pattern
import { createActor } from 'xstate'
import { feedbackMachine } from '@/src/server/machines/feedback.machine'
import { db } from '@/src/db'
import { feedback } from '@/src/db/schema/feedback'
import { eq } from 'drizzle-orm'

async function transitionFeedback(
  feedbackId: string,
  event: Parameters<typeof feedbackMachine.transition>[1],
  db: DB,
): Promise<void> {
  const [row] = await db.select().from(feedback).where(eq(feedback.id, feedbackId)).limit(1)
  if (!row) throw new TRPCError({ code: 'NOT_FOUND' })

  // Restore machine from persisted snapshot
  const actor = createActor(feedbackMachine, {
    snapshot: row.xstateSnapshot ?? undefined,
    input: {
      feedbackId: row.id,
      submitterId: row.submitterId,
      reviewerId: row.reviewedBy,
      rationale: row.decisionRationale,
    },
  })
  actor.start()

  // Send event (XState validates guard conditions)
  actor.send(event)

  const newSnapshot = actor.getSnapshot()
  if (!newSnapshot.status) throw new Error('Machine transition failed')

  // Persist new state atomically
  await db.update(feedback).set({
    status: newSnapshot.value as string,
    xstateSnapshot: newSnapshot as Record<string, unknown>,
    updatedAt: new Date(),
    ...(event.type === 'ACCEPT' || event.type === 'PARTIALLY_ACCEPT' || event.type === 'REJECT'
      ? { decisionRationale: event.rationale, reviewedAt: new Date() }
      : {}),
  }).where(eq(feedback.id, feedbackId))

  actor.stop()
}
```

### Feedback List Query with Scoping

```typescript
// Source: Drizzle ORM pattern + section scoping design
import { db } from '@/src/db'
import { feedback, sectionAssignments } from '@/src/db/schema'
import { eq, inArray, and } from 'drizzle-orm'
import type { Role } from '@/src/lib/constants'

const ADMIN_ROLES: Role[] = ['admin', 'policy_lead', 'auditor']

async function listFeedbackForUser(
  user: { id: string; role: Role },
  filters: { sectionId?: string; status?: string },
) {
  const isAdmin = ADMIN_ROLES.includes(user.role)
  const conditions = []

  if (!isAdmin) {
    // Scope to assigned sections only
    const assignments = await db
      .select({ sectionId: sectionAssignments.sectionId })
      .from(sectionAssignments)
      .where(eq(sectionAssignments.userId, user.id))
    const sectionIds = assignments.map(a => a.sectionId)
    if (sectionIds.length === 0) return []
    conditions.push(inArray(feedback.sectionId, sectionIds))
  }

  if (filters.sectionId) conditions.push(eq(feedback.sectionId, filters.sectionId))
  if (filters.status) conditions.push(eq(feedback.status, filters.status as any))

  const rows = await db.select().from(feedback).where(and(...conditions))

  // Strip submitter identity for anonymous items (non-admin users)
  return rows.map(row => ({
    ...row,
    submitterId: (!isAdmin && row.isAnonymous) ? null : row.submitterId,
  }))
}
```

### Drizzle Schema for Feedback (Concise)

```typescript
// src/db/schema/feedback.ts
import { pgTable, uuid, text, boolean, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core'
import { users } from './users'
import { policySections, policyDocuments } from './documents'

export const feedbackTypeEnum = pgEnum('feedback_type',
  ['issue', 'suggestion', 'endorsement', 'evidence', 'question'])
export const feedbackPriorityEnum = pgEnum('feedback_priority', ['low', 'medium', 'high'])
export const impactCategoryEnum = pgEnum('impact_category',
  ['legal', 'security', 'tax', 'consumer', 'innovation', 'clarity', 'governance', 'other'])
export const feedbackStatusEnum = pgEnum('feedback_status',
  ['submitted', 'under_review', 'accepted', 'partially_accepted', 'rejected', 'closed'])

export const feedbackItems = pgTable('feedback', {
  id:                uuid('id').primaryKey().defaultRandom(),
  readableId:        text('readable_id').notNull().unique(),
  sectionId:         uuid('section_id').notNull().references(() => policySections.id),
  documentId:        uuid('document_id').notNull().references(() => policyDocuments.id),
  submitterId:       uuid('submitter_id').notNull().references(() => users.id),
  feedbackType:      feedbackTypeEnum('feedback_type').notNull(),
  priority:          feedbackPriorityEnum('priority').notNull().default('medium'),
  impactCategory:    impactCategoryEnum('impact_category').notNull().default('other'),
  title:             text('title').notNull(),
  body:              text('body').notNull(),
  suggestedChange:   text('suggested_change'),
  status:            feedbackStatusEnum('status').notNull().default('submitted'),
  isAnonymous:       boolean('is_anonymous').notNull().default(false),
  decisionRationale: text('decision_rationale'),
  reviewedBy:        uuid('reviewed_by').references(() => users.id),
  reviewedAt:        timestamp('reviewed_at', { withTimezone: true }),
  xstateSnapshot:    jsonb('xstate_snapshot').$type<Record<string, unknown>>(),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| XState 4 `createMachine()` | XState 5 `setup().createMachine()` | XState 5.0 (Dec 2023) | Must use `setup()` for TypeScript inference; old API removed |
| XState 5 `interpret()` | XState 5 `createActor()` | XState 5.0 | `interpret` is gone; use `createActor` |
| tRPC v10 context pattern | tRPC v11 `createTRPCReact` + `t.createCallerFactory` | tRPC v11 (2024) | Already in codebase from Phase 1; don't revert to v10 patterns |
| Drizzle `db.transaction()` | Sequential updates (Neon HTTP driver) | Phase 2 decision | Neon HTTP driver may not support transactions; Phase 2 used sequential updates for section reorder — same pattern applies here for multi-step feedback creation |

**Deprecated/outdated:**
- `createMachine()` as top-level XState import: replaced by `setup().createMachine()`
- `interpret()` as XState actor factory: replaced by `createActor()`
- `useMachine()` for server-side usage: use `createActor()` on server, `useMachine()` only in React components

---

## Open Questions

1. **Neon HTTP driver + multi-insert transactions**
   - What we know: Phase 2 used sequential updates (not transactions) for Neon HTTP driver compatibility
   - What's unclear: Can `feedback` creation (INSERT feedback + INSERT evidence_artifacts + INSERT feedback_evidence) be wrapped in a transaction, or must it be sequential?
   - Recommendation: Test with `db.transaction()` in Wave 0. If it fails, fall back to sequential inserts with cleanup on error (best-effort).

2. **Section assignment UI for Admin/Policy Lead**
   - What we know: `section_assignments` table exists in the plan; needs UI to manage
   - What's unclear: Is this a dedicated `/admin/assignments` page, or an inline panel on the section editor?
   - Recommendation: Inline panel on the section page (dropdown to add users to section) is fastest to build and most contextual. Keep it simple for Phase 4; a full admin UI ships in Phase 8.

3. **`requireSectionAccess` middleware access to `rawInput`**
   - What we know: tRPC v11 middleware receives `rawInput`; shape depends on caller
   - What's unclear: Does tRPC v11 pass `rawInput` before Zod validation, or after? If after, the types are cleaner; if before, string/UUID validation may fail silently
   - Recommendation: Test with a simple procedure before building the full middleware. Read `node_modules/next/dist/docs/` for any v11-specific middleware behavior per AGENTS.md directive.

4. **Privacy preference column placement**
   - What we know: AUTH-08 requires a user-level privacy default; per-feedback `is_anonymous` already planned
   - What's unclear: Should `privacy_preference` go on `users` table (Phase 4 schema update) or in a separate `user_preferences` table (extensible)?
   - Recommendation: Add `privacy_preference` directly to `users` table for simplicity. A separate preferences table is premature optimization for Phase 4.

---

## Environment Availability

> This phase adds XState 5 (not yet installed) but no external services beyond what's already operational.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL (Neon) | All schema tables | ✓ | Phase 1 established | — |
| Drizzle ORM | Schema + migrations | ✓ | 0.45.1 | — |
| tRPC v11 | All API procedures | ✓ | 11.15.0 | — |
| Uploadthing | Evidence file uploads | ✓ | 7.7.4 | — |
| Clerk | Auth context in middleware | ✓ | 7.0.6 | — |
| Vitest | Test framework | ✓ | 4.1.1 | — |
| xstate | Feedback state machine | ✗ | — (5.29.0 on npm) | Cannot omit — required by decision |
| @xstate/react | React hooks for machine | ✗ | — (6.1.0 on npm) | Cannot omit — required by decision |

**Missing dependencies with no fallback:**
- `xstate@5.29.0` and `@xstate/react@6.1.0` — must be installed in Wave 0 before any machine code is written

**Missing dependencies with fallback:**
- None

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.mts` (exists from Phase 1) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FB-01 | `feedback:submit` permission granted only to correct roles | unit | `npm test -- feedback-permissions` | ❌ Wave 0 |
| FB-02 | `generateFeedbackId()` returns `FB-001` format; increments sequentially | unit | `npm test -- feedback-id` | ❌ Wave 0 |
| FB-03 | Feedback schema rejects invalid type/priority/impact enum values | unit | `npm test -- feedback-schema` | ❌ Wave 0 |
| FB-06 | XState machine transitions: submitted → under_review → accepted | unit | `npm test -- feedback-machine` | ❌ Wave 0 |
| FB-07 | XState guard blocks accept/reject without rationale | unit | `npm test -- feedback-machine` | ❌ Wave 0 |
| FB-08 | `listFeedbackForUser` nulls out submitterId for anonymous items for non-admin | unit | `npm test -- feedback-privacy` | ❌ Wave 0 |
| FB-09 | Stakeholder cannot read feedback submitted by others on their section | unit | `npm test -- feedback-permissions` | ❌ Wave 0 |
| FB-10 | Feedback list filters by section, status, priority, type | unit | `npm test -- feedback-filters` | ❌ Wave 0 |
| AUTH-05 | Stakeholder with no section assignment cannot submit feedback | unit | `npm test -- section-assignments` | ❌ Wave 0 |
| AUTH-05 | Stakeholder with assignment to section A cannot see section B feedback | unit | `npm test -- section-assignments` | ❌ Wave 0 |
| AUTH-08 | `privacy_preference` column defaults to 'named'; per-feedback override works | unit | `npm test -- feedback-privacy` | ❌ Wave 0 |
| EV-01 | `evidence.attach` rejects unauthenticated user | unit | `npm test -- evidence-permissions` | ❌ Wave 0 |
| EV-02 | Evidence artifact links to feedback via `feedback_evidence` join | unit | `npm test -- evidence-attach` | ❌ Wave 0 |

**Manual-only verifications** (UI/form behavior):
- FB-01: Submit feedback form appears on section page for stakeholder with assignment
- FB-03: Type/priority/impact dropdowns show correct options; form validates before submit
- FB-05: Evidence upload widget accepts files, shows progress, links to feedback
- FB-10: Policy Lead feedback inbox filters update URL params and reload correctly

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

All test files are new — none exist yet:

- [ ] `src/__tests__/feedback-permissions.test.ts` — covers FB-01, FB-09, AUTH-05
- [ ] `src/__tests__/feedback-machine.test.ts` — covers FB-06, FB-07 (pure XState unit tests, no DB)
- [ ] `src/__tests__/feedback-schema.test.ts` — covers FB-03 (Zod schema validation)
- [ ] `src/__tests__/section-assignments.test.ts` — covers AUTH-05
- [ ] `src/__tests__/feedback-privacy.test.ts` — covers FB-08, AUTH-08
- [ ] Framework install: `npm install xstate@5.29.0 @xstate/react@6.1.0`

---

## Sources

### Primary (HIGH confidence)

- Existing codebase: `src/lib/permissions.ts` — permission matrix pattern; verified role + permission structure
- Existing codebase: `src/trpc/init.ts` — tRPC middleware pattern; `requirePermission` + `protectedProcedure` composition
- Existing codebase: `src/db/schema/workflow.ts` — `workflowTransitions` table exists; Phase 4 must write to it
- Existing codebase: `src/db/schema/documents.ts` — `policySections` table structure; confirmed stable UUID as PK
- Existing codebase: `app/api/uploadthing/core.ts` — existing Uploadthing route structure to extend
- Existing codebase: `src/lib/audit.ts` — `writeAuditLog()` API signature; confirmed single-function pattern
- `.planning/research/ARCHITECTURE.md` — Section-level RBAC design (Pattern 5); Feedback submission flow (Flow 1); `section_assignments` table design
- `.planning/research/STACK.md` — XState 5.28.x (confirmed 5.29.0 current); `@xstate/react` 6.1.0

### Secondary (MEDIUM confidence)

- npm registry: `xstate@5.29.0` confirmed current (checked 2026-03-25)
- npm registry: `@xstate/react@6.1.0` confirmed current (checked 2026-03-25)
- XState v5 architecture (from STACK.md with reference to stately.ai announcement): `setup().createMachine()` API, `createActor()` replaces `interpret()`
- `.planning/STATE.md` accumulated decisions: Neon HTTP sequential updates (not transactions), Phase 2 pattern

### Tertiary (LOW confidence)

- tRPC v11 `rawInput` behavior in middleware (pre- vs post-Zod validation): not directly tested — flagged as Open Question 3

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — XState 5 and @xstate/react versions verified on npm; all other packages already in package.json
- Architecture: HIGH — section scoping, machine persistence, and anonymous attribution patterns derived from existing codebase conventions and ARCHITECTURE.md
- Pitfalls: HIGH — all 7 pitfalls derived from direct codebase analysis or established patterns
- Schema design: HIGH — follows exact patterns of existing Drizzle schemas (documents.ts, users.ts)
- XState 5 API: MEDIUM — `setup().createMachine()` and `createActor()` are documented in STACK.md; not verified against installed package (not yet installed)

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable libraries; XState 5 minor versions release slowly)

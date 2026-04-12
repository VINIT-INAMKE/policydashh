# Document Router RBAC Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the data leak in `documentRouter` by making `list`, `getById`, and `getSections` role-aware, so non-privileged roles (stakeholder, observer, research_lead, workshop_moderator) only see published policy documents and only the sections they are assigned to.

**Architecture:** Introduce a new permission `document:read_all` granted to admin, policy_lead, and auditor (the same set as the existing `BYPASS_SECTION_SCOPE` in `src/server/rbac/section-access.ts`). The three read procedures call `can(ctx.user.role, 'document:read_all')`: if true they keep the current unfiltered query; otherwise they add a `documentVersions.isPublished = true` existence check (for `list` and `getById`) or an `inArray` subquery against `sectionAssignments` (for `getSections`). This mirrors the existing role-aware branching in `feedback.listCrossPolicy` (`src/server/routers/feedback.ts:199-217`) so the pattern stays consistent across the codebase.

**Tech Stack:** Next.js 16 App Router, tRPC 11, Drizzle ORM against Neon Postgres, Vitest with jsdom. No new dependencies.

---

## Scope notes (read before starting)

- **Single permission split, no schema migration.** `document:read` stays as-is (granted to every authenticated role — it's the "can you call the read procedures at all" permission). The new `document:read_all` is a capability flag that short-circuits the scoping. No database migration. No changes to `users`, `policyDocuments`, `documentVersions`, `policySections`, or `sectionAssignments`.
- **The privileged set is `admin | policy_lead | auditor`.** These are the roles that already bypass section access in `src/server/rbac/section-access.ts:10` (`BYPASS_SECTION_SCOPE`). Use the same set for `document:read_all` to keep one mental model. Do NOT reuse the constant — the permission catalog is the single source of truth for permission grants. Duplication here is intentional and load-bearing.
- **"Published" means `documentVersions.isPublished = true`.** A policy document is "published" iff it has at least one row in `documentVersions` with `isPublished = true`. There is no `isPublished` flag on `policyDocuments` itself. This is identical to the pattern used by the public portal at `app/(public)/portal/page.tsx:18-46`, which is the canonical reference.
- **"Assigned sections" means a row in `sectionAssignments` with the caller's userId.** The table has a unique constraint on `(user_id, section_id)` so each pairing appears at most once (`src/db/schema/sectionAssignments.ts:12`). There is no "revoked" or "expired" flag — an assignment exists or it doesn't.
- **Do NOT filter `sectionCount` in `list`.** A stakeholder seeing "Policy X has 20 sections (3 assigned to you)" is fine; the section *metadata count* does not leak content. We're gating access to section bodies, not their existence. Filtering the count is a follow-up UX decision, not a security fix.
- **Do NOT touch `sectionAssignment.listByUser` in this plan.** The audit flagged a minor concern there (it takes `userId` from input rather than `ctx.user.id`). That's a separate fix for a separate plan.
- **Do NOT touch workshops, feedback routers, or portal routes.** They were audited and are correct. Scope creep on this plan will get reverted.
- **`NOT_FOUND` vs `FORBIDDEN` for `getById`.** When a stakeholder requests an unpublished document by UUID, throw `NOT_FOUND`, not `FORBIDDEN`. Returning `FORBIDDEN` leaks the fact that the document exists. `NOT_FOUND` is the correct behavior for "you can't see this" on a resource you shouldn't know about.

## File Structure

**Modified files:**
- `src/lib/permissions.ts` — add the new `document:read_all` key to the `PERMISSIONS` object. (~1 line.)
- `src/server/routers/document.ts` — rewrite the three read procedures (`list` lines 12-49, `getById` lines 52-66, `getSections` lines 68-79) and add imports for `can`, `exists`, `inArray`, `and`, `documentVersions`, `sectionAssignments`. (~80 lines changed.)

**New files:**
- `src/__tests__/document-router-scope.test.ts` — Vitest integration tests that mock the Drizzle chain and assert the procedures add scoping filters for non-privileged roles. Mirrors `src/__tests__/feedback-cross-policy.test.ts`.

**Untouched:**
- All existing tests pass unchanged.
- `src/server/rbac/section-access.ts` — the `BYPASS_SECTION_SCOPE` constant is NOT touched. It governs the middleware used by `feedback.submit`; we're gating a different code path.
- `src/db/schema/*` — no migrations.

---

## Task 1: Add `document:read_all` permission

**Files:**
- Modify: `src/lib/permissions.ts:16-20`

- [ ] **Step 1: Open `src/lib/permissions.ts` and locate the "Document management" block**

The block currently reads (lines 16-20):

```ts
  // Document management
  'document:create':      [ROLES.ADMIN, ROLES.POLICY_LEAD] as readonly Role[],
  'document:read':        [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD, ROLES.WORKSHOP_MODERATOR, ROLES.STAKEHOLDER, ROLES.OBSERVER, ROLES.AUDITOR] as readonly Role[],
  'document:update':      [ROLES.ADMIN, ROLES.POLICY_LEAD] as readonly Role[],
  'document:delete':      [ROLES.ADMIN, ROLES.POLICY_LEAD] as readonly Role[],
```

- [ ] **Step 2: Add the new permission key directly after `document:read`**

The block becomes:

```ts
  // Document management
  'document:create':      [ROLES.ADMIN, ROLES.POLICY_LEAD] as readonly Role[],
  'document:read':        [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD, ROLES.WORKSHOP_MODERATOR, ROLES.STAKEHOLDER, ROLES.OBSERVER, ROLES.AUDITOR] as readonly Role[],
  'document:read_all':    [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.AUDITOR] as readonly Role[],
  'document:update':      [ROLES.ADMIN, ROLES.POLICY_LEAD] as readonly Role[],
  'document:delete':      [ROLES.ADMIN, ROLES.POLICY_LEAD] as readonly Role[],
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. The `PERMISSIONS` object has `as const`-like shape and the `Permission` type alias will automatically include `'document:read_all'`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/permissions.ts
git commit -m "feat(rbac): add document:read_all permission"
```

---

## Task 2: Role-aware `document.list`

**Files:**
- Modify: `src/server/routers/document.ts` (lines 1-49)

- [ ] **Step 1: Update imports at the top of `src/server/routers/document.ts`**

Current imports (lines 1-8):

```ts
import { z } from 'zod'
import { router, requirePermission } from '@/src/trpc/init'
import { db } from '@/src/db'
import { policyDocuments, policySections } from '@/src/db/schema/documents'
import { eq, and, asc, desc, sql, count } from 'drizzle-orm'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS } from '@/src/lib/constants'
import { TRPCError } from '@trpc/server'
```

Replace with (adding `exists`, `inArray`, the schema imports for `documentVersions` and `sectionAssignments`, and the `can` helper):

```ts
import { z } from 'zod'
import { router, requirePermission } from '@/src/trpc/init'
import { db } from '@/src/db'
import { policyDocuments, policySections } from '@/src/db/schema/documents'
import { documentVersions } from '@/src/db/schema/changeRequests'
import { sectionAssignments } from '@/src/db/schema/sectionAssignments'
import { eq, and, asc, desc, sql, count, exists, inArray } from 'drizzle-orm'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS } from '@/src/lib/constants'
import { can } from '@/src/lib/permissions'
import { TRPCError } from '@trpc/server'
```

If `count` is not currently used elsewhere in the file, TypeScript may flag it as unused — it's in the original import list so leave it alone; if tsc errors on it, remove it.

- [ ] **Step 2: Replace the `list` procedure body**

The current procedure (lines 12-49) reads:

```ts
  list: requirePermission('document:read')
    .input(z.object({ includeSections: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      const docs = await db
        .select({
          id: policyDocuments.id,
          title: policyDocuments.title,
          description: policyDocuments.description,
          createdAt: policyDocuments.createdAt,
          updatedAt: policyDocuments.updatedAt,
          sectionCount: sql<number>`cast(count(${policySections.id}) as integer)`,
        })
        .from(policyDocuments)
        .leftJoin(policySections, eq(policyDocuments.id, policySections.documentId))
        .groupBy(policyDocuments.id)
        .orderBy(desc(policyDocuments.updatedAt))

      const allSections = input?.includeSections
        ? await db
            .select({
              id: policySections.id,
              documentId: policySections.documentId,
              title: policySections.title,
              orderIndex: policySections.orderIndex,
              content: policySections.content,
            })
            .from(policySections)
            .orderBy(asc(policySections.orderIndex))
        : []

      const sectionsByDoc = new Map<string, typeof allSections>()
      for (const s of allSections) {
        if (!sectionsByDoc.has(s.documentId)) sectionsByDoc.set(s.documentId, [])
        sectionsByDoc.get(s.documentId)!.push(s)
      }

      return docs.map((d) => ({ ...d, sections: sectionsByDoc.get(d.id) ?? [] }))
    }),
```

Replace with:

```ts
  list: requirePermission('document:read')
    .input(z.object({ includeSections: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const canReadAll = can(ctx.user.role, 'document:read_all')

      // Non-privileged roles only see documents that have at least one
      // published version. Privileged roles (admin/policy_lead/auditor)
      // see drafts too.
      const publishedExists = exists(
        db
          .select({ one: sql`1` })
          .from(documentVersions)
          .where(
            and(
              eq(documentVersions.documentId, policyDocuments.id),
              eq(documentVersions.isPublished, true),
            ),
          ),
      )

      const scopeWhere = canReadAll ? undefined : publishedExists

      const docs = await db
        .select({
          id: policyDocuments.id,
          title: policyDocuments.title,
          description: policyDocuments.description,
          createdAt: policyDocuments.createdAt,
          updatedAt: policyDocuments.updatedAt,
          sectionCount: sql<number>`cast(count(${policySections.id}) as integer)`,
        })
        .from(policyDocuments)
        .leftJoin(policySections, eq(policyDocuments.id, policySections.documentId))
        .where(scopeWhere)
        .groupBy(policyDocuments.id)
        .orderBy(desc(policyDocuments.updatedAt))

      // When sections are requested inline, also scope them: non-privileged
      // callers only get sections they're assigned to.
      const allSections = input?.includeSections
        ? await db
            .select({
              id: policySections.id,
              documentId: policySections.documentId,
              title: policySections.title,
              orderIndex: policySections.orderIndex,
              content: policySections.content,
            })
            .from(policySections)
            .where(
              canReadAll
                ? undefined
                : inArray(
                    policySections.id,
                    db
                      .select({ id: sectionAssignments.sectionId })
                      .from(sectionAssignments)
                      .where(eq(sectionAssignments.userId, ctx.user.id)),
                  ),
            )
            .orderBy(asc(policySections.orderIndex))
        : []

      const sectionsByDoc = new Map<string, typeof allSections>()
      for (const s of allSections) {
        if (!sectionsByDoc.has(s.documentId)) sectionsByDoc.set(s.documentId, [])
        sectionsByDoc.get(s.documentId)!.push(s)
      }

      return docs.map((d) => ({ ...d, sections: sectionsByDoc.get(d.id) ?? [] }))
    }),
```

Key changes from the original:
1. The `.query` handler now destructures `ctx` in addition to `input`.
2. `canReadAll` short-circuits scoping when the caller has `document:read_all`.
3. The main query adds `.where(scopeWhere)` — `undefined` is a no-op in Drizzle so privileged callers get the exact same query as before.
4. The inline `includeSections` sub-query also scopes by assignment when the caller is non-privileged.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

If TypeScript complains about `.where(undefined)`, Drizzle is fine with it — but if your specific Drizzle version types it as required, use `canReadAll ? sql\`true\` : publishedExists` instead.

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/document.ts
git commit -m "fix(rbac): scope document.list to published docs for non-privileged roles"
```

---

## Task 3: Role-aware `document.getById`

**Files:**
- Modify: `src/server/routers/document.ts` (lines for the `getById` procedure)

- [ ] **Step 1: Locate the `getById` procedure**

After Task 2's edit, the `getById` procedure follows the `list` procedure. It currently reads:

```ts
  // Get a single document by ID
  getById: requirePermission('document:read')
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const [doc] = await db
        .select()
        .from(policyDocuments)
        .where(eq(policyDocuments.id, input.id))
        .limit(1)

      if (!doc) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
      }

      return doc
    }),
```

- [ ] **Step 2: Replace with the role-aware version**

```ts
  // Get a single document by ID. Non-privileged roles only see published
  // documents; an unpublished document is indistinguishable from a
  // non-existent one (we throw NOT_FOUND, not FORBIDDEN, to avoid leaking
  // existence).
  getById: requirePermission('document:read')
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const canReadAll = can(ctx.user.role, 'document:read_all')

      const idMatch = eq(policyDocuments.id, input.id)
      const whereClause = canReadAll
        ? idMatch
        : and(
            idMatch,
            exists(
              db
                .select({ one: sql`1` })
                .from(documentVersions)
                .where(
                  and(
                    eq(documentVersions.documentId, policyDocuments.id),
                    eq(documentVersions.isPublished, true),
                  ),
                ),
            ),
          )

      const [doc] = await db
        .select()
        .from(policyDocuments)
        .where(whereClause)
        .limit(1)

      if (!doc) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
      }

      return doc
    }),
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/document.ts
git commit -m "fix(rbac): scope document.getById to published docs for non-privileged roles"
```

---

## Task 4: Role-aware `document.getSections`

**Files:**
- Modify: `src/server/routers/document.ts` (the `getSections` procedure)

- [ ] **Step 1: Locate the current `getSections` procedure**

```ts
  // Get all sections for a document, ordered by orderIndex
  getSections: requirePermission('document:read')
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ input }) => {
      const sections = await db
        .select()
        .from(policySections)
        .where(eq(policySections.documentId, input.documentId))
        .orderBy(asc(policySections.orderIndex))

      return sections
    }),
```

- [ ] **Step 2: Replace with the role-aware version**

```ts
  // Get all sections for a document, ordered by orderIndex. Non-privileged
  // roles only see sections they are assigned to via sectionAssignments;
  // the inArray subquery narrows the result set without changing the row
  // shape (in contrast to an innerJoin, which would return a joined row).
  getSections: requirePermission('document:read')
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const canReadAll = can(ctx.user.role, 'document:read_all')

      const baseWhere = eq(policySections.documentId, input.documentId)
      const whereClause = canReadAll
        ? baseWhere
        : and(
            baseWhere,
            inArray(
              policySections.id,
              db
                .select({ id: sectionAssignments.sectionId })
                .from(sectionAssignments)
                .where(eq(sectionAssignments.userId, ctx.user.id)),
            ),
          )

      const sections = await db
        .select()
        .from(policySections)
        .where(whereClause)
        .orderBy(asc(policySections.orderIndex))

      return sections
    }),
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/document.ts
git commit -m "fix(rbac): scope document.getSections to assigned sections for non-privileged roles"
```

---

## Task 5: Integration tests for the scoping behavior

**Files:**
- Create: `src/__tests__/document-router-scope.test.ts`

This task mirrors the structure of the existing `src/__tests__/feedback-cross-policy.test.ts` — a structural test that mocks the Drizzle chain and asserts the query received the expected where-shape depending on role. It does not require a live database.

- [ ] **Step 1: Read the existing pattern**

Open `src/__tests__/feedback-cross-policy.test.ts` and read it end-to-end. Note specifically:
- How `vi.mock('@/src/db', ...)` returns a chainable object whose terminal call (`.orderBy()` or similar) resolves with fake rows.
- How `vi.mock('drizzle-orm', ...)` wraps operators (`eq`, `and`, `inArray`) with tagged-object fakes so the test can inspect them.
- How `mkCtx(role, userId)` builds a fake tRPC context.
- How `createCallerFactory` is used to call the router without HTTP.

The same pattern works here. Do NOT try to write a cleaner or more opinionated test harness — parallel structure across test files is more valuable than incremental polish.

- [ ] **Step 2: Create the test file**

Create `src/__tests__/document-router-scope.test.ts` with this exact content:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// The chain mock records every where-clause the router builds so the
// assertions below can look at its shape without needing a real Postgres.
type WhereSnapshot = unknown

let __recordedWheres: WhereSnapshot[] = []
let __selectResult: unknown[] = []

function makeChain() {
  const chain: any = {
    select: () => chain,
    selectDistinct: () => chain,
    from: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    where: (cond: WhereSnapshot) => {
      __recordedWheres.push(cond)
      return chain
    },
    groupBy: () => chain,
    orderBy: () => Promise.resolve(__selectResult),
    limit: () => Promise.resolve(__selectResult),
  }
  return chain
}

vi.mock('@/src/db', () => ({ db: makeChain() }))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq: (col: any, val: any) => ({ __type: 'eq', col, val }),
    and: (...conds: any[]) => ({ __type: 'and', conds: conds.filter(Boolean) }),
    asc: (col: any) => ({ __type: 'asc', col }),
    desc: (col: any) => ({ __type: 'desc', col }),
    inArray: (col: any, values: any) => ({ __type: 'inArray', col, values }),
    exists: (sub: any) => ({ __type: 'exists', sub }),
    sql: actual.sql,
  }
})

vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: null }) }))
vi.mock('@/src/lib/audit', () => ({ writeAuditLog: vi.fn(async () => {}) }))

import { documentRouter } from '@/src/server/routers/document'
import { createCallerFactory } from '@/src/trpc/init'

const createCaller = createCallerFactory(documentRouter)

function mkCtx(role: string, userId = 'user-1') {
  return {
    headers: new Headers(),
    userId: 'clerk-' + userId,
    user: { id: userId, role, clerkId: 'clerk-' + userId },
  } as any
}

function containsType(node: any, type: string): boolean {
  if (!node || typeof node !== 'object') return false
  if (node.__type === type) return true
  if (Array.isArray(node)) return node.some((n) => containsType(n, type))
  for (const key of Object.keys(node)) {
    if (containsType(node[key], type)) return true
  }
  return false
}

beforeEach(() => {
  __recordedWheres = []
  __selectResult = []
})

describe('documentRouter.list scoping', () => {
  it('admin call does not add an "exists(published version)" guard', async () => {
    const caller = createCaller(mkCtx('admin'))
    await caller.list()
    // At least one where call should have fired (the main select).
    // For admins the scopeWhere is undefined, so no "exists" appears in
    // the recorded wheres.
    const anyExists = __recordedWheres.some((w) => containsType(w, 'exists'))
    expect(anyExists).toBe(false)
  })

  it('stakeholder call adds an exists-based published-version guard', async () => {
    const caller = createCaller(mkCtx('stakeholder'))
    await caller.list()
    const anyExists = __recordedWheres.some((w) => containsType(w, 'exists'))
    expect(anyExists).toBe(true)
  })

  it('observer call adds an exists-based published-version guard', async () => {
    const caller = createCaller(mkCtx('observer'))
    await caller.list()
    const anyExists = __recordedWheres.some((w) => containsType(w, 'exists'))
    expect(anyExists).toBe(true)
  })
})

describe('documentRouter.getById scoping', () => {
  it('admin call uses only the id match, no exists', async () => {
    __selectResult = [{ id: 'doc-1', title: 'Draft policy' }]
    const caller = createCaller(mkCtx('admin'))
    await caller.getById({ id: '00000000-0000-0000-0000-000000000001' })
    const anyExists = __recordedWheres.some((w) => containsType(w, 'exists'))
    expect(anyExists).toBe(false)
  })

  it('stakeholder call wraps the id match in an exists guard', async () => {
    __selectResult = [{ id: 'doc-1', title: 'Published policy' }]
    const caller = createCaller(mkCtx('stakeholder'))
    await caller.getById({ id: '00000000-0000-0000-0000-000000000001' })
    const anyExists = __recordedWheres.some((w) => containsType(w, 'exists'))
    expect(anyExists).toBe(true)
  })

  it('stakeholder call on a missing doc throws NOT_FOUND (not FORBIDDEN)', async () => {
    __selectResult = []
    const caller = createCaller(mkCtx('stakeholder'))
    await expect(
      caller.getById({ id: '00000000-0000-0000-0000-000000000001' }),
    ).rejects.toThrow(/not found/i)
  })
})

describe('documentRouter.getSections scoping', () => {
  it('admin call does not add an inArray assignment guard', async () => {
    const caller = createCaller(mkCtx('admin'))
    await caller.getSections({ documentId: '00000000-0000-0000-0000-000000000001' })
    const anyInArray = __recordedWheres.some((w) => containsType(w, 'inArray'))
    expect(anyInArray).toBe(false)
  })

  it('stakeholder call adds an inArray assignment guard', async () => {
    const caller = createCaller(mkCtx('stakeholder'))
    await caller.getSections({ documentId: '00000000-0000-0000-0000-000000000001' })
    const anyInArray = __recordedWheres.some((w) => containsType(w, 'inArray'))
    expect(anyInArray).toBe(true)
  })

  it('research_lead call adds an inArray assignment guard', async () => {
    const caller = createCaller(mkCtx('research_lead'))
    await caller.getSections({ documentId: '00000000-0000-0000-0000-000000000001' })
    const anyInArray = __recordedWheres.some((w) => containsType(w, 'inArray'))
    expect(anyInArray).toBe(true)
  })
})
```

- [ ] **Step 3: Run the new test file in isolation**

Run: `npx vitest run src/__tests__/document-router-scope.test.ts`
Expected: PASS, 9 tests.

If a test fails because the chain's `.where()` was never called for a given code path (e.g., the admin `getById` case), check that the router's `whereClause` is always passed to `.where(...)` rather than conditionally applied with `.limit(1)` alone — the chain mock only records what is passed to `.where`.

If the `exists` or `inArray` symbols from the drizzle mock shadow the real ones inside subqueries, the `containsType` helper walks the whole object tree so tagged markers anywhere in the structure will be found.

- [ ] **Step 4: Run the full Vitest suite to make sure nothing else regressed**

Run: `npx vitest run`
Expected: all existing tests still pass, plus the 9 new ones. If any pre-existing test fails, read the error — it should be unrelated to this change since we only touched one router file and one permission key.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/document-router-scope.test.ts
git commit -m "test(rbac): add scoping tests for documentRouter read procedures"
```

---

## Task 6: Manual smoke test

**Files:**
- None modified

This is a manual verification step. The goal is to confirm that a stakeholder user in the running dev environment actually cannot see unpublished documents or unassigned sections. The unit tests in Task 5 verify query shape; Task 6 verifies real behavior end-to-end.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Wait for the "Ready" line.

- [ ] **Step 2: Create or identify test data**

You need the following in your dev database:
1. At least one policy document with NO published versions (a pure draft).
2. At least one policy document with at least one published version.
3. A stakeholder-role user.
4. A section assignment for that stakeholder linking them to ONE section of the published document, and NO assignment for any section of the draft document or any other section of the published document.

If you don't have all of these, create them via the admin UI before continuing. Record the IDs.

- [ ] **Step 3: Sign in as an admin and confirm the baseline**

As an admin user, navigate to `/policies`. Expected:
- Both the draft and the published document appear in the list.
- Clicking through to the draft shows all of its sections.
- Clicking through to the published document shows all of its sections.

This confirms that privileged users still see everything.

- [ ] **Step 4: Sign out, then sign in as the stakeholder**

Navigate to `/policies`. Expected:
- Only the published document appears. The draft is NOT in the list.
- The stakeholder dashboard still shows whatever it showed before (we didn't touch the dashboard queries — it already uses `sectionAssignments.list`).

- [ ] **Step 5: Try to fetch the draft document directly**

In the browser devtools console (or via `curl` with the stakeholder's auth cookie), call the tRPC procedure:

```js
await trpc.document.getById.query({ id: '<draft-document-uuid>' })
```

Expected: a `NOT_FOUND` tRPC error, NOT a success. If you get the document back, Task 3 has regressed — re-read `getById`.

- [ ] **Step 6: Open the published document as the stakeholder**

Navigate to `/policies/<published-document-id>`. Expected:
- Only the section assigned to the stakeholder is visible.
- Other sections of the same published document are not shown.

If the page shows all sections anyway, the page component may be calling `document.getSections` without awaiting the scoped result, or it may be using a different query entirely. Read the page component and verify it uses the scoped `document.getSections`.

- [ ] **Step 7: Confirm the stakeholder can still submit feedback on their assigned section**

Click into the assigned section, click "Submit feedback", fill in the form, submit. Expected: success. This confirms we didn't break the feedback flow (Task 5's `feedback.submit` middleware is unchanged but worth verifying).

- [ ] **Step 8: Record the smoke test in the git log**

```bash
git commit --allow-empty -m "chore: verify document router RBAC fix end-to-end"
```

---

## Non-goals (explicit)

These are out of scope and MUST NOT be addressed in this plan.

- Changes to `sectionAssignment.listByUser` (the audit's Important #5 finding). Separate plan.
- Changes to any router other than `documentRouter` — `workshopRouter`, `feedbackRouter`, `changeRequestRouter`, etc. stay as-is.
- Changes to the Base UI Button wrapper or any frontend component.
- Filtering `sectionCount` in `list` to only count assigned sections.
- Adding a new `documentVersions`-level API (e.g., `version.listPublished`). The existing portal page already covers that use case.
- Database schema changes of any kind.
- Expanding `BYPASS_SECTION_SCOPE` to include new roles.
- Touching `src/server/rbac/section-access.ts`.
- Rewriting the existing test harness in `feedback-cross-policy.test.ts`.

## Self-review checklist (run before handoff)

- `npx tsc --noEmit` clean.
- `npx vitest run src/__tests__/document-router-scope.test.ts` — 9/9 pass.
- `npx vitest run` — full suite green.
- Manual smoke test (Task 6) shows: admin sees draft, stakeholder does not see draft, stakeholder sees only assigned section of published doc, stakeholder's feedback submission still works.
- No new files under `src/server/routers/` or `src/server/rbac/`.
- `src/lib/permissions.ts` has exactly one new key added (`document:read_all`) and no existing permissions were modified.
- The three changed procedures in `document.ts` all destructure `ctx` in their `.query` handler — a procedure that still reads `async ({ input })` without `ctx` is not role-aware and should be re-fixed.

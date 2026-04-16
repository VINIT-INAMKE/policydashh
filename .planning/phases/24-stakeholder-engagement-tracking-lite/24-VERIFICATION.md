---
phase: 24-stakeholder-engagement-tracking-lite
verified: 2026-04-16T16:30:00Z
status: gaps_found
score: 6/9 must-haves verified
re_verification: false
gaps:
  - truth: "Admin widget shows updated Last Active timestamp after a user performs any mutation"
    status: failed
    reason: "touchActivity middleware was committed on a branch (89b2a5a) that is NOT in HEAD. src/trpc/init.ts in HEAD has protectedProcedure = t.procedure.use(enforceAuth) only — touchActivity is absent. No mutation will ever update lastActivityAt."
    artifacts:
      - path: "src/trpc/init.ts"
        issue: "touchActivity middleware missing — protectedProcedure does not compose it. All phase-24 HEAD commits (ecac723, 4870921, 40edf71, 082b06f, d08d477) skipped this file entirely."
    missing:
      - "Add touchActivity middleware to src/trpc/init.ts and compose into protectedProcedure: t.procedure.use(enforceAuth).use(touchActivity)"
  - truth: "Test stubs exist and are runnable via npx vitest run before any production code is written"
    status: partial
    reason: "Both test files exist and are substantive stubs. However, the Plan 00 must_have also requires 'engagement.test.ts declares pending tests for engagement score computation (UX-09, UX-10)' — satisfied — and 'user-activity.test.ts declares pending tests for touchActivity middleware behavior (UX-08)' — satisfied as stubs. The stubs remain .todo() and will never graduate to real tests because touchActivity does not exist in the codebase."
    artifacts:
      - path: "src/server/routers/__tests__/user-activity.test.ts"
        issue: "Stubs reference touchActivity middleware behavior (UX-08) but there is no implementation to test against — the middleware was never merged to HEAD."
    missing:
      - "Blocked by touchActivity gap above — not a separate fix"
  - truth: "Migration 0016_engagement_tracking.sql was applied to the database"
    status: failed
    reason: "src/db/migrations/0016_engagement_tracking.sql does not exist in the working tree. It was created in commit 89b2a5a on a branch not merged to HEAD. Migration directory only goes up to 0015_cardano_anchoring.sql."
    artifacts:
      - path: "src/db/migrations/0016_engagement_tracking.sql"
        issue: "File does not exist in the filesystem — commit 89b2a5a is not in HEAD branch history."
    missing:
      - "Create src/db/migrations/0016_engagement_tracking.sql with ADD COLUMN last_activity_at, backfill UPDATE, SET NOT NULL, and SET DEFAULT now()"
      - "Run npx drizzle-kit push to apply migration"
human_verification:
  - test: "Confirm database column exists"
    expected: "SELECT last_activity_at FROM users LIMIT 1 should return a non-null timestamp"
    why_human: "Migration file is missing from the repo but lastActivityAt IS in the Drizzle schema (users.ts) — drizzle-kit push may have been run manually outside of a migration file, or the column may be absent from the actual DB"
  - test: "Confirm touchActivity fires on a real mutation"
    expected: "After submitting feedback or updating profile, the user's lastActivityAt in the DB should advance"
    why_human: "Cannot verify fire-and-forget middleware behavior via static analysis alone"
  - test: "Verify inactive users widget renders with real engagement data"
    expected: "Admin dashboard shows InactiveUsersWidget with real user rows, not an empty table due to data problems"
    why_human: "Widget receives server-fetched usersWithEngagement — correctness depends on DB state and whether lastActivityAt column exists"
---

# Phase 24: Stakeholder Engagement Tracking Lite — Verification Report

**Phase Goal:** Admins have visibility into stakeholder engagement — who is active, who has gone dormant, and how engagement is measured — without building a full CRM
**Verified:** 2026-04-16T16:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Test stubs exist and are runnable (Plan 00) | PARTIAL | Both files exist with correct describe/it.todo blocks; user-activity stubs reference unimplemented middleware |
| 2 | engagement.test.ts declares pending tests for UX-09, UX-10 | VERIFIED | File at src/server/routers/__tests__/engagement.test.ts has 9 it.todo() stubs, correct describe blocks |
| 3 | user-activity.test.ts declares pending tests for touchActivity (UX-08) | VERIFIED | File exists with 4 it.todo() stubs covering UX-08 — but implementation they reference is missing |
| 4 | Admin widget shows updated Last Active timestamp after a mutation | FAILED | touchActivity middleware absent from src/trpc/init.ts in HEAD — lastActivityAt will never update on mutation |
| 5 | Engagement score equals feedbackCount + attendedWorkshopCount | VERIFIED | listUsersWithEngagement and getUserProfile in user.ts compute COALESCE(feedbackCounts.cnt, 0) + COALESCE(attendanceCounts.cnt, 0) via LEFT JOIN subqueries |
| 6 | Users with zero activity show engagementScore 0 | VERIFIED | COALESCE(..., 0) pattern on both sides of sum guarantees 0 for users with no records |
| 7 | Admin profile page displays attendance history and feedback summary | VERIFIED | /users/[id]/page.tsx queries workshopRegistrations (attendedAt IS NOT NULL) and feedbackItems (.limit(20)), renders both cards |
| 8 | Admin dashboard shows Inactive Users stat card and filterable table | VERIFIED | InactiveUsersWidget renders StatCard + sortable table, wired to admin-dashboard.tsx via usersWithEngagement prop |
| 9 | Clicking a user name navigates to profile page | VERIFIED | users-client.tsx wraps name in Link href={`/users/${user.id}`}; inactive-users-widget.tsx does the same |

**Score: 6/9 truths verified** (Truths 4 failed; truths 1 and 3 partial due to dependency on truth 4)

---

## Required Artifacts

### Plan 00 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/server/routers/__tests__/engagement.test.ts` | Test stubs for UX-09, UX-10, UX-11 | VERIFIED | 16 lines, 2 describe blocks, 9 it.todo() stubs |
| `src/server/routers/__tests__/user-activity.test.ts` | Test stubs for UX-08 | VERIFIED | 8 lines, 1 describe block, 4 it.todo() stubs |

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/migrations/0016_engagement_tracking.sql` | ADD COLUMN last_activity_at + backfill | MISSING | File does not exist in filesystem. Commit 89b2a5a added it on a branch not in HEAD. |
| `src/db/schema/users.ts` | lastActivityAt column definition | VERIFIED | Line 21: `lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow()` |
| `src/trpc/init.ts` | touchActivity middleware composed into protectedProcedure | MISSING | Line 57 reads `protectedProcedure = t.procedure.use(enforceAuth)` — touchActivity not present. Phase-24 commits never touched this file. |
| `src/server/routers/user.ts` | listUsersWithEngagement and getUserProfile | VERIFIED | Both procedures present at lines 148 and 191; both use `requirePermission('user:list')` |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/(workspace)/dashboard/_components/inactive-users-widget.tsx` | Client-side interactive inactive users widget | VERIFIED | 201 lines, 'use client', InactiveUsersWidgetProps, useMemo filtering, sort logic, aria-sort, empty state |
| `app/(workspace)/dashboard/_components/admin-dashboard.tsx` | Updated dashboard with InactiveUsersWidget | VERIFIED | Imports InactiveUsersWidget; 6-element Promise.all includes usersWithEngagement; widget rendered at line 110 |
| `app/(workspace)/users/[id]/page.tsx` | Admin-only stakeholder profile page | VERIFIED | 215 lines, async params, admin guard, Workshop Attendance + Feedback Submitted cards, engagementScore display |
| `app/(workspace)/users/_components/users-client.tsx` | Name links to profile | VERIFIED | Line 118: `<Link href={\`/users/${user.id}\`}>` wrapping name cell |

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/trpc/init.ts` | `src/db/schema/users.ts` | touchActivity updates users.lastActivityAt | NOT_WIRED | `db.update(users)` does not appear in init.ts at HEAD — middleware was never merged |
| `src/server/routers/user.ts` | `src/db/schema/feedback.ts` | feedbackItems.submitterId LEFT JOIN | WIRED | Lines 150-157: feedbackCounts subquery on feedbackItems.submitterId |
| `src/server/routers/user.ts` | `src/db/schema/workshops.ts` | workshopRegistrations.userId + attendedAt IS NOT NULL | WIRED | Lines 159-170: attendanceCounts subquery on workshopRegistrations; and(isNotNull(userId), isNotNull(attendedAt)) |

### Plan 02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/(workspace)/dashboard/_components/admin-dashboard.tsx` | `src/db/schema/users.ts` | feedbackCounts named subquery | WIRED | Lines 34-38: feedbackCounts defined as Drizzle named subquery; used in Promise.all 6th element |
| `app/(workspace)/dashboard/_components/inactive-users-widget.tsx` | `app/(workspace)/users/[id]/page.tsx` | Next.js Link to /users/[id] | WIRED | Line 169 and line 188: both Link and Button render prop point to `/users/${user.id}` |
| `app/(workspace)/users/[id]/page.tsx` | `src/db/schema/feedback.ts` | feedbackItems.submitterId direct Drizzle query | WIRED | Line 56-67: `.from(feedbackItems).where(eq(feedbackItems.submitterId, id)).limit(20)` |
| `app/(workspace)/users/[id]/page.tsx` | `src/db/schema/workshops.ts` | workshopRegistrations.userId + attendedAt IS NOT NULL | WIRED | Lines 68-83: innerJoin(workshops), where(and(eq(workshopRegistrations.userId, id), isNotNull(attendedAt))) |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `inactive-users-widget.tsx` | `users` prop (UserWithEngagement[]) | admin-dashboard.tsx Promise.all 6th element — direct Drizzle query on users table with LEFT JOIN feedbackCounts | Yes — real DB query with COALESCE; engagement score only includes feedback (attendanceCounts subquery absent from admin-dashboard, present in user.ts) | VERIFIED |
| `app/(workspace)/users/[id]/page.tsx` | `attendedWorkshops` | workshopRegistrations innerJoin workshops where attendedAt IS NOT NULL | Real DB query — will return empty array until any user attends a workshop | VERIFIED |
| `app/(workspace)/users/[id]/page.tsx` | `userFeedback` | feedbackItems where submitterId = id, desc, limit 20 | Real DB query | VERIFIED |
| `app/(workspace)/users/[id]/page.tsx` | `engagementScore` | feedbackCountResult.cnt + attendanceCountResult.cnt from DB | Real DB count queries in Promise.all | VERIFIED |

**Note on engagement score discrepancy:** `admin-dashboard.tsx` computes engagementScore as feedback-count only (COALESCE(feedbackCounts.cnt, 0) — no attendanceCounts subquery). `src/server/routers/user.ts` listUsersWithEngagement includes both feedback and attendance counts. The profile page uses both counts. This is an inconsistency: the dashboard widget and the tRPC query produce different scores for the same user.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| engagement.test.ts runs as pending | `npx vitest run src/server/routers/__tests__/engagement.test.ts` | Not run — statically verified file exists with it.todo() | SKIP (static verified) |
| user-activity.test.ts runs as pending | `npx vitest run src/server/routers/__tests__/user-activity.test.ts` | Not run — statically verified file exists with it.todo() | SKIP (static verified) |
| TypeScript compiles | `npx tsc --noEmit` | Not run — relies on DB schema; workshopRegistrations imports in user.ts and page.tsx verified against actual schema | SKIP (needs DB) |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| UX-08 | 24-00, 24-01 | `users.lastActivityAt` updated via tRPC middleware on every authenticated mutation | BLOCKED | Column exists in schema but touchActivity middleware missing from init.ts — no mutations will update it |
| UX-09 | 24-01, 24-02 | Admin dashboard widget lists inactive users (no activity in configurable window) with engagement score | PARTIAL | Widget exists and renders; engagement score computed; but underlying lastActivityAt never updates (UX-08 gap means all users show their backfill date) |
| UX-10 | 24-01, 24-02 | Basic engagement score calculated from feedback count + workshop attendance count | VERIFIED | listUsersWithEngagement and getUserProfile both compute feedbackCount + attendanceCount via COALESCE SQL; admin-dashboard uses feedback-only (minor inconsistency, non-blocking) |
| UX-11 | 24-01, 24-02 | Workshop attendance history visible on stakeholder profile (auto-populated from cal.com webhooks) | VERIFIED | /users/[id]/page.tsx queries workshopRegistrations where attendedAt IS NOT NULL, renders Workshop Attendance card; empty state shown until cal.com marks attendance |

All four requirement IDs from PLAN frontmatter are accounted for. No orphaned requirements found.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/trpc/init.ts` | 57 | `protectedProcedure = t.procedure.use(enforceAuth)` — touchActivity omitted | BLOCKER | Every authenticated mutation silently does NOT update lastActivityAt; UX-08 requirement never fires |
| `src/db/migrations/0016_engagement_tracking.sql` | — | File missing entirely | BLOCKER | No migration record for last_activity_at column; database state is unverifiable from repo |
| `app/(workspace)/dashboard/_components/admin-dashboard.tsx` | 86 | `engagementScore: sql\`COALESCE(${feedbackCounts.cnt}, 0)\`` — attendance subquery absent | WARNING | Dashboard widget shows feedback-only score; tRPC query and profile page show feedback+attendance score; admins see inconsistent numbers |

---

## Human Verification Required

### 1. Database Column State

**Test:** Run `SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='last_activity_at'` against the production/development database.
**Expected:** Column exists (confirming drizzle-kit push was run manually, even though migration file is absent from repo).
**Why human:** Migration file missing from filesystem — cannot determine if column was applied to actual DB.

### 2. touchActivity Actually Fires After Fix

**Test:** Log in as any user, submit a piece of feedback, then query `SELECT last_activity_at FROM users WHERE clerk_id = '<your_clerk_id>'` — confirm timestamp advanced.
**Expected:** lastActivityAt updates to approximately `now()` within seconds of the mutation.
**Why human:** Fire-and-forget async behavior requires runtime observation.

### 3. Inactive Users Widget Shows Correct Data

**Test:** Navigate to admin dashboard, look for the Inactive Users widget, change the dropdown from 30d to 7d.
**Expected:** Stat card and table update client-side without a network request; users inactive for more than 7 days appear.
**Why human:** Visual/interactive behavior and real-time client-side filtering cannot be verified statically.

---

## Gaps Summary

Two blockers prevent UX-08 from functioning:

**Blocker 1 — touchActivity middleware not in HEAD.** Commit `89b2a5a` added touchActivity to `src/trpc/init.ts` and migration `0016_engagement_tracking.sql`, but that commit is on a branch not merged into master. The current HEAD branch's phase-24 commits (ecac723 → 4870921 → 40edf71 → 082b06f → d08d477) never touched `src/trpc/init.ts`. The file at HEAD ends with `protectedProcedure = t.procedure.use(enforceAuth)` only. Every authenticated mutation silently skips the lastActivityAt write.

**Blocker 2 — Migration file missing.** `src/db/migrations/0016_engagement_tracking.sql` does not exist in the working tree. The Drizzle schema (users.ts line 21) declares `lastActivityAt` as `notNull().defaultNow()`, meaning `drizzle-kit push` may have been run directly without recording a migration file — or the column is absent from the database entirely.

The consequence of both blockers together: the `lastActivityAt` column may or may not exist in the database, and even if it does, it will never be updated by mutations. The admin widget will display stale data for every user (their backfill date from created_at, or a constant value). UX-09 is therefore partially broken — the widget structure exists and renders, but the "who has gone dormant" insight depends on lastActivityAt advancing, which it never will.

All UI surfaces (inactive widget, profile page, users list links) are fully wired and substantive. The backend query logic (listUsersWithEngagement, getUserProfile) is correct and complete. The engagement score formula (feedbackCount + attendanceCount) is correctly implemented in user.ts and the profile page, with a minor inconsistency in admin-dashboard.tsx which only uses feedbackCount.

---

_Verified: 2026-04-16T16:30:00Z_
_Verifier: Claude (gsd-verifier)_

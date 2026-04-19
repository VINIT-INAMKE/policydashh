---
phase: 27-research-workspace-admin-ui
plan: 06
type: execute
wave: 2
depends_on: ["27-02"]
files_modified:
  - app/dashboard/_components/research-lead-dashboard.tsx
  - app/dashboard/_components/admin-dashboard.tsx
  - app/dashboard/_components/policy-lead-dashboard.tsx
autonomous: true
requirements:
  - RESEARCH-08
requirements_addressed:
  - RESEARCH-08
must_haves:
  truths:
    - "research_lead dashboard shows two StatCards: My Drafts (count where createdBy=userId AND status=draft) + Pending Review (createdBy=userId AND status=pending_review)"
    - "admin dashboard shows one StatCard: Research Awaiting Review (count where status=pending_review, all authors)"
    - "policy_lead dashboard shows the same StatCard as admin"
    - "Each StatCard is wrapped in a Next.js Link navigating to /research-manage with prefilled filter query params"
    - "StatCard queries run in parallel with existing dashboard queries (no sequential round-trips)"
  artifacts:
    - path: "app/dashboard/_components/research-lead-dashboard.tsx"
      provides: "research_lead dashboard extended with 2 research StatCards"
      contains: "My Drafts"
    - path: "app/dashboard/_components/admin-dashboard.tsx"
      provides: "admin dashboard extended with 1 research StatCard"
      contains: "Research Awaiting Review"
    - path: "app/dashboard/_components/policy-lead-dashboard.tsx"
      provides: "policy_lead dashboard extended with 1 research StatCard"
      contains: "Research Awaiting Review"
  key_links:
    - from: "app/dashboard/_components/research-lead-dashboard.tsx"
      to: "/research-manage?author=me&status=draft"
      via: "Next.js Link wrapping StatCard"
      pattern: "research-manage\\?author=me&status=draft"
    - from: "app/dashboard/_components/admin-dashboard.tsx"
      to: "/research-manage?status=pending_review"
      via: "Next.js Link wrapping StatCard"
      pattern: "research-manage\\?status=pending_review"
    - from: "each dashboard server component"
      to: "researchItems table"
      via: "db.select count with eq filters"
      pattern: "researchItems"
---

<objective>
Add the three dashboard widgets that surface research-module activity at a glance. Implements RESEARCH-08 success criterion 5 (dashboard widgets for research_lead + admin/policy_lead). Each widget is a clickable `StatCard` navigating to the list page with pre-applied query params so the user lands directly on the filtered view (D-09).

Purpose: Dashboard is the first screen after login. Without these widgets, research_leads miss pending drafts and admins miss items awaiting review — the moderation gate becomes invisible.

Output: three dashboard files extended (additive — no existing widgets removed).
</objective>

<execution_context>
@D:/aditee/policydash/.claude/get-shit-done/workflows/execute-plan.md
@D:/aditee/policydash/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/27-research-workspace-admin-ui/27-CONTEXT.md
@.planning/phases/27-research-workspace-admin-ui/27-UI-SPEC.md
@.planning/phases/27-research-workspace-admin-ui/27-02-list-page-nav-PLAN.md
@app/dashboard/_components/research-lead-dashboard.tsx
@app/dashboard/_components/admin-dashboard.tsx
@app/dashboard/_components/policy-lead-dashboard.tsx
@app/dashboard/_components/stat-card.tsx
@src/db/schema/research.ts

<interfaces>
From StatCard (existing — app/dashboard/_components/stat-card.tsx):
```typescript
export function StatCard({ icon, value, label }: {
  icon: React.ReactNode
  value: number | string
  label: string
})
// NOT a link — wrap in <Link> for navigation.
```

From src/db/schema/research.ts:
```typescript
// researchItems table columns relevant to dashboard queries:
// id, readableId, documentId, title, itemType, status,
// createdBy, createdAt, updatedAt, isAuthorAnonymous, ...
// status enum: 'draft' | 'pending_review' | 'published' | 'retracted'
```

Query pattern (from admin-dashboard.tsx existing Promise.all block):
```typescript
db.select({ count: count() }).from(someTable)
  .where(and(eq(...), eq(...)))
// Results destructured as `[[totalResult]]` where Promise.all wraps single-row arrays
```

From UI-SPEC §"Dashboard widget additions":
- research_lead: 2-column grid `grid grid-cols-2 gap-4` with My Drafts + Pending Review
- admin/policy_lead: Single card appended to existing stat row OR its own row

URL patterns (D-09 integration):
- research_lead "My Drafts" → `/research-manage?author=me&status=draft`
- research_lead "Pending Review" → `/research-manage?author=me&status=pending_review`
- admin/policy_lead "Research Awaiting Review" → `/research-manage?status=pending_review`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add My Drafts + Pending Review StatCards to research-lead-dashboard.tsx</name>
  <read_first>
    - app/dashboard/_components/research-lead-dashboard.tsx (full file — find the Promise.all block around line 29-49 to extend)
    - src/db/schema/research.ts (confirm researchItems import path)
    - .planning/phases/27-research-workspace-admin-ui/27-UI-SPEC.md §"Dashboard widget additions" for research_lead (D-10)
    - .planning/phases/27-research-workspace-admin-ui/27-CONTEXT.md D-10
  </read_first>
  <action>
    **Edit 1 — app/dashboard/_components/research-lead-dashboard.tsx: add research StatCards.**

    Add import at the top:
    ```typescript
    import { researchItems } from '@/src/db/schema/research'
    import { FileText, Clock } from 'lucide-react'   // or choose any 2 lucide icons for the new cards
    ```
    (The file already imports AlertCircle, FileSearch, CheckCircle — check and add only what's missing. Use `FileText` + `Clock` for the new cards, or similar semantically distinct icons — `FileEdit` for drafts and `Clock` for pending.)

    Extend the existing `Promise.all` inside the function body. Current shape:
    ```typescript
    const [feedbackWithoutEvidence, [totalEvidenceResult], [totalFeedbackResult]] = await Promise.all([...])
    ```

    Change to add two more queries:
    ```typescript
    const [
      feedbackWithoutEvidence,
      [totalEvidenceResult],
      [totalFeedbackResult],
      [myDraftsResult],
      [myPendingReviewResult],
    ] = await Promise.all([
      // ... keep the existing 3 queries ...

      // Phase 27 D-10: research_lead dashboard stat — own drafts
      db
        .select({ count: count() })
        .from(researchItems)
        .where(and(
          eq(researchItems.createdBy, userId),
          eq(researchItems.status, 'draft'),
        )),

      // Phase 27 D-10: research_lead dashboard stat — own pending review
      db
        .select({ count: count() })
        .from(researchItems)
        .where(and(
          eq(researchItems.createdBy, userId),
          eq(researchItems.status, 'pending_review'),
        )),
    ])
    ```

    Add `and` to the drizzle-orm import if not already imported:
    ```typescript
    import { eq, isNull, count, sql, desc, and } from 'drizzle-orm'
    ```

    After the existing stat row `<div className="grid grid-cols-2 gap-4">...</div>`, INSERT a new 2-column StatCard row BEFORE it (or immediately AFTER the existing row — UI-SPEC says "prepend above existing stat row"):

    ```typescript
    {/* Phase 27 D-10: Research stats */}
    <div className="grid grid-cols-2 gap-4">
      <Link href="/research-manage?author=me&status=draft">
        <StatCard
          icon={<FileText className="size-5" />}
          value={myDraftsResult?.count ?? 0}
          label="My Drafts"
        />
      </Link>
      <Link href="/research-manage?author=me&status=pending_review">
        <StatCard
          icon={<Clock className="size-5" />}
          value={myPendingReviewResult?.count ?? 0}
          label="Pending Review"
        />
      </Link>
    </div>
    ```

    Position: per UI-SPEC, PREPEND above the existing Feedback/Evidence stat row so research is the first thing a research_lead sees.

    Note: `userId` is already available as a prop (confirmed from the function signature `ResearchLeadDashboardProps { userId: string }`).
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "researchItems" app/dashboard/_components/research-lead-dashboard.tsx` outputs >= 2 matches
    - `grep -n "'My Drafts'" app/dashboard/_components/research-lead-dashboard.tsx` exactly one match (UI-SPEC copy)
    - `grep -n "'Pending Review'" app/dashboard/_components/research-lead-dashboard.tsx` exactly one match
    - `grep -n "/research-manage?author=me&status=draft" app/dashboard/_components/research-lead-dashboard.tsx` exactly one match
    - `grep -n "/research-manage?author=me&status=pending_review" app/dashboard/_components/research-lead-dashboard.tsx` exactly one match
    - `grep -n "myDraftsResult" app/dashboard/_components/research-lead-dashboard.tsx` >= 2 matches
    - `grep -n "myPendingReviewResult" app/dashboard/_components/research-lead-dashboard.tsx` >= 2 matches
    - `grep -n "eq(researchItems.createdBy, userId)" app/dashboard/_components/research-lead-dashboard.tsx` >= 2 matches
    - `grep -n "eq(researchItems.status, 'draft')" app/dashboard/_components/research-lead-dashboard.tsx` exactly one match
    - `grep -n "eq(researchItems.status, 'pending_review')" app/dashboard/_components/research-lead-dashboard.tsx` exactly one match
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>research_lead dashboard prepends 2-card research row with link navigation.</done>
</task>

<task type="auto">
  <name>Task 2: Add Research Awaiting Review StatCard to admin-dashboard.tsx</name>
  <read_first>
    - app/dashboard/_components/admin-dashboard.tsx (full file — extend the existing Promise.all and stat row)
    - src/db/schema/research.ts
    - .planning/phases/27-research-workspace-admin-ui/27-UI-SPEC.md §"Dashboard widget additions" for admin (D-11)
  </read_first>
  <action>
    **Edit 1 — app/dashboard/_components/admin-dashboard.tsx: add research review queue StatCard.**

    Add imports:
    ```typescript
    import { researchItems } from '@/src/db/schema/research'
    import { Microscope } from 'lucide-react'   // or FileSearch / Beaker — any semantically distinct icon
    ```

    Extend the existing Promise.all (currently destructures 6 items). Add one more query:
    ```typescript
    const [
      [totalUsersResult],
      [activePoliciesResult],
      [openFeedbackResult],
      versionsReadyToPublish,
      usersByRole,
      usersWithEngagement,
      [researchAwaitingResult],   // NEW
    ] = await Promise.all([
      // ... existing 6 queries ...

      // Phase 27 D-11: admin dashboard research review queue count
      db
        .select({ count: count() })
        .from(researchItems)
        .where(eq(researchItems.status, 'pending_review')),
    ])
    ```

    Add a new StatCard to the existing stat row. The current row is:
    ```typescript
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard icon={<Users className="size-5" />} value={totalUsers} label="Total Users" />
      <StatCard icon={<FileText className="size-5" />} value={activePolicies} label="Active Policies" />
      <StatCard icon={<BookOpen className="size-5" />} value={versionsCount} label="Versions Ready to Publish" />
      <StatCard icon={<MessageSquare className="size-5" />} value={openFeedback} label="Open Feedback" />
    </div>
    ```

    Change the lg:grid-cols-4 to lg:grid-cols-5 AND add the fifth StatCard:
    ```typescript
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <StatCard icon={<Users className="size-5" />} value={totalUsers} label="Total Users" />
      <StatCard icon={<FileText className="size-5" />} value={activePolicies} label="Active Policies" />
      <StatCard icon={<BookOpen className="size-5" />} value={versionsCount} label="Versions Ready to Publish" />
      <StatCard icon={<MessageSquare className="size-5" />} value={openFeedback} label="Open Feedback" />
      <Link href="/research-manage?status=pending_review">
        <StatCard
          icon={<Microscope className="size-5" />}
          value={researchAwaitingResult?.count ?? 0}
          label="Research Awaiting Review"
        />
      </Link>
    </div>
    ```

    `Link` is already imported at the top of the file.

    Add a variable declaration near the existing `const totalUsers = totalUsersResult?.count ?? 0` line:
    ```typescript
    const researchAwaiting = researchAwaitingResult?.count ?? 0
    ```

    Use `researchAwaiting` in the StatCard value prop (cleaner) OR use `researchAwaitingResult?.count ?? 0` inline (per the snippet above). Either is acceptable.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "researchItems" app/dashboard/_components/admin-dashboard.tsx` outputs >= 2 matches
    - `grep -n "'Research Awaiting Review'" app/dashboard/_components/admin-dashboard.tsx` exactly one match (UI-SPEC copy)
    - `grep -n "/research-manage?status=pending_review" app/dashboard/_components/admin-dashboard.tsx` exactly one match
    - `grep -n "researchAwaitingResult" app/dashboard/_components/admin-dashboard.tsx` >= 2 matches
    - `grep -n "eq(researchItems.status, 'pending_review')" app/dashboard/_components/admin-dashboard.tsx` exactly one match
    - `grep -n "lg:grid-cols-5" app/dashboard/_components/admin-dashboard.tsx` at least one match (grid was widened from 4→5)
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Admin dashboard shows research review queue count with link to filtered list.</done>
</task>

<task type="auto">
  <name>Task 3: Mirror the admin research review StatCard onto policy-lead-dashboard.tsx</name>
  <read_first>
    - app/dashboard/_components/policy-lead-dashboard.tsx (full file — extend its Promise.all and stat row)
    - .planning/phases/27-research-workspace-admin-ui/27-UI-SPEC.md D-11 "admin + policy_lead same card"
  </read_first>
  <action>
    **Edit 1 — app/dashboard/_components/policy-lead-dashboard.tsx: add research review queue StatCard.**

    Add imports:
    ```typescript
    import { researchItems } from '@/src/db/schema/research'
    import { Microscope } from 'lucide-react'
    ```
    (File already imports `Link` and other lucide icons — check and add only what's missing.)

    Extend the existing Promise.all at the top of the function. The current destructure is:
    ```typescript
    const [
      [openFeedbackResult],
      [activeCRResult],
      [policiesResult],
      [publishedResult],
      recentFeedback,
      activeCRs,
      sections,
    ] = await Promise.all([...])
    ```

    Add an 8th query:
    ```typescript
    const [
      [openFeedbackResult],
      [activeCRResult],
      [policiesResult],
      [publishedResult],
      recentFeedback,
      activeCRs,
      sections,
      [researchAwaitingResult],   // NEW
    ] = await Promise.all([
      // ... existing 7 queries ...

      // Phase 27 D-11: policy_lead dashboard research review queue count
      db
        .select({ count: count() })
        .from(researchItems)
        .where(eq(researchItems.status, 'pending_review')),
    ])
    ```

    In the existing stat row:
    ```typescript
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard icon={<MessageSquare className="size-5" />} value={openFeedbackCount} label="Open Feedback" />
      <StatCard icon={<GitPullRequest className="size-5" />} value={activeCRCount} label="Active CRs" />
      <StatCard icon={<FileText className="size-5" />} value={policiesCount} label="Policies" />
      <StatCard icon={<BookOpen className="size-5" />} value={publishedVersionsCount} label="Published Versions" />
    </div>
    ```

    Widen to 5 cols and add the research card:
    ```typescript
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <StatCard icon={<MessageSquare className="size-5" />} value={openFeedbackCount} label="Open Feedback" />
      <StatCard icon={<GitPullRequest className="size-5" />} value={activeCRCount} label="Active CRs" />
      <StatCard icon={<FileText className="size-5" />} value={policiesCount} label="Policies" />
      <StatCard icon={<BookOpen className="size-5" />} value={publishedVersionsCount} label="Published Versions" />
      <Link href="/research-manage?status=pending_review">
        <StatCard
          icon={<Microscope className="size-5" />}
          value={researchAwaitingResult?.count ?? 0}
          label="Research Awaiting Review"
        />
      </Link>
    </div>
    ```
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "researchItems" app/dashboard/_components/policy-lead-dashboard.tsx` outputs >= 2 matches
    - `grep -n "'Research Awaiting Review'" app/dashboard/_components/policy-lead-dashboard.tsx` exactly one match (UI-SPEC copy)
    - `grep -n "/research-manage?status=pending_review" app/dashboard/_components/policy-lead-dashboard.tsx` exactly one match
    - `grep -n "researchAwaitingResult" app/dashboard/_components/policy-lead-dashboard.tsx` >= 2 matches
    - `grep -n "eq(researchItems.status, 'pending_review')" app/dashboard/_components/policy-lead-dashboard.tsx` exactly one match
    - `grep -n "lg:grid-cols-5" app/dashboard/_components/policy-lead-dashboard.tsx` at least one match
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>policy_lead dashboard mirrors admin research review card.</done>
</task>

</tasks>

<verification>
- Log in as research_lead → dashboard shows "My Drafts" + "Pending Review" StatCards at top of dashboard; clicking navigates to `/research-manage?author=me&status=draft`
- Log in as admin → dashboard shows "Research Awaiting Review" card alongside existing 4; clicking navigates to `/research-manage?status=pending_review`
- Log in as policy_lead → same Research Awaiting Review card
- Counts are accurate against seeded research_items rows
- Dashboard loads in ≤1 request (new queries ride the existing Promise.all)
- `npx tsc --noEmit` passes
- `npx vitest run` full suite still green
</verification>

<success_criteria>
- RESEARCH-08 SC-5 satisfied: widgets for all 3 privileged roles
- StatCards wrapped in Link for navigation (per UI-SPEC §"Dashboard widget integration — Pitfall 3")
- No additional DB round-trips (queries added to existing Promise.all)
- Copy matches UI-SPEC verbatim
</success_criteria>

<output>
Create `.planning/phases/27-research-workspace-admin-ui/27-06-SUMMARY.md` recording:
- Three dashboard files updated
- Icon choices (Microscope, FileText, Clock — or whichever lucide icons you selected)
- Final grid column adjustments (4→5 on admin/policy_lead)
- Link URL patterns used (useful for Plan 02 URL bootstrap verification)
</output>

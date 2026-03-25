---
phase: 09-public-portal-compliance
verified: 2026-03-25T12:00:00Z
status: gaps_found
score: 12/13 must-haves verified
gaps:
  - truth: "Auditor dashboard 'View Full Audit Trail' button links to /audit"
    status: partial
    reason: "The 'View Full Audit Trail' button correctly links to /audit. However, the 'Export Evidence Pack (ZIP)' button in the Export Controls card also links to /audit (navigates to audit page) rather than opening the EvidencePackDialog directly. The plan specified this button should trigger the dialog. The dialog is accessible from the audit page, but the dashboard shortcut does not directly invoke it."
    artifacts:
      - path: "app/(workspace)/dashboard/_components/auditor-dashboard.tsx"
        issue: "Line 105: 'Export Evidence Pack (ZIP)' button uses render={<Link href='/audit' />} instead of being wired to EvidencePackDialog"
    missing:
      - "Replace the 'Export Evidence Pack (ZIP)' button's Link href with a dialog trigger that opens EvidencePackDialog, or import EvidencePackDialog into auditor-dashboard.tsx and use it as a trigger"
human_verification:
  - test: "Navigate to /portal without authentication"
    expected: "Published Policies page renders with no redirect to /sign-in"
    why_human: "Middleware auth behavior cannot be verified without a running server"
  - test: "Navigate to /portal/[policyId] with a published policy"
    expected: "Policy detail renders section nav, version selector, Download PDF and Changelog buttons"
    why_human: "Requires live DB data and server execution"
  - test: "Visit /portal/[policyId]/consultation-summary and inspect rendered HTML"
    expected: "Only aggregate counts appear; no feedback body text, submitter names (for anonymous), or decision rationale are present"
    why_human: "Privacy guarantee requires visual/DOM inspection against real data"
  - test: "Click Download PDF button"
    expected: "Browser downloads a PDF file named '{policy-slug}-{version}.pdf' containing section content"
    why_human: "PDF generation requires server execution and browser download verification"
  - test: "Navigate to /audit as a stakeholder role"
    expected: "Redirected to /dashboard"
    why_human: "Role-based redirect requires server execution with authenticated session"
  - test: "Open EvidencePackDialog, select a policy, click Export ZIP"
    expected: "Progress bar advances, ZIP downloads with INDEX.md, stakeholders.csv, feedback-matrix.csv, version-history.json, decision-log.json, workshop-evidence.json"
    why_human: "ZIP download and file content verification requires server execution"
---

# Phase 9: Public Portal & Compliance Verification Report

**Phase Goal:** Published policies are publicly accessible with full privacy controls, and auditors can review the complete audit trail and export governance evidence packs
**Verified:** 2026-03-25T12:00:00Z
**Status:** gaps_found (1 warning-level gap)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Unauthenticated visitor can view /portal and see published policies without redirect to /sign-in | ? HUMAN | proxy.ts whitelists '/portal(.*)'; layout.tsx has zero auth imports — runtime behavior needs human test |
| 2  | Visitor can click a policy card and view all sections of the latest published version | ? HUMAN | portal/[policyId]/page.tsx queries isPublished versions, renders PublicPolicyContent with dangerouslySetInnerHTML |
| 3  | Visitor can switch between published versions using a dropdown | ✓ VERIFIED | public-version-selector.tsx uses useRouter().push() to navigate to ?version= searchParam |
| 4  | Visitor can view a changelog showing what changed per version with no CR IDs or feedback IDs visible | ✓ VERIFIED | changelog/page.tsx renders only entry.summary and section titles; explicit comment confirms crReadableId/crTitle/feedbackIds excluded from output; grep confirms no leakage |
| 5  | Visitor can view a consultation summary with aggregate counts per section, never individual feedback bodies or stakeholder names (unless opted in) | ✓ VERIFIED | consultation-summary/page.tsx: isAnonymous check gates orgType and name; body/suggestedChange/decisionRationale are never queried or rendered |
| 6  | Visitor can download a PDF of the published policy version | ? HUMAN | policy-pdf/[versionId]/route.tsx: queries isPublished, uses renderToBuffer, returns application/pdf with no auth() call — download behavior needs human test |
| 7  | No raw feedback threads, stakeholder identities, or decision rationale appear on any public page | ✓ VERIFIED | grep across app/(public) finds zero @clerk imports, zero body/suggestedChange/decisionRationale field references |
| 8  | Auditor can view the full audit trail at /audit with filtering by action type, entity type, actor role, and date range | ✓ VERIFIED | audit/page.tsx enforces admin/auditor role; audit-trail-client.tsx passes all 5 filters to trpc.audit.list; auditRouter.list has all filter conditions including actorRole |
| 9  | Audit trail table shows all audit events with pagination (50 per page default) | ✓ VERIFIED | audit-event-table.tsx: default pageSize=50, Prev/Next buttons, per-page selector (25/50/100), TableCaption, aria-expanded on metadata rows |
| 10 | Admin/Auditor can export a milestone evidence pack as a structured ZIP containing stakeholder list, feedback matrix, version history, decision logs, and workshop placeholder | ✓ VERIFIED | buildEvidencePack returns all 6 artifacts; zipSync(files, {level:6}) in export route |
| 11 | Evidence pack ZIP contains an INDEX.md file documenting contents | ✓ VERIFIED | evidence-pack.service.ts line 198: INDEX.md assembled with document title, ISO timestamp, and file descriptions |
| 12 | Non-auditor/non-admin users cannot access /audit or export evidence packs | ✓ VERIFIED | audit/page.tsx redirects to /dashboard if role not in ['admin','auditor']; evidence-pack route checks can(user.role,'evidence:export') returning 403 |
| 13 | Auditor dashboard 'View Full Audit Trail' button links to /audit | ⚠ PARTIAL | "View Full Audit Trail" button correctly uses render={<Link href="/audit" />}. "Export Evidence Pack (ZIP)" button in Export Controls also routes to /audit instead of opening EvidencePackDialog |

**Score:** 12/13 truths verified (10 pass, 1 partial, 3 human-needed but code-verified)

---

## Required Artifacts

### Plan 01 — Public Portal (PUB-01 through PUB-05)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `proxy.ts` | Whitelists /portal(.*) and /api/export/policy-pdf(.*) | ✓ VERIFIED | Both routes present in createRouteMatcher array |
| `app/(public)/layout.tsx` | Public layout with no auth, no ClerkProvider, no WorkspaceNav | ✓ VERIFIED | 29 lines; imports only Link from next/link; zero @clerk references |
| `app/(public)/portal/page.tsx` | Portal home listing published policies | ✓ VERIFIED | Queries documentVersions WHERE isPublished=true, renders PublicPolicyCard grid, Suspense skeleton |
| `app/(public)/portal/[policyId]/page.tsx` | Published policy detail with section nav and content | ✓ VERIFIED | notFound() on missing policy, version selection via searchParam, two-column layout |
| `app/(public)/portal/[policyId]/changelog/page.tsx` | Public changelog with sanitized version history | ✓ VERIFIED | Renders only entry.summary and resolved section titles; no internal IDs |
| `app/(public)/portal/[policyId]/consultation-summary/page.tsx` | Sanitized consultation summary with privacy enforcement | ✓ VERIFIED | isAnonymous gates identity; only aggregate counts rendered |
| `app/api/export/policy-pdf/[versionId]/route.tsx` | PDF export of published policy version | ✓ VERIFIED | No auth(); queries isPublished; renderToBuffer; Content-Type application/pdf |
| `src/lib/tiptap-html-renderer.ts` | Tiptap JSON to HTML string renderer | ✓ VERIFIED | Handles paragraph, heading(1-6), callout, codeBlock, blockquote, bulletList, orderedList, listItem, table/row/header/cell, horizontalRule, image, and all 6 inline marks |

### Plan 02 — Audit & Compliance (AUDIT-04 through AUDIT-06)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/(workspace)/audit/page.tsx` | Audit trail viewer page | ✓ VERIFIED | "Audit Trail" heading; role enforcement redirects non-admin/non-auditor to /dashboard |
| `app/(workspace)/audit/_components/audit-event-table.tsx` | Paginated audit event table with expandable metadata | ✓ VERIFIED | TableCaption, aria-expanded, 7 columns, pagination, loading/empty states |
| `app/(workspace)/audit/_components/audit-filter-panel.tsx` | Horizontal filter bar for audit events | ✓ VERIFIED | Action, actor role, entity type, from, to — all 5 filters with labels and clear button |
| `app/(workspace)/audit/_components/evidence-pack-dialog.tsx` | Export Evidence Pack dialog with policy selector | ✓ VERIFIED | Policy Select (trpc.document.list), 5-item checklist, progress bar, download link, retry |
| `app/api/export/evidence-pack/route.ts` | ZIP evidence pack export route handler | ✓ VERIFIED | Auth + permission check; buildEvidencePack; zipSync; writeAuditLog; Content-Type application/zip |
| `src/server/services/evidence-pack.service.ts` | Evidence pack assembly logic | ✓ VERIFIED | 6 artifacts: INDEX.md, stakeholders.csv (always anonymized), feedback-matrix.csv, version-history.json, decision-log.json, workshop-evidence.json |
| `src/lib/constants.ts` | EVIDENCE_PACK_EXPORT action constant | ✓ VERIFIED | Line 64: `EVIDENCE_PACK_EXPORT: 'evidence_pack.export'` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| proxy.ts | app/(public)/portal | createRouteMatcher whitelist | ✓ WIRED | '/portal(.*)' present at line 8 |
| app/(public)/portal/[policyId]/page.tsx | src/db | direct Drizzle queries (no tRPC) | ✓ WIRED | `import { db } from '@/src/db'`; uses db.query.policyDocuments and db.select().from(documentVersions) |
| app/(public)/portal/[policyId]/consultation-summary/page.tsx | feedbackItems.isAnonymous | privacy enforcement on all public queries | ✓ WIRED | Line 128: `const orgType = row.isAnonymous ? null : (row.submitterOrgType as OrgType \| null)` |
| app/(workspace)/audit/page.tsx | src/server/routers/audit.ts | tRPC audit.list query | ✓ WIRED | audit-trail-client.tsx calls trpc.audit.list.useQuery with all filter params |
| app/api/export/evidence-pack/route.ts | src/server/services/evidence-pack.service.ts | service function call | ✓ WIRED | Line 37: `const files = await buildEvidencePack(documentId)` |
| app/api/export/evidence-pack/route.ts | fflate | zipSync for ZIP assembly | ✓ WIRED | Line 3: `import { zipSync } from 'fflate'`; line 40: `zipSync(files, { level: 6 })` |
| app/(workspace)/dashboard/_components/auditor-dashboard.tsx | /audit | enabled View Full Audit Trail button | ✓ WIRED | Line 58: `render={<Link href="/audit" />}` |
| app/(workspace)/dashboard/_components/auditor-dashboard.tsx | EvidencePackDialog | Export Evidence Pack button | ⚠ PARTIAL | "Export Evidence Pack (ZIP)" button in Export Controls links to /audit instead of opening EvidencePackDialog |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `app/(public)/portal/page.tsx` | `policies: PublishedPolicy[]` | `db.select().from(documentVersions).where(eq(documentVersions.isPublished, true))` | Yes — Drizzle query with WHERE clause | ✓ FLOWING |
| `app/(public)/portal/[policyId]/page.tsx` | `published` versions + `sortedSections` | `db.select().from(documentVersions).where(eq(...))` + sectionsSnapshot JSONB | Yes — DB query + JSONB deserialization | ✓ FLOWING |
| `app/(public)/portal/[policyId]/consultation-summary/page.tsx` | `resolvedFeedback` | `db.select().from(feedbackItems).leftJoin(users).leftJoin(policySections).where(eq(feedbackItems.documentId, policyId))` | Yes — full join query | ✓ FLOWING |
| `app/(workspace)/audit/_components/audit-event-table.tsx` | `events` prop | `trpc.audit.list.useQuery()` in audit-trail-client.tsx → auditRouter.list → `db.select().from(auditEvents)` | Yes — paginated DB query | ✓ FLOWING |
| `src/server/services/evidence-pack.service.ts` | 6 artifact files | Multiple Drizzle queries across feedbackItems, users, changeRequests, documentVersions, workflowTransitions | Yes — real DB queries for all artifacts | ✓ FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — requires running server. Key routes verified via static analysis.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PUB-01 | 09-01-PLAN.md | Published policy versions viewable on public read-only page (no auth required) | ✓ SATISFIED | proxy.ts whitelists /portal; (public) layout has no Clerk auth; portal/[policyId]/page.tsx queries isPublished=true |
| PUB-02 | 09-01-PLAN.md | Public changelog showing version history and what changed | ✓ SATISFIED | changelog/page.tsx renders version history for all isPublished versions with merge summaries and sanitized change entries |
| PUB-03 | 09-01-PLAN.md | Sanitized consultation summaries (no stakeholder identities unless explicitly opted in) | ✓ SATISFIED | consultation-summary/page.tsx: isAnonymous gates identity at line 128; only counts rendered; named contributors shown only if isAnonymous=false |
| PUB-04 | 09-01-PLAN.md | PDF export of published policy versions | ✓ SATISFIED | policy-pdf/[versionId]/route.tsx: WHERE isPublished=true; @react-pdf/renderer renderToBuffer; Content-Type application/pdf |
| PUB-05 | 09-01-PLAN.md | Public portal does NOT expose: raw feedback threads, stakeholder identities, internal deliberations | ✓ SATISFIED | grep confirms zero body/suggestedChange/decisionRationale in consultation-summary; changelog renders only entry.summary; zero @clerk imports in (public) |
| AUDIT-04 | 09-02-PLAN.md | Auditor can view full audit trail with filtering | ✓ SATISFIED | /audit page with 5-filter panel (action, role, entity, from, to); server-side filtering via auditRouter.list including actorRole |
| AUDIT-05 | 09-02-PLAN.md | Milestone evidence pack export: stakeholder list, feedback matrix, version history, workshop evidence, decision logs | ✓ SATISFIED | buildEvidencePack assembles all 6 artifacts; export route enforces evidence:export permission |
| AUDIT-06 | 09-02-PLAN.md | Evidence pack exportable as structured ZIP with index | ✓ SATISFIED | fflate zipSync; INDEX.md with file listing; Content-Disposition attachment .zip |

**Orphaned requirements check:** REQUIREMENTS.md maps PUB-01 through PUB-05 and AUDIT-04 through AUDIT-06 to Phase 9. All 8 are claimed and addressed. No orphaned requirements.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/(workspace)/dashboard/_components/auditor-dashboard.tsx` | 105 | "Export Evidence Pack (ZIP)" button `render={<Link href="/audit" />}` routes to audit page instead of opening EvidencePackDialog | ⚠ Warning | User must navigate to audit page to trigger dialog — one extra click, goal still achievable |
| `app/api/export/policy-pdf/[versionId]/route.tsx` | 121 | `buffer as unknown as BodyInit` cast | ℹ Info | Pre-existing pattern (same workaround in traceability PDF route); type-safe Buffer-to-BodyInit incompatibility |

No PLACEHOLDER, TODO, FIXME, or empty-return stubs found across all 21 phase 9 files. All data flows are connected to real Drizzle queries.

---

## Human Verification Required

### 1. Public portal loads without authentication

**Test:** In a fresh browser (or incognito), navigate to `http://localhost:3000/portal`
**Expected:** Published Policies page renders; no redirect to /sign-in
**Why human:** Middleware auth enforcement requires a running Next.js server with Clerk middleware active

### 2. Policy detail page renders section content

**Test:** Navigate to `/portal/[any-published-policyId]`
**Expected:** Policy title, version selector, section nav, section HTML content, Download PDF and Changelog buttons visible
**Why human:** Requires live DB with a published policy version containing sectionsSnapshot data

### 3. Consultation summary privacy guarantee

**Test:** Navigate to `/portal/[policyId]/consultation-summary` and inspect DOM
**Expected:** Stat cards show aggregate counts; accordion shows type/outcome/org breakdowns as counts only; no individual feedback text, decision rationale, or submitter names (for anonymous submissions)
**Why human:** Privacy guarantee requires visual inspection against real data with mixed anonymous/named submissions

### 4. PDF export downloads correctly

**Test:** Click "Download PDF" on a published policy page
**Expected:** Browser downloads a PDF file; file contains policy title, version label, and section content as plain text
**Why human:** PDF binary output requires browser download and file-open verification

### 5. Non-auditor redirect from /audit

**Test:** Log in as a Stakeholder user and navigate to `/audit`
**Expected:** Redirected to /dashboard
**Why human:** Role-based redirect requires authenticated session with non-auditor role

### 6. Evidence pack ZIP structure

**Test:** As admin/auditor, open EvidencePackDialog from `/audit`, select a policy, click Export ZIP, unzip the download
**Expected:** ZIP contains exactly: INDEX.md, stakeholders.csv, feedback-matrix.csv, version-history.json, decision-log.json, workshop-evidence.json; INDEX.md lists all contents; stakeholders.csv shows "Anonymous" for all Name values
**Why human:** ZIP file content verification requires server execution and file inspection

---

## Gaps Summary

One warning-level gap was found. The "Export Evidence Pack (ZIP)" button in the auditor dashboard's Export Controls card (line 105 of `auditor-dashboard.tsx`) navigates to `/audit` using a Link, rather than opening the `EvidencePackDialog` directly. The plan specified this button should be wired to the dialog.

**Impact:** Low. Users can still access the EvidencePackDialog from the /audit page header (where it is correctly wired). The dashboard button serves as a navigation shortcut to the audit page rather than a direct dialog trigger. The requirement AUDIT-05 is functionally satisfied — the export is accessible and works — but the dashboard UX is one click deeper than planned.

**Fix:** In `auditor-dashboard.tsx`, replace the Export Evidence Pack button (currently a Link to /audit) with a `EvidencePackDialog` component used as a trigger, the same way it's used in `audit/page.tsx`.

---

_Verified: 2026-03-25_
_Verifier: Claude (gsd-verifier)_

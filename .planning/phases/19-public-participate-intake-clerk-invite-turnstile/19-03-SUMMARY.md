---
phase: 19-public-participate-intake-clerk-invite-turnstile
plan: 03
subsystem: email
tags: [react-email, welcome-email, org-buckets, resend, intake-05]
wave: 2
depends_on: ['19-00']
requirements: [INTAKE-05]
dependency_graph:
  requires:
    - '@react-email/components@1.0.10'
    - 'src/lib/email.ts (existing Resend singleton + FROM_ADDRESS)'
  provides:
    - 'renderWelcomeEmail({ name, email, orgType }) → Promise<string>'
    - 'WelcomeEmail React component (6 org-bucket variants)'
    - 'sendWelcomeEmail(to, { name, orgType, email }) → Promise<void>'
  affects:
    - 'src/inngest/functions/participate-intake.ts (Plan 19-02 consumer)'
tech_stack:
  added: []
  patterns:
    - 'Separate .tsx template file (Pitfall 8 pattern — mock at sendX boundary, not at render)'
    - 'Literal \u2019 unicode in JSX for curly apostrophe (not &apos; which react-email emits as &#x27;)'
    - 'BUCKET_COPY record keyed by OrgBucket union — civil_society fallback for unknown types'
    - 'Silent no-op guard preserved (if !resend || !to return) — Phase 16/17/18 parity'
key_files:
  created:
    - 'src/lib/email-templates/welcome-email.tsx'
  modified:
    - 'src/lib/email.ts'
decisions:
  - "Use literal \u2019 unicode (not &apos;) in hero JSX — react-email render() emits JSX entity refs as &#x27; which fails Test 3.8's three-pattern contract"
  - 'Separate src/lib/email-templates/ directory (not inlined into email.ts) — keeps JSX out of the helper boundary so Inngest tests can vi.mock @/src/lib/email without JSX transform cost (Pitfall 8)'
  - 'BUCKET_COPY record falls back to civil_society for unknown orgType rather than throwing — defensive against future schema drift'
  - 'HTML field (not text) on resend.emails.send — distinct from Phase 16/17/18 helpers because welcome email is designed visual-first'
metrics:
  duration: '3min'
  tasks: 2
  files_created: 1
  files_modified: 1
  completed: 2026-04-14
---

# Phase 19 Plan 03: Welcome Email Template + sendWelcomeEmail Helper Summary

Role-tailored 6-variant welcome email powered by `@react-email/components` v1.0.10 and wired through a new `sendWelcomeEmail` helper in `src/lib/email.ts` following the existing silent-no-op pattern.

## What Was Built

### Task 1: `src/lib/email-templates/welcome-email.tsx` (new file)

- `WelcomeEmail` React component — 6 bucket variants (`government`, `industry`, `legal`, `academia`, `civil_society`, `internal`)
- `BUCKET_COPY: Record<OrgBucket, { body, cta }>` — copy locked verbatim from `19-UI-SPEC.md` Welcome Email Design Contract
- `renderWelcomeEmail({ name, email, orgType }): Promise<string>` — async wrapper around `render()` from `@react-email/components` (async in v1.x — Pitfall 6)
- CTA label routing: 5 standard buckets → `"Accept Invitation & Sign In"` (renders as `&amp;` after JSX auto-encode); `internal` → `"Sign In to Dashboard"`
- Hero line `You\u2019re in.` present in every variant (literal unicode curly apostrophe, not HTML entity)
- Footer: `"This invitation was sent to {email}. If you did not request this, you can safely ignore it."`
- Styling matches UI-SPEC: `#000a1e` accent, `#f7fafc` surface, Inter font-family, 600px max container

**Commit:** `e8c51b7` — `feat(19-03): add WelcomeEmail template with 6 org-bucket variants`

### Task 2: `src/lib/email.ts` (modified)

- Added top-level import: `import { renderWelcomeEmail } from './email-templates/welcome-email'`
- Appended `sendWelcomeEmail(to, { name, orgType, email })` helper as the 5th helper in the file
- Signature: `(to: string | null | undefined, data: { name: string; orgType: string; email: string }) => Promise<void>` — matches Plan 19-02 Test 2.4 contract exactly
- Silent no-op guard: `if (!resend || !to) return` — parity with the 4 pre-existing helpers
- Renders HTML via `renderWelcomeEmail`, then dispatches via `resend.emails.send({ from, to, subject, html })`
- Subject: `` `Welcome to the consultation, ${firstName}` `` (first name extracted by splitting on whitespace)
- All 4 pre-existing helpers (`sendFeedbackReviewedEmail`, `sendVersionPublishedEmail`, `sendSectionAssignedEmail`, `sendWorkshopEvidenceNudgeEmail`, `sendEvidencePackReadyEmail`) untouched

**Commit:** `cd8773b` — `feat(19-03): add sendWelcomeEmail helper to src/lib/email.ts`

## Verification

| Check | Result |
|---|---|
| `tests/phase-19/welcome-email.test.ts` (8 contracts + RED import) | **9/9 PASS** |
| `npx tsc --noEmit` scoped to email.ts + welcome-email.tsx | **CLEAN** |
| `grep "export function WelcomeEmail"` | present |
| `grep "export async function renderWelcomeEmail"` | present |
| `grep "BUCKET_COPY"` | present |
| `grep "government official"` (case-sensitive, test uses `.toLowerCase()`) | present |
| `grep "industry professional"` | present |
| `grep "legal professional"` | present |
| `grep "academic or researcher"` | present |
| `grep "civil society representative"` | present |
| `grep "internal team member"` | present |
| `grep "Accept Invitation & Sign In"` | present |
| `grep "Sign In to Dashboard"` | present |
| `grep "await render"` | present |
| `grep "export async function sendWelcomeEmail"` in email.ts | present |
| `grep "from './email-templates/welcome-email'"` in email.ts | present |
| `grep "if (!resend || !to) return"` in email.ts (silent no-op parity) | 5 occurrences (4 pre-existing + 1 new) |
| `grep "subject: \`Welcome to the consultation"` in email.ts | present |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Hero line JSX entity encoding mismatch**
- **Found during:** Task 1 verification (8/9 tests green, Test 3.8 red)
- **Issue:** Plan's action block used `You&apos;re in.` as literal JSX text. `@react-email/components` `render()` in v1.0.10 converts JSX entity refs (`&apos;`) into hex escapes (`&#x27;`) in the emitted HTML. Test 3.8 checks for exactly three patterns — `You&apos;re in.`, `You\u2019re in.`, or `You're in.` — none of which match `You&#x27;re in.`.
- **Fix:** Replaced `You&apos;re in.` with a JSX expression using a literal unicode curly apostrophe: `{'You\u2019re in.'}`. React-email preserves unicode codepoints verbatim through `render()`, so the HTML contains `You\u2019re in.` which satisfies pattern 2 of Test 3.8.
- **Diagnostic:** Confirmed via throwaway `_debug-hero.test.ts` (deleted before commit) that the pre-fix output was `"...You&#x27;re in.</p>..."`.
- **Files modified:** `src/lib/email-templates/welcome-email.tsx` (one line)
- **Commit:** Included in `e8c51b7` (fix applied before first commit — test gate forced discovery inside Task 1's verify phase, not a separate commit)

### Auth Gates

None.

### Architectural Changes

None.

## Known Stubs

None. Both files have fully wired data paths. `sendWelcomeEmail` is ready for `participateIntakeFn` (Plan 19-02) to call inside a `step.run` block.

## Success Criteria Check

- [x] `src/lib/email-templates/welcome-email.tsx` exists with `WelcomeEmail` + `renderWelcomeEmail` exports
- [x] 6 org bucket variants have distinct body copy matching UI-SPEC verbatim
- [x] CTA labels match contract (5 standard with `Accept Invitation & Sign In`, 1 internal with `Sign In to Dashboard`)
- [x] `sendWelcomeEmail` helper in `src/lib/email.ts` follows silent-no-op pattern
- [x] All 8 welcome-email tests GREEN (plus the RED-import guard = 9/9)
- [x] Wave 0 contract (`tests/phase-19/welcome-email.test.ts`) — 6 distinct HTML outputs verified

## Downstream Impact

- **Plan 19-02 (`participateIntakeFn`)** — the `@/src/lib/email` → `sendWelcomeEmail` mock boundary in `tests/phase-19/participate-intake.test.ts:41` now resolves at import time. Plan 19-02's Test 2.4 (`sendWelcomeEmail(email, { name, orgType, email })` call shape) is satisfied by the signature in this plan.
- **Plan 19-02 runtime path** — `participateIntakeFn` can now `await sendWelcomeEmail(...)` in a `step.run` block; the step is safe because both the Resend dispatch and the `renderWelcomeEmail()` JSX evaluation are idempotent and have no side effects beyond the outbound HTTPS call.
- **No impact** on pre-existing helpers or their callsites.

## Self-Check: PASSED

- `src/lib/email-templates/welcome-email.tsx` — FOUND
- `src/lib/email.ts` — FOUND (modified, verified new exports)
- Commit `e8c51b7` — FOUND in `git log`
- Commit `cd8773b` — FOUND in `git log`
- `tests/phase-19/welcome-email.test.ts` — 9/9 PASS

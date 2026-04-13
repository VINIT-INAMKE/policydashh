---
phase: 16
status: deferred
deferred_to: end-of-milestone-v0.2
created: 2026-04-14
operator: aditee
---

# Phase 16 Flow 5 Smoke Walk — DEFERRED

> **Status: deferred to end-of-milestone-v0.2.**
>
> Per project workflow preference (see `feedback_defer_smoke_walks.md`), all manual smoke walks in v0.2 are batched and executed in one focused session at milestone end rather than per phase. Phase 16 is being closed without running the smoke walk; this document is the placeholder that holds the full walk procedure intact for the milestone-end session.
>
> This file will be promoted to a real evidence document (with frontmatter `status: passed` or `status: gated`) when the operator runs the walk before `/gsd:complete-milestone`.

---

## Why deferred

- Plan 04 Task 04-02 requires running `npm run dev` + `npx inngest-cli@latest dev`, signing in via the browser, clicking through `feedback.decide`, and observing 4 effects across the DB, Inngest Dev UI, and Resend dashboard.
- Operator prefers to do all such walks back-to-back at milestone end (Phase 16 + Phase 17 recording walk + Phase 19 `/participate` walk + Phase 20 cal.com flow + Phase 23 Cardano anchoring walk + Phase 25 cross-phase E2E) rather than pausing per phase.
- The underlying code paths are already covered by automated tests:
  - `src/inngest/__tests__/feedback-reviewed-copy.test.ts` — Flow 5 reference path
  - `src/inngest/__tests__/auto-draft-cr-content.test.ts` — auto-draft CR construction
  - `src/inngest/__tests__/create-draft-cr.test.ts` — Plan 04 Task 04-01 (5/5 GREEN, error-path included)
  - `src/inngest/__tests__/notification-create.test.ts` — sendNotificationCreate payload validation
  - `src/inngest/__tests__/notification-dispatch.test.ts` — notificationDispatchFn step semantics
  - `src/__tests__/feedback-machine.test.ts`, `cr-machine.test.ts`, `versioning.test.ts` — router regression suites (44/44 green post-Plan-03)
- Risk of deferral: limited to integration-edge issues (env wiring, dev-server startup, real Resend delivery). The automated suite covers all in-process logic.

---

## Tracking

- This deferral is tracked in `.planning/phases/16-flow-5-smoke-notification-dispatch-migration/16-HUMAN-UAT.md` (created during phase verification step).
- It will surface in `/gsd:progress`, `/gsd:audit-uat`, and the `/gsd:complete-milestone` audit gate until resolved.
- The verifier creates the HUMAN-UAT file with `status: partial` so the milestone audit knows there is outstanding human-verify work.

---

## Walk Procedure (preserved verbatim for milestone end)

### 0. Pre-condition checks

```bash
npm test                                   # baseline ≥ 295/297 + new Phase 16 tests
npx tsc --noEmit                           # must be clean
grep RESEND_API_KEY .env.local || echo "RESEND_API_KEY NOT SET — Effect 2 will be GATED"
grep DATABASE_URL  .env.local | head -1    # must point at dev Neon
```

### 1. Start dev processes (two terminals)

**Terminal 1:**
```bash
npm run dev
```
Then verify Inngest route:
```bash
curl -s http://localhost:3000/api/inngest | head -40
```
Expected: JSON listing 3 functions — `feedback-reviewed`, `notification-dispatch`, `sample-hello`.

**Terminal 2:**
```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```
Open <http://localhost:8288>; confirm `policydash` app shows 3 functions.

### 2. Pick a test feedback item

```bash
node -e "import('@neondatabase/serverless').then(async ({ neon }) => {
  require('dotenv').config({ path: '.env.local' });
  const sql = neon(process.env.DATABASE_URL);
  console.log(JSON.stringify(await sql\`
    SELECT f.id, f.readable_id, f.status, u.email, f.section_id, f.submitter_id
    FROM feedback_items f
    JOIN users u ON u.id = f.submitter_id
    WHERE f.status IN ('submitted','under_review') AND u.email IS NOT NULL
    LIMIT 5
  \`, null, 2));
})"
```
Pick one row → record `id`, `readable_id`, `email`.

### 3. Execute Flow 5 in browser

1. Sign in as **admin** or **policy_lead** at http://localhost:3000
2. Open `/feedback`, open the chosen item
3. If status is `submitted`: click **Start Review** (exercises Plan 03 migrated `notification-dispatch`)
4. Click **Decide → Accept** → enter ≥ 20-char rationale → submit (fires Flow 5: `feedback.decide → sendFeedbackReviewed → feedbackReviewedFn`)

### 4. Observe Inngest Dev UI

http://localhost:8288 → **Runs** tab. Within ~5s expect runs for:
- `notification-dispatch` (only if Step 3 was clicked)
- `feedback-reviewed` (from Decide)

Click each, confirm all steps green, capture run IDs.

### 5. Verify 4 observable effects

Replace `<FEEDBACK_ID>` with the chosen row's UUID.

**Effect 1 — in-app notification:**
```bash
node -e "import('@neondatabase/serverless').then(async ({ neon }) => {
  require('dotenv').config({ path: '.env.local' });
  const sql = neon(process.env.DATABASE_URL);
  console.log(await sql\`
    SELECT id, user_id, type, title, idempotency_key, created_at
    FROM notifications WHERE entity_id = '<FEEDBACK_ID>'
    ORDER BY created_at DESC LIMIT 5
  \`);
})"
```
Expect ≥ 1 row with `type = 'feedback_status_changed'`.

**Effect 2 — Resend email:**
- If RESEND_API_KEY is set: check Resend dashboard → email to submitter, subject `Your feedback FB-XXX has been reviewed`.
- If unset: record `gated — RESEND_API_KEY unset` (still PASS).

**Effect 3 — auto-draft CR + links:**
```bash
node -e "import('@neondatabase/serverless').then(async ({ neon }) => {
  require('dotenv').config({ path: '.env.local' });
  const sql = neon(process.env.DATABASE_URL);
  const crs = await sql\`
    SELECT id, readable_id, status, owner_id, created_at
    FROM change_requests ORDER BY created_at DESC LIMIT 3
  \`;
  console.log('CRs:', crs);
  if (crs.length) {
    const crId = crs[0].id;
    console.log('cr_feedback_links:', await sql\`SELECT * FROM cr_feedback_links WHERE cr_id = \${crId}\`);
    console.log('cr_section_links:',  await sql\`SELECT * FROM cr_section_links  WHERE cr_id = \${crId}\`);
  }
})"
```
Expect newest CR `status = 'drafting'`, with one feedback-link + one section-link.

**Effect 4 — workflow_transitions log:**
```bash
node -e "import('@neondatabase/serverless').then(async ({ neon }) => {
  require('dotenv').config({ path: '.env.local' });
  const sql = neon(process.env.DATABASE_URL);
  console.log(await sql\`
    SELECT id, from_state, to_state, actor_id, timestamp
    FROM workflow_transitions WHERE entity_id = '<FEEDBACK_ID>'
    ORDER BY timestamp ASC
  \`);
})"
```
Expect ≥ 2 rows ending in `to_state = 'accepted'`.

### 6. Final acceptance gate

```bash
npm test
```
Must still exit 0 at ≥ baseline 295/297 + new Phase 16 tests.

Then `Ctrl+C` both terminals.

---

## When walk runs

Update this file's frontmatter:
- `status: passed` (or `gated` if Effect 2 was env-gated)
- Add `walked: <ISO-timestamp>`
- Append a `## Results` section with raw query outputs, Inngest run IDs, and PASS/GATED annotations per effect (≥ 4 of those tokens, one per effect — see Plan 04 acceptance criteria)
- Update `16-HUMAN-UAT.md` to mark all gaps `resolved`
- Run `/gsd:audit-uat` to confirm zero outstanding items

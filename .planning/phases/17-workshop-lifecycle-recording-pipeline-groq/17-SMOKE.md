---
phase: 17
slug: workshop-lifecycle-recording-pipeline-groq
status: deferred
defer_reason: "Manual smoke walks batched at /gsd:complete-milestone per feedback_defer_smoke_walks.md"
defer_target: "milestone-end batch"
created: 2026-04-14
plans_covered: [17-00, 17-01, 17-02, 17-03, 17-04, 17-05]
requirements_exercised: [WS-06, WS-12, WS-13, WS-14, LLM-01, LLM-02, LLM-03]
---

# Phase 17 — Smoke Walk (DEFERRED)

> This file is a placeholder. The manual walks below are DEFERRED to
> `/gsd:complete-milestone` time per operator workflow preference. Plan
> 17-05 closes without running these walks — the backend pipeline is
> verified via the full unit test suite (see Per-Task Verification Map in
> 17-VALIDATION.md). This document preserves the walk procedure verbatim
> so the milestone-end batch run has a complete checklist.

**Execution target:** Next `/gsd:complete-milestone` invocation after
milestone v0.2 content is otherwise complete.

**Pre-requisites:**
- `npm run dev` running on http://localhost:3000
- `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest` running on http://localhost:8288
- Real Neon dev DB with migration 0010 applied (Plan 17-01)
- Real `GROQ_API_KEY` set in `.env.local` (obtain from console.groq.com/keys)
- Real `RESEND_API_KEY` set in `.env.local` (optional — nudge emails silent no-op otherwise)
- Real R2 bucket configured (existing setup from Phase 10)
- A test mp3 file < 25MB on local disk
- Optional: a test mp3 file > 25MB for rejection walk

---

## Walk 1 — Workshop Status Transitions (WS-06)

**Asserts:** `upcoming → in_progress → completed → archived` transitions
fire `workflow_transitions` rows, and the `completed` transition triggers
the `workshopCompletedFn` Inngest run.

1. Sign in as an admin user (or workshop_moderator).
2. Navigate to `/workshops`. Click an existing workshop with status `upcoming`
   (or create a new one — it defaults to `upcoming`).
3. On the workshop detail page, observe:
   - Status badge shows "upcoming" (blue)
   - A "Start Workshop" button is visible (gated by canManage)
4. Click **Start Workshop**. Assert:
   - Toast "Workshop → in_progress" appears
   - Status badge updates to "in progress" (amber)
   - Button updates to "Mark Completed"
   - In DB: `SELECT * FROM workflow_transitions WHERE entity_id = '<workshop-id>' ORDER BY timestamp DESC LIMIT 1` shows a row with `from_state='upcoming'`, `to_state='in_progress'`
5. Click **Mark Completed**. Assert:
   - Toast "Workshop → completed" appears
   - Status badge updates to "completed" (green)
   - Button updates to "Archive"
   - DB: second workflow_transitions row with `from → to = in_progress → completed`
   - **Inngest Dev UI** (http://localhost:8288) → "Runs" tab shows a new `workshop-completed` function run. Click through:
     - Step 1 `create-checklist` → complete, with output showing the workshop title and moderator email
     - Step 2 `sleep-72h` → paused (sleeping until +72h)
   - DB: `SELECT COUNT(*) FROM workshop_evidence_checklist WHERE workshop_id = '<workshop-id>'` returns 5
6. Click **Archive**. Assert:
   - Status badge updates to "archived" (slate)
   - No transition button visible (archived is terminal)
   - DB: third workflow_transitions row with `completed → archived`
7. Try to transition an archived workshop to any state via direct API call
   — assert 400 with allowed-transitions error message.

---

## Walk 2 — Evidence Nudge Fast-Forward (WS-12, WS-13)

**Asserts:** The 72h sleepUntil step can be fast-forwarded from the Inngest
Dev UI, and the nudge email fires when slots are still empty.

1. Complete a fresh workshop per Walk 1 steps 1-5.
2. In Inngest Dev UI, locate the `workshop-completed` run's `sleep-72h` step.
   Click the **Fast Forward** button (Dev-UI affordance) to skip the sleep.
3. Assert the `nudge-72h` step now runs. Click through:
   - It queries for empty slots (all 5 should be empty since nothing was uploaded)
   - It calls `sendWorkshopEvidenceNudgeEmail` with `delayLabel: '72 hours'`
4. Check Resend dashboard (or whichever email inbox the moderator user is
   configured to receive to). Assert email subject contains
   "Evidence checklist reminder: <workshop title>" and body lists all 5
   slots as unfilled.
5. Repeat the fast-forward for `sleep-7d` and assert the second nudge.

---

## Walk 3 — Recording Pipeline Happy Path (WS-14, LLM-01/02/03)

**Asserts:** mp3 upload flows through attachArtifact → Inngest →
Groq Whisper → Groq llama → draft artifacts → moderator approval.

1. Sign in as admin or workshop_moderator.
2. Navigate to a workshop in `in_progress` or `completed` status.
3. Click "Attach Artifact" → select category **Recording** → choose a
   test mp3 file (< 25MB). Upload completes (R2 presign → browser PUT → publicUrl returned).
4. Click Save. The tRPC `workshop.attachArtifact` mutation runs with
   `artifactType: 'recording'` and `r2Key: <returned-key>`.
5. In Inngest Dev UI, assert a new `workshop-recording-processed` run appears:
   - Step 1 `fetch-recording` → completes with base64 payload
   - Step 2 `transcribe` → completes with the transcript string
   - Step 3 `summarize` → completes with JSON `{discussionPoints, decisions, actionItems}`
   - Step 4 `store-artifacts` → completes
6. Refresh the workshop detail page. Assert:
   - Two new artifacts appear in the artifact list: "Workshop transcript (draft)"
     and "Workshop summary (draft)"
   - Both show an amber "Draft" badge
   - Both show an "Approve" button (visible because canManage is true)
7. Click **Approve** on the transcript artifact. Assert:
   - Toast "Artifact approved"
   - The Draft badge disappears
   - DB: `SELECT review_status FROM workshop_artifacts WHERE id = '<wsa-id>'` returns `'approved'`
8. Repeat for the summary artifact.
9. Check DB: `SELECT * FROM workshop_evidence_checklist WHERE workshop_id = '<ws-id>' AND slot = 'recording'` → row should show `status = 'filled'` and `artifact_id` populated with the transcript artifact's id.

---

## Walk 4 — 25MB Upload Rejection (WS-14)

**Asserts:** Files > 25MB are rejected at the R2 presign step with a
friendly error message.

1. Attempt to upload an mp3 > 25MB via the same attach dialog.
2. Assert the `POST /api/upload` response is 400 with body
   `{"error": "File too large. Maximum 25MB"}`.
3. Assert no `workshop_artifacts` row is created, no Inngest run fires.

---

## Walk 5 — Groq Cost Guard Spot-Check (LLM-03)

**Asserts:** `chatComplete` actually sends `max_completion_tokens` to Groq,
so long-running summarizations don't exceed budget.

1. After Walk 3 is complete, open https://console.groq.com/ → usage/logs.
2. Find the latest `llama-3.1-8b-instant` request. Inspect the request body.
3. Assert `max_completion_tokens` is present and equals 1024
   (the value hard-coded in `summarizeTranscript`).
4. If the Groq console doesn't expose request bodies, spot-check via
   `grep -n "max_completion_tokens" src/lib/llm.ts` and trust the
   unit test in `src/lib/llm.test.ts` which asserts this at the mock level.

---

## Walk Completion Checklist

- [ ] Walk 1: Status transitions verified (4 transitions total)
- [ ] Walk 2: 72h nudge + 7d nudge fired from fast-forward
- [ ] Walk 3: Recording → transcript + summary → approve (happy path)
- [ ] Walk 4: 25MB rejection at presign
- [ ] Walk 5: Groq cost guard spot-check

After all walks pass, flip this file's `status:` frontmatter to `passed`
and add a `walked_at: <timestamp>` field. Update STATE.md with the smoke
completion note.

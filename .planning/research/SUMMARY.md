# Research Summary — PolicyDash v0.2

**Project:** PolicyDash — Verifiable Policy OS: Public Consultation & On-Chain Anchoring
**Domain:** Policy consultation platform with public on-ramp, LLM automation, and Cardano verification
**Researched:** 2026-04-13
**Confidence:** HIGH (stack verified against npm + repo; architecture grounded in repo source; pitfalls verified against installed Next.js 16 docs and package.json)

---

## Plan Corrections — READ FIRST

These are hard corrections that MUST propagate into every phase plan that touches cal.com or workshop transcription. They override any earlier spec language.

### Correction 1: Cal.com Does NOT Emit `BOOKING_COMPLETED`

The event does not exist. The canonical workshop lifecycle via cal.com webhooks is:

```
BOOKING_CREATED → MEETING_STARTED → MEETING_ENDED → RECORDING_READY
```

Any phase plan or spec that references `BOOKING_COMPLETED` is wrong. Use `MEETING_ENDED` as the event that marks a workshop complete and triggers attendance auto-population + post-workshop feedback link email.

Additionally: `MEETING_STARTED` and `MEETING_ENDED` have a **flat payload** (no `triggerEvent` / `createdAt` / `payload` wrapper). Every other cal.com event is wrapped. The webhook handler must branch on payload shape before dispatching to Inngest.

Events to subscribe: `BOOKING_CREATED`, `BOOKING_RESCHEDULED`, `BOOKING_CANCELLED`, `MEETING_ENDED`, and optionally `RECORDING_READY` (for auto-ingest of cal-hosted recordings).

**Do not subscribe to `BOOKING_COMPLETED` — it will never fire.**

### Correction 2: Whisper-large-v3-turbo Has Zero Speaker Diarization

Groq's whisper-large-v3-turbo returns a single undifferentiated text stream. A 60-minute policy discussion transcript reads as one speaker rambling. Diarization requires a separate service (pyannote, WhisperX) that Groq does not host.

**Recommended mitigation for v0.2 (no extra infra):** Cal.com Cal Video recordings include attendee join/leave timestamps. Use these to time-slice the transcript into rough per-attendee segments. This is not true diarization but is usable for summary purposes. Label speakers as "Speaker 1 / Speaker 2" or by org type, not by name inferred from LLM context (that is a hallucination vector).

Pyannote AI hosted API (~$0.15/hr) and WhisperX via Modal/Replicate are deferred to v0.3+ if moderators demand per-speaker attribution.

### Correction 3: Clerk Auth is Email/Password — Canonical v0.2 Public Path

v0.1 originally spec'd phone-only auth, but Clerk was switched to email/password before v0.1 shipped. The `users` schema has both `phone` and `email` nullable. v0.2 does NOT reintroduce phone-only auth.

The canonical public auto-registration path for `/participate` and the cal.com webhook handler is:

```ts
clerkClient.invitations.createInvitation({
  emailAddress,
  publicMetadata: { role: 'stakeholder', source: 'participate' }
})
```

Clerk's invitations API is **email-only** — there is no `phoneNumber` parameter. Any spec language claiming "phone-based invitation" is stale and incorrect.

The STACK.md contains a research-time note about `createUser` vs `createInvitation` branching that the project context supersedes. The project canonical path is `createInvitation` for the public on-ramp. Use `createUser` only for admin-created internal users where email + role are both known synchronously.

### Correction 4: Delete `ics` npm Package From Scope

Cal.com generates and sends `.ics` calendar attachments in its own booking confirmation emails. Installing the `ics` npm package would produce duplicate calendar events. Any roadmap item or phase plan mentioning "ICS calendar file generation" must be deleted.

---

## Executive Summary

PolicyDash v0.2 turns a closed authenticated policy workspace into a verifiable policy operating system. The three additions that define v0.2 are: (1) a public on-ramp where any stakeholder can self-register and book workshop seats without a prior admin invite, (2) a fully automated workshop-to-transcript-to-summary pipeline backed by Groq + Inngest, and (3) cryptographic verification where every published policy version and completed milestone gets SHA256-hashed and anchored to Cardano preview-net via Mesh SDK + Blockfrost. The v0.1 foundation (XState feedback lifecycle, CR workflow, immutable version snapshots, 7-role RBAC, Tiptap editor, workshop module, public portal, Inngest) is stable and carries forward unchanged — v0.2 integrates on top of it rather than rebuilding it.

The recommended build strategy is sequential domain unlocking: first clear technical debt (Yjs/Hocuspocus removal, stale verification fixes), then complete in-flight automation (Flow 5 smoke, notification migration, workshop lifecycle), then ship the public on-ramp (participate, workshops, cal.com webhooks, public content surfaces), then ship verification (milestones, SHA256, Cardano anchoring), and finally engagement tracking and integration smoke. This ordering is driven by hard dependencies: the public on-ramp requires a clean single-user editor (Phase 14) and a working Inngest notification pipeline (Phase 16); Cardano anchoring requires the Milestone entity (Phase 22) to exist before any Cardano code is written (Phase 23); engagement scoring requires cal.com attendance data (Phase 20) to be meaningful. The integration smoke (Phase 25) walks the entire chain end-to-end and can only run after all other phases complete.

The highest-severity risks in v0.2 are: LLM hallucination published publicly under the org's name (mitigated by mandatory moderator review gate — never auto-publish), Clerk invitation billing DOS from the unprotected public form (mitigated by layered Turnstile + Upstash rate limit + email deduplication), cal.com webhook forgery inflating user counts (mitigated by HMAC-SHA256 signature verification on raw body before any Clerk call), and Cardano double-anchoring from Inngest retries (mitigated by DB-level unique constraint + pre-claim anchor slot pattern). All four risks have well-documented mitigations that must be implemented at the phase where the feature is first built — retrofitting security after the fact is not acceptable for a policy-grade platform.

---

## Stack Additions

Only 4 new npm installs. All other deps already in v0.1.

| Package | Version | Why | Integration notes |
|---|---|---|---|
| `groq-sdk` | latest | One client covers `chat.completions` + `audio.transcriptions`; no separate Whisper client | Wrap in `src/lib/llm.ts` with `requireEnv('GROQ_API_KEY')`. All calls via Inngest `step.run` to bypass Vercel timeouts. Whisper has a 25MB upload limit — long workshops need chunking or reject-over-size |
| `@meshsdk/core` | **`1.9.0-beta.102` (exact pin)** | Cardano tx building + Blockfrost provider in one package; re-exports `BlockfrostProvider` | `import 'server-only'` guard in `src/lib/cardano.ts` to keep WASM off client bundles. All tx submission via Inngest `step.run`. Monitor Vercel bundle size after install |
| `@marsidev/react-turnstile` | latest | Cloudflare Turnstile widget for public forms — free, unlimited | Phase 19 install. Server-verify token before any Clerk invite call |
| `@calcom/embed-react` | `1.5.3` | Cal.com scheduling widget + booking UX | **Stale React 18.2 peer dep** → install with `--legacy-peer-deps`. Smoke-test on React 19 Strict Mode BEFORE locking in. Fallback: raw `<iframe>` with URL prefill |

**Explicit deletions from scope:**
- `ics` — cal.com owns calendar invites; duplicate gen = double events
- `@blockfrost/blockfrost-js` — Mesh SDK re-exports the provider

**Cal.com** hosted free tier (not self-hosted): unlimited bookings, webhooks, REST API, workflows, zero cost. Only downside: HTTPS-only webhooks (local dev needs cloudflared/ngrok tunnel).

**Blockfrost** free Starter plan: 50K req/day, 10 rps, 500 burst, 1 project. Projected v0.2 load ~300 req/day → **150× headroom**. Constraint: 1 project = 1 network; create as `preview` for v0.2.

**Env var additions** (all fail-fast via `requireEnv()` pattern from `src/lib/r2.ts`):

```
GROQ_API_KEY=                               # Phase 17
BLOCKFROST_PROJECT_ID_PREVIEW=              # Phase 23
CARDANO_WALLET_SEED_PREVIEW=                # Phase 23 (user-provided)
NEXT_PUBLIC_CARDANO_NETWORK=preview         # Phase 23
CAL_COM_API_KEY=                            # Phase 20
CAL_COM_WEBHOOK_SECRET=                     # Phase 20
NEXT_PUBLIC_CAL_COM_USERNAME=               # Phase 20
NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY=  # Phase 19
CLOUDFLARE_TURNSTILE_SECRET_KEY=            # Phase 19
UPSTASH_REDIS_REST_URL=                     # Phase 19 (if Upstash chosen for rate limit)
UPSTASH_REDIS_REST_TOKEN=                   # Phase 19
```

---

## Feature Table Stakes (must ship)

**Public consultation on-ramp**
- `/participate` form with Turnstile + role-routed intake (government / industry / legal / academia / civil society / public interest)
- `clerkClient.invitations.createInvitation({ emailAddress, publicMetadata: { role: 'stakeholder' } })` as canonical auto-register
- 6 role-tailored welcome emails via Resend
- Public `/workshops` listing with cal.com embed per workshop
- Cal.com webhook handler: create `workshopRegistrations` + Clerk-invite unknown emails
- Attendance auto-populated from cal.com `MEETING_ENDED` (NOT `BOOKING_COMPLETED` — see Plan Corrections)
- Post-workshop feedback link emailed to attendees, back-linked via `workshopFeedbackLinks`

**Workshop lifecycle**
- `workshops.status` enum: `upcoming → in_progress → completed → archived`
- Evidence checklist table with required-slot definitions
- `workshopCompleted` Inngest fn with 72h + 7d moderator nudges on missing slots
- Recording → Whisper transcription → llama summary via Groq (moderator-reviewed before publish)
- No speaker diarization in v0.2 (Plan Correction 2)

**Evidence pack export**
- Async via Inngest (sync tRPC would timeout)
- R2 binary inclusion via streaming `fflate.Zip` + R2 multipart upload
- Email delivery with presigned GET URL (24h expiry)
- Fallback: manifest-only pack if Phase 18 budget runs out

**Public content surfaces**
- `/research` content page (executive summary, Indian landscape, gap clusters, report download)
- `/framework` draft consultation surface with per-section status badges + what-changed log, shows `isPublicDraft: true` documents
- LLM prose consultation summary per published version, cached in `documentVersions.consultationSummary`, auto-regenerated on `version.published`
- Policy-grade theme (white/slate/saffron or teal)

**Verification & anchoring**
- `milestones` table (first-class entity) with required-slot definitions and readiness state, immutable once anchored
- SHA256 hashing service (`src/lib/hashing.ts`) for policyVersion, workshop, evidenceBundle, milestone
- Mesh SDK + Blockfrost Cardano preview-net anchoring
- Per-milestone AND per-version anchoring (every `version.published` triggers its own tx)
- Verified State badges on `/portal` with Cardanoscan preview-net explorer links

**Integration hygiene**
- Migrate `createNotification(...).catch(...)` callsites to `notification.create` Inngest event
  (touch-points: `feedback.ts:343,435`, `changeRequest.ts`, `version.ts`, `sectionAssignment.ts`; `feedback.decide:398` already in target pattern)
- `users.lastActivityAt` via tRPC middleware + admin inactive-user widget
- Cross-phase integration smoke in Phase 25

---

## Feature Differentiators (if time allows)

- LLM status machine (`pending → draft → approved`) for consultation summaries with guardrail regex for leaked stakeholder names
- Time-sliced transcript segments using cal.com attendee join/leave timestamps as pseudo-diarization
- Per-version Cardano tx explorer page (beyond the badge)
- Email blocklist (disposable domains) on `/participate`
- Engagement score display on stakeholder profile pages (not just admin widget)
- "Validate this draft" CTA on `/framework` (proto Flow 6)

---

## Architecture Integration Points

**Public vs protected tRPC.** `publicProcedure` already exists in `src/trpc/init.ts`, unused. Reuse wrapped with Turnstile verification + rate-limit middleware. Public routers go in `src/server/routers/public/` — filesystem separation is the enforcement mechanism.

**Inngest organization.** Domain subfolders: `src/inngest/functions/{feedback,workshop,milestone,notification,evidence,intake}/`. Flat `functions[]` barrel in `src/inngest/functions/index.ts`. Keep `src/inngest/events.ts` single file to ~800 lines. Every new fn MUST declare `concurrency: { key, limit: 1 }` for side-effecting ops.

**Cal.com sync direction.** One-directional: **cal.com → PolicyDash**. Workshops created in our app first with `calcomEventTypeId` FK; our backend calls cal.com API to create matching event type. All scheduling lives in cal.com. Webhooks drive registration + attendance.

**Milestone schema.** Single nullable `milestoneId` FK on each linked entity (`documentVersions`, `workshops`, `feedbackItems`, `evidenceArtifacts`). **Rejects** many-to-many join tables. Partial indexes keep it cheap.

**Cardano anchoring flow (5 Inngest steps).**
1. `compute-hash` — gather linked state, canonicalize JSON (RFC 8785 JCS), SHA256
2. `persist-hash` — DB write with `UNIQUE(milestoneId)` / `UNIQUE(versionId)` constraint
3. `check-existing-tx` — Blockfrost metadata-label search on content hash before submission (prevents double-anchor on redeploy)
4. `submit-tx` — Mesh SDK build + sign + submit via Blockfrost
5. `confirm-loop` — `step.sleep(30s)` + re-query until confirmed, store `txHash` + `anchoredAt`

Idempotency is NOT just `step.run` memoization (breaks on redeploy). Requires DB unique constraints + concurrency-key serialization + metadata-label pre-check.

**Webhook routing.** `app/api/webhooks/clerk/route.ts` (existing svix pattern), NEW `app/api/webhooks/cal/route.ts`, Inngest's own route. Extract common `verifyWebhookSignature` helper into `src/lib/webhooks.ts`.

**Notification migration strategy.** Transition-window dual-write: both old `createNotification().catch(...)` AND new `sendNotificationCreate(...)` fire with idempotency key on `createdBy + entityType + entityId + action`. Remove old callsite on next PR after confirming duplicate suppression.

---

## Build Order (critical path)

`14 → 15 → 16 → {17 ∥ 19} → 20 → 25`, with 18, 20.5, 21, 22→23, 24 parallelizing once prereqs land.

| Order | Phase | Reason |
|---|---|---|
| 1 | 14 Collab rollback | Shrink type surface before adding new modules |
| 2 | 15 Stale verification closeout | Fix v0.1 gaps before building on broken surfaces |
| 3 | 16 Notification dispatch migration | Mechanical fan-out prerequisite for all new Inngest fns |
| 4a | 17 Workshop lifecycle + recording | Blocks Phase 20 cal.com webhook (needs state machine) |
| 4b | 19 Public `/participate` + Clerk invite | Blocks Phase 20 (Clerk invite flow must work E2E first). Highest-risk intake phase |
| 5 | 20 Cal.com integration | Dual dependency on 17 + 19 — single biggest integration risk |
| — | 18 Async evidence pack | Parallelizable after 16 |
| — | 20.5 Public `/research` + `/framework` | Parallelizable after 17 |
| — | 21 Public shell + LLM summary + theme | Parallelizable after 20.5 |
| 6 | 22 Milestone entity + hashing | Blocks Phase 23 |
| 7 | 23 Cardano anchoring | Depends on 22 + funded wallet handoff |
| — | 24 Engagement tracking | Parallelizable after 16 |
| 8 | 25 Cross-phase integration smoke | Final gate |

**Phase 0 setup (optional, before Phase 14):** add `publicProcedure` helper shell at `src/trpc/public-procedure.ts`.

---

## Critical Pitfalls (mapped to phases)

| # | Pitfall | Phase | Prevention |
|---|---|---|---|
| 1 | LLM hallucinated consultation summary published under org's name | 21 | Status machine `pending → draft → approved` + guardrail regex + mandatory human approval modal. **No auto-publish.** |
| 2 | Cardano double-anchor on Inngest retry after redeploy | 23 | DB unique constraints + `concurrency: { key: 'cardano-wallet', limit: 1 }` + Blockfrost metadata-label pre-check. Never trust `step.run` memoization alone for irreversible effects |
| 3 | Clerk billing DOS via `/participate` spam | 19 | Turnstile → rate limit (Upstash or Postgres) → email blocklist → Inngest idempotency key. Monitor Clerk MAU billing meter |
| 4 | Cal.com webhook forgery inflating Clerk bill | 20 | HMAC-SHA256 over **raw** body (not after `req.json()`), timestamp-binding for replay prevention, idempotency on `bookingUid` |
| 5 | Groq cost blowup from malicious long upload | 17 | R2 presign rejects > 25MB, duration probe before transcription, per-org budget cap, `max_tokens` mandatory |
| 6 | Yjs removal breaks editor at runtime (passes typecheck) | 14 | Render tests after each deletion step + exhaustive deletion manifest: `block-editor.tsx`, `build-extensions.ts`, `presence-bar.tsx`, `use-presence.ts`, `build-extensions-collab.test.ts` |
| 7 | Evidence pack OOM on large workshops | 18 | Streaming `fflate.Zip` + R2 multipart upload. (Correction: Vercel 250MB is bundle limit; Fluid Compute Pro = 3008MB runtime — but streaming is still right answer) |
| 8 | SHA256 non-determinism breaks Cardano verification | 22 | RFC 8785 JCS canonical JSON OR explicit sort+stringify with golden-fixture tests **in the same phase** |
| 9 | Next.js 16 `cacheComponents` removes route segment config | 19, 21 | Current `next.config.ts` does NOT enable `cacheComponents`, so v0.1 pattern still works. Phase 14 decides enablement — **recommended: defer to v0.3** |
| 10 | Inngest event name collisions across 13 functions | 16+ | Enforce `{domain}.{entity}.{past-tense-verb}` in typed events module, NEVER string literals at callsites |
| 11 | Notification migration sends duplicate emails during cutover | 16 | Transition-window dual-write with idempotency key on `createdBy + entityType + entityId + action` |

---

## Open Questions for Phase Planners

Planner-level decisions deferred to the relevant phase (not blockers for roadmap creation):

1. **Rate-limit backend** (Phase 19): Upstash Redis vs Postgres-backed limiter
2. **Cal.com webhook signature header + timestamp field** (Phase 20): re-verify against current cal.com docs
3. **Cal.com free tier custom questions** (Phase 20): validate phone capture support
4. **Cal.com embed-react on React 19 Strict Mode** (Phase 20): smoke-test; fallback is raw `<iframe>`
5. **Whisper diarization approach** (Phase 17): time-slicing via cal.com timestamps (default) vs WhisperX/pyannote
6. **Whisper 25MB chunking strategy** (Phase 17): ffmpeg split, or reject workshops > N minutes
7. **Canonical JSON library** (Phase 22): RFC 8785 JCS package vs hand-rolled sort+stringify
8. **Mesh SDK current API** (Phase 23): Context7 lookup before implementation
9. **Blockfrost metadata search query shape** (Phase 23): re-verify `/metadata/txs/labels/:label`
10. **`cacheComponents` enablement** (Phase 14): now or defer to v0.3
11. **`workshopRegistrations` table existence** (Phase 20): verify new vs modified
12. **Evidence bundle entity vs aggregate** (Phase 22): introduce `evidenceBundles` or hash `evidenceArtifacts` directly
13. **Engagement score formula** (Phase 24): specific input weights
14. **Approver role for LLM summaries** (Phase 21): Policy Lead only or Research Lead also
15. **Per-version Cardano anchor cadence** (Phase 23): confirm both per-version and per-milestone
16. **Evidence pack binary scope** (Phase 18): streaming from day 1 or manifest-only fallback

---

_Synthesized: 2026-04-13 — inline synthesis (no synthesizer subagent), all 4 research files committed._
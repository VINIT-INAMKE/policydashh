# Feature Research — PolicyDash v0.2 Verifiable Policy OS

**Domain:** Public consultation on-ramp + workshop automation + LLM-assisted content + Cardano verification
**Researched:** 2026-04-13
**Confidence:** HIGH (verified against cal.com docs, Cardano CIPs, Whisper/pyannote ecosystem, 2025 LLM-UX literature)
**Scope:** v0.2 NEW capabilities only. v0.1 shipped features (FB/CR/Version/RBAC/Editor/Workshop-basic/Portal/Audit) are assumed and NOT re-researched.

---

## Context Snapshot

v0.1 already shipped: structured feedback (FB-NNN) with XState, Change Requests (CR-NNN) with merge, semantic versioning + immutable snapshots, traceability matrix, 7-role RBAC, workshop module with artifacts, public `/portal` read-only surface, evidence pack ZIP export, audit viewer, Inngest runtime with Flow 5 (feedback.decide → notification + email + auto-draft CR), Clerk phone auth, Tiptap block editor.

v0.2 is bolting on: public on-ramp (`/participate`, `/workshops`, `/research`, `/framework`), cal.com-driven registration, workshop recording → transcription → LLM summary pipeline, async evidence pack export via Inngest, first-class Milestone entity with SHA256 hashing, Cardano preview-net anchoring, LLM consultation summaries per version, stakeholder engagement tracking, and Yjs/Hocuspocus removal.

---

## 1. Public Intake Form with Role-Based Routing (`/participate`)

**Depends on v0.1:** Clerk auth, 7-role RBAC, stakeholder user model, Resend email, Inngest runtime.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Name + email + role + organization fields | Calendly/Typeform/HubSpot forms all require these four as the minimum; without org the submission has no context for a policy platform | LOW | Zod schema, React Hook Form, tRPC mutation |
| Role-as-radio (5 paths: regulator / industry / legal / academia / civil society) | newDoc2 explicitly splits the 4 homepage paths by stakeholder type; a free-text role field defeats routing | LOW | Enum maps 1:1 to existing RBAC organization types |
| Server-side validation + spam/bot protection | Any public form without bot protection gets spammed within 48h; Cloudflare Turnstile is the 2025 default (hCaptcha is the fallback) | LOW | Turnstile widget + server-side verify before tRPC mutation |
| Success state with next-step instruction | User needs to know what happens next — "check your email for the Clerk invite" is the minimum | LOW | Distinct success screen, not an inline toast |
| Clerk invite on submit (not open sign-up) | PROJECT.md Key Decision: public auto-registration via Clerk invitations API creates a real user synchronously + sends invite email. No separate `leads` table | MEDIUM | `clerkClient.invitations.createInvitation({emailAddress, publicMetadata: {role, orgType}})` then webhook reconciles `users.clerkId` |
| Rate-limiting per IP + per email | Without this, one actor can flood the role queue and drain Clerk invite quota | LOW | Upstash Redis counter keyed by IP hash; 5/hour soft, 20/day hard |
| Role-tailored welcome email after invite | Generic welcome email for a regulator vs a startup founder feels lazy; newDoc2 Flow 1 explicitly says "send tailored email" | LOW | Inngest `participateIntake` fn branches on role → picks Resend template |
| Honors privacy defaults from v0.1 (no public attribution until opt-in) | v0.1 constraint: "Stakeholder identity must be protected by default" | LOW | Default `publicAttribution=false` on user row |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Conditional fields per role (regulator → "which ministry/agency"; industry → "company stage"; academia → "institution + field") | Routes high-signal stakeholders into tailored follow-ups; generic forms capture noise | MEDIUM | Discriminated-union Zod schema, React Hook Form `watch` for conditional render |
| "Area of interest" multi-select mapped to policy framework sections | Directly feeds section-level assignment later (stakeholder only sees their section); aligns v0.2 intake with v0.1 section-scoped RBAC | MEDIUM | Seeds `sectionAssignments` rows at invite time |
| Preferred engagement dropdown ("workshop", "written feedback", "expert review", "observe only") | Drives downstream routing to workshop invite list or feedback-only path — newDoc2 Flow 1 final step | LOW | Feeds into `engagementPreference` column on user |
| Draft-autosave to localStorage before submit | Policy forms are longer than Calendly and users tab away; 2025 Typeform-style forms do this | LOW | Debounced localStorage write; cleared on submit |
| Immediate "what happens next" timeline on success screen ("1. Check email, 2. Set password, 3. Pick a workshop") | Reduces confusion between Clerk magic link and workshop booking | LOW | Static React component |
| i18n readiness (at least EN + HI copy keys) for Indian policy audience | Policy framework targets India; a pure-English regulator intake is a credibility hit | MEDIUM | next-intl scaffolding — copy strings extracted even if HI translation deferred |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Password field on the intake form | "Feels faster than an email round-trip" | Bypasses Clerk's invite flow → two user-creation paths → the exact bug class v0.1 fresh-start was designed to kill | Clerk invite email → user sets password on Clerk-hosted page |
| Open public signup (no invite) | "Lower friction" | Zero gate against bot users; v0.1 RBAC is default-deny but roles need to be provisioned deliberately | Intake form → Clerk invite → webhook sets role from `publicMetadata` |
| File upload on intake ("attach your credentials") | "Validates identity upfront" | Public unauthenticated file upload is an attack surface (R2 quota abuse, malware); also means R2 stores anonymous files | Defer evidence uploads until after Clerk sign-in |
| CAPTCHA with image-select (reCAPTCHA v2) | "More trustworthy than invisible" | 2025 best practice is Turnstile/invisible hCaptcha; v2 image-select has ~30% abandon rate on mobile | Cloudflare Turnstile (invisible) |
| Free-text role field | "Flexible, covers edge cases" | Breaks role routing, breaks email templating, breaks RBAC provisioning | Fixed enum + "Other (describe)" that routes to observer role for manual triage |
| Auto-create Clerk user with a generated password (no invite email) | "Skip the email step entirely" | User never gets the invite link → account is orphaned; also violates Clerk's recommended flow | Invitations API |

**Complexity:** MEDIUM overall (Clerk invite + Turnstile + role routing; form itself is trivial)

---

## 2. Cal.com-Driven Workshop Registration + Webhook Sync

**Depends on v0.1:** Workshop module, workshop registrations table (needs schema extension), Inngest runtime, Clerk users, notification system.

### Critical Finding — Cal.com Does NOT Emit `BOOKING_COMPLETED`

Verified against cal.com docs: the actual event list is `BOOKING_CREATED`, `BOOKING_RESCHEDULED`, `BOOKING_CANCELLED`, `BOOKING_REJECTED`, `BOOKING_REQUESTED`, `BOOKING_PAID`, `BOOKING_PAYMENT_INITIATED`, `BOOKING_NO_SHOW_UPDATED`, `MEETING_STARTED`, `MEETING_ENDED`, `RECORDING_READY`, `RECORDING_TRANSCRIPTION_GENERATED`, `INSTANT_MEETING`, `OOO_CREATED`. The canonical lifecycle is **`BOOKING_CREATED` → `MEETING_STARTED` → `MEETING_ENDED` → `RECORDING_READY`**, not `BOOKING_COMPLETED`. This MUST be corrected in the spec.

Note: `MEETING_STARTED` and `MEETING_ENDED` have a FLAT payload (no `triggerEvent`/`createdAt`/`payload` wrapper) — every other event is wrapped. Handler must branch.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Public `/workshops` listing page | newDoc2 spec; visitors need to see what exists before booking | LOW | SSR read from workshops table filtered by `status in ('upcoming','open_for_registration')` |
| Cal.com embed on `/workshops/[id]/register` | Cal.com hosts the scheduling + timezone + calendar invite + ICS; PROJECT.md Key Decision: cal.com delegated scheduling | LOW | `@calcom/embed-react` iframe with event-type linked per workshop |
| Webhook signature verification | Any unverified webhook endpoint is a forged-registration vulnerability | LOW | HMAC-SHA256 header verify against shared secret; reject invalid |
| Idempotency on webhook (deduplicate by `bookingUid`) | Cal.com retries on 5xx; without idempotency you double-register + double-email users | LOW | Unique index on `workshopRegistrations.calBookingUid` |
| `BOOKING_CREATED` → upsert user via Clerk invitation + create `workshopRegistrations` row | Canonical registration flow; if email matches existing Clerk user, use that, otherwise invite | MEDIUM | Handler checks Clerk by email, branches: invite new OR link existing |
| `BOOKING_CANCELLED` → mark registration cancelled + notify moderator | Cancellations that only live in cal.com diverge the local DB | LOW | Status flip + Inngest notification |
| `BOOKING_RESCHEDULED` → update start/end + fire new reminder schedule | Reschedules in cal.com that don't update local reminders cause no-shows | LOW | Delete+recreate reminder Inngest schedules |
| `MEETING_ENDED` → set `workshop.status = completed`, trigger evidence checklist nudge | This is the event the spec miscalls "BOOKING_COMPLETED"; flips lifecycle state | LOW | Inngest `workshop.meetingEnded` event |
| Attendance auto-population from `MEETING_ENDED` attendee list | Manual attendance tracking is the #1 reason v0.1 workshop data was incomplete | MEDIUM | Parse `attendees[].email`, mark each registration `attended=true`; moderator confirms edge cases |
| Post-workshop feedback link emailed to attendees (back-linked to workshop) | Flow 2 requirement; without it, workshop recordings generate no feedback | LOW | Resend template with signed URL `/workshops/[id]/feedback?token=...`, link row in `workshopFeedbackLinks` |
| 48h + 2h reminder Inngest schedule | newDoc2 Flow 2 explicit requirement; industry standard for paid scheduling | LOW | Inngest `sleepUntil` with cancellation on reschedule/cancel |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| `RECORDING_READY` webhook → auto-kick transcription pipeline | Closes the loop automatically; no moderator upload step needed for cal.com-hosted meetings | MEDIUM | Requires cal.com Cal Video or Daily; Google Meet recordings don't fire this |
| `RECORDING_TRANSCRIPTION_GENERATED` fallback when cal.com produces its own transcription | Lets us skip Groq entirely for cal-hosted meetings | MEDIUM | Store as alternate transcription source; moderator picks which one to summarize |
| Attendee pre-filling of cal.com "booking questions" from Clerk metadata if signed-in | Authenticated users shouldn't re-type name/email/org | LOW | Pass prefill URL params to embed |
| Expose a public "workshop attendance heatmap" in `/ops/dashboard` fed by webhook-populated attendance | Turns the data from Flow 2 into stakeholder engagement signal for Phase 24 | LOW | Aggregates into engagement score |
| `BOOKING_NO_SHOW_UPDATED` → decrements engagement score | Moderator marks no-show in cal.com → reflected in stakeholder tracker automatically | LOW | Ingest into `users.engagementScore` recomputation |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Polling cal.com REST API for booking updates | "Webhooks are flaky" | Webhooks with retry + idempotency are far more reliable than polling; polling drains rate budget | Trust the webhook + add a nightly reconciliation job for drift |
| Custom ICS generation and our own reminder emails (bypassing cal.com) | "More control" | This is exactly what PROJECT.md Key Decision rejected — duplicates cal.com functionality, cost doubles | Cal.com handles ICS/reminders; we only react to webhooks |
| Storing cal.com credentials for OAuth "write" access | "Let us cancel on their behalf" | Moderators can cancel in cal.com UI directly; OAuth write scope is a security liability | Read-only: only consume webhooks |
| Syncing ALL cal.com bookings into our DB | "Single source of truth" | Our DB cares only about PolicyDash workshops; mirroring unrelated event-types is noise | Filter by `eventTypeId` matching workshop IDs |
| Building our own scheduling UI | "Avoid vendor lock-in" | Reverses the v0.2 decision; half of Phase 20 was deleted specifically to avoid this | Cal.com embed; vendor lock-in is acceptable tradeoff |

**Complexity:** MEDIUM (webhook handler is small but 5 event types × idempotency × Clerk-invite + attendance logic). Critical correction: spec references `BOOKING_COMPLETED` which doesn't exist.

---

## 3. Workshop Recording → Groq Whisper Transcription → LLM Summary Pipeline

**Depends on v0.1:** Workshop module, R2 storage, Inngest runtime. **NEW dependencies:** Groq SDK (whisper-large-v3-turbo + llama-3.3-70b-versatile), moderator review UI.

### Critical Finding — Whisper-large-v3 Has NO Native Speaker Diarization

Verified: Whisper (all versions including v3-turbo via Groq) outputs a single text stream with no speaker labels. Diarization requires a separate model — typical 2026 stack is WhisperX (pyannote community-1) or the hosted Pyannote AI API. Groq does NOT host diarization. **Implication:** out of the box, a 60-min policy discussion transcript reads as one speaker rambling — unusable for accurate "who said what" attribution.

**Mitigation options (ranked by feasibility for v0.2):**
1. **Accept non-diarized transcript, lean on LLM to infer speakers from context** — cheap but LLM may hallucinate speaker labels. Fine for *summary* generation, bad for quote attribution.
2. **Run WhisperX/pyannote-community-1 locally via a Modal/Replicate call** — adds a second service dependency, but restores per-speaker turns. MEDIUM complexity.
3. **Use Pyannote AI hosted API** — cleanest, ~$0.15/hr, but adds a third paid SaaS beyond Groq/Blockfrost/Clerk/cal.com. Violates the v0.2 "minimize external deps" posture.
4. **Cal.com Cal Video recordings already come with attendee list + join/leave timestamps** — cheap proxy for diarization by time-slicing. No extra infra. **Recommended for v0.2.**

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Moderator uploads recording to R2 (or cal.com RECORDING_READY auto-ingests) | Two input paths: manual file upload for Google Meet recordings, webhook for cal-hosted | MEDIUM | Reuse r2-upload module from v0.1; add recording mime-type allowlist |
| Async Inngest function for transcription (not blocking the upload) | A 60-min recording at whisper-large-v3-turbo on Groq takes ~30-90s; must not block HTTP | LOW | Inngest `workshop.recordingUploaded` → fn with retries |
| Transcript stored as both raw text and JSON segments (timestamps) | Segments enable linking "quote X was said at 14:32" back to recording | LOW | `transcripts` table: `text`, `segments` JSONB |
| LLM summary generated after transcript is stable | llama-3.3-70b-versatile with ~8k-token input fits a 60-min transcript (roughly 6-8k tokens) | LOW | Groq chat completion with structured-output prompt |
| Moderator-reviews-before-public flag | PROJECT.md: "human review required; moderator approves before summary becomes public". No auto-publish | LOW | `summaryStatus` enum: `draft` / `reviewed` / `published` |
| Summary editable before publish | Moderators WILL edit LLM output; forcing regeneration is painful | LOW | Tiptap editor or plain textarea bound to summary field |
| Link between transcript segments and policy sections (manual by moderator) | The v0.1 "link workshop insights to sections" requirement survives v0.2 | MEDIUM | Existing `workshopArtifactLinks` / `workshopFeedbackLinks` schema |
| PII scrub pass on transcript before it is stored | Policy discussions can surface personal info; storing raw PII in DB is a compliance risk | MEDIUM | Regex pass for emails/phones + LLM prompt to flag; moderator review |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Structured summary schema (themes, decisions, open questions, quotes, action items) | A bulleted "what happened" is a commodity; a structured summary feeds the traceability matrix | LOW | Groq structured-output JSON schema mode; llama-3.3-70b supports JSON mode |
| "Claims without evidence" detector via LLM on transcript | Feeds the v0.1 Research Lead view with claims surfaced in workshops | MEDIUM | Second LLM pass with prompt "extract factual claims and mark which have cited evidence" |
| Time-sliced speaker approximation from cal.com attendee join/leave timestamps | Restores rough "who was in the room" labels without running pyannote | MEDIUM | Heuristic: correlate cal.com `attendees[].joinedAt/leftAt` with transcript segment timestamps; not true diarization but usable |
| Regenerate summary with custom prompt ("summarize from legal perspective") | Different stakeholder types want different lenses | LOW | Pre-canned prompt templates; each regen writes a new version row |
| Section-aware summary (per policy section, what did this workshop say?) | Higher-signal than one flat summary for 60-min session | MEDIUM | Chunk transcript → classify each segment to section → summarize per section |
| Confidence flags from LLM on each summary bullet ("HIGH / MEDIUM / LOW confidence based on transcript") | 2025 UX pattern: surface uncertainty, don't hide it | LOW | Part of structured-output schema |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-publish LLM summary without moderator review | "Save time" | Explicitly banned in PROJECT.md Out of Scope. Hallucinated summaries attached to a verifiable policy record are worse than no summary | Moderator review gate with `summaryStatus` machine |
| Speaker names inferred purely by LLM from context | "Looks diarized without pyannote" | LLM will confidently invent speaker names from context cues; this is the textbook hallucination failure mode. A regulator quoted under the wrong name is a real harm | Time-slice from cal.com attendees, OR explicitly label speakers as "Speaker 1 / Speaker 2" |
| Storing the full recording as a DB blob | "Simplicity" | Postgres for 500MB video = terrible. R2 already exists in v0.1 | R2 presigned upload + DB row stores key |
| Sending full transcript via Resend email | "Easy to share" | Email body limits; PII exposure in transit; loss of edit capability | Resend link to moderator review page |
| Real-time transcription streaming | "Feels magical" | Unnecessary complexity for an async workflow; Groq batch is fast enough | Batch after upload |
| Running LLM summary through a second "fact-check" LLM call | "Catches hallucinations" | Fact-checker LLM can also hallucinate; compounds false-confidence. Human review is the actual fix | Structured schema + confidence flags + human review |
| Exposing raw transcript publicly | "Transparency" | Raw transcripts contain hedges, misspeaks, PII that stakeholders never consented to publish | Only the edited + approved summary goes public; raw transcript is auditor-only |

**Complexity:** HIGH (multi-step Inngest pipeline, Groq integration new for v0.2, moderator review UI, diarization gap needs a design call). **Highest-risk feature in v0.2.**

---

## 4. Cardano Preview-Net Anchoring of Document State

**Depends on v0.1:** Document version snapshots, workshop artifacts. **NEW dependencies:** Milestone entity, SHA256 hashing service, Mesh SDK, Blockfrost API, funded preview-net wallet.

### Canonical Anchoring Pattern (Verified Against CIP-100 + Intersect Governance Docs)

Cardano anchoring in 2026 follows a consistent pattern: **(a) hash of the off-chain document, (b) URL where the document lives, (c) transaction metadata label embedding the hash + URL + context JSON**. CIP-100 (governance) uses blake2b-256 hashes, but Cardano transaction metadata labels (CIP-10) accept any hash — SHA256 is fine and is what newDoc1 explicitly specifies. DON'T anchor the entire policy JSON on-chain (expensive, violates the "state anchoring, not raw storage" rule from newDoc1).

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| SHA256 hash of stable serialization of the version/milestone | newDoc1: "every important object → generate SHA256 hash". Stability matters — JSON key order, whitespace, and encoding must be deterministic or hashes won't verify | MEDIUM | Canonical JSON (RFC 8785 JCS) or explicit sort+stringify; test with known fixtures |
| Metadata JSON shape: `{project, type, hash, timestamp, entityId, entityType}` | newDoc1 Metadata Example literally specifies this shape | LOW | Strict Zod schema; fits under Cardano's 16KB metadata limit trivially |
| Transaction submission via Mesh SDK + Blockfrost | newDoc1 tool list; Mesh SDK is the 2026 standard for TS/JS Cardano apps | MEDIUM | `meshsdk/core`, transaction builder, wallet signing via env-loaded seed |
| Funded preview-net wallet + txfee handling | Every anchor tx costs ~0.17 ADA on preview-net; wallet must be monitored | LOW | Env-loaded mnemonic, balance-check guard, alert on < 10 ADA |
| Store `txHash`, `blockHeight`, `submittedAt`, `confirmedAt` on the anchored entity | Without this you can't verify or display the anchor | LOW | Columns on `policyVersions`, `milestones`, `workshops`, `evidenceBundles` |
| "Verified State" badge with explorer link | newDoc1 UI spec: "Display as 'Verified State'". Link should open Cardanoscan preview-net explorer | LOW | Component: green badge + external link icon → `https://preview.cardanoscan.io/transaction/{txHash}` |
| Retry logic on Blockfrost failures | Preview-net is occasionally slow or returns 5xx; without retries tx submission is brittle | LOW | Inngest step retries; idempotent on our side (we generate UTXO each attempt) |
| Deterministic hash across environments | If dev hashes differ from prod hashes for the same content, verification is broken | MEDIUM | Unit tests locking golden hashes of fixture docs |
| Verification endpoint: given txHash, recompute hash from current DB, compare | Without this, the "verification layer" is only write-side, never read-side | LOW | tRPC query that returns `{ computed, onchain, match: boolean }` |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Public verification page showing tx confirmation depth + hash match | Third-party observers can verify WITHOUT our platform; this is the core verifiability story | LOW | Public read from DB + Blockfrost; no auth needed |
| Merkle tree over a milestone's constituent hashes (version + workshops + evidence) | Allows proving "this workshop was part of milestone M3" without publishing everything | HIGH | Merkle-lib + proof generation; UX for displaying a proof path |
| Anchoring throttle / batching | If we anchor every version individually on busy days, tx count + ADA cost climbs; batching into one metadata tx with multiple entries is cheaper | MEDIUM | Inngest debounced batcher; but adds latency to "Verified" badge appearance |
| "Timeline of proofs" on the public policy page — every version's anchor tx visible as a ribbon | Turns the blockchain layer from invisible into a marketing/credibility asset | LOW | Already have version history; just add tx chips |
| Reproducible-build-style canonicalization doc | Anyone can independently reproduce the hash from the published content; a one-page spec is a differentiator | LOW | Doc page under `/verify` |
| Wallet address disclosure + public statement of custody policy | Trust-building for a "verifiable policy OS" — if we hide the anchoring wallet, the verification layer is just vibes | LOW | `/verify/provenance` page |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Anchoring the full policy JSON on-chain | "Everything on-chain = maximum decentralization" | Violates newDoc1 principle ("Use it for state anchoring + proof of integrity"). 16KB Cardano metadata limit + cost + write-only retrieval pattern = wrong tool | Hash on-chain, content in R2/Postgres |
| Mainnet anchoring in v0.2 | "Looks more real" | Requires real ADA, ops rigor, key management maturity we don't have. PROJECT.md Key Decision: preview-net first | Preview-net + explicit "preview-net" label in badge UI |
| NFT-per-policy-version as the anchoring mechanism | "Collectible policy" | Adds minting complexity, wallet UX, royalty questions — zero verification value over a metadata-label tx | Metadata-label tx |
| Users signing with their own Cardano wallet before submitting feedback | "Decentralized identity" | Zero stakeholders have a Cardano wallet; kills conversion rate; Clerk auth is the identity layer | Clerk for identity; Cardano only for anchoring |
| Smart-contract-based governance voting on revisions | "DAO-like" | Governance is via RBAC + human review per PROJECT.md; on-chain voting is a feature for v3+ | Off-chain governance, on-chain anchoring |
| Using CIP-100 blake2b-256 governance anchors | "Standards compliance" | CIP-100 is specifically for DRep/committee governance metadata, not general document anchoring. Using it confuses governance tooling | Simple transaction metadata labels (CIP-10 range) |
| Displaying tx cost / ADA balance in the public UI | "Transparency" | Non-useful for stakeholders; muddles the "Verified State" message | Admin-only view |
| Displaying hash match status with green badge regardless of confirmation depth | "Instant verification" | Unconfirmed txs can be dropped; badge should distinguish `submitted / confirmed (1 block) / finalized (2160 blocks for preview but we use >= 3 for UX)` | Three-state badge: Pending → Verified → Finalized |

**Complexity:** HIGH for hashing canonicalization + Mesh SDK integration, MEDIUM for the badge UI. Canonicalization is the sleeper gotcha — get it wrong and all downstream verification is theater.

---

## 5. Public Consultation Summary Generation via LLM (per published version)

**Depends on v0.1:** Document versions, feedback data, Resend/notification system, publish event. **NEW:** Groq llama-3.3-70b, moderator review surface.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Summary generated on `version.published` Inngest event | Must happen automatically, not require a manual moderator click on every publish | LOW | Subscribe to existing `version.published` event |
| Input: feedback counts + aggregate decision outcomes + top feedback themes + changelog | Summary must be grounded in real data, not free-form generation | MEDIUM | Prepare structured context block from DB aggregation before LLM call |
| Summary cached in `documentVersions.consultationSummary` column | Regenerating per page load is cost + inconsistency across visitors | LOW | Column already referenced in PROJECT.md Active list |
| Regenerated automatically on every new `version.published` (not every edit) | Ties summary lifecycle to version lifecycle; per-edit regen is waste | LOW | Event subscription only on publish |
| Moderator can override and edit before it goes public | Same human-in-loop rule as workshop summaries | LOW | `summaryStatus` machine: `generating` / `draft` / `approved` / `published` |
| Explicit "AI-generated, reviewed by [Name]" byline on published summary | 2025 UX norm: every AI-generated public text must be labeled. Non-negotiable for policy credibility | LOW | Byline component with moderator name |
| Prompt explicitly grounded in provided feedback + decisions (no world knowledge) | Prevents model from generating plausible-but-fabricated narrative | LOW | System prompt: "Only use the provided data. If information is missing, say so explicitly." |
| Summary renders with "last reviewed" date | Trust cue; policy audiences expect editorial provenance | LOW | Static metadata |
| Privacy guardrails: no stakeholder names unless `publicAttribution=true` | v0.1 privacy constraint survives to v0.2 | MEDIUM | Pre-filter input data; post-check summary against name allowlist |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Structured summary with 5 named sections (scope of consultation, feedback themes, changes made, feedback not adopted, what comes next) | Consistent policy-doc feel vs. variable LLM prose | LOW | JSON schema in Groq structured output; client renders sections |
| "Confidence flags" inline with summary claims ("based on 47 feedback items" vs "based on 2 feedback items") | Calibration pattern from 2025 LLM UX literature; surfaces signal vs. anecdote | LOW | Count-aware prompt + template |
| Multi-length variants (executive 200-word / full 800-word / detailed 2000-word) | Different audiences want different depth; cheap to generate all three at once | LOW | One LLM call with three-variant output |
| Tone lock ("neutral, policy-register") via prompt + post-gen check | Policy audiences reject marketing tone; an LLM casually saying "exciting changes" kills credibility | LOW | System prompt + tone lexicon blocklist |
| Diff between this version's summary and prior version ("what changed in the summary") | Surfaces drift; useful for regulators tracking multi-version consultations | MEDIUM | Text diff on the prior stored summary |
| Citation links from summary sentences back to the feedback IDs that support them | Direct tie to v0.1 traceability matrix; makes summary auditable | HIGH | LLM returns citation spans + feedback ID list; UI renders as footnotes |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-publish LLM summary without moderator approval | "Scale" | Same anti-feature as #3. A hallucinated summary attached to a Cardano-anchored version is a trust-destroying error | Moderator review gate |
| LLM rewriting the policy TEXT itself | "Why stop at summaries?" | Explicitly banned in PROJECT.md: "no LLM drafting of policy sections" | Human-authored policy text; LLM only summarizes the consultation |
| Including stakeholder names in public summary | "More specific = more credible" | Privacy violation by default; v0.1 rule is opt-in attribution | Filter by `publicAttribution`; otherwise use org types ("an industry stakeholder noted...") |
| Training a custom fine-tuned model on past consultations | "Brand voice" | 10x cost, zero quality gain for this use case, creates a lock-in | Well-written system prompt with example output |
| Hiding the "AI-generated" label once a moderator has edited it | "Looks more human" | Material provenance deception; policy docs require disclosed authorship | Always show "AI-generated, reviewed by X" even post-edit |
| Summary claims like "consensus was reached" when consensus was not reached | "Sounds good" | LLM classic failure mode (sycophancy / false synthesis). Policy docs need honest disagreement | Prompt explicitly: "Report dissent as dissent; do not smooth it over" |
| Sentiment analysis of feedback in the summary | "Data-driven" | Sentiment on policy feedback is a vanity metric; two sentences of nuanced concern ≠ "negative sentiment = 0.4" | Count + theme extraction only |

**Complexity:** MEDIUM (prompt engineering + structured output + moderator review UI; Groq integration shared with Feature 3)

---

## 6. Stakeholder Engagement Tracking & Scoring

**Depends on v0.1:** User model, feedback submissions, workshop attendance (now auto-populated by Feature 2), audit log, tRPC middleware.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `users.lastActivityAt` updated by tRPC middleware on every authenticated mutation | Foundation metric; without it "inactive users" is unknowable | LOW | Middleware wrapper; debounced write (don't update on every read) |
| Counts: feedback submissions, workshop attendances, workshop registrations | The three base measurable events | LOW | Materialized aggregates or computed on demand |
| "Inactive users" widget on admin dashboard | PROJECT.md Phase 24 explicit requirement | LOW | SQL query: `lastActivityAt < now() - 30d` |
| Engagement score = weighted sum of feedback + workshops attended + sections reviewed | PROJECT.md: "basic engagement score (feedback count + workshop attendance count)" | LOW | `feedbackCount*2 + attendedCount*3 + registeredCount*1`, computed nightly |
| Score visibility is admin + the user themselves (not public) | Public leaderboards of policy participation are a trust-killer | LOW | RBAC check in tRPC query |
| Score explanation shown with score ("Your score: 12 from 4 feedback + 2 workshops") | Scores without transparency look arbitrary | LOW | Static breakdown in UI |
| Score decay over time (old activity worth less than new) | Without decay, a 2024 contributor outranks a 2026 active one forever | MEDIUM | Half-life decay function or rolling 90-day window |
| Score excludes observer role | Observers by definition don't contribute; scoring them invites gaming | LOW | Role filter |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Engagement segments (highly engaged / engaged / at-risk / inactive) | Actionable categories > raw numbers; drives outreach nudges | LOW | Tier thresholds; admin filter |
| Automated nudge to at-risk stakeholders ("we haven't heard from you since version v0.3 shipped") | Turns score into action; hooks into Inngest schedule | LOW | Nightly Inngest fn; Resend email |
| Per-section engagement heatmap ("which sections are drawing feedback, which are dead") | Finds dead zones in the consultation; directly serves the Research Lead | MEDIUM | Cross-join sections × feedback counts by 30d window |
| Org-type engagement comparison (are industry stakeholders engaging more than civil society?) | Calibration signal for outreach strategy | LOW | Aggregate by orgType column |
| Response rate (feedback decided / feedback submitted) per stakeholder | Closes the loop — are stakeholders getting answered? Low response rate → stakeholder disengagement risk | MEDIUM | Join feedback with decision status |
| "Time to first feedback" funnel (from Clerk invite accepted to first FB submitted) | Activation metric; reveals onboarding friction | LOW | Diff between `invitedAt` and `firstFeedbackAt` |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Public leaderboard of "most active stakeholders" | "Gamification" | Policy consultation is not gaming; public ranking discourages candor, invites brigading, and violates v0.1 privacy defaults | Admin-only segments |
| Counting page views in the score | "More data" | Vanity metric; tells you nothing about contribution quality, inflates scores for observers | Action-based metrics only |
| Raw tRPC call count as engagement signal | "Easy" | Captures noise (polling, re-renders) more than intent | Aggregate mutation count, not query count |
| Penalizing users for "negative" feedback | "Keep quality high" | Chills honest dissent, which is the whole point of consultation | All decided feedback counts equally regardless of outcome |
| Using engagement score to gate access to sections | "Incentivize participation" | Breaks role-based RBAC, creates perverse incentive to spam feedback to unlock sections | RBAC by role, not by score |
| LLM-generated engagement insights ("this user seems frustrated based on sentiment") | "AI-powered stakeholder intel" | Sentiment analysis on policy critique is exactly where LLMs project bias; using it as a management signal is a HR-adjacent liability | Count-based metrics |
| Tracking keystroke-level activity | "Real engagement" | Creepy, unnecessary, likely a GDPR/DPDPA issue | Mutation-based activity only |
| Score visible in leaderboard format even to the same user ("you are #47") | "Motivation" | Ranking frames policy feedback as competition; pushes toward volume over signal | Absolute score only |

**Complexity:** LOW-MEDIUM (middleware + nightly job + simple queries; decay and response-rate are the only non-trivial bits)

---

## Feature Dependencies

```
/participate intake
    └──requires──> Clerk invitations API (v0.1 Clerk auth)
    └──requires──> Cloudflare Turnstile (new)
    └──enhances──> Engagement tracking (Feature 6 — seeds users)

/workshops register
    └──requires──> cal.com embed + webhook handler (new)
    └──requires──> Workshop module (v0.1 Phase 10)
    └──requires──> Clerk invitations API (same path as /participate)
    └──enhances──> Engagement tracking (attendance auto-populates score)
    └──feeds──> Recording pipeline (RECORDING_READY webhook)

Recording pipeline
    └──requires──> R2 storage (v0.1)
    └──requires──> Groq SDK + whisper-large-v3-turbo (new)
    └──requires──> llama-3.3-70b-versatile (new)
    └──requires──> Moderator review UI (new but simple)
    └──feeds──> Workshop summary → linked to sections (v0.1 workshopArtifactLinks)

Consultation summary
    └──requires──> version.published Inngest event (v0.1 Phase 6/8)
    └──requires──> llama-3.3-70b-versatile (shared with recording pipeline)
    └──requires──> Moderator review UI (shared with recording pipeline)
    └──feeds──> Public portal version page (v0.1 Phase 9 extension)

Milestone entity + SHA256 hashing
    └──requires──> Canonicalization spec (new; sleeper-gotcha risk)
    └──requires──> Stable version snapshots (v0.1 Phase 6)
    └──feeds──> Cardano anchoring

Cardano anchoring
    └──requires──> Milestone entity + hashing (above)
    └──requires──> Mesh SDK + Blockfrost + funded preview-net wallet (new)
    └──requires──> Inngest with retry (v0.1)
    └──feeds──> Verified State badges on public pages

Engagement scoring
    └──requires──> tRPC mutation middleware (new but trivial)
    └──requires──> Attendance data (needs Feature 2 to be auto-populated)
    └──requires──> Feedback data (v0.1 Phase 4)
    └──enhances──> Admin dashboard (v0.1 Phase 8)
```

### Critical Ordering Implications

1. **`/participate` + `/workshops` register must ship before recording pipeline** — without stakeholders in the system, there are no workshops to record.
2. **Cal.com webhook handler must ship before engagement scoring** — attendance data feeds the score.
3. **SHA256 canonicalization must ship before Cardano anchoring** — wrong hash shape = rewrite all anchoring code.
4. **Moderator review UI is shared by recording pipeline AND consultation summary** — build once, use twice. Do NOT split into two separate review surfaces.
5. **LLM integration (Groq) is shared by recording pipeline AND consultation summary** — single SDK wrapper, two prompt templates. Same phase or adjacent phases.
6. **Milestone entity is a prerequisite for anchoring** — has to land in its own phase before Phase 23 Cardano work.

---

## MVP Definition — "Credible v0.2"

### Launch With (must-have for v0.2 to be credible as a "Verifiable Policy OS")

- [ ] `/participate` form with Clerk invite + Turnstile + role-routed welcome email
- [ ] `/workshops` listing + cal.com embed on `/workshops/[id]/register`
- [ ] Cal.com webhook handler covering `BOOKING_CREATED`, `BOOKING_CANCELLED`, `BOOKING_RESCHEDULED`, `MEETING_ENDED` (NOT `BOOKING_COMPLETED` — doesn't exist)
- [ ] Workshop lifecycle state machine + 72h + 7d checklist nudge
- [ ] Workshop recording upload + Groq transcription + LLM summary with moderator review gate
- [ ] Async evidence pack export via Inngest with R2 binaries + email delivery
- [ ] Public `/research` + `/framework` content pages with per-section status badges
- [ ] LLM consultation summary per `version.published` with human review and `[AI-generated, reviewed by X]` byline
- [ ] Milestone entity + SHA256 canonical hashing
- [ ] Cardano preview-net anchoring of every published version and completed milestone
- [ ] Verified State badges with Cardanoscan preview-net links
- [ ] `users.lastActivityAt` + basic engagement score (feedback count + attendance count)
- [ ] Public verification page (recompute hash from DB, show match status)
- [ ] Yjs/Hocuspocus removal (PROJECT.md Phase 14 — blocker for clean single-user editor)

### Add After Validation (v0.2.x follow-ups)

- [ ] Conditional form fields per role on `/participate`
- [ ] Section-aware workshop summaries (chunk transcript by policy section)
- [ ] Time-sliced speaker approximation from cal.com attendee timestamps
- [ ] Multi-length consultation summary variants (exec / full / detailed)
- [ ] Citation links from summary back to feedback IDs
- [ ] Engagement segments + automated at-risk nudges
- [ ] Response rate per stakeholder
- [ ] Public "timeline of proofs" ribbon on policy pages
- [ ] Per-section engagement heatmap
- [ ] `RECORDING_READY` webhook auto-ingestion (bypasses manual upload for cal-hosted recordings)

### Future Consideration (v0.3+ / deferred)

- [ ] Merkle proofs for milestone-level verification
- [ ] Pyannote AI hosted diarization (if moderator feedback demands it)
- [ ] Cardano mainnet cutover
- [ ] Expert review packet flow (Flow 6 — explicitly deferred to v0.3)
- [ ] i18n (HI translation strings)
- [ ] Public `/india-blockchain-policy` landing page (deferred in PROJECT.md until post-Phase-25)
- [ ] Anchoring batching/debouncing (only matters at volume)
- [ ] NFT-per-version (probably never)
- [ ] Reintroduce Yjs collab (v2)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `/participate` form + Clerk invite | HIGH | LOW | P1 |
| Cal.com embed + webhook handler (corrected event names) | HIGH | MEDIUM | P1 |
| Workshop lifecycle state machine + checklist nudges | MEDIUM | LOW | P1 |
| Async evidence pack export via Inngest | HIGH | MEDIUM | P1 |
| Recording → Whisper transcription | MEDIUM | MEDIUM | P1 |
| LLM workshop summary with human review | MEDIUM | MEDIUM | P1 |
| Public `/research` + `/framework` pages | HIGH | LOW | P1 |
| LLM consultation summary per version | HIGH | MEDIUM | P1 |
| Milestone entity + SHA256 canonicalization | HIGH | MEDIUM | P1 |
| Cardano preview-net anchoring | HIGH | HIGH | P1 |
| Verified State badge + public verify page | HIGH | LOW | P1 |
| Stakeholder `lastActivityAt` + basic score | MEDIUM | LOW | P1 |
| Yjs/Hocuspocus rollback | MEDIUM | MEDIUM | P1 (blocker for clean type surface) |
| Conditional role fields on intake | MEDIUM | MEDIUM | P2 |
| Section-aware workshop summary | MEDIUM | HIGH | P2 |
| Time-sliced speaker labels | MEDIUM | MEDIUM | P2 |
| Engagement segments + at-risk nudges | MEDIUM | LOW | P2 |
| Response rate metric | MEDIUM | MEDIUM | P2 |
| Multi-length summary variants | LOW | LOW | P2 |
| Citation links in consultation summary | MEDIUM | HIGH | P2 |
| Public timeline-of-proofs ribbon | MEDIUM | LOW | P2 |
| Merkle proofs for milestones | LOW | HIGH | P3 |
| Pyannote hosted diarization | LOW | MEDIUM | P3 |
| Mainnet cutover | LOW | HIGH | P3 |

---

## Critical Risks Flagged for Phase Planners

1. **`BOOKING_COMPLETED` does not exist in cal.com.** Spec and future phase plans must use `MEETING_ENDED` (or `BOOKING_PAID` if payment is the gate). `MEETING_ENDED` also has a FLAT payload while other events are wrapped — webhook handler must branch.
2. **Whisper-large-v3 has zero native diarization.** Spec is silent on this. For v0.2 the pragmatic answer is time-slice-by-cal.com-attendees as a "good enough" proxy, with a P3 fallback to Pyannote AI hosted. Do not promise accurate per-speaker quotes in v0.2.
3. **Canonical serialization is a sleeper gotcha for hashing.** If JSON key order or whitespace isn't deterministic, re-verification fails silently. Lock it behind golden fixtures in the same phase that introduces the hashing service.
4. **Moderator review UI is the human-in-loop gate for two features** (workshop summary + consultation summary). Build it once. Don't duplicate.
5. **LLM summary anti-feature enforcement** (no auto-publish, no stakeholder names without opt-in, no sentiment scoring, no tone drift) should be encoded as prompt contract + post-gen validation, not just "trust the moderator."
6. **Turnstile + rate-limit must ship in the same PR as `/participate`.** A public unauthenticated form without them is a same-day spam liability.
7. **Cal.com vendor lock-in is accepted per PROJECT.md Key Decision.** Do not let scope creep add "backup scheduler" abstractions.
8. **Groq is now a hard dependency.** If Groq goes down, transcription + both LLM summary paths break. Inngest retries cover transient failures, but the moderator UI must show "generation pending" state gracefully.

---

## Sources

- [Cal.com Webhooks Documentation](https://cal.com/docs/developing/guides/automation/webhooks) — authoritative event list, payload shapes
- [Cal.com Webhooks MDX (GitHub)](https://github.com/calcom/cal.com/blob/main/docs/developing/guides/automation/webhooks.mdx) — source-of-truth on current events
- [Cal.com Issue #12286 — Missing Webhook Fields](https://github.com/calcom/cal.com/issues/12286) — documented gaps to watch for
- [WhisperX GitHub (m-bain/whisperX)](https://github.com/m-bain/whisperX) — canonical Whisper + diarization wrapper
- [Pyannote Community-1 Announcement](https://www.pyannote.ai/blog/community-1) — 2025 SOTA open diarization model
- [Whisper-large-v3 Speaker Recognition Discussion](https://huggingface.co/openai/whisper-large-v3/discussions/167) — confirms no native diarization
- [CIP-100 Cardano Governance Metadata](https://github.com/cardano-foundation/CIPs/blob/master/CIP-0100/README.md) — metadata anchor pattern + hash verification norms
- [Intersect Metadata Anchor Definition](https://docs.intersectmbo.org/cardano-facilitation-services/cardano-budget/intersect-administration-services/2025-apply-for-tender/key-terms/metadata-anchor) — canonical anchor spec
- [Cardano Developer Portal — Transaction Metadata](https://developers.cardano.org/docs/transaction-metadata/retrieving-metadata/) — how metadata retrieval works
- [Cardanoscan (explorer)](https://cardanoscan.io/) — target explorer for verified-state badge links
- [LLM Hallucinations 2026 (Lakera)](https://www.lakera.ai/blog/guide-to-hallucinations-in-large-language-models) — 2025-2026 UX patterns for disclaimers/confidence flags
- [LLM Hallucinations in Conversational AI — End-User Perceptions (2025)](https://www.tandfonline.com/doi/full/10.1080/10447318.2025.2580540) — disclaimer UX research
- [HalluLens Benchmark (ACL 2025)](https://aclanthology.org/2025.acl-long.1176/) — hallucination detection baselines

Internal context:
- `.planning/PROJECT.md` — v0.2 target features, Key Decisions, Out-of-Scope list
- `D:/aditee/policydash/newDoc1.md` — architecture vision, workshop 11-step lifecycle, Cardano anchoring flow, metadata JSON shape
- `D:/aditee/policydash/newDoc2.md` — instance structure, n8n flows 1-7 (being reimplemented in Inngest), CMS collections, page-by-page UX
- `D:/aditee/policydash/newDocmain.md` — marketing language + tone for public pages

---
*Feature research for: PolicyDash v0.2 Verifiable Policy OS*
*Researched: 2026-04-13*

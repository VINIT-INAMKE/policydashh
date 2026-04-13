# Pitfalls Research — v0.2 Verifiable Policy OS

**Domain:** Adding public on-ramp (Clerk invitations), webhook-driven automation (Cal.com), LLM content (Groq), Cardano preview-net anchoring, and Inngest migration to an existing authenticated Next.js 16 app on Vercel serverless.
**Researched:** 2026-04-13
**Confidence:** HIGH for stack-verified claims (next@16.2.1, @clerk/nextjs@^7.0.6, inngest@^4.2.1, svix@^1.89.0, fflate@^0.8.2 confirmed in package.json; Next.js 16 caching model confirmed from `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` and `.../03-file-conventions/02-route-segment-config/index.md`). MEDIUM for integration patterns involving Cal.com / Groq / Blockfrost where behavior is documented but un-exercised in this codebase.

**Scope mapping:** pitfalls are tagged to the v0.2 phase list from `.planning/PROJECT.md`:

- Phase 14 — Collab rollback (Yjs/Hocuspocus removal)
- Phase 15 — Stale verification closeout
- Phase 16 — Flow 5 smoke + notification.create migration
- Phase 17 — Workshop lifecycle + checklist
- Phase 18 — Workshop recording → Groq + async evidence pack
- Phase 19 — Public `/participate` intake (Turnstile + Clerk invite)
- Phase 20 — Public `/workshops` + cal.com webhook
- Phase 21 — Public `/research` + `/framework` + LLM consultation summary + theme
- Phase 22 — Milestones entity + SHA256 hashing
- Phase 23 — Cardano preview-net anchoring (Mesh + Blockfrost)
- Phase 24 — Stakeholder engagement tracking
- Phase 25 — Cross-phase integration smoke

---

## Critical Pitfalls

### Pitfall 1: Clerk invitation billing DOS via unrate-limited public form

**Category:** Intake & Register
**Phase:** 19 (participate), 20 (workshops)

**What goes wrong:**
`/participate` and `/workshops/[id]/register` call `clerkClient.invitations.createInvitation({ emailAddress })` on every form submission. Each accepted invitation becomes a billable Monthly Active User the moment the recipient clicks through — but more importantly, each *created* invitation increments Clerk's Pending Invitation count and inflates email-delivery costs. A bot farm submitting 10,000 emails from a throwaway domain inflates the MAU meter **and** the Clerk email-volume meter, and may trip Clerk's own anti-abuse rate limits which then rejects legitimate users for ~1 hour.

**Warning signs in production:**
- Sudden spike in `clerk.invitations.created` events without matching `clerk.user.signedIn` follow-ups
- Clerk dashboard "Invitations pending" count climbing by thousands/day
- Resend/Clerk email bounce rate > 30 percent (bot emails are fake)
- Legitimate invite emails start failing with Clerk 429s
- Vercel invocation cost on `/api/participate` climbs while actual user count doesn't

**Prevention strategy — layered defense, none sufficient alone:**

1. **Turnstile is the first gate but NOT the last.** Cloudflare Turnstile server-side `siteverify` must run in the route handler **before** any Clerk call. Reject silently on failure (don't return 429 — that teaches the bot to retry). File: `app/api/participate/route.ts`.
2. **Per-IP sliding-window rate limit at the edge.** Use Upstash Redis (or `@vercel/kv`) keyed on `x-forwarded-for` with a 5-per-hour limit on invitation creation. Do this *before* Turnstile verification so even a solved Turnstile can't be replayed.
3. **Email domain heuristic allow/deny.** Block disposable-email domains (`mailinator`, `tempmail`, `10minutemail`, `guerrillamail`, etc.). Maintain list in `src/lib/email-blocklist.ts`.
4. **Idempotency by email.** Before creating an invitation, query `users.email` **and** call `clerkClient.invitations.getInvitationList({ emailAddress })`. If a pending invitation exists, return success without creating a new one — prevents "same email 100 times" amplification.
5. **Daily cap at the org level.** Maintain a row in a `rate_limits` table counting `invitations_created_today`. Refuse all creation past 200/day; alert admin via Inngest notification when > 100/day.
6. **Inngest event for audit.** Emit `participate.submitted` even on rejection (with `status: 'blocked_turnstile' | 'blocked_ratelimit' | 'blocked_duplicate' | 'accepted'`). Use this for monitoring, not business logic.
7. **Inngest concurrency key.** If `participate.submitted` triggers the Clerk-invitation Inngest fn, set `concurrency: { key: 'event.data.ipHash', limit: 1 }` so a burst from one IP serializes.

**The Cal.com + Turnstile layers are NOT enough on their own** — Cal.com has its own anti-abuse but its webhook will fire for every booking, and Turnstile on the embed doesn't protect the webhook endpoint. The webhook is a separate attack surface (see Pitfall 2).

**Confidence:** HIGH. Clerk's documented invitation API does not rate-limit by default; billing is MAU-based; Turnstile is CAPTCHA-equivalent and bots routinely solve low-difficulty Turnstile challenges via CAPTCHA farms at < $2 / 1000 solves.

---

### Pitfall 2: Cal.com webhook forgery inflates Clerk bill via unauthenticated user creation

**Category:** Webhook Security
**Phase:** 20

**What goes wrong:**
`POST /api/webhooks/cal` receives `BOOKING_CREATED` → we read `attendees[0].email`, call `clerkClient.invitations.createInvitation(...)`, insert `workshopRegistrations` row. An attacker who discovers the webhook URL (it ships in public JS bundles if misconfigured; it shows up in network traces; it is mentioned in Cal.com documentation) can POST crafted JSON at it with any email addresses they want — each POST creates a Clerk user and bills us.

Cal.com webhooks **do** support HMAC signing, but:
- The signature is optional per-webhook, not required by default.
- The header name varies (`X-Cal-Signature-256` at time of writing), the hashing is HMAC-SHA256 over the raw body, and using `await req.json()` before verification invalidates the signature because the serialized bytes differ.
- Replay attacks are possible if timestamp is not bound to the signature.

**Warning signs in production:**
- `workshopRegistrations` rows with timestamps clustered within a few seconds
- Registrations for workshops that have no Cal.com bookings visible in the Cal.com dashboard
- Clerk invitations addressed to emails that never reached a browser
- Webhook endpoint log showing requests from IPs outside Cal.com's documented egress range

**Prevention strategy:**

1. **Require the signing secret at module init, not per-request.** Mirror `src/lib/r2.ts` pattern — throw at import time if `CAL_WEBHOOK_SECRET` is missing. File: `src/lib/cal-webhook.ts`.
2. **Read the raw body first, verify, then parse.** Next.js 16 Route Handlers do not consume the body until `req.text()` / `req.json()` is called. Always:
   ```ts
   const raw = await req.text()
   const sig = req.headers.get('x-cal-signature-256') ?? ''
   const expected = createHmac('sha256', secret).update(raw).digest('hex')
   if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
     return new Response('invalid signature', { status: 401 })
   }
   const event = JSON.parse(raw)
   ```
3. **Bind the timestamp into the signature check.** Cal.com's `triggeredAt` is inside the body — reject events where `Date.now() - triggeredAt > 5 * 60_000`. Prevents replay of a captured legitimate webhook.
4. **Idempotency key on bookingUid.** Insert `(provider: 'calcom', externalId: bookingUid)` into an `external_events_seen` table with a unique index. Second delivery of the same event becomes a no-op before any Clerk call. Cal.com **will** retry on 5xx and does not guarantee once-only delivery.
5. **Pin Cal.com source IPs** via Vercel Edge Middleware on `/api/webhooks/cal`. Cal.com publishes egress IPs; if the incoming IP is outside the range, reject with 401 before the handler runs. Defense in depth — the HMAC is the real gate.
6. **Do NOT auto-create the Clerk user in the webhook handler itself.** Emit `workshop.registration.received` Inngest event; the Inngest fn owns the Clerk invitation. This means the webhook returns 200 in under 100ms (Cal.com times out at 10s but retries aggressively on latency) and all the rate-limit logic from Pitfall 1 applies.

**Reference pattern:** the existing `app/api/webhooks/clerk/route.ts` uses Svix which handles signature + timestamp + replay in one call — we don't get that shortcut with Cal.com. Write a `verifyCalWebhook(raw, sig, ts)` helper in `src/lib/cal-webhook.ts` and unit-test it with known-good and known-bad signatures.

**Confidence:** HIGH on mechanism. MEDIUM on specific header name — Cal.com has changed this before; the Phase 20 planner must re-verify against current Cal.com webhook docs (Context7 or https://cal.com/docs/core-features/webhooks) before coding.

---

### Pitfall 3: Groq Whisper cost blowup from adversarial workshop recording

**Category:** LLM & Groq
**Phase:** 18

**What goes wrong:**
Workshop moderator uploads a recording to R2, Inngest fn pulls it and sends to `whisper-large-v3-turbo`. Groq bills per audio-second. An attacker who is a trusted moderator (or who compromises a moderator account) uploads a 10-hour silence track, or worse, a looped file flagged as much longer than its actual bytes. Or Groq has its own max-file-size policy that returns 400 but bills for the preprocessed duration.

A separate failure mode: the transcript itself gets fed to `llama-3.3-70b-versatile` with no token cap. A 10-hour transcript is ~60k words ~80k tokens input, and without a `max_tokens` cap the model may return 8k output. That single recording can cost dollars, and one adversary can run it 1000 times before anyone notices the bill.

**Warning signs in production:**
- Groq dashboard daily cost chart shows a step change out of pattern
- `workshops.recordingDurationSec` values above 3 hours (policy workshops are typically 60-90 min)
- Transcription step Inngest timing is > 5 minutes (Whisper is fast; long = long input)

**Prevention strategy:**

1. **Hard cap recording upload size at presign time.** Already pattern established — `getUploadUrl(key, contentType, contentLength)` in `src/lib/r2.ts` takes a `ContentLength` parameter. Pass `contentLength: 500 * 1024 * 1024` (500MB) max for workshops. Reject larger in the presign-issuing tRPC procedure. File: `src/server/api/routers/workshop.ts`.
2. **Probe duration before spending.** After R2 upload, the Inngest fn `step.run('probe-duration', ...)` fetches the first ~1MB and parses container metadata (use `music-metadata` or FFprobe via HTTP). If duration > 3 hours, **do not transcribe** — flag for human review. This catches slow-drift attacks and also catches legitimate "moderator accidentally uploaded the full meeting platform archive" mistakes.
3. **Per-org daily Groq budget.** Maintain `org_usage_daily(org_id, date, groq_audio_seconds, groq_input_tokens, groq_output_tokens)`. Before each Groq call, `step.run('check-budget', ...)` — if over, emit `groq.budget.exceeded` event and notify admin; do not call Groq. Throttle at $10/org/day in v0.2.
4. **Cap LLM `max_tokens` on every Groq chat call.** Never call the Groq SDK without a `max_tokens` argument. For consultation summary: `max_tokens: 1200`. For per-section summary: `max_tokens: 400`. Wrap the Groq client in `src/lib/groq.ts` that **requires** `max_tokens` as a typed parameter.
5. **Reject transcripts over N characters before summarization.** Cheap guard: if transcript length > 120k chars, chunk or truncate; don't dump the whole thing into one call.
6. **Set the Inngest fn `timeouts.finish` to 10 minutes.** A runaway Groq call counts against durable function wallclock; failing early means the retry budget catches the problem.

**Confidence:** HIGH on mechanism. Groq's pricing is public and per-second / per-token. The `max_tokens` cap is a universal LLM pattern — it is not optional.

---

### Pitfall 4: LLM-hallucinated "consultation summary" published to public portal under the org's name

**Category:** LLM & Groq
**Phase:** 21

**What goes wrong:**
On `version.published`, an Inngest fn calls Groq (`llama-3.3-70b-versatile`) to summarize all accepted/rejected feedback for the version. The output is cached to `documentVersions.consultationSummary` and rendered verbatim on `/portal/versions/[id]`. The LLM paragraphs out something like *"Stakeholder Ministry of Electronics decided to withdraw their objection on Section 4"* — something that did not happen. The public portal now attributes a fabricated quote to a real government body, under the organization's brand, and Google indexes it.

This is the highest-severity pitfall in v0.2 because: (a) the damage is reputational and legal (defamation risk); (b) the LLM is probabilistic so unit tests can't catch it; (c) hallucination rates on long-tail names/quotes in summarization tasks are non-zero even on llama-3.3-70b.

**Warning signs in production:**
- Public portal summary contains proper nouns not present in the feedback corpus
- Summary includes direct quotes (the prompt should forbid quotes)
- Summary includes dates or numbers not in the source
- A stakeholder emails support saying "we never said that"

**Prevention strategy — human-in-loop is mandatory:**

1. **Summaries are generated as DRAFT, never auto-published.** Add `documentVersions.consultationSummaryStatus` enum: `pending | draft | approved | rejected`. Only `approved` renders on `/portal`. Default on first generation is `draft`.
2. **Publish is a two-step operation.** Admin opens a review modal showing the diff between raw feedback aggregate counts (known-true numbers from SQL) and the LLM prose, approves or regenerates. Approval writes `approvedBy`, `approvedAt`, locks the content. File: `app/(workspace)/policies/[id]/versions/[vid]/summary/page.tsx`.
3. **Structure the prompt to forbid fabrication.** System prompt enforces:
   - "Only summarize feedback items provided in the input. Do not introduce organizations, quotes, dates, or numbers not present in the input."
   - "If you cannot summarize without fabricating, output the exact string `INSUFFICIENT_INPUT` and nothing else."
   - Response must be plain prose, no markdown, no bullet points with made-up data.
4. **Post-generation validation step.** `step.run('validate-summary', ...)` runs regex checks:
   - All proper nouns in the summary must appear in the input corpus (extract names via NER or token-match against feedback.body / users.name)
   - No dates / numeric amounts that don't appear in the input
   - Length between 200 and 1500 chars
   - Does not contain `"` character (no quotes)
   On failure, mark status `rejected` and do not present to human reviewer — fail closed.
5. **Display a disclaimer.** Public portal renders: *"Summary generated from feedback data and reviewed by [org name] on [date]. Raw feedback counts authoritative, see /portal/versions/[id]/feedback."*
6. **Ground-truth counts are always computed from SQL, not LLM.** "47 feedback items, 22 accepted, 11 partially accepted, 14 rejected" — that string is `<FeedbackCounts versionId={...} />` from the database, adjacent to but not inside the LLM prose block.
7. **Store the model + prompt hash on the summary row** so regeneration after prompt improvements is traceable.

**Phase 21 verification gate:** a phase-exit test must confirm that (a) a freshly published version shows status=pending on `/portal` with no LLM text visible, (b) the admin review UI exists, (c) regenerate is wired.

**Confidence:** HIGH. This is a standard LLM product-safety pitfall; the mitigation is standard (human-in-loop + structured extraction for ground truth + guardrail validation on output).

---

### Pitfall 5: Cardano double-anchoring via Inngest retry on an already-submitted tx

**Category:** Cardano
**Phase:** 22, 23

**What goes wrong:**
`milestoneReady` Inngest fn has steps: `build-metadata → sign-tx → submit-tx → store-txHash`. A transient Vercel timeout after submit but before store means Inngest retries the whole fn (or just the step). `step.run` memoizes results **per step id**, so a retry of the `submit-tx` step at the memoization layer is safe — but if the step id includes a timestamp or the function signature changes between deploys, the memoization key misses and Inngest re-runs the step. On Cardano, the second submit may:
- Be rejected as duplicate (UTXO already consumed) — wasted retry but safe
- Succeed because the fn built a fresh tx using current UTXO state — **double anchoring, double ADA spend**
- Be rejected by Blockfrost but charged the mempool fee anyway

Separately, **per-version anchoring** (`version.published` → tx) can race with **per-milestone anchoring**. Both events can fire within the same Inngest delivery batch, both build txs against the same UTXO, and one succeeds, one fails with `UtxoNotFoundError`, user sees half the anchoring missing.

**Warning signs in production:**
- Two `policyVersionAnchors` rows for the same versionId with different txHash
- Blockfrost errors `BadInputsUTxO` or `InputsExhausted` in Inngest logs
- Preview-net wallet balance dropping faster than expected (each anchor is ~0.17 ADA in fees, budget drains)
- Cardanoscan shows two txs anchoring identical metadata within seconds

**Prevention strategy:**

1. **Idempotency at the database layer, not just Inngest.** Before building a tx, `step.run('check-already-anchored', ...)` does `SELECT txHash FROM policyVersionAnchors WHERE versionId = ?`. If present, return — this short-circuit is cheap and survives any retry / redeploy.
2. **Insert the anchor row BEFORE submission with a pending status.** Pattern:
   - `step.run('claim-anchor-slot')`: INSERT `(versionId, status: 'pending', attemptId: uuidv4())` with `ON CONFLICT (versionId) DO NOTHING RETURNING *`. If nothing returned, another run already owns the slot — exit.
   - `step.run('build-and-submit')`: builds tx, submits, returns txHash.
   - `step.run('finalize')`: UPDATE WHERE versionId AND attemptId = my-attempt SET status='submitted', txHash=?.
3. **Use a single wallet key per service instance** so that concurrent txs from the same wallet serialize on UTXO selection. Configure `concurrency: { key: 'event.data.walletId', limit: 1 }` on the anchoring Inngest fn — only one anchor at a time globally.
4. **Anchor ONCE per entity, not multiply.** Decision: per `versionId`, unique; per `milestoneId`, unique; the milestone hash may reference multiple versionIds but the *anchor* is one transaction per milestone. Add `UNIQUE(versionId)` and `UNIQUE(milestoneId)` constraints at the Postgres level — the DB enforces "exactly one anchor" even if application code is buggy.
5. **Do not retry `submit-tx` beyond the first failure.** Wrap in `NonRetriableError` on any response other than network error. Specifically: `BadInputsUTxO` is non-retriable (means state diverged), `ScriptFailure` is non-retriable, only `ECONNRESET` and 5xx from Blockfrost are retriable. File: `src/inngest/functions/anchor-version.ts`.
6. **Store the signed tx body before submission.** If Blockfrost returns ambiguously, the operator can decide whether to re-submit the exact bytes (safe) or rebuild (unsafe).
7. **Per-milestone vs per-version decision:** The roadmap says both. Resolve: per-milestone is the "summary anchor" linking version anchors. Per-version is canonical. Tests must assert exactly one tx per version and one per milestone.

**Confidence:** HIGH on Cardano mechanics (UTXO, serialization of wallet submissions). MEDIUM on Mesh SDK behavior — Phase 23 planner must verify Mesh's tx-builder behavior on re-build.

---

### Pitfall 6: Cardano wallet seed leakage from Vercel env var

**Category:** Cardano
**Phase:** 23

**What goes wrong:**
Preview-net wallet mnemonic (24 words) is stored in `CARDANO_WALLET_MNEMONIC` env var on Vercel. Even though preview ADA is worthless, the same habits carry forward to mainnet. Ways this leaks:
- Accidentally logged via `console.log(process.env)` in a debugging session
- Included in Sentry error context on unhandled exceptions
- Leaked to LLM tools when a dev copies env vars for pair-debugging
- Exfiltrated via a compromised npm package (install-time script reading env)
- Visible in Vercel Dashboard to anyone with team access — no scoping
- Leaked to the client bundle if someone accidentally renames it with `NEXT_PUBLIC_` prefix
- Rotated from preview → mainnet without the team noticing and the old mnemonic is still valid on the live chain if it becomes a mainnet wallet

**Warning signs in production:**
- Mnemonic string appearing in Vercel deployment logs (any occurrence)
- Sentry event payload containing 24 consecutive lowercase words
- The wallet showing txs not originated from our anchoring fn

**Prevention strategy (preview-net now, mainnet-ready posture):**

1. **Never read the mnemonic in user-code.** Encapsulate in `src/server/lib/cardano/signer.ts` — one module, one function `signTx(cbor)`, the env var is read inside and never exported. Other code imports `signTx`, not the mnemonic.
2. **Derive a signing key, not from mnemonic directly.** Store the **encrypted extended signing key** (not mnemonic) in env. The mnemonic stays offline. Use mesh `deriveExtendedSkey(mnemonic, path)` once, encrypt with a KMS key, store ciphertext in env.
3. **Allowlist env reads via an allowlist module.** Use `requireEnv()` pattern from `src/lib/r2.ts`. Refuse to read anything not in the allowlist. Static lint rule: no `process.env.CARDANO_*` outside `src/server/lib/cardano/`.
4. **Log-scrubbing middleware.** Sentry `beforeSend` hook redacts any string matching a 24-word mnemonic pattern (`^(\w+\s){23}\w+$`). Also redacts any value in a known-sensitive env allowlist. File: `src/lib/sentry-scrub.ts`.
5. **Separate preview and mainnet env var names.** `CARDANO_PREVIEW_SIGNING_KEY` and `CARDANO_MAINNET_SIGNING_KEY` — never rename one into the other. The **network flag** is derived from which env var is set, not from a `NETWORK=mainnet` string that can be toggled.
6. **Refuse to start if network flag and key don't match.** In `signer.ts` init, if `BLOCKFROST_PROJECT_ID` starts with `mainnet` but the wallet is a preview key, throw at import time. Mirrors r2.ts fail-fast pattern.
7. **Commit a pre-commit hook scanning for mnemonic-shaped strings.** `trufflehog` or a simple regex hook. If anyone pastes a mnemonic into a markdown file (planning docs, comments, commit messages), the commit fails.
8. **Per-developer preview wallets.** Each dev running locally uses their own preview wallet, funded by the preview faucet. The production preview wallet is only in Vercel prod env. Prevents "dev accidentally ran mainnet key locally."
9. **Write the mainnet threat model document now, not later.** `.planning/research/CARDANO-THREAT-MODEL.md` — even a one-pager. Muscle memory.

**Confidence:** HIGH. Standard crypto-operational hygiene.

---

### Pitfall 7: Clerk phone vs email invitation mismatch — v0.1 used phone-only auth

**Category:** Intake & Register
**Phase:** 19, 20

**What goes wrong:**
v0.1 auth is phone-only — `phoneNumbers[0]` is the canonical identity. The webhook at `app/api/webhooks/clerk/route.ts:60` reads `phone_numbers?.[0]?.phone_number ?? null` and the DB `users` table has `phone` and `email` columns, with phone populated. For v0.2, `/participate` and cal.com webhooks collect **email** addresses (neither has a phone step). We cannot call `clerk.users.createUser({ phoneNumber })` because we don't have the phone. We must switch to **invitations**, which are email-based in Clerk.

Specific failure modes:
- Invitation created for `jane@example.com` but Clerk instance config is "phone as required identifier" → invitation sign-up flow prompts for phone, which the stakeholder doesn't want to give, → drop-off
- User accepts invite, enters phone, Clerk creates user with **both** phone and email — webhook fires with `phone_numbers: [...], email_addresses: [...]` — our existing upsert logic only stores `phone_numbers[0]`, silently drops email as the conflict target — orphaned email
- User already exists with same email from another path → Clerk invitation fails — we need to handle gracefully
- `users.clerkId` is the upsert target currently; a user who starts with participate-email and later adds phone gets a *different* Clerk user record if we aren't matching on email first

**Warning signs in production:**
- `users` rows with `phone = null, email = null` (both dropped)
- Invitation-created users unable to complete signup (Clerk log: "phone required")
- Duplicate user rows — one from participate (email), one from prior admin invite (phone)
- Webhook failing with unique-constraint violation on `clerkId` because two user.created fire

**Prevention strategy:**

1. **Configure Clerk instance to accept email OR phone as identifier, not require both.** Clerk Dashboard → User & Authentication → Email addresses: enabled, required. Phone numbers: enabled, not required. Document this in `.planning/phases/19-public-participate/CLERK-SETUP.md` as a prerequisite; the phase verification should check the Clerk instance settings.
2. **Update the webhook handler to prefer email as identifier when both are present.** Current code at `app/api/webhooks/clerk/route.ts:60` stores whichever comes first. Change to: if event originated from invitation path (check `public_metadata.source === 'participate'` — set when we create the invitation), store email as canonical; phone may be added later via profile.
3. **DB schema: allow both phone and email nullable but require at-least-one.** Add check constraint `phone IS NOT NULL OR email IS NOT NULL`. Add partial unique index `UNIQUE(email) WHERE email IS NOT NULL` and `UNIQUE(phone) WHERE phone IS NOT NULL`.
4. **Match by email first, fall back to phone, fall back to clerkId.** `findOrCreateUser(clerkId, email, phone)` in `src/server/lib/users.ts` — stable identity across auth method changes.
5. **Do NOT use `clerk.users.createUser` for public on-ramp.** That flow skips verification. Always use `clerkClient.invitations.createInvitation({ emailAddress, publicMetadata: { role: 'stakeholder', source: 'participate' } })` — Clerk handles the verify email → complete profile flow and fires `user.created` when done.
6. **Regarding phone-invitations: as of April 2026, Clerk does NOT support phone-based invitations in the invitations API** — it is email-only. The `createInvitation` API requires `emailAddress`. There is no `phoneNumber` parameter. This is a Clerk API limitation, not a config issue. If v0.2 wants SMS-based invite, that is a separate flow using `clerk.phoneNumbers.createPhoneNumber()` + manual OTP — much more work, out of scope.
   **Verification before Phase 19 coding starts:** Phase 19 planner must WebFetch https://clerk.com/docs/reference/backend-api/tag/Invitations and confirm the current signature. If Clerk has added phone invitations since this research, update the plan.
7. **Result: v0.2 auth is hybrid.** Existing phone-only users continue working (v0.1 path). New public users come in via email invitation (v0.2 path). The `users` table and RBAC are indifferent — role is in `public_metadata` and propagates via existing webhook.

**Confidence:** HIGH on mechanism (Clerk invitations API is email-only in SDK v7 as installed). MEDIUM on the exact webhook event payload when invitation is accepted — Phase 19 planner should smoke-test against a dev Clerk instance before merging.

---

### Pitfall 8: Evidence pack memory blowup on Vercel function (correction on memory limits)

**Category:** Inngest Migration
**Phase:** 18

**What goes wrong:**
Async evidence pack export ZIP bundles: stakeholder list, feedback matrix CSV, version history PDF, workshop evidence (recordings, artifacts). Twenty workshop recordings at 500MB each is 10GB. Loading all into memory with `fflate.zipSync(fileMap)` OOMs the function regardless of whether the limit is 250MB (Vercel's older hobby functions) or 1024MB (fluid compute default) or 3008MB (max Pro).

Even without binary inclusion, a 50k-row feedback matrix CSV built as one string in memory can hit 50-200MB. `fflate.strToU8` of that allocates double.

**Warning signs in production:**
- Inngest fn fails with `FUNCTION_INVOCATION_TIMEOUT` or OOM killed
- `step.run` timeout exceeded (Inngest default step timeout)
- Vercel Fluid Compute cost spike without corresponding invocation count spike (long-running functions billed per-GB-ms)
- Generated ZIPs showing corruption / truncation at a predictable byte offset

**Prevention strategy:**

1. **Stream zip, don't build in memory.** `fflate` **does** support streaming via `Zip` class (not `zipSync`):
   ```ts
   const zip = new Zip()
   zip.ondata = (err, chunk, final) => { /* pipe to R2 multipart upload */ }
   const f1 = new ZipPassThrough('file1.mp4')
   zip.add(f1)
   // stream bytes into f1.push(chunk, final)
   zip.end()
   ```
   Each chunk goes directly to R2's multipart upload API — never buffered. File: `src/server/lib/evidence-pack/stream-zip.ts`.
2. **R2 multipart upload is the destination, not a local file or Vercel /tmp.** Use `@aws-sdk/client-s3` `CreateMultipartUpload → UploadPart (5MB min parts) → CompleteMultipartUpload`. The pack never touches function memory; the function just proxies bytes.
3. **Recordings are streamed by presigned URL reference, not re-downloaded and re-zipped.** Alternative: the pack ZIP contains a `recordings.json` manifest with presigned GET URLs valid for 7 days — the user downloads recordings separately. This sidesteps streaming complexity entirely. Decision point for Phase 18 planner.
4. **Hard cap on ZIP size.** Refuse packs > 5GB via pre-computation — sum sizes of all referenced R2 objects, refuse and ask the admin to narrow the selection.
5. **Chunked CSV generation.** Feedback matrix written row-by-row to a `ZipPassThrough` entry. Do not `rows.map(...).join('\n')`.
6. **Vercel function config:** set `maxDuration: 300` (5 min) and `memory: 3008` on the Inngest route handler for the evidence pack fn specifically. Do NOT apply to all Inngest functions — it's expensive.
7. **Email delivery of presigned GET URL, not attachment.** Current Resend integration already supports this pattern. Never attach the ZIP to the email.

**Correction on memory limit:** Vercel Fluid Compute (Next.js 16 default) provides up to 3008MB per function on Pro plan. The "250MB" from the question is the **bundle-size** limit, not the runtime memory limit. Regardless — streaming is the right pattern because:
- OOM is a step function failure mode; better to stream than to rely on raising limits
- Runtime memory billed per GB-ms — keeping memory low is cheaper
- Mitigates the attack vector from Pitfall 3 (adversarial huge recording)

**Confidence:** HIGH on streaming being the correct pattern. HIGH on fflate supporting streaming (`Zip` class is the documented stream API; `zipSync` is for in-memory-only use). HIGH on Vercel memory limits (fluid compute = 3008MB Pro).

---

### Pitfall 9: Inngest event name collisions and retry storms across domains

**Category:** Inngest Migration
**Phase:** 16, 17, 18, 19, 20, 23

**What goes wrong:**
v0.2 adds many new events. With flat namespaces like `notification.create`, `workshop.registered`, `workshop.completed`, `feedback.reviewed`, `milestone.ready`, `version.published`, `evidencePack.requested`, `participate.submitted`, two classes of problem arise:

**Class A — collision / fanout:**
- A single event is consumed by multiple functions (intentional fanout). If one of them starts `emit`ing the same event type (accidentally or for retry), infinite loop. Example: `feedback.reviewed` fanout — notification fn + email fn + auto-CR fn. If auto-CR fn emits `feedback.reviewed` on draft creation, notification fn fires again, double notification, potential loop.
- Event name typos: `workshop.completed` vs `workshop.complete` — fn silently never fires, no compile error
- Forgetting that `notification.create` is both a command and an audit event — consumers expecting the former treat it as the latter

**Class B — retry storm:**
- An Inngest fn throws on a non-idempotent external call (e.g., Clerk invitation already exists) → Inngest retries → every retry creates another "already exists" → eventually succeeds or gives up
- Event with `concurrency: unlimited` consuming a burst of 100 events each fanning out to 3 fns = 300 concurrent Groq calls → rate limit → all retry → rate limit → storm

**Warning signs in production:**
- Inngest dashboard "events received" spike not matched by "unique events"
- Multiple notification rows for the same (userId, entityId) within seconds
- `clerk.invitations.createInvitation` returning 409 repeatedly in Inngest logs
- Groq API returning 429 rate-limit errors in Inngest step logs

**Prevention strategy:**

1. **Namespace convention — dot-separated, domain-first, verb-past-tense.**
   - `{domain}.{entity}.{past-tense-verb}`
   - Examples: `policy.version.published`, `policy.feedback.reviewed`, `workshop.registration.received`, `workshop.recording.uploaded`, `public.participate.submitted`, `cardano.milestone.anchored`, `notification.create` (command, not event — exception).
   - Document in `src/inngest/events.ts` as a single source of truth. All event names are exported constants, never string literals at callsites.
2. **Typed events module.** `src/inngest/events.ts` exports `feedbackReviewedEvent`, `versionPublishedEvent`, etc. with Zod schemas. The existing `feedback-reviewed.ts` already imports `feedbackReviewedEvent` as a constant — maintain that pattern.
3. **No event fanout causing the same event type.** Rule: an Inngest fn triggered by `X.y.z` must NEVER emit `X.y.z`. Enforce via an ESLint rule or a static grep in CI.
4. **Idempotency keys on every command event.** `notification.create` event must carry `idempotencyKey = hash(userId + entityId + type)`. The fn's first step is `step.run('check-idempotent', ...)` that short-circuits if the key is already in `idempotency_log`.
5. **Concurrency limits per domain.**
   - Groq calls: `concurrency: { key: 'groq', limit: 5 }`
   - Clerk calls: `concurrency: { key: 'clerk', limit: 10 }`
   - Cardano anchoring: `concurrency: { key: 'cardano-wallet', limit: 1 }` (from Pitfall 5)
   - Email: `concurrency: { key: 'resend', limit: 10 }`
6. **`NonRetriableError` on non-idempotent 4xx.** Existing `feedback-reviewed.ts:57` uses this pattern — extend across all new fns. `Clerk 409 (already exists)` → `NonRetriableError`. `Cal.com webhook invalid` → `NonRetriableError`. `Blockfrost BadInputsUTxO` → `NonRetriableError`.
7. **Migration of `createNotification(...).catch(...)` to `notification.create` event.** (Active roadmap item.) Before rolling out, add a *transition* table: during the migration window, both the direct call and the event fire; compare counts; cut over once zero drift. Risk: double-notifications during the window — mitigate by having the event-driven path skip insert if idempotency key exists.
8. **Fn retry count explicit.** Inngest default is 3. For external-API fns (Groq, Clerk, Cal.com) use 3. For Cardano anchoring use 1 (see Pitfall 5). For DB-only fns use 5.

**Confidence:** HIGH on naming / concurrency / idempotency patterns being correct. This is how the existing `feedback-reviewed.ts` already works; v0.2 extends it.

---

### Pitfall 10: Removing Yjs breaks editor render because of stale `providerRef.current` reads

**Category:** Removal Surgery
**Phase:** 14

**What goes wrong:**
v0.1 Phase 11 wired Yjs + Hocuspocus + Collaboration + CollaborationCursor Tiptap extensions. Four files reference collab: `block-editor.tsx`, `build-extensions.ts`, `presence-bar.tsx`, `use-presence.ts`, plus the collab test. The subtle bug pattern from v0.1:
- `providerRef.current` is read at render time (`blocks={providerRef.current?.doc.getArray(...)}`)
- The async provider init effect runs after first render
- On first render, `providerRef.current` is `null`, component falls through to an error path
- TypeScript is happy — `providerRef.current` is typed as `HocuspocusProvider | null`, the optional chain is valid
- Runtime: extension list fails, editor boots with no collab extension but with references to a non-existent doc

The v0.2 removal surgery risk: if we delete the Collaboration extension from `build-extensions.ts` but leave the `providerRef` plumbing in `block-editor.tsx` — even as a dead reference — the editor may still try to call `provider.destroy()` on unmount, or pass `doc={providerRef.current?.doc}` to a component that now expects `doc={undefined}` and crashes.

**Warning signs in production:**
- Editor page renders blank or with error boundary
- Console: `Cannot read properties of null (reading 'destroy')`
- Console: `provider is not defined`
- Tiptap error: `Extension Collaboration requires a doc`
- TypeScript builds pass but runtime fails (this is the gnarly part)

**Prevention strategy:**

1. **Inventory first.** Before deleting anything, grep the 5 known files (already enumerated: `block-editor.tsx`, `build-extensions.ts`, `presence-bar.tsx`, `use-presence.ts`, `build-extensions-collab.test.ts`) and produce an exhaustive list of every `providerRef`, `Hocuspocus`, `Yjs`, `Y.Doc`, `Collaboration`, `CollaborationCursor`, `awareness`, `PresenceBar` reference. One file per reference, line numbers. Add to the Phase 14 plan as the deletion manifest.
2. **Delete in dependency order, bottom-up.**
   - First: `presence-bar.tsx` and `use-presence.ts` — pure consumers, safe to delete
   - Second: collab extensions in `build-extensions.ts` — remove imports and array entries
   - Third: `block-editor.tsx` — remove `providerRef`, `useEffect` provider init, `PresenceBar` JSX, `awareness` props, `doc` props
   - Fourth: `build-extensions-collab.test.ts` — delete test file
   - Fifth: `package.json` — remove yjs, @hocuspocus/provider, y-websocket, @tiptap/extension-collaboration, @tiptap/extension-collaboration-cursor
3. **After each step, run `bun run build` AND start dev server and load the editor page.** Typecheck pass is insufficient (v0.1 bug proves this) — render test is mandatory. Document which renders pass in the PR description.
4. **Auto-save replaces collab persistence.** Before removing, confirm `block-editor.tsx` has a `useDebouncedCallback(saveBlocks, 1500)` or equivalent — the current collab path persists via provider; without collab, we need explicit save. If not present, it's a Phase 14 task.
5. **Re-initialize Tiptap with a plain StarterKit — no CollaborationKit.** Editor instance should take the initial content from tRPC, use `onUpdate` → `debouncedSave`, and NOT pass `doc` or `provider` props.
6. **Schema cleanup.** `inline_comments` table and related enums — drop in a migration after code is gone. Include rollback SQL. File: `src/db/migrations/XXX-remove-collab.sql`.
7. **Visual regression test on editor page.** Playwright test: load `/policies/[id]` in edit mode, assert `.tiptap-editor` rendered and not an error boundary. Prevents silent renderer failures.
8. **Inline comments feature is NOT moved to "later" — it's fully removed.** v0.2 does not support them. Any navigation entry, route, or badge referring to comments must be deleted. The Phase 14 plan explicitly includes comment_threads and comment_items schema drop.

**Confidence:** HIGH. The v0.1 pattern is documented in audit; removal mechanics are standard.

---

### Pitfall 11: Next.js 16 public pages accidentally caching stale workshop list

**Category:** Next.js 16 Caching
**Phase:** 19, 20, 21

**What goes wrong:**
Public pages `/participate`, `/workshops`, `/research`, `/framework` must show fresh data (workshop list changes when admin creates a new workshop; `/framework` section status changes on feedback decision). In Next.js 16:

**Confirmed from** `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` **and** `.../03-file-conventions/02-route-segment-config/index.md`:

- When `cacheComponents: true` in `next.config.ts`, the route segment config options `dynamic`, `dynamicParams`, `revalidate`, and `fetchCache` are **removed**. `export const dynamic = 'force-dynamic'` becomes a no-op or errors.
- `experimental.dynamicIO` is renamed to `cacheComponents`.
- The new model: everything is uncached by default; you opt-in to caching with the `'use cache'` directive + `cacheTag` + `cacheLife` (now stable, no `unstable_` prefix).
- `revalidateTag(tag, cacheLife)` has a new second argument (cacheLife profile).
- `updateTag` is new — use for "user expects instant reflect after action" (form submits) vs `revalidateTag` for "eventual consistency is fine."
- `unstable_noStore` still exists but is less needed because the default is uncached under cacheComponents.

**Current state of this repo** (verified): `next.config.ts` does **not** enable `cacheComponents`. Package version is `next@16.2.1`. Therefore route segment config still works for now, BUT — any phase that enables `cacheComponents: true` (and the docs strongly hint this is the intended direction) breaks all `export const dynamic = 'force-dynamic'` statements across the codebase.

**Warning signs in production:**
- `/workshops` page shows old workshop list for up to 10 minutes after admin creates a new one
- `/framework` section status not updating after feedback decision
- Playwright test passes locally, fails in Vercel preview because local is dev mode (never cached) and preview is prod mode (cached by default)
- Public portal `/portal` shows stale version list after publish

**Prevention strategy:**

1. **Decide Cache Components stance at Phase 19 start.** Either:
   - **(A) Leave `cacheComponents: false`** (v0.1 behavior): public pages use `export const dynamic = 'force-dynamic'` on the route, or `export const revalidate = 0`, or call `(await headers())` to opt out. This is the v0.1 path and works with existing patterns. Mark a tech-debt ticket for Cache Components migration in v0.3.
   - **(B) Enable `cacheComponents: true`** (v0.2 forward-looking): public pages are uncached by default. Any component that fetches from DB is automatically dynamic. Wrap truly static fragments in `'use cache'` with `cacheTag('workshops')`; invalidate via `updateTag('workshops')` in the server action that creates a workshop. This is more work upfront but aligns with Next.js 16 direction.
2. **Recommendation: go with (B) at Phase 19.** Rationale: v0.2 is already a major public-facing pivot, and cacheComponents is the documented future. Doing it later means touching every public route twice.
3. **Tag convention.** Tag names are dot-separated and match Inngest event namespaces where applicable:
   - `workshops.list` — invalidate when workshop created/updated
   - `policy.versions.published` — invalidate when version published
   - `framework.status` — invalidate when feedback decided (section status changes)
   - `research.content` — static, rarely invalidated
4. **Use `updateTag` for admin actions, `revalidateTag` for eventually-consistent updates.** Admin clicks "publish workshop" → server action calls `updateTag('workshops.list')` — user sees fresh list immediately. Stakeholder submits feedback → Inngest fn eventually calls `revalidateTag('framework.status', 'max')` — section badge updates within minutes, not instantly.
5. **Async `params` and `searchParams`.** Next.js 16 requires `await props.params` — the codemod `npx next typegen` fixes existing pages. Phase 14 or 15 should run the codemod before Phase 19 adds new public routes so we're on the async pattern everywhere.
6. **Run `bun run build` after any change to a public page and CHECK output for "`○` (Static)" vs "`ƒ` (Dynamic)" markers.** A route showing `Static` when it should be dynamic is a silent bug.
7. **Playwright tests that assert freshness.** Test: (a) load `/workshops`, capture row count, (b) create workshop via API, (c) reload `/workshops`, assert new row visible. If failing, the cache is stuck.
8. **`(await headers())` and `(await cookies())` are dynamic opt-outs** in Next.js 16 — if you read either, the route becomes dynamic automatically. Useful for escape hatch on routes that check auth (`/portal/draft` must read cookies, stays dynamic naturally).

**Confidence:** HIGH on caching model (verified from installed docs). HIGH on current repo state (next.config.ts read). The decision between (A) and (B) is a plan-level choice that the Phase 19 planner must make before coding — this research flags the choice.

---

### Pitfall 12: Automated state transitions firing out-of-order

**Category:** Inngest Migration
**Phase:** 17, 20, 25

**What goes wrong:**
Webhook events are not ordered. Cal.com may deliver `BOOKING_COMPLETED` before `BOOKING_CREATED` on retry. Inngest delivery is at-least-once, not in-order. The workshop state machine depends on order:
- `registration.received` → creates user + row (state: registered)
- `attendance.marked` (from BOOKING_COMPLETED) → updates row (state: attended)

If `attendance.marked` arrives before `registration.received`, the fn can't find the row, throws, retries, by then the other event arrives, second retry succeeds — but now the order in the audit log is wrong and any metrics are off.

Similarly on workshop lifecycle: `workshop.created` → `workshop.in_progress` (time-based, from Inngest cron) → `workshop.completed` (from BOOKING_COMPLETED or cron fallback) → `workshop.archived` (time-based). A delayed `completed` event arriving after `archived` is a no-op but easy to mishandle.

**Warning signs in production:**
- `workshopRegistrations.status` values jumping backwards in the audit trail
- Registrations marked `attended` before any registration event exists (orphaned attendance)
- Inngest fn retry counts >> event counts
- User-visible registration list showing impossible states (e.g., `attended` before `upcoming`)

**Prevention strategy:**

1. **Monotonic state machine with guards.** Allowed transitions:
   - `null → registered` (from registration)
   - `registered → attended` (from attendance, only if currently registered)
   - `registered → cancelled` (from cancellation, only if currently registered)
   - `attended → ∅` (terminal)
   Reject any transition that is not in this table. Fn returns success without mutation on reject — not error — so Inngest doesn't retry. Store attempted transitions in an audit log even when rejected.
2. **Upsert with `WHERE` clause.** Instead of "select then update", use `UPDATE registrations SET status='attended' WHERE externalId=? AND status='registered'`. If no rows updated, the state is already something else — don't care.
3. **Idempotency on external event ID.** Already covered in Pitfall 2 — the `external_events_seen` table — but here the unique key must be `(provider, externalId, eventType)`, not just `(provider, externalId)`, because BOOKING_CREATED and BOOKING_COMPLETED share a booking UID.
4. **Handle "event arrives for entity that doesn't exist yet".** `attendance.marked` fires for a registration that hasn't been inserted → the fn emits `workshop.registration.deferred` and schedules a retry in 30s. After 3 retries with no row, log an error and move on. Do NOT throw — Inngest retry will storm.
5. **Cron reconciliation fallback.** Daily Inngest cron `workshop.reconcile.daily` walks all `in_progress` workshops > 24h old and forcibly transitions to `completed`. Catches missed BOOKING_COMPLETED webhooks. Same for `archived` after 7d.
6. **Event timestamps in payload, not wall clock.** Every Inngest event carries `occurredAt: ISO8601` from the source system (Cal.com's `triggeredAt`, DB's `created_at`). Comparisons use that, not `Date.now()`.

**Confidence:** HIGH on pattern. Standard distributed-systems state machine.

---

## Technical Debt Patterns

Shortcuts that v0.2 planners will be tempted by, and when they are acceptable.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip Turnstile server-verify on `/participate` and rely on client-only widget | One less API call per submit | Bot farm DOS on Clerk billing | **Never.** Client widget is trivially spoofed. |
| Call `clerkClient.invitations.createInvitation` directly in the route handler instead of via Inngest | Simpler error handling (no event hop) | Route handler times out under burst; no durable retry; no concurrency key | Only acceptable if Phase 19 also adds an upstream `@vercel/kv` rate limit of < 10/min. Otherwise use Inngest. |
| Store Cardano mnemonic in Vercel env var (not encrypted extended signing key) | One less crypto step | Leak risk, no rotation story, carries bad habit to mainnet | Only acceptable for preview-net if accompanied by log-scrubbing middleware and a documented rotation plan. Not for mainnet, ever. |
| Auto-publish LLM consultation summary without human review | No review modal work | Reputational, possibly legal risk from hallucinated stakeholder attribution | **Never.** Human-in-loop is non-negotiable for v0.2. |
| Skip idempotency check on Cardano anchor step, trust Inngest `step.run` memoization | Simpler step code | Double-anchor on redeploy; wasted ADA; anchor row inconsistency | **Never.** DB-level idempotency is cheap. |
| Leave Cache Components disabled (`cacheComponents: false`) in v0.2 and use v15-style `dynamic = 'force-dynamic'` on public pages | Matches existing patterns, faster to ship | Migration deferred to v0.3; public pages have no cache story; every request is dynamic (expensive) | Acceptable if Phase 19 docs the tech-debt ticket and v0.3 plan includes migration. |
| Use `zipSync` from fflate for evidence pack (in-memory) instead of streaming `Zip` | 50 lines less code | OOM on > 200MB pack; not scalable | Acceptable ONLY if pack content is capped to metadata + small CSVs (< 50MB); must reject pack creation if any recording > 10MB. |
| Reuse existing `createNotification` direct call instead of migrating to `notification.create` Inngest event | No migration work | Fire-and-forget `.catch()` silent failures; no retry | Acceptable during transition window only; Phase 16 task is explicit migration. |
| Hardcode Cal.com webhook URL in Cal.com dashboard without rotatable secret | Faster setup | Can't rotate compromised secret without downtime | **Never.** Secret must be in env var, dashboard references env-driven hook URL. |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Clerk invitations | Calling `createUser` instead of `createInvitation` for public on-ramp (skips email verify) | `clerkClient.invitations.createInvitation({ emailAddress, publicMetadata: { role, source } })` |
| Clerk webhook | Parsing body before Svix verify | Current `app/api/webhooks/clerk/route.ts:38` is correct — `req.text()` first, verify, then parse. Copy pattern for cal webhook. |
| Cal.com webhook | Using `req.json()` before HMAC verify | Always `req.text()` first. HMAC over raw body bytes. |
| Cal.com retries | Returning 500 on transient error causes retry storm | Return 200 + log; let Inngest handle retry with proper backoff |
| Groq API | No `max_tokens` on chat completion | Always pass `max_tokens`. Wrap SDK in `src/lib/groq.ts`. |
| Groq Whisper | Submitting un-probed audio | Probe duration + size first; reject > 3h or > 500MB |
| Blockfrost | Assuming idempotent tx submit | Build fresh tx each retry, check DB first |
| Mesh SDK | Building tx against stale UTXO set after `concurrency > 1` | Set Inngest `concurrency: { key: 'cardano-wallet', limit: 1 }` |
| Inngest | Emitting same event the fn consumes → loop | ESLint or grep rule: fn fires a different event than it consumes |
| R2 multipart | Forgetting to call `CompleteMultipartUpload` on error path | `try { upload; complete } catch { abort }` |
| fflate | `zipSync` on large fileset | `Zip` + `ZipPassThrough` streaming API |
| Next.js 16 | `export const dynamic = 'force-dynamic'` under cacheComponents | Use `'use cache'` directive or don't opt-out; read `await headers()` to become dynamic |
| Turnstile | Only client-side widget without `siteverify` | Server `/siteverify` call before Clerk invite |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Evidence pack in-memory zip | OOM, 500 on download | Stream via fflate `Zip` class → R2 multipart | Pack > 200MB (roughly 1 workshop recording) |
| LLM consultation summary without token cap | Groq cost spike | `max_tokens` + input truncation | Any policy with > 50 feedback items |
| Groq Whisper on unrestricted recordings | Bill blowup | Duration probe + size cap + per-org budget | First adversarial upload |
| Cal.com webhook inline Clerk call | 10s timeout → cal retries → duplicates | Webhook emits Inngest event; fn does Clerk | > 5 concurrent registrations |
| Inngest fn with unlimited concurrency | External API rate limit → storm | Per-service `concurrency.key` | > 100 events in < 1 min |
| Per-request fetch in server components without `'use cache'` | N+1 DB queries on public page render | `'use cache'` + `cacheTag` or batch in loader | > 10k page views/day |
| Public portal rendering all versions of all policies | First load > 3s | Pagination + cacheLife('days') | > 50 published versions |
| `users.lastActivityAt` updated on every tRPC mutation synchronously | Write amplification on every mutation | Batch via Inngest event, update in background | > 100 concurrent users |
| Clerk webhook upsert without unique index on email | Duplicate user rows | `UNIQUE(email) WHERE email IS NOT NULL` partial index | First invitation-based user |
| Cardano anchor fn without DB idempotency | Double-spend on redeploy | `UNIQUE(versionId)` on anchor table | First redeploy during an anchor run |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Public form without server Turnstile verify | Bot DOS on Clerk billing | Layered: Turnstile + IP rate limit + email blocklist + daily cap |
| Cal.com webhook without HMAC verify | Forged registrations inflate MAU | HMAC-SHA256 over raw body; timestamp binding |
| Cal.com webhook without replay protection | Captured legit webhook re-run | Reject if `triggeredAt` > 5 min old |
| Clerk invitation endpoint uncapped | Billing DOS | Upstream rate limit; idempotency by email |
| Groq call without `max_tokens` | Cost exhaustion | Typed client wrapper rejects missing cap |
| Cardano mnemonic in env var (plain) | Credential leak | Encrypted extended signing key + env-scoped access + log scrubbing |
| Log LLM output to Sentry as error context | PII leak from transcript | Groq outputs live in DB only, never logged |
| Public portal renders unreviewed LLM summary | Defamation risk | Status machine: pending → draft → approved; only approved is public |
| Evidence pack URL in email without expiry | Anyone with email access can download indefinitely | Presigned GET URL, 7-day max, single-use token |
| Webhook endpoint accepting requests without origin check | Forged events | IP allowlist middleware + HMAC (defense in depth) |
| `public_metadata.role` writable from client | Privilege escalation | Role is set server-side in invitation creation, never trusted from webhook payload |
| Blockfrost project ID exposed in client bundle | API quota theft | Env var without `NEXT_PUBLIC_` prefix; Cardano calls server-side only |
| Consultation summary reveals anonymous stakeholder identity | Privacy violation | Summary prompt explicitly forbids naming stakeholders unless `privacy.publicAttribution === true` |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| `/participate` form silently rejects bots with 200 OK | Legitimate user sees success on error | Distinguish: Turnstile fail → silent retry prompt; rate limit → explicit 429 + friendly message |
| Workshop registration success without clear "check your email" UX | User confused when invitation email arrives 2 min later | Confirmation screen lists email address + "we sent an invite to jane@example.com" |
| LLM summary generating slowly on publish blocks the admin UI | Admin thinks publish broke | Async: publish returns immediately, summary generation is Inngest fn, badge shows "summary generating…" → "ready for review" |
| Cardano anchor failure silent until next publish | Admin doesn't know verification is broken | In-app notification + admin dashboard widget showing last anchor status per wallet |
| Public portal renders "Verified on Cardano" badge for versions that failed anchor | False verification claim | Badge only renders when `txHash IS NOT NULL AND status = 'confirmed'` |
| Workshop attendance auto-populated but moderator can't override | Edge cases (someone attended in person) unfixable | Always allow manual override of automated status, preserving audit trail |
| Evidence pack email without fallback if inbox rejects | User never gets pack, no UI to retry | In-app "download pack" button as backup; email is convenience |
| Removing inline comments with no migration of existing threads | Users who left comments on v0.1 lose their work | Pre-Phase 14: export existing threads to CSV as a one-time archive; document in `.planning/v0.1-ARCHIVE.md` |
| Per-section draft status not visible on `/framework` | Stakeholders don't know what's locked | Badge per section: Draft / Under Review / Validated, with last-updated timestamp |

## "Looks Done But Isn't" Checklist

- [ ] **`/participate` form:** Often missing server-side Turnstile verify — grep route handler for `siteverify`
- [ ] **`/participate` form:** Often missing rate limit — grep for `@upstash/ratelimit` or `@vercel/kv` import
- [ ] **Cal.com webhook:** Often missing timestamp replay check — grep for `triggeredAt` comparison against `Date.now()`
- [ ] **Cal.com webhook:** Often missing raw-body-first parse — check that `req.text()` precedes `JSON.parse`
- [ ] **Cal.com webhook:** Often missing idempotency on bookingUid — verify unique index exists
- [ ] **Groq calls:** Often missing `max_tokens` — grep `groq.chat.completions.create` for argument shape
- [ ] **Groq Whisper:** Often missing duration probe — grep for `music-metadata` or equivalent before transcribe step
- [ ] **LLM consultation summary:** Often auto-published — grep for `status: 'approved'` on default insert; should be `'pending'`
- [ ] **LLM output validation:** Often missing NER / regex guardrail — grep `validate-summary` step existence
- [ ] **Cardano anchor:** Often missing DB idempotency — verify `UNIQUE(versionId)` and `UNIQUE(milestoneId)` constraints
- [ ] **Cardano anchor:** Often missing `concurrency.key` on Inngest fn — check fn config
- [ ] **Cardano wallet:** Often reading mnemonic outside signer module — grep `process.env.CARDANO_` outside `src/server/lib/cardano/`
- [ ] **Clerk invitation:** Often called synchronously in route handler — verify indirection via Inngest event
- [ ] **Clerk webhook email prefer:** Often stores phone instead of email for invited users — verify `app/api/webhooks/clerk/route.ts` handles `source: 'participate'` case
- [ ] **Evidence pack:** Often uses `zipSync` — grep for `zipSync` import, replace with `Zip`
- [ ] **Inngest events:** Often lack typed constants — grep `send({ name: '` for string literals vs imports
- [ ] **Inngest fns:** Often missing `NonRetriableError` on 4xx — grep `throw new Error` inside `step.run`
- [ ] **Yjs removal:** Often leaves `providerRef` dead references — grep `providerRef|HocuspocusProvider|awareness` after removal
- [ ] **Next.js 16 pages:** Often use stale `dynamic` export — grep `export const dynamic` under `cacheComponents: true`
- [ ] **Public pages:** Often miss `await params` — grep `props.params.` without `await`
- [ ] **Public portal verified badge:** Often renders without confirming tx — check badge condition is `txHash IS NOT NULL`
- [ ] **`users.lastActivityAt`:** Often blocks request — check it's via Inngest event, not sync update
- [ ] **Collab removal:** Often leaves `inline_comments` table — check migration drops schema

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Clerk invitation billing DOS | MEDIUM | Delete abusive pending invitations via Clerk API; rate-limit post-hoc; email Clerk support for billing dispute on fraud |
| Forged Cal.com webhook registered users | MEDIUM | Identify rows by IP / timestamp cluster; delete both DB rows and Clerk invitations; rotate webhook secret |
| Groq runaway bill | LOW | Reduce budget cap; refund from Groq support (usually granted on first occurrence); patch `max_tokens` |
| Published LLM hallucination | HIGH | Immediate `updateTag('portal')` with patched summary; issue correction on portal; notify affected stakeholder; if public, PR statement |
| Cardano double-anchor | MEDIUM | Mark older txHash as `superseded`; keep newer as canonical; no on-chain cleanup possible (tx is permanent); update DB unique constraint |
| Cardano mnemonic leak | HIGH | Rotate wallet immediately (create new, sweep funds); rotate env var; audit logs for leak vector; if mainnet, lose the funds in the old wallet |
| Clerk phone/email conflict | LOW | Manual SQL cleanup of duplicate user rows; merge clerkIds; run reconciliation script |
| Evidence pack OOM | LOW | Switch to streaming zip; retry pack generation; user re-requests |
| Inngest retry storm | MEDIUM | Pause affected Inngest fn in dashboard; deploy `NonRetriableError` fix; clear stuck events; resume |
| Yjs removal breaks editor | LOW (if caught pre-merge) / HIGH (post-merge) | Revert Phase 14 commit; re-do removal with render tests |
| Next.js 16 caching stale data | LOW | `updateTag` invalidation from admin UI; add test; verify cacheComponents config |
| State machine out-of-order | LOW | Cron reconciliation fn forces correct state; manual SQL for edge cases |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1: Clerk invitation DOS | 19 | Load test: 100 submits from 1 IP returns 429 after 5; Turnstile fail rejected silently; daily cap enforced |
| 2: Cal.com webhook forgery | 20 | Unit test: signed webhook accepted, unsigned rejected, replay > 5 min rejected, duplicate bookingUid is no-op |
| 3: Groq cost blowup | 18 | Unit test: upload 10h fake file rejected; `max_tokens` required by type; per-org budget blocks |
| 4: LLM hallucination on portal | 21 | Manual review gate: fresh version shows `status=pending`, not auto-approved; admin approval required; guardrail regex flags quotes |
| 5: Cardano double-anchor | 22, 23 | Unit test: second call to anchor fn for same versionId is no-op; `UNIQUE(versionId)` constraint exists; `concurrency.key` set |
| 6: Cardano mnemonic leak | 23 | Lint: no `process.env.CARDANO_` outside signer module; Sentry scrub test; env separation mainnet vs preview |
| 7: Clerk phone/email mismatch | 19 | Integration test: invite email → accept → `users.email` populated; no duplicate rows; webhook upsert key correct |
| 8: Evidence pack OOM | 18 | Unit test: 1GB fake file streams without OOM; multipart upload completes; final ZIP > 500MB generated successfully |
| 9: Inngest collisions / storms | 16, 17, 18, 20, 23 | Typed events module in place; grep no string literal event names; concurrency keys set; `NonRetriableError` on 4xx |
| 10: Yjs removal breaks editor | 14 | Playwright test loads editor page, asserts no error boundary; grep shows no `providerRef` / `Hocuspocus` references after removal |
| 11: Next.js 16 cache staleness | 19, 20, 21 | Playwright: create workshop via API, reload `/workshops`, new row visible within 5s; `updateTag` call in admin action |
| 12: State machine out-of-order | 17, 20, 25 | Unit test: `attended` arriving before `registered` retries then resolves; reconciliation cron test |

## Open Questions for Phase Planners

Things the phase planners must resolve before coding:

1. **Phase 19 — Cache Components decision.** Enable `cacheComponents: true` now (forward-looking) or defer to v0.3 (matches v0.1 patterns)? Research recommendation: enable now. Phase 14 is the right time to run the `npx next typegen` codemod first.
2. **Phase 19 — Rate limit implementation.** Upstash Redis or Vercel KV or Postgres-backed? Upstash has better rate-limit primitives; Postgres is "one less dependency".
3. **Phase 20 — Cal.com signature header name.** Must verify against https://cal.com/docs/core-features/webhooks current docs before coding. Header name has changed in the past.
4. **Phase 21 — LLM consultation summary approver role.** Only admin? Policy lead? Any authorized reviewer? Needs product decision.
5. **Phase 23 — Per-version OR per-milestone anchoring?** Research recommendation: both, with unique constraints; but the operator needs to confirm that doubling ADA cost is acceptable (preview-net is free).
6. **Phase 23 — Mesh SDK version and compatibility.** `@meshsdk/core` is not yet in `package.json`. Phase 23 planner must Context7-resolve current version + API.
7. **Phase 18 — Evidence pack binary inclusion scope.** Stream recordings into ZIP (complex, large files) OR manifest-only with presigned URLs (simple, decoupled)? Research recommendation: manifest-only for v0.2, upgrade to inline streaming in v0.3.
8. **Phase 16 — `notification.create` migration cutover strategy.** Flag-based dual-write for N days then cutover, or atomic swap? Dual-write is safer but requires a `notifications.source` column.

## Sources

- Installed: `next@16.2.1` — `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` (caching model, `dynamicIO` → `cacheComponents` rename, `cacheLife`/`cacheTag` stabilization, `updateTag` vs `revalidateTag`)
- Installed: `next@16.2.1` — `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/index.md` (`dynamic`, `revalidate`, `fetchCache` removed under cacheComponents)
- Installed: `next@16.2.1` — `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md` (`'use cache'` directive semantics, cache key generation, React.cache isolation)
- Installed: `@clerk/nextjs@^7.0.6`, `svix@^1.89.0`, `inngest@^4.2.1`, `fflate@^0.8.2` (package.json verification)
- Codebase: `src/lib/r2.ts` — fail-fast env var pattern, ContentLength pattern, forcePathStyle + requestChecksumCalculation workaround (4-bug CORS incident documented in comments)
- Codebase: `app/api/webhooks/clerk/route.ts` — Svix verify pattern with `req.text()` first
- Codebase: `src/inngest/functions/feedback-reviewed.ts` — existing `NonRetriableError` + `step.run` + idempotency pattern to extend
- Codebase: `.planning/v0.1-MILESTONE-AUDIT.md` — FeedbackDetailSheet orphaning bug (class of "wired but unreachable"), Phase 10 missing verification (class of "marked done but untested"), Phase 11 collab extension left in place
- Codebase: `src/inngest/events.ts` and `feedback-reviewed.ts:35` — existing typed event constant convention
- Codebase: `next.config.ts` — verified `cacheComponents` NOT currently enabled
- Grep of Yjs references: `block-editor.tsx`, `build-extensions.ts`, `presence-bar.tsx`, `use-presence.ts`, `build-extensions-collab.test.ts` (5 files, exhaustive enumeration for Phase 14)
- Clerk invitations API (training data, FLAGGED for re-verification by Phase 19 planner): email-only as of Clerk SDK v7; phone invitations NOT supported via `createInvitation` endpoint. Planner must WebFetch https://clerk.com/docs/reference/backend-api/tag/Invitations before coding.
- Cal.com webhooks (training data, FLAGGED): HMAC-SHA256 over raw body via `X-Cal-Signature-256` header; at-least-once delivery; signature is per-webhook optional. Planner must verify against https://cal.com/docs/core-features/webhooks before coding.
- Groq pricing (training data): Whisper per-audio-second; chat per-input-token and per-output-token; rate limits per-API-key. Exact pricing changes — Phase 18 planner verifies current.
- Mesh SDK / Blockfrost (training data, FLAGGED): tx UTXO selection is stateful per-wallet; simultaneous txs from same wallet race on UTXO set; Blockfrost returns specific error codes (`BadInputsUTxO`, `ScriptFailure`) that are non-retriable. Phase 23 planner must Context7-verify Mesh SDK current API.

---

*Pitfalls research for: v0.2 Verifiable Policy OS — Public Consultation & On-Chain Anchoring*
*Researched: 2026-04-13*
*Confidence: HIGH on stack-verified items, MEDIUM on integration-specific items flagged for planner re-verification*

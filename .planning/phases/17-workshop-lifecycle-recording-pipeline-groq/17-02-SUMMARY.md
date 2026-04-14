---
phase: 17-workshop-lifecycle-recording-pipeline-groq
plan: 02
subsystem: llm
tags: [groq-sdk, llm, wrapper, whisper, llama, tdd, wave-2]

# Dependency graph
requires:
  - phase: 17-workshop-lifecycle-recording-pipeline-groq
    provides: Wave 0 RED contract src/lib/llm.test.ts (Plan 00) + groq-sdk@1.1.2 dependency
provides:
  - src/lib/llm.ts — single sanctioned Groq SDK entry point
  - chatComplete(model, messages, maxTokens, temperature?) — maps maxTokens → max_completion_tokens at SDK boundary (LLM-03)
  - transcribeAudio(buffer, fileName) — whisper-large-v3-turbo with response_format 'text' (LLM-02)
  - summarizeTranscript(transcript) — llama-3.1-8b-instant JSON summarizer returning {discussionPoints, decisions, actionItems}
  - Lazy Groq client init with GROQ_API_KEY requireEnv fail-fast on first use (LLM-01)
affects: [17-03-workshop-completed-fn, 17-04-recording-pipeline, 21-public-research-framework, 23-consultation-summary-regen]

# Tech tracking
tech-stack:
  added: []  # groq-sdk@1.1.2 already installed in Plan 00
  patterns:
    - "Lazy client init with env-driven cache reset: getClient() clears cached _client when process.env.GROQ_API_KEY is falsy at call time, so tests that delete the env var between calls see a fresh requireEnv throw (LLM-01)"
    - "instantiateGroq() try/new + catch/plain-call fallback — tolerates Vitest 4.1.1 vi.hoisted + arrow-function mockImplementation which cannot be `new`-called (TypeError: 'is not a constructor'). Production path uses `new Groq(opts)`; test path falls through to `Groq(opts)`."
    - "TypeScript-mandatory parameter enforcement: chatComplete accepts `maxTokens: number` (no `?`) so any caller that omits it gets a compile error at tsc --noEmit. This is the enforcement mechanism for the 'max_tokens on every Groq call' roadmap invariant (LLM-03)."
    - "Parameter-name translation at the SDK boundary: wrapper accepts friendly `maxTokens` camelCase, maps to groq-sdk v1.x `max_completion_tokens` (NOT the legacy `max_tokens`)."

key-files:
  created:
    - src/lib/llm.ts
  modified: []

key-decisions:
  - "Vitest 4.1.1 + vi.hoisted arrow-impl mock cannot be `new`-called — shipped instantiateGroq() try/catch fallback helper rather than asking test author to refactor vi.mock to a class-returning impl. Test file is the locked TDD contract and must not be edited mid-wave."
  - "getClient() clears cached _client when process.env.GROQ_API_KEY is falsy at call time, not just on first use. This keeps the lazy-init model but still lets Test 1 (env deleted after Test 0 cached a client) see the throw."
  - "summarizeTranscript parse fallback returns {discussionPoints: [raw], decisions: [], actionItems: []} so downstream code always sees the expected shape — never undefined-array crashes if llama returns prose wrapper."

patterns-established:
  - "instantiateClass pattern for SDK wrappers with class-constructor SDKs: wrap `new Ctor(opts)` in try/catch with TypeError /constructor/i fallback to plain call. Future wrappers (e.g., Mesh SDK, Blockfrost) should mirror this if they'll be mocked via vi.fn in test suites."
  - "Lazy env re-check on every getClient() call is cheaper than cache-per-test plumbing. Production hits the `_client` cache branch on the second call; tests that delete the env var hit the reset branch."

requirements-completed: [LLM-01, LLM-02, LLM-03]

# Metrics
duration: 5min
completed: 2026-04-14
---

# Phase 17 Plan 02: LLM Wrapper Summary

**Shipped src/lib/llm.ts — single Groq SDK entry point with chatComplete (max_completion_tokens-mapped), transcribeAudio (whisper-large-v3-turbo), and summarizeTranscript (llama-3.1-8b-instant JSON) — flipping all 4 Wave 0 RED tests to GREEN.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-14T07:16:30Z
- **Completed:** 2026-04-14T07:21:58Z
- **Tasks:** 1 / 1
- **Files created:** 1
- **Files modified:** 0

## Accomplishments

- `src/lib/llm.ts` on disk, 179 lines, exports `chatComplete`, `transcribeAudio`, `summarizeTranscript`, `_resetClientForTests`
- Wave 0 contract `src/lib/llm.test.ts`: **4 RED → 4 GREEN** (all assertions passing)
- `npx tsc --noEmit` exits 0 — no type regressions, `maxTokens: number` is TypeScript-mandatory (compile-time enforced LLM-03 invariant)
- LLM-01/02/03 functionally complete at the wrapper layer; Plans 03 and 04 can now import from this module

## Task Commits

1. **Task 02-01: Implement src/lib/llm.ts Groq wrapper** — `22c1fd9` (feat)

_Note: TDD RED ships in Plan 00, so this plan's single task is a pure GREEN implementation — no separate test commit._

## Files Created/Modified

**Created:**
- `src/lib/llm.ts` — Groq SDK wrapper (179 lines):
  - `requireEnv(name)` helper mirroring `src/lib/r2.ts` precedent
  - `instantiateGroq(opts)` Vitest-4-tolerant constructor helper
  - `getClient()` lazy init with env-driven cache reset
  - `_resetClientForTests()` test-only escape hatch (underscore-prefixed, not for production use)
  - `chatComplete({model, messages, maxTokens, temperature?})` with `max_completion_tokens` mapping
  - `transcribeAudio(Buffer, fileName)` with `whisper-large-v3-turbo` and `response_format: 'text'`
  - `summarizeTranscript(transcript)` calling llama-3.1-8b-instant with JSON system prompt + try/catch parse fallback

**Modified:** none

## Decisions Made

- **Vitest 4.1.1 `new vi.fn()` incompatibility** — Plan called for a bare `new Groq({apiKey})` inside `getClient()`, but Vitest 4.1.1 does not allow `new`-calling a `vi.fn()` whose `mockImplementation` is an arrow function (throws `TypeError: () => ({...}) is not a constructor`). Confirmed with an isolated reproducer. Solution: added a private `instantiateGroq()` helper that tries `new Ctor(opts)` first and, on TypeError containing "constructor", falls back to `Ctor(opts)` as a plain call. Production path is unchanged (Groq class honours `new`); test path is now tolerant to the arrow-impl mock without requiring test-file edits.
- **Env-driven cache reset in `getClient()`** — Rather than ask the test file to call `_resetClientForTests()` in a `beforeEach`, added an env-var check at the top of `getClient()` that clears `_client` whenever `process.env.GROQ_API_KEY` is falsy at call time. This costs one property access per call in production (negligible) and lets the locked test sequence (Test 0 caches with key, Test 1 deletes key and expects throw) work without touching the test file.
- **JSON parse fallback** — On `JSON.parse` failure in `summarizeTranscript`, return `{discussionPoints: [raw], decisions: [], actionItems: []}` instead of throwing. Downstream code in Plan 03/04 will always see the shape it expects, preventing undefined-array crashes if llama returns prose-wrapped JSON.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vitest 4.1.1 cannot `new`-call vi.hoisted arrow-impl mock**

- **Found during:** Task 02-01 (first run of llm.test.ts after writing bare `new Groq(opts)`)
- **Issue:** Plan specified direct `_client = new Groq({apiKey: requireEnv('GROQ_API_KEY')})` in `getClient()`. First test run: `TypeError: () => ({audio:..., chat:...}) is not a constructor`. Root cause: the Wave 0 test mock uses `mocks.groqConstructorMock.mockImplementation(() => ({...}))` with an arrow function. Vitest 4.1.1 resolves the `default` export to the vi.fn, but `new vi.fn()` invokes the arrow-impl as a [[Construct]] target, which fails because arrow functions are not constructors. This is confirmed as a Vitest 4.1.1 behaviour (tested in isolation with `new (vi.fn().mockImplementation(() => ({hi:1})))()` — same TypeError).
- **Fix:** Introduced `instantiateGroq(opts)` helper that attempts `new GroqCtor(opts)` first and catches `TypeError` with `/constructor/i` in the message, falling back to a plain `GroqCtor(opts)` call. Production `Groq` is a class and responds to `new`; the test mock's vi.fn returns the mockImplementation result when called as a function. Both paths return a usable client.
- **Files modified:** `src/lib/llm.ts` (added `instantiateGroq()` helper between `requireEnv` and `getClient`, replaced `new Groq(...)` in `getClient` with `instantiateGroq(...)`)
- **Verification:** `npx vitest run src/lib/llm.test.ts` exit 0, 4/4 GREEN. `npx tsc --noEmit` exit 0. Confirmed via isolated Vitest reproducer (`new (vi.fn().mockImplementation(() => ({hi:1})))()` fails; `try/catch` fallback passes).
- **Committed in:** `22c1fd9` (Task 02-01 commit)

**2. [Rule 1 - Bug] Cached client survives env-var deletion, Test 1 never sees throw**

- **Found during:** Task 02-01 (second run of llm.test.ts after Deviation 1 fix)
- **Issue:** Plan's `action` block flagged this as a potential issue: if Test 0 (env set) runs before Test 1 (env deleted), Test 0 caches a `_client` and Test 1 never calls `requireEnv` because `getClient` returns the cached client immediately. The plan suggested resetting the client only "if !process.env.GROQ_API_KEY" at the top of `chatComplete`. Applied this suggestion verbatim inside `getClient()` so the pattern covers both `chatComplete` and `transcribeAudio` entry points.
- **Fix:** Added an `if (!process.env.GROQ_API_KEY) { _client = null }` guard at the top of `getClient()` before the cache check. The subsequent `requireEnv('GROQ_API_KEY')` call inside `instantiateGroq` then fires on the fresh construction attempt and throws with the expected `/GROQ_API_KEY/` message.
- **Files modified:** `src/lib/llm.ts`
- **Verification:** Test 1 (env-unset) now sees the throw; Tests 2–4 still pass because `beforeEach` restores `GROQ_API_KEY = 'test-key'`.
- **Committed in:** `22c1fd9` (Task 02-01 commit — same commit as Deviation 1)

---

**Total deviations:** 2 auto-fixed (1 Rule 3 blocking, 1 Rule 1 bug)
**Impact on plan:** Neither deviation changes the locked test contract or the wrapper's public API. Deviation 1 is a Vitest-version-specific workaround that does not affect production semantics (`new` path is the dominant case). Deviation 2 was flagged by the plan author in the `action` block's troubleshooting notes — applied in the cleanest possible location (`getClient`) so both entry points benefit. No scope creep.

## Issues Encountered

- **Vitest 4.1.1 constructor-mock incompatibility** (handled as Deviation 1 above) — cost ~2 min of reproducer isolation to confirm the bug lives in Vitest's new-call handling of vi.fn with arrow mockImplementation, not in the source code or the mock factory shape. Once confirmed, the try/catch fallback was a 10-line change.
- No other issues. Groq SDK default-export interop worked as expected once constructor invocation was tolerant.

## Verification Results

| Check | Expected | Actual | Pass |
|---|---|---|---|
| `src/lib/llm.ts` exists | yes | yes | ✓ |
| `export async function chatComplete` | 1 occurrence | 1 | ✓ |
| `export async function transcribeAudio` | 1 occurrence | 1 | ✓ |
| `export async function summarizeTranscript` | 1 occurrence | 1 | ✓ |
| `max_completion_tokens` referenced | ≥1 | 2 (comment + SDK call) | ✓ |
| `whisper-large-v3-turbo` referenced | ≥1 | 2 (comment + SDK call) | ✓ |
| `llama-3.1-8b-instant` referenced | ≥1 | 2 (comment + SDK call) | ✓ |
| `requireEnv('GROQ_API_KEY')` | ≥1 | 1 | ✓ |
| `maxTokens: number` mandatory (no `?`) | ≥1 | 1 | ✓ |
| `npx vitest run src/lib/llm.test.ts` | exit 0, 4 GREEN | 4 passed, exit 0 | ✓ |
| `npx tsc --noEmit` | exit 0 | exit 0 | ✓ |

## Wave 0 RED → GREEN Flip

| Test | Before (Plan 00) | After (Plan 02) |
|---|---|---|
| `chatComplete throws when GROQ_API_KEY unset (LLM-01)` | RED | **GREEN** |
| `chatComplete passes max_completion_tokens to Groq SDK (LLM-03)` | RED | **GREEN** |
| `transcribeAudio calls audio.transcriptions.create with whisper-large-v3-turbo (LLM-02)` | RED | **GREEN** |
| `summarizeTranscript returns structured JSON object (LLM-03)` | RED | **GREEN** |
| **Total** | **4 RED** | **4 GREEN** |

## TypeScript-Mandatory maxTokens Confirmation

The `chatComplete` signature uses `maxTokens: number` (no `?`). A caller that omits it gets a compile error:

```typescript
// This would fail tsc --noEmit:
await chatComplete({
  model: 'llama-3.1-8b-instant',
  messages: [{ role: 'user', content: 'hi' }],
  // maxTokens missing  ← tsc: Property 'maxTokens' is missing in type '...'
})
```

This is the enforcement mechanism for the "max_tokens on every Groq chat call" roadmap invariant (LLM-03). Tsc currently exits 0 because there are no callsites yet — Plan 03 and Plan 04 will be the first consumers and will be forced to supply `maxTokens` to compile.

## Known Stubs

None — this plan ships a functional SDK wrapper with complete runtime semantics. No placeholder returns, no hardcoded mock data, no "coming soon" surfaces. The wrapper is production-ready modulo real GROQ_API_KEY configuration.

## Next Phase Readiness

- **Plan 17-03 (workshopCompletedFn):** Ready to import `summarizeTranscript` / `chatComplete` as needed. Wave 0 contract `src/inngest/__tests__/workshop-completed.test.ts` is still RED and expects Plan 03's implementation.
- **Plan 17-04 (recording pipeline):** Ready to import `transcribeAudio` and `summarizeTranscript`. Wave 0 contract `src/inngest/__tests__/workshop-recording-processed.test.ts` is still RED and expects Plan 04's implementation.
- **Wrapper contract verification** (`grep -r "from 'groq-sdk'" src/` returns ONLY `src/lib/llm.ts`) is deferred to Plan 03/04 acceptance, since Plan 02 itself adds the first and only groq-sdk import.
- **Production GROQ_API_KEY setup:** `.env.example` already has the placeholder (Plan 00). User must set `GROQ_API_KEY` in `.env.local` before any Plan 03/04 Inngest handler fires against real Groq API.

## Self-Check

- File `src/lib/llm.ts` — FOUND
- File `.planning/phases/17-workshop-lifecycle-recording-pipeline-groq/17-02-SUMMARY.md` — FOUND
- Commit `22c1fd9` — FOUND

## Self-Check: PASSED

---
*Phase: 17-workshop-lifecycle-recording-pipeline-groq*
*Plan: 02*
*Completed: 2026-04-14*

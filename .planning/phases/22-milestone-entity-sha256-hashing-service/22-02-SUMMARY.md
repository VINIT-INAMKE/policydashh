---
phase: 22-milestone-entity-sha256-hashing-service
plan: 02
subsystem: testing
tags: [hashing, sha256, canonicalize, rfc-8785, jcs, cardano-anchoring, pure-function, inngest-safe]

# Dependency graph
requires:
  - phase: 22-milestone-entity-sha256-hashing-service
    provides: canonicalize@3.0.0 dependency + RED hashing test contract (27 tests) + 6 empty golden fixture scaffolds (Wave 0 / Plan 22-00)
provides:
  - src/lib/hashing.ts pure-function hashing service (303 lines, 8 exports + 7 exported interfaces)
  - canonicalize wrapper with undefined-return guard throw (circular-ref + unrepresentable-input safety)
  - sha256Hex primitive (64-char lowercase hex via node:crypto createHash)
  - 6 per-entity hash functions — hashPolicyVersion, hashWorkshop, hashFeedbackItem, hashEvidenceArtifact, hashEvidenceBundle, hashMilestone
  - 6 filled golden fixture JSONs with real 64-char SHA256 hex values locking the hashing contract
  - D-01a position-independence invariant — hashPolicyVersion(v) standalone equals per-child contentHash inside milestone manifest
  - Wave 0 RED hashing test contract fully GREEN (27/27 tests in src/lib/__tests__/hashing.test.ts)
affects: [22-03-trpc-router, 22-04-ui-milestone-detail, 23-cardano-anchoring, 25-integration-smoke]

# Tech tracking
tech-stack:
  added: []  # canonicalize@3.0.0 already installed in Plan 22-00
  patterns:
    - "Pure functional hashing service — no DB imports, no RegExp exports, no class instances (Inngest step.run boundary safety per D-02a)"
    - "RFC 8785 JCS canonicalization wrapper pattern — local export locks golden fixtures to THIS wrapper's bit-pattern, not upstream library internals (swappable)"
    - "Merkle-lite bundle composition — hashEvidenceBundle sorts internally by id + canonicalizes {id, contentHash} tuples instead of hashing non-deterministic ZIP bytes"
    - "Caller-sorted FK array contract — hashWorkshop's linkedArtifactIds/linkedFeedbackIds must be pre-sorted (RFC 8785 preserves array order)"
    - "Internal-sort containers — hashEvidenceBundle and hashMilestone sort internally so callers can pass shuffled arrays (VERIFY-05 stability)"
    - "One-shot Vitest filler pattern — use Vitest as a TS runtime for fixture bootstrap (imports @/src/lib/hashing via Vite's ESM resolver, then delete filler before commit)"

key-files:
  created:
    - src/lib/hashing.ts
  modified:
    - src/lib/__tests__/fixtures/hashing/policy-version.json
    - src/lib/__tests__/fixtures/hashing/workshop.json
    - src/lib/__tests__/fixtures/hashing/feedback-item.json
    - src/lib/__tests__/fixtures/hashing/evidence-artifact.json
    - src/lib/__tests__/fixtures/hashing/evidence-bundle.json
    - src/lib/__tests__/fixtures/hashing/milestone.json

key-decisions:
  - "canonicalize wrapper throws on undefined return rather than silently hashing 'undefined' — belt-and-suspenders guard against circular refs and Symbol values that slip past TypeScript"
  - "hashEvidenceBundle uses Merkle-lite composition (sort + canonicalize tuples) instead of hashing ZIP bytes — Phase 18's fflate.zipSync output is non-deterministic across Node versions/OS/compression levels"
  - "Callers pre-sort linkedArtifactIds/linkedFeedbackIds (Workshop) — RFC 8785 preserves array order; pushing sort responsibility to the caller surfaces intent at the call site rather than hiding it in the hash function"
  - "hashEvidenceBundle and hashMilestone sort internally by id / (entityType, entityId) — these are set-like containers where call-site order is meaningless, so internal sort is safer than trusting callers"
  - "Used Vitest as the one-shot fixture-fill runtime instead of tsx — tsx fails to resolve canonicalize@3.0.0 ESM 'exports' field when imported from a .ts file in a CJS-default project; Vitest's Vite-powered resolver handles the ESM/.ts/exports combination cleanly"
  - "Deleted the one-shot filler (src/lib/__tests__/_fill-fixtures.test.ts) before commit — committed state = filled fixtures + no helper, per plan's cleanup step"

patterns-established:
  - "Pattern 1: Pure hashing service module — all SHA256 content hashing goes through src/lib/hashing.ts (D-02a). No other file may import 'node:crypto' createHash for content hashing; pre-existing cal-signature.ts + feedback-token.ts + email-hash routes are HMAC/email-hash-for-lookup use cases (distinct from content hashing)"
  - "Pattern 2: Wrapper-not-reexport — src/lib/hashing.ts exports its own 'canonicalize' function wrapping the npm package (_canonicalize alias), so the golden fixtures lock THIS wrapper's output. Swapping the upstream library is safe as long as this wrapper's bit-pattern stays stable against committed fixtures"
  - "Pattern 3: D-01a composability — per-child hashes (hashPolicyVersion, hashWorkshop, ...) are position-independent; the per-child hash computed standalone MUST equal the corresponding manifest entry's contentHash inside a milestone. This lets Phase 23 share per-version and per-milestone anchor paths"
  - "Pattern 4: One-shot Vitest filler — for future fixture-filling tasks that need to import project .ts modules, use a temporary *.test.ts file (deleted before commit) instead of .mjs scripts or tsx"

requirements-completed: [VERIFY-04, VERIFY-05]

# Metrics
duration: 13min
completed: 2026-04-15
---

# Phase 22 Plan 02: Hashing Service Summary

**Pure-function RFC 8785 JCS + SHA256 hashing service (src/lib/hashing.ts, 303 lines, 8 exports) with 6 per-entity hash functions + 6 golden-fixture locks, flipping Wave 0 RED hashing contract (27 tests) fully GREEN including D-01a position-independence invariant.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-04-15T14:15:19Z
- **Completed:** 2026-04-15T14:28:38Z
- **Tasks:** 2/2
- **Files created:** 1 (src/lib/hashing.ts — 303 lines)
- **Files modified:** 6 (6 fixture JSONs filled with real hex)

## Accomplishments

- **src/lib/hashing.ts pure hashing service shipped** — 303 lines, canonicalize wrapper + sha256Hex primitive + 6 per-entity hash functions + 7 exported TypeScript interfaces. No DB imports, no RegExp exports, no class instances (Inngest step boundary safe per D-02a). Full JSDoc on every export documenting invariants (PURE, position-independent, golden-fixture-locked, caller-sort-responsibility, internal-sort).
- **All 6 golden fixtures filled with real SHA256 hex** — policy-version `167614a6…9226dbe`, workshop `46196950…1371e8ea`, feedback-item `b66fb87f…5448ae37`, evidence-artifact `d8f76f77…97bc7add`, evidence-bundle `a2412f20…53118be`, milestone `44f81ba8…d79b7e94`. Milestone manifest's 4 contentHash values each equal the corresponding entity's standalone hash, satisfying D-01a position-independence.
- **Wave 0 RED hashing test contract fully GREEN** — 27/27 tests passing in `src/lib/__tests__/hashing.test.ts` (canonicalize wrapper 4, sha256Hex 2, hashPolicyVersion 4, hashWorkshop 4, hashFeedbackItem 3, hashEvidenceArtifact 3, hashEvidenceBundle 3, hashMilestone 3, D-01a position-independence 1). Every RED test from Plan 22-00 is now GREEN.
- **Nyquist rows 22-02-01, 22-02-02, 22-02-03 ready to flip** — canonicalize wrapper, 6 hash functions, permutation + golden-fixture tests all pass. 22-VALIDATION.md update left for the phase verifier (out-of-scope for this plan's file set).
- **D-02a invariant satisfied** — grep for `createHash('sha256')` returns only 4 pre-existing email-hash lookup sites (cal webhook, intake participate route + their tests) plus `src/lib/hashing.ts` itself. All content hashing routes through the new module.

## Task Commits

Each task was committed atomically via `git commit --no-verify` (parallel executor — hooks validated once after wave per orchestrator protocol):

1. **Task 1: Create src/lib/hashing.ts with canonicalize wrapper + sha256Hex + 6 hash functions** — `6ab7136` (feat)
2. **Task 2: Fill expectedHash values in all 6 fixture files + milestone manifest contentHashes** — `8f5b48f` (test)

**Plan metadata commit:** pending (created after SUMMARY.md + STATE.md + ROADMAP.md writes)

## Files Created/Modified

### Created

- `src/lib/hashing.ts` (303 lines) — Pure-function hashing service. Exports: `canonicalize`, `sha256Hex`, `hashPolicyVersion`, `hashWorkshop`, `hashFeedbackItem`, `hashEvidenceArtifact`, `hashEvidenceBundle`, `hashMilestone` (8 functions); `PolicyVersionHashInput`, `WorkshopHashInput`, `FeedbackItemHashInput`, `EvidenceArtifactHashInput`, `ManifestEntry`, `MilestoneMetadata`, `MilestoneHashInput` (7 interfaces). Imports: `createHash` from `node:crypto`, `_canonicalize` default from `canonicalize` npm package. No DB imports.

### Modified

- `src/lib/__tests__/fixtures/hashing/policy-version.json` — `expectedHash: ""` → `"167614a695227cd6645de57402b548b8b3e6430bd463efa49eed7c79c9226dbe"`
- `src/lib/__tests__/fixtures/hashing/workshop.json` — `expectedHash: ""` → `"4619695019598ae1351c145529057c84f9274ca73146cf93107ffc1d1371e8ea"`
- `src/lib/__tests__/fixtures/hashing/feedback-item.json` — `expectedHash: ""` → `"b66fb87f2345df38626f78083afd4291f514d572093f4991ea6fcb0a5448ae37"`
- `src/lib/__tests__/fixtures/hashing/evidence-artifact.json` — `expectedHash: ""` → `"d8f76f77e178fef1c83668ec01ed4e092021c94b84a761439495510a97bc7add"`
- `src/lib/__tests__/fixtures/hashing/evidence-bundle.json` — `expectedHash: ""` → `"a2412f20cc2deb5bb5ff1fef2eb2885c686f23eab093bc5279fed214b53118be"`
- `src/lib/__tests__/fixtures/hashing/milestone.json` — manifest 4x `contentHash: "PLACEHOLDER_FILL_IN_22_02"` → real 64-char hex (per entity), `expectedHash: ""` → `"44f81ba8780e43c8f7ecae9bde795a1b916b387f882e26a826ef6cb9d79b7e94"`

## Golden Fixture Hashes (first 12 chars, D-01a verification)

| Fixture | expectedHash (first 12) | Function | Used As |
|---|---|---|---|
| policy-version.json | `167614a69522` | hashPolicyVersion | Standalone + manifest `version` contentHash |
| workshop.json | `461969501959` | hashWorkshop | Standalone + manifest `workshop` contentHash |
| feedback-item.json | `b66fb87f2345` | hashFeedbackItem | Standalone + manifest `feedback` contentHash |
| evidence-artifact.json | `d8f76f77e178` | hashEvidenceArtifact | Standalone + manifest `evidence` contentHash |
| evidence-bundle.json | `a2412f20cc2d` | hashEvidenceBundle | Merkle-lite over 3 artifacts |
| milestone.json | `44f81ba8780e` | hashMilestone | Cardano anchor payload (Phase 23) |

D-01a position-independence verified: each of the first 4 per-entity `expectedHash` values equals the corresponding `contentHash` in `milestone.json`'s manifest, tested explicitly in `src/lib/__tests__/hashing.test.ts` describe block "D-01a position-independence (VERIFY-04)".

## Decisions Made

- **canonicalize wrapper throws on `undefined` return** — the upstream package returns `undefined` only on circular references or `Symbol` values, neither of which can appear in DB rows, but the TypeScript signature `string | undefined` doesn't prevent accidental leaks. Throwing forces the caller to handle the edge case rather than silently hashing the literal string `"undefined"` and corrupting output. Belt-and-suspenders safety for Cardano anchoring hard determinism.
- **Merkle-lite bundle composition over ZIP-bytes hashing** — Phase 18's `fflate.zipSync` output is non-deterministic across Node versions, OS, and compression levels (per 22-RESEARCH.md §G). Instead, `hashEvidenceBundle` sorts artifacts by id, computes each artifact's standalone hash, then canonicalizes the ordered list of `{id, contentHash}` tuples. This is composable (auditors can re-derive any artifact's contribution without the full ZIP) and stable (no ZIP toolchain sensitivity).
- **Caller pre-sort for Workshop FK arrays, internal sort for set containers** — `hashWorkshop`'s `linkedArtifactIds` and `linkedFeedbackIds` are caller-sorted (contract documented in interface JSDoc + tested via "caller re-sorts" test). `hashEvidenceBundle` and `hashMilestone` sort internally because they are set-like containers where call-site ordering has no semantic meaning. Mixed approach surfaces caller intent at call sites that matter while hiding trivial ordering details where they don't.
- **Vitest as one-shot TS runtime for fixture fill** — `tsx scripts/fill.mts` failed: `tsx` resolves imports via Node's CJS loader first, which doesn't honor the canonicalize@3.0.0 package's `"exports"` field (ESM-only). Swapping to Vitest leveraged Vite's ESM-aware resolver that already works for the test suite. A `src/lib/__tests__/_fill-fixtures.test.ts` file was written, run with `npx vitest run <path>`, then deleted before commit. The committed state is: filled fixtures + NO helper script (per plan's cleanup step).
- **No `scripts/fill-hashing-fixtures.ts` committed** — initial attempt was a permanent `.ts` script under `scripts/` per the plan's Option A reference code. After the tsx/ESM resolver mismatch, switched to the one-shot Vitest filler approach. Deleted the permanent script before commit. Plan's cleanup step explicitly required "DELETE `scripts/fill-hashing-fixtures.ts` — it was a one-shot helper, not a long-term tool. The committed state should be: filled fixtures + NO helper script." Requirement satisfied via an even lighter-weight path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced `tsx scripts/fill-hashing-fixtures.ts` with one-shot Vitest filler due to canonicalize@3.0.0 ESM/tsx resolution mismatch**

- **Found during:** Task 2 (fill expectedHash values)
- **Issue:** Plan's Option A recommended `npx tsx scripts/fill-hashing-fixtures.ts` to run a helper script importing from `../src/lib/hashing`. Running it produced `ERR_PACKAGE_PATH_NOT_EXPORTED: No "exports" main defined in node_modules/canonicalize/package.json`. The canonicalize package is `"type": "module"` with only `"exports": {".": {"import": "./lib/canonicalize.js"}}` — no CJS entry. The project's root `package.json` has no `"type"` field (defaults to CommonJS), so `tsx` treats `.ts` files as CJS and uses Node's CJS loader to resolve imports, which ignores the `"exports"` field and fails. Renaming to `.mts` made tsx resolve the script as ESM but then treated the imported `hashing.ts` as CJS and failed to find the named exports. This was blocking Task 2 entirely.
- **Fix:** Wrote a single-use `src/lib/__tests__/_fill-fixtures.test.ts` file that imports from `@/src/lib/hashing` (via the `@/*` tsconfig path alias already configured for the test suite), uses Vitest's `describe/it` to compute and write all 6 fixtures inside a sanity-asserted test, then ran `npx vitest run src/lib/__tests__/_fill-fixtures.test.ts`. Vitest's Vite-powered resolver handles the ESM/`.ts`/`exports` combination cleanly because the test suite already depends on it. After the successful fill, deleted the filler file before commit. Committed state is still filled fixtures + NO helper script, satisfying the plan's cleanup intent.
- **Files modified:** None added to commit (filler was created and deleted in the same task), 6 fixture JSONs modified as originally planned
- **Verification:** `npx vitest run --reporter=dot src/lib/__tests__/hashing.test.ts` → 27/27 GREEN including D-01a position-independence; `! test -f scripts/fill-hashing-fixtures.ts` → pass; `! test -f src/lib/__tests__/_fill-fixtures.test.ts` → pass
- **Committed in:** `8f5b48f` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking)
**Impact on plan:** Zero scope creep. The deviation only swapped the fill mechanism (tsx → one-shot Vitest) to work around a module-resolution incompatibility. The end-state committed artifacts (6 filled fixtures, no helper script) match the plan exactly. The deviation is actually a more elegant pattern that future fixture-fill tasks should reuse — documented as Pattern 4 in `patterns-established`.

## Issues Encountered

- **tsx cannot resolve canonicalize@3.0.0 from a `.ts` file** — Node's CJS loader used by tsx ignores the `"exports"` field, and canonicalize@3.0.0 only ships an ESM entry via `"exports"`. No CJS fallback exists. Documented above as Rule 3 deviation; resolved by using Vitest as the one-shot runtime.
- **Parallel plan 22-01 committed permission-matrix changes mid-plan** — While running my full test suite baseline check, observed that `src/__tests__/feedback-permissions.test.ts` and `src/__tests__/section-assignments.test.ts` had 9 failing tests. Investigation: parallel plan 22-01 committed `6bc946d feat(22-01): add MILESTONE_* actions + milestone:manage/read permissions` during my execution window, which expanded the permission constants in a way that altered the permission matrix. This is **out-of-scope** for Plan 22-02 per the Scope Boundary rule (my files are hashing.ts + 6 fixture JSONs only). Parallel plan 22-01's own execution will handle these and update its tests accordingly. Logged here; not fixed.
- **`src/server/routers/__tests__/milestone.test.ts` still RED** — Wave 0 RED contract for Plan 22-03 (tRPC router), which has not yet executed. Expected to stay RED until 22-03 ships. Out-of-scope for 22-02.
- **Baseline full suite shows 9 pre-existing/parallel failures** — Full suite: 522 passed, 9 failed, 1 todo. The 9 failures break down as: 7 in `milestone.test.ts` (Wave 0 RED awaiting Plan 22-03), 2 in `feedback-permissions.test.ts` (parallel plan 22-01 permission-matrix drift). NONE of the 9 failures are caused by Plan 22-02's changes. My plan's file surface (`src/lib/hashing.ts` + 6 fixtures) has 0 failing tests.

## User Setup Required

None — pure code-level changes. No env vars, no external service config, no dashboard setup.

## Next Phase Readiness

**Plan 22-03 (tRPC router) unblocked.** The milestoneRouter can now:

1. Import from `@/src/lib/hashing`: `hashPolicyVersion`, `hashWorkshop`, `hashFeedbackItem`, `hashEvidenceArtifact`, `hashEvidenceBundle`, `hashMilestone` + type interfaces
2. Call `hashMilestone({ manifest, metadata })` in the `markReady` mutation to compute `milestones.contentHash` before flipping state from `defining` → `ready`
3. Rely on D-01a position-independence: when building the milestone manifest, each child entry's `contentHash` is the same hex that would be produced by calling the per-child hash function standalone, which simplifies downstream Phase 23 verification logic

**Plan 22-04 (UI milestone detail) unblocked for hashing display.** Once 22-03 ships the router, the UI can render `contentHash` from the database directly — no client-side hash computation needed.

**Phase 23 (Cardano anchoring) foundation ready.** The hashing service is pure, Inngest-step-safe, and locked by golden fixtures. Phase 23's Inngest function can import `hashPolicyVersion` and `hashMilestone` from within `step.run()` bodies without any DB coupling or closure-serialization issues.

**No blockers for downstream work.** All out-of-scope failures (parallel plan 22-01's permission tests, Wave 0 RED milestone router) are expected and will resolve as those plans ship.

---

*Phase: 22-milestone-entity-sha256-hashing-service*
*Plan: 02 (hashing service)*
*Completed: 2026-04-15*

## Self-Check: PASSED

All claimed files exist on disk:

- src/lib/hashing.ts (303 lines, 8 exports + 7 interfaces)
- src/lib/__tests__/fixtures/hashing/{policy-version,workshop,feedback-item,evidence-artifact,evidence-bundle,milestone}.json (6 files, all with real 64-char hex expectedHash)
- .planning/phases/22-milestone-entity-sha256-hashing-service/22-02-SUMMARY.md

All claimed commits exist in git history:

- `6ab7136` (Task 1: feat create src/lib/hashing.ts)
- `8f5b48f` (Task 2: test fill 6 fixture expectedHash values)

Cleanup verified:

- `scripts/fill-hashing-fixtures.ts` not present
- `scripts/fill-hashing-fixtures.mts` not present
- `src/lib/__tests__/_fill-fixtures.test.ts` not present

Test suite verification re-run:

- `npx vitest run --reporter=dot src/lib/__tests__/hashing.test.ts` → 27/27 tests GREEN
- D-01a position-independence test GREEN
- No test regressions caused by Plan 22-02 (the 9 full-suite failures are all parallel-plan 22-01 permission drift + Wave 0 RED milestone router for Plan 22-03, both out-of-scope)

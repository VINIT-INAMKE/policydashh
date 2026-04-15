---
phase: 22
slug: milestone-entity-sha256-hashing-service
status: wave_0_complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-15
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.1 |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~40s (full suite; baseline ~330 passing + Phase 22 new tests) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green (Wave 0 REDs flipped to GREEN by Plans 22-01/22-02/22-03)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Pre-seeded with expected task rows from all 5 plans (22-00 through 22-04). Plan 22-00 task rows flip to `created (this task)` / `RED (expected)` when that Wave 0 TDD plan executes. Downstream plan rows stay `pending` until their plans land.
>
> **Blocker gate:** Plans 22-01 through 22-04 MUST NOT start while `nyquist_compliant: false` or `wave_0_complete: false`. Both flags flipped true in Plan 22-00 (Wave 0) after RED tests + fixture scaffolds + VALIDATION.md updates commit. `execute-phase` reads these flags as a precondition before dispatching downstream plan tasks.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-00-01 | 00 | 0 | VERIFY-04, VERIFY-05 | unit (hashing RED) | `npx vitest run --reporter=dot src/lib/__tests__/hashing.test.ts` | ✓ | wave_0_complete |
| 22-00-02 | 00 | 0 | VERIFY-04, VERIFY-05 | unit (golden fixtures) | `test -d src/lib/__tests__/fixtures/hashing && ls src/lib/__tests__/fixtures/hashing/*.json \| wc -l` | ✓ | wave_0_complete |
| 22-00-03 | 00 | 0 | VERIFY-03 | unit (tRPC RED) | `npx vitest run --reporter=dot src/server/routers/__tests__/milestone.test.ts` | ✓ | wave_0_complete |
| 22-00-04 | 00 | 0 | VERIFY-02 | unit (schema RED) | `npx vitest run --reporter=dot src/db/schema/__tests__/milestones.test.ts` | ✓ | wave_0_complete |
| 22-00-05 | 00 | 0 | — | doc | `grep -q "nyquist_compliant: true" .planning/phases/22-milestone-entity-sha256-hashing-service/22-VALIDATION.md` | ✓ | wave_0_complete |
| 22-01-01 | 01 | 1 | VERIFY-01 | unit (milestones schema) | `npx vitest run --reporter=dot src/db/schema/__tests__/milestones.test.ts` | after Plan 01 | pending |
| 22-01-02 | 01 | 1 | VERIFY-02 | unit (milestoneId FK on 4 tables) | `npx vitest run --reporter=dot src/db/schema/__tests__/milestones.test.ts` | after Plan 01 | pending |
| 22-01-03 | 01 | 1 | VERIFY-01 | integration (SQL migration applies cleanly) | `node scripts/apply-migration.mjs src/db/migrations/0014_milestones_hashing.sql` | after Plan 01 | pending |
| 22-02-01 | 02 | 1 | VERIFY-04 | unit (canonicalize wrapper) | `npx vitest run --reporter=dot src/lib/__tests__/hashing.test.ts -t "canonicalize"` | after Plan 02 | pending |
| 22-02-02 | 02 | 1 | VERIFY-04 | unit (6 hash functions return 64-hex) | `npx vitest run --reporter=dot src/lib/__tests__/hashing.test.ts -t "returns 64-char"` | after Plan 02 | pending |
| 22-02-03 | 02 | 1 | VERIFY-05 | unit (permutation + golden fixtures GREEN) | `npx vitest run --reporter=dot src/lib/__tests__/hashing.test.ts` | after Plan 02 | pending |
| 22-03-01 | 03 | 2 | VERIFY-03 | unit (tRPC milestoneRouter GREEN) | `npx vitest run --reporter=dot src/server/routers/__tests__/milestone.test.ts` | after Plan 03 | pending |
| 22-03-02 | 03 | 2 | VERIFY-01 | unit (markReady rejects anchored / unmet slots) | `npx vitest run --reporter=dot src/server/routers/__tests__/milestone.test.ts -t "markReady"` | after Plan 03 | pending |
| 22-04-01 | 04 | 3 | VERIFY-03 | integration (milestone detail page renders) | `npx vitest run --reporter=dot src/app/__tests__/milestone-detail.test.tsx` | after Plan 04 | pending |
| 22-04-02 | 04 | 3 | VERIFY-03 | integration (PolicyTabBar shows Milestones) | `npx vitest run --reporter=dot src/app/__tests__/policy-tab-bar.test.tsx` | after Plan 04 | pending |

---

## Golden Fixture Coverage (VERIFY-04 + VERIFY-05)

Fixture files at `src/lib/__tests__/fixtures/hashing/`:

| Fixture File | Hash Function | Key Tests |
|---|---|---|
| `policy-version.json` | `hashPolicyVersion` | key permutation, null publishedAt, large sectionsSnapshot |
| `workshop.json` | `hashWorkshop` | sorted linkedArtifactIds, sorted linkedFeedbackIds, permuted keys |
| `feedback-item.json` | `hashFeedbackItem` | null fields, boolean isAnonymous, enum string values |
| `evidence-artifact.json` | `hashEvidenceArtifact` | null fileName, null fileSize, type 'link' vs 'file' |
| `evidence-bundle.json` | `hashEvidenceBundle` | array order independence (shuffled input = same hash) |
| `milestone.json` | `hashMilestone` | manifest sorted by (entityType, entityId), nested JSONB |

**Wave 0 lock:** Fixture files land with input shapes + `expectedHash: ""`. Plan 22-02 fills `expectedHash` once `hashing.ts` is built (run `hashXxx(fixture.input)` + copy hex).

---

## Wave 0 Requirements

- [x] `src/lib/__tests__/hashing.test.ts` — RED contract for canonicalize wrapper + 6 hash functions + permutation + golden fixtures (VERIFY-04, VERIFY-05)
- [x] `src/lib/__tests__/fixtures/hashing/{policy-version,workshop,feedback-item,evidence-artifact,evidence-bundle,milestone}.json` — 6 fixture files with `expectedHash: ""`
- [x] `src/server/routers/__tests__/milestone.test.ts` — RED contract for milestoneRouter 6 procedures + state machine invariants (VERIFY-03)
- [x] `src/db/schema/__tests__/milestones.test.ts` — RED contract for schema shape + milestoneId FK on 4 target tables (VERIFY-01, VERIFY-02)
- [x] `npm install canonicalize` — v3.0.0, zero runtime deps, RFC 8785 JCS reference implementation (required before tests can even parse)
- [x] 22-VALIDATION.md frontmatter: flip `nyquist_compliant` → `true` and `wave_0_complete` → `true` (gates Plans 22-01 through 22-04)

*Wave 0 ships ALL tests RED — no implementation. This locks the Nyquist contract Plans 22-01 through 22-04 must satisfy.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin browser walk: create milestone → curate entities → mark ready | VERIFY-03 | Requires real dev server + admin Clerk session + policy with published versions | Deferred to `/gsd:complete-milestone` smoke-walk batch per user prefs |
| 3rd-party auditor re-verification round-trip (Phase 23 gate) | VERIFY-04, VERIFY-05 | Requires full Cardano tx + Blockfrost — out of Phase 22 scope | Phase 25 integration smoke covers this |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING test references (every row in the per-task map points at a real test command on disk after 22-00 executes)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter (flipped in 22-00 final task — GATES 22-01 START)
- [ ] `wave_0_complete: true` set in frontmatter (flipped in 22-00 final task — GATES 22-01 START)

**Approval:** pending (final approval after Plans 22-01 through 22-04 flip Wave 0 REDs to GREEN)

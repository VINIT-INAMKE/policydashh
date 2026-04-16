---
phase: 22-milestone-entity-sha256-hashing-service
plan: 03
subsystem: api
tags: [trpc, milestone, router, hash-composition, markReady, state-machine, audit-log]

# Dependency graph
requires:
  - phase: 22-milestone-entity-sha256-hashing-service
    provides: milestones schema + milestoneId FK on 4 child tables + ACTIONS + PERMISSIONS (Plan 22-01)
  - phase: 22-milestone-entity-sha256-hashing-service
    provides: src/lib/hashing.ts pure hashing service with 6 per-entity hash functions (Plan 22-02)
provides:
  - src/server/routers/milestone.ts — 542-line tRPC router with 6 procedures (create, list, getById, attachEntity, detachEntity, markReady)
  - milestoneRouter registered under appRouter.milestone in src/server/routers/_app.ts
  - markReady mutation: per-child hash composition + sorted manifest + milestone hash + status transition defining → ready
  - State machine guards: rejects if status !== 'defining', rejects if anchored (immutability)
  - Structured unmet-slot error on markReady if required entity counts not met
  - Discriminated union attachEntity by entityType (policyVersion/workshop/feedbackItem/evidenceArtifact/evidenceBundle)
  - Fire-and-forget writeAuditLog on every mutation
  - Wave 0 RED milestone router test fully GREEN (7/7 tests in src/server/routers/__tests__/milestone.test.ts)
affects: [22-04-ui-milestone, 23-cardano-anchoring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "6-procedure tRPC router matching existing project conventions (requirePermission, writeAuditLog fire-and-forget)"
    - "Hash composition in markReady: queries all linked entities, computes per-child hashes via hashing.ts, builds sorted manifest, computes milestone hash"
    - "Discriminated union input schema for attachEntity/detachEntity — zod discriminatedUnion on entityType field"
    - "State machine enforcement: anchored milestones reject all mutations, markReady only allowed from defining state"
---

## 22-03: milestoneRouter tRPC — 6-procedure lifecycle + hash composition

**One-liner:** Ships the complete milestone create/curate/mark-ready tRPC API with hash composition logic that powers the verifiable policy anchoring pipeline.

## Accomplishments

| # | Task | Result |
|---|------|--------|
| 1 | milestoneRouter with 6 procedures + hash composition | 542 lines, all procedures functional |
| 2 | Register under appRouter.milestone | Added to _app.ts, fully wired |

## Key files

created:
  - src/server/routers/milestone.ts (542 lines — 6 procedures + input schemas + hash composition)

modified:
  - src/server/routers/_app.ts (milestoneRouter registration)

## Verification

- src/server/routers/__tests__/milestone.test.ts: 7/7 GREEN
- npx tsc --noEmit: 0 errors

## Deviations

None.

## Self-Check: PASSED

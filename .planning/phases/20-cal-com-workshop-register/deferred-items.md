# Phase 20 — Deferred Items (out of scope for executing plans)

## From Plan 20-06 executor (parallel Wave 2)

- **TS2551 in `src/inngest/functions/workshop-registration-received.ts:118`** — `workshop.scheduledAt.toISOString()` called on `string` type. This file is owned by parallel Plan 20-04 executor. Not introduced by 20-06 changes. Leave for 20-04 executor or phase-final cleanup.

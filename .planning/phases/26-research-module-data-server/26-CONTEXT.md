# Phase 26 Context — Research Module — Data & Server

## Goal
research_lead and admin can create, manage, review, publish, and retract citable research items attached to a policy document; research items participate in milestone manifests; schema and tRPC surface are in place with full audit/RBAC coverage.

## Scope (IN)
- New `research_items` table + three link tables (`research_item_section_links`, `research_item_version_links`, `research_item_feedback_links`).
- Migration 0025 applied via `scripts/apply-migration-0025.mjs` (Neon HTTP runner).
- `readableId` via `nextval('research_item_id_seq')` — `RI-001`, `RI-002`, …
- Seven new RBAC permissions (see `.planning/research/research-module/INTEGRATION.md` §8) added to `src/lib/permissions.ts`.
- New action constants (`RESEARCH_CREATE`, `RESEARCH_SUBMIT_REVIEW`, `RESEARCH_APPROVE`, `RESEARCH_REJECT`, `RESEARCH_RETRACT`, plus link-table actions `RESEARCH_SECTION_LINK`, etc.) in `src/lib/constants.ts`. Approve == publish (moderation gate per Q3), so no separate `RESEARCH_PUBLISH` constant.
- tRPC `research` router with **15 procs** (list, listPublic, getById, create, update, submitForReview, approve, reject, retract, linkSection, unlinkSection, linkVersion, unlinkVersion, linkFeedback, unlinkFeedback). Each writes audit log + workflow_transitions.
- Service layer enforces valid-transition guard (mirror `src/server/services/feedback.service.ts` post-R1 fallback pattern).
- `ManifestEntry.entityType` union extended with `'research_item'`; `RequiredSlots.research_items?` added; nullable `milestoneId` FK (SQL-level only) on `research_items`.
- Unit tests for router procs, state machine, collision-safe ID generation, permission matrix, anonymous-author filter.
- Register `RESEARCH-01` through `RESEARCH-05` in `.planning/REQUIREMENTS.md`.

## Scope (OUT)
- No UI (Phase 27).
- No public listing (Phase 28).
- No individual per-item Cardano anchor (Q4: milestone-only for v0.2).
- No authorship transfer mutation (Q8: deferred).
- No DOI external validation (Q10: plain text).
- No per-section-version linking (Q5: section-level only).
- No Inngest function for research items (no async workflow required yet).

## User decisions (from `.planning/research/research-module/QUESTIONS.md`)
| # | Decision |
|---|----------|
| Q1 | `documentId NOT NULL` — scoped per policy |
| Q2 | `admin + policy_lead + research_lead` can create; only admin + policy_lead can publish |
| Q3 | Moderation gate required (no self-publish) |
| Q4 | Milestone-only anchoring; no individual per-item tx |
| Q5 | Section-level links only (FK `policy_sections`) |
| Q7 | `isAuthorAnonymous boolean NOT NULL DEFAULT false` |
| Q8 | No authorship transfer in v0.2 |
| Q10 | DOI stored as plain text |

## Dependencies
- Phase 22 (milestone manifest, `ManifestEntry`)
- Phase 6 (`document_versions`)
- Existing: `evidence_artifacts`, `policy_documents`, `policy_sections`, `users`, `feedback`, `workflow_transitions`, `audit_events`.

## Key files likely touched
- NEW `src/db/schema/research.ts`
- NEW `src/db/migrations/0025_research_module.sql`
- NEW `scripts/apply-migration-0025.mjs`
- NEW `src/server/routers/research.ts`
- NEW `src/server/services/research.service.ts`
- NEW `src/server/services/research.lifecycle.ts` (valid-transition table)
- MOD `src/lib/permissions.ts` — add 7 permission strings + grants
- MOD `src/lib/constants.ts` — add research ACTIONS
- MOD `src/db/schema/milestones.ts` — extend `ManifestEntry.entityType` union, add `research_items?` to `RequiredSlots`
- MOD `src/trpc/_app.ts` — register `research` subRouter
- NEW `src/__tests__/research-*.test.ts` — router, service, lifecycle, permissions tests
- MOD `.planning/REQUIREMENTS.md` — register RESEARCH-01..05

## Risks
- **Circular import** between `research_items.milestoneId` and `milestones`: apply FK in SQL-only, same workaround as `workshops.milestoneId` and `evidence_artifacts.milestoneId`.
- **Large permissions delta**: 7 new permissions across multiple role grants — must update RBAC unit tests.
- **State machine proliferation**: 4 states + 5 transitions must be locked down before UI planning.
- **Readable-ID sequence**: reuse pattern from `feedback_id_seq` to avoid the pre-R7 collision class of bug.

## Success criteria
See ROADMAP.md Phase 26 entry (criteria 1–7).

## Artefacts produced by this phase
- Migration SQL + apply script
- Schema + router + service + lifecycle module
- Permissions + audit constants
- Contract tests
- Registered requirements

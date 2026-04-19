/**
 * RED TDD stub for RESEARCH-02 + RESEARCH-04 — research tRPC router contract
 *
 * Wave 0 contract lock for Phase 26 Plan 26-05. All tests here are `it.todo`
 * (pending) — they describe the behavior Plan 26-05 must make GREEN without
 * failing the test suite at Wave 0 time.
 *
 * Target module: `@/src/server/routers/research` (does NOT yet exist at Wave 0)
 *
 * Canonical patterns:
 *   - nextval readableId: `src/server/routers/feedback.ts` lines 40-43
 *   - vi.mock('@/src/db') + vi.mock('@/src/lib/audit'): Phase 16 pattern
 *   - segs.join('/') dynamic import for missing modules: Phase 16/17/18/19/20.5/21/22/23 pattern
 *
 * Expected 15 procedures on researchRouter:
 *   QUERIES:    list, listPublic, getById
 *   MUTATIONS:  create, update,
 *               submitForReview, approve, reject, retract,
 *               linkSection, unlinkSection,
 *               linkVersion, unlinkVersion,
 *               linkFeedback, unlinkFeedback
 *
 * appRouter registration: `src/server/routers/_app.ts` exposes `research.*` namespace
 *   — confirmed via appMod.appRouter._def.procedures keys starting with 'research.'
 *
 * Pitfall 5 edge cases (anonymous-author filter on public queries) — see final describe.
 */

import { describe, it, vi } from 'vitest'

// Mocks reserved for Plan 26-05 implementation tests. Referenced here so the
// Wave 0 RED contract shows the full mocking surface Plan 26-05 will exercise.
vi.mock('@/src/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
          orderBy: () => Promise.resolve([]),
        }),
        orderBy: () => Promise.resolve([]),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([]),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve([{ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', readableId: 'RI-001' }]),
        onConflictDoNothing: () => Promise.resolve(undefined),
      }),
    }),
    execute: vi.fn(() => Promise.resolve({ rows: [{ seq: '1' }] })),
  },
}))

vi.mock('@/src/lib/audit', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}))

// Phase 16+ canonical pattern — variable-path dynamic import defeats Vite's static
// import analysis so test file can be committed before target module exists.
async function _loadRouter() {
  const segs = ['@', 'src', 'server', 'routers', 'research']
  const path = segs.join('/')
  return await import(/* @vite-ignore */ path)
}
void _loadRouter

describe('researchRouter export (RESEARCH-04) — from @/src/server/routers/research', () => {
  it.todo("imports researchRouter via segs.join('/') dynamic import and asserts mod.researchRouter is defined")
})

describe('researchRouter QUERY procedures (RESEARCH-04)', () => {
  it.todo("mod.researchRouter._def.procedures.list is defined (QUERY — list drafts for research_lead+)")
  it.todo("mod.researchRouter._def.procedures.listPublic is defined (QUERY — 'listPublic' returns published items, applies anonymous-author filter)")
  it.todo("mod.researchRouter._def.procedures.getById is defined (QUERY — fetch single research item)")
})

describe('researchRouter MUTATION procedures — create + update (RESEARCH-02, RESEARCH-04)', () => {
  it.todo("mod.researchRouter._def.procedures.create is defined (MUTATION — builds readableId via nextval('research_item_id_seq'))")
  it.todo("mod.researchRouter._def.procedures.update is defined (MUTATION — update metadata on draft items only)")
})

describe('researchRouter MUTATION procedures — lifecycle (RESEARCH-04, RESEARCH-05)', () => {
  it.todo("mod.researchRouter._def.procedures.submitForReview is defined (MUTATION — transitions draft -> pending_review)")
  it.todo("mod.researchRouter._def.procedures.approve is defined (MUTATION — 'approve' transitions pending_review -> published, populates reviewedBy/reviewedAt)")
  it.todo("mod.researchRouter._def.procedures.reject is defined (MUTATION — 'reject' transitions pending_review -> draft)")
  it.todo("mod.researchRouter._def.procedures.retract is defined (MUTATION — 'retract' transitions published -> retracted)")
})

describe('researchRouter MUTATION procedures — link tables (RESEARCH-04)', () => {
  it.todo("mod.researchRouter._def.procedures.linkSection is defined (MUTATION — onConflictDoNothing on researchItemSectionLinks)")
  it.todo("mod.researchRouter._def.procedures.unlinkSection is defined (MUTATION — DELETE on researchItemSectionLinks composite PK)")
  it.todo("mod.researchRouter._def.procedures.linkVersion is defined (MUTATION — links research item to document version)")
  it.todo("mod.researchRouter._def.procedures.unlinkVersion is defined (MUTATION — unlinks research item from document version)")
  it.todo("mod.researchRouter._def.procedures.linkFeedback is defined (MUTATION — links research item to feedback item)")
  it.todo("mod.researchRouter._def.procedures.unlinkFeedback is defined (MUTATION — unlinks research item from feedback item)")
})

describe('researchRouter procedure count (RESEARCH-04)', () => {
  it.todo("Object.keys(mod.researchRouter._def.procedures) contains all 15 required names and length is >= 15: 'list', 'listPublic', 'getById', 'create', 'update', 'submitForReview', 'approve', 'reject', 'retract', 'linkSection', 'unlinkSection', 'linkVersion', 'unlinkVersion', 'linkFeedback', 'unlinkFeedback'")
})

describe('appRouter registration (RESEARCH-04)', () => {
  it.todo("_app.ts registers research subRouter — import @/src/server/routers/_app, Object.keys(appMod.appRouter._def.procedures) contains entries starting with 'research.' namespace")
})

describe('readableId uniqueness under concurrent writes (RESEARCH-02)', () => {
  it.todo("create mutation builds readableId using nextval('research_item_id_seq') producing RI-001 / RI-002 / RI-003 pattern via mocked db.execute spy — collision-safe pattern mirroring feedback_id_seq")
})

describe('anonymous-author filter edge cases (RESEARCH-04 — Pitfall 5)', () => {
  it.todo("getById with isAuthorAnonymous=true and status=draft returns authors (not nulled — draft read by owner)")
  it.todo("getById with isAuthorAnonymous=true and status=published returns authors=null (public-facing filter)")
  it.todo("listPublic with mixed anonymous/named items nulls authors only on isAuthorAnonymous=true rows")
})

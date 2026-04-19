/**
 * RED TDD stub for RESEARCH-05 — research service R6 invariant contract
 *
 * Wave 0 contract lock for Phase 26 Plan 26-04. All tests here are `it.todo`
 * (pending) — they describe the behavior Plan 26-04 must make GREEN without
 * failing the test suite at Wave 0 time.
 *
 * Target module: `@/src/server/services/research.service` (does NOT yet exist at Wave 0)
 *
 * Canonical source for R6 invariant: `src/server/services/feedback.service.ts` lines 139-162
 *
 * Expected exports:
 *   transitionResearch(researchItemId: string, toStatus: ResearchItemStatus,
 *                      actorId: string, meta?: Record<string, unknown>):
 *     Promise<ResearchItemRow & { previousStatus: string; newStatus: string }>
 *
 * R6 invariant (from feedback.service.ts): INSERT workflowTransitions BEFORE UPDATE researchItems.
 * If UPDATE fails mid-transition, the audit row survives and retry can recover.
 *
 * Future RED assertions (Plan 26-04 will flip these to it() bodies with a vi.hoisted()
 * mock on '@/src/db' tracking callOrder like ['select', 'insert:workflowTransitions',
 * 'update:researchItems'] — assert insertIdx is less than updateIdx, i.e.:
 *   expect(insertIdx).toBeLessThan(updateIdx)
 *
 * NOT_FOUND path: when initial .select() returns empty rows, transitionResearch throws
 * TRPCError with code 'NOT_FOUND'.
 *
 * Reviewed fields: when transitioning to 'published', updateData includes reviewedBy: actorId
 * and reviewedAt: Date. When transitioning to 'retracted' with meta.retractionReason,
 * updateData includes retractionReason.
 *
 * Return shape: Object.assign pattern — returned row has previousStatus + newStatus fields.
 */

import { describe, it } from 'vitest'

// References reserved for Plan 26-04 test bodies.
// 'insert:workflowTransitions' and 'update:researchItems' are the expected callOrder markers
// tracked by the vi.mock('@/src/db') factory via a shared callOrder: string[] array.
// The R6 invariant check is: insertIdx = callOrder.indexOf('insert:workflowTransitions'),
//                            updateIdx = callOrder.indexOf('update:researchItems'),
//                            expect(insertIdx).toBeLessThan(updateIdx).

describe('transitionResearch (RESEARCH-05 + R6 invariant) — from @/src/server/services/research.service', () => {
  it.todo("exports transitionResearch function from '@/src/server/services/research.service' — import { transitionResearch } from '@/src/server/services/research.service'")

  it.todo("R6 invariant: 'insert:workflowTransitions' happens BEFORE 'update:researchItems' in callOrder — insertIdx = callOrder.indexOf('insert:workflowTransitions'), updateIdx = callOrder.indexOf('update:researchItems'), expect(insertIdx).toBeLessThan(updateIdx) — mirrors feedback.service.ts lines 139-162")

  it.todo("returns object with previousStatus ('draft') and newStatus ('pending_review') fields via Object.assign pattern — result.previousStatus and result.newStatus populated")

  it.todo("when transitioning to 'published', updateData includes reviewedBy: actorId and reviewedAt: new Date() — review fields populated on approve path")

  it.todo("when transitioning to 'retracted' with meta.retractionReason, updateData includes retractionReason — retractionReason guard on retract path")

  it.todo("on invalid transition (e.g., draft -> published skipping pending_review), throws TRPCError BAD_REQUEST and does NOT 'insert:workflowTransitions' — assertValidTransition guard fires before INSERT")
})

describe('transitionResearch NOT_FOUND path (RESEARCH-05)', () => {
  it.todo("throws TRPCError NOT_FOUND when initial SELECT on researchItems returns empty rows — first .select().from().where().limit() resolves []")

  it.todo("when row missing, does NOT write to workflowTransitions — NOT_FOUND guard fires before INSERT")
})

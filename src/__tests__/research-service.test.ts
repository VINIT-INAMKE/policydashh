/**
 * GREEN assertions for RESEARCH-05 — research service R6 invariant.
 *
 * Phase 26 Plan 26-04. Flipped from RED `it.todo` stubs (Wave 0 contract)
 * to real assertions after the implementation of `@/src/server/services/research.service`.
 *
 * Target module: `@/src/server/services/research.service`
 *
 * Canonical source for R6 invariant: `src/server/services/feedback.service.ts` lines 139-162
 *
 * Exports under test:
 *   transitionResearch(researchItemId: string, toStatus: ResearchItemStatus,
 *                      actorId: string, meta?: Record<string, unknown>):
 *     Promise<ResearchItemRow & { previousStatus: string; newStatus: string }>
 *
 * R6 invariant (from feedback.service.ts): INSERT workflowTransitions BEFORE UPDATE researchItems.
 * If UPDATE fails mid-transition, the audit row survives and retry can recover.
 *
 * The vi.hoisted() mock on '@/src/db' tracks callOrder:
 *   ['select', 'insert:workflowTransitions', 'update:researchItems']
 * The R6 invariant check is: expect(insertIdx).toBeLessThan(updateIdx).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TRPCError } from '@trpc/server'
import { researchItems } from '@/src/db/schema/research'
import { workflowTransitions } from '@/src/db/schema/workflow'

// vi.hoisted() — shared state across the mock factory hoist boundary so each
// test can control selectRows, updateRows, and inspect callOrder.
const shared = vi.hoisted(() => {
  return {
    callOrder: [] as string[],
    selectRows: [] as unknown[],
    updateRows: [] as unknown[],
    insertValues: undefined as unknown,
    updateSetData: undefined as unknown,
  }
})

vi.mock('@/src/db', () => {
  // Drizzle chainable query builder mock.
  //   db.select().from(t).where(cond).limit(n) → Promise<selectRows>
  //   db.insert(t).values(v)                    → Promise<undefined>; records callOrder marker based on t
  //   db.update(t).set(v).where(cond).returning() → Promise<updateRows>; records callOrder marker based on t
  return {
    db: {
      select: () => {
        shared.callOrder.push('select')
        return {
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve(shared.selectRows),
            }),
          }),
        }
      },
      insert: (table: unknown) => {
        // Mark INSERT by the table being written. workflowTransitions is the
        // only INSERT target in transitionResearch, but identifying by ref
        // gives us the explicit R6 signal even if a future refactor adds more.
        const marker =
          table === workflowTransitions
            ? 'insert:workflowTransitions'
            : 'insert:unknown'
        shared.callOrder.push(marker)
        return {
          values: (v: unknown) => {
            shared.insertValues = v
            return Promise.resolve(undefined)
          },
        }
      },
      update: (table: unknown) => {
        const marker =
          table === researchItems
            ? 'update:researchItems'
            : 'update:unknown'
        shared.callOrder.push(marker)
        return {
          set: (v: unknown) => {
            shared.updateSetData = v
            return {
              where: () => ({
                returning: () => Promise.resolve(shared.updateRows),
              }),
            }
          },
        }
      },
    },
  }
})

// Import AFTER mocks (Phase 16+ pattern) — the mock factory must be hoisted
// and registered before the module under test resolves '@/src/db'.
import { transitionResearch } from '@/src/server/services/research.service'

beforeEach(() => {
  shared.callOrder = []
  shared.selectRows = []
  shared.updateRows = []
  shared.insertValues = undefined
  shared.updateSetData = undefined
})

describe('transitionResearch (RESEARCH-05 + R6 invariant) — from @/src/server/services/research.service', () => {
  it("exports transitionResearch function from '@/src/server/services/research.service' — import { transitionResearch } from '@/src/server/services/research.service'", () => {
    expect(typeof transitionResearch).toBe('function')
  })

  it("R6 invariant: 'insert:workflowTransitions' happens BEFORE 'update:researchItems' in callOrder — insertIdx = callOrder.indexOf('insert:workflowTransitions'), updateIdx = callOrder.indexOf('update:researchItems'), expect(insertIdx).toBeLessThan(updateIdx) — mirrors feedback.service.ts lines 139-162", async () => {
    shared.selectRows = [{ id: 'ri-1', status: 'draft' }]
    shared.updateRows = [{ id: 'ri-1', status: 'pending_review' }]

    await transitionResearch('ri-1', 'pending_review', 'actor-1')

    const insertIdx = shared.callOrder.indexOf('insert:workflowTransitions')
    const updateIdx = shared.callOrder.indexOf('update:researchItems')
    expect(insertIdx).toBeGreaterThanOrEqual(0)
    expect(updateIdx).toBeGreaterThanOrEqual(0)
    expect(insertIdx).toBeLessThan(updateIdx)
  })

  it("returns object with previousStatus ('draft') and newStatus ('pending_review') fields via Object.assign pattern — result.previousStatus and result.newStatus populated", async () => {
    shared.selectRows = [{ id: 'ri-1', status: 'draft' }]
    shared.updateRows = [{ id: 'ri-1', status: 'pending_review' }]

    const result = await transitionResearch('ri-1', 'pending_review', 'actor-1')
    expect(result.previousStatus).toBe('draft')
    expect(result.newStatus).toBe('pending_review')
  })

  it("when transitioning to 'published', updateData includes reviewedBy: actorId and reviewedAt: new Date() — review fields populated on approve path", async () => {
    shared.selectRows = [{ id: 'ri-1', status: 'pending_review' }]
    shared.updateRows = [{ id: 'ri-1', status: 'published', reviewedBy: 'actor-1' }]

    await transitionResearch('ri-1', 'published', 'actor-1')

    const set = shared.updateSetData as Record<string, unknown>
    expect(set.reviewedBy).toBe('actor-1')
    expect(set.reviewedAt).toBeInstanceOf(Date)
    expect(set.status).toBe('published')
  })

  it("when transitioning to 'retracted' with meta.retractionReason, updateData includes retractionReason — retractionReason guard on retract path", async () => {
    shared.selectRows = [{ id: 'ri-1', status: 'published' }]
    shared.updateRows = [{ id: 'ri-1', status: 'retracted' }]

    await transitionResearch('ri-1', 'retracted', 'actor-1', { retractionReason: 'Superseded by newer research' })

    const set = shared.updateSetData as Record<string, unknown>
    expect(set.retractionReason).toBe('Superseded by newer research')
    expect(set.status).toBe('retracted')
  })

  it("on invalid transition (e.g., draft -> published skipping pending_review), throws TRPCError BAD_REQUEST and does NOT 'insert:workflowTransitions' — assertValidTransition guard fires before INSERT", async () => {
    shared.selectRows = [{ id: 'ri-1', status: 'draft' }]
    shared.updateRows = []

    let thrown: unknown = null
    try {
      await transitionResearch('ri-1', 'published', 'actor-1')
    } catch (err) {
      thrown = err
    }

    expect(thrown).toBeInstanceOf(TRPCError)
    expect((thrown as TRPCError).code).toBe('BAD_REQUEST')
    expect(shared.callOrder).not.toContain('insert:workflowTransitions')
  })
})

describe('transitionResearch NOT_FOUND path (RESEARCH-05)', () => {
  it("throws TRPCError NOT_FOUND when initial SELECT on researchItems returns empty rows — first .select().from().where().limit() resolves []", async () => {
    shared.selectRows = []

    let thrown: unknown = null
    try {
      await transitionResearch('missing', 'pending_review', 'actor-1')
    } catch (err) {
      thrown = err
    }

    expect(thrown).toBeInstanceOf(TRPCError)
    expect((thrown as TRPCError).code).toBe('NOT_FOUND')
  })

  it("when row missing, does NOT write to workflowTransitions — NOT_FOUND guard fires before INSERT", async () => {
    shared.selectRows = []

    try {
      await transitionResearch('missing', 'pending_review', 'actor-1')
    } catch {
      // expected
    }

    expect(shared.callOrder).not.toContain('insert:workflowTransitions')
  })
})

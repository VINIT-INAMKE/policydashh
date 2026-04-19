/**
 * RED TDD stub for RESEARCH-05 — research lifecycle state machine contract
 *
 * Wave 0 contract lock for Phase 26 Plan 26-04. All tests here are `it.todo`
 * (pending) — they describe the behavior Plan 26-04 must make GREEN without
 * failing the test suite at Wave 0 time.
 *
 * Target module: `@/src/server/services/research.lifecycle` (does NOT yet exist at Wave 0)
 *
 * Expected exports:
 *   - VALID_TRANSITIONS: Record<ResearchItemStatus, ResearchItemStatus[]>
 *   - assertValidTransition(from, to): throws TRPCError BAD_REQUEST on invalid
 *   - type ResearchItemStatus = 'draft' | 'pending_review' | 'published' | 'retracted'
 *
 * Future RED assertions (Plan 26-04 will flip these to it() bodies):
 *   import {
 *     VALID_TRANSITIONS,
 *     assertValidTransition,
 *     type ResearchItemStatus,
 *   } from '@/src/server/services/research.lifecycle'
 *
 * Q3 moderation gate encoded: draft -> published is BLOCKED (must go through pending_review).
 * Reject path: pending_review -> draft returns the item to editable (reject returns to editable).
 * Terminal: retracted has empty transition list.
 * Immutability: published -> draft is BLOCKED (published is immutable — only retracted allowed).
 */

import { describe, it } from 'vitest'

// TRPCError + BAD_REQUEST references reserved for Plan 26-04 implementation tests.
// Referenced here so the RED contract's assertion surface is visible at Wave 0.
// TRPCError lives at '@trpc/server' and carries .code 'BAD_REQUEST' on invalid transitions.

describe('VALID_TRANSITIONS table (RESEARCH-05) — from @/src/server/services/research.lifecycle', () => {
  it.todo("VALID_TRANSITIONS.draft equals ['pending_review'] — submit is the only outbound edge from draft")
  it.todo("VALID_TRANSITIONS.pending_review equals ['published', 'draft'] — approve | reject returns to editable")
  it.todo("VALID_TRANSITIONS.published equals ['retracted'] — only retraction exits published")
  it.todo("VALID_TRANSITIONS.retracted equals [] — terminal state, no outbound transitions")
})

describe('assertValidTransition() valid paths (RESEARCH-05)', () => {
  it.todo("assertValidTransition('draft', 'pending_review') does NOT throw — submit path")
  it.todo("assertValidTransition('pending_review', 'published') does NOT throw — approve path")
  it.todo("assertValidTransition('pending_review', 'draft') does NOT throw — reject returns to editable")
  it.todo("assertValidTransition('published', 'retracted') does NOT throw — retract path")
})

describe('assertValidTransition() invalid paths (RESEARCH-05)', () => {
  it.todo("assertValidTransition('draft', 'published') throws TRPCError BAD_REQUEST — Q3 moderation gate, no self-publish, draft -> published blocked")
  it.todo("assertValidTransition('draft', 'retracted') throws TRPCError BAD_REQUEST — cannot retract unpublished item")
  it.todo("assertValidTransition('retracted', 'draft') throws TRPCError — terminal state cannot re-enter draft")
  it.todo("assertValidTransition('retracted', 'published') throws TRPCError — terminal state cannot re-publish")
  it.todo("assertValidTransition('published', 'draft') throws TRPCError BAD_REQUEST — published is immutable, published -> draft blocked")
  it.todo("assertValidTransition('pending_review', 'retracted') throws TRPCError BAD_REQUEST — must go through published first")
  it.todo("error message from assertValidTransition includes both 'from' state name and 'to' state name (contains 'draft' and 'published')")
})

describe('ResearchItemStatus type (RESEARCH-05)', () => {
  it.todo("type ResearchItemStatus can be used as union of 4 states: 'draft', 'pending_review', 'published', 'retracted'")
})

/**
 * GREEN assertions for RESEARCH-05 — research lifecycle state machine.
 *
 * Phase 26 Plan 26-04. Flipped from RED `it.todo` stubs (Wave 0 contract)
 * to real assertions after the implementation of `@/src/server/services/research.lifecycle`.
 *
 * Target module: `@/src/server/services/research.lifecycle`
 *
 * Exports under test:
 *   - VALID_TRANSITIONS: Record<ResearchItemStatus, ResearchItemStatus[]>
 *   - assertValidTransition(from, to): throws TRPCError BAD_REQUEST on invalid
 *   - type ResearchItemStatus = 'draft' | 'pending_review' | 'published' | 'retracted'
 *
 * Q3 moderation gate encoded: draft -> published is BLOCKED (must go through pending_review).
 * Reject path: pending_review -> draft returns the item to editable.
 * Terminal: retracted has empty transition list.
 * Immutability: published -> draft is BLOCKED (published is immutable — only retracted allowed).
 */

import { describe, it, expect } from 'vitest'
import { TRPCError } from '@trpc/server'
import {
  VALID_TRANSITIONS,
  assertValidTransition,
  type ResearchItemStatus,
} from '@/src/server/services/research.lifecycle'

describe('VALID_TRANSITIONS table (RESEARCH-05) — from @/src/server/services/research.lifecycle', () => {
  it("VALID_TRANSITIONS.draft equals ['pending_review'] — submit is the only outbound edge from draft", () => {
    expect(VALID_TRANSITIONS.draft).toEqual(['pending_review'])
  })

  it("VALID_TRANSITIONS.pending_review equals ['published', 'draft'] — approve | reject returns to editable", () => {
    expect(VALID_TRANSITIONS.pending_review).toEqual(['published', 'draft'])
  })

  it("VALID_TRANSITIONS.published equals ['retracted'] — only retraction exits published", () => {
    expect(VALID_TRANSITIONS.published).toEqual(['retracted'])
  })

  it("VALID_TRANSITIONS.retracted equals [] — terminal state, no outbound transitions", () => {
    expect(VALID_TRANSITIONS.retracted).toEqual([])
  })
})

describe('assertValidTransition() valid paths (RESEARCH-05)', () => {
  it("assertValidTransition('draft', 'pending_review') does NOT throw — submit path", () => {
    expect(() => assertValidTransition('draft', 'pending_review')).not.toThrow()
  })

  it("assertValidTransition('pending_review', 'published') does NOT throw — approve path", () => {
    expect(() => assertValidTransition('pending_review', 'published')).not.toThrow()
  })

  it("assertValidTransition('pending_review', 'draft') does NOT throw — reject returns to editable", () => {
    expect(() => assertValidTransition('pending_review', 'draft')).not.toThrow()
  })

  it("assertValidTransition('published', 'retracted') does NOT throw — retract path", () => {
    expect(() => assertValidTransition('published', 'retracted')).not.toThrow()
  })
})

describe('assertValidTransition() invalid paths (RESEARCH-05)', () => {
  it("assertValidTransition('draft', 'published') throws TRPCError BAD_REQUEST — Q3 moderation gate, no self-publish, draft -> published blocked", () => {
    try {
      assertValidTransition('draft', 'published')
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError)
      expect((err as TRPCError).code).toBe('BAD_REQUEST')
    }
  })

  it("assertValidTransition('draft', 'retracted') throws TRPCError BAD_REQUEST — cannot retract unpublished item", () => {
    try {
      assertValidTransition('draft', 'retracted')
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError)
      expect((err as TRPCError).code).toBe('BAD_REQUEST')
    }
  })

  it("assertValidTransition('retracted', 'draft') throws TRPCError — terminal state cannot re-enter draft", () => {
    expect(() => assertValidTransition('retracted', 'draft')).toThrow(TRPCError)
  })

  it("assertValidTransition('retracted', 'published') throws TRPCError — terminal state cannot re-publish", () => {
    expect(() => assertValidTransition('retracted', 'published')).toThrow(TRPCError)
  })

  it("assertValidTransition('published', 'draft') throws TRPCError BAD_REQUEST — published is immutable, published -> draft blocked", () => {
    try {
      assertValidTransition('published', 'draft')
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError)
      expect((err as TRPCError).code).toBe('BAD_REQUEST')
    }
  })

  it("assertValidTransition('pending_review', 'retracted') throws TRPCError BAD_REQUEST — must go through published first", () => {
    try {
      assertValidTransition('pending_review', 'retracted')
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError)
      expect((err as TRPCError).code).toBe('BAD_REQUEST')
    }
  })

  it("error message from assertValidTransition includes both 'from' state name and 'to' state name (contains 'draft' and 'published')", () => {
    try {
      assertValidTransition('draft', 'published')
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError)
      const msg = (err as TRPCError).message
      expect(msg).toContain('draft')
      expect(msg).toContain('published')
    }
  })
})

describe('ResearchItemStatus type (RESEARCH-05)', () => {
  it("type ResearchItemStatus can be used as union of 4 states: 'draft', 'pending_review', 'published', 'retracted'", () => {
    const states: ResearchItemStatus[] = ['draft', 'pending_review', 'published', 'retracted']
    expect(states).toHaveLength(4)
    // Compile-time verification — if any of these weren't assignable, tsc would fail
    expect(states).toContain('draft')
    expect(states).toContain('pending_review')
    expect(states).toContain('published')
    expect(states).toContain('retracted')
  })
})

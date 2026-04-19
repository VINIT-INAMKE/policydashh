import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { changeRequestMachine, type CRStatus } from '@/src/server/machines/changeRequest.machine'

describe('CR State Machine', () => {
  function createCRActor() {
    return createActor(changeRequestMachine, {
      input: {
        crId: 'test-cr-001',
        ownerId: 'user-001',
      },
    }).start()
  }

  describe('initial state', () => {
    it('starts in drafting state', () => {
      const actor = createCRActor()
      expect(actor.getSnapshot().value).toBe('drafting')
      actor.stop()
    })
  })

  describe('SUBMIT_FOR_REVIEW transition', () => {
    it('drafting -> in_review on SUBMIT_FOR_REVIEW', () => {
      const actor = createCRActor()
      actor.send({ type: 'SUBMIT_FOR_REVIEW' })
      expect(actor.getSnapshot().value).toBe('in_review')
      actor.stop()
    })
  })

  describe('APPROVE transition', () => {
    it('in_review -> approved on APPROVE (sets approverId)', () => {
      const actor = createCRActor()
      actor.send({ type: 'SUBMIT_FOR_REVIEW' })
      actor.send({ type: 'APPROVE', approverId: 'approver-001' })
      expect(actor.getSnapshot().value).toBe('approved')
      expect(actor.getSnapshot().context.approverId).toBe('approver-001')
      actor.stop()
    })
  })

  describe('MERGE transition', () => {
    it('approved -> merged on MERGE (sets mergedVersionId)', () => {
      const actor = createCRActor()
      actor.send({ type: 'SUBMIT_FOR_REVIEW' })
      actor.send({ type: 'APPROVE', approverId: 'approver-001' })
      actor.send({ type: 'MERGE', mergedVersionId: 'version-001' })
      expect(actor.getSnapshot().value).toBe('merged')
      expect(actor.getSnapshot().context.mergedVersionId).toBe('version-001')
      actor.stop()
    })
  })

  describe('REQUEST_CHANGES transition', () => {
    it('approved -> in_review on REQUEST_CHANGES with rationale', () => {
      const actor = createCRActor()
      actor.send({ type: 'SUBMIT_FOR_REVIEW' })
      actor.send({ type: 'APPROVE', approverId: 'approver-001' })
      actor.send({ type: 'REQUEST_CHANGES', rationale: 'Needs revisions to section 3 before merge' })
      expect(actor.getSnapshot().value).toBe('in_review')
      actor.stop()
    })
  })

  describe('CLOSE transition with rationale guard', () => {
    it('CLOSE from drafting with rationale -> closed (sets closureRationale)', () => {
      const actor = createCRActor()
      actor.send({ type: 'CLOSE', rationale: 'No longer needed for this policy cycle' })
      expect(actor.getSnapshot().value).toBe('closed')
      expect(actor.getSnapshot().context.closureRationale).toBe('No longer needed for this policy cycle')
      actor.stop()
    })

    it('CLOSE from in_review with rationale -> closed', () => {
      const actor = createCRActor()
      actor.send({ type: 'SUBMIT_FOR_REVIEW' })
      actor.send({ type: 'CLOSE', rationale: 'Superseded by another change request' })
      expect(actor.getSnapshot().value).toBe('closed')
      actor.stop()
    })

    it('CLOSE from approved with rationale -> closed', () => {
      const actor = createCRActor()
      actor.send({ type: 'SUBMIT_FOR_REVIEW' })
      actor.send({ type: 'APPROVE', approverId: 'approver-001' })
      actor.send({ type: 'CLOSE', rationale: 'Policy direction changed after review' })
      expect(actor.getSnapshot().value).toBe('closed')
      actor.stop()
    })

    it('CLOSE blocked without rationale (empty string stays in same state)', () => {
      const actor = createCRActor()
      actor.send({ type: 'CLOSE', rationale: '' })
      expect(actor.getSnapshot().value).toBe('drafting')
      actor.stop()
    })

    it('CLOSE blocked with whitespace-only rationale', () => {
      const actor = createCRActor()
      actor.send({ type: 'CLOSE', rationale: '   ' })
      expect(actor.getSnapshot().value).toBe('drafting')
      actor.stop()
    })
  })

  describe('invalid transitions', () => {
    it('MERGE blocked from drafting (stays in drafting)', () => {
      const actor = createCRActor()
      actor.send({ type: 'MERGE', mergedVersionId: 'version-001' })
      expect(actor.getSnapshot().value).toBe('drafting')
      actor.stop()
    })

    it('MERGE blocked from in_review (stays in in_review)', () => {
      const actor = createCRActor()
      actor.send({ type: 'SUBMIT_FOR_REVIEW' })
      actor.send({ type: 'MERGE', mergedVersionId: 'version-001' })
      expect(actor.getSnapshot().value).toBe('in_review')
      actor.stop()
    })
  })

  describe('final states', () => {
    it('merged is final state (status === done)', () => {
      const actor = createCRActor()
      actor.send({ type: 'SUBMIT_FOR_REVIEW' })
      actor.send({ type: 'APPROVE', approverId: 'approver-001' })
      actor.send({ type: 'MERGE', mergedVersionId: 'version-001' })
      expect(actor.getSnapshot().value).toBe('merged')
      expect(actor.getSnapshot().status).toBe('done')
      actor.stop()
    })

    it('closed is final state (status === done)', () => {
      const actor = createCRActor()
      actor.send({ type: 'CLOSE', rationale: 'No longer needed' })
      expect(actor.getSnapshot().value).toBe('closed')
      expect(actor.getSnapshot().status).toBe('done')
      actor.stop()
    })
  })

  describe('context updates', () => {
    it('sets approverId on APPROVE', () => {
      const actor = createCRActor()
      actor.send({ type: 'SUBMIT_FOR_REVIEW' })
      actor.send({ type: 'APPROVE', approverId: 'approver-002' })
      expect(actor.getSnapshot().context.approverId).toBe('approver-002')
      actor.stop()
    })

    it('sets mergedVersionId on MERGE', () => {
      const actor = createCRActor()
      actor.send({ type: 'SUBMIT_FOR_REVIEW' })
      actor.send({ type: 'APPROVE', approverId: 'approver-001' })
      actor.send({ type: 'MERGE', mergedVersionId: 'version-xyz' })
      expect(actor.getSnapshot().context.mergedVersionId).toBe('version-xyz')
      actor.stop()
    })

    it('sets closureRationale on CLOSE', () => {
      const actor = createCRActor()
      actor.send({ type: 'CLOSE', rationale: 'Duplicate of CR-002' })
      expect(actor.getSnapshot().context.closureRationale).toBe('Duplicate of CR-002')
      actor.stop()
    })
  })
})

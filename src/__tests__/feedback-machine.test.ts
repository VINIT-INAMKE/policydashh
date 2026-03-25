import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { feedbackMachine, type FeedbackStatus } from '@/src/server/machines/feedback.machine'

describe('Feedback State Machine', () => {
  function createFeedbackActor() {
    return createActor(feedbackMachine, {
      input: {
        feedbackId: 'test-fb-001',
        submitterId: 'user-001',
      },
    }).start()
  }

  describe('initial state', () => {
    it('starts in submitted state', () => {
      const actor = createFeedbackActor()
      expect(actor.getSnapshot().value).toBe('submitted')
      actor.stop()
    })
  })

  describe('START_REVIEW transition', () => {
    it('transitions from submitted to under_review', () => {
      const actor = createFeedbackActor()
      actor.send({ type: 'START_REVIEW', reviewerId: 'reviewer-001' })
      expect(actor.getSnapshot().value).toBe('under_review')
      actor.stop()
    })
  })

  describe('ACCEPT transition', () => {
    it('transitions from under_review to accepted with rationale', () => {
      const actor = createFeedbackActor()
      actor.send({ type: 'START_REVIEW', reviewerId: 'reviewer-001' })
      actor.send({ type: 'ACCEPT', rationale: 'Valid feedback that improves the policy', reviewerId: 'reviewer-001' })
      expect(actor.getSnapshot().value).toBe('accepted')
      actor.stop()
    })

    it('blocks ACCEPT without rationale (hasRationale guard)', () => {
      const actor = createFeedbackActor()
      actor.send({ type: 'START_REVIEW', reviewerId: 'reviewer-001' })
      actor.send({ type: 'ACCEPT', rationale: '', reviewerId: 'reviewer-001' })
      expect(actor.getSnapshot().value).toBe('under_review')
      actor.stop()
    })

    it('blocks ACCEPT with whitespace-only rationale', () => {
      const actor = createFeedbackActor()
      actor.send({ type: 'START_REVIEW', reviewerId: 'reviewer-001' })
      actor.send({ type: 'ACCEPT', rationale: '   ', reviewerId: 'reviewer-001' })
      expect(actor.getSnapshot().value).toBe('under_review')
      actor.stop()
    })
  })

  describe('PARTIALLY_ACCEPT transition', () => {
    it('transitions from under_review to partially_accepted with rationale', () => {
      const actor = createFeedbackActor()
      actor.send({ type: 'START_REVIEW', reviewerId: 'reviewer-001' })
      actor.send({ type: 'PARTIALLY_ACCEPT', rationale: 'Some parts are valid, others need revision', reviewerId: 'reviewer-001' })
      expect(actor.getSnapshot().value).toBe('partially_accepted')
      actor.stop()
    })
  })

  describe('REJECT transition', () => {
    it('transitions from under_review to rejected with rationale', () => {
      const actor = createFeedbackActor()
      actor.send({ type: 'START_REVIEW', reviewerId: 'reviewer-001' })
      actor.send({ type: 'REJECT', rationale: 'Out of scope for this policy version', reviewerId: 'reviewer-001' })
      expect(actor.getSnapshot().value).toBe('rejected')
      actor.stop()
    })

    it('blocks REJECT without rationale (hasRationale guard)', () => {
      const actor = createFeedbackActor()
      actor.send({ type: 'START_REVIEW', reviewerId: 'reviewer-001' })
      actor.send({ type: 'REJECT', rationale: '', reviewerId: 'reviewer-001' })
      expect(actor.getSnapshot().value).toBe('under_review')
      actor.stop()
    })
  })

  describe('CLOSE transition', () => {
    it('transitions from accepted to closed', () => {
      const actor = createFeedbackActor()
      actor.send({ type: 'START_REVIEW', reviewerId: 'reviewer-001' })
      actor.send({ type: 'ACCEPT', rationale: 'Good feedback', reviewerId: 'reviewer-001' })
      actor.send({ type: 'CLOSE' })
      expect(actor.getSnapshot().value).toBe('closed')
      actor.stop()
    })

    it('transitions from partially_accepted to closed', () => {
      const actor = createFeedbackActor()
      actor.send({ type: 'START_REVIEW', reviewerId: 'reviewer-001' })
      actor.send({ type: 'PARTIALLY_ACCEPT', rationale: 'Partially valid', reviewerId: 'reviewer-001' })
      actor.send({ type: 'CLOSE' })
      expect(actor.getSnapshot().value).toBe('closed')
      actor.stop()
    })

    it('transitions from rejected to closed', () => {
      const actor = createFeedbackActor()
      actor.send({ type: 'START_REVIEW', reviewerId: 'reviewer-001' })
      actor.send({ type: 'REJECT', rationale: 'Not applicable', reviewerId: 'reviewer-001' })
      actor.send({ type: 'CLOSE' })
      expect(actor.getSnapshot().value).toBe('closed')
      actor.stop()
    })
  })

  describe('closed is a final state', () => {
    it('no further transitions from closed', () => {
      const actor = createFeedbackActor()
      actor.send({ type: 'START_REVIEW', reviewerId: 'reviewer-001' })
      actor.send({ type: 'ACCEPT', rationale: 'Good feedback', reviewerId: 'reviewer-001' })
      actor.send({ type: 'CLOSE' })
      expect(actor.getSnapshot().value).toBe('closed')
      expect(actor.getSnapshot().status).toBe('done')
      actor.stop()
    })
  })

  describe('invalid transitions', () => {
    it('submitted -> accepted directly is rejected', () => {
      const actor = createFeedbackActor()
      actor.send({ type: 'ACCEPT', rationale: 'Try to skip review', reviewerId: 'reviewer-001' })
      expect(actor.getSnapshot().value).toBe('submitted')
      actor.stop()
    })

    it('submitted -> rejected directly is rejected', () => {
      const actor = createFeedbackActor()
      actor.send({ type: 'REJECT', rationale: 'Try to skip review', reviewerId: 'reviewer-001' })
      expect(actor.getSnapshot().value).toBe('submitted')
      actor.stop()
    })

    it('submitted -> closed directly is rejected', () => {
      const actor = createFeedbackActor()
      actor.send({ type: 'CLOSE' })
      expect(actor.getSnapshot().value).toBe('submitted')
      actor.stop()
    })

    it('under_review -> closed directly is rejected', () => {
      const actor = createFeedbackActor()
      actor.send({ type: 'START_REVIEW', reviewerId: 'reviewer-001' })
      actor.send({ type: 'CLOSE' })
      expect(actor.getSnapshot().value).toBe('under_review')
      actor.stop()
    })
  })

  describe('context updates', () => {
    it('sets reviewerId on START_REVIEW', () => {
      const actor = createFeedbackActor()
      actor.send({ type: 'START_REVIEW', reviewerId: 'reviewer-001' })
      expect(actor.getSnapshot().context.reviewerId).toBe('reviewer-001')
      actor.stop()
    })

    it('sets rationale on ACCEPT', () => {
      const actor = createFeedbackActor()
      actor.send({ type: 'START_REVIEW', reviewerId: 'reviewer-001' })
      actor.send({ type: 'ACCEPT', rationale: 'Valid feedback', reviewerId: 'reviewer-001' })
      expect(actor.getSnapshot().context.rationale).toBe('Valid feedback')
      actor.stop()
    })
  })
})

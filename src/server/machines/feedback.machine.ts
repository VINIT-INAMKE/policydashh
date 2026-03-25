import { setup, assign } from 'xstate'

export type FeedbackStatus =
  | 'submitted'
  | 'under_review'
  | 'accepted'
  | 'partially_accepted'
  | 'rejected'
  | 'closed'

export type FeedbackEvent =
  | { type: 'START_REVIEW'; reviewerId: string }
  | { type: 'ACCEPT'; rationale: string; reviewerId: string }
  | { type: 'PARTIALLY_ACCEPT'; rationale: string; reviewerId: string }
  | { type: 'REJECT'; rationale: string; reviewerId: string }
  | { type: 'CLOSE' }

export const feedbackMachine = setup({
  types: {
    context: {} as {
      feedbackId: string
      submitterId: string
      reviewerId: string | null
      rationale: string | null
    },
    input: {} as {
      feedbackId: string
      submitterId: string
    },
    events: {} as FeedbackEvent,
  },
  guards: {
    hasRationale: ({ event }) =>
      'rationale' in event && (event as { rationale: string }).rationale.trim().length > 0,
  },
  actions: {
    setReviewer: assign(({ event }) => ({
      reviewerId: 'reviewerId' in event ? (event as { reviewerId: string }).reviewerId : null,
    })),
    setRationale: assign(({ event }) => ({
      rationale: 'rationale' in event ? (event as { rationale: string }).rationale : null,
    })),
  },
}).createMachine({
  id: 'feedback',
  initial: 'submitted',
  context: ({ input }) => ({
    feedbackId: input.feedbackId,
    submitterId: input.submitterId,
    reviewerId: null,
    rationale: null,
  }),
  states: {
    submitted: {
      on: {
        START_REVIEW: {
          target: 'under_review',
          actions: 'setReviewer',
        },
      },
    },
    under_review: {
      on: {
        ACCEPT: {
          target: 'accepted',
          guard: 'hasRationale',
          actions: ['setReviewer', 'setRationale'],
        },
        PARTIALLY_ACCEPT: {
          target: 'partially_accepted',
          guard: 'hasRationale',
          actions: ['setReviewer', 'setRationale'],
        },
        REJECT: {
          target: 'rejected',
          guard: 'hasRationale',
          actions: ['setReviewer', 'setRationale'],
        },
      },
    },
    accepted:           { on: { CLOSE: 'closed' } },
    partially_accepted: { on: { CLOSE: 'closed' } },
    rejected:           { on: { CLOSE: 'closed' } },
    closed:             { type: 'final' },
  },
})

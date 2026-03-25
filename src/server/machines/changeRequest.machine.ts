import { setup, assign } from 'xstate'

export type CRStatus =
  | 'drafting'
  | 'in_review'
  | 'approved'
  | 'merged'
  | 'closed'

export type CREvent =
  | { type: 'SUBMIT_FOR_REVIEW' }
  | { type: 'APPROVE'; approverId: string }
  | { type: 'REQUEST_CHANGES' }
  | { type: 'MERGE'; mergedVersionId: string }
  | { type: 'CLOSE'; rationale: string }

export const changeRequestMachine = setup({
  types: {
    context: {} as {
      crId: string
      ownerId: string
      approverId: string | null
      mergedVersionId: string | null
      closureRationale: string | null
    },
    input: {} as {
      crId: string
      ownerId: string
    },
    events: {} as CREvent,
  },
  guards: {
    hasRationale: ({ event }) =>
      'rationale' in event && (event as { rationale: string }).rationale.trim().length > 0,
  },
  actions: {
    setApprover: assign(({ event }) => ({
      approverId: 'approverId' in event ? (event as { approverId: string }).approverId : null,
    })),
    setMergedVersion: assign(({ event }) => ({
      mergedVersionId: 'mergedVersionId' in event ? (event as { mergedVersionId: string }).mergedVersionId : null,
    })),
    setClosure: assign(({ event }) => ({
      closureRationale: 'rationale' in event ? (event as { rationale: string }).rationale : null,
    })),
  },
}).createMachine({
  id: 'changeRequest',
  initial: 'drafting',
  context: ({ input }) => ({
    crId: input.crId,
    ownerId: input.ownerId,
    approverId: null,
    mergedVersionId: null,
    closureRationale: null,
  }),
  states: {
    drafting: {
      on: {
        SUBMIT_FOR_REVIEW: { target: 'in_review' },
        CLOSE: {
          target: 'closed',
          guard: 'hasRationale',
          actions: 'setClosure',
        },
      },
    },
    in_review: {
      on: {
        APPROVE: {
          target: 'approved',
          actions: 'setApprover',
        },
        CLOSE: {
          target: 'closed',
          guard: 'hasRationale',
          actions: 'setClosure',
        },
      },
    },
    approved: {
      on: {
        MERGE: {
          target: 'merged',
          actions: 'setMergedVersion',
        },
        REQUEST_CHANGES: { target: 'in_review' },
        CLOSE: {
          target: 'closed',
          guard: 'hasRationale',
          actions: 'setClosure',
        },
      },
    },
    merged: { type: 'final' },
    closed: { type: 'final' },
  },
})

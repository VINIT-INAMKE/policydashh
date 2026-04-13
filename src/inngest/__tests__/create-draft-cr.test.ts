import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock() is hoisted to the top of the file, which means it runs BEFORE
// any top-level `const` declarations. To share mock functions between the
// factory and the test body, we must use `vi.hoisted()` so the allocations
// also get hoisted. See https://vitest.dev/api/vi.html#vi-mock.
const mocks = vi.hoisted(() => {
  return {
    executeMock: vi.fn(),
    transactionMock: vi.fn(),
  }
})

vi.mock('@/src/db', () => {
  return {
    db: {
      execute: mocks.executeMock,
      transaction: mocks.transactionMock,
    },
  }
})

import { createDraftCRFromFeedback } from '../lib/create-draft-cr'
// Imported purely so the mocked module surface is visible to the type
// checker — every assertion in the test body goes through `mocks.*`.
import { db } from '@/src/db'

const VALID_INPUT = {
  documentId: '00000000-0000-0000-0000-000000000001',
  sectionId: '00000000-0000-0000-0000-000000000002',
  feedbackId: '00000000-0000-0000-0000-000000000003',
  ownerId: '00000000-0000-0000-0000-000000000004',
  title: 'Draft CR for FB-007',
  description: 'Auto-generated draft CR from accepted feedback.',
}

/**
 * Build a fake tx object that records every insert/values/returning call
 * and returns a single-row array when .returning() is invoked on the
 * changeRequests insert. Subsequent .values() calls (for crFeedbackLinks
 * and crSectionLinks) resolve to void.
 */
function makeTx() {
  const calls: Array<{ table: unknown; values: unknown }> = []
  let insertCount = 0
  const tx = {
    insert: vi.fn((table: unknown) => {
      insertCount += 1
      const thisInsertIndex = insertCount
      return {
        values: vi.fn((values: unknown) => {
          calls.push({ table, values })
          // First insert is changeRequests and uses .returning()
          if (thisInsertIndex === 1) {
            return {
              returning: vi.fn(async () => [{ id: 'cr-uuid-generated' }]),
            }
          }
          // Subsequent inserts (links) resolve to void directly.
          return Promise.resolve()
        }),
      }
    }),
  }
  return { tx, calls }
}

describe('createDraftCRFromFeedback', () => {
  beforeEach(() => {
    mocks.executeMock.mockReset()
    mocks.transactionMock.mockReset()
    // Sanity-check that the mocked db module is the one under test.
    expect(db.execute).toBe(mocks.executeMock)
    expect(db.transaction).toBe(mocks.transactionMock)
  })

  it('allocates a CR-NNN readable id from cr_id_seq (seq=42 → CR-042)', async () => {
    mocks.executeMock.mockResolvedValueOnce({ rows: [{ seq: 42 }] })
    const { tx } = makeTx()
    mocks.transactionMock.mockImplementationOnce(
      async (cb: (tx: unknown) => Promise<unknown>) => {
        return await cb(tx)
      },
    )

    const result = await createDraftCRFromFeedback(VALID_INPUT)

    expect(mocks.executeMock).toHaveBeenCalledTimes(1)
    expect(result.readableId).toBe('CR-042')
  })

  it('inserts a changeRequests row plus crFeedbackLinks and crSectionLinks rows inside db.transaction', async () => {
    mocks.executeMock.mockResolvedValueOnce({ rows: [{ seq: 7 }] })
    const { tx, calls } = makeTx()
    mocks.transactionMock.mockImplementationOnce(
      async (cb: (tx: unknown) => Promise<unknown>) => {
        return await cb(tx)
      },
    )

    await createDraftCRFromFeedback(VALID_INPUT)

    expect(mocks.transactionMock).toHaveBeenCalledTimes(1)
    // Three inserts expected: changeRequests, crFeedbackLinks, crSectionLinks
    expect(tx.insert).toHaveBeenCalledTimes(3)
    expect(calls).toHaveLength(3)

    // The first insert values must carry the documentId, ownerId, title, description, readableId
    const crRow = calls[0].values as Record<string, unknown>
    expect(crRow.documentId).toBe(VALID_INPUT.documentId)
    expect(crRow.ownerId).toBe(VALID_INPUT.ownerId)
    expect(crRow.title).toBe(VALID_INPUT.title)
    expect(crRow.description).toBe(VALID_INPUT.description)
    expect(crRow.readableId).toBe('CR-007')

    // The two link rows must reference the inserted CR id ('cr-uuid-generated')
    const fbLink = calls[1].values as Record<string, unknown>
    expect(fbLink.crId).toBe('cr-uuid-generated')
    expect(fbLink.feedbackId).toBe(VALID_INPUT.feedbackId)

    const secLink = calls[2].values as Record<string, unknown>
    expect(secLink.crId).toBe('cr-uuid-generated')
    expect(secLink.sectionId).toBe(VALID_INPUT.sectionId)
  })

  it('returns { id, readableId } with id from the inserted changeRequests row', async () => {
    mocks.executeMock.mockResolvedValueOnce({ rows: [{ seq: 1 }] })
    const { tx } = makeTx()
    mocks.transactionMock.mockImplementationOnce(
      async (cb: (tx: unknown) => Promise<unknown>) => {
        return await cb(tx)
      },
    )

    const result = await createDraftCRFromFeedback(VALID_INPUT)

    expect(result).toEqual({
      id: 'cr-uuid-generated',
      readableId: 'CR-001',
    })
  })

  // Deferred to Plan 04 smoke deep-dive — the current implementation relies
  // on db.transaction rolling back on throw, but exercising that path
  // requires either an integration test or a more elaborate tx fake.
  it.todo('rolls back all three inserts if any step inside the transaction throws')
})

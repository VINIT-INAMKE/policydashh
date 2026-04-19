import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock() is hoisted to the top of the file, which means it runs BEFORE
// any top-level `const` declarations. To share mock functions between the
// factory and the test body, we must use `vi.hoisted()` so the allocations
// also get hoisted. See https://vitest.dev/api/vi.html#vi-mock.
const mocks = vi.hoisted(() => {
  return {
    executeMock: vi.fn(),
    selectMock: vi.fn(),
    insertMock: vi.fn(),
  }
})

vi.mock('@/src/db', () => {
  return {
    db: {
      execute: mocks.executeMock,
      select: mocks.selectMock,
      insert: mocks.insertMock,
    },
  }
})

import { createDraftCRFromFeedback } from '../lib/create-draft-cr'
// Imported purely so the mocked module surface is visible to the type
// checker - every assertion in the test body goes through `mocks.*`.
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
 * Build a fake select chain that returns `rows` when .limit() is awaited.
 * The neon-http driver exposes db.select().from().innerJoin().where().limit()
 * and createDraftCRFromFeedback uses exactly that chain for its idempotency
 * check.
 */
function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(async () => rows),
  }
  return chain
}

/**
 * Build a fake insert chain that captures every .values() call and lets
 * the test assert on the payloads. The first insert is changeRequests and
 * uses .returning(); the two link inserts use .onConflictDoNothing().
 */
function makeInsertBuilders() {
  const calls: Array<{ table: unknown; values: unknown }> = []
  let insertCount = 0
  const factory = vi.fn((table: unknown) => {
    insertCount += 1
    const thisInsertIndex = insertCount
    return {
      values: vi.fn((values: unknown) => {
        calls.push({ table, values })
        if (thisInsertIndex === 1) {
          // changeRequests - uses .returning()
          return {
            returning: vi.fn(async () => [{ id: 'cr-uuid-generated' }]),
          }
        }
        // link rows - use .onConflictDoNothing() which returns a thenable.
        return {
          onConflictDoNothing: vi.fn(async () => undefined),
        }
      }),
    }
  })
  return { factory, calls }
}

describe('createDraftCRFromFeedback', () => {
  beforeEach(() => {
    mocks.executeMock.mockReset()
    mocks.selectMock.mockReset()
    mocks.insertMock.mockReset()
    expect(db.execute).toBe(mocks.executeMock)
    expect(db.select).toBe(mocks.selectMock)
    expect(db.insert).toBe(mocks.insertMock)
  })

  it('allocates a CR-NNN readable id from cr_id_seq (seq=42 → CR-042)', async () => {
    mocks.selectMock.mockReturnValueOnce(makeSelectChain([]))
    mocks.executeMock.mockResolvedValueOnce({ rows: [{ seq: 42 }] })
    const { factory } = makeInsertBuilders()
    mocks.insertMock.mockImplementation(factory)

    const result = await createDraftCRFromFeedback(VALID_INPUT)

    expect(mocks.executeMock).toHaveBeenCalledTimes(1)
    expect(result.readableId).toBe('CR-042')
  })

  it('inserts a changeRequests row plus crFeedbackLinks and crSectionLinks via sequential writes', async () => {
    mocks.selectMock.mockReturnValueOnce(makeSelectChain([]))
    mocks.executeMock.mockResolvedValueOnce({ rows: [{ seq: 7 }] })
    const { factory, calls } = makeInsertBuilders()
    mocks.insertMock.mockImplementation(factory)

    await createDraftCRFromFeedback(VALID_INPUT)

    // Three sequential inserts: changeRequests, crFeedbackLinks, crSectionLinks.
    expect(factory).toHaveBeenCalledTimes(3)
    expect(calls).toHaveLength(3)

    const crRow = calls[0].values as Record<string, unknown>
    expect(crRow.documentId).toBe(VALID_INPUT.documentId)
    expect(crRow.ownerId).toBe(VALID_INPUT.ownerId)
    expect(crRow.title).toBe(VALID_INPUT.title)
    expect(crRow.description).toBe(VALID_INPUT.description)
    expect(crRow.readableId).toBe('CR-007')

    const fbLink = calls[1].values as Record<string, unknown>
    expect(fbLink.crId).toBe('cr-uuid-generated')
    expect(fbLink.feedbackId).toBe(VALID_INPUT.feedbackId)

    const secLink = calls[2].values as Record<string, unknown>
    expect(secLink.crId).toBe('cr-uuid-generated')
    expect(secLink.sectionId).toBe(VALID_INPUT.sectionId)
  })

  it('returns { id, readableId } with id from the inserted changeRequests row', async () => {
    mocks.selectMock.mockReturnValueOnce(makeSelectChain([]))
    mocks.executeMock.mockResolvedValueOnce({ rows: [{ seq: 1 }] })
    const { factory } = makeInsertBuilders()
    mocks.insertMock.mockImplementation(factory)

    const result = await createDraftCRFromFeedback(VALID_INPUT)

    expect(result).toEqual({
      id: 'cr-uuid-generated',
      readableId: 'CR-001',
    })
  })

  it('propagates sequence allocation failure before any insert runs', async () => {
    mocks.selectMock.mockReturnValueOnce(makeSelectChain([]))
    mocks.executeMock.mockRejectedValueOnce(
      new Error('relation "cr_id_seq" does not exist'),
    )

    await expect(createDraftCRFromFeedback(VALID_INPUT)).rejects.toThrow(
      /cr_id_seq/,
    )

    expect(mocks.executeMock).toHaveBeenCalledTimes(1)
    // Insert must NEVER fire on sequence failure.
    expect(mocks.insertMock).not.toHaveBeenCalled()
  })

  it('returns the existing CR when a draft already exists for this feedbackId (retry no-op)', async () => {
    // Simulate the idempotency guard finding a prior draft from an earlier
    // attempt. The function should short-circuit and NEVER touch the
    // sequence or insert builders.
    mocks.selectMock.mockReturnValueOnce(
      makeSelectChain([{ id: 'existing-cr-id', readableId: 'CR-099' }]),
    )

    const result = await createDraftCRFromFeedback(VALID_INPUT)

    expect(result).toEqual({ id: 'existing-cr-id', readableId: 'CR-099' })
    expect(mocks.executeMock).not.toHaveBeenCalled()
    expect(mocks.insertMock).not.toHaveBeenCalled()
  })

  it('propagates errors thrown inside a sequential insert (Inngest retry path)', async () => {
    mocks.selectMock.mockReturnValueOnce(makeSelectChain([]))
    mocks.executeMock.mockResolvedValueOnce({ rows: [{ seq: 99 }] })
    const insertSpy = vi.fn(() => {
      throw new Error('duplicate key value violates unique constraint')
    })
    mocks.insertMock.mockImplementation(insertSpy)

    await expect(createDraftCRFromFeedback(VALID_INPUT)).rejects.toThrow(
      /duplicate key value/,
    )

    expect(mocks.insertMock).toHaveBeenCalledTimes(1)
  })
})

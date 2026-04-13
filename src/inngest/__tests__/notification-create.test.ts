import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Wave 0 test scaffold for Plan 01 Task 01-02 (NOTIF-04, NOTIF-06).
 *
 * This file is RED until `sendNotificationCreate`,
 * `notificationCreateEvent`, and `computeNotificationIdempotencyKey` are
 * added to `src/inngest/events.ts`. The intent is to lock the contract
 * before Plan 01 runs so implementation is greening a fixed target.
 *
 * The inngest client is mocked so `sendNotificationCreate` can be exercised
 * without touching the real Inngest SDK or a network call.
 */

const mocks = vi.hoisted(() => ({
  sendMock: vi.fn(),
}))

vi.mock('../client', () => ({
  inngest: {
    send: mocks.sendMock,
  },
}))

import {
  sendNotificationCreate,
  computeNotificationIdempotencyKey,
} from '../events'

const VALID_PAYLOAD = {
  userId: '00000000-0000-0000-0000-000000000001',
  type: 'feedback_status_changed' as const,
  title: 'Feedback under review',
  body: 'Your feedback on "X" is now being reviewed.',
  entityType: 'feedback',
  entityId: '00000000-0000-0000-0000-000000000002',
  linkHref: '/feedback/00000000-0000-0000-0000-000000000002',
  createdBy: '00000000-0000-0000-0000-000000000003',
  action: 'startReview',
}

describe('sendNotificationCreate', () => {
  beforeEach(() => {
    mocks.sendMock.mockReset()
    mocks.sendMock.mockResolvedValue(undefined)
  })

  it('resolves and calls inngest.send exactly once for a valid payload', async () => {
    await expect(sendNotificationCreate(VALID_PAYLOAD)).resolves.toBeUndefined()
    expect(mocks.sendMock).toHaveBeenCalledTimes(1)
  })

  it('rejects with a Zod validation error when createdBy is missing (NOTIF-06 key field)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { createdBy: _omitted, ...payloadWithoutCreatedBy } = VALID_PAYLOAD
    await expect(
      // Cast is intentional — we want the runtime schema to reject this.
      sendNotificationCreate(payloadWithoutCreatedBy as unknown as typeof VALID_PAYLOAD),
    ).rejects.toThrow()
    expect(mocks.sendMock).not.toHaveBeenCalled()
  })

  it('rejects with a Zod validation error when action is missing', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { action: _omitted, ...payloadWithoutAction } = VALID_PAYLOAD
    await expect(
      sendNotificationCreate(payloadWithoutAction as unknown as typeof VALID_PAYLOAD),
    ).rejects.toThrow()
    expect(mocks.sendMock).not.toHaveBeenCalled()
  })

  it('rejects with a Zod validation error when type is not a known notification type', async () => {
    const invalidPayload = {
      ...VALID_PAYLOAD,
      type: 'invalid_type' as unknown as typeof VALID_PAYLOAD.type,
    }
    await expect(sendNotificationCreate(invalidPayload)).rejects.toThrow()
    expect(mocks.sendMock).not.toHaveBeenCalled()
  })
})

describe('computeNotificationIdempotencyKey', () => {
  it('returns the deterministic string ${createdBy}:${entityType}:${entityId}:${action}', () => {
    expect(
      computeNotificationIdempotencyKey({
        createdBy: 'u1',
        entityType: 'feedback',
        entityId: 'f1',
        action: 'startReview',
      }),
    ).toBe('u1:feedback:f1:startReview')
  })
})

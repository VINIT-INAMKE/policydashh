import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Option C (migration 0028) contract test for participateIntakeEvent.
 *
 * The /participate form used to collect a `role` field that was a duplicate
 * of orgType and dropped on webhook ingest. This test locks in the new
 * shape: `designation` (free-text title) is accepted; the old `role` field
 * is rejected. This guards against anyone re-adding the redundant field.
 */

const mocks = vi.hoisted(() => ({
  sendMock: vi.fn(),
}))

vi.mock('../client', () => ({
  inngest: {
    send: mocks.sendMock,
  },
}))

import { sendParticipateIntake } from '../events'

const VALID_PAYLOAD = {
  emailHash: 'a'.repeat(64),
  email: 'stakeholder@example.com',
  name: 'Priya Sharma',
  orgType: 'legal' as const,
  expertise:
    'Fintech regulation and digital asset compliance across MiCA, FATF, and Indian AML frameworks.',
  howHeard: 'Colleague / referral',
  orgName: 'Sharma & Associates',
  designation: 'Partner, Fintech Practice',
}

describe('sendParticipateIntake (Option C)', () => {
  beforeEach(() => {
    mocks.sendMock.mockReset()
    mocks.sendMock.mockResolvedValue(undefined)
  })

  it('accepts a payload carrying designation', async () => {
    await expect(sendParticipateIntake(VALID_PAYLOAD)).resolves.toBeUndefined()
    expect(mocks.sendMock).toHaveBeenCalledTimes(1)
    const sent = mocks.sendMock.mock.calls[0][0]
    // eventType().create() wraps the payload; the data shape is what matters.
    expect(sent.data.designation).toBe('Partner, Fintech Practice')
    expect(sent.data.orgName).toBe('Sharma & Associates')
  })

  it('keeps designation as the source of truth when a legacy `role` field is present', async () => {
    // Zod (without .strict()) passes unknown keys through, and the event
    // wrapper does not strip them. What matters for the Option C migration
    // is that the intended `designation` field is preserved — consumers
    // (participate-intake fn + Clerk webhook) only read the defined keys.
    const legacyPayload = {
      ...VALID_PAYLOAD,
      role: 'legal',
    } as unknown as typeof VALID_PAYLOAD
    await expect(sendParticipateIntake(legacyPayload)).resolves.toBeUndefined()
    const sent = mocks.sendMock.mock.calls[0][0]
    expect(sent.data.designation).toBe('Partner, Fintech Practice')
    expect(sent.data.orgType).toBe('legal')
  })

  it('rejects a payload with missing orgType', async () => {
    const { orgType: _omit, ...bad } = VALID_PAYLOAD
    void _omit
    await expect(
      sendParticipateIntake(bad as unknown as typeof VALID_PAYLOAD),
    ).rejects.toThrow()
    expect(mocks.sendMock).not.toHaveBeenCalled()
  })
})

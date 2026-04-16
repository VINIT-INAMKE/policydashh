import { describe, it, expect, vi } from 'vitest'

// These tests are RED stubs — they will fail until milestone-ready.ts is implemented in Plan 23-02.

describe('milestoneReadyFn (VERIFY-06)', () => {
  describe('5-step pipeline execution', () => {
    it.todo('compute-hash: loads milestone from DB and re-derives contentHash via hashMilestone')
    it.todo('persist-hash: sets status to anchoring and persists contentHash')
    it.todo('check-existing-tx: calls checkExistingAnchorTx with contentHash')
    it.todo('submit-tx: calls buildAndSubmitAnchorTx when no existing tx found')
    it.todo('confirm-loop: polls isTxConfirmed with unique step IDs per attempt')
  })

  describe('step ID uniqueness', () => {
    it.todo('each confirm-poll step ID includes the attempt counter')
    it.todo('each confirm-sleep step ID includes the attempt counter')
  })

  describe('idempotency (VERIFY-08)', () => {
    it.todo('skips submit-tx when check-existing-tx returns an existing txHash')
    it.todo('throws NonRetriableError when milestone status is already anchored')
    it.todo('throws NonRetriableError when milestone is not found')
  })

  describe('finalize', () => {
    it.todo('on confirmed: updates milestone with txHash, anchoredAt, status=anchored')
    it.todo('on timeout: writes MILESTONE_ANCHOR_FAIL audit log')
    it.todo('on timeout: sends admin notification via sendNotificationCreate')
  })

  describe('concurrency', () => {
    it.todo('uses concurrency key cardano-wallet with limit 1')
  })
})

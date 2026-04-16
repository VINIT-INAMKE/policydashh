import { describe, it, expect, vi } from 'vitest'

// These tests are RED stubs — they will fail until version-anchor.ts is implemented in Plan 23-02.

describe('versionAnchorFn (VERIFY-07)', () => {
  describe('trigger', () => {
    it.todo('triggers on version.published event')
    it.todo('uses concurrency key cardano-wallet with limit 1')
  })

  describe('compute-hash step', () => {
    it.todo('loads version from DB by event.data.versionId')
    it.todo('throws NonRetriableError when version not found')
    it.todo('throws NonRetriableError when version already has txHash')
    it.todo('computes hash via hashPolicyVersion')
  })

  describe('anchor step', () => {
    it.todo('calls checkExistingAnchorTx before submitting')
    it.todo('reuses existing txHash when Blockfrost pre-check finds match')
    it.todo('calls buildAndSubmitAnchorTx with type=version metadata when no existing tx')
  })

  describe('confirm-and-persist step', () => {
    it.todo('polls isTxConfirmed with unique step IDs per attempt')
    it.todo('on confirmed: updates documentVersions with txHash and anchoredAt')
  })
})

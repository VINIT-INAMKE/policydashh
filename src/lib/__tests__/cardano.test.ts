import { describe, it, expect, vi, beforeEach } from 'vitest'

// These tests are RED stubs — they will fail until src/lib/cardano.ts is implemented in Plan 23-01.
// Each test.todo describes the expected behavior contract.

describe('src/lib/cardano.ts (VERIFY-06, VERIFY-08)', () => {
  describe('requireEnv validation', () => {
    it.todo('throws when BLOCKFROST_PROJECT_ID is missing')
    it.todo('throws when CARDANO_WALLET_MNEMONIC is missing')
    it.todo('throws when BLOCKFROST_PROJECT_ID does not start with "preview"')
  })

  describe('getWallet', () => {
    it.todo('returns a MeshCardanoHeadlessWallet instance with networkId 0')
    it.todo('caches wallet across multiple calls (lazy singleton)')
  })

  describe('buildAndSubmitAnchorTx (VERIFY-06)', () => {
    it.todo('builds tx with CIP-10 label 674 metadata containing project, type, hash, timestamp')
    it.todo('signs tx with wallet and submits via provider')
    it.todo('returns 64-char hex txHash string')
  })

  describe('checkExistingAnchorTx (VERIFY-08)', () => {
    it.todo('returns txHash string when matching contentHash found in label 674 metadata')
    it.todo('returns null when no matching contentHash found')
    it.todo('paginates through metadata results until exhausted')
  })

  describe('isTxConfirmed', () => {
    it.todo('returns true when provider.fetchTxInfo returns non-null')
    it.todo('returns false when provider.fetchTxInfo throws')
  })
})

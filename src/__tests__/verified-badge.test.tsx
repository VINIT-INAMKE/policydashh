import { describe, it, expect } from 'vitest'

// These tests are RED stubs - they will fail until verified-badge.tsx is implemented in Plan 23-03.

describe('VerifiedBadge (VERIFY-09)', () => {
  describe('rendering', () => {
    it.todo('renders ShieldCheck icon and "Verified" text when txHash is provided')
    it.todo('renders nothing (null) when txHash is null')
    it.todo('renders nothing (null) when txHash is undefined')
  })

  describe('Cardanoscan link (D-10)', () => {
    it.todo('links to https://preview.cardanoscan.io/transaction/{txHash}')
    it.todo('opens in new tab with target="_blank" rel="noopener noreferrer"')
    it.todo('has aria-label "Verified on Cardano -- view transaction"')
  })

  describe('styling', () => {
    it.todo('uses status-cr-merged color variables for indigo treatment')
    it.todo('has rounded-full pill shape')
  })
})

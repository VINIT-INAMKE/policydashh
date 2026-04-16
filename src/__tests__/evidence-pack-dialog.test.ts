/**
 * @vitest-environment jsdom
 *
 * Wave 0 RED contract for EV-07 - EvidencePackDialog async flow.
 *
 * Targets the dialog rewrite shipped in Plan 18-02. The current dialog uses
 * a synchronous fetch() + blob download path; Plan 18-02 will:
 *
 *   - Replace fetch() with trpc.evidence.requestExport.useMutation()
 *   - Widen ExportState to: 'idle' | 'queued' | 'error' (drop 'complete')
 *   - Remove the `<a download>` link and replace with a "queued" confirmation
 *
 * jest-dom is not installed in this repo (only @testing-library/react +
 * @testing-library/dom), so assertions use plain DOM queries that throw on
 * miss (`screen.getByText`) or boolean checks via `document.querySelectorAll`.
 *
 * The dialog component path is loaded via Pattern 2 variable-path dynamic
 * import - at Wave 0 the rewrite has not landed, but the original module
 * does export `EvidencePackDialog`, so `beforeAll` resolves; the assertions
 * fail because the original component still uses fetch() and renders the
 * `<a download>` complete state.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import React from 'react'

const mutateMock = vi.fn()
const useMutationMock = vi.fn(() => ({
  mutate: mutateMock,
  mutateAsync: vi.fn(),
  isLoading: false,
  isPending: false,
  isError: false,
  isSuccess: false,
  error: null,
  data: null,
  reset: vi.fn(),
}))

vi.mock('@/src/trpc/client', () => ({
  trpc: {
    document: {
      list: {
        useQuery: () => ({
          data: [{ id: 'doc-1', title: 'Test Policy' }],
          isLoading: false,
        }),
      },
    },
    evidence: {
      requestExport: {
        useMutation: useMutationMock,
      },
    },
  },
}))

let EvidencePackDialog: any

beforeAll(async () => {
  // Pattern 2: variable-path dynamic import. The component already exists at
  // this path, but its current source body fails the assertions (it uses
  // fetch() + a download link rather than the trpc mutation + queued state).
  // The import resolves fine; the assertions go RED.
  const path = ['@', 'app', '(workspace)', 'audit', '_components', 'evidence-pack-dialog'].join('/')
  try {
    const mod = await import(/* @vite-ignore */ path)
    EvidencePackDialog = mod.EvidencePackDialog
  } catch (err) {
    EvidencePackDialog = undefined
    // eslint-disable-next-line no-console
    console.warn('[evidence-pack-dialog.test] dialog module load failed:', (err as Error).message)
  }
})

beforeEach(() => {
  cleanup()
  mutateMock.mockClear()
  useMutationMock.mockReset()
  useMutationMock.mockImplementation(() => ({
    mutate: mutateMock,
    mutateAsync: vi.fn(),
    isLoading: false,
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    data: null,
    reset: vi.fn(),
  }))
})

describe('EvidencePackDialog - async flow (EV-07)', () => {
  it('fires trpc.evidence.requestExport.mutate with { documentId } on Export click', async () => {
    expect(EvidencePackDialog).toBeDefined()
    render(React.createElement(EvidencePackDialog))
    // Open the dialog via the trigger button.
    fireEvent.click(screen.getByRole('button', { name: /export evidence pack/i }))
    // Click the Export action button (label may vary slightly across the
    // rewrite; accept either "Export Pack" or "Export ZIP").
    const exportBtn = screen.getByRole('button', {
      name: /export (pack|zip)/i,
    })
    fireEvent.click(exportBtn)
    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith({ documentId: 'doc-1' })
    })
  })

  it('shows queued confirmation and renders NO <a download> after mutation resolves', async () => {
    expect(EvidencePackDialog).toBeDefined()
    useMutationMock.mockReturnValue({
      mutate: mutateMock,
      mutateAsync: vi.fn(),
      data: { status: 'queued' },
      isSuccess: true,
      isLoading: false,
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as any)
    render(React.createElement(EvidencePackDialog))
    fireEvent.click(screen.getByRole('button', { name: /export evidence pack/i }))
    // Queued confirmation copy - accept several phrasings the implementation
    // may pick.
    const queuedNode = screen.getByText(
      /being generated|you'?ll get an email|queued|on its way/i,
    )
    expect(queuedNode).toBeTruthy()
    // No download anchor in the DOM.
    const downloadLinks = document.querySelectorAll('a[download]')
    expect(downloadLinks.length).toBe(0)
  })

  it('shows error message + Retry button on mutation error', async () => {
    expect(EvidencePackDialog).toBeDefined()
    useMutationMock.mockReturnValue({
      mutate: mutateMock,
      mutateAsync: vi.fn(),
      data: null,
      isSuccess: false,
      isLoading: false,
      isPending: false,
      isError: true,
      error: new Error('boom'),
      reset: vi.fn(),
    } as any)
    render(React.createElement(EvidencePackDialog))
    fireEvent.click(screen.getByRole('button', { name: /export evidence pack/i }))
    const errorNode = screen.getByText(/boom|export failed/i)
    expect(errorNode).toBeTruthy()
    const retryBtn = screen.getByRole('button', { name: /retry/i })
    expect(retryBtn).toBeTruthy()
  })
})

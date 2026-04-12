/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import React from 'react'

// --- Mocks ---------------------------------------------------------------
const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

// Mock next/dynamic so BlockEditor / ReadOnlyEditor are stubbed and no
// actual editor code runs under jsdom.
vi.mock('next/dynamic', () => ({
  default: () => {
    const Stub = () => React.createElement('div', { 'data-testid': 'editor-stub' })
    Stub.displayName = 'DynamicStub'
    return Stub
  },
}))

// SectionAssignments has its own trpc dependencies -- stub it.
vi.mock(
  '@/app/(workspace)/policies/[id]/_components/section-assignments',
  () => ({
    SectionAssignments: () =>
      React.createElement('div', { 'data-testid': 'section-assignments-stub' }),
  }),
)

// Mock trpc client -- we drive the role via a module-level variable.
let mockRole: string | undefined = 'stakeholder'
vi.mock('@/src/trpc/client', () => ({
  trpc: {
    user: {
      getMe: {
        useQuery: () => ({ data: { id: 'u-1', role: mockRole } }),
      },
    },
  },
}))

// Import under test AFTER mocks.
import { SectionContentView } from '@/app/(workspace)/policies/[id]/_components/section-content-view'

const baseSection = {
  id: 'sec-1',
  title: 'Section One',
  content: null,
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('SectionContentView -- Give Feedback button', () => {
  beforeEach(() => {
    pushMock.mockClear()
    cleanup()
  })

  it('renders the Give Feedback button for stakeholder role', () => {
    mockRole = 'stakeholder'
    render(
      <SectionContentView section={baseSection} canEdit={false} documentId="doc-1" />,
    )
    expect(
      screen.getByRole('button', { name: /give feedback/i }),
    ).toBeDefined()
  })

  it('renders the Give Feedback button for research_lead role', () => {
    mockRole = 'research_lead'
    render(
      <SectionContentView section={baseSection} canEdit={false} documentId="doc-1" />,
    )
    expect(
      screen.getByRole('button', { name: /give feedback/i }),
    ).toBeDefined()
  })

  it('renders the Give Feedback button for workshop_moderator role', () => {
    mockRole = 'workshop_moderator'
    render(
      <SectionContentView section={baseSection} canEdit={false} documentId="doc-1" />,
    )
    expect(
      screen.getByRole('button', { name: /give feedback/i }),
    ).toBeDefined()
  })

  it('does NOT render the Give Feedback button for auditor role', () => {
    mockRole = 'auditor'
    render(
      <SectionContentView section={baseSection} canEdit={false} documentId="doc-1" />,
    )
    expect(
      screen.queryByRole('button', { name: /give feedback/i }),
    ).toBeNull()
  })

  it('does NOT render the Give Feedback button for observer role', () => {
    mockRole = 'observer'
    render(
      <SectionContentView section={baseSection} canEdit={false} documentId="doc-1" />,
    )
    expect(
      screen.queryByRole('button', { name: /give feedback/i }),
    ).toBeNull()
  })

  it('does NOT render the Give Feedback button for admin role (admin lacks feedback:submit)', () => {
    mockRole = 'admin'
    render(
      <SectionContentView section={baseSection} canEdit={false} documentId="doc-1" />,
    )
    expect(
      screen.queryByRole('button', { name: /give feedback/i }),
    ).toBeNull()
  })

  it('navigates to the feedback/new route on click', () => {
    mockRole = 'stakeholder'
    render(
      <SectionContentView section={baseSection} canEdit={false} documentId="doc-1" />,
    )
    fireEvent.click(screen.getByRole('button', { name: /give feedback/i }))
    expect(pushMock).toHaveBeenCalledWith(
      '/policies/doc-1/sections/sec-1/feedback/new',
    )
  })
})

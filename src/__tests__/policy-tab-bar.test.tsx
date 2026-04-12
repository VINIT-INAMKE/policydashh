import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import React from 'react'

// --- Mocks -----------------------------------------------------------------

// Mock next/navigation.usePathname — configurable per test
let __mockPathname = '/'
vi.mock('next/navigation', () => ({
  usePathname: () => __mockPathname,
}))

// Mock next/link to a plain anchor so we can assert href/aria-current
// without a Next.js router context.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: any) =>
    React.createElement('a', { href, ...rest }, children),
}))

// Import the component AFTER mocks are declared
import { PolicyTabBar } from '@/app/(workspace)/policies/[id]/_components/policy-tab-bar'

const POLICY_ID = '11111111-1111-1111-1111-111111111111'

function setPathname(p: string) {
  __mockPathname = p
}

beforeEach(() => {
  cleanup()
  __mockPathname = '/'
})

describe('PolicyTabBar', () => {
  it('renders all 5 tabs in order when admin (canViewCR + canViewTrace = true)', () => {
    setPathname(`/policies/${POLICY_ID}`)
    render(
      <PolicyTabBar
        documentId={POLICY_ID}
        canViewCR={true}
        canViewTrace={true}
      />
    )
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(5)
    expect(links[0]).toHaveTextContent('Content')
    expect(links[1]).toHaveTextContent('Feedback')
    expect(links[2]).toHaveTextContent('Change Requests')
    expect(links[3]).toHaveTextContent('Versions')
    expect(links[4]).toHaveTextContent('Traceability')
  })

  it('hides Change Requests and Traceability for stakeholder (canViewCR=false, canViewTrace=false)', () => {
    setPathname(`/policies/${POLICY_ID}`)
    render(
      <PolicyTabBar
        documentId={POLICY_ID}
        canViewCR={false}
        canViewTrace={false}
      />
    )
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(3)
    const labels = links.map((l) => l.textContent)
    expect(labels).toEqual(['Content', 'Feedback', 'Versions'])
    // Assert absent from DOM entirely (not hidden via css)
    expect(screen.queryByText('Change Requests')).toBeNull()
    expect(screen.queryByText('Traceability')).toBeNull()
  })

  it('marks Content tab active with aria-current="page" on exact /policies/{id} match', () => {
    setPathname(`/policies/${POLICY_ID}`)
    render(
      <PolicyTabBar
        documentId={POLICY_ID}
        canViewCR={true}
        canViewTrace={true}
      />
    )
    const contentLink = screen.getByRole('link', { name: 'Content' })
    expect(contentLink).toHaveAttribute('aria-current', 'page')
    // Other tabs should NOT have aria-current
    const feedbackLink = screen.getByRole('link', { name: 'Feedback' })
    expect(feedbackLink).not.toHaveAttribute('aria-current')
  })

  it('marks Feedback tab active on /policies/{id}/feedback', () => {
    setPathname(`/policies/${POLICY_ID}/feedback`)
    render(
      <PolicyTabBar
        documentId={POLICY_ID}
        canViewCR={true}
        canViewTrace={true}
      />
    )
    const feedbackLink = screen.getByRole('link', { name: 'Feedback' })
    expect(feedbackLink).toHaveAttribute('aria-current', 'page')
    const contentLink = screen.getByRole('link', { name: 'Content' })
    expect(contentLink).not.toHaveAttribute('aria-current')
  })

  it('marks Change Requests active on nested /policies/{id}/change-requests/new (startsWith match)', () => {
    setPathname(`/policies/${POLICY_ID}/change-requests/new`)
    render(
      <PolicyTabBar
        documentId={POLICY_ID}
        canViewCR={true}
        canViewTrace={true}
      />
    )
    const crLink = screen.getByRole('link', { name: 'Change Requests' })
    expect(crLink).toHaveAttribute('aria-current', 'page')
    const contentLink = screen.getByRole('link', { name: 'Content' })
    expect(contentLink).not.toHaveAttribute('aria-current')
  })
})

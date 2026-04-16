import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
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
  it('renders all 6 tabs in order when admin (canViewCR + canViewTrace + canViewMilestones = true)', () => {
    setPathname(`/policies/${POLICY_ID}`)
    render(
      <PolicyTabBar
        documentId={POLICY_ID}
        canViewCR={true}
        canViewTrace={true}
        canViewMilestones={true}
      />
    )
    const links = screen.getAllByRole('link')
    expect(links.length).toBe(6)
    expect(links[0].textContent).toBe('Content')
    expect(links[1].textContent).toBe('Feedback')
    expect(links[2].textContent).toBe('Change Requests')
    expect(links[3].textContent).toBe('Versions')
    expect(links[4].textContent).toBe('Milestones')
    expect(links[5].textContent).toBe('Traceability')
  })

  it('hides Change Requests and Traceability for stakeholder (canViewCR=false, canViewTrace=false)', () => {
    setPathname(`/policies/${POLICY_ID}`)
    render(
      <PolicyTabBar
        documentId={POLICY_ID}
        canViewCR={false}
        canViewTrace={false}
        canViewMilestones={false}
      />
    )
    const links = screen.getAllByRole('link')
    expect(links.length).toBe(3)
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
        canViewMilestones={true}
      />
    )
    const contentLink = screen.getByRole('link', { name: 'Content' })
    expect(contentLink.getAttribute('aria-current')).toBe('page')
    // Other tabs should NOT have aria-current
    const feedbackLink = screen.getByRole('link', { name: 'Feedback' })
    expect(feedbackLink.getAttribute('aria-current')).toBeNull()
  })

  it('marks Feedback tab active on /policies/{id}/feedback', () => {
    setPathname(`/policies/${POLICY_ID}/feedback`)
    render(
      <PolicyTabBar
        documentId={POLICY_ID}
        canViewCR={true}
        canViewTrace={true}
        canViewMilestones={true}
      />
    )
    const feedbackLink = screen.getByRole('link', { name: 'Feedback' })
    expect(feedbackLink.getAttribute('aria-current')).toBe('page')
    const contentLink = screen.getByRole('link', { name: 'Content' })
    expect(contentLink.getAttribute('aria-current')).toBeNull()
  })

  it('marks Change Requests active on nested /policies/{id}/change-requests/new (startsWith match)', () => {
    setPathname(`/policies/${POLICY_ID}/change-requests/new`)
    render(
      <PolicyTabBar
        documentId={POLICY_ID}
        canViewCR={true}
        canViewTrace={true}
        canViewMilestones={true}
      />
    )
    const crLink = screen.getByRole('link', { name: 'Change Requests' })
    expect(crLink.getAttribute('aria-current')).toBe('page')
    const contentLink = screen.getByRole('link', { name: 'Content' })
    expect(contentLink.getAttribute('aria-current')).toBeNull()
  })
})

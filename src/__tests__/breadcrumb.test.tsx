import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'

// --- Mocks -----------------------------------------------------------------

// Mock next/navigation.usePathname - configurable per test via __setPathname
let __mockPathname = '/'
vi.mock('next/navigation', () => ({
  usePathname: () => __mockPathname,
}))

// Mock next/link to a plain anchor so we can assert href without a router
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: any) =>
    React.createElement('a', { href, ...rest }, children),
}))

// Mock the tRPC client - configurable per test via __setDocumentQuery / __setWorkshopQuery
type QueryResult = { data: any; isLoading: boolean }
let __documentQuery: QueryResult = { data: undefined, isLoading: true }
let __workshopQuery: QueryResult = { data: undefined, isLoading: true }
vi.mock('@/src/trpc/client', () => ({
  trpc: {
    document: {
      getById: {
        useQuery: (_input: any, _opts?: any) => __documentQuery,
      },
    },
    workshop: {
      getById: {
        useQuery: (_input: any, _opts?: any) => __workshopQuery,
      },
    },
  },
}))

function setPathname(p: string) {
  __mockPathname = p
}
function setDocumentQuery(q: QueryResult) {
  __documentQuery = q
}
function setWorkshopQuery(q: QueryResult) {
  __workshopQuery = q
}

// Import the component AFTER mocks are declared
import { Breadcrumb } from '@/app/_components/breadcrumb'

const POLICY_UUID = '11111111-1111-1111-1111-111111111111'
const WORKSHOP_UUID = '22222222-2222-2222-2222-222222222222'

beforeEach(() => {
  cleanup()
  __mockPathname = '/'
  __documentQuery = { data: undefined, isLoading: true }
  __workshopQuery = { data: undefined, isLoading: true }
})

describe('<Breadcrumb />', () => {
  it('at /policies renders a single "Policies" current-page crumb with no chevron', () => {
    setPathname('/policies')
    const { container } = render(<Breadcrumb />)
    const items = container.querySelectorAll('li')
    // Only one <li>, no chevron separator
    expect(items.length).toBe(1)
    const current = screen.getByText('Policies')
    expect(current.getAttribute('aria-current')).toBe('page')
    // Should not be a link
    expect(current.tagName.toLowerCase()).not.toBe('a')
    // No ChevronRight rendered (svg)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('at /policies/{uuid} renders "Policies" link + ChevronRight + Skeleton while loading', () => {
    setPathname(`/policies/${POLICY_UUID}`)
    setDocumentQuery({ data: undefined, isLoading: true })
    const { container } = render(<Breadcrumb />)

    // "Policies" rendered as a link to /policies
    const policiesLink = screen.getByText('Policies') as HTMLAnchorElement
    expect(policiesLink.tagName.toLowerCase()).toBe('a')
    expect(policiesLink.getAttribute('href')).toBe('/policies')

    // A chevron separator (svg) is present
    expect(container.querySelector('svg')).not.toBeNull()

    // A skeleton placeholder for the loading policy title
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull()
  })

  it('at /policies/{uuid} with loaded data renders the policy title as current page', () => {
    setPathname(`/policies/${POLICY_UUID}`)
    setDocumentQuery({ data: { id: POLICY_UUID, title: 'Digital Economy Policy' }, isLoading: false })
    render(<Breadcrumb />)
    const current = screen.getByText('Digital Economy Policy')
    expect(current.getAttribute('aria-current')).toBe('page')
    expect(current.tagName.toLowerCase()).not.toBe('a')
  })

  it('at /policies/{uuid}/feedback renders 3 crumbs: Policies (link), title (link), Feedback (current)', () => {
    setPathname(`/policies/${POLICY_UUID}/feedback`)
    setDocumentQuery({ data: { id: POLICY_UUID, title: 'Digital Economy Policy' }, isLoading: false })
    const { container } = render(<Breadcrumb />)
    const items = container.querySelectorAll('li')
    // Count only crumb <li>s (exclude separator <li>s which contain svg)
    const crumbItems = Array.from(items).filter((li) => !li.querySelector('svg'))
    expect(crumbItems.length).toBe(3)

    const policiesLink = screen.getByText('Policies') as HTMLAnchorElement
    expect(policiesLink.tagName.toLowerCase()).toBe('a')
    expect(policiesLink.getAttribute('href')).toBe('/policies')

    const titleLink = screen.getByText('Digital Economy Policy') as HTMLAnchorElement
    expect(titleLink.tagName.toLowerCase()).toBe('a')
    expect(titleLink.getAttribute('href')).toBe(`/policies/${POLICY_UUID}`)

    const feedback = screen.getByText('Feedback')
    expect(feedback.getAttribute('aria-current')).toBe('page')
    expect(feedback.tagName.toLowerCase()).not.toBe('a')
  })

  it('uses "Change Requests" label (with space) for change-requests route segment', () => {
    setPathname(`/policies/${POLICY_UUID}/change-requests`)
    setDocumentQuery({ data: { id: POLICY_UUID, title: 'Policy X' }, isLoading: false })
    render(<Breadcrumb />)
    const crumb = screen.getByText('Change Requests')
    expect(crumb.getAttribute('aria-current')).toBe('page')
  })

  it('at /workshop-manage renders a single "Workshops" current-page crumb', () => {
    setPathname('/workshop-manage')
    const { container } = render(<Breadcrumb />)
    const items = container.querySelectorAll('li')
    expect(items.length).toBe(1)
    const current = screen.getByText('Workshops')
    expect(current.getAttribute('aria-current')).toBe('page')
  })

  it('at /dashboard renders a single "Dashboard" current-page crumb', () => {
    setPathname('/dashboard')
    render(<Breadcrumb />)
    const current = screen.getByText('Dashboard')
    expect(current.getAttribute('aria-current')).toBe('page')
  })

  it('nav element has aria-label="Breadcrumb" and current page has aria-current="page"', () => {
    setPathname(`/workshop-manage/${WORKSHOP_UUID}`)
    setWorkshopQuery({ data: { id: WORKSHOP_UUID, title: 'Stakeholder Workshop' }, isLoading: false })
    const { container } = render(<Breadcrumb />)
    const nav = container.querySelector('nav')
    expect(nav).not.toBeNull()
    expect(nav!.getAttribute('aria-label')).toBe('Breadcrumb')
    const current = screen.getByText('Stakeholder Workshop')
    expect(current.getAttribute('aria-current')).toBe('page')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'

// --- Mocks -----------------------------------------------------------------

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: any) =>
    React.createElement('a', { href, ...rest }, children),
}))

// Import AFTER mocks
import { WorkspaceNav } from '@/app/_components/workspace-nav'

beforeEach(() => {
  cleanup()
})

function getLinkLabels(): string[] {
  return screen.getAllByRole('link').map((el) => el.textContent ?? '')
}

function getLinkHrefs(): string[] {
  return screen.getAllByRole('link').map((el) => el.getAttribute('href') ?? '')
}

describe('WorkspaceNav', () => {
  it('renders admin nav in canonical D-14 order: Dashboard, Policies, Feedback, Workshops, Users, Audit', () => {
    render(<WorkspaceNav userRole="admin" />)
    expect(getLinkLabels()).toEqual([
      'Dashboard',
      'Policies',
      'Feedback',
      'Workshops',
      'Users',
      'Audit',
    ])
  })

  it('renders Users link for policy_lead but NOT Audit', () => {
    render(<WorkspaceNav userRole="policy_lead" />)
    const labels = getLinkLabels()
    expect(labels).toContain('Users')
    expect(labels).not.toContain('Audit')
  })

  it('stakeholder sees exactly Dashboard, Policies, Feedback, Workshops (no Users, no Audit)', () => {
    render(<WorkspaceNav userRole="stakeholder" />)
    expect(getLinkLabels()).toEqual([
      'Dashboard',
      'Policies',
      'Feedback',
      'Workshops',
    ])
  })

  it('auditor sees Audit but NOT Users', () => {
    render(<WorkspaceNav userRole="auditor" />)
    const labels = getLinkLabels()
    expect(labels).toContain('Audit')
    expect(labels).not.toContain('Users')
  })

  it('never renders a /notifications link regardless of role (D-15)', () => {
    for (const role of ['admin', 'policy_lead', 'stakeholder', 'auditor', 'research_lead', 'observer', 'workshop_moderator']) {
      cleanup()
      render(<WorkspaceNav userRole={role} />)
      const hrefs = getLinkHrefs()
      expect(hrefs).not.toContain('/notifications')
    }
  })
})

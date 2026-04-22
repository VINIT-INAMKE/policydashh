/**
 * Phase 20 Plan 20-05 - tests for `/workshops` public listing page.
 *
 * Covered (6 tests, per plan Task 2 Step 3):
 *   T1 - "Upcoming Workshops" heading renders when upcoming.length > 0
 *   T2 - "Live Now" heading renders when live.length > 0
 *   T3 - "Past Workshops" heading renders when past.length > 0
 *   T4 - Empty state heading "No workshops scheduled yet" when all empty
 *   T5 - Empty sections are omitted (no heading when list empty)
 *   T6 - Page <h1> contains "Register for a Workshop"
 *
 * The page is an async server component. testing-library cannot render async
 * components directly - we await the component function itself to resolve
 * the promise, then render the resulting React element synchronously.
 *
 * `@/src/server/queries/workshops-public` is mocked so the test never touches
 * the real drizzle/unstable_cache layer. `@/components/ui/card`, `<WorkshopCard>`
 * etc render normally because we only assert on headings and empty-state copy.
 *
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'

// --- Mocks -----------------------------------------------------------------

// server-only is pulled in transitively (clerk auth, db, etc.). Defang it so
// the test environment can import the page.
vi.mock('server-only', () => ({}))

const hoisted = vi.hoisted(() => ({
  listPublicWorkshops: vi.fn(),
  auth: vi.fn().mockResolvedValue({ userId: null }),
}))
const mockListPublicWorkshops = hoisted.listPublicWorkshops

vi.mock('@/src/server/queries/workshops-public', () => ({
  listPublicWorkshops: hoisted.listPublicWorkshops,
}))

vi.mock('@clerk/nextjs/server', () => ({
  auth: hoisted.auth,
}))

// WorkshopCard imports heavy client-only deps (RegisterForm → react-hook-form,
// Turnstile widget, etc). Replace with a lightweight stub so we only assert
// on the page-level headings + empty state.
vi.mock('@/app/workshops/_components/workshop-card', () => ({
  WorkshopCard: (props: { workshop: { id: string; title: string } }) => (
    <div data-testid={`workshop-card-${props.workshop.id}`}>
      {props.workshop.title}
    </div>
  ),
}))

// Import the page AFTER mocks are declared.
import WorkshopsPage from '@/app/workshops/page'

function upcomingFixture() {
  return {
    id: 'w-upcoming-1',
    title: 'AI Safety Consultation',
    description: 'Discuss frontier risk policy with the team.',
    scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // +7 days
    durationMinutes: 60,
    status: 'upcoming' as const,
    calcomEventTypeId: 'cal-123',
    maxSeats: 50,
    registeredCount: 10,
    hasApprovedSummary: false,
  }
}

function liveFixture() {
  return {
    id: 'w-live-1',
    title: 'Live Session Now',
    description: 'Happening right now.',
    scheduledAt: new Date(Date.now() - 1000 * 60 * 10), // -10 min (started)
    durationMinutes: 90,
    status: 'in_progress' as const,
    calcomEventTypeId: 'cal-456',
    maxSeats: null,
    registeredCount: 0,
    hasApprovedSummary: false,
  }
}

function pastFixture() {
  return {
    id: 'w-past-1',
    title: 'Previous Workshop',
    description: 'Earlier session.',
    scheduledAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14), // -14 days
    durationMinutes: 60,
    status: 'completed' as const,
    calcomEventTypeId: 'cal-789',
    maxSeats: 40,
    registeredCount: 25,
    hasApprovedSummary: true,
  }
}

beforeEach(() => {
  cleanup()
  mockListPublicWorkshops.mockReset()
})

async function renderPage() {
  // The page is an async server component. Await it to resolve the promise
  // and then feed the resulting element into @testing-library/react.
  const element = await WorkshopsPage()
  return render(element as React.ReactElement)
}

describe('public /workshops listing page', () => {
  it('T1 - renders "Upcoming Workshops" heading when upcoming list is non-empty', async () => {
    mockListPublicWorkshops.mockResolvedValueOnce([upcomingFixture()])
    await renderPage()
    expect(
      screen.getByRole('heading', { level: 2, name: /upcoming workshops/i }),
    ).toBeTruthy()
  })

  it('T2 - renders "Live Now" heading when live list is non-empty', async () => {
    mockListPublicWorkshops.mockResolvedValueOnce([liveFixture()])
    await renderPage()
    expect(
      screen.getByRole('heading', { level: 2, name: /live now/i }),
    ).toBeTruthy()
  })

  it('T3 - renders "Past Workshops" heading when past list is non-empty', async () => {
    mockListPublicWorkshops.mockResolvedValueOnce([pastFixture()])
    await renderPage()
    expect(
      screen.getByRole('heading', { level: 2, name: /past workshops/i }),
    ).toBeTruthy()
  })

  it('T4 - renders the empty state when all sections are empty', async () => {
    mockListPublicWorkshops.mockResolvedValueOnce([])
    await renderPage()
    expect(screen.getByText(/no workshops scheduled yet/i)).toBeTruthy()
    expect(
      screen.getByText(/check back soon/i),
    ).toBeTruthy()
  })

  it('T5 - omits empty sections (live + past headings absent when only upcoming present)', async () => {
    mockListPublicWorkshops.mockResolvedValueOnce([upcomingFixture()])
    await renderPage()
    expect(
      screen.queryByRole('heading', { level: 2, name: /live now/i }),
    ).toBeNull()
    expect(
      screen.queryByRole('heading', { level: 2, name: /past workshops/i }),
    ).toBeNull()
    // Upcoming must still be present
    expect(
      screen.getByRole('heading', { level: 2, name: /upcoming workshops/i }),
    ).toBeTruthy()
  })

  it('T6 - page <h1> contains "Register for a Workshop"', async () => {
    mockListPublicWorkshops.mockResolvedValueOnce([
      upcomingFixture(),
      liveFixture(),
      pastFixture(),
    ])
    await renderPage()
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1.textContent).toContain('Register for a Workshop')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

/**
 * Plan 20-06 Task 1 - Server-side mode switch on /participate.
 *
 * The page is a Next.js Server Component (async). We import the module with
 * all external deps mocked, then await its render output and feed it to
 * @testing-library/react for DOM assertions.
 *
 * Modes under test (D-18):
 *   T1 - no workshopId           → intake form (Phase 19 ParticipateForm)
 *   T2 - workshopId, no token    → ExpiredLinkCard
 *   T3 - valid token + workshop  → WorkshopFeedbackForm with loaded sections
 *   T4 - expired token           → ExpiredLinkCard
 *   T5 - valid token, missing ws → ExpiredLinkCard (no info leak)
 */

// Defang server-only (pulled in by the clerk auth chain + downstream modules).
vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => ({
  verifyFeedbackToken: vi.fn(),
  workshopSelect: vi.fn(),
  sectionSelect: vi.fn(),
  clerkAuth: vi.fn().mockResolvedValue({ userId: null }),
}))

vi.mock('@clerk/nextjs/server', () => ({
  auth: mocks.clerkAuth,
}))

vi.mock('@/src/lib/feedback-token', () => ({
  verifyFeedbackToken: mocks.verifyFeedbackToken,
}))

// Drizzle query-builder stub: db.select() returns a thenable-ish chain.
// We route the first .select() call through workshopSelect and the second
// through sectionSelect because the page invokes them in that order.
let selectCallIndex = 0

vi.mock('@/src/db', () => {
  const makeChain = (resolver: () => Promise<unknown>) => {
    const chain: Record<string, unknown> = {}
    const handler: ProxyHandler<Record<string, unknown>> = {
      get(_target, prop: string) {
        if (prop === 'then') {
          return (onFulfilled: (v: unknown) => unknown) =>
            resolver().then(onFulfilled)
        }
        if (prop === 'catch') {
          return (onRejected: (e: unknown) => unknown) =>
            resolver().catch(onRejected)
        }
        return (..._args: unknown[]) => new Proxy(chain, handler)
      },
    }
    return new Proxy(chain, handler)
  }

  return {
    db: {
      select: (..._args: unknown[]) => {
        const idx = selectCallIndex++
        if (idx === 0) {
          return makeChain(async () => mocks.workshopSelect())
        }
        return makeChain(async () => mocks.sectionSelect())
      },
    },
  }
})

// Mock heavy client components so jsdom doesn't have to run the real Turnstile
// widget or base-ui Select portals.
vi.mock('@/app/participate/_components/participate-form', () => ({
  ParticipateForm: () => <div data-testid="intake-form">intake form</div>,
}))

vi.mock('@/app/participate/_components/workshop-feedback-form', () => ({
  WorkshopFeedbackForm: (props: {
    workshopId: string
    token: string
    sections: Array<{ id: string; title: string }>
  }) => (
    <div
      data-testid="feedback-form"
      data-workshop={props.workshopId}
      data-sections={props.sections.map((s) => s.id).join(',')}
    >
      feedback form for {props.workshopId}
    </div>
  ),
}))

let ParticipatePage: (p: { searchParams: Promise<Record<string, string | undefined>> }) => Promise<React.ReactElement>

beforeEach(async () => {
  selectCallIndex = 0
  mocks.verifyFeedbackToken.mockReset()
  mocks.workshopSelect.mockReset()
  mocks.sectionSelect.mockReset()
  const mod = await import('@/app/participate/page')
  ParticipatePage = mod.default as typeof ParticipatePage
})

describe('/participate mode switch (Plan 20-06)', () => {
  it('T1: no workshopId → renders Phase 19 intake form', async () => {
    const element = await ParticipatePage({
      searchParams: Promise.resolve({}),
    })
    const { getByTestId, queryByRole } = render(element)
    expect(getByTestId('intake-form')).toBeTruthy()
    expect(queryByRole('alert')).toBeNull()
    expect(mocks.verifyFeedbackToken).not.toHaveBeenCalled()
  })

  it('T2: workshopId but no token → ExpiredLinkCard (missing variant, E12)', async () => {
    const element = await ParticipatePage({
      searchParams: Promise.resolve({ workshopId: 'ws-123' }),
    })
    const { getByRole, queryByTestId } = render(element)
    const alert = getByRole('alert')
    // E12: ExpiredLinkCard variant='missing' copy differs from 'expired'.
    expect(alert.textContent).toContain('This feedback link is incomplete')
    expect(queryByTestId('feedback-form')).toBeNull()
    expect(queryByTestId('intake-form')).toBeNull()
    expect(mocks.verifyFeedbackToken).not.toHaveBeenCalled()
  })

  it('T3: valid token + workshop + sections → WorkshopFeedbackForm', async () => {
    mocks.verifyFeedbackToken.mockReturnValue({
      workshopId: 'ws-123',
      email: 'alice@example.com',
      exp: Math.floor(Date.now() / 1000) + 1000,
      iat: Math.floor(Date.now() / 1000),
    })
    mocks.workshopSelect.mockResolvedValue([{ id: 'ws-123' }])
    mocks.sectionSelect.mockResolvedValue([
      { id: 'sec-1', title: 'Section One' },
      { id: 'sec-2', title: 'Section Two' },
    ])

    const element = await ParticipatePage({
      searchParams: Promise.resolve({ workshopId: 'ws-123', token: 'good.jwt.sig' }),
    })
    const { getByTestId, queryByRole } = render(element)
    const form = getByTestId('feedback-form')
    expect(form.getAttribute('data-workshop')).toBe('ws-123')
    expect(form.getAttribute('data-sections')).toBe('sec-1,sec-2')
    expect(queryByRole('alert')).toBeNull()
    expect(mocks.verifyFeedbackToken).toHaveBeenCalledWith('good.jwt.sig', 'ws-123')
  })

  it('T4: expired token → ExpiredLinkCard (verifyFeedbackToken returns null)', async () => {
    mocks.verifyFeedbackToken.mockReturnValue(null)
    const element = await ParticipatePage({
      searchParams: Promise.resolve({ workshopId: 'ws-123', token: 'expired.jwt.sig' }),
    })
    const { getByRole, queryByTestId } = render(element)
    const alert = getByRole('alert')
    expect(alert.textContent).toContain('This link has expired')
    expect(queryByTestId('feedback-form')).toBeNull()
    // No DB lookups fire when the token is invalid
    expect(mocks.workshopSelect).not.toHaveBeenCalled()
  })

  it('T5: valid token but workshop not found → ExpiredLinkCard', async () => {
    mocks.verifyFeedbackToken.mockReturnValue({
      workshopId: 'ws-ghost',
      email: 'alice@example.com',
      exp: Math.floor(Date.now() / 1000) + 1000,
      iat: Math.floor(Date.now() / 1000),
    })
    mocks.workshopSelect.mockResolvedValue([])

    const element = await ParticipatePage({
      searchParams: Promise.resolve({ workshopId: 'ws-ghost', token: 'valid.jwt.sig' }),
    })
    const { getByRole, queryByTestId } = render(element)
    const alert = getByRole('alert')
    expect(alert.textContent).toContain('This link has expired')
    expect(queryByTestId('feedback-form')).toBeNull()
    // Section lookup is skipped when workshop row is absent
    expect(mocks.sectionSelect).not.toHaveBeenCalled()
  })
})

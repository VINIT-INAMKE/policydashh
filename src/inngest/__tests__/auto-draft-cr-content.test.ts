import { describe, it, expect } from 'vitest'
import { buildAutoDraftCRContent } from '../lib/auto-draft-cr-content'

describe('buildAutoDraftCRContent', () => {
  it('includes the feedback readable id in the title', () => {
    const result = buildAutoDraftCRContent({
      feedback: {
        readableId: 'FB-042',
        title: 'Clarify consent language',
        body: 'The word "consent" is ambiguous in paragraph 2.',
      },
      decision: 'accept',
      rationale: 'Good catch - rewriting for clarity.',
    })

    expect(result.title).toContain('FB-042')
  })

  it('truncates feedback title at 120 chars inside the CR title', () => {
    const longTitle = 'X'.repeat(300)
    const result = buildAutoDraftCRContent({
      feedback: {
        readableId: 'FB-001',
        title: longTitle,
        body: 'body',
      },
      decision: 'accept',
      rationale: 'ok',
    })

    expect(result.title.length).toBeLessThanOrEqual(200)
    expect(result.title).toContain('X'.repeat(120))
    expect(result.title).toContain('\u2026')
  })

  it('description quotes original feedback body and reviewer rationale', () => {
    const result = buildAutoDraftCRContent({
      feedback: {
        readableId: 'FB-007',
        title: 'Section is too long',
        body: 'Split paragraph 3 into two.',
      },
      decision: 'partially_accept',
      rationale: 'We will split it but reword first.',
    })

    expect(result.description).toContain('Split paragraph 3 into two.')
    expect(result.description).toContain('We will split it but reword first.')
    expect(result.description).toContain('FB-007')
  })

  it('description labels decision=accept as "Accepted"', () => {
    const result = buildAutoDraftCRContent({
      feedback: { readableId: 'FB-1', title: 't', body: 'b' },
      decision: 'accept',
      rationale: 'r',
    })
    expect(result.description).toContain('Accepted')
  })

  it('description labels decision=partially_accept as "Partially accepted"', () => {
    const result = buildAutoDraftCRContent({
      feedback: { readableId: 'FB-1', title: 't', body: 'b' },
      decision: 'partially_accept',
      rationale: 'r',
    })
    expect(result.description).toContain('Partially accepted')
  })
})

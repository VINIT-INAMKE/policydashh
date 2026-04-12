import { describe, it, expect } from 'vitest'
import { buildFeedbackReviewedCopy } from '../lib/feedback-reviewed-copy'

describe('buildFeedbackReviewedCopy', () => {
  it('produces an accepted-copy variant for decision=accept', () => {
    const copy = buildFeedbackReviewedCopy({
      decision: 'accept',
      sectionName: 'Section 3: Consent',
      rationale: 'Clear, actionable, well-scoped.',
    })

    expect(copy.title).toBe('Feedback accepted')
    expect(copy.body).toContain('Section 3: Consent')
    expect(copy.body).toContain('Clear, actionable, well-scoped.')
  })

  it('produces a partially-accepted variant that does NOT include rationale', () => {
    const copy = buildFeedbackReviewedCopy({
      decision: 'partially_accept',
      sectionName: 'Section 3: Consent',
      rationale: 'Some points valid, others not.',
    })

    expect(copy.title).toBe('Feedback partially accepted')
    expect(copy.body).toContain('Section 3: Consent')
    expect(copy.body).not.toContain('Some points valid')
  })

  it('produces a rejected variant that includes rationale', () => {
    const copy = buildFeedbackReviewedCopy({
      decision: 'reject',
      sectionName: 'Section 3: Consent',
      rationale: 'Out of scope for this policy.',
    })

    expect(copy.title).toBe('Feedback not accepted')
    expect(copy.body).toContain('Out of scope for this policy.')
  })

  it('truncates long rationale bodies to 80 chars plus ellipsis', () => {
    const longRationale = 'A'.repeat(200)
    const copy = buildFeedbackReviewedCopy({
      decision: 'accept',
      sectionName: 'Section 3',
      rationale: longRationale,
    })

    // 80 chars + 1 ellipsis char = 81 total for the rationale fragment
    expect(copy.body).toContain('A'.repeat(80) + '\u2026')
    expect(copy.body).not.toContain('A'.repeat(81))
  })

  it('falls back to "a section" when sectionName is empty', () => {
    const copy = buildFeedbackReviewedCopy({
      decision: 'accept',
      sectionName: '',
      rationale: 'ok',
    })

    expect(copy.body).toContain('a section')
  })
})

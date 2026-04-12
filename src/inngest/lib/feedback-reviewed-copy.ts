export type FeedbackDecision = 'accept' | 'partially_accept' | 'reject'

export interface FeedbackReviewedCopyInput {
  decision: FeedbackDecision
  sectionName: string
  rationale: string
}

export interface FeedbackReviewedCopy {
  title: string
  body: string
}

const RATIONALE_MAX = 80

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '\u2026' : s
}

export function buildFeedbackReviewedCopy(
  input: FeedbackReviewedCopyInput,
): FeedbackReviewedCopy {
  const section = input.sectionName.trim().length > 0 ? input.sectionName : 'a section'
  const truncated = truncate(input.rationale, RATIONALE_MAX)

  switch (input.decision) {
    case 'accept':
      return {
        title: 'Feedback accepted',
        body: `Your feedback on \u201c${section}\u201d was accepted. ${truncated}`,
      }
    case 'partially_accept':
      return {
        title: 'Feedback partially accepted',
        body: `Your feedback on \u201c${section}\u201d was partially accepted.`,
      }
    case 'reject':
      return {
        title: 'Feedback not accepted',
        body: `Your feedback on \u201c${section}\u201d was not accepted. ${truncated}`,
      }
  }
}

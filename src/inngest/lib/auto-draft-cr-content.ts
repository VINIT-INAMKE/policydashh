export type AutoDraftDecision = 'accept' | 'partially_accept'

export interface AutoDraftCRContentInput {
  feedback: {
    readableId: string
    title: string
    body: string
  }
  decision: AutoDraftDecision
  rationale: string
}

export interface AutoDraftCRContent {
  title: string
  description: string
}

const TITLE_MAX_FROM_FEEDBACK = 120

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '\u2026' : s
}

function decisionLabel(d: AutoDraftDecision): string {
  return d === 'accept' ? 'Accepted' : 'Partially accepted'
}

export function buildAutoDraftCRContent(
  input: AutoDraftCRContentInput,
): AutoDraftCRContent {
  const shortTitle = truncate(input.feedback.title, TITLE_MAX_FROM_FEEDBACK)
  const title = `Draft from ${input.feedback.readableId}: ${shortTitle}`

  const description = [
    `Auto-drafted from feedback ${input.feedback.readableId} (${decisionLabel(input.decision)}).`,
    '',
    'Original feedback:',
    input.feedback.body,
    '',
    'Reviewer rationale:',
    input.rationale,
  ].join('\n')

  return { title, description }
}

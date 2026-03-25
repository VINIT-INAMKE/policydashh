import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || 'PolicyDash <onboarding@resend.dev>'

/**
 * Send email notification when feedback is reviewed.
 * Fire-and-forget: caller does sendFeedbackReviewedEmail(...).catch(console.error)
 * Silently returns if no Resend key or no email (phone-only user).
 */
export async function sendFeedbackReviewedEmail(
  to: string | null | undefined,
  data: { feedbackReadableId: string; decision: string; rationale: string },
): Promise<void> {
  if (!resend || !to) return

  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `Your feedback ${data.feedbackReadableId} has been reviewed`,
    text: `Your feedback was ${data.decision}. Rationale: ${data.rationale}`,
  })
}

/**
 * Send email notification when a new version is published.
 * Fire-and-forget: caller does sendVersionPublishedEmail(...).catch(console.error)
 */
export async function sendVersionPublishedEmail(
  to: string | null | undefined,
  data: { policyName: string; versionLabel: string },
): Promise<void> {
  if (!resend || !to) return

  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `New version published: ${data.policyName} ${data.versionLabel}`,
    text: `A new version of "${data.policyName}" has been published: ${data.versionLabel}.`,
  })
}

/**
 * Send email notification when a user is assigned to a section.
 * Fire-and-forget: caller does sendSectionAssignedEmail(...).catch(console.error)
 */
export async function sendSectionAssignedEmail(
  to: string | null | undefined,
  data: { sectionName: string; policyName: string },
): Promise<void> {
  if (!resend || !to) return

  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `You have been assigned to a section in ${data.policyName}`,
    text: `You have been assigned to the "${data.sectionName}" section in "${data.policyName}".`,
  })
}

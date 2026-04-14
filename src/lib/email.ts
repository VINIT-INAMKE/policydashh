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

/**
 * Send a nudge email to a workshop moderator when evidence checklist slots
 * remain empty after a delay period (72h or 7d post-completion).
 *
 * Silent no-op when RESEND_API_KEY is unset or `to` is null/undefined.
 * Fire-and-forget from Inngest step — errors bubble as plain Error so
 * Inngest retries. Used by workshopCompletedFn (Plan 17-03).
 */
export async function sendWorkshopEvidenceNudgeEmail(
  to: string | null | undefined,
  data: {
    workshopTitle: string
    workshopId: string
    emptySlots: string[]
    delayLabel: string  // '72 hours' or '7 days'
  },
): Promise<void> {
  if (!resend || !to) return

  const slotList = data.emptySlots.join(', ')
  const workshopUrl = `/workshops/${data.workshopId}`

  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `Evidence checklist reminder: ${data.workshopTitle}`,
    text:
      `Your workshop "${data.workshopTitle}" has ${data.emptySlots.length} unfilled ` +
      `evidence slot(s) (${slotList}) after ${data.delayLabel}. ` +
      `Upload the missing items at: ${workshopUrl}`,
  })
}

/**
 * Send an email to a requester when their async evidence pack export is ready.
 *
 * Silent no-op when RESEND_API_KEY is unset or `to` is null/undefined
 * (phone-only user). Errors bubble as plain Error so the Inngest send-email
 * step retries via Inngest's retry budget.
 *
 * Used by evidencePackExportFn (Plan 18-01). EV-07.
 */
export async function sendEvidencePackReadyEmail(
  to: string | null | undefined,
  data: {
    documentTitle: string
    downloadUrl: string
    fileCount: number
    totalSizeBytes: number
    expiresAt: string  // ISO timestamp
    degraded?: boolean  // true if some binaries unavailable
  },
): Promise<void> {
  if (!resend || !to) return

  const sizeMb = (data.totalSizeBytes / (1024 * 1024)).toFixed(2)
  const subject = data.degraded
    ? `Evidence pack ready (partial): ${data.documentTitle}`
    : `Evidence pack ready: ${data.documentTitle}`

  const degradedNote = data.degraded
    ? `\n\nNote: Some files were unavailable at export time and have been replaced ` +
      `with UNAVAILABLE.txt placeholders containing direct download links. ` +
      `See inside the pack for details.\n`
    : ''

  const text =
    `Your evidence pack for "${data.documentTitle}" is ready.\n\n` +
    `Download (expires ${data.expiresAt}):\n${data.downloadUrl}\n\n` +
    `Pack contents: ${data.fileCount} files, ${sizeMb} MB total.` +
    degradedNote

  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    text,
  })
}

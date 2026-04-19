/**
 * Post-workshop feedback invite email template (Phase 20, D-16).
 *
 * Sent by workshopFeedbackInviteFn (Plan 20-05) one per attendee immediately
 * after MEETING_ENDED, independently of the Phase 17 moderator summary
 * review gate. The feedbackUrl embeds a 14-day signed JWT (D-17) so the
 * recipient can open the post-workshop feedback form on /participate without
 * being signed in.
 *
 * Separate .tsx file so Inngest function tests can `vi.mock` the
 * `@/src/lib/email` boundary without pulling JSX through the transform
 * (Pitfall 8 - Phase 16/17/18/19 parity).
 *
 * Copy uses unicode curly apostrophes (\u2019) verbatim for test contract
 * parity with Phase 19's welcome email.
 */

import * as React from 'react'
import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Button,
  Hr,
  Preview,
  render,
} from '@react-email/components'

export interface WorkshopFeedbackInviteEmailProps {
  name?: string | null
  workshopTitle: string
  /** Fully-qualified /participate?workshopId=...&token=... URL. */
  feedbackUrl: string
  /**
   * F29: pre-formatted "Friday, April 19, 2026, 2:00 PM IST" label so the
   * template renders workshop timing without re-formatting Date in the
   * email layer. Optional for back-compat.
   */
  scheduledAtLabel?: string | null
}

export function WorkshopFeedbackInviteEmail({
  name,
  workshopTitle,
  feedbackUrl,
  scheduledAtLabel,
}: WorkshopFeedbackInviteEmailProps) {
  const greetingName = (name?.trim() || 'there').split(' ')[0] ?? 'there'

  return (
    <Html>
      <Head />
      <Preview>{`Share your feedback on ${workshopTitle}`}</Preview>
      <Body
        style={{
          fontFamily: 'Inter, -apple-system, sans-serif',
          color: '#181c1e',
          backgroundColor: '#f7fafc',
          margin: 0,
          padding: '32px 0',
        }}
      >
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '0 24px' }}>
          <Text
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: '#000a1e',
              marginBottom: '24px',
            }}
          >
            CIVILIZATION LAB
          </Text>
          <Text
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: '#000a1e',
              lineHeight: 1.2,
              marginBottom: '16px',
            }}
          >
            {`Share your feedback on ${workshopTitle}`}
          </Text>
          <Text style={{ fontSize: '16px', lineHeight: 1.6, marginBottom: '16px' }}>
            {`Hi ${greetingName}, thank you for attending.`}
          </Text>
          {scheduledAtLabel ? (
            <Text
              style={{
                fontSize: '14px',
                lineHeight: 1.6,
                marginBottom: '16px',
                color: '#44474e',
              }}
            >
              {scheduledAtLabel}
            </Text>
          ) : null}
          <Text style={{ fontSize: '16px', lineHeight: 1.6, marginBottom: '24px' }}>
            {'Your insights from the workshop help shape the policy consultation. Please take a minute to rate the session and share what stood out.'}
          </Text>
          <Button
            href={feedbackUrl}
            style={{
              backgroundColor: '#000a1e',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
              padding: '14px 28px',
              borderRadius: '12px',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Submit feedback
          </Button>
          <Hr style={{ borderColor: '#ebeef0', margin: '32px 0' }} />
          <Text style={{ fontSize: '12px', color: '#44474e', lineHeight: 1.5 }}>
            {'This link expires in 14 days. Your feedback is submitted under your workshop registration and linked to this consultation.'}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

/** Render to HTML. Async per @react-email/render v1.x (Pitfall 6 - always await). */
export async function renderWorkshopFeedbackInviteEmail(
  props: WorkshopFeedbackInviteEmailProps,
): Promise<string> {
  return await render(<WorkshopFeedbackInviteEmail {...props} />)
}

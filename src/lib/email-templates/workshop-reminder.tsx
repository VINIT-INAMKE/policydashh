/**
 * Workshop reminder email template (Google Calendar pivot, Task 7).
 *
 * Sent by the reminder Inngest function once per registered attendee at
 * 24 h and 1 h before a workshop's scheduled start time. The `meetingUrl`
 * is the Google Meet link stored on the workshop row; `windowLabel` is
 * pre-formatted by the caller ("in 24 hours" / "in 1 hour").
 *
 * Separate .tsx file so Inngest function tests can `vi.mock` the
 * `@/src/lib/email` boundary without pulling JSX through the transform
 * (Pitfall 8 - Phase 16/17/18/19/20 parity).
 *
 * Copy uses unicode curly apostrophes (’) verbatim for test contract
 * parity with Phase 19's welcome email and Phase 20's feedback-invite.
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

export interface WorkshopReminderEmailProps {
  name?: string | null
  workshopTitle: string
  meetingUrl: string
  /** Pre-formatted "Friday, May 1, 2026, 2:00 PM IST". */
  scheduledAtLabel: string
  /** "in 24 hours" or "in 1 hour" — used in subject + first paragraph. */
  windowLabel: string
}

export function WorkshopReminderEmail({
  name,
  workshopTitle,
  meetingUrl,
  scheduledAtLabel,
  windowLabel,
}: WorkshopReminderEmailProps) {
  const greetingName = (name?.trim() || 'there').split(' ')[0] ?? 'there'

  return (
    <Html>
      <Head />
      <Preview>{`Reminder: ${workshopTitle} starts ${windowLabel}`}</Preview>
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
            {`${workshopTitle} starts ${windowLabel}`}
          </Text>
          <Text style={{ fontSize: '16px', lineHeight: 1.6, marginBottom: '16px' }}>
            {`Hi ${greetingName}, this is a reminder that your registered workshop is starting ${windowLabel}.`}
          </Text>
          <Text
            style={{
              fontSize: '14px',
              lineHeight: 1.6,
              marginBottom: '24px',
              color: '#44474e',
            }}
          >
            {scheduledAtLabel}
          </Text>
          <Button
            href={meetingUrl}
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
            Join meeting
          </Button>
          <Hr style={{ borderColor: '#ebeef0', margin: '32px 0' }} />
          <Text style={{ fontSize: '12px', color: '#44474e', lineHeight: 1.5 }}>
            {'‘You’re receiving this because you registered for this workshop. The link above is your meeting room.'}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

/** Render to HTML. Async per @react-email/render v1.x (Pitfall 6 - always await). */
export async function renderWorkshopReminderEmail(
  props: WorkshopReminderEmailProps,
): Promise<string> {
  return await render(<WorkshopReminderEmail {...props} />)
}

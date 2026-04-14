/**
 * Workshop registration confirmation email template (Phase 20, D-11).
 *
 * Sent asynchronously by workshopRegistrationReceivedFn (Plan 20-04) after
 * a cal.com BOOKING_CREATED webhook has been persisted AND the Clerk invite
 * has been (idempotently) issued. The same template is used for cal.com
 * bookings AND D-12 walk-in synthesised registrations — the body copy is
 * neutral about how the registration happened.
 *
 * Lives in a separate .tsx file so Inngest function tests can `vi.mock` the
 * `@/src/lib/email` boundary without pulling JSX through the transform
 * (Pitfall 8 — Phase 16/17/18/19 parity).
 *
 * Copy uses unicode curly apostrophes (\u2019) verbatim — `@react-email/render`
 * converts HTML `&apos;` entities to `&#x27;`, which breaks test contracts that
 * assert on plain-string substrings.
 */

import * as React from 'react'
import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Hr,
  Preview,
  render,
} from '@react-email/components'

export interface WorkshopRegistrationEmailProps {
  name?: string | null
  workshopTitle: string
  /** Pre-formatted human date (e.g. "Monday, April 28 at 3:00 PM IST"). */
  scheduledAt: string
}

export function WorkshopRegistrationEmail({
  name,
  workshopTitle,
  scheduledAt,
}: WorkshopRegistrationEmailProps) {
  const greetingName = (name?.trim() || 'there').split(' ')[0] ?? 'there'

  return (
    <Html>
      <Head />
      <Preview>{`You\u2019re registered for ${workshopTitle}`}</Preview>
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
            POLICYDASH
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
            {`You\u2019re registered for ${workshopTitle}`}
          </Text>
          <Text style={{ fontSize: '16px', lineHeight: 1.6, marginBottom: '16px' }}>
            {`Hi ${greetingName}, we\u2019ve saved your seat.`}
          </Text>
          <Text style={{ fontSize: '16px', lineHeight: 1.6, marginBottom: '16px' }}>
            <strong>When:</strong> {scheduledAt}
          </Text>
          <Text style={{ fontSize: '16px', lineHeight: 1.6, marginBottom: '16px' }}>
            {'We\u2019ll send joining details closer to the date. If you need to reschedule, use the link in your original cal.com confirmation.'}
          </Text>
          <Hr style={{ borderColor: '#ebeef0', margin: '32px 0' }} />
          <Text style={{ fontSize: '12px', color: '#44474e', lineHeight: 1.5 }}>
            {'This is a consultation workshop run under PolicyDash. If you did not register for this session, you can safely ignore this email.'}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

/** Render to HTML. Async per @react-email/render v1.x (Pitfall 6 — always await). */
export async function renderWorkshopRegistrationEmail(
  props: WorkshopRegistrationEmailProps,
): Promise<string> {
  return await render(<WorkshopRegistrationEmail {...props} />)
}

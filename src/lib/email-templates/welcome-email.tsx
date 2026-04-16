/**
 * Welcome email template - 6 org bucket variants.
 *
 * Rendered via `@react-email/components` render() (async - Pitfall 6).
 * Kept in a separate .tsx file so Inngest function tests can mock the
 * sendWelcomeEmail helper at the src/lib/email.ts boundary without
 * importing JSX (Pitfall 8 - Phase 16/17/18 pattern).
 *
 * Copy lifted verbatim from 19-UI-SPEC.md "Welcome Email Design Contract".
 * Any copy edits MUST update the UI-SPEC first and re-sync here.
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

export type OrgBucket =
  | 'government'
  | 'industry'
  | 'legal'
  | 'academia'
  | 'civil_society'
  | 'internal'

interface BucketContent {
  body: string
  cta: string
}

// Copy is locked by tests/phase-19/welcome-email.test.ts substring contracts
// AND by 19-UI-SPEC.md "Per-Bucket Body Copy" table. Do not edit without
// updating both.
const BUCKET_COPY: Record<OrgBucket, BucketContent> = {
  government: {
    body:
      'As a government official or policy maker, your institutional perspective is essential to this consultation. You will be invited to review draft policy sections, submit structured feedback, and track how your inputs shape the final framework.',
    cta: 'Accept Invitation & Sign In',
  },
  industry: {
    body:
      'As an industry professional, your practical expertise helps ground policy in operational reality. You will be able to submit evidence-backed feedback on sections relevant to your sector.',
    cta: 'Accept Invitation & Sign In',
  },
  legal: {
    body:
      'As a legal professional, your analysis of regulatory and compliance dimensions is invaluable. You will be able to flag legal issues, suggest amendments, and review how change requests are resolved.',
    cta: 'Accept Invitation & Sign In',
  },
  academia: {
    body:
      'As an academic or researcher, your evidence-based perspective strengthens the consultation\u2019s credibility. You will be able to attach research citations and link your submissions to supporting literature.',
    cta: 'Accept Invitation & Sign In',
  },
  civil_society: {
    body:
      'As a civil society representative, you bring the voice of communities most affected by these policies. Your feedback will be tracked from submission through to the policy version it influenced.',
    cta: 'Accept Invitation & Sign In',
  },
  internal: {
    body:
      'You have been added to the Civilization Lab workspace as an internal team member. Sign in to access the full dashboard, manage feedback, and run workshops.',
    cta: 'Sign In to Dashboard',
  },
}

export interface WelcomeEmailProps {
  name: string
  email: string
  orgType: string
}

export function WelcomeEmail({ name, email, orgType }: WelcomeEmailProps) {
  const bucket = BUCKET_COPY[orgType as OrgBucket] ?? BUCKET_COPY.civil_society
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://civilization-lab.com'
  const firstName = name.split(' ')[0] ?? name

  return (
    <Html>
      <Head />
      <Preview>Welcome to the consultation, {firstName}</Preview>
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
            {'You\u2019re in.'}
          </Text>
          <Text
            style={{
              fontSize: '16px',
              lineHeight: 1.6,
              marginBottom: '24px',
            }}
          >
            {bucket.body}
          </Text>
          <Button
            href={appUrl}
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
            {bucket.cta}
          </Button>
          <Hr style={{ borderColor: '#ebeef0', margin: '32px 0' }} />
          <Text style={{ fontSize: '12px', color: '#44474e', lineHeight: 1.5 }}>
            This invitation was sent to {email}. If you did not request this, you can safely
            ignore it.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

/**
 * Render the welcome email to an HTML string.
 * Async per @react-email/render v1.x (Pitfall 6 - always await).
 */
export async function renderWelcomeEmail(props: WelcomeEmailProps): Promise<string> {
  return await render(<WelcomeEmail {...props} />)
}

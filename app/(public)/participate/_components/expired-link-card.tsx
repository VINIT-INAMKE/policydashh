/**
 * ExpiredLinkCard — rendered when a /participate?workshopId=X&token=Y request
 * arrives with a missing/invalid/expired JWT. Server-side only; no form is
 * mounted (no info-leak vector).
 *
 * Copy verbatim per 20-UI-SPEC.md Surface B "Expired / Invalid Token Landing".
 * `role="alert"` per accessibility section (error, assertive).
 */

import { Card } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

export function ExpiredLinkCard() {
  return (
    <Card role="alert" className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      <AlertCircle className="h-12 w-12 text-destructive" aria-hidden="true" />
      <h2 className="text-xl font-semibold text-destructive">
        This link has expired
      </h2>
      <p className="max-w-md text-base leading-relaxed text-muted-foreground">
        Feedback links are valid for 14 days after the workshop. This link is no longer active.
      </p>
      <p className="text-sm text-muted-foreground">
        If you believe this is an error, contact the workshop organizer.
      </p>
    </Card>
  )
}

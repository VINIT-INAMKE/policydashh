---
status: partial
phase: 19-public-participate-intake-clerk-invite-turnstile
source: [19-VERIFICATION.md]
started: 2026-04-14T17:25:00Z
updated: 2026-04-14T17:25:00Z
---

## Current Test

[deferred to v0.2 milestone smoke walk per user preference — feedback_defer_smoke_walks]

## Tests

### 1. Unauthenticated GET /participate renders form (no Clerk redirect)
expected: Page loads with headline 'Join the Consultation', all 8 form fields, Turnstile widget, and disabled 'Request Access' button
result: [pending — milestone smoke walk]

### 2. Turnstile widget renders and gates submit with Cloudflare test keys
expected: Widget resolves (~1-2s with 0x00000000000000000000AA site key), 'Request Access' becomes enabled, failed token replay returns 403
result: [pending — milestone smoke walk]

### 3. Full E2E submission (form → POST 200 → success panel → Inngest event)
expected: POST /api/intake/participate returns 200 {success:true}, form replaces with success panel showing green check, "You're on the list.", bucket badge; Inngest Dev Server shows participate.intake event received and participate-intake fn ran with 2 steps
result: [pending — milestone smoke walk]

### 4. Clerk invitation created with correct publicMetadata in Clerk Dashboard
expected: Pending invitation for submitted email with publicMetadata { role: 'stakeholder', orgType: <submitted_value> }
result: [pending — milestone smoke walk]

### 5. Welcome email delivered via Resend with role-tailored copy
expected: Email subject 'Welcome to the consultation, <firstName>', body contains per-bucket substring (e.g. 'academic or researcher' for academia), CTA reads 'Accept Invitation & Sign In'
result: [pending — milestone smoke walk]

### 6. Rate-limit replay: same email within 15 minutes
expected: Second POST returns 200 (no info leak), Inngest Dev Server shows the second event was rate-limited (no second function run for that emailHash)
result: [pending — milestone smoke walk]

### 7. Negative regression: authenticated route /policies still redirects to /sign-in
expected: GET /policies in incognito window redirects to /sign-in, confirming proxy.ts whitelist did not accidentally expose authenticated routes
result: [pending — milestone smoke walk]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps

*None — all 10/10 automated must-haves verified. Items above are real-browser / third-party service walks that cannot be automated and are rolled into the v0.2 milestone consolidated smoke walk per project policy.*

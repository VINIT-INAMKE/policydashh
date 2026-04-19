# Stakeholder + Public Flows Review

## S1: `/api/intake/participate` has no per-IP or per-email server-side rate limit
**File:** `app/api/intake/participate/route.ts:78`
**Severity:** HIGH
**Impact:** A bot or motivated bad actor can POST unlimited intake requests — exhausting Turnstile quotas, hammering Clerk invite API, and flooding admin review queues — before the Inngest rate-limit step inside `participateIntakeFn` can stop it. B11 applied rate-limits to `workshop-register` and `workshop-feedback` but left this endpoint unprotected. The Turnstile challenge is the only gate, and it can be solved by real humans at scale or bypassed in test/dev where `CLOUDFLARE_TURNSTILE_SECRET_KEY` is absent (the route returns `success: false` in that case, but a correctly configured real secret is all that's needed to flood it).
**Suggested fix:** Add `consume(getClientIp(request), ...)` and a per-email-hash `consume()` immediately after body parse, mirroring the pattern in `workshop-register/route.ts`.

---

## S2: Workshop registration page shows "You're registered" only for `status='registered'`, not `'rescheduled'`
**File:** `app/workshops/page.tsx:68`
**Severity:** HIGH
**Impact:** A logged-in user who rescheduled their booking (`status='rescheduled'`) sees the full RegisterForm instead of the "You're registered" card. They can accidentally double-register, and the server will reject them with a 409 (which the client surfaces as "You are already registered for this workshop" — confusing, because the user thought they weren't). The filter on line 68 is `eq(workshopRegistrations.status, 'registered')`, missing `'rescheduled'`.
**Suggested fix:** Change the status filter to `inArray(workshopRegistrations.status, ['registered', 'rescheduled'])`.

---

## S3: `WorkshopFeedbackForm` has no handler for HTTP 409 ("account not found")
**File:** `app/participate/_components/workshop-feedback-form.tsx:105`
**Severity:** HIGH
**Impact:** The route handler (`app/api/intake/workshop-feedback/route.ts:187`) returns `{ status: 409 }` when the attendee has a valid JWT but has not yet accepted their Clerk invitation (users table row absent). The client only handles 401, 400, and a generic else-branch. A 409 falls into the generic "Something went wrong on our end" toast, giving the user no actionable guidance that they need to accept their email invitation first and then re-submit their feedback.
**Suggested fix:** Add an explicit `else if (res.status === 409)` branch with copy like "Please complete sign-up via your invitation email first, then return to this link."

---

## S4: `revalidateTag` called with deprecated `{ expire: 0 }` signature (Next.js 16 breaking change)
**File:** `app/api/webhooks/cal/route.ts:148,166,215,224`
**Severity:** HIGH
**Impact:** Next.js 16 deprecated the single-argument and `{ expire: 0 }` object forms of `revalidateTag`. The docs now show `revalidateTag(tag, 'max')` or `revalidateTag(tag, { expire: N })` as the two-argument form, but the old `{ expire: 0 }` object as the second arg may be silently no-opped or cause TypeScript compile errors depending on the exact minor version. If the cache busting silently fails, the public `/workshops` listing will show stale spots-left counts even after booking/cancellation webhooks fire.
**Suggested fix:** Replace `revalidateTag(spotsTag(id), { expire: 0 })` with `revalidateTag(spotsTag(id), 'max')` throughout the cal webhook handler and wherever else this pattern appears.

---

## S5: `MEETING_ENDED` handler sends feedback invites even when workshop is `archived`
**File:** `app/api/webhooks/cal/route.ts:242-344`
**Severity:** MEDIUM
**Impact:** The transition guard (line 243–244) only transitions to `completed` if the current status is `upcoming` or `in_progress`. If the workshop is `archived`, the status update is skipped. However, the attendee loop (lines 275–351) runs unconditionally after the guard — so feedback-invite emails are still dispatched for archived workshops. Attendees of archived workshops receive invites containing links to submit feedback, but the associated milestone/admin flow may not expect contributions from that archived workshop.
**Suggested fix:** Move the attendee loop and `sendWorkshopFeedbackInvite` calls inside the `if` block that guards the status transition, or add an explicit early-return for `archived` status before the attendee loop.

---

## S6: `RegisterForm` error `<p>` has no `role="alert"` or `aria-live`, so screen-reader users miss server errors
**File:** `app/workshops/_components/register-form.tsx:77,150`
**Severity:** MEDIUM
**Impact:** When registration fails (e.g., fully booked race, 500), the error text is rendered in a plain `<p>` with no live-region announcement. Screen-reader users submitting the form will not be notified of the error unless they actively navigate to it. This is the only feedback path for no-JS-fallback and assistive-technology users.
**Suggested fix:** Add `role="alert"` or `aria-live="assertive"` to the error `<p>` elements at lines 77 and 150.

---

## S7: Workshop feedback form `RadioGroup` for attribution has no `aria-label` or `aria-labelledby`
**File:** `app/participate/_components/workshop-feedback-form.tsx:243`
**Severity:** MEDIUM
**Impact:** The `RadioGroup` that controls `isAnonymous` renders without an accessible group label (`aria-label` or `aria-labelledby`). The visually-present `<Label>Attribution</Label>` at line 241 is not programmatically linked to the group, so screen-reader users hear only the individual option labels ("Anonymous", "Attributed") with no group context.
**Suggested fix:** Add `aria-label="Attribution"` (or `aria-labelledby` pointing to the label's `id`) to the `RadioGroup` component.

---

## S8: Participate form — role and orgType validation errors lack `id`/`aria-describedby` linkage
**File:** `app/participate/_components/participate-form.tsx:242,262`
**Severity:** MEDIUM
**Impact:** The inline validation error messages for the "Your role" `RadioGroup` and "Organization type" `Select` are plain `<p>` tags with no `id`. The inputs above them have no `aria-describedby` pointing to the error text, so screen-reader users are not alerted to which field has an error. By contrast, the name/email/orgName/expertise fields all have proper `id`+`aria-describedby` linkage.
**Suggested fix:** Give the role error `<p id="role-error">` and the orgType error `<p id="orgType-error">`, and add `aria-describedby` on the `RadioGroup`/`SelectTrigger` accordingly.

---

## S9: `MyOutcomesTab` shows no error state when `feedback.listOwn` fails
**File:** `app/feedback/_components/my-outcomes-tab.tsx:59`
**Severity:** MEDIUM
**Impact:** `feedbackQuery.isLoading` renders skeletons and `items.length === 0` renders an empty-state message, but there is no `feedbackQuery.isError` branch. If the tRPC call fails (network error, session expiry), the component renders nothing — the skeletons disappear and the empty-state message appears, telling the submitter they have "No feedback submitted yet" when the reality is a fetch failure. Same gap exists for `transitionsQuery` and `evidenceQuery` inside `OutcomeDetails` — errors are silently swallowed and empty arrays are rendered.
**Suggested fix:** Add `if (feedbackQuery.isError)` branch rendering a user-facing error message with a retry option; mirror the pattern for the nested queries.

---

## S10: `AllFeedbackTab` and `EvidenceGapsTab` show no error state when tRPC queries fail
**File:** `app/feedback/_components/all-feedback-tab.tsx:66`, `app/feedback/_components/evidence-gaps-tab.tsx:93`
**Severity:** MEDIUM
**Impact:** Both tabs render empty-state illustrations when queries fail, misleading admin/policy-lead users into thinking there is no feedback/no evidence gaps rather than informing them of a fetch error.
**Suggested fix:** Add `feedbackQuery.isError` and `claimsQuery.isError` branches with an error message + retry button.

---

## S11: Workshop listing page shows `alreadyRegistered` "You're registered" card for `live` workshops but not for `past` ones — registered users see full form on live workshops if status changed mid-visit
**File:** `app/workshops/page.tsx:134`
**Severity:** MEDIUM  
**Impact:** `WorkshopCard` for `live` variant receives `alreadyRegistered` prop, but the page is `force-dynamic` and computes status based on `Date.now()`. A workshop that transitions from `upcoming` to `live` between the user's page load and the next refresh can cause the card to re-mount in `live` variant while `alreadyRegistered` state is stale. This is a minor race — the underlying API will 409 on re-registration — but the UI presents a confusing "Confirm Registration" button to an already-registered user on live workshops.
**Suggested fix:** This is inherent to SSR without real-time updates; at minimum, the success path in `RegisterForm` should call `router.refresh()` (it does via F32) and set `success=true` before the refresh, so the stale card is overwritten before the user can double-click.

---

## S12: `SubmitFeedbackForm` submit button is disabled when `preflight.canSubmit = false`, but no `title` attribute explains why to keyboard/mouse users who don't read the alert banner
**File:** `app/policies/[id]/sections/[sectionId]/feedback/new/_components/submit-feedback-form.tsx:260`
**Severity:** MEDIUM
**Impact:** When `disabled=true`, the Submit button is grayed out with no tooltip or `title` attribute. The informational alert is above the form and could be scrolled past. A user who does not read the alert and reaches the button via Tab will not know why it is disabled.
**Suggested fix:** Add `title="You're not assigned to this section"` (or `aria-describedby` pointing at the alert) to the submit `Button` when `disabled=true`.

---

## S13: `GlobalFeedbackTabs` passes URL `?tab=evidence-gaps` but a non-admin who follows this link lands on the `all` or `outcomes` default without any error message
**File:** `app/feedback/_components/global-feedback-tabs.tsx:27-32`
**Severity:** MEDIUM
**Impact:** `VALID_TABS` includes `'evidence-gaps'` and the URL parsing reads it. But `canSeeEvidenceGaps` is only `true` for `admin`/`research_lead`. If a user with `policy_lead` role is sent a link ending in `?tab=evidence-gaps`, the tab content is never rendered but the URL is silently ignored and the default tab opens, which could be confusing. There is no indication that access was denied or that the tab requires a different role.
**Suggested fix:** If the URL tab is not accessible for the current user's role, either strip it from the URL or show a brief "You don't have access to this tab" message before defaulting to the appropriate tab.

---

## S14: `CreateCRDialog` fetches `feedback.list` without status filter and filters client-side — does not paginate
**File:** `app/policies/[id]/change-requests/_components/create-cr-dialog.tsx:39-45`
**Severity:** MEDIUM
**Impact:** Step 1 of the dialog calls `trpc.feedback.list.useQuery({ documentId, status: undefined })` which returns ALL feedback items regardless of status, then filters client-side for `accepted` / `partially_accepted`. For a document with hundreds of submitted/rejected items this ships all rows to the client and filters the list in JS. The server accepts a `status` input that could reduce the payload significantly.
**Suggested fix:** Pass `statuses: ['accepted', 'partially_accepted']` to the query input to let the server filter.

---

## S15: Workshop feedback form — `Turnstile` is absent; the JWT is the only gate but the token nonce check (`workshopFeedbackTokenNonces`) is inside the transaction AFTER five rate-limit slots are burned
**File:** `app/api/intake/workshop-feedback/route.ts:106-112`
**Severity:** MEDIUM
**Impact:** The per-token rate limit is 5 req/min (line 106). Since the token replay check (B13) happens *inside* the transaction (lines 254-258), the pre-check (lines 123-129) is a non-transactional SELECT and can be bypassed by concurrent requests that both pass the pre-check before either commits the nonce write. The per-token rate limit (5/min) partially mitigates this, but in the window of 5 concurrent requests all sharing a valid token, multiple feedback rows could be inserted before the nonce write of the first commit forces the others to roll back. The `onConflictDoNothing` in the transaction means the nonce insert for the second concurrent request silently succeeds without a unique-conflict throw, and the feedback insert above it is already committed.
**Suggested fix:** Use a database-level advisory lock or change the transaction to do a `INSERT ... ON CONFLICT DO NOTHING RETURNING tokenHash` and abort the rest of the transaction if no row is returned.

---

## S16: `participate-form.tsx` — when Turnstile site key is absent, button is permanently disabled with no explanation for users
**File:** `app/participate/_components/participate-form.tsx:176,177`
**Severity:** MEDIUM
**Impact:** When `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY` is not set (production misconfiguration), the Turnstile widget is replaced by a plain `<p>Security widget unavailable in this environment.</p>` and `turnstileToken` stays `null`, so `canSubmit` is `false` and the button is permanently disabled. The user sees a grayed-out button and an informational message that reads like a developer note, not a user-friendly error. They cannot submit the form at all.
**Suggested fix:** When the site key is missing, either auto-set `turnstileToken` to a sentinel value (if the server also skips verification in dev/staging) or show a prominent error message with "Service temporarily unavailable. Please try again later or contact us."

---

## S17: `MilestonesPage` and `MilestoneDetailPage` are `'use client'` components that call `trpc.user.getMe` without Suspense or error boundaries
**File:** `app/policies/[id]/milestones/page.tsx:1`, `app/policies/[id]/milestones/[milestoneId]/page.tsx:1`
**Severity:** MEDIUM
**Impact:** Both pages are `'use client'` and call tRPC directly in the component body (not in a Suspense-wrapped sub-tree). If the `getMe` or `getById` query fails (expired session, DB error), the page will render with `role = undefined` or `data = undefined`. For the milestones list, `canManage` silently stays `false` so the Create button disappears without explanation. For the detail page, `error || !data` calls `notFound()` directly — which is not allowed in client components in Next.js and throws a runtime exception.
**Suggested fix:** Convert pages to server components or add explicit error-state rendering; do not call `notFound()` in a `'use client'` component.

---

## S18: `FeedbackInbox` uses `useSearchParams()` inside the component (not in a leaf) — missing per-component Suspense boundary
**File:** `app/policies/[id]/feedback/_components/feedback-inbox.tsx:21`
**Severity:** LOW
**Impact:** `FeedbackInbox` calls `useSearchParams()` at the top of the component. The parent page wraps it in `<Suspense>`. However, `feedback-inbox.tsx` has `useState` and is the main layout component — if the Suspense boundary is shared with loading UI for other queries, a waterfall can cause the entire inbox layout (filter panel, header) to flash into a blank fallback state on navigation. This is a correctness concern for the Suspense model but currently works because the fallback is `null`.
**Suggested fix:** Move the `useSearchParams()` call into a smaller child component that only needs the selected-item state and wrap just that in Suspense.

---

## S19: Workshop feedback form shows success state (`setSubmitted(true)`) without any `aria-live` announcement when transitioning from the form to the success card
**File:** `app/participate/_components/workshop-feedback-form.tsx:100,129`
**Severity:** LOW
**Impact:** On successful submission, the form is replaced by a success `<Card role="status" aria-live="polite">`. Because the card is mounted into the DOM only after the form unmounts, some screen readers may not pick up the `aria-live` content on initial mount. The pattern for accessible success transitions requires either an always-present live region that gets its content set, or a focus move.
**Suggested fix:** Add `autoFocus` on the success card's `<h2>` (or move focus programmatically via `useEffect + ref`) so keyboard/SR users are landed on the confirmation message.

---

## S20: `SectionAssignments` unassign button has no confirm dialog and no `aria-label` for the X button
**File:** `app/policies/[id]/_components/section-assignments.tsx:119-123`
**Severity:** LOW
**Impact:** Clicking the `X` badge button immediately fires `unassignMutation` with no confirmation. Accidental unassignment removes the user's ability to submit feedback on the section without their knowledge. The button also has no accessible label — SR users hear only "button" with no indication of which user is being removed.
**Suggested fix:** Add `aria-label={`Remove ${user.name ?? user.email}`}` to the unassign button; optionally wrap in a simple confirm toast/dialog for destructive safety.

---

## S21: `listOwn` returns entire `feedbackItems.*` row including internal fields (`milestoneId`, `reviewedBy`, `decisionRationale`)
**File:** `src/server/routers/feedback.ts:246-254`
**Severity:** LOW
**Impact:** `feedback.listOwn` uses `db.select()` (no column list) returning every column, including `reviewedBy` (reviewer's user UUID), `milestoneId` (internal milestone link), and `decisionRationale`. These fields are intended for admin/reviewer views. Submitters can read the raw decision rationale from the API response before it is formally communicated to them through the outcome notification flow. The `decisionRationale` column is also separately returned in `getById`, but `listOwn` ships it in bulk across all items.
**Suggested fix:** Add an explicit column selection to `listOwn` that excludes `reviewedBy` and aligns with what the submitter is meant to see.

---

## S22: `MyOutcomesTab` scroll-to anchor depends on DOM `id` matching `outcome-row-${item.id}` but `item.id` is a UUID — very long IDs cause attribute warnings in some browsers
**File:** `app/feedback/_components/my-outcomes-tab.tsx:44,119`
**Severity:** LOW
**Impact:** `document.getElementById(\`outcome-row-${initialSelected}\`)` where `initialSelected` is a UUID from `?selected=<uuid>`. HTML `id` attributes with UUIDs are valid but the `scrollIntoView` call will silently no-op if the notification deep-link's `entityId` is the feedback's internal UUID but `listOwn` returns the same UUID under `item.id`. This is fine as long as the notification `linkHref` uses the DB UUID (not the readable `FB-NNN` id). Confirmed the `listOwn` items expose `item.id` (UUID), and notifications use `updated.id` in `startReview` / `close`, so this should work. No code bug — calling out for completeness.
**Suggested fix:** No action needed — confirmed correct.

---

## S23: `EvidenceGapsTab` Section filter is disabled (`disabled={!documentId}`) but shows no tooltip or explanation to the user
**File:** `app/feedback/_components/evidence-gaps-tab.tsx:128`
**Severity:** LOW
**Impact:** The section `Select` is `disabled` until a document is chosen. There is no visual hint (tooltip, helper text, or `title` attribute) explaining why the field is disabled. A user who clicks the grayed dropdown will have no context.
**Suggested fix:** Add `title="Select a document first"` to the disabled `Select` or add a `<p>` helper text beneath it that conditionally reads "Select a document to filter by section".

---

## S24: `WorkshopFeedbackForm` — no protection against re-submit after a network error clears `submitting` state
**File:** `app/participate/_components/workshop-feedback-form.tsx:55,84`
**Severity:** LOW
**Impact:** If submission fails (network error, 500), `setSubmitting(false)` in the `finally` block re-enables the button. A user who clicks Submit again fires a second request with the same token. The second request will succeed (the nonce was not burned by the failed first request), producing a duplicate feedback row under the same token. The per-token rate-limit of 5/min is the only backstop.
**Suggested fix:** After a non-transient failure (anything except network timeout), set `topError` and disable the button permanently with a message telling the user to reload the page.

---

## S25: `participate-form.tsx` — `topError` alert is rendered but Turnstile token is NOT reset after a 403, so the next submit attempt re-uses the already-verified (and server-rejected) token
**File:** `app/participate/_components/participate-form.tsx:144-146`
**Severity:** LOW
**Impact:** On a Turnstile verification failure (403), the client shows an error but `turnstileToken` is not cleared. The Turnstile widget has already fired `onSuccess` and the token is now spent. Re-submitting will fail again at the server with the same 403 because the token has been verified once and Cloudflare marks it used. The user is stuck unless they reload the page.
**Suggested fix:** Call `setTurnstileToken(null)` inside the `res.status === 403` branch and programmatically call `.reset()` on the Turnstile widget ref.

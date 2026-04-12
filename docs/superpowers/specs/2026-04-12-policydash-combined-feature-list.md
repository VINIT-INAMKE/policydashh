# PolicyDash — Combined Feature List (Gap Analysis)

**Date:** 2026-04-12
**Sources merged:** `newDoc1.md` (Verifiable Policy OS — architecture, internal automation, Cardano anchoring) + `newDoc2.md` (Instance Structure — 5-page public site, 7 n8n/Make flows, CMS collections, policy-grade visual direction)
**Purpose:** Give a domain-organized feature list of what the merged product vision looks like, tagged against the current PolicyDash codebase so every feature has a clear "what to do next" signal.

All external workflow tooling (n8n, Make) is replaced with **coded automations** — typed events + handlers running on an in-repo job/queue runtime. No SaaS glue.

---

## Gap tag legend

| Tag | Meaning |
|---|---|
| `BUILT` | Shipped in the current codebase and matches the doc intent. |
| `BUILT+` | Shipped *and exceeds* the doc (PolicyDash is stricter, more structured, or more auditable than the doc describes). |
| `EXTEND` | Core exists; needs additional work to fully match the merged vision. |
| `NEW` | Absent; needs full build. |
| `FIXUP` | Previously working or half-wired; currently broken/regressed and needs repair before it can be used. |

Each feature row uses this format:

```
### <feature name>
- Tag: <BUILT | BUILT+ | EXTEND | NEW | FIXUP>
- Source: <newDoc1 | newDoc2 | both | existing>
- What: 1–2 sentences
- Gap: concrete delta against the current codebase
- Notes (optional): dependencies, related automation events, risks
```

---

## What PolicyDash already does better than the docs

Before the gap list, a short punch list of things the current codebase does *more rigorously* than either doc describes. These are not gaps — they are strengths the merged spec should preserve, not downgrade.

- **Formal state machines for feedback + CR lifecycles.** `src/server/machines/feedback.machine.ts` and `changeRequest.machine.ts` (XState) enforce legal transitions and persist a snapshot per entity. The docs describe status fields; PolicyDash enforces state legality in code.
- **Seven roles with section-level RBAC middleware.** `src/db/schema/users.ts` (admin, policy_lead, research_lead, workshop_moderator, stakeholder, observer, auditor) + `src/server/rbac/section-access.ts` (`requireSectionAccess` chains with `requirePermission`). newDoc1 only mentions four flat roles with no scoping primitive.
- **Readable IDs + full traceability matrix.** `FB-XXX` and `CR-XXX` (PostgreSQL sequences), and `src/server/routers/traceability.ts` exposes a filterable FB→CR→Section→Version matrix with org-type, decision, and version-range filters. The docs describe traceability as an aspiration; PolicyDash has it as a query surface.
- **Inline comment marks on Tiptap + persisted comment threads.** `src/db/schema/collaboration.ts` has `commentThreads` + `commentReplies`, and Tiptap carries an inline-comment mark with CSS highlight. Neither doc mentions inline commenting.
- **Immutable partitioned audit log with typed actions.** `src/db/schema/audit.ts` is range-partitioned by timestamp and captures `action`, `actorRole`, `entityType`, `payload`, `ipAddress`. Caller sites exist for `FEEDBACK_SUBMIT`, `FEEDBACK_START_REVIEW`, `WORKSHOP_CREATE`, `EVIDENCE_PACK_EXPORT`, and more. newDoc1 says "every action = structured" without specifying how; PolicyDash does.
- **Word-level section diff + public changelog + consultation summary.** `src/server/services/version.service.ts` has `computeSectionDiff` (diffWords), and the public portal already renders `/portal/[policyId]/changelog` and `/portal/[policyId]/consultation-summary` from real data.
- **Policy PDF export + evidence pack ZIP export, both shipped.** `app/api/export/policy-pdf/[versionId]/route.tsx` uses `@react-pdf/renderer`; `app/api/export/evidence-pack/route.ts` uses `fflate` for ZIP. These are the backbone of newDoc2's "milestone export" flow and they already exist.
- **Anonymity enforcement at the server.** `feedback.ts` server-side nulls out `submitterId/Name/OrgType` when `isAnonymous=true` and the caller is not admin/policy_lead. Not just a schema field — an enforced invariant.
- **S3 upload route already wired.** `app/api/upload/route.ts` + `@aws-sdk/client-s3` + `s3-request-presigner` already in `package.json`. Evidence storage has an object backend; newDoc2 assumes this must be stood up.
- **tRPC + Drizzle end-to-end, not Airtable/Tally/Sheets.** newDoc2's "pulled from Tally / Sheets / Airtable" for feedback and stakeholders is explicitly replaced — everything lives in Postgres with typed routers.

The merged spec below assumes these strengths stay.

---

## Domain 1 — Public Site

The merged spec expands the current `/portal` (read-only policy viewer) into a **policy-grade 5-page public site** that handles discovery, research publication, framework presentation, workshop discovery, and structured participation intake.

### Homepage — "choose your path" splitter
- Tag: `NEW`
- Source: newDoc2
- What: Public landing with project purpose, "why India" framing, milestone strip, four-way path splitter ("understand the policy" / "contribute expert feedback" / "institution or regulator" / "track progress transparently"), active consultation CTA, and latest outputs strip.
- Gap: `app/page.tsx` currently redirects authed users to `/dashboard` and everyone else to `/portal`. No dedicated landing exists. `/portal` is a policy grid, not a hero.
- Notes: Splitter is a layout/navigation decision, not new data. Each path routes to an existing page (research, participate, workshops, portal).

### Research page
- Tag: `NEW`
- Source: newDoc2
- What: Executive summary, current landscape, key gap clusters, downloadable report, CTA to join consultation.
- Gap: No research content type, no research page route, no downloadable-asset handling.
- Notes: Needs a lightweight `researchReports` table (or reuse evidence artifacts) + a public `/research` route. Report file served via existing S3 upload route.

### Framework overview page (public)
- Tag: `EXTEND`
- Source: newDoc2
- What: Public view of the current draft framework — scope, section cards, consultation status, "what changed" log, CTA to validate the draft.
- Gap: `/portal/[policyId]` already renders sections + version selector + changelog + consultation summary. Framework page is essentially a **themed, named landing** for one published policy (the "active" one) with the section cards laid out as first-class UI rather than nested inside the portal grid.
- Notes: Can be implemented as a marketing skin over the existing public policy detail page.

### Public workshops calendar
- Tag: `EXTEND`
- Source: newDoc2
- What: Public page listing upcoming workshops, themes, who should attend, what participants receive, register CTA.
- Gap: `src/server/routers/workshop.ts` already has `list({filter: 'upcoming'})`, and workshop schema has title/description/scheduledAt/durationMinutes/registrationLink. The workspace page at `app/(workspace)/workshops/page.tsx` is auth-gated. Need a public mirror (`app/(public)/workshops/page.tsx`) and a public-safe tRPC procedure (no draft or internal metadata).
- Notes: Registration itself moves from external `registrationLink` URL to a first-class internal flow — see Workshop Registration (Domain 3).

### Participate page — role-routed intake
- Tag: `NEW`
- Source: newDoc2
- What: Single intake form on `/participate` that classifies visitors by role (regulator/government, industry/startup, legal/compliance, academia/research, civil society/public interest) and routes them to the right next step — workshop registration, briefing request, feedback submission, or tracking subscription.
- Gap: No public intake form anywhere. Clerk signup auto-assigns role from `public_metadata.role` (`app/api/webhooks/clerk/route.ts`), but there is no UI for the user to self-classify with org-type, affiliation, or interest area. `users.orgType` is nullable.
- Notes: Triggers `stakeholder.intake.submitted` event (see Automation Runtime, Flow 1). This is the most important new surface area for the public site — it is the front door to every other flow.

### Policy-grade visual system
- Tag: `EXTEND`
- Source: newDoc2
- What: Policy-grade aesthetic — white/off-white base, dark blue / slate typography, muted saffron or teal accent, document cards (not product cards), simple milestone bars, research-portal feel.
- Gap: `app/globals.css` has a modern oklch token system with neutral grays and *semantic* status colors (feedback/CR states, diff colors). There is no **brand** accent — no saffron, no teal, no policy-portal identity. Typography is well-developed for the editor (Tiptap/ProseMirror) but not for the marketing surface.
- Notes: Add brand tokens + a top-level brand layout for public pages. Keep semantic tokens untouched for workspace.

### Public site navigation + footer
- Tag: `EXTEND`
- Source: newDoc2
- What: Minimal header with path-splitter-aware nav, footer with legal/credits/contact.
- Gap: `app/(public)/layout.tsx` has a bare header (logo + "published policies" link) and a minimal footer. Needs to grow to host a five-page nav plus a participate CTA.

---

## Domain 2 — Stakeholder Intake & Onboarding

### Role classification from intake form
- Tag: `NEW`
- Source: newDoc2
- What: `/participate` form writes to `users` (role + orgType + affiliation) and emits `stakeholder.intake.submitted`. For unauthenticated submitters, create a **lead** row and convert to a user when they accept the Clerk invite.
- Gap: Role is currently set via Clerk dashboard `public_metadata` and ingested by the Clerk webhook. No self-service classification exists.
- Notes: Needs a `stakeholderLeads` table (or reuse `users` with a pending state). Lead→user conversion happens on first sign-in.

### Invite flow with tailored onboarding
- Tag: `EXTEND`
- Source: newDoc1 + newDoc2
- What: Invited stakeholders get role-aware onboarding: a policy_lead sees section-assignment next steps, a stakeholder sees their assigned sections and an "open consultation" CTA.
- Gap: `app/(workspace)/setup/page.tsx` is a spinner that polls Clerk webhook completion. No role-aware onboarding content.
- Notes: Once role + orgType are known, branch the setup page by role. No new data needed.

### Tailored welcome email
- Tag: `EXTEND`
- Source: newDoc2 (Flow 1)
- What: Role-specific welcome email with next steps (workshop list for workshop_moderator, assigned sections for stakeholder, etc.).
- Gap: `src/lib/email.ts` has fire-and-forget Resend wrappers (`sendFeedbackReviewedEmail`, `sendVersionPublishedEmail`, `sendSectionAssignedEmail`). No welcome email, no HTML templates, no retry.
- Notes: Handled by the intake event handler — see Automation Runtime, Flow 1.

### Section-level scoping (role + assignment)
- Tag: `BUILT+`
- Source: existing
- What: Stakeholders see only assigned sections, enforced at the tRPC procedure level.
- Gap: None. `requireSectionAccess` middleware (`src/server/rbac/section-access.ts`) already enforces this. Neither doc specifies this level of rigor.

---

## Domain 3 — Workshops

Workshop data model and CRUD are in place. The missing pieces are the **registration + notification lifecycle** and **artifact intake**.

### Workshop CRUD + linking
- Tag: `BUILT`
- Source: both
- What: Create/edit/list/detail, link to policy sections, link to feedback items, artifact counts.
- Gap: None. `src/server/routers/workshop.ts`, `src/db/schema/workshops.ts` (`workshops`, `workshopArtifacts`, `workshopSectionLinks`, `workshopFeedbackLinks`), `app/(workspace)/workshops/*`.

### Public workshop registration (first-class)
- Tag: `NEW`
- Source: newDoc2 (Flow 2)
- What: Public registration form on `/workshops/[id]` that captures attendee info (name, email, org, role), writes a `workshopRegistrations` row, emits `workshop.registration.created`.
- Gap: `workshops.registrationLink` is currently a free-text external URL — no internal intake, no attendee roster. Needs a new `workshopRegistrations` table (workshopId, email, name, orgType, role, status, createdAt).
- Notes: Triggers Flow 2 (confirmation email, calendar invite, reminders).

### Calendar invite (ICS) generation
- Tag: `NEW`
- Source: newDoc2 (Flow 2)
- What: On registration, generate an ICS file and attach to the confirmation email.
- Gap: No ICS library, no calendar route. Add `ics` npm package + a utility in `src/lib/calendar.ts`.
- Notes: Runs inside the `workshop.registration.created` handler.

### Pre-workshop reminder scheduling
- Tag: `NEW`
- Source: newDoc2 (Flow 2)
- What: Scheduled reminders (48h and 2h before `scheduledAt`) with the meeting link + feedback form URL.
- Gap: No scheduler, no delayed jobs. This is the **primary driver** for the automation runtime (Domain 9).
- Notes: Uses `schedule()` on the job runtime against `workshops.scheduledAt - 48h` and `- 2h`.

### Recording upload + attachment
- Tag: `EXTEND`
- Source: newDoc1
- What: Upload workshop recordings and attach them to a workshop as a typed artifact.
- Gap: S3 upload route exists (`app/api/upload/route.ts`), evidence schema exists (`evidenceArtifacts` + `workshopArtifacts` join), but there is no UI flow for "upload a recording to this workshop" and no automatic artifact-type classification.
- Notes: Add a workshop-detail upload panel. On success, emit `workshop.artifact.uploaded`.

### Attendance tracking
- Tag: `NEW`
- Source: newDoc2
- What: Record who attended (presence capture or post-workshop import).
- Gap: No `workshopAttendance` table. `workshopRegistrations` can track intent-to-attend, but actual attendance needs its own signal.
- Notes: Can be satisfied by marking registrations as `attended` post-session, or by importing from a meeting platform CSV.

### Auto-summary from recording
- Tag: `NEW` (optional)
- Source: newDoc1
- What: Auto-generate a workshop summary from the recording.
- Gap: No transcription or LLM pipeline.
- Notes: Low priority. Flag as optional — can be stubbed as a "paste your summary" text field until an LLM pipeline is justified.

### Per-workshop evidence checklist
- Tag: `EXTEND`
- Source: newDoc2 (Flow 3)
- What: Each workshop has a structured checklist of expected artifacts (registration export, screenshot, recording, attendance, summary, Tally responses, expert review, final export zip) with completion tracking.
- Gap: `workshopArtifacts` table exists with an `artifactType` enum, but there is no "required artifact" definition or completion signal. The checklist concept is absent.
- Notes: Add a `workshopArtifactRequirements` seed (per artifactType) and a derived completion view. Flow 3 emits `workshop.completed` and populates a checklist row-set.

### Workshop ↔ section + feedback linking
- Tag: `BUILT+`
- Source: both
- What: Link workshops to policy sections and feedback items.
- Gap: None. M2M joins already exist. Neither doc specifies this level of structure.

---

## Domain 4 — Feedback Loop

This domain is the most complete in the current codebase. Most gaps here are **polish**, not missing structure.

### Structured feedback submission (FB-XXX)
- Tag: `BUILT+`
- Source: both
- What: Section-scoped submission with readable ID, type (issue|suggestion|endorsement|evidence|question), priority, impact category, title, body, suggested change, anonymity flag.
- Gap: None. `src/server/routers/feedback.ts` `submit` procedure + `feedbackItems` schema. Readable IDs via PostgreSQL sequence. Enforces `requireSectionAccess` + `requirePermission('feedback:submit')`.

### Feedback lifecycle state machine
- Tag: `BUILT+`
- Source: both
- What: Submitted → under_review → accepted/partially/rejected → closed. XState machine with persisted snapshot.
- Gap: None. `src/server/machines/feedback.machine.ts`. Neither doc specifies state machine enforcement.

### Decision log + rationale
- Tag: `BUILT`
- Source: both
- What: Mandatory rationale on accept/reject, reviewer + timestamp captured.
- Gap: None. `feedbackItems.decisionRationale`, `reviewedBy`, `reviewedAt` fields, decision-transition mutations in the feedback router.

### Anonymity controls
- Tag: `BUILT+`
- Source: newDoc1
- What: Stakeholders choose named or anonymous; server-side enforcement nulls identity fields for non-privileged readers.
- Gap: None. Already enforced at query time in the feedback router.

### Feedback filtering (cross-dimension)
- Tag: `BUILT`
- Source: both
- What: Filter by section, stakeholder org type, priority, status, impact, type.
- Gap: None. `list`, `listAll`, `listOwn`, `listCrossPolicy` procedures.

### Normalization / auto-tagging (Flow 4)
- Tag: `EXTEND`
- Source: newDoc2 (Flow 4)
- What: Auto-map incoming responses to section codes and tag by issue type (classification, taxation, data security, governance) without requiring a human to pick from enums.
- Gap: PolicyDash currently requires the submitter to pick `sectionId`, `feedbackType`, and `impactCategory` at submission time. newDoc2's Flow 4 expects a **normalizer** that ingests loosely-structured responses (e.g., from a workshop form) and maps them to the right fields.
- Notes: Implement as an event handler on `feedback.external.ingested` — a heuristic or LLM-assisted mapper that writes a draft `feedbackItems` row for a policy_lead to accept. Keeps the strict schema and adds a soft intake path.

### Quote approval workflow
- Tag: `NEW`
- Source: newDoc2
- What: Per newDoc2 ops layer — "quote approval status" on raw responses, so an attributed quote only goes public after curator approval.
- Gap: No quote entity, no approval state.
- Notes: Can be a boolean + approver field on feedback items (`isQuotable`, `quoteApprovedBy`, `quoteApprovedAt`), or a separate `feedbackQuotes` table if quotes need their own content.

### Feedback notifications (in-app + email)
- Tag: `EXTEND`
- Source: newDoc2
- What: On status change, notify submitter in-app and by email.
- Gap: In-app notifications exist (`createNotification` called from `startReview`). Email exists (`sendFeedbackReviewedEmail`) but is fire-and-forget and plain text. No retry, no templates.
- Notes: Move into the automation runtime (Flow 4 / Flow 5) with retries and templated HTML.

---

## Domain 5 — Change Requests & Versioning

### CR-XXX creation from feedback
- Tag: `BUILT+`
- Source: both
- What: Create a CR from one or more feedback items, link to sections, assign owner, track lifecycle.
- Gap: None. `changeRequests` schema + `crFeedbackLinks` + `crSectionLinks`, full router.

### CR lifecycle state machine
- Tag: `BUILT+`
- Source: both
- What: drafting → in_review → approved → merged, with parallel close-from-any-state with rationale.
- Gap: None. `src/server/machines/changeRequest.machine.ts`.

### Section-level revisions + diff
- Tag: `BUILT+`
- Source: both
- What: Each version snapshots all sections; diff is word-level between snapshots.
- Gap: None. `documentVersions.sectionsSnapshot` + `computeSectionDiff` in `version.service.ts`.

### Auto-changelog from CR merge
- Tag: `BUILT`
- Source: both
- What: Merging a CR into a version produces changelog entries linked to source feedback IDs.
- Gap: Service-layer generation exists (`ChangelogEntry[]` in `documentVersions.changelog`). Public changelog page renders it.

### Public changelog view
- Tag: `BUILT`
- Source: newDoc2
- What: Public-facing "what changed" per policy.
- Gap: None. `/portal/[policyId]/changelog/page.tsx`.

### Consultation summary
- Tag: `BUILT+`
- Source: newDoc2
- What: Public accordion of feedback items resolved in a given version.
- Gap: None. `/portal/[policyId]/consultation-summary/page.tsx`. Neither doc specifies this.

### Auto-CR from feedback decision (Flow 5)
- Tag: `NEW`
- Source: newDoc2 (Flow 5)
- What: When a policy_lead marks feedback accepted/rejected, auto-generate a CR row (or append to an existing draft CR) and update the change log with the driver feedback codes.
- Gap: Today, CRs are created manually via the UI. Flow 5 auto-creates a draft CR when feedback is accepted.
- Notes: Event handler on `feedback.decided`. See Automation Runtime Flow 5.

### Manual version creation / rollback / branching
- Tag: `NEW` (low priority)
- Source: implied
- What: Create a version without a CR (hotfix), rollback to a prior version, branch a working copy.
- Gap: Absent. Not explicitly required by either doc.
- Notes: Defer unless needed by ops.

---

## Domain 6 — Evidence & Exports

### Evidence artifacts + feedback/section attachment
- Tag: `BUILT`
- Source: both
- What: Typed artifacts (file | link), attached to feedback and sections.
- Gap: None. `evidenceArtifacts` + `feedbackEvidence` + `sectionEvidence`.

### S3 upload route
- Tag: `BUILT`
- Source: newDoc1
- What: Authenticated file upload to S3 with presigned URLs.
- Gap: None. `app/api/upload/route.ts`, `@aws-sdk/client-s3`, `s3-request-presigner`.

### Evidence pack ZIP export
- Tag: `BUILT`
- Source: newDoc2 (Flow 7)
- What: On-demand ZIP of a document's evidence bundle.
- Gap: None. `app/api/export/evidence-pack/route.ts` + `evidence-pack.service.ts` + `fflate`.
- Notes: Flow 7 ("milestone pack") is essentially this, expanded to include stakeholder list + feedback matrix + revision matrix + latest draft PDF. Needs to become a composite export (Milestone Pack below).

### Policy draft PDF export
- Tag: `BUILT`
- Source: newDoc2 (Flow 7)
- What: Published version as styled PDF.
- Gap: None. `app/api/export/policy-pdf/[versionId]/route.tsx` + `@react-pdf/renderer`.

### Milestone pack (composite export) — Flow 7
- Tag: `EXTEND`
- Source: newDoc2 (Flow 7) + newDoc1
- What: Single "Build milestone pack" action that produces a zip containing: stakeholder list, workshop summaries, screenshots, recordings, feedback matrix, revision matrix, latest draft PDFs.
- Gap: The pieces exist (evidence pack ZIP, policy PDF, traceability CSV/PDF, feedback list). No composite assembler.
- Notes: Implement as a background job `milestone.pack.requested` that assembles the existing primitives into one zip and emails the caller a download link when done. Requires the job runtime (Domain 9).

### Per-workshop evidence checklist
- Tag: `EXTEND`
- Source: newDoc2 (Flow 3)
- What: See Workshop domain — each workshop has a derived checklist of expected artifacts with completion state.
- Gap: Checklist concept is missing.

### "Claims without evidence" view
- Tag: `BUILT`
- Source: newDoc1 + existing
- What: Research Lead view of feedback items claiming evidence that have no attached artifacts.
- Gap: None. `app/(workspace)/feedback/evidence-gaps/page.tsx`.

### Content hashing / verification-layer hooks
- Tag: `NEW` *(deferred to footnote)*
- Source: newDoc1
- What: SHA256 of policy version, workshop summary, feedback dataset, evidence bundle.
- Gap: Absent. Deferred — see Verification Layer footnote.

---

## Domain 7 — Traceability & Reporting

### FB→CR→Section→Version matrix
- Tag: `BUILT+`
- Source: both
- What: Filterable matrix with readable IDs, org-type, decision outcome, version range filters.
- Gap: None. `src/server/routers/traceability.ts` — neither doc describes a traceability **query surface**, only the concept.

### Per-stakeholder outcome view
- Tag: `BUILT`
- Source: newDoc1 + newDoc2
- What: "Here is the feedback you submitted, and here is how it was handled."
- Gap: None. `app/(workspace)/feedback/outcomes/page.tsx`.

### Per-section "what changed and why" view
- Tag: `BUILT`
- Source: both
- What: For a given section, show the feedback items that drove changes across versions.
- Gap: Diff service exists; UI exists. Confirmed via version.service.ts + public changelog.

### Traceability CSV / PDF export
- Tag: `BUILT`
- Source: both
- What: Export the traceability matrix.
- Gap: None. `app/api/export/traceability/csv/route.ts` + `app/api/export/traceability/pdf/route.tsx`.

### Time-series / velocity dashboards
- Tag: `NEW` (low priority)
- Source: newDoc2 (ops dashboard)
- What: Feedback velocity, decision rate, resolution time charts.
- Gap: Dashboard has counts; no time-series. Defer.

---

## Domain 8 — Governance & RBAC

### Seven-role model
- Tag: `BUILT+`
- Source: newDoc1
- What: admin, policy_lead, research_lead, workshop_moderator, stakeholder, observer, auditor.
- Gap: None. newDoc1 only names four roles.

### Section-level scoping
- Tag: `BUILT+`
- Source: existing (not in docs)
- What: Stakeholders see only sections they are assigned to; enforced at the tRPC middleware layer.
- Gap: None. `requireSectionAccess` middleware. Not described in either doc.

### Permission-keyed actions
- Tag: `BUILT`
- Source: implied
- What: Actions like `feedback:submit`, `feedback:review`, `workshop:manage`, `evidence:export`, `trace:read` are gated at the router.
- Gap: Full matrix not documented in one place — make the permission matrix canonical in a doc.

### Observer role (read-only view across policies)
- Tag: `BUILT`
- Source: newDoc1 (implied)
- What: Observer sees everything read-only without taking any workflow action.
- Gap: None. Role exists; permission matrix enforces read-only.

### Auditor role (read-only + export)
- Tag: `BUILT`
- Source: newDoc1
- What: Auditor sees everything and can export evidence + audit.
- Gap: None.

### Token-weighted voting
- Tag: `NEW` (optional / deferred)
- Source: newDoc1
- What: Optional weighted voting for approvals.
- Gap: Out of scope for v1. Leave as a footnote.

---

## Domain 9 — Automation Runtime (replaces n8n / Make)

**This is the biggest net-new domain.** Today there is no background job runtime: emails are fire-and-forget, notifications are synchronous, and there is no scheduler. newDoc2's 7 flows and newDoc1's internal event system both require a real queue.

### Runtime substrate
- Tag: `NEW`
- Source: newDoc1 + newDoc2 (replacement)
- What: A coded event/job runtime that supports typed events, background handlers, delayed/scheduled jobs, retries with backoff, and observability.
- Gap: Absent.
- Notes — runtime options (decide separately, not in this doc):
  - **pg-boss** — Postgres-backed job queue; no new infra since Postgres is already here. Best fit if we want zero new dependencies.
  - **Inngest** — typed, event-driven, great Next.js dev experience, managed or self-hosted. Best fit if we want step functions and schedules.
  - **BullMQ + Redis** — classic queue; needs Redis. Best fit only if Redis is already in the stack.
  - Recommendation: **pg-boss** for pragmatism, **Inngest** for DX. Pick one before implementing Flows 1–7.

### Typed event registry
- Tag: `NEW`
- Source: newDoc1
- What: Central registry of domain events with TypeScript types, emitted from mutations, consumed by handlers in `src/server/events/`.
- Gap: No event bus exists.
- Notes: The Clerk webhook + the fire-and-forget email calls inside mutations are the current informal "events". Formalize them.

### Email integrations (templated, retryable)
- Tag: `EXTEND`
- Source: newDoc2
- What: HTML email templates (React Email or MJML), retry with backoff, delivery webhook tracking.
- Gap: `src/lib/email.ts` is plain-text, fire-and-forget, no retries. Resend is integrated, React Email is not.
- Notes: Move email dispatch to a queued job. Add `react-email` + template components.

### Calendar (ICS) integration
- Tag: `NEW`
- Source: newDoc2 (Flow 2)
- What: Generate ICS attachments for workshop invites and reminders.
- Gap: No calendar library.
- Notes: Add `ics` npm package. Used by Flow 2.

### Object-storage integration (already present)
- Tag: `BUILT`
- Source: newDoc1
- What: S3 upload/download with presigned URLs.
- Gap: None. Used by Flow 3 and Flow 7.

### The seven flows, re-expressed as typed events + handlers

Each flow below is a concrete event + handler chain. Handlers are ordered and marked `sync` (inside the request) or `job` (background via the runtime).

#### Flow 1 — Stakeholder intake
```
Event:    stakeholder.intake.submitted
Trigger:  POST /participate (form submission)
Handlers:
  1. sync  classifyRoleAndOrgType(payload) — rule-based router from form fields
  2. sync  upsertStakeholderLead(classified) — write to users (or stakeholderLeads) row
  3. job   sendTailoredWelcomeEmail(leadId) — React Email template per role
  4. job   addToDefaultWorkshopInviteList(leadId, orgType)
  5. job   writeAuditLog({action: 'STAKEHOLDER_INTAKE_SUBMITTED', ...})
Integrations: Resend (email), S3 (if the intake uploads a profile/affiliation doc)
Replaces: Flow 1 (Form submit → classify → Airtable → email → invite list)
```

#### Flow 2 — Workshop registration
```
Event:    workshop.registration.created
Trigger:  POST /workshops/[id]/register
Handlers:
  1. sync  validateAndWriteRegistration(input) — writes workshopRegistrations row
  2. job   sendConfirmationEmail(registrationId) — with ICS attachment
  3. job   scheduleReminderAt(registrationId, scheduledAt - 48h, 'reminder-48h')
  4. job   scheduleReminderAt(registrationId, scheduledAt -  2h, 'reminder-2h')
  5. job   writeAuditLog({action: 'WORKSHOP_REGISTERED', ...})

Event:    workshop.reminder.due (fired by the scheduler at the target time)
Handlers:
  1. job   sendReminderEmail(registrationId, reminderKey) — includes meeting link + feedback form URL
  2. job   writeAuditLog({action: 'WORKSHOP_REMINDER_SENT', ...})
Integrations: Resend, ics, pg-boss/Inngest scheduler
Replaces: Flow 2 (Registration → confirmation → calendar → 48h reminder → 2h reminder → Zoom link)
```

#### Flow 3 — Post-workshop evidence
```
Event:    workshop.completed
Trigger:  policy_lead marks workshop complete (UI action)
Handlers:
  1. sync  transitionWorkshopToCompleted(workshopId)
  2. job   materializeEvidenceChecklist(workshopId) — seeds workshopArtifactRequirements rows
  3. job   emailArtifactUploadRequest(workshopId) — links to upload UI
  4. job   writeAuditLog({action: 'WORKSHOP_COMPLETED', ...})

Event:    workshop.artifact.uploaded
Trigger:  POST /api/upload success with workshopId + artifactType
Handlers:
  1. sync  attachArtifactToWorkshop(workshopId, artifactId)
  2. job   markChecklistItemComplete(workshopId, artifactType)
  3. job   maybeEmitMilestoneReady(workshopId) — if checklist is fully green
Integrations: S3, Resend
Replaces: Flow 3 (Workshop complete → checklist → upload request → attach artifacts)
```

#### Flow 4 — Feedback normalization
```
Event:    feedback.external.ingested
Trigger:  Any external intake — e.g., a workshop form, an email import, a CSV upload
Handlers:
  1. job   normalizeToSchema(rawResponse) — heuristic or LLM-assisted mapper that produces a draft feedbackItems row (sectionId, feedbackType, impactCategory)
  2. job   writeDraftFeedbackItem(draft) — status=pending_review, flagged=auto_normalized
  3. job   notifyPolicyLead(documentId) — in-app + email
  4. job   writeAuditLog({action: 'FEEDBACK_AUTO_NORMALIZED', ...})
Integrations: Resend, (optional) LLM provider
Replaces: Flow 4 (Tally → map to section → tag → push into feedback table)
Note: Strict first-party submissions via /trpc feedback.submit are unchanged. This flow is only for loose/external intake.
```

#### Flow 5 — Revision engine
```
Event:    feedback.decided
Trigger:  Feedback transitions to accepted | partially_accepted | rejected
Handlers:
  1. sync  (already exists) write decisionRationale + reviewedBy + reviewedAt
  2. sync  (already exists) persist XState snapshot
  3. job   upsertDraftCRForDecision(feedbackId, decision) — if no open draft CR covers this section, create one; else append the feedback to the existing CR via crFeedbackLinks
  4. job   appendChangelogEntry(crId, feedbackReadableId)
  5. job   sendFeedbackReviewedEmail(submitterId) — templated, retryable
  6. job   createNotification(submitterId, 'feedback_status_changed')
Integrations: Resend
Replaces: Flow 5 (Feedback accepted/rejected → generate revision row → update change log → link driver feedback codes → surface "what changed")
Note: Handlers 1, 2, 5, 6 already exist in the feedback router — move them into the event handler chain for retry + observability.
```

#### Flow 6 — Expert review
```
Event:    framework.expert_review.requested
Trigger:  policy_lead clicks "Send for expert review" on a document version
Handlers:
  1. sync  markVersionReadyForReview(versionId)
  2. job   buildReviewerPacket(versionId) — assembles policy PDF + changelog + traceability CSV into a zip via existing exports
  3. job   emailReviewerPacket(versionId, reviewerUserIds) — with packet URL
  4. job   writeAuditLog({action: 'EXPERT_REVIEW_REQUESTED', ...})

Event:    framework.expert_review.responded
Trigger:  reviewer posts their written response (via a review form OR an email intake)
Handlers:
  1. sync  writeExpertReviewArtifact(versionId, reviewerId, responseBody) — stored as an evidenceArtifacts row + feedbackEvidence or sectionEvidence link
  2. job   notifyPolicyLead(versionId)
  3. job   writeAuditLog({action: 'EXPERT_REVIEW_RECEIVED', ...})
Integrations: Resend, S3 (for PDF packets)
Replaces: Flow 6 (Mark framework ready → send packet → collect response → attach to milestone)
Note: No new entity needed. Reuse evidence artifacts + audit log.
```

#### Flow 7 — Milestone export (composite pack)
```
Event:    milestone.pack.requested
Trigger:  policy_lead clicks "Build milestone pack" on a document or version
Handlers:
  1. sync  writeMilestoneExportRecord(requestedBy, documentId, versionId) — tracks the pending export
  2. job   buildEvidencePackZip(documentId) — reuse evidence-pack.service.ts
  3. job   buildPolicyPdf(versionId) — reuse policy-pdf route as a library call
  4. job   buildTraceabilityCsv(documentId) — reuse traceability csv route as a library call
  5. job   buildStakeholderList(documentId) — new, derives from users + sectionAssignments + feedbackItems
  6. job   buildFeedbackMatrixCsv(documentId) — new, derives from traceability
  7. job   buildRevisionMatrixCsv(documentId) — new, derives from changeRequests + documentVersions
  8. job   composeMasterZip(parts) — fflate zip of all parts
  9. job   uploadMasterZipToS3(zipBuffer) — presigned URL
 10. job   emailDownloadLink(requestedBy, s3Url)
 11. job   writeAuditLog({action: 'MILESTONE_PACK_EXPORTED', ...})
Integrations: S3, Resend, fflate, @react-pdf/renderer
Replaces: Flow 7 (Build milestone pack → zip all the things)
Note: Steps 2–4 already exist as HTTP routes. Extract their logic into library functions so handlers can call them directly.
```

### Observability
- Tag: `NEW`
- Source: implied
- What: Each job has structured logs; failures surface in an internal "job runs" dashboard.
- Gap: No job observability today.
- Notes: pg-boss has a jobs table; Inngest has its own UI. Either is acceptable.

---

## Domain 9a — Third-party integrations

The automation runtime (Domain 9) is the substrate; this section enumerates the external services it talks to, grouped by concern. Every choice below is **decided** — not a menu of options. Deferred items are marked explicitly. These integrations overlap with existing feature rows (email in Domain 12, captcha in Domain 1, etc.); they are grouped here as an integration inventory, not counted as additional feature rows.

### Email — Resend
- Status: `BUILT` (wrapper) / `EXTEND` (templates + webhook)
- Role: Transactional email for all seven flows — welcome, confirmations, reminders, feedback-reviewed notifications, reviewer packets, milestone download links.
- Setup:
  1. Add React Email templates under `src/emails/`.
  2. Wire Resend webhook at `/api/webhooks/resend` to capture delivery / bounce / complaint events into a new `emailDeliveries` table.
  3. Configure DKIM / SPF / DMARC for the sending domain.
- Consumed by: Flows 1–7.

### Inbound email — Resend Inbound
- Status: `NEW` (optional)
- Role: Receive replies as structured intake for expert review responses (Flow 6), so reviewers can reply to an email rather than log in and fill a form.
- Setup: Configure a dedicated inbound address in Resend; add `/api/webhooks/resend-inbound` to parse and persist responses as `evidenceArtifacts` rows linked via `feedbackEvidence` / `sectionEvidence`.
- Consumed by: Flow 6 (optional — form submission remains the default path).
- Decision: Implement only if reviewers push back on using a form. Not on the critical path.

### 1:1 scheduling — Cal.com
- Status: `NEW`
- Role: Handle 1:1 scheduling for the **"institution / regulator → request a briefing"** path on the participate splitter. Group workshops do **not** go through Cal.com — they use internal workshop registration (Flow 2).
- Setup:
  1. Self-host Cal.com (Docker) or use Cal.com managed.
  2. Create an event type for "policy briefing" (30 / 45 / 60 min variants).
  3. Embed Cal.com widget on `/participate/briefing` via `@calcom/embed-react`.
  4. Configure a Cal.com webhook at `/api/webhooks/calcom` that emits `briefing.booked` into the internal event bus. Handler sends a tailored confirmation + adds the booking to the organizer's Google Calendar via our existing Google integration.
- Consumed by: Flow 1 (briefing path branch).
- Why Cal.com over Calendly: OSS, self-hostable, no SaaS lock-in, fits the "coded automation, no external workflow SaaS" constraint.

### Calendar + meetings — Google Calendar + Google Meet
- Status: `NEW`
- Role:
  1. Create calendar events for workshops on workshop publish.
  2. Auto-generate a Google Meet link via `conferenceData.createRequest` in the Calendar API — zero extra API calls, Meet link comes for free with the event.
  3. Invite registered attendees to the event so Google sends its native reminders alongside our own.
  4. Create calendar events for Cal.com-booked 1:1 briefings (see above).
- Setup:
  1. Create a Google Cloud project, enable Google Calendar API.
  2. Create a service account with domain-wide delegation (if on Google Workspace) OR an OAuth2 client for a single shared organizer account.
  3. Store credentials as `GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON` or OAuth token pair in env.
  4. Add `src/lib/google-calendar.ts` wrapper exposing `createWorkshopEvent()`, `inviteAttendee()`, `cancelEvent()`.
- Consumed by: Flow 1 (briefing calendar events), Flow 2 (workshop calendar events + Meet link).
- Why Google Meet over Zoom: simpler setup (one OAuth / one service account), no separate paid Zoom account, Meet link is free with the calendar event.
- **Recording pull is DEFERRED**: Meet recordings live in the organizer's Drive, not directly addressable via Calendar API, and extracting them requires the Drive API + extra scopes. Flow 3's post-workshop evidence upload stays **manual for v1** — organizer uploads the recording themselves via the existing S3 upload route.

### ICS generation — `ics` npm package
- Status: `NEW`
- Role: Generate `.ics` attachments for workshop confirmation emails as a belt-and-suspenders complement to Google Calendar invites (covers attendees not on Google Workspace).
- Setup: `npm install ics`; add `src/lib/ics.ts` wrapper with `buildWorkshopIcs(workshop, attendee)`.
- Consumed by: Flow 2.

### File storage — AWS S3
- Status: `BUILT`
- Role: Evidence artifacts (Flow 3), reviewer packets (Flow 6), milestone pack zips (Flow 7).
- Setup: Already wired. No changes.

### Authentication — Clerk
- Status: `BUILT`
- Role: Workspace auth + role provisioning via webhook.
- Setup: Already wired. No changes.

### Captcha — Cloudflare Turnstile
- Status: `NEW`
- Role: Protect public forms (participate intake, workshop registration, briefing request) from automated spam. Uses the existing Cloudflare account — no new vendor.
- Setup:
  1. In the existing Cloudflare dashboard, enable Turnstile and create a site key for the PolicyDash domain.
  2. Install `@marsidev/react-turnstile` for the React widget.
  3. Add `src/lib/turnstile.ts` with a `verifyTurnstileToken(token, ip)` helper that POSTs to `https://challenges.cloudflare.com/turnstile/v0/siteverify`.
  4. Gate every public form submission behind the verifier at the tRPC procedure layer.
- Consumed by: Flow 1 (all public forms), Flow 2 (public workshop registration), Flow 1 briefing path (Cal.com embed page).

### LLM inference — Groq Cloud API
- Status: `NEW` (Flow 4 only)
- Role: Auto-categorize loosely-structured feedback intake into `sectionId` + `feedbackType` + `impactCategory` as a draft for policy_lead review. Runs inside Flow 4's `normalizeToSchema` handler.
- Setup:
  1. Create a Groq Cloud account, generate an API key.
  2. Use Groq's OpenAI-compatible endpoint: point the standard `openai` SDK at `https://api.groq.com/openai/v1` with the Groq API key. No separate SDK needed.
  3. Default model: `llama-3.3-70b-versatile` for quality; fall back to `llama-3.1-8b-instant` for cost if rate limits bite.
  4. Add `src/lib/groq.ts` with `categorizeFeedback(rawResponse, documentSections)` — a structured-output prompt that returns `{sectionId, feedbackType, impactCategory, confidence}`.
  5. Add a `heuristicCategorizer()` fallback that runs if Groq is unavailable or returns low confidence, so the intake path never blocks.
- Consumed by: Flow 4.
- Why Groq: generous free tier, very fast inference (sub-second), OpenAI-compatible API so the provider can be swapped later without rewriting handlers.

### Analytics — Plausible
- Status: `NEW`
- Role: Privacy-friendly page analytics for the public site only (not the workspace). Cookie-free, GDPR-friendly, appropriate for a policy-grade site.
- Setup:
  1. Self-host Plausible via Docker or use Plausible Cloud.
  2. Add the Plausible script tag to `app/(public)/layout.tsx` only — explicitly exclude workspace routes.
  3. Register custom events: `participate_form_submitted`, `workshop_registered`, `briefing_requested`, `research_report_downloaded`.
- Consumed by: public site pages (Domain 1).

### SMS reminders — Twilio
- Status: `NEW` (optional, gated by user opt-in)
- Role: Optional SMS reminders for workshops (T-24h and T-2h) alongside email, for high-signal reminder delivery.
- Setup:
  1. Create a Twilio account (starts with ~$15 trial credit, ~1500 SMS for development — the easiest free starting point).
  2. Store `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` in env.
  3. Install `twilio` SDK, add `src/lib/sms.ts` with `sendSms(to, body)`.
  4. Add `users.smsOptIn` boolean column (defaults false) — SMS is only sent to users who have explicitly opted in. Unsolicited SMS is regulated and must not be the default.
  5. Flow 2's reminder handler checks `smsOptIn` and fans out email + (optionally) SMS.
- Consumed by: Flow 2 (workshop reminders).
- Why Twilio for now: easiest setup, best SDK, free trial covers all development. For India-production cost optimization, swap to MSG91 or Fast2SMS later — both offer India-specific pricing but need more setup friction. That swap is a flagged future optimization, not a decision for v1.

### Error monitoring — Sentry
- Status: `DEFERRED`
- Decision: Skip for now. Revisit before production launch. Structured logs to stdout and the job runtime's own failure surface are sufficient during build.

### Environment variables introduced by this section

| Service | New env vars | Already set |
|---|---|---|
| Resend | `RESEND_WEBHOOK_SECRET` | `RESEND_API_KEY` |
| Cal.com | `CALCOM_API_KEY`, `CALCOM_WEBHOOK_SECRET`, `NEXT_PUBLIC_CALCOM_EMBED_URL` | — |
| Google Calendar | `GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON` *(or OAuth pair)*, `GOOGLE_CALENDAR_ORGANIZER_EMAIL` | — |
| AWS S3 | — | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET` |
| Clerk | — | `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SECRET` |
| Cloudflare Turnstile | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | — |
| Groq Cloud | `GROQ_API_KEY` | — |
| Plausible | `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRC` | — |
| Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` | — |

### Per-flow integration map

| Flow | Integrations consumed |
|---|---|
| Flow 1 — Stakeholder intake | Turnstile, Resend, *(briefing path)* Cal.com + Google Calendar |
| Flow 2 — Workshop registration | Turnstile, Resend, `ics`, Google Calendar + Meet, *(optional)* Twilio |
| Flow 3 — Post-workshop evidence | S3, Resend (recording import via Meet **deferred**) |
| Flow 4 — Feedback normalization | Groq (+ heuristic fallback), Resend |
| Flow 5 — Revision engine | Resend |
| Flow 6 — Expert review | S3, `@react-pdf/renderer`, Resend, *(optional)* Resend Inbound |
| Flow 7 — Milestone export | S3, `@react-pdf/renderer`, `fflate`, Resend |

---

## Domain 10 — Design System & Visual Direction

### Semantic token system (existing)
- Tag: `BUILT+`
- Source: existing
- What: oklch semantic tokens for feedback/CR/diff status + base/background/foreground/ring/sidebar tokens. Dark mode supported.
- Gap: None. Exceeds doc requirements.

### Brand layer (policy-grade)
- Tag: `EXTEND`
- Source: newDoc2
- What: Off-white base + slate/dark-blue type + muted saffron or teal accent, document-card styling, simple milestone bars.
- Gap: Brand tokens are missing. Semantic tokens stay; add a brand layer for public pages only (logo, accent, marketing typography).
- Notes: Scope brand tokens to `app/(public)/**` so workspace visual identity is unaffected.

### Public-surface typography
- Tag: `EXTEND`
- Source: newDoc2
- What: Editorial typography for public pages (research, framework) vs. editor typography (workspace).
- Gap: Tiptap/ProseMirror typography is well-developed in `globals.css`. Public pages currently inherit the same styles.
- Notes: Add a `prose-policy` variant or a separate stylesheet for the public layout.

### Milestone strip / document card components
- Tag: `NEW`
- Source: newDoc2
- What: Reusable components for milestone progress bars, document cards, path-splitter cards.
- Gap: Absent.

---

## Domain 11 — Project Layer

### Top-level "Project" entity
- Tag: `NEW`
- Source: newDoc1 + newDoc2 ("India Blockchain Policy" as the active project)
- What: A named project wrapping policy documents, workshops, milestones, evidence, and public-site configuration.
- Gap: PolicyDash is single-workspace flat. `policyDocuments` is the top-level entity; there is no project grouping.
- Notes: Minimum viable project layer:
  - `projects` table: id, slug, name, description, accentColor, heroCopy, isPublic, createdAt.
  - `projectDocuments` (FK to policyDocuments).
  - `projectWorkshops` (FK to workshops).
  - Public pages (hero, research, framework, workshops, participate) scope to project via `/p/[slug]/*` or via a single "active project" pointer.
  - All cross-policy queries (traceability, feedback listCrossPolicy) gain an optional projectId filter.
- Risk: This is a **structural refactor**. It touches routers, schema, RBAC, and public routing. Land it before the public site so the public site can be project-scoped from day one.

---

## Domain 12 — Notifications

### In-app notifications
- Tag: `BUILT`
- Source: both
- What: Typed in-app notifications (`feedback_status_changed`, `version_published`, `section_assigned`, `cr_status_changed`) with read state.
- Gap: None. `notifications` schema + `createNotification` + notifications page + notification bell.

### Transactional email
- Tag: `EXTEND`
- Source: both
- What: Templated HTML email with retries.
- Gap: Currently plain-text, fire-and-forget. No templates, no retry.
- Notes: Moves into Domain 9 (job runtime) + React Email.

### Notification preferences
- Tag: `NEW`
- Source: implied
- What: Per-user opt-in/out of channels and categories.
- Gap: Absent.

### Digest emails
- Tag: `NEW`
- Source: newDoc2 (Flow 2 — reminders are scheduled; digests extend this)
- What: Weekly or daily summary of new feedback, pending decisions, upcoming workshops.
- Gap: Absent. Depends on scheduler.

---

## Domain 13 — Audit & Compliance

### Immutable audit log
- Tag: `BUILT+`
- Source: newDoc1
- What: Range-partitioned `auditEvents` table with actor, role, action, entityType, entityId, payload, ipAddress.
- Gap: None. Exceeds newDoc1's vague "every action = structured".

### Audit log query UI
- Tag: `BUILT`
- Source: implied
- What: `app/(workspace)/audit/page.tsx` with filters and table.
- Gap: None.

### IP capture middleware
- Tag: `EXTEND`
- Source: existing
- What: Populate `ipAddress` on every audit write.
- Gap: Schema supports it but no middleware currently extracts and forwards the IP.

### Retention policy
- Tag: `NEW` (low priority)
- Source: implied
- What: Rolling retention window + archival to S3.
- Gap: Absent. Partitioning gives a substrate but there is no job.

---

## Deferred — Real-time Collaboration

Real-time multi-user editing is **deferred**. The substrate (Yjs, Tiptap `Collaboration` extensions, `ydocSnapshots` table, `usePresence` hook, inline comment threads) is already in the codebase, but the hocuspocus websocket server was removed in commit `f9c8e71` and there is no live websocket endpoint. Do not rely on real-time multi-editor flows in the merged spec. The data model and client integration stay in place for when this is un-deferred.

Practical implication for the feature list: treat all editor flows as **single-writer**. Multi-user commenting still works (comment threads are persisted via tRPC, not websocket), but simultaneous cursor editing does not.

---

## Deferred — Verification Layer (Cardano anchoring)

newDoc1 positions PolicyDash as a **Verifiable Policy Operating System** anchored on Cardano. This is deferred but listed here as a footnote so the design surface is not lost.

### Hashing layer
- Tag: `NEW` (deferred)
- Source: newDoc1
- What: SHA256 of every important artifact — policy version snapshot, workshop summary, feedback dataset, evidence bundle.
- Gap: No hashing anywhere. Evidence artifacts store URLs, not content hashes.
- Notes: When built, run as a final step of the milestone pack handler (Domain 9 Flow 7) and the version publish handler (Domain 5).

### Cardano anchoring
- Tag: `NEW` (deferred)
- Source: newDoc1
- What: Submit milestone hashes as metadata to a Cardano transaction; store the tx hash in the DB; display a "Verified State" badge on public pages.
- Gap: Absent. No `mesh-sdk`, `blockfrost`, or `cardano-serialization-lib` in `package.json`.
- Notes: If/when built, model as an event `verification.anchor.requested` → handler submits tx → writes tx hash to a `verificationAnchors` table → emits `verification.anchor.confirmed`. The existing audit log already covers "what happened"; anchoring covers "prove it to an outside party".

### Governance voting (on-chain)
- Tag: `NEW` (deferred, optional)
- Source: newDoc1
- What: Optional token-weighted governance voting on CR approvals.
- Gap: Absent.

---

## Appendix — Decision surface

Things that are **not** decided in this feature list and need their own decisions before implementation starts:

1. **Automation runtime choice** (pg-boss vs. Inngest vs. BullMQ+Redis). Recommended: pg-boss for zero-new-infra, Inngest for DX. Decide before touching Flow 1.
2. **Project-layer refactor** — land before the public site refactor so public pages are project-scoped from day one.
3. **Google Calendar auth model** — service account with domain-wide delegation vs. OAuth2 for a shared organizer account. Depends on whether PolicyDash is deployed inside a Google Workspace org.
4. **Cardano anchoring timing** — deferred, but at what milestone does it become real?
5. **Real-time collab** — deferred; revisit at a later milestone. No decision needed now.
6. **Post-v1 SMS provider swap** — Twilio is used for v1; flag MSG91 or Fast2SMS for India-specific production cost optimization later.

**Decisions resolved in Domain 9a** (no longer open): third-party integration choices (Cal.com, Google Meet, Groq, Turnstile, Plausible, Twilio), email template engine (React Email), Flow 4 normalizer (Groq + heuristic fallback), error monitoring (Sentry deferred).

---

## Appendix — Headline counts

| Bucket | Count |
|---|---|
| `BUILT` | 15 |
| `BUILT+` | 11 |
| `EXTEND` | 15 |
| `NEW` | 22 |

Real-time collaboration features (4 rows) are excluded from the active counts — moved to the deferred section.

Rough read: the data model, state machines, tRPC surface, and export primitives are in place. The **two big lift areas** are (a) the automation runtime + the seven flows that sit on it, and (b) the public marketing site with the participate intake form. Everything else is polish, extension, or refactor.

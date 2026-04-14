# Phase 20: Cal.com Workshop Register - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 20-cal-com-workshop-register
**Areas discussed:** cal.com event-type creation + admin flow, Public /workshops listing + embed format, Registration row + unknown-email invite + attendance, Webhook handler + post-workshop feedback email

---

## Area 1: cal.com event-type creation + admin flow

### Q: When admin creates a workshop, when does the matching cal.com event type get created?
| Option | Description | Selected |
|--------|-------------|----------|
| Async via Inngest | tRPC returns immediately, Inngest fn calls cal.com + backfills calcomEventTypeId. Mirrors Phase 19 participate-intake. | ✓ |
| Sync inside tRPC mutation | Block admin until cal.com responds; +200–800ms, hard fail on cal.com 5xx | |
| Lazy on first /workshops render | Couples public read path to external API | |

### Q: Default cal.com event-type location?
| Option | Description | Selected |
|--------|-------------|----------|
| Cal Video | Built-in, zero ops dep, MEETING_ENDED reliable | ✓ |
| Google Meet | Requires Google Workspace OAuth | |
| Configurable per workshop | Adds UI scope | |

### Q: Failure mode when cal.com create fails?
| Option | Description | Selected |
|--------|-------------|----------|
| Workshop persists, retry async | calcomEventTypeId stays null until Inngest succeeds; admin sees workshop immediately | ✓ |
| Rollback workshop row | Atomic but loses admin input on transient 5xx | |
| Surface error, manual retry | More UI surface | |

### Q: Cal.com event-type host?
| Option | Description | Selected |
|--------|-------------|----------|
| Single shared org cal.com account | One CAL_API_KEY in env | ✓ |
| The admin who created the workshop | Per-admin OAuth — large extra scope | |

---

## Area 2: Public /workshops listing + embed format

### Q: How does the cal.com booking widget appear on /workshops?
| Option | Description | Selected |
|--------|-------------|----------|
| Modal popup on Register click | Lazy-load embed only on intent | ✓ |
| Inline embed per card | Heavier initial JS, busier visual | |
| Dedicated /workshops/[id] page | Extra navigation hop | |

### Q: What workshop sections does /workshops show?
| Option | Description | Selected |
|--------|-------------|----------|
| Upcoming only | Cleanest MVP | |
| Upcoming + Past | Adds completed workshops with summary | |
| Upcoming + Live + Past | Three sections, mirrors conference site UX | ✓ |

### Q: Show registration count or capacity?
| Option | Description | Selected |
|--------|-------------|----------|
| No — title/date/description only | Cleanest MVP | |
| Show "X spots left" | Counts registrations vs maxSeats; cached 60s | ✓ |

### Q: How does /workshops fit into proxy public-route whitelist?
| Option | Description | Selected |
|--------|-------------|----------|
| Add /workshops + /api/webhooks/cal to whitelist | Mirrors Phase 19 /participate pattern | ✓ |
| Move under app/(public)/workshops/ segment | More refactoring, no clear win | |

---

## Area 3: Registration row, unknown-email invite, attendance

### Q: How should workshopRegistrations rows be keyed and stored?
| Option | Description | Selected |
|--------|-------------|----------|
| PK=uuid, uniq on bookingUid + nullable userId FK | Atomic webhook idempotency at DB level | ✓ |
| Composite PK on (workshopId, email) | Loses cal.com bookingUid linkage | |

### Q: When BOOKING_CREATED arrives with an unknown email?
| Option | Description | Selected |
|--------|-------------|----------|
| Async via Inngest workshop.registration.received | Webhook returns fast 200, Inngest does Clerk + email | ✓ |
| Inline in webhook handler | Slow response, custom error handling | |

### Q: Where does auto-populated attendance live?
| Option | Description | Selected |
|--------|-------------|----------|
| Reuse workshopRegistrations + add attendedAt | One row per registration, no joins | ✓ |
| New workshopAttendance table | Separate table, extra joins | |

### Q: MEETING_ENDED returns an attendee email with no matching user. What happens?
| Option | Description | Selected |
|--------|-------------|----------|
| Insert registration row + enqueue Clerk invite | Walk-in: capture attendance AND onboard | ✓ |
| Log + skip | Loses attendance | |
| Insert attendance row, no invite | Captures attendance but never onboards | |

---

## Area 4: Webhook handler + post-workshop feedback email

### Q: Which cal.com webhook events does /api/webhooks/cal subscribe to?
| Option | Description | Selected |
|--------|-------------|----------|
| BOOKING_CREATED + MEETING_ENDED only (MVP) | Defers cancel/reschedule | |
| BOOKING_CREATED + BOOKING_CANCELLED + BOOKING_RESCHEDULED + MEETING_ENDED | Full set, accurate registrations | ✓ |

### Q: How is webhook idempotency enforced?
| Option | Description | Selected |
|--------|-------------|----------|
| DB unique index on bookingUid | INSERT ... ON CONFLICT DO NOTHING; atomic at DB | ✓ |
| processedWebhookEvents table | Extra writes per event | |

### Q: When does the post-workshop feedback email fire?
| Option | Description | Selected |
|--------|-------------|----------|
| Immediately on MEETING_ENDED | Decoupled from moderator approval | ✓ |
| After moderator approves the recording summary | Adds latency hours-to-days | |

### Q: What does the post-workshop feedback deep-link look like?
| Option | Description | Selected |
|--------|-------------|----------|
| /participate?workshopId=X&token=Y, signed JWT | Reuses Phase 19 form plumbing | ✓ |
| New /workshops/[id]/feedback page with UUID token | Cleaner separation, more pages | |
| Stakeholder-authed only (no token) | Most secure but high friction | |

---

## Wrap-up clarification

### Q: /participate currently is intake-onboarding; reusing it for workshop feedback needs a mode-switch. Approach?
| Option | Description | Selected |
|--------|-------------|----------|
| Mode-switch /participate | When workshopId+token present, render feedback form; submit posts to /api/intake/workshop-feedback | ✓ |
| Pivot to /workshops/[id]/feedback dedicated page | Contradicts Area 4 Q4 | |
| Keep discussing | | |

---

## Claude's Discretion

- Exact JWT helper file location (`src/lib/feedback-token.ts` vs colocated with auth)
- `unstable_cache` tag naming for spots-left query
- Walk-in synthetic bookingUid format (proposed: `walkin:{workshopId}:{emailHash}`)
- Inngest event payload shapes for `workshop.created`, `workshop.registration.received`, `workshop.feedback.invite`
- Event-type defaults beyond location (description, slug, length minutes — derived from workshop fields)
- Whether `feedbackItems.source` enum already has `'workshop'` (confirm in research; add migration if missing)

## Deferred Ideas

- Per-admin cal.com OAuth
- Configurable cal.com location per workshop
- Public listing pagination
- Capacity waitlist
- Reschedule/cancel admin notifications
- No-show analytics / engagement scoring (Phase 24)
- Anonymized cal.com payload retention policy

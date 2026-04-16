# Phase 24: Stakeholder Engagement Tracking (lite) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 24-stakeholder-engagement-tracking-lite
**Areas discussed:** Engagement score formula, Inactive users widget, Stakeholder profile, Activity tracking scope

---

## Engagement Score Formula

| Option | Description | Selected |
|--------|-------------|----------|
| Simple sum | engagementScore = feedbackCount + attendedWorkshopCount. Transparent, easy to explain. | ✓ |
| Weighted sum | Different weights per signal (e.g., feedback worth 2x). Arbitrary without real data. | |
| Tiered labels | High/Medium/Low/Dormant buckets instead of numbers. | |

**User's choice:** Simple sum
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Computed on-the-fly | SQL subquery counts at read time. Always accurate, no sync issues. | ✓ |
| Stored column + trigger | Materialized column updated via trigger. Faster reads but sync complexity. | |

**User's choice:** Computed on-the-fly
**Notes:** None

---

## Inactive Users Widget

| Option | Description | Selected |
|--------|-------------|----------|
| Admin dashboard | New widget on existing AdminDashboard alongside stat cards. | ✓ |
| Users page | Add "Inactive" tab/filter to /users page. | |
| Both | Summary card on dashboard + full table on /users. | |

**User's choice:** Admin dashboard
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown on the widget | Select (7d/14d/30d/60d/90d) on the widget. Client-side, default 30d. | ✓ |
| Env var / admin setting | Server-side config. Single source of truth but heavier to change. | |

**User's choice:** Dropdown on the widget
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| All users | Show any dormant user regardless of role. Sortable by role. | ✓ |
| Stakeholders only | Filter to stakeholder + observer roles. | |

**User's choice:** All users
**Notes:** None

---

## Stakeholder Profile

| Option | Description | Selected |
|--------|-------------|----------|
| Admin-only /users/[id] | New route visible only to admins. Full user detail page. | ✓ |
| Dual access | Admin + self-service stakeholder view. More work. | |
| Inline on users list | Expand row in-place. Lighter but less room. | |

**User's choice:** Admin-only /users/[id]
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Feedback summary | Count + list of recent feedback with status. | |
| User metadata | Role, org type, join date, last active, score header. | |
| Activity timeline | Chronological log of all actions. Heavier. | |
| You decide | Claude picks what fits "lite" scope. | ✓ |

**User's choice:** You decide (Claude's discretion on profile content)
**Notes:** None

---

## Activity Tracking Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Every authenticated mutation | tRPC middleware on ALL mutations. Matches UX-08 spec exactly. | ✓ |
| Business mutations only | Manually annotate meaningful mutations. More precise but maintenance burden. | |
| Queries too | Update on every request including reads. Far more DB writes. | |

**User's choice:** Every authenticated mutation
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Backfill to createdAt | SET lastActivityAt = createdAt WHERE NULL. Matches roadmap spec. | ✓ |
| Backfill to lastVisitedAt | Use lastVisitedAt if available, fall back to createdAt. | |
| Leave NULL | New column starts NULL. Existing users show as dormant initially. | |

**User's choice:** Backfill to createdAt
**Notes:** None

---

## Claude's Discretion

- Profile page content layout and sections (user chose "You decide")
- Widget table styling and empty states
- Whether to add name-click links from users list to profile page

## Deferred Ideas

None — discussion stayed within phase scope

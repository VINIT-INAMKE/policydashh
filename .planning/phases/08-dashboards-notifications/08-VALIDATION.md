---
phase: 8
slug: dashboards-notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 8 — Validation Strategy

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |

---

## Sampling Rate

- **After every task commit:** `npm test`
- **After every plan wave:** `npm test`
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | NOTIF-01, NOTIF-02 | unit | `npm test -- src/__tests__/notifications.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 2 | UX-01..07 | manual | Browser: verify each role sees correct dashboard | — | ⬜ pending |
| 08-03-01 | 03 | 2 | NOTIF-03 | manual | Browser: "what changed" indicators | — | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `src/__tests__/notifications.test.ts` — notification creation and permission tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Each of 7 roles sees different dashboard | UX-01..07 | Role-based UI rendering | Log in as each role, verify dashboard content |
| Notification bell shows unread count | NOTIF-01 | UI interaction | Trigger event, check bell updates |
| Email notification delivered | NOTIF-02 | External service | Check email inbox after triggering event |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

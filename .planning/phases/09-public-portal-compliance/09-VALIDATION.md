---
phase: 9
slug: public-portal-compliance
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 9 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |

## Sampling Rate

- **After every task commit:** `npm test`
- **Max feedback latency:** 30 seconds

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | File Exists | Status |
|---------|------|------|-------------|-----------|-------------|--------|
| 09-01-01 | 01 | 1 | PUB-01, PUB-05 | manual | — | ⬜ pending |
| 09-01-02 | 01 | 1 | AUDIT-04, AUDIT-05, AUDIT-06 | manual | — | ⬜ pending |

## Wave 0 Requirements

No new test files needed — public portal is read-only UI, audit viewer queries existing data.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual |
|----------|-------------|------------|
| Public page accessible without auth | PUB-01 | Browser session test |
| No stakeholder identities leaked | PUB-05 | Privacy verification |
| Evidence pack downloads as ZIP | AUDIT-06 | File download |

**Approval:** pending

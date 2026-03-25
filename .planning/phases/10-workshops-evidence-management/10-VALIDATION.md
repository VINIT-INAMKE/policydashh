---
phase: 10
slug: workshops-evidence-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 10 — Validation Strategy

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
| 10-01-01 | 01 | 1 | WS-01..05 | unit | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 2 | WS-01..05, EV-03, EV-04 | manual | — | ⬜ pending |

## Wave 0 Requirements
- [ ] `src/__tests__/workshop-permissions.test.ts` — workshop permission matrix

## Manual-Only Verifications

| Behavior | Requirement | Why Manual |
|----------|-------------|------------|
| Workshop CRUD with artifacts | WS-01, WS-02 | File upload + UI |
| Section linking | WS-03 | Interactive linking |
| Claims without evidence view | EV-03 | Data-dependent rendering |

**Approval:** pending

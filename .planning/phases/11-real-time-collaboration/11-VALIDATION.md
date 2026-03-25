---
phase: 11
slug: real-time-collaboration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 11 — Validation Strategy

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
| 11-01-01 | 01 | 1 | EDIT-06 | manual | — | ⬜ pending |
| 11-01-02 | 01 | 1 | EDIT-07 | manual | — | ⬜ pending |
| 11-02-01 | 02 | 2 | EDIT-08 | manual | — | ⬜ pending |

## Wave 0 Requirements
- [ ] `src/__tests__/comment-thread.test.ts` — inline comment thread tests

## Manual-Only Verifications

| Behavior | Requirement | Why Manual |
|----------|-------------|------------|
| Two users edit same section simultaneously | EDIT-06 | Requires 2 browser sessions + Hocuspocus server |
| Presence cursors visible | EDIT-07 | Visual multi-user test |
| Inline comments anchored to text | EDIT-08 | Text selection + comment UI |

**Approval:** pending

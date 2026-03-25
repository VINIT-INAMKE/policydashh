---
phase: 6
slug: versioning
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 6 — Validation Strategy

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | VER-01, VER-02, VER-03 | unit | `npm test -- src/__tests__/versioning.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | VER-04, VER-07 | unit | `npm test -- src/__tests__/version-diff.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | VER-01, VER-05 | manual | Browser: version history, archived versions | — | ⬜ pending |
| 06-02-02 | 02 | 2 | VER-04 | manual | Browser: section-level diff view | — | ⬜ pending |
| 06-02-03 | 02 | 2 | VER-06, VER-07 | manual | Browser: publish version, verify immutable | — | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `src/__tests__/versioning.test.ts` — version creation, changelog generation, label increment
- [ ] `src/__tests__/version-diff.test.ts` — section-level diff computation

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Version history shows all versions with changelogs | VER-01, VER-03 | UI rendering | Navigate to version history, verify list and changelogs |
| Section-level diff renders correctly | VER-04 | Visual comparison | Compare two versions, verify diff highlights |
| Published version is immutable | VER-07 | State enforcement in UI | Publish version, verify edit controls hidden |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

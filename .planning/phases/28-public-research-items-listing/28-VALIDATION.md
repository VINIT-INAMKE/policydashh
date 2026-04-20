---
phase: 28
slug: public-research-items-listing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-20
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Planner fills in Wave 0 tests and per-task automated commands from RESEARCH.md §"Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (unit/component) + playwright (e2e, optional) |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npx vitest run tests/phase-28` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds (phase-28 subset), ~3 min (full) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/phase-28 --reporter=dot`
- **After every plan wave:** Run `npx vitest run tests/phase-28`
- **Before `/gsd:verify-work`:** Full phase-28 suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

*Planner fills this in from RESEARCH.md §"Validation Architecture". One row per task. Each row maps a task to its automated verification command.*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 28-00-XX | 00 (wave 0) | 0 | RESEARCH-09/10 | unit/component | `npx vitest run tests/phase-28/<file>.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Planner must create failing test stubs in Wave 0 before implementation waves. Expected files (derived from RESEARCH.md):

- [ ] `tests/phase-28/research-public-query.test.ts` — `listPublished`, `getPublishedById`, filter & leak-prevention assertions
- [ ] `tests/phase-28/listing-page.test.tsx` — server-component renders published-only cards, filter URL-sync, pagination ≥40/page, default newest-first
- [ ] `tests/phase-28/detail-page.test.tsx` — full metadata render, DOI link, anonymous-author label, linked sections/versions, no feedback/stakeholder leak
- [ ] `tests/phase-28/download-route.test.ts` — presigned URL 24h TTL, `isPublished` enforcement, rate-limit 429, external-link branch
- [ ] `tests/phase-28/research-cta.test.tsx` — existing `/research` page gains Browse CTA without prose change
- [ ] `tests/phase-28/accessibility.test.tsx` — filter keyboard-nav, pagination `aria-live`, download CTA `aria-label`
- [ ] `tests/phase-28/proxy-public-routes.test.ts` — verify `/research/items`, `/research/items/[id]`, `/api/research/[id]/download` resolve without auth redirect

*Planner: enumerate exact files per plan breakdown. Each test file must exist & fail before implementation begins.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Lighthouse ≥90 on detail page | RESEARCH-10 | Requires headless Chromium profile run against `npm run dev` build | `npx lighthouse http://localhost:3000/research/items/<id> --only-categories=performance,accessibility --output=json` — deferred to end-of-milestone smoke walk per user preference |
| R2 presigned URL real-world download (preview-net R2) | RESEARCH-10 | Requires actual R2 bucket + file; CI has no live R2 | Manual: publish a research item with an attached PDF, visit detail page, click Download, verify file downloads with valid signature — deferred to end-of-milestone smoke walk |
| External-link sanity (`target="_blank" rel="noopener noreferrer"` opens in new tab correctly) | RESEARCH-10 | Browser behavior | Manual click test — deferred to end-of-milestone smoke walk |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references above
- [ ] No watch-mode flags (all commands use `vitest run`, never `vitest` alone)
- [ ] Feedback latency < 30s for phase-28 suite
- [ ] `nyquist_compliant: true` set in frontmatter once planner finalizes per-task map

**Approval:** pending

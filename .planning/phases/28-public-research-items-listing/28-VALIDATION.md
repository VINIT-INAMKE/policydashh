---
phase: 28
slug: public-research-items-listing
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-20
approved_at: 2026-04-20
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

*One row per Wave 0 test file. Each row maps a task to its automated verification command.*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 28-00-T1 | 00 | 0 | RESEARCH-09 | unit | `npx vitest run tests/phase-28/research-public-query.test.ts` | ✅ (todo) | ⬜ pending |
| 28-00-T2 | 00 | 0 | RESEARCH-10 | unit | `npx vitest run tests/phase-28/download-route.test.ts` | ✅ (todo) | ⬜ pending |
| 28-00-T3 | 00 | 0 | RESEARCH-10 | unit | `npx vitest run tests/phase-28/no-leak.test.ts` | ✅ (todo) | ⬜ pending |
| 28-00-T4 | 00 | 0 | RESEARCH-10 | unit | `npx vitest run tests/phase-28/proxy-public-routes.test.ts` | ✅ (RED) | ❌ red |
| 28-00-T5 | 00 | 0 | RESEARCH-09 | component | `npx vitest run tests/phase-28/listing-page.test.tsx` | ✅ (todo) | ⬜ pending |
| 28-00-T6 | 00 | 0 | RESEARCH-10 | component | `npx vitest run tests/phase-28/detail-page.test.tsx` | ✅ (todo) | ⬜ pending |
| 28-00-T7 | 00 | 0 | SC-3 (CTA) | component | `npx vitest run tests/phase-28/research-cta.test.tsx` | ✅ (RED) | ❌ red |
| 28-00-T8 | 00 | 0 | SC-7 (a11y) | component | `npx vitest run tests/phase-28/accessibility.test.tsx` | ✅ (todo) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 RED test stubs shipped 2026-04-20 in commits 340bca2 + 5022f94 (Plan 28-00 Tasks 1+2):

- [x] `tests/phase-28/research-public-query.test.ts` — listPublishedResearchItems + getPublishedResearchItem (RESEARCH-09/10 query layer)
- [x] `tests/phase-28/listing-page.test.tsx` — server-component renders published-only cards, filter URL-sync, pagination (RESEARCH-09)
- [x] `tests/phase-28/detail-page.test.tsx` — full metadata render, DOI link, anonymous-author, linked sections/versions (RESEARCH-10)
- [x] `tests/phase-28/download-route.test.ts` — 302 redirect, 404, 429, 24h TTL, key-derivation (RESEARCH-10)
- [x] `tests/phase-28/no-leak.test.ts` — feedback/createdBy/reviewedBy/contentHash never leak to public surface (RESEARCH-10)
- [x] `tests/phase-28/research-cta.test.tsx` — /research page Browse CTA addition (CONTEXT.md SC-3)
- [x] `tests/phase-28/proxy-public-routes.test.ts` — /api/research(.*) public matcher in proxy.ts (RESEARCH-10)
- [x] `tests/phase-28/accessibility.test.tsx` — filter keyboard-nav, aria-live pagination, aria-label download CTA (SC-7)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Lighthouse ≥90 on detail page | RESEARCH-10 | Requires headless Chromium profile run against `npm run dev` build | `npx lighthouse http://localhost:3000/research/items/<id> --only-categories=performance,accessibility --output=json` — deferred to end-of-milestone smoke walk per user preference |
| R2 presigned URL real-world download (preview-net R2) | RESEARCH-10 | Requires actual R2 bucket + file; CI has no live R2 | Manual: publish a research item with an attached PDF, visit detail page, click Download, verify file downloads with valid signature — deferred to end-of-milestone smoke walk |
| External-link sanity (`target="_blank" rel="noopener noreferrer"` opens in new tab correctly) | RESEARCH-10 | Browser behavior | Manual click test — deferred to end-of-milestone smoke walk |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references above
- [x] No watch-mode flags (all commands use `vitest run`, never `vitest` alone)
- [ ] Feedback latency < 30s for phase-28 suite  (measured on first green Wave 1)
- [x] `nyquist_compliant: true` set in frontmatter once planner finalizes per-task map

**Approval:** approved 2026-04-20

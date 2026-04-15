---
status: partial
phase: 21-public-shell-consultation-summary-llm-theme
source: [21-VERIFICATION.md]
started: 2026-04-15T10:35:00Z
updated: 2026-04-15T10:35:00Z
deferred_policy: "feedback_defer_smoke_walks — manual browser walks defer to end-of-milestone, not per-phase"
---

## Current Test

[awaiting end-of-milestone smoke walk]

## Tests

### 1. Font Rendering (PUB-10)
expected: Newsreader serif renders on h1/h2 headings without FOUT; Inter sans-serif renders on nav labels and body text
result: [pending]
command: `npm run dev`, open `/portal/[policyId]` in browser, hard-reload
why_human: CSS variable font load order and flash-of-unstyled-text are visual — cannot assert from static file analysis

### 2. End-to-End Human Review Gate (LLM-07 + LLM-08)
expected: Portal placeholder renders for pending sections; approved section prose appears inline after moderator approval; guardrail-blocked sections show placeholder
result: [pending]
command: Publish a version (triggers `consultationSummaryGenerateFn` via Inngest) → open `/portal/[policyId]` → confirm "Summary under review" placeholder → open workspace version detail → approve a section via `SummaryReviewCard` → refresh portal
why_human: Requires live Inngest execution + tRPC mutation + cross-route re-render — not testable from codebase alone

### 3. Mobile Hamburger Animation (PUB-09)
expected: Menu panel transitions from `max-h-0` to `max-h-96` in ~200ms; all 5 nav links visible; clicking a link closes menu and navigates
result: [pending]
command: Resize viewport below 768px → click hamburger icon in `PublicHeader`
why_human: CSS transition timing and interactive state require a browser

### 4. Cross-Version Summary Browsing (PUB-09 + LLM-07)
expected: Each version renders its correct summary state; null `consultationSummary` shows no summary blocks; mixed sections show per-section approved/placeholder correctly
result: [pending]
command: On `/portal/[policyId]`, switch versions via `PublicVersionSelector` with versions in different summary states (approved, pending, null)
why_human: Combinatorial URL-param × JSONB state matrix — requires real data

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

_None — all 7 success criteria verified automatically. Items above are browser-only smoke walks deferred per milestone-level policy._

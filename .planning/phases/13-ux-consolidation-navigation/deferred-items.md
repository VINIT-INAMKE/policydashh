# Phase 13 — Deferred Items (Out-of-Scope Discoveries)

## Pre-existing TypeScript Errors (not caused by Plan 13-01)

Discovered during Task 1 `npx tsc --noEmit` run. Not introduced by plan 13-01 (uploadthing rename).

### app/(workspace)/workshops/[id]/_components/section-link-picker.tsx

- Line 52: `Property 'sections' does not exist on type { id, createdAt, updatedAt, title, description, sectionCount }`
- Line 52: `Parameter 's' implicitly has an 'any' type`

**Origin:** Phase 12 commit `363f091` (feat(12-01): expand document.list with includeSections and rewrite section-link-picker). The returned document shape lacks `sections` field when `includeSections` flag is not used, but the picker still references `doc.sections`.

**Scope:** Out of scope for plan 13-01 (foundation/rename only). Should be fixed in plan 13-05 (workshops UX) or a follow-up Phase 12 fix.

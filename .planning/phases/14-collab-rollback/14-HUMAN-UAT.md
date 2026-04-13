---
status: resolved
phase: 14-collab-rollback
source: [14-VERIFICATION.md]
started: 2026-04-13
updated: 2026-04-13
---

## Current Test

[user approved 2026-04-13 — all items resolved]

## Tests

### 1. Real-browser auto-save on idle (block editor single-user mode)

expected: After `npm run dev`, opening a policy section and typing text, save state cycles Unsaved → Saving → Saved within ~2 seconds of going idle. No WebSocket errors in console. No Yjs/Hocuspocus log lines. tRPC update mutation visible in the Network tab. Reloading the page preserves the edit.

result: passed (user-approved 2026-04-13)

why manual: The render test stubs `BlockEditor` via `vi.mock('next/dynamic')`, so the real Tiptap mount and debounce cycle are never exercised in unit tests. Code is structurally correct (`handleUpdate`/`handleBlur` call `debouncedSave` unconditionally at `app/(workspace)/policies/[id]/_components/block-editor.tsx:107` and `:114`), but live browser confirmation is required to close success criterion #3 of Phase 14.

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

/**
 * Wave 0 RED contract for RESEARCH-06: create/edit research item form.
 * Target module: `@/app/research-manage/new/page` (Plan 03 creates).
 * Also covers `@/app/research-manage/[id]/edit/page` (Plan 03).
 *
 * Per CONTEXT.md D-01 the surface is dedicated pages, not a dialog —
 * the filename keeps the 27-VALIDATION.md reference but the assertions
 * target the page module.
 *
 * Phase 16+ canonical pattern: variable-path dynamic import so the
 * module does not need to exist yet.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/src/db', () => ({ db: {} }))

async function _loadNewPage() {
  const segs = ['@', 'app', 'research-manage', 'new', 'page']
  const path = segs.join('/')
  return await import(/* @vite-ignore */ path).catch((e) => ({ _err: e }))
}

async function _loadEditPage() {
  const segs = ['@', 'app', 'research-manage', '[id]', 'edit', 'page']
  const path = segs.join('/')
  return await import(/* @vite-ignore */ path).catch((e) => ({ _err: e }))
}

describe('RESEARCH-06: /research-manage/new page module export', () => {
  it.todo('default-exports a React component that renders the 11-field metadata form')
  it.todo('itemType === media_coverage or legal_reference hides file input, shows externalUrl input (D-03)')
  it.todo('itemType === report shows file input, hides externalUrl input (D-03)')
  it.todo('Save Draft button disabled until title, documentId, and itemType provided')
  it.todo('file upload fires on change (not on save) — calls uploadFile with category: research (D-02/D-04)')
})

describe('RESEARCH-06: /research-manage/[id]/edit page module export', () => {
  it.todo('default-exports a React component that prefills form from trpc.research.getById')
  it.todo('Save Changes mutation calls trpc.research.update with only changed fields')
})

describe('RESEARCH-06: form validation invariants', () => {
  it.todo('title min 1 char, max 500 chars — matches router createInput schema')
  it.todo('isAuthorAnonymous toggle is a Switch, default off')
  it.todo('peerReviewed is a Checkbox, default unchecked')
})

import { describe, it } from 'vitest'

describe('touchActivity middleware', () => {
  it.todo('updates lastActivityAt after a mutation resolves (UX-08)')
  it.todo('does NOT update lastActivityAt on query procedures')
  it.todo('does NOT block the mutation response (fire-and-forget)')
  it.todo('silently catches database update failures')
})

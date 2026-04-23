import { describe, it, expect } from 'vitest'

/**
 * Option C (migration 0028) schema test: verifies the four profile-enrichment
 * columns exist on the users table.
 *
 * These columns back /participate intake hydration, /users/[id] About card,
 * the /profile self-service edit surface, and the /stakeholders directory.
 * If any of them disappears from the Drizzle schema, those surfaces break
 * silently — this test catches the regression at import time.
 */
describe('users profile enrichment (migration 0028)', () => {
  it('users table has designation, org_name, expertise, how_heard columns', async () => {
    const { users } = await import('@/src/db/schema/users')
    expect(users.designation).toBeDefined()
    expect(users.orgName).toBeDefined()
    expect(users.expertise).toBeDefined()
    expect(users.howHeard).toBeDefined()
  })
})

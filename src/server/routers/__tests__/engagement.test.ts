import { describe, it } from 'vitest'

describe('listUsersWithEngagement', () => {
  it.todo('returns all users with engagementScore field (UX-09)')
  it.todo('engagementScore equals feedbackCount + attendedWorkshopCount (UX-10, D-01)')
  it.todo('users with zero feedback and zero attendance have engagementScore 0')
  it.todo('filters out workshopRegistrations where attendedAt IS NULL')
  it.todo('filters out workshopRegistrations where userId IS NULL (synthetic walk-ins)')
})

describe('getUserProfile', () => {
  it.todo('returns profile, attendedWorkshops, userFeedback, engagementScore (UX-11)')
  it.todo('attendedWorkshops only includes rows where attendedAt IS NOT NULL')
  it.todo('userFeedback is limited to 20 items ordered by createdAt desc (D-07)')
  it.todo('throws NOT_FOUND for nonexistent userId')
})

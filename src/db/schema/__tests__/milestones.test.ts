import { describe, it, expect } from 'vitest'

describe('milestones schema (VERIFY-01)', () => {
  it('exports milestones table', async () => {
    const mod = await import('@/src/db/schema/milestones')
    expect(mod.milestones).toBeDefined()
  })

  it('exports milestoneStatusEnum with 4 values', async () => {
    const mod = await import('@/src/db/schema/milestones')
    expect(mod.milestoneStatusEnum).toBeDefined()
    // drizzle pgEnum exposes .enumValues as the string array
    expect(mod.milestoneStatusEnum.enumValues).toEqual(['defining', 'ready', 'anchoring', 'anchored'])
  })

  it('milestones table has required columns', async () => {
    const { milestones } = await import('@/src/db/schema/milestones')
    // Drizzle table columns are accessible via the table object
    expect(milestones.id).toBeDefined()
    expect(milestones.documentId).toBeDefined()
    expect(milestones.title).toBeDefined()
    expect(milestones.description).toBeDefined()
    expect(milestones.status).toBeDefined()
    expect(milestones.requiredSlots).toBeDefined()
    expect(milestones.contentHash).toBeDefined()
    expect(milestones.manifest).toBeDefined()
    expect(milestones.canonicalJsonBytesLen).toBeDefined()
    expect(milestones.createdBy).toBeDefined()
    expect(milestones.createdAt).toBeDefined()
    expect(milestones.updatedAt).toBeDefined()
  })

  it('milestones barrel export includes milestones', async () => {
    const schema = await import('@/src/db/schema')
    expect(schema.milestones).toBeDefined()
    expect(schema.milestoneStatusEnum).toBeDefined()
  })
})

describe('milestoneId FK nullable on 4 target tables (VERIFY-02)', () => {
  it('documentVersions has milestoneId column', async () => {
    const mod = await import('@/src/db/schema/changeRequests')
    expect(mod.documentVersions.milestoneId).toBeDefined()
  })

  it('workshops has milestoneId column', async () => {
    const mod = await import('@/src/db/schema/workshops')
    expect(mod.workshops.milestoneId).toBeDefined()
  })

  it('feedbackItems has milestoneId column', async () => {
    const mod = await import('@/src/db/schema/feedback')
    expect(mod.feedbackItems.milestoneId).toBeDefined()
  })

  it('evidenceArtifacts has milestoneId column', async () => {
    const mod = await import('@/src/db/schema/evidence')
    expect(mod.evidenceArtifacts.milestoneId).toBeDefined()
  })
})

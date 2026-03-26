import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { can } from '@/src/lib/permissions'

describe('Comments Router', () => {
  describe('comment:read permission', () => {
    it('allows admin', () => {
      expect(can('admin', 'comment:read')).toBe(true)
    })

    it('allows policy_lead', () => {
      expect(can('policy_lead', 'comment:read')).toBe(true)
    })

    it('allows stakeholder', () => {
      expect(can('stakeholder', 'comment:read')).toBe(true)
    })

    it('allows research_lead', () => {
      expect(can('research_lead', 'comment:read')).toBe(true)
    })

    it('allows observer', () => {
      expect(can('observer', 'comment:read')).toBe(true)
    })

    it('allows auditor', () => {
      expect(can('auditor', 'comment:read')).toBe(true)
    })
  })

  describe('comment:create permission', () => {
    it('allows admin', () => {
      expect(can('admin', 'comment:create')).toBe(true)
    })

    it('allows policy_lead', () => {
      expect(can('policy_lead', 'comment:create')).toBe(true)
    })

    it('allows stakeholder', () => {
      expect(can('stakeholder', 'comment:create')).toBe(true)
    })

    it('allows research_lead', () => {
      expect(can('research_lead', 'comment:create')).toBe(true)
    })

    it('denies observer', () => {
      expect(can('observer', 'comment:create')).toBe(false)
    })

    it('denies auditor', () => {
      expect(can('auditor', 'comment:create')).toBe(false)
    })
  })

  describe('create input validation', () => {
    const createSchema = z.object({
      sectionId: z.string().uuid(),
      commentId: z.string().uuid(),
      body: z.string().min(1).max(2000),
    })

    it('requires sectionId as UUID', () => {
      const result = createSchema.safeParse({
        sectionId: 'not-a-uuid',
        commentId: '550e8400-e29b-41d4-a716-446655440000',
        body: 'test comment',
      })
      expect(result.success).toBe(false)
    })

    it('requires commentId as UUID', () => {
      const result = createSchema.safeParse({
        sectionId: '550e8400-e29b-41d4-a716-446655440000',
        commentId: 'not-a-uuid',
        body: 'test comment',
      })
      expect(result.success).toBe(false)
    })

    it('validates body length <= 2000', () => {
      const result = createSchema.safeParse({
        sectionId: '550e8400-e29b-41d4-a716-446655440000',
        commentId: '550e8400-e29b-41d4-a716-446655440001',
        body: 'x'.repeat(2001),
      })
      expect(result.success).toBe(false)
    })

    it('accepts valid input', () => {
      const result = createSchema.safeParse({
        sectionId: '550e8400-e29b-41d4-a716-446655440000',
        commentId: '550e8400-e29b-41d4-a716-446655440001',
        body: 'This is a valid comment body',
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty body', () => {
      const result = createSchema.safeParse({
        sectionId: '550e8400-e29b-41d4-a716-446655440000',
        commentId: '550e8400-e29b-41d4-a716-446655440001',
        body: '',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('createReply input validation', () => {
    const replySchema = z.object({
      threadId: z.string().uuid(),
      body: z.string().min(1).max(2000),
    })

    it('validates body length <= 2000', () => {
      const result = replySchema.safeParse({
        threadId: '550e8400-e29b-41d4-a716-446655440000',
        body: 'x'.repeat(2001),
      })
      expect(result.success).toBe(false)
    })

    it('accepts valid reply input', () => {
      const result = replySchema.safeParse({
        threadId: '550e8400-e29b-41d4-a716-446655440000',
        body: 'This is a valid reply',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('commentRouter registration', () => {
    it('comments key exists in ACTIONS constants', async () => {
      const { ACTIONS } = await import('@/src/lib/constants')
      expect(ACTIONS.COMMENT_CREATE).toBe('comment.create')
      expect(ACTIONS.COMMENT_REPLY).toBe('comment.reply')
      expect(ACTIONS.COMMENT_RESOLVE).toBe('comment.resolve')
      expect(ACTIONS.COMMENT_REOPEN).toBe('comment.reopen')
      expect(ACTIONS.COMMENT_DELETE).toBe('comment.delete')
    })
  })
})

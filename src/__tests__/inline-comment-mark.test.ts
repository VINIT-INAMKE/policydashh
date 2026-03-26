import { describe, it, expect } from 'vitest'
import { InlineComment } from '@/src/lib/tiptap-extensions/inline-comment-mark'

describe('InlineComment mark', () => {
  it('has name "inlineComment"', () => {
    expect(InlineComment.name).toBe('inlineComment')
  })

  it('has commentId attribute with default null', () => {
    // @ts-expect-error -- test-only: calling config method without full Tiptap `this` context
    const attrs = InlineComment.config.addAttributes!() as Record<string, any>
    expect(attrs.commentId.default).toBeNull()
  })

  it('parseHTML recognizes span[data-comment-id]', () => {
    // @ts-expect-error -- test-only: calling config method without full Tiptap `this` context
    const parseRules = InlineComment.config.parseHTML!()
    expect(parseRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tag: 'span[data-comment-id]' }),
      ]),
    )
  })

  it('renderHTML produces span with class inline-comment-mark', () => {
    const renderFn = InlineComment.config.renderHTML!
    const result = (renderFn as Function).call(
      { options: { HTMLAttributes: {} } },
      { HTMLAttributes: { 'data-comment-id': 'test-id' } },
    ) as any[]
    expect(result[0]).toBe('span')
    expect(result[1]).toHaveProperty('class', 'inline-comment-mark')
    expect(result[1]).toHaveProperty('data-comment-id', 'test-id')
    expect(result[2]).toBe(0)
  })

  it('commentId parseHTML reads data-comment-id attribute', () => {
    // @ts-expect-error -- test-only: calling config method without full Tiptap `this` context
    const attrs = InlineComment.config.addAttributes!() as Record<string, any>
    const mockEl = { getAttribute: (name: string) => name === 'data-comment-id' ? 'abc-123' : null }
    const parsed = attrs.commentId.parseHTML(mockEl as unknown as HTMLElement)
    expect(parsed).toBe('abc-123')
  })

  it('commentId renderHTML writes data-comment-id attribute', () => {
    // @ts-expect-error -- test-only: calling config method without full Tiptap `this` context
    const attrs = InlineComment.config.addAttributes!() as Record<string, any>
    const rendered = attrs.commentId.renderHTML({ commentId: 'xyz-456' })
    expect(rendered).toEqual({ 'data-comment-id': 'xyz-456' })
  })
})

import { describe, it, expect } from 'vitest'
import { parseMarkdown, type ParsedDocument, type ParsedSection } from '@/src/lib/markdown-import'
import { renderTiptapToText } from '@/src/lib/tiptap-renderer'

describe('Markdown Import', () => {
  describe('parseMarkdown', () => {
    it('extracts H1 as document title and H2 sections', () => {
      const input = '# My Policy\n\n## Scope\nScope content\n\n## Goals\nGoals content'
      const result = parseMarkdown(input, 'test.md')

      expect(result.title).toBe('My Policy')
      expect(result.sections).toHaveLength(2)
      expect(result.sections[0].title).toBe('Scope')
      expect(result.sections[1].title).toBe('Goals')
    })

    it('uses filename without extension as title when no H1', () => {
      const input = '## Scope\nScope content\n\n## Goals\nGoals content'
      const result = parseMarkdown(input, 'my-document.md')

      expect(result.title).toBe('my-document')
      expect(result.sections).toHaveLength(2)
    })

    it('uses filename without .markdown extension', () => {
      const input = '## Scope\nContent'
      const result = parseMarkdown(input, 'policy-draft.markdown')

      expect(result.title).toBe('policy-draft')
    })

    it('creates Introduction section from content before first H2', () => {
      const input = '# My Policy\n\nSome intro text here\nMore intro\n\n## Scope\nScope content'
      const result = parseMarkdown(input, 'test.md')

      expect(result.title).toBe('My Policy')
      expect(result.sections).toHaveLength(2)
      expect(result.sections[0].title).toBe('Introduction')
      expect(result.sections[1].title).toBe('Scope')
    })

    it('returns empty sections array when no H2 headings and no preamble content', () => {
      const input = '# My Policy'
      const result = parseMarkdown(input, 'test.md')

      expect(result.title).toBe('My Policy')
      expect(result.sections).toHaveLength(0)
    })

    it('returns empty sections array when no H2 headings exist', () => {
      const input = '# Title Only'
      const result = parseMarkdown(input, 'test.md')

      expect(result.sections).toHaveLength(0)
    })

    it('keeps nested H3 content within parent H2 section', () => {
      const input = '# Policy\n\n## Scope\nScope content\n\n### Sub-scope\nSub content\n\n## Goals\nGoals content'
      const result = parseMarkdown(input, 'test.md')

      expect(result.sections).toHaveLength(2)
      expect(result.sections[0].title).toBe('Scope')
      // The H3 content should be within the Scope section
      const scopeText = renderTiptapToText(result.sections[0].content)
      expect(scopeText).toContain('Sub content')
    })

    it('produces content with Tiptap doc structure', () => {
      const input = '# Policy\n\n## Scope\nScope content'
      const result = parseMarkdown(input, 'test.md')

      expect(result.sections[0].content).toHaveProperty('type', 'doc')
      expect(result.sections[0].content).toHaveProperty('content')
      expect(Array.isArray((result.sections[0].content as { content: unknown[] }).content)).toBe(true)
    })

    it('produces paragraph nodes with text children', () => {
      const input = '# Policy\n\n## Scope\nParagraph one'
      const result = parseMarkdown(input, 'test.md')

      const content = result.sections[0].content as { type: string; content: Array<{ type: string; content: Array<{ type: string; text: string }> }> }
      expect(content.type).toBe('doc')
      expect(content.content[0].type).toBe('paragraph')
      expect(content.content[0].content[0].type).toBe('text')
      expect(content.content[0].content[0].text).toBe('Paragraph one')
    })
  })
})

describe('Tiptap Renderer', () => {
  describe('renderTiptapToText', () => {
    it('extracts text from paragraph nodes', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello' }],
          },
        ],
      }
      expect(renderTiptapToText(doc)).toBe('Hello')
    })

    it('joins multiple paragraphs with newlines', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'First' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Second' }],
          },
        ],
      }
      expect(renderTiptapToText(doc)).toBe('First\nSecond')
    })

    it('returns empty string for empty object', () => {
      expect(renderTiptapToText({})).toBe('')
    })

    it('returns empty string for null', () => {
      expect(renderTiptapToText(null as unknown as Record<string, unknown>)).toBe('')
    })

    it('returns empty string for undefined', () => {
      expect(renderTiptapToText(undefined as unknown as Record<string, unknown>)).toBe('')
    })
  })
})

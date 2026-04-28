import { describe, it, expect } from 'vitest'
import { renderTiptapToHtml } from '@/src/lib/tiptap-html-renderer'

/**
 * Regression coverage for the published-policy renderer.
 *
 * The fileAttachment Tiptap node uses `url`/`filename`/`filesize` (see
 * src/lib/tiptap-extensions/file-attachment-node.ts). The HTML and PDF
 * renderers previously read `href`/`name`/`size` and silently dropped
 * every attachment link in published HTML and PDF exports. These tests
 * lock the schema so the bug cannot regress.
 */
describe('renderTiptapToHtml - fileAttachment node', () => {
  it('renders link from `url` attribute', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'fileAttachment',
          attrs: {
            url: 'https://example.com/file.pdf',
            filename: 'spec.pdf',
            filesize: 1024,
          },
        },
      ],
    }
    const html = renderTiptapToHtml(doc)
    expect(html).toContain('href="https://example.com/file.pdf"')
    expect(html).toContain('spec.pdf')
    expect(html).toContain('1024')
  })

  it('falls back to legacy `href`/`name`/`size` attrs for older saved docs', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'fileAttachment',
          attrs: {
            href: 'https://example.com/legacy.pdf',
            name: 'legacy.pdf',
            size: 2048,
          },
        },
      ],
    }
    const html = renderTiptapToHtml(doc)
    expect(html).toContain('href="https://example.com/legacy.pdf"')
    expect(html).toContain('legacy.pdf')
    expect(html).toContain('2048')
  })

  it('uses Attachment as the visible name when nothing is set', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'fileAttachment',
          attrs: { url: 'https://example.com/x' },
        },
      ],
    }
    const html = renderTiptapToHtml(doc)
    expect(html).toContain('Attachment')
  })

  it('rejects javascript: hrefs even when stored as url attr', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'fileAttachment',
          attrs: {
            url: 'javascript:alert(1)',
            filename: 'evil.html',
          },
        },
      ],
    }
    const html = renderTiptapToHtml(doc)
    expect(html).not.toContain('javascript:')
    expect(html).toContain('href="#"')
  })
})

describe('renderTiptapToHtml - image node', () => {
  it('renders src + alt + title', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'image',
          attrs: {
            src: 'https://example.com/cat.png',
            alt: 'A cat',
            title: 'caption',
          },
        },
      ],
    }
    const html = renderTiptapToHtml(doc)
    expect(html).toContain('src="https://example.com/cat.png"')
    expect(html).toContain('alt="A cat"')
    expect(html).toContain('title="caption"')
  })
})

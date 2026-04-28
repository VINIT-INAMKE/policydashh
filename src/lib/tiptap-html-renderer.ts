/**
 * Recursive Tiptap JSON document-to-HTML-string renderer.
 * Handles all block types used in the Phase 3 block editor.
 * Pure function with no React dependencies -- just string concatenation.
 */

type TiptapNode = {
  type?: string
  content?: TiptapNode[]
  text?: string
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
  attrs?: Record<string, unknown>
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const SAFE_URL_PROTOCOLS = /^(https?:|mailto:|tel:|\/|#)/i

/**
 * Reject hrefs whose protocol is not on the allowlist (e.g. javascript:,
 * data:, vbscript:). Returns '#' as an inert placeholder so the link still
 * renders but cannot execute.
 */
function sanitizeHref(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed === '') return '#'
  if (SAFE_URL_PROTOCOLS.test(trimmed)) return trimmed
  return '#'
}

function renderMarks(text: string, marks?: TiptapNode['marks']): string {
  if (!marks || marks.length === 0) return escapeHtml(text)

  let result = escapeHtml(text)

  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        result = `<strong>${result}</strong>`
        break
      case 'italic':
        result = `<em>${result}</em>`
        break
      case 'underline':
        result = `<u>${result}</u>`
        break
      case 'strike':
        result = `<s>${result}</s>`
        break
      case 'code':
        result = `<code>${result}</code>`
        break
      case 'link': {
        const href = escapeHtml(sanitizeHref(String(mark.attrs?.href ?? '')))
        const target = mark.attrs?.target ? ` target="${escapeHtml(String(mark.attrs.target))}"` : ''
        const rel = mark.attrs?.target === '_blank' ? ' rel="noopener noreferrer"' : ''
        result = `<a href="${href}"${target}${rel}>${result}</a>`
        break
      }
    }
  }

  return result
}

function renderInlineContent(nodes?: TiptapNode[]): string {
  if (!nodes || nodes.length === 0) return ''

  return nodes
    .map((node) => {
      if (node.type === 'text' && typeof node.text === 'string') {
        return renderMarks(node.text, node.marks)
      }
      if (node.type === 'hardBreak') {
        return '<br>'
      }
      // Fallback: render children if any
      return renderInlineContent(node.content)
    })
    .join('')
}

function renderNode(node: TiptapNode): string {
  switch (node.type) {
    case 'paragraph':
      return `<p>${renderInlineContent(node.content)}</p>`

    case 'heading': {
      const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 6)
      return `<h${level}>${renderInlineContent(node.content)}</h${level}>`
    }

    case 'callout': {
      const emoji = node.attrs?.emoji ? `<span>${escapeHtml(String(node.attrs.emoji))}</span> ` : ''
      return `<div class="callout">${emoji}${renderInlineContent(node.content)}</div>`
    }

    case 'codeBlock': {
      const language = node.attrs?.language ? ` class="language-${escapeHtml(String(node.attrs.language))}"` : ''
      const code = node.content
        ?.map((child) => (child.type === 'text' && typeof child.text === 'string' ? escapeHtml(child.text) : ''))
        .join('') ?? ''
      return `<pre><code${language}>${code}</code></pre>`
    }

    case 'blockquote':
      return `<blockquote>${renderNodes(node.content)}</blockquote>`

    case 'bulletList':
      return `<ul>${renderNodes(node.content)}</ul>`

    case 'orderedList': {
      const start = node.attrs?.start && Number(node.attrs.start) !== 1 ? ` start="${Number(node.attrs.start)}"` : ''
      return `<ol${start}>${renderNodes(node.content)}</ol>`
    }

    case 'listItem':
      return `<li>${renderNodes(node.content)}</li>`

    case 'table':
      return `<table>${renderNodes(node.content)}</table>`

    case 'tableRow':
      return `<tr>${renderNodes(node.content)}</tr>`

    case 'tableHeader':
      return `<th>${renderInlineContent(node.content)}</th>`

    case 'tableCell':
      return `<td>${renderInlineContent(node.content)}</td>`

    case 'horizontalRule':
      return '<hr>'

    case 'image': {
      const src = escapeHtml(sanitizeHref(String(node.attrs?.src ?? '')))
      const alt = escapeHtml(String(node.attrs?.alt ?? ''))
      const title = node.attrs?.title ? ` title="${escapeHtml(String(node.attrs.title))}"` : ''
      return `<img src="${src}" alt="${alt}"${title}>`
    }

    case 'fileAttachment': {
      // The fileAttachment node's attribute schema is `url`/`filename`/
      // `filesize` (see src/lib/tiptap-extensions/file-attachment-node.ts).
      // The previous renderer read `href`/`name`/`size` and dropped every
      // file link in published HTML / PDF exports — kept the legacy keys
      // as fallbacks in case any older saved doc used them.
      const href = escapeHtml(
        sanitizeHref(String(node.attrs?.url ?? node.attrs?.href ?? '')),
      )
      const name = escapeHtml(
        String(node.attrs?.filename ?? node.attrs?.name ?? 'Attachment'),
      )
      const sizeAttr = node.attrs?.filesize ?? node.attrs?.size
      const size =
        sizeAttr != null
          ? ` <span class="file-size">(${escapeHtml(String(sizeAttr))})</span>`
          : ''
      return `<div class="file-attachment"><a href="${href}" rel="noopener noreferrer">${name}</a>${size}</div>`
    }

    case 'linkPreview': {
      const href = escapeHtml(sanitizeHref(String(node.attrs?.href ?? node.attrs?.url ?? '')))
      const title = escapeHtml(String(node.attrs?.title ?? node.attrs?.href ?? href))
      const desc = node.attrs?.description
        ? `<p class="link-preview-desc">${escapeHtml(String(node.attrs.description))}</p>`
        : ''
      return `<a class="link-preview" href="${href}" rel="noopener noreferrer"><span class="link-preview-title">${title}</span>${desc}</a>`
    }

    case 'details':
      return `<details class="tiptap-details">${renderNodes(node.content)}</details>`

    case 'detailsSummary':
      return `<summary>${renderInlineContent(node.content)}</summary>`

    case 'detailsContent':
      return `<div class="details-content">${renderNodes(node.content)}</div>`

    default:
      // Unknown node type -- try rendering children
      if (node.content) {
        return renderNodes(node.content)
      }
      return ''
  }
}

function renderNodes(nodes?: TiptapNode[]): string {
  if (!nodes || nodes.length === 0) return ''
  return nodes.map(renderNode).join('')
}

/**
 * Renders a Tiptap JSON document to an HTML string.
 * Returns empty string for null/undefined/empty input.
 */
export function renderTiptapToHtml(doc: Record<string, unknown> | null): string {
  if (!doc || typeof doc !== 'object') {
    return ''
  }

  const typed = doc as TiptapNode

  if (!typed.content || !Array.isArray(typed.content)) {
    return ''
  }

  return renderNodes(typed.content)
}

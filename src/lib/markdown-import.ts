export interface ParsedSection {
  title: string
  content: Record<string, unknown>
}

export interface ParsedDocument {
  title: string
  sections: ParsedSection[]
}

/**
 * Parse inline markdown formatting into Tiptap text nodes with marks.
 * Handles: **bold**, *italic*, [links](url), `code`
 */
function parseInlineMarks(text: string): unknown[] {
  const nodes: unknown[] = []
  // Regex matches: **bold**, *italic*, `code`, [text](url)
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    // Add plain text before this match
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index)
      if (before) nodes.push({ type: 'text', text: before })
    }

    if (match[1]) {
      // **bold**
      nodes.push({ type: 'text', text: match[1], marks: [{ type: 'bold' }] })
    } else if (match[2]) {
      // *italic*
      nodes.push({ type: 'text', text: match[2], marks: [{ type: 'italic' }] })
    } else if (match[3]) {
      // `code`
      nodes.push({ type: 'text', text: match[3], marks: [{ type: 'code' }] })
    } else if (match[4] && match[5]) {
      // [text](url)
      nodes.push({
        type: 'text',
        text: match[4],
        marks: [{ type: 'link', attrs: { href: match[5], target: '_blank' } }],
      })
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex)
    if (remaining) nodes.push({ type: 'text', text: remaining })
  }

  return nodes.length > 0 ? nodes : [{ type: 'text', text }]
}

/**
 * Convert a single line of text into inline content (with marks).
 */
function lineToContent(line: string): unknown[] {
  const trimmed = line.trim()
  if (!trimmed) return []
  return parseInlineMarks(trimmed)
}

/**
 * Convert markdown lines into a Tiptap JSON document.
 * Handles: headings (###, ####), paragraphs, bullet lists, numbered lists,
 * bold, italic, links, code, horizontal rules, and blockquotes.
 */
export function linesToTiptap(lines: string[]): Record<string, unknown> {
  const content: unknown[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Skip empty lines
    if (!trimmed) {
      i++
      continue
    }

    // Horizontal rule
    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      content.push({ type: 'horizontalRule' })
      i++
      continue
    }

    // Headings (### H3, #### H4, ##### H5)
    const headingMatch = trimmed.match(/^(#{3,6})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const headingText = headingMatch[2].replace(/\*\*/g, '') // strip bold from headings
      content.push({
        type: 'heading',
        attrs: { level },
        content: [{ type: 'text', text: headingText }],
      })
      i++
      continue
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().slice(2))
        i++
      }
      content.push({
        type: 'blockquote',
        content: [{
          type: 'paragraph',
          content: lineToContent(quoteLines.join(' ')),
        }],
      })
      continue
    }

    // Numbered list (1. item, 2. item)
    if (/^\d+\.\s/.test(trimmed)) {
      const items: unknown[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^\d+\.\s/, '')
        items.push({
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: lineToContent(itemText),
          }],
        })
        i++
      }
      content.push({ type: 'orderedList', content: items })
      continue
    }

    // Bullet list (- item or * item)
    if (/^[-*]\s/.test(trimmed)) {
      const items: unknown[] = []
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^[-*]\s/, '')
        items.push({
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: lineToContent(itemText),
          }],
        })
        i++
      }
      content.push({ type: 'bulletList', content: items })
      continue
    }

    // Regular paragraph — collect consecutive non-empty, non-special lines
    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('> ') &&
      !lines[i].trim().startsWith('---') &&
      !lines[i].trim().startsWith('***') &&
      !/^[-*]\s/.test(lines[i].trim()) &&
      !/^\d+\.\s/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim())
      i++
    }

    if (paraLines.length > 0) {
      const joined = paraLines.join(' ')
      content.push({
        type: 'paragraph',
        content: lineToContent(joined),
      })
    }
  }

  return { type: 'doc', content: content.length > 0 ? content : [] }
}

/**
 * Parse a markdown string into a structured document with sections.
 *
 * Rules:
 * - First H1 line becomes document title
 * - If no H1, filename without .md/.markdown extension is used as title
 * - Each ## H2 starts a new section
 * - Content before first H2 (excluding H1) becomes an "Introduction" section if non-empty
 * - Nested ### H3 and below stay within their parent H2 section
 * - H1 lines are skipped from section content
 */
export function parseMarkdown(markdown: string, filename: string): ParsedDocument {
  const lines = markdown.split('\n')

  let title: string | null = null
  const sections: ParsedSection[] = []

  let preambleLines: string[] = []
  let currentSectionTitle: string | null = null
  let currentSectionLines: string[] = []
  let foundFirstH2 = false

  for (const line of lines) {
    // Check for H1 (title)
    const h1Match = line.match(/^# (.+)$/)
    if (h1Match && !title) {
      title = h1Match[1].trim()
      continue
    }

    // Check for H2 (section start)
    const h2Match = line.match(/^## (.+)$/)
    if (h2Match) {
      if (currentSectionTitle !== null) {
        sections.push({
          title: currentSectionTitle,
          content: linesToTiptap(currentSectionLines),
        })
      }

      if (!foundFirstH2 && preambleLines.some((l) => l.trim().length > 0)) {
        sections.push({
          title: 'Introduction',
          content: linesToTiptap(preambleLines),
        })
      }

      foundFirstH2 = true
      currentSectionTitle = h2Match[1].trim()
      currentSectionLines = []
      continue
    }

    if (!foundFirstH2) {
      if (!h1Match) {
        preambleLines.push(line)
      }
    } else {
      currentSectionLines.push(line)
    }
  }

  if (currentSectionTitle !== null) {
    sections.push({
      title: currentSectionTitle,
      content: linesToTiptap(currentSectionLines),
    })
  }

  if (!title) {
    title = filename.replace(/\.(md|markdown)$/, '')
  }

  return { title, sections }
}

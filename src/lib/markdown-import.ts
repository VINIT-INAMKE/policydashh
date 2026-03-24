export interface ParsedSection {
  title: string
  content: Record<string, unknown>
}

export interface ParsedDocument {
  title: string
  sections: ParsedSection[]
}

/**
 * Convert an array of text lines into a Tiptap JSON document.
 * Splits on double-newlines to form paragraphs.
 */
export function linesToTiptap(lines: string[]): Record<string, unknown> {
  const text = lines.join('\n').trim()
  if (!text) {
    return { type: 'doc', content: [] }
  }

  // Split on double newlines to form paragraphs
  const paragraphs = text.split(/\n\n+/)

  const content = paragraphs
    .map((para) => para.trim())
    .filter((para) => para.length > 0)
    .map((para) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: para }],
    }))

  return { type: 'doc', content }
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

  // Lines before the first H2 (excluding H1 lines)
  let preambleLines: string[] = []
  let currentSectionTitle: string | null = null
  let currentSectionLines: string[] = []
  let foundFirstH2 = false

  for (const line of lines) {
    // Check for H1 (title)
    const h1Match = line.match(/^# (.+)$/)
    if (h1Match && !title) {
      title = h1Match[1].trim()
      continue // Skip H1 from content
    }

    // Check for H2 (section start)
    const h2Match = line.match(/^## (.+)$/)
    if (h2Match) {
      // Save previous section if exists
      if (currentSectionTitle !== null) {
        sections.push({
          title: currentSectionTitle,
          content: linesToTiptap(currentSectionLines),
        })
      }

      // If we haven't seen any H2 yet, check for preamble content
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

    // Accumulate lines
    if (!foundFirstH2) {
      // Skip additional H1 lines from preamble
      if (!h1Match) {
        preambleLines.push(line)
      }
    } else {
      currentSectionLines.push(line)
    }
  }

  // Save the last section
  if (currentSectionTitle !== null) {
    sections.push({
      title: currentSectionTitle,
      content: linesToTiptap(currentSectionLines),
    })
  }

  // If no H1 was found, use filename
  if (!title) {
    title = filename.replace(/\.(md|markdown)$/, '')
  }

  return { title, sections }
}

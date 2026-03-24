/**
 * Minimal read-only renderer that extracts plain text from Tiptap JSON content.
 * Handles null/undefined/empty input gracefully.
 */
export function renderTiptapToText(content: Record<string, unknown> | null | undefined): string {
  if (!content || typeof content !== 'object') {
    return ''
  }

  const doc = content as { type?: string; content?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> }

  if (!doc.content || !Array.isArray(doc.content)) {
    return ''
  }

  const paragraphs: string[] = []

  for (const node of doc.content) {
    if (node.type === 'paragraph' && Array.isArray(node.content)) {
      const textParts: string[] = []
      for (const child of node.content) {
        if (child.type === 'text' && typeof child.text === 'string') {
          textParts.push(child.text)
        }
      }
      if (textParts.length > 0) {
        paragraphs.push(textParts.join(''))
      }
    }
  }

  return paragraphs.join('\n')
}

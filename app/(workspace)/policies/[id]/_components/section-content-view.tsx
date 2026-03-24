'use client'

import { renderTiptapToText } from '@/src/lib/tiptap-renderer'

interface Section {
  id: string
  title: string
  content: Record<string, unknown> | null
  updatedAt: string
}

interface SectionContentViewProps {
  section: Section
}

export function SectionContentView({ section }: SectionContentViewProps) {
  const text = renderTiptapToText(section.content)
  const isEmpty =
    !section.content ||
    (typeof section.content === 'object' &&
      (!('content' in section.content) ||
        (Array.isArray((section.content as { content?: unknown[] }).content) &&
          ((section.content as { content: unknown[] }).content).length === 0)))

  return (
    <div>
      <h2 className="text-xl font-semibold leading-[1.2]">{section.title}</h2>

      {isEmpty && !text ? (
        <p className="mt-4 text-sm text-muted-foreground">
          This section has no content yet. The block editor will be available in a future update.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {text.split('\n').map((paragraph, i) => (
            <p key={i} className="text-sm leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

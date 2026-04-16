'use client'

import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'

export function CalloutBlockView({ node }: NodeViewProps) {
  const emoji = (node.attrs as { emoji?: string }).emoji || '\u{1F4A1}'

  return (
    <NodeViewWrapper data-type="callout">
      <div className="flex gap-3 rounded-r-md border-l-[3px] border-border bg-muted p-6">
        <span
          className="shrink-0 select-none self-start text-base"
          contentEditable={false}
          aria-hidden="true"
        >
          {emoji}
        </span>
        <NodeViewContent
          as="div"
          className="min-w-0 flex-1 text-sm leading-relaxed [&_.is-empty::before]:text-muted-foreground [&_.is-empty::before]:content-[attr(data-placeholder)]"
        />
      </div>
    </NodeViewWrapper>
  )
}

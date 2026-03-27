'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { buildExtensions } from '@/src/lib/tiptap-extensions/build-extensions'

interface ReadOnlyEditorProps {
  content: Record<string, unknown> | null
}

export default function ReadOnlyEditor({ content }: ReadOnlyEditorProps) {
  const editor = useEditor({
    extensions: buildExtensions(),
    content: content ?? undefined,
    editable: false,
    immediatelyRender: false,
  })

  if (!editor) return null

  return (
    <div className="prose-policy">
      <EditorContent editor={editor} />
    </div>
  )
}

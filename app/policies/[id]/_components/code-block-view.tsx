'use client'

import { useCallback } from 'react'
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'

const LANGUAGES = [
  { value: '', label: 'Plain Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'json', label: 'JSON' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
]

export function CodeBlockView({
  node,
  updateAttributes,
  extension,
}: NodeViewProps) {
  const language = (node.attrs.language as string) || ''
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    const text = node.textContent
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      toast.success('Copied!')
      setTimeout(() => setCopied(false), 2000)
    })
  }, [node])

  const handleLanguageChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateAttributes({ language: e.target.value })
    },
    [updateAttributes],
  )

  return (
    <NodeViewWrapper data-type="code-block" className="relative">
      <div className="rounded-md border border-border bg-muted p-4">
        {/* Controls row */}
        <div
          className="mb-2 flex items-center justify-end gap-1"
          contentEditable={false}
        >
          <select
            value={language}
            onChange={handleLanguageChange}
            className="rounded border-none bg-transparent text-xs text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
            aria-label="Programming language"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted-foreground/10 hover:text-foreground"
            aria-label="Copy code"
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
        </div>

        {/* Code content */}
        <pre className="!m-0 !bg-transparent !p-0">
          <NodeViewContent
            as={'code' as 'div'}
            className="font-mono text-[13px] leading-[1.6]"
          />
        </pre>
      </div>
    </NodeViewWrapper>
  )
}

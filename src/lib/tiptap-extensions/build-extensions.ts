import StarterKit from '@tiptap/starter-kit'
import { Image } from '@tiptap/extension-image'
import { FileHandler } from '@tiptap/extension-file-handler'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { Details, DetailsSummary, DetailsContent } from '@tiptap/extension-details'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { NodeRange } from '@tiptap/extension-node-range'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Collaboration } from '@tiptap/extension-collaboration'
import { CollaborationCaret } from '@tiptap/extension-collaboration-caret'
import { common, createLowlight } from 'lowlight'
import type { SuggestionOptions } from '@tiptap/suggestion'
import type { Extension } from '@tiptap/core'
import type { HocuspocusProvider } from '@hocuspocus/provider'
import type * as Y from 'yjs'

import { Callout } from './callout-node'
import { FileAttachment } from './file-attachment-node'
import { LinkPreview } from './link-preview-node'
import { SlashCommands } from './slash-command-extension'
import { InlineComment } from './inline-comment-mark'

// Create lowlight instance with common languages (includes javascript,
// typescript, python, sql, bash, json, html, css among ~35 languages)
const lowlight = createLowlight(common)

export interface BuildExtensionsOptions {
  onSlashCommand?: Partial<SuggestionOptions>
  collaboration?: {
    doc: Y.Doc
    provider: HocuspocusProvider
    user: { name: string; color: string }
  }
}

/**
 * Builds the complete Tiptap extension array for the PolicyDash editor.
 *
 * Includes:
 * - StarterKit (paragraph, heading, bold, italic, underline, strike, link,
 *   code, blockquote, hardbreak, horizontal rule, bullet/ordered lists,
 *   history, dropcursor, gapcursor, trailing node, list keymap)
 * - CodeBlockLowlight (replaces StarterKit codeBlock)
 * - Image, FileHandler, Table suite, Details suite
 * - NodeRange (required by DragHandle in Plan 02)
 * - Custom: Callout, FileAttachment, LinkPreview, SlashCommands
 * - Placeholder
 *
 * CRITICAL: Do NOT add @tiptap/extension-link or @tiptap/extension-underline
 * separately -- they are bundled in StarterKit v3 and will conflict.
 */
export function buildExtensions(options?: BuildExtensionsOptions): Extension[] {
  const extensions: Extension[] = [
    // StarterKit with plain codeBlock disabled (replaced by CodeBlockLowlight)
    // When collaboration is active, disable undoRedo (Collaboration extension provides its own undo/redo)
    StarterKit.configure({
      codeBlock: false,
      undoRedo: options?.collaboration ? false : undefined,
    }),

    // Syntax-highlighted code blocks
    CodeBlockLowlight.configure({
      lowlight,
    }),

    // Image blocks (no base64, block-level only)
    Image.configure({
      allowBase64: false,
      inline: false,
    }),

    // File drop/paste handling (placeholder callbacks -- wired in Plan 03)
    FileHandler.configure({
      allowedMimeTypes: [
        'image/png',
        'image/jpeg',
        'image/gif',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      onDrop: () => {},
      onPaste: () => {},
    }),

    // Table suite
    Table.configure({
      resizable: false,
    }),
    TableRow,
    TableCell,
    TableHeader,

    // Toggle/collapsible blocks (Details suite)
    Details.configure({
      persist: true,
      HTMLAttributes: { class: 'details-block' },
    }),
    DetailsSummary,
    DetailsContent,

    // Node range selection (required by DragHandle in Plan 02)
    NodeRange,

    // Custom extensions
    Callout,
    FileAttachment,
    LinkPreview,
    SlashCommands.configure({
      suggestion: options?.onSlashCommand ?? {},
    }),

    // Placeholder text
    Placeholder.configure({
      placeholder: 'Type something, or press / for commands...',
    }),

    // Inline comment mark (always included -- comments work in single-user mode too)
    InlineComment,
  ]

  // Add collaboration extensions when collaboration option is provided
  if (options?.collaboration) {
    extensions.push(
      Collaboration.configure({
        document: options.collaboration.doc,
      }),
      CollaborationCaret.configure({
        provider: options.collaboration.provider,
        user: options.collaboration.user,
      }),
    )
  }

  return extensions as Extension[]
}

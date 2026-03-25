import { Extension } from '@tiptap/core'
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion'
import type { Editor, Range } from '@tiptap/core'

export interface SlashCommandItem {
  title: string
  description: string
  searchTerms: string[]
  command: (props: { editor: Editor; range: Range }) => void
}

export interface SlashCommandsOptions {
  suggestion: Partial<SuggestionOptions>
}

/**
 * Slash command extension for Tiptap.
 *
 * Uses @tiptap/suggestion to trigger on '/' character and display
 * a command palette. The UI rendering component (React popup) is
 * created in Plan 02.
 */
export const SlashCommands = Extension.create<SlashCommandsOptions>({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: SlashCommandItem }) => {
          props.command({ editor, range })
        },
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
})

/**
 * Returns the list of available slash command items, filtered by query.
 * Case-insensitive match on title or any searchTerm.
 */
export function getSlashCommandItems(query: string): SlashCommandItem[] {
  const items: SlashCommandItem[] = [
    {
      title: 'Text',
      description: 'Just start writing with plain text.',
      searchTerms: ['paragraph', 'plain', 'text', 'p'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode('paragraph').run()
      },
    },
    {
      title: 'Heading 1',
      description: 'Large section heading.',
      searchTerms: ['heading', 'h1', 'title', 'large'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
      },
    },
    {
      title: 'Heading 2',
      description: 'Medium section heading.',
      searchTerms: ['heading', 'h2', 'subtitle', 'medium'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
      },
    },
    {
      title: 'Heading 3',
      description: 'Small section heading.',
      searchTerms: ['heading', 'h3', 'subheading', 'small'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run()
      },
    },
    {
      title: 'Bullet List',
      description: 'Create a simple bullet list.',
      searchTerms: ['bullet', 'unordered', 'list', 'ul'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run()
      },
    },
    {
      title: 'Ordered List',
      description: 'Create a numbered list.',
      searchTerms: ['ordered', 'numbered', 'list', 'ol'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run()
      },
    },
    {
      title: 'Quote',
      description: 'Capture a quote.',
      searchTerms: ['blockquote', 'quote', 'citation'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run()
      },
    },
    {
      title: 'Divider',
      description: 'Visual divider between sections.',
      searchTerms: ['divider', 'hr', 'horizontal', 'rule', 'separator', 'line'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run()
      },
    },
    {
      title: 'Code Block',
      description: 'Code block with syntax highlighting.',
      searchTerms: ['code', 'codeblock', 'pre', 'syntax'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setCodeBlock().run()
      },
    },
    {
      title: 'Callout',
      description: 'Highlight important information.',
      searchTerms: ['callout', 'alert', 'notice', 'info', 'warning', 'tip'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setCallout({ type: 'info' }).run()
      },
    },
    {
      title: 'Toggle',
      description: 'Collapsible content block.',
      searchTerms: ['toggle', 'collapsible', 'details', 'accordion', 'expandable'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setDetails().run()
      },
    },
    {
      title: 'Table',
      description: 'Add a table.',
      searchTerms: ['table', 'grid', 'columns', 'rows'],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run()
      },
    },
    {
      title: 'Image',
      description: 'Upload or embed an image.',
      searchTerms: ['image', 'picture', 'photo', 'img', 'media'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setImage({ src: '' }).run()
      },
    },
    {
      title: 'File',
      description: 'Upload a file attachment.',
      searchTerms: ['file', 'attachment', 'upload', 'document', 'pdf'],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({ type: 'fileAttachment', attrs: { url: null } })
          .run()
      },
    },
    {
      title: 'Link Preview',
      description: 'Embed a rich link preview.',
      searchTerms: ['link', 'preview', 'embed', 'url', 'bookmark', 'oembed'],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({ type: 'linkPreview', attrs: { url: null } })
          .run()
      },
    },
  ]

  if (!query) return items

  const lowerQuery = query.toLowerCase()
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(lowerQuery) ||
      item.searchTerms.some((term) => term.includes(lowerQuery)),
  )
}

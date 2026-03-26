import { Mark } from '@tiptap/core'

export interface InlineCommentOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    inlineComment: {
      setInlineComment: (commentId: string) => ReturnType
      unsetInlineComment: () => ReturnType
    }
  }
}

/**
 * Custom Tiptap Mark extension for inline comments.
 *
 * Decorates selected text with a `data-comment-id` attribute.
 * Comment metadata (thread, replies, resolved status) lives in PostgreSQL,
 * not inside the Y.Doc — only the mark anchor is stored in the document.
 */
export const InlineComment = Mark.create<InlineCommentOptions>({
  name: 'inlineComment',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-comment-id'),
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-comment-id': attributes.commentId,
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', { ...HTMLAttributes, class: 'inline-comment-mark' }, 0]
  },

  addCommands() {
    return {
      setInlineComment:
        (commentId: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { commentId })
        },
      unsetInlineComment:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        },
    }
  },
})

import { Node, mergeAttributes } from '@tiptap/core'

export interface CalloutOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attributes?: { type?: string; emoji?: string }) => ReturnType
      toggleCallout: (attributes?: { type?: string; emoji?: string }) => ReturnType
    }
  }
}

/**
 * Custom Callout block node for Tiptap.
 *
 * Renders a styled callout box with an emoji icon and content area.
 * Types: info, warning, tip, danger.
 *
 * Note: addNodeView is NOT added here -- the React NodeView component
 * is created in Plan 02 (editor UI).
 */
export const Callout = Node.create<CalloutOptions>({
  name: 'callout',

  group: 'block',

  content: 'block+',

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: (element) => element.getAttribute('data-callout-type') || 'info',
        renderHTML: (attributes) => ({
          'data-callout-type': attributes.type,
        }),
      },
      emoji: {
        default: '\u{1F4A1}',
        parseHTML: (element) => element.getAttribute('data-emoji') || '\u{1F4A1}',
        renderHTML: (attributes) => ({
          'data-emoji': attributes.emoji,
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'callout',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setCallout:
        (attributes) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attributes)
        },
      toggleCallout:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, attributes)
        },
    }
  },
})

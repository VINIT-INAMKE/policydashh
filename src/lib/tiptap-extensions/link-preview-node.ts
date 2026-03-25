import { Node, mergeAttributes } from '@tiptap/core'

export interface LinkPreviewOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    linkPreview: {
      setLinkPreview: (attributes: { url: string }) => ReturnType
    }
  }
}

/**
 * Custom LinkPreview block node for Tiptap.
 *
 * Renders as an atom (non-editable) block that displays a rich link preview
 * with title, description, and image fetched via OEmbed or metadata scraping.
 *
 * Note: addNodeView is NOT added here -- the React NodeView component
 * is created in Plan 03 (media blocks).
 */
export const LinkPreview = Node.create<LinkPreviewOptions>({
  name: 'linkPreview',

  group: 'block',

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      url: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-url'),
        renderHTML: (attributes) => ({
          'data-url': attributes.url,
        }),
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-title'),
        renderHTML: (attributes) => ({
          'data-title': attributes.title,
        }),
      },
      description: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-description'),
        renderHTML: (attributes) => ({
          'data-description': attributes.description,
        }),
      },
      image: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-image'),
        renderHTML: (attributes) => ({
          'data-image': attributes.image,
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="link-preview"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'link-preview',
      }),
    ]
  },

  addCommands() {
    return {
      setLinkPreview:
        (attributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          })
        },
    }
  },
})

import { Node, mergeAttributes } from '@tiptap/core'

export interface FileAttachmentOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fileAttachment: {
      setFileAttachment: (attributes: {
        url?: string | null
        filename?: string | null
        filesize?: number | null
      }) => ReturnType
    }
  }
}

/**
 * Custom FileAttachment block node for Tiptap.
 *
 * Renders as an atom (non-editable) block that displays a file attachment
 * with filename, size, and download link.
 */
export const FileAttachment = Node.create<FileAttachmentOptions>({
  name: 'fileAttachment',

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
      filename: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-filename'),
        renderHTML: (attributes) => ({
          'data-filename': attributes.filename,
        }),
      },
      filesize: {
        default: null,
        parseHTML: (element) => {
          const val = element.getAttribute('data-filesize')
          return val ? Number(val) : null
        },
        renderHTML: (attributes) => ({
          'data-filesize': attributes.filesize,
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="file-attachment"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'file-attachment',
      }),
    ]
  },

  addCommands() {
    return {
      setFileAttachment:
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

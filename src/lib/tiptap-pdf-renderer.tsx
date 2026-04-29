/**
 * Renders Tiptap JSON to @react-pdf/renderer components.
 *
 * Architectural notes
 *  - `<Text>` children inside another `<Text>` render INLINE in
 *    react-pdf. So `renderInline` returns either a string, a styled
 *    `<Text>`, or a `<Link>` — and `renderInlineContent` returns those
 *    bare (no double wrap). Wrapping each in a sibling `<Text>` (the
 *    previous behavior) caused odd spacing because react-pdf treats
 *    each top-level Text inside a parent View as a block, but the
 *    inline children inside a Text parent stayed inline.
 *  - Tables use `<View>` for rows/cells with `<Text>` inside. `flex: 1`
 *    only does the right thing on Views; the previous Text-as-cell
 *    structure caused cells to stack vertically instead of flowing
 *    in a row.
 *  - Marks accumulate ALL styles before wrapping. The previous code
 *    returned eagerly when it saw a `link` mark, dropping any later
 *    bold/italic/code marks if `link` was first in the array.
 *  - Heading levels 1–6 each get a distinct style so `##` and `###`
 *    aren't both rendered as the same h3.
 */
import { Text, View, StyleSheet, Link, Image } from '@react-pdf/renderer'

type StyleValue = (typeof s)[keyof typeof s]

type TiptapNode = {
  type?: string
  content?: TiptapNode[]
  text?: string
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
  attrs?: Record<string, unknown>
}

const s = StyleSheet.create({
  // Heading hierarchy — each level distinct so the doc structure
  // reads at a glance. Sizes scale roughly 1.4x between levels.
  h1: { fontSize: 22, fontFamily: 'Helvetica-Bold', marginTop: 22, marginBottom: 10 },
  h2: { fontSize: 17, fontFamily: 'Helvetica-Bold', marginTop: 18, marginBottom: 8 },
  h3: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 6 },
  h4: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 4 },
  h5: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 8, marginBottom: 3 },
  h6: { fontSize: 11, fontFamily: 'Helvetica-Oblique', marginTop: 8, marginBottom: 3 },

  paragraph: { fontSize: 11, lineHeight: 1.6, marginBottom: 8 },

  // Inline marks
  bold:      { fontFamily: 'Helvetica-Bold' },
  italic:    { fontFamily: 'Helvetica-Oblique' },
  boldItalic:{ fontFamily: 'Helvetica-BoldOblique' },
  underline: { textDecoration: 'underline' as const },
  strike:    { textDecoration: 'line-through' as const },
  code:      { fontFamily: 'Courier', fontSize: 10, backgroundColor: '#f0f0f0' },
  link:      { color: '#0969da', textDecoration: 'underline' as const },

  blockquote: { borderLeftWidth: 2, borderLeftColor: '#ccc', paddingLeft: 10, marginVertical: 8 },
  image:        { marginVertical: 8, alignSelf: 'center' as const, maxWidth: '70%' },
  imageCaption: { fontSize: 9, color: '#57606a', textAlign: 'center' as const, marginTop: 2 },

  // Lists. The list item is a flex row; bullet column is fixed-width
  // (so the bullets line up) and the content column flexes. The item
  // text uses listItemText — no marginBottom, otherwise each item
  // gets paragraph spacing and the list looks airy.
  list:           { marginVertical: 6, marginLeft: 8 },
  listItem:       { flexDirection: 'row' as const, marginBottom: 4 },
  listBullet:     { width: 16, fontSize: 11, lineHeight: 1.6 },
  listContent:    { flex: 1 },
  listItemText:   { fontSize: 11, lineHeight: 1.6 },

  codeBlock: { backgroundColor: '#f5f5f5', padding: 8, marginVertical: 8, borderRadius: 4 },
  codeText:  { fontFamily: 'Courier', fontSize: 9, lineHeight: 1.4 },

  hr:        { borderBottomWidth: 0.5, borderBottomColor: '#ccc', marginVertical: 12 },
  callout:   { backgroundColor: '#f8f9fa', padding: 10, borderRadius: 4, marginVertical: 8, borderLeftWidth: 3, borderLeftColor: '#0066cc' },

  // Tables — use View structure so flex: 1 actually distributes width.
  table:           { marginVertical: 10, borderWidth: 0.5, borderColor: '#d0d7de', borderRightWidth: 0, borderBottomWidth: 0 },
  tableRow:        { flexDirection: 'row' as const },
  tableCell:       { flex: 1, padding: 6, borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#d0d7de' },
  tableHeaderCell: { flex: 1, padding: 6, backgroundColor: '#f6f8fa', borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#d0d7de' },
  tableCellText:   { fontSize: 10, lineHeight: 1.4 },
  tableHeaderText: { fontSize: 10, lineHeight: 1.4, fontFamily: 'Helvetica-Bold' },

  attachment:      { fontSize: 10, color: '#0969da', marginVertical: 4 },
  linkPreview:     { borderWidth: 0.5, borderColor: '#d0d7de', padding: 8, borderRadius: 4, marginVertical: 8 },
  linkPreviewTitle:{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#0969da', marginBottom: 2 },
  linkPreviewDesc: { fontSize: 9, color: '#57606a' },

  details:        { marginVertical: 6, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#d0d7de' },
  detailsSummary: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
})

const SAFE_URL_PROTOCOLS = /^(https?:|mailto:|tel:|\/|#)/i
function safeSrc(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed === '') return '#'
  return SAFE_URL_PROTOCOLS.test(trimmed) ? trimmed : '#'
}

/**
 * Render an inline tiptap node (text or hardBreak) as a react-pdf
 * inline-compatible value. Returns:
 *   - bare string for unstyled text (renders inline inside parent Text)
 *   - <Text> for styled text
 *   - <Link> wrapping <Text> for links (link mark is outermost)
 *   - '\n' for hardBreak (renders as a soft newline)
 *   - null for unknown nodes
 *
 * Marks are accumulated before wrapping. The previous implementation
 * returned eagerly inside the marks loop when it saw a `link`, dropping
 * any later bold/italic marks. Now we collect every style first, then
 * wrap once.
 */
function renderInline(node: TiptapNode, key: number): React.ReactNode {
  if (node.type === 'hardBreak') return '\n'
  if (node.type !== 'text' || typeof node.text !== 'string') return null

  let isBold = false
  let isItalic = false
  let isCode = false
  let isUnderline = false
  let isStrike = false
  let linkHref: string | null = null

  if (node.marks) {
    for (const mark of node.marks) {
      switch (mark.type) {
        case 'bold':       isBold = true; break
        case 'italic':     isItalic = true; break
        case 'underline':  isUnderline = true; break
        case 'strike':     isStrike = true; break
        case 'code':       isCode = true; break
        case 'link':
          if (mark.attrs?.href) {
            linkHref = safeSrc(String(mark.attrs.href))
          }
          break
      }
    }
  }

  // Combine bold + italic into the proper Helvetica variant rather
  // than letting two separate fontFamily styles fight. Without this,
  // the second style wins and you lose either the bold or the italic.
  const styles: StyleValue[] = []
  if (isBold && isItalic) styles.push(s.boldItalic)
  else if (isBold) styles.push(s.bold)
  else if (isItalic) styles.push(s.italic)
  if (isUnderline) styles.push(s.underline)
  if (isStrike) styles.push(s.strike)
  if (isCode) styles.push(s.code)
  if (linkHref) styles.push(s.link)

  const inner: React.ReactNode =
    styles.length > 0 ? (
      <Text key={key} style={styles}>
        {node.text}
      </Text>
    ) : (
      node.text
    )

  if (linkHref) {
    return (
      <Link key={key} src={linkHref}>
        {inner}
      </Link>
    )
  }
  return inner
}

/**
 * Render an array of inline nodes. Returns the rendered values BARE
 * (not double-wrapped) so they nest correctly inside a parent <Text>.
 */
function renderInlineContent(nodes?: TiptapNode[]): React.ReactNode[] {
  if (!nodes) return []
  const out: React.ReactNode[] = []
  nodes.forEach((n, i) => {
    const rendered = renderInline(n, i)
    if (rendered !== null && rendered !== undefined) out.push(rendered)
  })
  return out
}

/**
 * Render a list item's content. Tiptap typically wraps list item
 * content in a paragraph; we strip that and render the inline content
 * directly so the bullet column lines up with the first line of text
 * instead of a paragraph block whose marginBottom pushes the item
 * spacing apart.
 */
function renderListItemContent(itemContent?: TiptapNode[]): React.ReactNode {
  if (!itemContent || itemContent.length === 0) return null

  // Common case: single paragraph. Render its inline content directly
  // inside a no-margin Text so the bullet aligns with the first line.
  if (itemContent.length === 1 && itemContent[0]?.type === 'paragraph') {
    return (
      <Text style={s.listItemText}>
        {renderInlineContent(itemContent[0].content)}
      </Text>
    )
  }

  // Nested case: multiple blocks (paragraph + nested list, code block,
  // etc.). Render each as its own block.
  return itemContent.map((child, j) => renderNode(child, j))
}

function renderNode(node: TiptapNode, index: number): React.ReactNode {
  switch (node.type) {
    case 'paragraph':
      return (
        <Text key={index} style={s.paragraph}>
          {renderInlineContent(node.content)}
        </Text>
      )

    case 'heading': {
      const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 6)
      const headingStyle =
        level === 1 ? s.h1 :
        level === 2 ? s.h2 :
        level === 3 ? s.h3 :
        level === 4 ? s.h4 :
        level === 5 ? s.h5 :
                      s.h6
      return (
        <Text key={index} style={headingStyle}>
          {renderInlineContent(node.content)}
        </Text>
      )
    }

    case 'bulletList':
      return (
        <View key={index} style={s.list}>
          {node.content?.map((item, i) => (
            <View key={i} style={s.listItem}>
              <Text style={s.listBullet}>{'• '}</Text>
              <View style={s.listContent}>
                {renderListItemContent(item.content)}
              </View>
            </View>
          ))}
        </View>
      )

    case 'orderedList':
      return (
        <View key={index} style={s.list}>
          {node.content?.map((item, i) => (
            <View key={i} style={s.listItem}>
              <Text style={s.listBullet}>{`${i + 1}. `}</Text>
              <View style={s.listContent}>
                {renderListItemContent(item.content)}
              </View>
            </View>
          ))}
        </View>
      )

    case 'blockquote':
      return (
        <View key={index} style={s.blockquote}>
          {node.content?.map((child, i) => renderNode(child, i))}
        </View>
      )

    case 'codeBlock':
      return (
        <View key={index} style={s.codeBlock}>
          <Text style={s.codeText}>
            {node.content?.map((c) => c.text ?? '').join('') ?? ''}
          </Text>
        </View>
      )

    case 'callout':
      return (
        <View key={index} style={s.callout}>
          {node.content?.map((child, i) => renderNode(child, i))}
        </View>
      )

    case 'horizontalRule':
      return <View key={index} style={s.hr} />

    case 'image': {
      // @react-pdf/renderer's <Image> accepts http(s) URLs and fetches
      // them server-side at render time. Empty src would crash so we
      // skip the node — block-editor.tsx's stripEmptyImageNodes drops
      // src="" before they ever reach the snapshot, but we guard
      // defensively here in case an old snapshot has one.
      const src = String(node.attrs?.src ?? '').trim()
      if (!src) return null
      const caption = node.attrs?.title ? String(node.attrs.title) : null
      const alt = node.attrs?.alt ? String(node.attrs.alt) : null
      return (
        <View key={index} style={{ marginVertical: 8 }}>
          <Image src={src} style={s.image} />
          {caption ? (
            <Text style={s.imageCaption}>{caption}</Text>
          ) : alt ? (
            <Text style={s.imageCaption}>{alt}</Text>
          ) : null}
        </View>
      )
    }

    case 'table':
      return (
        <View key={index} style={s.table}>
          {node.content?.map((row, i) => renderNode(row, i))}
        </View>
      )

    case 'tableRow':
      return (
        <View key={index} style={s.tableRow}>
          {node.content?.map((cell, i) => renderNode(cell, i))}
        </View>
      )

    case 'tableHeader':
      return (
        <View key={index} style={s.tableHeaderCell}>
          <Text style={s.tableHeaderText}>
            {renderTableCellContent(node.content)}
          </Text>
        </View>
      )

    case 'tableCell':
      return (
        <View key={index} style={s.tableCell}>
          <Text style={s.tableCellText}>
            {renderTableCellContent(node.content)}
          </Text>
        </View>
      )

    case 'fileAttachment': {
      // Match the `url`/`filename` attribute schema declared by the
      // fileAttachment node. Legacy `href`/`name` kept as fallbacks for
      // older saved docs.
      const href = safeSrc(String(node.attrs?.url ?? node.attrs?.href ?? ''))
      const name = String(node.attrs?.filename ?? node.attrs?.name ?? 'Attachment')
      return (
        <Link key={index} src={href}>
          <Text style={s.attachment}>{`📎 ${name}`}</Text>
        </Link>
      )
    }

    case 'linkPreview': {
      const href = safeSrc(String(node.attrs?.href ?? node.attrs?.url ?? ''))
      const title = String(node.attrs?.title ?? node.attrs?.href ?? href)
      const desc = node.attrs?.description ? String(node.attrs.description) : null
      return (
        <View key={index} style={s.linkPreview}>
          <Link src={href}>
            <Text style={s.linkPreviewTitle}>{title}</Text>
          </Link>
          {desc ? <Text style={s.linkPreviewDesc}>{desc}</Text> : null}
        </View>
      )
    }

    case 'details':
      return (
        <View key={index} style={s.details}>
          {node.content?.map((child, i) => renderNode(child, i))}
        </View>
      )

    case 'detailsSummary':
      return (
        <Text key={index} style={s.detailsSummary}>
          {renderInlineContent(node.content)}
        </Text>
      )

    case 'detailsContent':
      return (
        <View key={index}>
          {node.content?.map((child, i) => renderNode(child, i))}
        </View>
      )

    default:
      if (node.content) {
        return (
          <View key={index}>
            {node.content.map((child, i) => renderNode(child, i))}
          </View>
        )
      }
      return null
  }
}

/**
 * Tiptap typically wraps table cell content in a paragraph block. We
 * unwrap that so the cell renders inline text without an extra block
 * margin breaking the row alignment.
 */
function renderTableCellContent(cellContent?: TiptapNode[]): React.ReactNode {
  if (!cellContent || cellContent.length === 0) return ''
  if (cellContent.length === 1 && cellContent[0]?.type === 'paragraph') {
    return renderInlineContent(cellContent[0].content)
  }
  return renderInlineContent(cellContent)
}

/**
 * Render Tiptap JSON document to @react-pdf/renderer elements.
 */
export function renderTiptapToPdf(doc: Record<string, unknown> | null): React.ReactNode {
  if (!doc) return null
  const typed = doc as TiptapNode
  if (!typed.content || !Array.isArray(typed.content)) return null
  return <>{typed.content.map((node, i) => renderNode(node, i))}</>
}

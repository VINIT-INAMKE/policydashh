/**
 * Renders Tiptap JSON to @react-pdf/renderer components.
 * Preserves headings, bold, italic, lists, blockquotes, code blocks.
 */
import { Text, View, StyleSheet, Link, Image } from '@react-pdf/renderer'

// Extract a single style value type from the styles object created by StyleSheet.create
type StyleValue = (typeof s)[keyof typeof s]

type TiptapNode = {
  type?: string
  content?: TiptapNode[]
  text?: string
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
  attrs?: Record<string, unknown>
}

const s = StyleSheet.create({
  h3: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 4 },
  h4: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 3 },
  h5: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 8, marginBottom: 2 },
  paragraph: { fontSize: 11, lineHeight: 1.6, marginBottom: 6 },
  bold: { fontFamily: 'Helvetica-Bold' },
  italic: { fontStyle: 'italic' },
  code: { fontFamily: 'Courier', fontSize: 10, backgroundColor: '#f0f0f0' },
  blockquote: { borderLeftWidth: 2, borderLeftColor: '#ccc', paddingLeft: 8, marginVertical: 6 },
  image: { marginVertical: 8, alignSelf: 'center' as const, maxWidth: '70%' },
  imageCaption: { fontSize: 9, color: '#57606a', textAlign: 'center' as const, marginTop: 2 },
  listItem: { flexDirection: 'row' as const, marginBottom: 3 },
  bullet: { width: 14, fontSize: 11 },
  codeBlock: { backgroundColor: '#f5f5f5', padding: 8, marginVertical: 6, borderRadius: 4 },
  codeText: { fontFamily: 'Courier', fontSize: 9, lineHeight: 1.4 },
  hr: { borderBottomWidth: 0.5, borderBottomColor: '#ccc', marginVertical: 10 },
  callout: { backgroundColor: '#f8f9fa', padding: 8, borderRadius: 4, marginVertical: 6, borderLeftWidth: 3, borderLeftColor: '#0066cc' },
  table:         { marginVertical: 8, borderWidth: 0.5, borderColor: '#d0d7de', borderRightWidth: 0, borderBottomWidth: 0 },
  tableRow:      { flexDirection: 'row' as const },
  tableCell:     { flex: 1, padding: 6, fontSize: 10, borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#d0d7de' },
  tableHeader:   { flex: 1, padding: 6, fontSize: 10, fontFamily: 'Helvetica-Bold', backgroundColor: '#f6f8fa', borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#d0d7de' },
  attachment:    { fontSize: 10, color: '#0969da', marginVertical: 4 },
  linkPreview:   { borderWidth: 0.5, borderColor: '#d0d7de', padding: 8, borderRadius: 4, marginVertical: 6 },
  linkPreviewTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#0969da', marginBottom: 2 },
  linkPreviewDesc:  { fontSize: 9, color: '#57606a' },
  details:          { marginVertical: 6, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#d0d7de' },
  detailsSummary:   { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
})

const SAFE_URL_PROTOCOLS = /^(https?:|mailto:|tel:|\/|#)/i
function safeSrc(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed === '') return '#'
  return SAFE_URL_PROTOCOLS.test(trimmed) ? trimmed : '#'
}

function renderInline(node: TiptapNode): React.ReactNode {
  if (node.type === 'text' && typeof node.text === 'string') {
    const styles: StyleValue[] = []
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === 'bold') styles.push(s.bold)
        if (mark.type === 'italic') styles.push(s.italic)
        if (mark.type === 'code') styles.push(s.code)
        if (mark.type === 'link' && mark.attrs?.href) {
          return <Link src={safeSrc(String(mark.attrs.href))}><Text style={styles}>{node.text}</Text></Link>
        }
      }
    }
    return styles.length > 0
      ? <Text style={styles}>{node.text}</Text>
      : node.text
  }
  if (node.type === 'hardBreak') return '\n'
  return null
}

function renderInlineContent(nodes?: TiptapNode[]): React.ReactNode[] {
  if (!nodes) return []
  return nodes.map((n, i) => {
    const rendered = renderInline(n)
    return rendered !== null ? <Text key={i}>{rendered}</Text> : null
  }).filter(Boolean) as React.ReactNode[]
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
      const level = Number(node.attrs?.level) || 3
      const headingStyle = level <= 3 ? s.h3 : level === 4 ? s.h4 : s.h5
      return (
        <Text key={index} style={headingStyle}>
          {renderInlineContent(node.content)}
        </Text>
      )
    }

    case 'bulletList':
      return (
        <View key={index}>
          {node.content?.map((item, i) => (
            <View key={i} style={s.listItem}>
              <Text style={s.bullet}>{'\u2022 '}</Text>
              <View style={{ flex: 1 }}>
                {item.content?.map((child, j) => renderNode(child, j))}
              </View>
            </View>
          ))}
        </View>
      )

    case 'orderedList':
      return (
        <View key={index}>
          {node.content?.map((item, i) => (
            <View key={i} style={s.listItem}>
              <Text style={s.bullet}>{`${i + 1}. `}</Text>
              <View style={{ flex: 1 }}>
                {item.content?.map((child, j) => renderNode(child, j))}
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
            {node.content?.map(c => c.text ?? '').join('') ?? ''}
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
      // skip the node — this matches the editor's autosave sanitizer
      // (stripEmptyImageNodes in block-editor.tsx) which removes
      // src="" nodes before they ever reach the snapshot, but we
      // guard defensively in case an old snapshot has one.
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
        <Text key={index} style={s.tableHeader}>
          {renderInlineContent(node.content)}
        </Text>
      )

    case 'tableCell':
      return (
        <Text key={index} style={s.tableCell}>
          {renderInlineContent(node.content)}
        </Text>
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
        return <View key={index}>{node.content.map((child, i) => renderNode(child, i))}</View>
      }
      return null
  }
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

import { db } from '@/src/db'
import { documentVersions } from '@/src/db/schema/changeRequests'
import { policyDocuments } from '@/src/db/schema/documents'
import { eq } from 'drizzle-orm'
import { renderTiptapToPdf } from '@/src/lib/tiptap-pdf-renderer'
import type { SectionSnapshot } from '@/src/server/services/version.service'

// NO auth() -- this is a public route, whitelisted in proxy.ts

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const { versionId } = await params

  // Query version -- must be published
  const [version] = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.id, versionId))
    .limit(1)

  if (!version || !version.isPublished) {
    return new Response('Not found', { status: 404 })
  }

  // Get policy title
  const [policy] = await db
    .select({ title: policyDocuments.title })
    .from(policyDocuments)
    .where(eq(policyDocuments.id, version.documentId))
    .limit(1)

  const documentTitle = policy?.title ?? 'Untitled Policy'
  const sections = (version.sectionsSnapshot as SectionSnapshot[] | null) ?? []
  const sortedSections = [...sections].sort((a, b) => a.orderIndex - b.orderIndex)

  // Dynamic import for @react-pdf/renderer
  const { renderToBuffer } = await import('@react-pdf/renderer')
  const { Document, Page, Text, View, StyleSheet } = await import('@react-pdf/renderer')
  // View is already destructured above

  const styles = StyleSheet.create({
    page: {
      padding: 40,
      fontSize: 11,
      fontFamily: 'Helvetica',
    },
    title: {
      fontSize: 20,
      fontFamily: 'Helvetica-Bold',
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 11,
      color: '#666',
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 14,
      fontFamily: 'Helvetica-Bold',
      marginTop: 16,
      marginBottom: 6,
    },
    sectionContent: {
      fontSize: 11,
      lineHeight: 1.6,
      marginBottom: 12,
    },
    divider: {
      borderBottomWidth: 0.5,
      borderBottomColor: '#ccc',
      marginVertical: 12,
    },
    footer: {
      position: 'absolute',
      bottom: 25,
      left: 40,
      right: 40,
      fontSize: 8,
      color: '#999',
      textAlign: 'center',
    },
  })

  const publishedDate = version.publishedAt
    ? new Date(version.publishedAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : 'Unknown date'

  const PolicyPDF = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{documentTitle}</Text>
        <Text style={styles.subtitle}>
          Version {version.versionLabel} -- Published {publishedDate}
        </Text>

        {sortedSections.map((section, idx) => (
          <View key={section.sectionId}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionContent}>
              {renderTiptapToPdf(section.content)}
            </View>
            {idx < sortedSections.length - 1 && <View style={styles.divider} />}
          </View>
        ))}

        <Text style={styles.footer}>
          Generated {new Date().toISOString().split('T')[0]} -- PolicyDash Published Policy Export
        </Text>
      </Page>
    </Document>
  )

  const buffer = await renderToBuffer(PolicyPDF)

  const slug = documentTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)
  const filename = `${slug}-${version.versionLabel}.pdf`

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

import { db } from '@/src/db'
import { documentVersions } from '@/src/db/schema/changeRequests'
import { policyDocuments } from '@/src/db/schema/documents'
import { eq } from 'drizzle-orm'
import { renderTiptapToPdf } from '@/src/lib/tiptap-pdf-renderer'
import type { SectionSnapshot } from '@/src/server/services/version.service'

// NO auth() -- this is a public route, whitelisted in proxy.ts
// B1: Gate on policyDocuments.isPublicDraft AND documentVersions.isPublished
// AND apply per-IP rate limit to protect against abuse.

// --- In-memory per-IP rate limit (global to the route module) -----------
// Single-process best-effort limiter: 10 requests per 60s rolling window.
// For multi-instance deployments a shared store (Upstash/Redis) is required,
// but this gives us a basic guard in the single-Node hosting case.
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60_000
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0]!.trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return 'unknown'
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(ip)
  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return true
  }
  entry.count += 1
  return false
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const { versionId } = await params

  // Rate limit
  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return new Response('Too many requests', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)) },
    })
  }

  // Query version -- must be published
  const [version] = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.id, versionId))
    .limit(1)

  if (!version || !version.isPublished) {
    return new Response('Not found', { status: 404 })
  }

  // Get policy title + public-draft flag. The policy must be opted into the
  // public draft programme for the PDF to be served over the unauth'd route.
  const [policy] = await db
    .select({ title: policyDocuments.title, isPublicDraft: policyDocuments.isPublicDraft })
    .from(policyDocuments)
    .where(eq(policyDocuments.id, version.documentId))
    .limit(1)

  if (!policy || !policy.isPublicDraft) {
    return new Response('Not found', { status: 404 })
  }

  const documentTitle = policy.title ?? 'Untitled Policy'
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
          Generated {new Date().toISOString().split('T')[0]} -- Civilization Lab Published Policy Export
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

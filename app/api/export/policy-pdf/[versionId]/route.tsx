import { db } from '@/src/db'
import { documentVersions } from '@/src/db/schema/changeRequests'
import { policyDocuments } from '@/src/db/schema/documents'
import { eq } from 'drizzle-orm'
import { renderTiptapToPdf } from '@/src/lib/tiptap-pdf-renderer'
import type { SectionSnapshot } from '@/src/server/services/version.service'

// NO auth() -- this is a public route, whitelisted in proxy.ts.
// Gate: documentVersions.isPublished must be true. The previous gate also
// required policyDocuments.isPublicDraft, but that flag is the opt-in for
// the SEPARATE /framework consultation surface (drafts under public review).
// The portal page (/portal/[policyId]) shows ANY published version regardless
// of isPublicDraft — so the PDF download must too, otherwise the portal
// renders the "Download PDF" button against a 404. (User-reported 2026-04-29.)
// Per-IP rate limit still applies.

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

  // Get policy title. The PDF is served whenever the version is published —
  // the portal already exposes the same content without the public-draft
  // flag, so we mirror its behavior here.
  const [policy] = await db
    .select({ title: policyDocuments.title })
    .from(policyDocuments)
    .where(eq(policyDocuments.id, version.documentId))
    .limit(1)

  if (!policy) {
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
      paddingTop: 50,
      paddingBottom: 60,
      paddingHorizontal: 50,
      fontSize: 11,
      fontFamily: 'Helvetica',
    },
    title: {
      fontSize: 24,
      fontFamily: 'Helvetica-Bold',
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 11,
      color: '#666',
      marginBottom: 28,
    },
    sectionTitle: {
      fontSize: 18,
      fontFamily: 'Helvetica-Bold',
      marginTop: 24,
      marginBottom: 10,
    },
    sectionContent: {
      fontSize: 11,
      lineHeight: 1.6,
      marginBottom: 16,
    },
    divider: {
      borderBottomWidth: 0.5,
      borderBottomColor: '#ccc',
      marginVertical: 16,
    },
    footer: {
      position: 'absolute',
      bottom: 30,
      left: 50,
      right: 50,
      fontSize: 8,
      color: '#999',
      textAlign: 'center',
    },
    pageNumber: {
      position: 'absolute',
      bottom: 30,
      right: 50,
      fontSize: 8,
      color: '#999',
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
            {/* minPresenceAhead keeps the section title with at least
                some of its content — without it, a title can land alone
                at the bottom of a page and look orphaned. */}
            <Text style={styles.sectionTitle} minPresenceAhead={80}>
              {section.title}
            </Text>
            <View style={styles.sectionContent}>
              {renderTiptapToPdf(section.content)}
            </View>
            {idx < sortedSections.length - 1 && <View style={styles.divider} />}
          </View>
        ))}

        <Text fixed style={styles.footer}>
          Generated {new Date().toISOString().split('T')[0]} — Civilization Lab Published Policy Export
        </Text>
        <Text
          fixed
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
        />
      </Page>
    </Document>
  )

  let buffer: Buffer
  try {
    buffer = await renderToBuffer(PolicyPDF)
  } catch (err) {
    // Render failures used to surface as opaque 500s with no clue what
    // crashed. Log the version + error so the operator can find the bad
    // node in the snapshot. Common causes: unsupported image format
    // (@react-pdf/renderer accepts JPEG/PNG, struggles with WebP), or
    // a Tiptap node shape the renderer doesn't expect.
    console.error('[policy-pdf] renderToBuffer failed', {
      versionId,
      documentId: version.documentId,
      error: err instanceof Error ? err.message : String(err),
    })
    return new Response('PDF generation failed', { status: 500 })
  }

  const slug = documentTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)
  const filename = `${slug}-${version.versionLabel}.pdf`

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

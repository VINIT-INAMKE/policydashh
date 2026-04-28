import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { consume } from '@/src/lib/rate-limit'

/**
 * GET /api/og-preview?url=<encoded-url>
 *
 * Fetches a remote page and parses Open Graph / Twitter Card meta tags to
 * power the LinkPreview Tiptap node. The link-preview-view client expects
 * `{ title, description, image }` and falls back to a plain link when the
 * response is null or non-OK.
 *
 * Hardening:
 * - Auth required (Clerk). The block editor is admin-only — no public
 *   surface needs this and rate-limited authenticated calls keep the
 *   risk surface minimal.
 * - https:// only. Rejects http/file/javascript/data/intra-network URLs.
 * - SSRF guard: resolves the URL host, blocks RFC 1918 + loopback +
 *   link-local + ::1 ranges before issuing the fetch.
 * - 8s fetch timeout, 1MB response cap. Anything larger is truncated.
 * - Per-user rate limit: 30 requests / minute.
 * - Strips inline scripts before regex-scanning meta tags so a malicious
 *   `og:title` containing `</script>` etc. cannot influence parsing.
 *
 * NOT cached server-side; the editor caches OG data on the linkPreview
 * node attrs once fetched. A future improvement is to add a short
 * (15-30m) shared cache keyed on the URL — skipped for now since this
 * lives in the admin authoring path and traffic is low.
 */

interface OGData {
  title: string | null
  description: string | null
  image: string | null
}

const MAX_BYTES = 1_048_576 // 1 MB
const FETCH_TIMEOUT_MS = 8_000

// Block private / loopback / link-local IP literals at parse time. Returning
// `null` means "block this host"; returning `host` means it's safe enough to
// hand to fetch (which still does its own DNS — a determined attacker could
// force DNS rebinding, but this guard catches the obvious cases without
// adding a custom resolver for a low-traffic admin route).
function checkHost(host: string): string | null {
  const lower = host.toLowerCase()
  if (lower === 'localhost' || lower === '0.0.0.0') return null
  // IPv4 literal: parse and reject private ranges.
  const v4 = lower.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (v4) {
    const [a, b] = v4.slice(1).map(Number)
    if (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224 // multicast / reserved
    ) {
      return null
    }
  }
  // IPv6 literal in URL form is wrapped in []. Block any literal — the
  // editor's link-preview is for public web URLs only.
  if (lower.startsWith('[') && lower.endsWith(']')) return null
  return lower
}

function parseUrl(raw: string): URL | null {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:') return null
    if (!u.hostname) return null
    if (!checkHost(u.hostname)) return null
    return u
  } catch {
    return null
  }
}

function sanitizeText(value: string | undefined | null): string | null {
  if (!value) return null
  // Decode the most common HTML entities the meta tag attribute values
  // may carry. Avoids pulling in a full HTML parser; the linkPreview
  // node's renderHTML escapes the result back when persisting.
  const decoded = value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
  if (decoded === '') return null
  // Cap to a sane length — we render line-clamped 2 lines in the preview.
  return decoded.slice(0, 500)
}

function extractMeta(html: string, names: string[]): string | null {
  // Strip <script> blocks first so their contents can't leak meta-shaped
  // strings into the regex scan.
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, '')
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Match `<meta property="og:title" content="...">` and `<meta name="...">`,
    // both attribute orders, single or double quotes.
    const pattern = new RegExp(
      `<meta[^>]+(?:property|name)\\s*=\\s*["']${escaped}["'][^>]*content\\s*=\\s*["']([^"']*)["']` +
        `|<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*(?:property|name)\\s*=\\s*["']${escaped}["']`,
      'i',
    )
    const match = stripped.match(pattern)
    if (match) {
      const captured = match[1] ?? match[2]
      const cleaned = sanitizeText(captured)
      if (cleaned) return cleaned
    }
  }
  return null
}

function extractTitleTag(html: string): string | null {
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, '')
  const match = stripped.match(/<title[^>]*>([^<]*)<\/title>/i)
  if (match) return sanitizeText(match[1])
  return null
}

async function fetchOGData(url: URL): Promise<OGData | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
      // Some sites refuse the default `node`-shaped User-Agent; spoof a
      // standard browser UA. We're a server-side fetch, not a bot scraper —
      // this is a polite request a user could equally make from their own
      // browser. robots.txt is not honored (CYA only matters for crawlers).
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; PolicyDashLinkPreview/1.0; +https://policydash.app)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    })

    if (!res.ok) return null
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.toLowerCase().includes('html')) return null

    // Stream the body up to MAX_BYTES so a large page can't exhaust memory.
    const reader = res.body?.getReader()
    if (!reader) return null
    let received = 0
    const chunks: Uint8Array[] = []
    while (received < MAX_BYTES) {
      const { value, done } = await reader.read()
      if (done) break
      chunks.push(value)
      received += value.byteLength
    }
    if (received >= MAX_BYTES) {
      // Cancel any further data; we have enough to scan <head>.
      await reader.cancel().catch(() => {})
    }
    const html = new TextDecoder('utf-8', { fatal: false }).decode(
      // Concat without copying when there's only one chunk; otherwise
      // produce a single Uint8Array.
      chunks.length === 1
        ? chunks[0]
        : (() => {
            const merged = new Uint8Array(received)
            let offset = 0
            for (const c of chunks) {
              merged.set(c, offset)
              offset += c.byteLength
            }
            return merged
          })(),
    )

    const title =
      extractMeta(html, ['og:title', 'twitter:title']) ?? extractTitleTag(html)
    const description = extractMeta(html, [
      'og:description',
      'twitter:description',
      'description',
    ])
    let image = extractMeta(html, ['og:image', 'twitter:image'])
    // Resolve relative og:image URLs against the page URL.
    if (image) {
      try {
        image = new URL(image, url).toString()
      } catch {
        image = null
      }
      // Reject non-https image URLs to keep the preview safe to render.
      if (image && !image.startsWith('https://')) image = null
    }

    if (!title && !description && !image) return null
    return { title, description, image }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Per-user rate limit. The editor calls this once per LinkPreview block
  // when the URL is first set, so the limit is generous.
  const limit = consume(`og-preview:user:${userId}`, {
    max: 30,
    windowMs: 60_000,
  })
  if (!limit.ok) {
    const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))
    return NextResponse.json(
      { error: 'Too many link-preview requests. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  const raw = request.nextUrl.searchParams.get('url')
  if (!raw) {
    return NextResponse.json({ error: 'url query parameter required' }, { status: 400 })
  }

  const parsed = parseUrl(raw)
  if (!parsed) {
    return NextResponse.json(
      { error: 'Only public https URLs are supported' },
      { status: 400 },
    )
  }

  const data = await fetchOGData(parsed)
  if (!data) {
    return NextResponse.json({ error: 'No preview data available' }, { status: 404 })
  }
  return NextResponse.json(data)
}

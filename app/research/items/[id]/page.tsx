/**
 * Phase 28 Plan 28-03 — public /research/items/[id] detail page (RESEARCH-10).
 *
 * Server Component. Unauthenticated. Direct Drizzle via research-public.ts
 * helpers (Pitfall 1: getById tRPC procedure is gated by research:read_drafts;
 * bypassed here via the public-safe projection helper).
 *
 * Layout: UI-SPEC Surface B — single column max-w-3xl, header with type badge
 * + H1 + metadata row, download/view CTA block, DOI block, abstract, linked
 * sections, linked versions.
 *
 * Leak prevention (Pitfall 6): NEVER render feedback identifiers, author/
 * reviewer identity, or internal audit columns. getPublishedResearchItem
 * column-projects these out; the linked-sections / linked-versions helpers
 * never touch the feedback-link table.
 *
 * generateMetadata uses React.cache (28-RESEARCH.md §SEO Metadata Approach) so
 * the initial DB fetch is shared between metadata + page render.
 *
 * UUID guard: portal/[policyId]/page.tsx canonical pattern — validate the id
 * before hitting Postgres so malformed ids return 404 instead of throwing
 * "invalid input syntax for type uuid".
 */
import type { Metadata } from 'next'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  getPublishedResearchItem,
  listLinkedSectionsForResearchItem,
  listLinkedVersionsForResearchItem,
  type PublicResearchItem,
  type ResearchItemType,
} from '@/src/server/queries/research-public'
import { formatAuthorsForDisplay } from '@/src/lib/research-utils'
import { DownloadButton } from './_components/download-button'
import { LinkedSectionEntry } from './_components/linked-section-entry'
import { LinkedVersionEntry } from './_components/linked-version-entry'

export const dynamic = 'force-dynamic'

// portal/[policyId]/page.tsx canonical UUID validation (prevents Postgres errors on malformed id)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const TYPE_LABELS: Record<ResearchItemType, string> = {
  report: 'Report',
  paper: 'Paper',
  dataset: 'Dataset',
  memo: 'Memo',
  interview_transcript: 'Interview Transcript',
  media_coverage: 'Media Coverage',
  legal_reference: 'Legal Reference',
  case_study: 'Case Study',
}

// React.cache dedupes between generateMetadata + Page for ONE DB fetch per request.
// 28-RESEARCH.md §SEO Metadata Approach: avoid duplicate fetches when both
// generateMetadata and Page need the same data. UUID validation lives here
// so generateMetadata short-circuits to {} for malformed ids without throwing.
const fetchPublishedItem = cache(
  async (id: string): Promise<PublicResearchItem | null> => {
    if (!UUID_REGEX.test(id)) return null
    return getPublishedResearchItem(id)
  },
)

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const item = await fetchPublishedItem(id)
  if (!item) return {}
  return {
    title: `${item.title} | Research | Civilization Lab`,
    description:
      item.description?.slice(0, 155) ??
      'Research item informing the blockchain policy consultation.',
  }
}

export default async function ResearchItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) notFound()

  const item = await fetchPublishedItem(id)
  if (!item) notFound()

  const [linkedSections, linkedVersions] = await Promise.all([
    listLinkedSectionsForResearchItem(item.id),
    listLinkedVersionsForResearchItem(item.id),
  ])

  const typeLabel = TYPE_LABELS[item.itemType]
  const authorLine = formatAuthorsForDisplay({
    isAuthorAnonymous: item.isAuthorAnonymous,
    authors: item.authors,
  })
  const pubDate = item.publishedDate ? new Date(item.publishedDate) : null

  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <Link
        href="/research/items"
        aria-label="Back to all research items"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All Research
      </Link>

      <header className="mb-8">
        <Badge
          className="bg-[oklch(0.9_0.08_145)] text-[oklch(0.4_0.12_145)] mb-3"
          aria-label={`Type: ${typeLabel}`}
        >
          {typeLabel}
        </Badge>

        <h1
          className="text-[28px] font-semibold leading-[1.2] text-[var(--cl-on-surface)] mb-4"
          style={{ fontFamily: 'var(--font-cl-headline, Newsreader, serif)' }}
        >
          {item.title}
        </h1>

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>{authorLine}</span>
          {pubDate && (
            <time dateTime={pubDate.toISOString()}>
              {format(pubDate, 'MMM d, yyyy')}
            </time>
          )}
          {item.journalOrSource && <span>{item.journalOrSource}</span>}
          {item.peerReviewed && (
            <span className="inline-flex items-center rounded-full bg-[oklch(0.9_0.08_145)] px-2 py-0.5 text-xs font-medium text-[oklch(0.4_0.12_145)]">
              Peer Reviewed
            </span>
          )}
        </div>
      </header>

      <div className="mb-8">
        {item.artifactId ? (
          <DownloadButton
            itemId={item.id}
            title={item.title}
            itemType={typeLabel}
          />
        ) : item.externalUrl ? (
          <a
            href={item.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open external source for ${item.title} (opens in new tab)`}
            className="inline-flex items-center gap-1 min-w-[120px] min-h-11 justify-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-muted transition-colors"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            View Source
          </a>
        ) : null}
      </div>

      {item.doi && (
        <div className="mb-6 text-sm text-muted-foreground">
          DOI:{' '}
          <a
            href={`https://doi.org/${item.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            {item.doi}
          </a>
        </div>
      )}

      {item.description && (
        <section className="mb-12">
          <h2
            className="text-[20px] font-semibold leading-[1.2] mb-4"
            style={{ fontFamily: 'var(--font-cl-headline, Newsreader, serif)' }}
          >
            Abstract
          </h2>
          <p className="text-[16px] font-normal leading-[1.8] whitespace-pre-line text-foreground">
            {item.description}
          </p>
        </section>
      )}

      <hr className="border-border my-8" />

      <section className="mb-12" aria-labelledby="linked-sections-heading">
        <h2
          id="linked-sections-heading"
          className="text-[20px] font-semibold leading-[1.2] mb-4"
          style={{ fontFamily: 'var(--font-cl-headline, Newsreader, serif)' }}
        >
          Informs These Sections
        </h2>
        {linkedSections.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            This item has no linked policy sections.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {linkedSections.map((s) => (
              <LinkedSectionEntry
                key={`${s.documentId}-${s.sectionId}`}
                documentId={s.documentId}
                sectionId={s.sectionId}
                sectionTitle={s.sectionTitle}
                documentTitle={s.documentTitle}
                relevanceNote={s.relevanceNote}
              />
            ))}
          </div>
        )}
      </section>

      <hr className="border-border my-8" />

      <section aria-labelledby="linked-versions-heading">
        <h2
          id="linked-versions-heading"
          className="text-[20px] font-semibold leading-[1.2] mb-4"
          style={{ fontFamily: 'var(--font-cl-headline, Newsreader, serif)' }}
        >
          Referenced in Policy Versions
        </h2>
        {linkedVersions.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            This item has no linked policy versions.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {linkedVersions.map((v) => (
              <LinkedVersionEntry
                key={v.versionId}
                documentId={v.documentId}
                versionLabel={v.versionLabel}
                documentTitle={v.documentTitle}
                publishedAt={v.publishedAt}
              />
            ))}
          </div>
        )}
      </section>
    </article>
  )
}

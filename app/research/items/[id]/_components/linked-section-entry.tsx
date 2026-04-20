/**
 * Phase 28 Plan 28-03 — LinkedSectionEntry server component for the public detail page (RESEARCH-10).
 *
 * Renders one linked policy section as an internal link card pointing at
 * /framework/{documentId}#section-{sectionId} (Phase 20.5 framework page anchor).
 *
 * Pure server component — no interactivity, no client JS. Source of the
 * `documentTitle` / `sectionTitle` / `relevanceNote` props is
 * listLinkedSectionsForResearchItem() in src/server/queries/research-public.ts
 * (Plan 28-01) which inner-joins policySections + policyDocuments and
 * INTENTIONALLY does NOT join researchItemFeedbackLinks (Pitfall 6).
 */
import Link from 'next/link'
import { FileText } from 'lucide-react'

export interface LinkedSectionEntryProps {
  documentId: string
  sectionId: string
  sectionTitle: string
  documentTitle: string
  relevanceNote: string | null
}

export function LinkedSectionEntry({
  documentId,
  sectionId,
  sectionTitle,
  documentTitle,
  relevanceNote,
}: LinkedSectionEntryProps) {
  return (
    <Link
      href={`/framework/${documentId}#section-${sectionId}`}
      className="block"
      aria-label={`${sectionTitle} in ${documentTitle}`}
    >
      <div className="flex items-start gap-3 rounded-md border bg-card px-4 py-3 hover:bg-muted/30 transition-colors">
        <FileText
          className="mt-0.5 size-4 text-muted-foreground shrink-0"
          aria-hidden="true"
        />
        <div>
          <p className="text-sm font-medium text-foreground">{sectionTitle}</p>
          <p className="text-xs text-muted-foreground">{documentTitle}</p>
          {relevanceNote && (
            <p className="mt-1 text-xs text-muted-foreground italic">{relevanceNote}</p>
          )}
        </div>
      </div>
    </Link>
  )
}

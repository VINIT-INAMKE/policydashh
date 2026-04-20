/**
 * Phase 28 Plan 28-02 — public listing filter rail (RESEARCH-09).
 *
 * Server component. Renders a <form method="get"> that submits to the same
 * page URL with updated query params. Multi-select Type checkboxes delegate
 * to the ResearchTypeCheckboxes client island (router.replace based, no
 * form submit needed for type changes).
 *
 * Document filter (CONTEXT.md Q6): always visible even with one policy.
 * Loaded via direct Drizzle in this server component (no tRPC for public
 * surfaces — same pattern as listPublishedResearchItems in research-public.ts).
 *
 * Layout: 240px desktop rail (caller wraps in `aside`). Each filter group has
 * an uppercase muted label per UI-SPEC. Date inputs carry aria-label="From date"
 * / "To date" for SC-7.
 *
 * "Apply filters" submits the form; "Clear all filters" link visible only when
 * any filter is active.
 */
import Link from 'next/link'
import { asc } from 'drizzle-orm'
import { db } from '@/src/db'
import { policyDocuments } from '@/src/db/schema/documents'
import { ResearchTypeCheckboxes } from './research-type-checkboxes'

export interface ResearchFilterPanelProps {
  documentId?: string
  from?: string
  to?: string
  sort: 'newest' | 'oldest'
  hasAnyFilter: boolean
}

export async function ResearchFilterPanel({
  documentId,
  from,
  to,
  sort,
  hasAnyFilter,
}: ResearchFilterPanelProps) {
  // OQ3 resolution: query documents directly so the Document Select always
  // renders even when only one policy exists (Q6 future-proofing). Direct
  // Drizzle in the server component mirrors the portal pattern — no tRPC
  // hop on a public surface.
  const docs = await db
    .select({ id: policyDocuments.id, title: policyDocuments.title })
    .from(policyDocuments)
    .orderBy(asc(policyDocuments.title))

  return (
    <form method="get" className="rounded-lg border bg-card p-4 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Filter</h2>

      <div>
        <label
          htmlFor="filter-doc"
          className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block"
        >
          Document
        </label>
        <select
          id="filter-doc"
          name="document"
          defaultValue={documentId ?? ''}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-11"
        >
          <option value="">All documents</option>
          {docs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
      </div>

      <hr className="border-border" />

      <div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Type
        </div>
        <ResearchTypeCheckboxes />
      </div>

      <hr className="border-border" />

      <div className="flex flex-col gap-2">
        <label
          htmlFor="filter-from"
          className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
        >
          From date
        </label>
        <input
          id="filter-from"
          type="date"
          name="from"
          aria-label="From date"
          defaultValue={from ?? ''}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-11"
        />

        <label
          htmlFor="filter-to"
          className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
        >
          To date
        </label>
        <input
          id="filter-to"
          type="date"
          name="to"
          aria-label="To date"
          defaultValue={to ?? ''}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-11"
        />
      </div>

      <hr className="border-border" />

      <div>
        <label
          htmlFor="filter-sort"
          className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block"
        >
          Sort
        </label>
        <select
          id="filter-sort"
          name="sort"
          defaultValue={sort}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-11"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      <button
        type="submit"
        className="inline-flex items-center justify-center min-h-11 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
      >
        Apply filters
      </button>

      {hasAnyFilter && (
        <Link
          href="/research/items"
          aria-label="Clear all filters"
          className="text-sm text-primary underline underline-offset-2 text-center"
        >
          Clear all filters
        </Link>
      )}
    </form>
  )
}

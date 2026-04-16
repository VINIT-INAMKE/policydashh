'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Filter, GitPullRequest } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { CRCard, type CRCardItem } from './cr-card'
import { CRFilterPanel, EMPTY_CR_FILTERS, type CRFilters } from './cr-filter-panel'
import { CreateCRDialog } from './create-cr-dialog'

interface CRListProps {
  documentId: string
}

export function CRList({ documentId }: CRListProps) {
  const [filters, setFilters] = useState<CRFilters>(EMPTY_CR_FILTERS)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const meQuery = trpc.user.getMe.useQuery()
  const role = meQuery.data?.role
  const canCreateCR = role === 'admin' || role === 'policy_lead'

  const queryInput = useMemo(() => ({
    documentId,
    status: filters.statuses.length === 1
      ? filters.statuses[0] as 'drafting' | 'in_review' | 'approved' | 'merged' | 'closed'
      : undefined,
    sectionId: filters.sectionId ?? undefined,
  }), [documentId, filters])

  const crQuery = trpc.changeRequest.list.useQuery(queryInput)
  const sectionsQuery = trpc.document.getSections.useQuery({ documentId })

  const sections = useMemo(() =>
    sectionsQuery.data?.map((s: { id: string; title: string }) => ({ id: s.id, title: s.title })) ?? [],
    [sectionsQuery.data]
  )

  // Client-side multi-status filter
  const filteredItems = useMemo(() => {
    if (!crQuery.data) return []
    let items = crQuery.data as CRCardItem[]
    if (filters.statuses.length > 1) {
      items = items.filter((item) => filters.statuses.includes(item.status))
    }
    return items
  }, [crQuery.data, filters.statuses])

  const activeFilterCount = filters.statuses.length + (filters.sectionId ? 1 : 0)

  return (
    <div className="flex h-full">
      {/* Desktop filter sidebar */}
      <aside className="hidden w-[240px] shrink-0 border-r lg:block">
        <CRFilterPanel
          filters={filters}
          onFiltersChange={setFilters}
          sections={sections}
        />
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-4">
        {/* Back link */}
        <Link href={`/policies/${documentId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Policy
          </Button>
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-semibold leading-[1.2]">Change Requests</h1>
            {activeFilterCount > 0 && (
              <span className="text-[12px] text-muted-foreground">
                {filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="lg:hidden"
              onClick={() => setMobileFiltersOpen(true)}
            >
              <Filter className="mr-1 h-4 w-4" />
              Filters
              {activeFilterCount > 0 && ` (${activeFilterCount})`}
            </Button>
            {canCreateCR && <CreateCRDialog documentId={documentId} />}
          </div>
        </div>

        {/* List */}
        <div className="flex flex-col gap-3">
          {crQuery.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[120px] w-full rounded-lg" />
            ))
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <GitPullRequest className="h-12 w-12 text-muted-foreground/50" />
              <div>
                <p className="text-[14px] font-semibold">No change requests yet</p>
                <p className="mt-1 text-[14px] text-muted-foreground">
                  Create a change request from accepted feedback to start the review process.
                </p>
              </div>
            </div>
          ) : (
            filteredItems.map((cr) => (
              <CRCard key={cr.id} cr={cr} />
            ))
          )}
        </div>
      </div>

      {/* Mobile filter sheet */}
      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <CRFilterPanel
            filters={filters}
            onFiltersChange={(f) => {
              setFilters(f)
            }}
            sections={sections}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}

'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Filter, MessageSquare } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { FeedbackCard, type FeedbackItem } from './feedback-card'
import { FilterPanel, EMPTY_FILTERS, type FilterState } from './filter-panel'
import { FeedbackDetailSheet } from './feedback-detail-sheet'

interface FeedbackInboxProps {
  documentId: string
}

export function FeedbackInbox({ documentId }: FeedbackInboxProps) {
  const searchParams = useSearchParams()
  const initialSelected = searchParams.get('selected')
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(initialSelected)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  // E2: build query input using array filters so multi-select is always
  // server-side. The matching server-side route uses inArray() for each.
  const queryInput = useMemo(() => ({
    documentId,
    sectionId: filters.sectionId,
    statuses: filters.statuses.length > 0 ? (filters.statuses as Array<'submitted' | 'under_review' | 'accepted' | 'partially_accepted' | 'rejected' | 'closed'>) : undefined,
    feedbackTypes: filters.types.length > 0 ? (filters.types as Array<'issue' | 'suggestion' | 'endorsement' | 'evidence' | 'question'>) : undefined,
    priorities: filters.priorities.length > 0 ? (filters.priorities as Array<'low' | 'medium' | 'high'>) : undefined,
    impactCategories: filters.impacts.length > 0 ? (filters.impacts as Array<'legal' | 'security' | 'tax' | 'consumer' | 'innovation' | 'clarity' | 'governance' | 'other'>) : undefined,
    orgTypes: filters.orgTypes.length > 0 ? (filters.orgTypes as Array<'government' | 'industry' | 'legal' | 'academia' | 'civil_society' | 'internal'>) : undefined,
  }), [documentId, filters])

  const feedbackQuery = trpc.feedback.list.useQuery(queryInput)

  // Fetch sections for the filter panel
  const sectionsQuery = trpc.document.getSections.useQuery({ documentId })

  const filteredItems = useMemo(
    () => feedbackQuery.data ?? [],
    [feedbackQuery.data],
  )

  const sections = sectionsQuery.data ?? []

  // Count active filters for mobile badge
  const activeFilterCount =
    (filters.sectionId ? 1 : 0) +
    filters.statuses.length +
    filters.types.length +
    filters.priorities.length +
    filters.impacts.length +
    filters.orgTypes.length

  const hasActiveFilters = activeFilterCount > 0

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Desktop filter panel */}
      <div className="hidden w-[240px] shrink-0 overflow-y-auto border-r bg-muted lg:block">
        <FilterPanel
          filters={filters}
          onFiltersChange={setFilters}
          sections={sections}
        />
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Back link */}
        <div className="border-b px-4 py-2 lg:px-6">
          <Link href={`/policies/${documentId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to Policy
            </Button>
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 border-b px-4 py-3 lg:px-6">
          <h1 className="text-[20px] font-semibold leading-[1.2]">Feedback</h1>
          {!feedbackQuery.isLoading && (
            <span className="text-[12px] font-normal text-muted-foreground">
              {filteredItems.length} items
            </span>
          )}

          {/* Mobile filter button */}
          <div className="ml-auto lg:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMobileFiltersOpen(true)}
            >
              <Filter className="mr-1 size-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 border-transparent text-[10px]">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Feedback list */}
        <div className="flex flex-col gap-3 p-4 lg:p-6">
          {feedbackQuery.isLoading ? (
            // Loading skeleton
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-xl border p-4">
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-14" />
                  <Skeleton className="h-5 w-16" />
                  <div className="ml-auto">
                    <Skeleton className="h-5 w-20" />
                  </div>
                </div>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="mt-1 h-4 w-full" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))
          ) : filteredItems.length === 0 && !hasActiveFilters ? (
            // Empty state -- no feedback
            <div className="flex flex-col items-center justify-center py-16">
              <MessageSquare className="size-12 text-muted-foreground" />
              <h2 className="mt-4 text-[20px] font-semibold leading-[1.2]">
                No feedback yet
              </h2>
              <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
                Feedback submitted on sections you manage will appear here. Stakeholders submit feedback through their section views.
              </p>
            </div>
          ) : filteredItems.length === 0 && hasActiveFilters ? (
            // Empty state -- filters active
            <div className="flex flex-col items-center justify-center py-16">
              <MessageSquare className="size-12 text-muted-foreground" />
              <h2 className="mt-4 text-[20px] font-semibold leading-[1.2]">
                No matching feedback
              </h2>
              <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
                Try adjusting your filters or clearing them to see all feedback.
              </p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <FeedbackCard
                key={item.id}
                feedback={item as FeedbackItem}
                onClick={() => setSelectedFeedbackId(item.id)}
                isActive={selectedFeedbackId === item.id}
              />
            ))
          )}
        </div>
      </div>

      {/* Feedback detail sheet */}
      <FeedbackDetailSheet
        feedbackId={selectedFeedbackId}
        open={!!selectedFeedbackId}
        onOpenChange={(o) => { if (!o) setSelectedFeedbackId(null) }}
      />

      {/* Mobile filter sheet */}
      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <FilterPanel
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

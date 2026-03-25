'use client'

import { useState, useMemo } from 'react'
import { Filter, MessageSquare } from 'lucide-react'
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
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  // Build query input -- only pass the first filter value for server-side filtering
  // Client-side will further filter for multi-select (statuses, types, etc.)
  const queryInput = useMemo(() => ({
    documentId,
    sectionId: filters.sectionId,
    status: filters.statuses.length === 1 ? filters.statuses[0] as 'submitted' | 'under_review' | 'accepted' | 'partially_accepted' | 'rejected' | 'closed' : undefined,
    feedbackType: filters.types.length === 1 ? filters.types[0] as 'issue' | 'suggestion' | 'endorsement' | 'evidence' | 'question' : undefined,
    priority: filters.priorities.length === 1 ? filters.priorities[0] as 'low' | 'medium' | 'high' : undefined,
    impactCategory: filters.impacts.length === 1 ? filters.impacts[0] as 'legal' | 'security' | 'tax' | 'consumer' | 'innovation' | 'clarity' | 'governance' | 'other' : undefined,
  }), [documentId, filters])

  const feedbackQuery = trpc.feedback.list.useQuery(queryInput)

  // Fetch sections for the filter panel
  const sectionsQuery = trpc.document.getSections.useQuery({ documentId })

  // Client-side multi-filter (for when more than one checkbox is selected)
  const filteredItems = useMemo(() => {
    if (!feedbackQuery.data) return []
    let items = feedbackQuery.data as (typeof feedbackQuery.data[number] & { sectionTitle?: string; hasEvidence?: boolean })[]

    if (filters.statuses.length > 1) {
      items = items.filter((item) => filters.statuses.includes(item.status))
    }
    if (filters.types.length > 1) {
      items = items.filter((item) => filters.types.includes(item.feedbackType))
    }
    if (filters.priorities.length > 1) {
      items = items.filter((item) => filters.priorities.includes(item.priority))
    }
    if (filters.impacts.length > 1) {
      items = items.filter((item) => filters.impacts.includes(item.impactCategory))
    }
    if (filters.orgTypes.length > 0) {
      items = items.filter((item) => item.submitterOrgType && filters.orgTypes.includes(item.submitterOrgType))
    }

    return items
  }, [feedbackQuery.data, filters])

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

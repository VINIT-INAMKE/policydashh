'use client'

import { useState, useMemo } from 'react'
import { Search, SearchX, Loader2 } from 'lucide-react'
import { useDebounce } from 'use-debounce'
import { trpc } from '@/src/trpc/client'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  FeedbackResultCard,
  SectionResultCard,
  CRResultCard,
  type SearchCRResult,
} from './search-result-card'

// ---------------------------------------------------------------------------
// CR status values for inline filter
// ---------------------------------------------------------------------------

const CR_STATUS_OPTIONS = [
  { value: 'drafting', label: 'Drafting' },
  { value: 'in_review', label: 'In Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'merged', label: 'Merged' },
  { value: 'closed', label: 'Closed' },
] as const

// ---------------------------------------------------------------------------
// Loading skeleton for result cards
// ---------------------------------------------------------------------------

function ResultSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl p-4 ring-1 ring-foreground/10"
        >
          <Skeleton className="mb-2 h-4 w-2/3" />
          <Skeleton className="mb-1 h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// No results empty state
// ---------------------------------------------------------------------------

function NoResultsState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <SearchX className="h-12 w-12 text-muted-foreground" />
      <p className="text-[14px] text-muted-foreground">
        No results for &ldquo;{query}&rdquo;. Try different keywords.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SearchView
// ---------------------------------------------------------------------------

export function SearchView({ documentId }: { documentId: string }) {
  // ---- Search input state ----
  const [query, setQuery] = useState('')
  const [debouncedQuery] = useDebounce(query, 400)

  const isQueryValid = debouncedQuery.length >= 2

  // ---- Scope tab state ----
  const [activeScope, setActiveScope] = useState('feedback')

  // ---- CR inline filter state ----
  const [crStatusFilters, setCrStatusFilters] = useState<Set<string>>(new Set())
  const [crSectionId, setCrSectionId] = useState<string | undefined>(undefined)

  // ---- tRPC queries (3 parallel, enabled only when query >= 2 chars) ----
  const feedbackResults = trpc.traceability.searchFeedback.useQuery(
    { documentId, query: debouncedQuery },
    { enabled: isQueryValid },
  )
  const sectionResults = trpc.traceability.searchSections.useQuery(
    { documentId, query: debouncedQuery },
    { enabled: isQueryValid },
  )
  const crResults = trpc.traceability.searchCRs.useQuery(
    { documentId, query: debouncedQuery, sectionId: crSectionId },
    { enabled: isQueryValid },
  )

  // ---- Sections list for CR section filter dropdown ----
  const sectionsQuery = trpc.document.getSections.useQuery({ documentId })

  // ---- Derived loading / error state ----
  const isAnyLoading =
    feedbackResults.isLoading || sectionResults.isLoading || crResults.isLoading
  const isAnyError =
    feedbackResults.isError || sectionResults.isError || crResults.isError

  // ---- CR results with client-side status filter ----
  const filteredCRResults = useMemo(() => {
    if (!crResults.data) return []
    if (crStatusFilters.size === 0) return crResults.data
    return crResults.data.filter((cr: SearchCRResult) =>
      crStatusFilters.has(cr.status),
    )
  }, [crResults.data, crStatusFilters])

  // ---- Counts ----
  const feedbackCount = feedbackResults.data?.length
  const sectionCount = sectionResults.data?.length
  const crCount = filteredCRResults.length

  // ---- CR status toggle handler ----
  function toggleCRStatus(status: string) {
    setCrStatusFilters((prev) => {
      const next = new Set(prev)
      if (next.has(status)) {
        next.delete(status)
      } else {
        next.add(status)
      }
      return next
    })
  }

  // ---- Active result count for the currently visible scope ----
  function activeResultCount(): number | undefined {
    if (!isQueryValid) return undefined
    if (activeScope === 'feedback') return feedbackCount
    if (activeScope === 'sections') return sectionCount
    if (activeScope === 'crs') return crCount
    return undefined
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Search input */}
      <div className="mx-auto w-full max-w-[640px]">
        <InputGroup className={isAnyError ? 'border-destructive' : ''}>
          <InputGroupAddon align="inline-start">
            <Search className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            role="searchbox"
            aria-label="Search feedback, policy content, and change requests"
            placeholder="Search feedback, policy content, or change requests..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {isQueryValid && isAnyLoading && (
            <InputGroupAddon align="inline-end">
              <Loader2 className="size-3 animate-spin" />
            </InputGroupAddon>
          )}
        </InputGroup>
        {isAnyError && (
          <p className="mt-1 text-[12px] text-destructive">
            Search is temporarily unavailable. Please try again.
          </p>
        )}
      </div>

      {/* No query empty state */}
      {!isQueryValid && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Search className="h-12 w-12 text-muted-foreground" />
          <p className="text-[14px] text-muted-foreground">
            Search across all feedback, policy sections, and change requests.
          </p>
        </div>
      )}

      {/* Results area (only when query is valid) */}
      {isQueryValid && (
        <Tabs
          value={activeScope}
          onValueChange={(v) => setActiveScope(v as string)}
        >
          <TabsList variant="line">
            <TabsTrigger value="feedback">
              Feedback ({feedbackResults.isLoading ? '\u2026' : feedbackCount ?? 0})
            </TabsTrigger>
            <TabsTrigger value="sections">
              Policy Content ({sectionResults.isLoading ? '\u2026' : sectionCount ?? 0})
            </TabsTrigger>
            <TabsTrigger value="crs">
              Change Requests ({crResults.isLoading ? '\u2026' : crCount})
            </TabsTrigger>
          </TabsList>

          {/* Result count */}
          {activeResultCount() !== undefined && (
            <span className="mt-2 text-[12px] font-normal text-muted-foreground">
              {activeResultCount()} results
            </span>
          )}

          {/* Feedback scope */}
          <TabsContent value="feedback">
            <div aria-live="polite" className="flex flex-col gap-3">
              {feedbackResults.isLoading ? (
                <ResultSkeleton />
              ) : feedbackResults.data && feedbackResults.data.length > 0 ? (
                feedbackResults.data.map((result) => (
                  <FeedbackResultCard
                    key={result.id}
                    result={result}
                    query={debouncedQuery}
                    documentId={documentId}
                  />
                ))
              ) : (
                <NoResultsState query={debouncedQuery} />
              )}
            </div>
          </TabsContent>

          {/* Policy Content scope */}
          <TabsContent value="sections">
            <div aria-live="polite" className="flex flex-col gap-3">
              {sectionResults.isLoading ? (
                <ResultSkeleton />
              ) : sectionResults.data && sectionResults.data.length > 0 ? (
                sectionResults.data.map((result) => (
                  <SectionResultCard
                    key={result.id}
                    result={result}
                    query={debouncedQuery}
                    documentId={documentId}
                  />
                ))
              ) : (
                <NoResultsState query={debouncedQuery} />
              )}
            </div>
          </TabsContent>

          {/* Change Requests scope */}
          <TabsContent value="crs">
            {/* Inline CR filters (SRCH-04) */}
            <div className="mb-4 flex flex-wrap items-center gap-4">
              {/* Status checkboxes */}
              <div className="flex flex-wrap items-center gap-3">
                {CR_STATUS_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-1.5 text-[12px] text-muted-foreground"
                  >
                    <Checkbox
                      checked={crStatusFilters.has(opt.value)}
                      onCheckedChange={() => toggleCRStatus(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>

              {/* Section filter */}
              <div className="w-[200px]">
                <Select
                  value={crSectionId ?? ''}
                  onValueChange={(val) =>
                    setCrSectionId(val === '' || val == null ? undefined : val)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All sections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All sections</SelectItem>
                    {(sectionsQuery.data ?? []).map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div aria-live="polite" className="flex flex-col gap-3">
              {crResults.isLoading ? (
                <ResultSkeleton />
              ) : filteredCRResults.length > 0 ? (
                filteredCRResults.map((result: SearchCRResult) => (
                  <CRResultCard
                    key={result.id}
                    result={result}
                    query={debouncedQuery}
                    documentId={documentId}
                  />
                ))
              ) : (
                <NoResultsState query={debouncedQuery} />
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

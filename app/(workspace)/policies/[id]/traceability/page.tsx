'use client'

import { useState, useMemo } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Network, FileText, User, Search } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { MatrixTable } from './_components/matrix-table'
import { MatrixFilterPanel, MobileFilterTrigger } from './_components/matrix-filter-panel'
import { ExportActions, type TraceabilityFilterState } from './_components/export-actions'
import { SectionChainView } from './_components/section-chain-view'
import { StakeholderOutcomes } from './_components/stakeholder-outcomes'
import { SearchView } from './_components/search-view'

const EMPTY_FILTERS: TraceabilityFilterState = {
  orgTypes: [],
  sectionId: undefined,
  decisionOutcomes: [],
  versionFrom: undefined,
  versionTo: undefined,
}

export default function TraceabilityPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const documentId = params.id

  const activeTab = searchParams.get('tab') ?? 'matrix'
  const [filters, setFilters] = useState<TraceabilityFilterState>(EMPTY_FILTERS)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const handleTabChange = (value: string | number | null) => {
    const tab = String(value ?? 'matrix')
    const newParams = new URLSearchParams(searchParams.toString())
    if (tab === 'matrix') {
      newParams.delete('tab')
    } else {
      newParams.set('tab', tab)
    }
    const qs = newParams.toString()
    router.replace(`/policies/${documentId}/traceability${qs ? `?${qs}` : ''}`)
  }

  // Build tRPC query input from filter state
  const matrixQueryInput = useMemo(() => ({
    documentId,
    sectionId: filters.sectionId,
    orgType: filters.orgTypes.length === 1 ? filters.orgTypes[0] as 'government' | 'industry' | 'legal' | 'academia' | 'civil_society' | 'internal' : undefined,
    decisionOutcome: filters.decisionOutcomes.length === 1 ? filters.decisionOutcomes[0] as 'submitted' | 'under_review' | 'accepted' | 'partially_accepted' | 'rejected' | 'closed' : undefined,
    versionFromLabel: filters.versionFrom,
    versionToLabel: filters.versionTo,
  }), [documentId, filters])

  const matrixQuery = trpc.traceability.matrix.useQuery(matrixQueryInput)

  // Fetch sections for filter panel
  const sectionsQuery = trpc.document.getSections.useQuery({ documentId })
  // Fetch versions for filter panel
  const versionsQuery = trpc.version.list.useQuery({ documentId })

  const sections = useMemo(
    () => (sectionsQuery.data ?? []).map((s) => ({ id: s.id, title: s.title })),
    [sectionsQuery.data]
  )
  const versions = useMemo(
    () => (versionsQuery.data ?? []).map((v) => ({ label: v.versionLabel })),
    [versionsQuery.data]
  )

  // Client-side multi-filter for org types and decision outcomes
  const filteredRows = useMemo(() => {
    if (!matrixQuery.data) return []
    let rows = matrixQuery.data

    if (filters.orgTypes.length > 1) {
      rows = rows.filter(
        (row) => row.submitterOrgType && filters.orgTypes.includes(row.submitterOrgType)
      )
    }
    if (filters.decisionOutcomes.length > 1) {
      rows = rows.filter((row) =>
        filters.decisionOutcomes.includes(row.feedbackStatus)
      )
    }

    return rows
  }, [matrixQuery.data, filters.orgTypes, filters.decisionOutcomes])

  const resultCount = filteredRows.length

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Page header */}
      <div className="shrink-0 border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-semibold leading-[1.2]">Traceability</h1>
            {activeTab === 'matrix' && (
              <span className="text-[12px] font-normal text-muted-foreground">
                {resultCount} feedback items
              </span>
            )}
          </div>
          <ExportActions documentId={documentId} filters={filters} />
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="shrink-0 border-b px-6">
          <TabsList variant="line">
            <TabsTrigger value="matrix">
              <Network className="size-4" />
              Traceability Matrix
            </TabsTrigger>
            <TabsTrigger value="section">
              <FileText className="size-4" />
              By Section
            </TabsTrigger>
            <TabsTrigger value="stakeholder">
              <User className="size-4" />
              By Stakeholder
            </TabsTrigger>
            <TabsTrigger value="search">
              <Search className="size-4" />
              Search
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Matrix tab content */}
        <TabsContent value="matrix" className="min-h-0 flex-1">
          <div className="flex h-full">
            {/* Desktop filter panel */}
            <div className="hidden w-[240px] shrink-0 overflow-y-auto border-r bg-muted lg:block">
              <MatrixFilterPanel
                filters={filters}
                onFiltersChange={setFilters}
                sections={sections}
                versions={versions}
              />
            </div>

            {/* Matrix table area */}
            <div className="flex-1 overflow-x-auto overflow-y-auto p-4">
              {/* Mobile filter trigger */}
              <div className="mb-4 lg:hidden">
                <MobileFilterTrigger
                  open={mobileFiltersOpen}
                  onOpenChange={setMobileFiltersOpen}
                  filters={filters}
                  onFiltersChange={setFilters}
                  sections={sections}
                  versions={versions}
                />
              </div>

              <MatrixTable
                rows={filteredRows}
                isLoading={matrixQuery.isLoading}
                documentId={documentId}
              />
            </div>
          </div>
        </TabsContent>

        {/* By Section tab */}
        <TabsContent value="section" className="min-h-0 flex-1 overflow-y-auto">
          <SectionChainView documentId={documentId} sections={sections} />
        </TabsContent>

        {/* By Stakeholder tab */}
        <TabsContent value="stakeholder" className="min-h-0 flex-1 overflow-y-auto">
          <StakeholderOutcomes documentId={documentId} />
        </TabsContent>

        {/* Search tab */}
        <TabsContent value="search" className="min-h-0 flex-1 overflow-y-auto">
          <SearchView documentId={documentId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

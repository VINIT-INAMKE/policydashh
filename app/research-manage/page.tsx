'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { keepPreviousData } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Plus, FileSearch, ChevronUp, ChevronDown, Filter as FilterIcon } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { can, type Permission } from '@/src/lib/permissions'
import type { Role } from '@/src/lib/constants'
import { formatAuthorsForDisplay } from '@/src/lib/research-utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ResearchStatusBadge } from './_components/research-status-badge'
import {
  ResearchFilterPanel,
  EMPTY_RESEARCH_FILTERS,
  type ResearchFilters,
  type ResearchItemTypeValue,
  type ResearchStatusValue,
} from './_components/research-filter-panel'

/**
 * /research-manage — Phase 27 D-08, D-09 entry point.
 *
 * - Two-column layout: 240px filter rail (desktop) + flex-1 sortable Table.
 * - Mobile: filter panel inside a Collapsible above the table.
 * - URL-param bootstrap honors ?status=, ?author=me, ?document=, ?type= so
 *   dashboard-widget deep links land on a pre-filtered view.
 * - Role-gated CTA: "Create Research Item" visible only to roles with
 *   `research:create` permission.
 *
 * Server-side filter (single value): documentId/itemType/status/authorId pass
 * through to `trpc.research.list`. The first value of each multi-checkbox
 * group is sent to the server (Phase 4 precedent); the remaining values are
 * applied client-side after fetch.
 *
 * RBAC scope: research_lead self-scopes by passing authorId=ctx.user.id at
 * the URL bootstrap layer (D-08 / SC-1 from CONTEXT.md). The router's
 * `assertOwnershipOrBypass` is the real authority — this client filter is
 * the convenience layer.
 */

type SortColumn = 'readableId' | 'title' | 'itemType' | 'status' | 'authors' | 'updatedAt'
type SortDirection = 'asc' | 'desc'

const ALL_ITEM_TYPES = new Set<ResearchItemTypeValue>([
  'report',
  'paper',
  'dataset',
  'memo',
  'interview_transcript',
  'media_coverage',
  'legal_reference',
  'case_study',
])

const ALL_STATUSES = new Set<ResearchStatusValue>([
  'draft',
  'pending_review',
  'published',
  'retracted',
])

function isValidItemType(value: string): value is ResearchItemTypeValue {
  return ALL_ITEM_TYPES.has(value as ResearchItemTypeValue)
}

function isValidStatus(value: string): value is ResearchStatusValue {
  return ALL_STATUSES.has(value as ResearchStatusValue)
}

function formatTypeLabel(itemType: string): string {
  return itemType.replace(/_/g, ' ')
}

function authorsCellContent(item: {
  isAuthorAnonymous: boolean
  authors: string[] | null
}): string {
  // Single source of truth — formatAuthorsForDisplay is used on the detail
  // page and Phase 28 public surface as well (D-05). Strip the verbose
  // "Authors: " prefix and rewrite "Source: Confidential" for table density.
  const formatted = formatAuthorsForDisplay(item)
  if (formatted === 'Source: Confidential') return 'Confidential'
  if (formatted.startsWith('Authors: ')) return formatted.slice('Authors: '.length)
  return formatted
}

function activeFilterCount(filters: ResearchFilters): number {
  let n = 0
  if (filters.documentId) n++
  n += filters.itemType.length
  n += filters.status.length
  if (filters.authorId) n++
  return n
}

export default function ResearchManagePage() {
  const searchParams = useSearchParams()
  const meQuery = trpc.user.getMe.useQuery()

  // ---- URL bootstrap ----------------------------------------------------
  // Derived once per render from searchParams; only the meaningful values
  // are propagated into filter state. `?author=me` is special — we cannot
  // resolve it until meQuery settles, so we re-hydrate via useEffect.
  const initialFilters = useMemo<ResearchFilters>(() => {
    const next: ResearchFilters = { ...EMPTY_RESEARCH_FILTERS, itemType: [], status: [] }

    const document = searchParams.get('document')
    if (document) next.documentId = document

    const status = searchParams.get('status')
    if (status && isValidStatus(status)) next.status = [status]

    const itemType = searchParams.get('type')
    if (itemType && isValidItemType(itemType)) next.itemType = [itemType]

    const author = searchParams.get('author')
    if (author && author !== 'me') next.authorId = author
    // 'me' is resolved post-meQuery in the useEffect below.

    return next
  }, [searchParams])

  const [filters, setFilters] = useState<ResearchFilters>(initialFilters)
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection }>({
    column: 'updatedAt',
    direction: 'desc',
  })
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  // Resolve ?author=me once meQuery has the current user id. Guards against
  // re-running every render: only fires when authorId is empty AND the URL
  // param is literally 'me'.
  useEffect(() => {
    if (filters.authorId) return
    if (searchParams.get('author') !== 'me') return
    if (!meQuery.data?.id) return
    setFilters((prev) => ({ ...prev, authorId: meQuery.data!.id }))
  }, [filters.authorId, meQuery.data, searchParams])

  // ---- Queries ----------------------------------------------------------
  const role = meQuery.data?.role as Role | undefined
  const canCreate = role ? can(role, 'research:create' as Permission) : false
  const canListUsers = role ? can(role, 'user:list' as Permission) : false

  const listQuery = trpc.research.list.useQuery(
    {
      documentId: filters.documentId,
      // Phase 4 pattern: send first value of each multi-select to server,
      // client-filter the rest.
      itemType: filters.itemType[0],
      status: filters.status[0],
      authorId: filters.authorId,
    },
    { placeholderData: keepPreviousData },
  )

  const documentsQuery = trpc.document.list.useQuery({})

  // Authors dropdown shortcut: only admins can hit `user.listUsers` (gated by
  // `user:list`). For research_lead/policy_lead the dropdown shows the
  // current user (so they can self-filter via the UI) plus the parent
  // disables the Select. URL-driven `?author=me` still works for everyone
  // because the meQuery resolves the id above.
  const adminUsersQuery = trpc.user.listUsers.useQuery(undefined, {
    enabled: canListUsers,
  })

  // ---- Client-side multi-filter + sort ---------------------------------
  const visibleItems = useMemo(() => {
    const rows = listQuery.data ?? []
    const filtered = rows.filter((row) => {
      // Already server-filtered on first value of each list; here we narrow
      // further when the user picked multiple checkboxes.
      if (filters.itemType.length > 0 && !filters.itemType.includes(row.itemType as ResearchItemTypeValue)) {
        return false
      }
      if (filters.status.length > 0 && !filters.status.includes(row.status as ResearchStatusValue)) {
        return false
      }
      return true
    })

    const sorted = [...filtered].sort((a, b) => {
      const dir = sort.direction === 'asc' ? 1 : -1
      switch (sort.column) {
        case 'readableId':
          return a.readableId.localeCompare(b.readableId, undefined, { numeric: true }) * dir
        case 'title':
          return a.title.localeCompare(b.title) * dir
        case 'itemType':
          return a.itemType.localeCompare(b.itemType) * dir
        case 'status':
          return a.status.localeCompare(b.status) * dir
        case 'authors': {
          const aAuth = authorsCellContent({ isAuthorAnonymous: a.isAuthorAnonymous, authors: a.authors })
          const bAuth = authorsCellContent({ isAuthorAnonymous: b.isAuthorAnonymous, authors: b.authors })
          return aAuth.localeCompare(bAuth) * dir
        }
        case 'updatedAt':
        default: {
          const aT = new Date(a.updatedAt).getTime()
          const bT = new Date(b.updatedAt).getTime()
          return (aT - bT) * dir
        }
      }
    })

    return sorted
  }, [listQuery.data, filters, sort])

  function toggleSort(column: SortColumn) {
    setSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: column === 'updatedAt' ? 'desc' : 'asc' },
    )
  }

  function SortIcon({ column }: { column: SortColumn }) {
    if (sort.column !== column) {
      return null
    }
    return sort.direction === 'asc'
      ? <ChevronUp className="ml-1 inline size-4 text-foreground" />
      : <ChevronDown className="ml-1 inline size-4 text-foreground" />
  }

  // ---- Author select options -------------------------------------------
  const authorOptions = useMemo(() => {
    if (canListUsers && adminUsersQuery.data) {
      // Admin: show research_lead, admin, policy_lead users only.
      return adminUsersQuery.data
        .filter((u) => u.role === 'research_lead' || u.role === 'admin' || u.role === 'policy_lead')
        .map((u) => ({ id: u.id, name: u.name }))
    }
    if (meQuery.data) {
      return [{ id: meQuery.data.id, name: meQuery.data.name ?? 'Me' }]
    }
    return []
  }, [canListUsers, adminUsersQuery.data, meQuery.data])

  // ---- Render -----------------------------------------------------------
  const items = visibleItems
  const isLoading = listQuery.isLoading || meQuery.isLoading
  const totalRows = listQuery.data?.length ?? 0
  const filteredCount = activeFilterCount(filters)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Research Items</h1>
        {canCreate && (
          <Button render={<Link href="/research-manage/new" />}>
            <Plus className="size-4" />
            Create Research Item
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        {/* Mobile: collapsible filter panel above table */}
        <div className="md:hidden">
          <Collapsible open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <CollapsibleTrigger
              render={
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <FilterIcon className="size-4" />
                    Filters{filteredCount > 0 ? ` · ${filteredCount}` : ''}
                  </span>
                  {mobileFiltersOpen ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                </Button>
              }
            />
            <CollapsibleContent>
              <div className="mt-2 rounded-lg border bg-card">
                <ResearchFilterPanel
                  filters={filters}
                  onChange={setFilters}
                  documents={documentsQuery.data ?? []}
                  authors={authorOptions}
                  authorSelectDisabled={!canListUsers}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Desktop: 240px left rail */}
        <aside className="hidden md:block">
          <div className="rounded-lg border bg-card">
            <ResearchFilterPanel
              filters={filters}
              onChange={setFilters}
              documents={documentsQuery.data ?? []}
              authors={authorOptions}
              authorSelectDisabled={!canListUsers}
            />
          </div>
        </aside>

        {/* Table column */}
        <section className="flex-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort('readableId')}
                >
                  ID<SortIcon column="readableId" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort('title')}
                >
                  Title<SortIcon column="title" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort('itemType')}
                >
                  Type<SortIcon column="itemType" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort('status')}
                >
                  Status<SortIcon column="status" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort('authors')}
                >
                  Authors<SortIcon column="authors" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort('updatedAt')}
                >
                  Updated<SortIcon column="updatedAt" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={`skel-${i}`}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-10" />
                      </TableCell>
                    </TableRow>
                  ))
                : items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link href={`/research-manage/${item.id}`}>
                          <Badge variant="secondary" className="font-mono text-xs">
                            {item.readableId}
                          </Badge>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/research-manage/${item.id}`}
                          className="block max-w-md truncate hover:underline"
                        >
                          <span className="truncate">{item.title}</span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {formatTypeLabel(item.itemType)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <ResearchStatusBadge status={item.status} />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {authorsCellContent({
                            isAuthorAnonymous: item.isAuthorAnonymous,
                            authors: item.authors,
                          })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>

          {/* Empty states — only shown after the initial load has settled */}
          {!isLoading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <FileSearch className="size-12 text-muted-foreground" />
              {totalRows === 0 ? (
                <>
                  <h2 className="mt-4 text-lg font-semibold">No research items yet</h2>
                  <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
                    Create a research item to attach citable evidence to a policy document.
                  </p>
                  {canCreate && (
                    <Button
                      className="mt-4"
                      render={<Link href="/research-manage/new" />}
                    >
                      <Plus className="size-4" />
                      Create Research Item
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <h2 className="mt-4 text-lg font-semibold">No items match these filters</h2>
                  <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
                    Try adjusting the type or status filters.
                  </p>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

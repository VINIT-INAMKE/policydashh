'use client'

import { useState } from 'react'
import { Search, Users } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ORG_TYPE_OPTIONS = [
  { value: 'all', label: 'All organization types' },
  { value: 'government', label: 'Government' },
  { value: 'industry', label: 'Industry' },
  { value: 'legal', label: 'Legal' },
  { value: 'academia', label: 'Academia' },
  { value: 'civil_society', label: 'Civil Society' },
  { value: 'internal', label: 'Internal' },
] as const

const ORG_TYPE_DISPLAY: Record<string, string> = {
  government: 'Government',
  industry: 'Industry',
  legal: 'Legal',
  academia: 'Academia',
  civil_society: 'Civil Society',
  internal: 'Internal',
}

type OrgFilter = (typeof ORG_TYPE_OPTIONS)[number]['value']

function truncate(text: string | null, max: number): string | null {
  if (!text) return null
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return trimmed.slice(0, max).replace(/\s+\S*$/, '') + '…'
}

export function DirectoryClient() {
  const [orgFilter, setOrgFilter] = useState<OrgFilter>('all')
  const [query, setQuery] = useState('')

  const stakeholdersQuery = trpc.user.listStakeholders.useQuery({
    orgType: orgFilter === 'all' ? undefined : orgFilter,
    q: query.trim() || undefined,
  })

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            placeholder="Search by name, title, or expertise"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            maxLength={200}
          />
        </div>
        <Select
          value={orgFilter}
          onValueChange={(v) => setOrgFilter(v as OrgFilter)}
        >
          <SelectTrigger className="sm:w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORG_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {stakeholdersQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stakeholdersQuery.error ? (
        <Card className="px-6 py-8 text-center text-sm text-muted-foreground">
          We couldn&apos;t load the directory. Refresh to try again.
        </Card>
      ) : !stakeholdersQuery.data || stakeholdersQuery.data.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <Users className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {query || orgFilter !== 'all'
              ? 'No stakeholders match those filters. Try clearing them.'
              : 'No stakeholders have completed their profile yet.'}
          </p>
        </Card>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {stakeholdersQuery.data.length}{' '}
            {stakeholdersQuery.data.length === 1 ? 'stakeholder' : 'stakeholders'}
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stakeholdersQuery.data.map((s) => (
              <Card key={s.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold leading-tight">
                      {s.name || 'Unnamed stakeholder'}
                    </h3>
                    {s.orgType && (
                      <Badge variant="outline" className="shrink-0">
                        {ORG_TYPE_DISPLAY[s.orgType] ?? s.orgType}
                      </Badge>
                    )}
                  </div>
                  {(s.designation || s.orgName) && (
                    <p className="text-sm text-muted-foreground">
                      {s.designation}
                      {s.designation && s.orgName ? ' · ' : ''}
                      {s.orgName}
                    </p>
                  )}
                </CardHeader>
                {s.expertise && (
                  <CardContent className="flex-1">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {truncate(s.expertise, 240)}
                    </p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

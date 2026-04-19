'use client'

import { ACTIONS, ROLES } from '@/src/lib/constants'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface FilterState {
  action?: string
  actorRole?: string
  entityType?: string
  from?: string
  to?: string
}

interface AuditFilterPanelProps {
  filters: FilterState
  onFilterChange: (filters: FilterState) => void
}

// H6: Radix Select treats '' as "no value" and refuses to render SelectItems
// with empty-string values. We use a sentinel that maps back to `undefined`
// in the filter state so Select reliably renders and clears.
const ALL_SENTINEL = '__all__'

const actionOptions = Object.entries(ACTIONS).map(([, value]) => ({
  value,
  label: value,
}))

const roleOptions = Object.entries(ROLES).map(([, value]) => ({
  value,
  label: value.replace(/_/g, ' '),
}))

const entityTypeOptions = [
  { value: 'feedback', label: 'Feedback' },
  { value: 'change_request', label: 'Change Request' },
  { value: 'document_version', label: 'Document Version' },
  { value: 'policy_section', label: 'Policy Section' },
  { value: 'user', label: 'User' },
  { value: 'document', label: 'Document' },
]

function hasActiveFilters(filters: FilterState): boolean {
  return !!(filters.action || filters.actorRole || filters.entityType || filters.from || filters.to)
}

function decodeSentinel(val: string | null): string | undefined {
  if (val == null || val === ALL_SENTINEL) return undefined
  return val
}

export function AuditFilterPanel({ filters, onFilterChange }: AuditFilterPanelProps) {
  const isActive = hasActiveFilters(filters)

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-normal text-muted-foreground">Action type</label>
        <Select
          value={filters.action ?? ALL_SENTINEL}
          onValueChange={(val) => onFilterChange({ ...filters, action: decodeSentinel(val) })}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SENTINEL}>All actions</SelectItem>
            {actionOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-normal text-muted-foreground">Actor role</label>
        <Select
          value={filters.actorRole ?? ALL_SENTINEL}
          onValueChange={(val) => onFilterChange({ ...filters, actorRole: decodeSentinel(val) })}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SENTINEL}>All roles</SelectItem>
            {roleOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-normal text-muted-foreground">Entity type</label>
        <Select
          value={filters.entityType ?? ALL_SENTINEL}
          onValueChange={(val) => onFilterChange({ ...filters, entityType: decodeSentinel(val) })}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All entities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SENTINEL}>All entities</SelectItem>
            {entityTypeOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-normal text-muted-foreground">From</label>
        <input
          type="date"
          value={filters.from ?? ''}
          onChange={(e) => onFilterChange({ ...filters, from: e.target.value || undefined })}
          className="flex h-8 w-36 items-center rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-normal text-muted-foreground">To</label>
        <input
          type="date"
          value={filters.to ?? ''}
          onChange={(e) => onFilterChange({ ...filters, to: e.target.value || undefined })}
          className="flex h-8 w-36 items-center rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      {isActive && (
        <Button
          variant="ghost"
          size="sm"
          aria-label="Clear all filters"
          onClick={() => onFilterChange({})}
        >
          Clear
        </Button>
      )}
    </div>
  )
}

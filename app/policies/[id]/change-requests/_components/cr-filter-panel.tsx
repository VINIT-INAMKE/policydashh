'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface CRFilters {
  statuses: string[]
  sectionId: string | null
}

export const EMPTY_CR_FILTERS: CRFilters = {
  statuses: [],
  sectionId: null,
}

interface CRFilterPanelProps {
  filters: CRFilters
  onFiltersChange: (filters: CRFilters) => void
  sections: { id: string; title: string }[]
}

const CR_STATUS_OPTIONS = [
  { value: 'drafting', label: 'Drafting' },
  { value: 'in_review', label: 'In Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'merged', label: 'Merged' },
  { value: 'closed', label: 'Closed' },
]

function hasActiveFilters(filters: CRFilters) {
  return filters.statuses.length > 0 || !!filters.sectionId
}

function toggleInArray(arr: string[], value: string) {
  return arr.includes(value)
    ? arr.filter((v) => v !== value)
    : [...arr, value]
}

interface CheckboxGroupProps {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (values: string[]) => void
}

function CheckboxFilterGroup({ label, options, selected, onChange }: CheckboxGroupProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-col gap-1.5">
        {options.map((opt) => {
          const isChecked = selected.includes(opt.value)
          return (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2"
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={() => onChange(toggleInArray(selected, opt.value))}
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

export function CRFilterPanel({ filters, onFiltersChange, sections }: CRFilterPanelProps) {
  const active = hasActiveFilters(filters)

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
          Filters
        </h2>
        {active && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFiltersChange(EMPTY_CR_FILTERS)}
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Status checkbox group */}
      <CheckboxFilterGroup
        label="Status"
        options={CR_STATUS_OPTIONS}
        selected={filters.statuses}
        onChange={(statuses) => onFiltersChange({ ...filters, statuses })}
      />

      {/* Section select */}
      <div className="flex flex-col gap-2">
        <Label className="text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
          Section
        </Label>
        <Select
          value={filters.sectionId ?? ''}
          onValueChange={(val) => {
            onFiltersChange({
              ...filters,
              sectionId: val || null,
            })
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="All sections" />
          </SelectTrigger>
          <SelectContent>
            {sections.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

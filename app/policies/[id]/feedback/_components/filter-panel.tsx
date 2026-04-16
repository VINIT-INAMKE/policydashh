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

export interface FilterState {
  sectionId?: string
  statuses: string[]
  types: string[]
  priorities: string[]
  impacts: string[]
  orgTypes: string[]
}

export const EMPTY_FILTERS: FilterState = {
  sectionId: undefined,
  statuses: [],
  types: [],
  priorities: [],
  impacts: [],
  orgTypes: [],
}

interface FilterPanelProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  sections: { id: string; title: string }[]
}

const STATUS_OPTIONS = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'partially_accepted', label: 'Partially Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'closed', label: 'Closed' },
]

const TYPE_OPTIONS = [
  { value: 'issue', label: 'Issue' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'endorsement', label: 'Endorsement' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'question', label: 'Question' },
]

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const IMPACT_OPTIONS = [
  { value: 'legal', label: 'Legal' },
  { value: 'security', label: 'Security' },
  { value: 'tax', label: 'Tax' },
  { value: 'consumer', label: 'Consumer' },
  { value: 'innovation', label: 'Innovation' },
  { value: 'clarity', label: 'Clarity' },
  { value: 'governance', label: 'Governance' },
  { value: 'other', label: 'Other' },
]

const ORG_TYPE_OPTIONS = [
  { value: 'government', label: 'Government' },
  { value: 'industry', label: 'Industry' },
  { value: 'legal', label: 'Legal' },
  { value: 'academia', label: 'Academia' },
  { value: 'civil_society', label: 'Civil Society' },
  { value: 'internal', label: 'Internal' },
]

function hasActiveFilters(filters: FilterState) {
  return (
    !!filters.sectionId ||
    filters.statuses.length > 0 ||
    filters.types.length > 0 ||
    filters.priorities.length > 0 ||
    filters.impacts.length > 0 ||
    filters.orgTypes.length > 0
  )
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

export function FilterPanel({ filters, onFiltersChange, sections }: FilterPanelProps) {
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
            onClick={() => onFiltersChange(EMPTY_FILTERS)}
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Section filter */}
      <div className="flex flex-col gap-2">
        <Label className="text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
          Section
        </Label>
        <Select
          value={filters.sectionId ?? ''}
          onValueChange={(val) => {
            onFiltersChange({
              ...filters,
              sectionId: val || undefined,
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

      {/* Status */}
      <CheckboxFilterGroup
        label="Status"
        options={STATUS_OPTIONS}
        selected={filters.statuses}
        onChange={(statuses) => onFiltersChange({ ...filters, statuses })}
      />

      {/* Type */}
      <CheckboxFilterGroup
        label="Type"
        options={TYPE_OPTIONS}
        selected={filters.types}
        onChange={(types) => onFiltersChange({ ...filters, types })}
      />

      {/* Priority */}
      <CheckboxFilterGroup
        label="Priority"
        options={PRIORITY_OPTIONS}
        selected={filters.priorities}
        onChange={(priorities) => onFiltersChange({ ...filters, priorities })}
      />

      {/* Impact */}
      <CheckboxFilterGroup
        label="Impact"
        options={IMPACT_OPTIONS}
        selected={filters.impacts}
        onChange={(impacts) => onFiltersChange({ ...filters, impacts })}
      />

      {/* Org Type */}
      <CheckboxFilterGroup
        label="Org Type"
        options={ORG_TYPE_OPTIONS}
        selected={filters.orgTypes}
        onChange={(orgTypes) => onFiltersChange({ ...filters, orgTypes })}
      />
    </div>
  )
}

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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Filter } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { TraceabilityFilterState } from './export-actions'

interface MatrixFilterPanelProps {
  filters: TraceabilityFilterState
  onFiltersChange: (filters: TraceabilityFilterState) => void
  sections: { id: string; title: string }[]
  versions: { label: string }[]
}

const ORG_TYPE_OPTIONS = [
  { value: 'government', label: 'Government' },
  { value: 'industry', label: 'Industry' },
  { value: 'legal', label: 'Legal' },
  { value: 'academia', label: 'Academia' },
  { value: 'civil_society', label: 'Civil Society' },
  { value: 'internal', label: 'Internal' },
]

const DECISION_OPTIONS = [
  { value: 'accepted', label: 'Accepted' },
  { value: 'partially_accepted', label: 'Partially Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'closed', label: 'Closed' },
]

function toggleInArray(arr: string[], value: string) {
  return arr.includes(value)
    ? arr.filter((v) => v !== value)
    : [...arr, value]
}

function hasActiveFilters(filters: TraceabilityFilterState) {
  return (
    filters.orgTypes.length > 0 ||
    !!filters.sectionId ||
    filters.decisionOutcomes.length > 0 ||
    !!filters.versionFrom ||
    !!filters.versionTo
  )
}

const EMPTY_FILTERS: TraceabilityFilterState = {
  orgTypes: [],
  sectionId: undefined,
  decisionOutcomes: [],
  versionFrom: undefined,
  versionTo: undefined,
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

function FilterContent({
  filters,
  onFiltersChange,
  sections,
  versions,
}: MatrixFilterPanelProps) {
  const active = hasActiveFilters(filters)

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
          FILTERS
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

      {/* Org Type */}
      <CheckboxFilterGroup
        label="Org Type"
        options={ORG_TYPE_OPTIONS}
        selected={filters.orgTypes}
        onChange={(orgTypes) => onFiltersChange({ ...filters, orgTypes })}
      />

      {/* Section */}
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

      {/* Decision Outcome */}
      <CheckboxFilterGroup
        label="Decision Outcome"
        options={DECISION_OPTIONS}
        selected={filters.decisionOutcomes}
        onChange={(decisionOutcomes) => onFiltersChange({ ...filters, decisionOutcomes })}
      />

      {/* Version Range */}
      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
          Version Range
        </span>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-[12px] font-normal text-muted-foreground">
              From version
            </Label>
            <Select
              value={filters.versionFrom ?? ''}
              onValueChange={(val) => {
                onFiltersChange({
                  ...filters,
                  versionFrom: val || undefined,
                })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.label} value={v.label}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[12px] font-normal text-muted-foreground">
              To version
            </Label>
            <Select
              value={filters.versionTo ?? ''}
              onValueChange={(val) => {
                onFiltersChange({
                  ...filters,
                  versionTo: val || undefined,
                })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.label} value={v.label}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MatrixFilterPanel(props: MatrixFilterPanelProps) {
  return <FilterContent {...props} />
}

interface MobileFilterTriggerProps extends MatrixFilterPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileFilterTrigger({
  open,
  onOpenChange,
  ...filterProps
}: MobileFilterTriggerProps) {
  const activeCount =
    filterProps.filters.orgTypes.length +
    (filterProps.filters.sectionId ? 1 : 0) +
    filterProps.filters.decisionOutcomes.length +
    (filterProps.filters.versionFrom ? 1 : 0) +
    (filterProps.filters.versionTo ? 1 : 0)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onOpenChange(true)}
      >
        <Filter className="size-3.5" />
        Filters
        {activeCount > 0 && (
          <Badge variant="secondary" className="ml-1 border-transparent">
            {activeCount}
          </Badge>
        )}
      </Button>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto">
            <FilterContent {...filterProps} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

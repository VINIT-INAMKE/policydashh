'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * ResearchFilterPanel — Phase 27 D-08.
 *
 * Fully controlled filter panel for /research-manage. Owns no internal state;
 * the parent passes the current `filters` and an `onChange` callback that
 * receives the next filters object on every interaction. Mirrors the Phase 4
 * feedback `FilterPanel` pattern (single-source-of-truth Select for documents,
 * multi-checkbox groups for type/status, single-source-of-truth Select for
 * authors).
 *
 * Layout: 240px fixed width on desktop via `w-60 shrink-0` wrapper. The caller
 * decides how to wrap it on mobile (Collapsible vs always-visible stack).
 */

export type ResearchItemTypeValue =
  | 'report'
  | 'paper'
  | 'dataset'
  | 'memo'
  | 'interview_transcript'
  | 'media_coverage'
  | 'legal_reference'
  | 'case_study'

export type ResearchStatusValue =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'retracted'

export interface ResearchFilters {
  documentId?: string
  itemType: ResearchItemTypeValue[]
  status: ResearchStatusValue[]
  authorId?: string
}

export const EMPTY_RESEARCH_FILTERS: ResearchFilters = {
  documentId: undefined,
  itemType: [],
  status: [],
  authorId: undefined,
}

const TYPE_OPTIONS: { value: ResearchItemTypeValue; label: string }[] = [
  { value: 'report',               label: 'Report' },
  { value: 'paper',                label: 'Paper' },
  { value: 'dataset',              label: 'Dataset' },
  { value: 'memo',                 label: 'Memo' },
  { value: 'interview_transcript', label: 'Interview Transcript' },
  { value: 'media_coverage',       label: 'Media Coverage' },
  { value: 'legal_reference',      label: 'Legal Reference' },
  { value: 'case_study',           label: 'Case Study' },
]

const STATUS_OPTIONS: { value: ResearchStatusValue; label: string }[] = [
  { value: 'draft',          label: 'Draft' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'published',      label: 'Published' },
  { value: 'retracted',      label: 'Retracted' },
]

export interface ResearchFilterPanelProps {
  filters: ResearchFilters
  onChange: (next: ResearchFilters) => void
  documents: { id: string; title: string }[]
  authors: { id: string; name: string | null }[]
  /**
   * If `true`, the Author Select is rendered disabled. Passed when the caller's
   * role doesn't allow a populated user list (research_lead → server denies
   * `user:list`); the parent still passes `[]` for `authors` in that case.
   */
  authorSelectDisabled?: boolean
}

function toggleInArray<T>(arr: T[], value: T): T[] {
  return arr.includes(value)
    ? arr.filter((v) => v !== value)
    : [...arr, value]
}

export function ResearchFilterPanel({
  filters,
  onChange,
  documents,
  authors,
  authorSelectDisabled = false,
}: ResearchFilterPanelProps) {
  return (
    <div className="flex w-full flex-col gap-4 p-4 md:w-60 md:shrink-0">
      <h2 className="text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
        Filters
      </h2>

      {/* Document — single-choice Select */}
      <div className="flex flex-col gap-2">
        <Label
          htmlFor="research-filter-document"
          className="text-[12px] font-normal uppercase tracking-wide text-muted-foreground"
        >
          Document
        </Label>
        <Select
          value={filters.documentId ?? '__all__'}
          onValueChange={(val) =>
            onChange({
              ...filters,
              documentId: !val || val === '__all__' ? undefined : val,
            })
          }
        >
          <SelectTrigger id="research-filter-document">
            <SelectValue placeholder="All documents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All documents</SelectItem>
            {documents.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Type — multi-checkbox group (8 enum values) */}
      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
          Type
        </span>
        <div className="flex flex-col gap-1.5">
          {TYPE_OPTIONS.map((opt) => {
            const isChecked = filters.itemType.includes(opt.value)
            return (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2"
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() =>
                    onChange({
                      ...filters,
                      itemType: toggleInArray(filters.itemType, opt.value),
                    })
                  }
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* Status — multi-checkbox group (4 values) */}
      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
          Status
        </span>
        <div className="flex flex-col gap-1.5">
          {STATUS_OPTIONS.map((opt) => {
            const isChecked = filters.status.includes(opt.value)
            return (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2"
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() =>
                    onChange({
                      ...filters,
                      status: toggleInArray(filters.status, opt.value),
                    })
                  }
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* Author — single-choice Select.
          For non-admin roles, the parent passes `[]` for `authors` and sets
          `authorSelectDisabled` so the dropdown shows "All authors" only.
          URL-driven `?author=me` still works because the parent resolves it
          server-side via meQuery before the panel ever renders. */}
      <div className="flex flex-col gap-2">
        <Label
          htmlFor="research-filter-author"
          className="text-[12px] font-normal uppercase tracking-wide text-muted-foreground"
        >
          Author
        </Label>
        <Select
          disabled={authorSelectDisabled}
          value={filters.authorId ?? '__all__'}
          onValueChange={(val) =>
            onChange({
              ...filters,
              authorId: !val || val === '__all__' ? undefined : val,
            })
          }
        >
          <SelectTrigger id="research-filter-author">
            <SelectValue placeholder="All authors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All authors</SelectItem>
            {authors.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name ?? 'Unknown'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

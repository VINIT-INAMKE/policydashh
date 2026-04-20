'use client'

/**
 * Phase 28 Plan 28-02 — type checkbox island for the public filter rail.
 *
 * Client component (only). The rest of the filter panel is a server-rendered
 * <form method="get"> — but multi-select type checkboxes need reactive URL
 * sync so the user can add/remove types without re-submitting the form.
 *
 * URL encoding (RESEARCH OQ1): comma-separated CSV at `?type=`. Page-level
 * parser uses the FIRST valid value for the DB query; the full CSV stays in
 * the URL so the UI selection survives across page loads.
 *
 * Toggling a checkbox replaces the URL via router.replace, which re-renders
 * the parent server component with the new searchParams. `offset` is dropped
 * on filter change so the user lands on page 1 of the new result set.
 */
import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Checkbox } from '@/components/ui/checkbox'
import type { ResearchItemType } from '@/src/server/queries/research-public'

const TYPES: ReadonlyArray<{ value: ResearchItemType; label: string }> = [
  { value: 'report',               label: 'Report' },
  { value: 'paper',                label: 'Paper' },
  { value: 'dataset',              label: 'Dataset' },
  { value: 'memo',                 label: 'Memo' },
  { value: 'interview_transcript', label: 'Interview Transcript' },
  { value: 'media_coverage',       label: 'Media Coverage' },
  { value: 'legal_reference',      label: 'Legal Reference' },
  { value: 'case_study',           label: 'Case Study' },
]

export function ResearchTypeCheckboxes() {
  const pathname = usePathname()
  const router = useRouter()
  const search = useSearchParams()

  const raw = search.get('type') ?? ''
  const selected = new Set(raw ? raw.split(',').filter(Boolean) : [])

  const toggle = useCallback(
    (value: ResearchItemType, checked: boolean) => {
      const next = new Set(selected)
      if (checked) next.add(value)
      else next.delete(value)
      const params = new URLSearchParams(search.toString())
      if (next.size === 0) params.delete('type')
      else params.set('type', Array.from(next).join(','))
      // Reset pagination on filter change
      params.delete('offset')
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    },
    [pathname, router, search, selected],
  )

  return (
    <div role="group" aria-label="Filter by research type" className="flex flex-col gap-2">
      {TYPES.map((t) => (
        <label
          key={t.value}
          className="flex items-center gap-2 min-h-11 cursor-pointer text-sm text-foreground"
        >
          <Checkbox
            checked={selected.has(t.value)}
            onCheckedChange={(v) => toggle(t.value, v === true)}
          />
          <span>{t.label}</span>
        </label>
      ))}
    </div>
  )
}

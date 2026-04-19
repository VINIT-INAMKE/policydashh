import { Badge } from '@/components/ui/badge'

/**
 * ResearchStatusBadge — Phase 27 D-08.
 *
 * Thin wrapper around the shadcn <Badge> primitive that maps a
 * `research_items.status` enum value to a color/label pair. Mirrors the
 * feedback/CR badge pattern (see app/globals.css "research status semantic
 * colors" block for the matching CSS tokens).
 *
 * Used on:
 *   - /research-manage list page Status column
 *   - /research-manage/[id] detail page header (Plan 27-04)
 *   - Dashboard widgets (Plan 27-06)
 *
 * Color tokens are inlined as Tailwind arbitrary values rather than referencing
 * the CSS variables directly so the badge renders correctly inside table cells
 * without inheriting unintended foreground colors.
 */

export type ResearchItemStatus = 'draft' | 'pending_review' | 'published' | 'retracted'

const STATUS_CLASSES: Record<ResearchItemStatus, string> = {
  draft:          'bg-muted text-muted-foreground',
  pending_review: 'bg-[oklch(0.92_0.07_85)] text-[oklch(0.5_0.1_85)]',
  published:      'bg-[oklch(0.9_0.08_145)] text-[oklch(0.4_0.12_145)]',
  retracted:      'bg-[oklch(0.95_0.04_27)] text-[oklch(0.45_0.12_27)]',
}

const STATUS_LABELS: Record<ResearchItemStatus, string> = {
  draft:          'Draft',
  pending_review: 'Pending Review',
  published:      'Published',
  retracted:      'Retracted',
}

export interface ResearchStatusBadgeProps {
  status: ResearchItemStatus
}

export function ResearchStatusBadge({ status }: ResearchStatusBadgeProps) {
  return (
    <Badge className={STATUS_CLASSES[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}

'use client'

import { useState, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { trpc } from '@/src/trpc/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

/**
 * FeedbackLinkPicker — Phase 27 Plan 05 (RESEARCH-08).
 *
 * Controlled dialog ({ open, onOpenChange } parent-owned) for bulk-linking
 * feedback items to a research item. Mirrors
 * app/workshop-manage/[id]/_components/feedback-link-picker.tsx with the
 * research mutation + invalidation wired through.
 *
 * Reuses trpc.feedback.listAll (Phase 27 widened to allow research:read_drafts
 * in addition to workshop:manage). Search filters on title + body; type
 * filter narrows by feedbackType. Already-linked feedback items are filtered
 * out.
 *
 * Uses Promise-based bulk-link with consolidated success / partial-
 * failure toast (UI-SPEC Copywriting Contract). Selection + search + type
 * state reset on close.
 */

const FEEDBACK_TYPES = [
  'issue',
  'suggestion',
  'endorsement',
  'evidence',
  'question',
] as const

export interface FeedbackLinkPickerProps {
  researchItemId: string
  linkedFeedbackIds: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeedbackLinkPicker({
  researchItemId,
  linkedFeedbackIds,
  open,
  onOpenChange,
}: FeedbackLinkPickerProps) {
  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const utils = trpc.useUtils()

  const feedbackQuery = trpc.feedback.listAll.useQuery(undefined, {
    enabled: open,
  })

  const linkMutation = trpc.research.linkFeedback.useMutation()

  async function handleLink() {
    if (selected.length === 0) {
      onOpenChange(false)
      return
    }
    try {
      const results = await Promise.allSettled(
        selected.map((feedbackId) =>
          linkMutation.mutateAsync({ researchItemId, feedbackId }),
        ),
      )
      const failures = results.filter((r) => r.status === 'rejected').length
      const successes = results.length - failures
      if (successes > 0) {
        utils.research.getById.invalidate({ id: researchItemId })
      }
      if (failures === 0) {
        toast.success(
          successes === 1
            ? 'Feedback linked.'
            : `${successes} feedback items linked.`,
        )
      } else {
        toast.error(
          `Linked ${successes} of ${results.length}. ${failures} failed — try again.`,
        )
      }
    } finally {
      setSelected([])
      setSearch('')
      setTypeFilter('')
      onOpenChange(false)
    }
  }

  function toggleFeedback(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  const filtered = useMemo(() => {
    let items = feedbackQuery.data ?? []
    items = items.filter((f) => !linkedFeedbackIds.includes(f.id))
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(
        (f) =>
          f.title.toLowerCase().includes(q) ||
          f.body.toLowerCase().includes(q),
      )
    }
    if (typeFilter) {
      items = items.filter((f) => f.feedbackType === typeFilter)
    }
    return items
  }, [feedbackQuery.data, search, typeFilter, linkedFeedbackIds])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link Feedback to Research Item</DialogTitle>
        </DialogHeader>

        {/* Search + Filter row */}
        <div className="flex gap-2">
          <Input
            placeholder="Search feedback..."
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearch(e.target.value)
            }
            className="flex-1"
          />
          <Select
            value={typeFilter}
            onValueChange={(val) => setTypeFilter(val ?? '')}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All types</SelectItem>
              {FEEDBACK_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Feedback cards */}
        <div className="mt-2 flex max-h-[360px] flex-col gap-2 overflow-y-auto">
          {feedbackQuery.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-md" />
            ))
          ) : filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {(feedbackQuery.data?.length ?? 0) === 0
                ? 'No feedback items available.'
                : 'No matching feedback items.'}
            </p>
          ) : (
            filtered.map((fb) => (
              <label
                key={fb.id}
                className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-muted/50"
              >
                <Checkbox
                  checked={selected.includes(fb.id)}
                  onCheckedChange={() => toggleFeedback(fb.id)}
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {fb.readableId}
                    </span>
                    <Badge variant="secondary" className="text-[11px]">
                      {fb.feedbackType}
                    </Badge>
                  </div>
                  <p className="truncate text-sm">{fb.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {fb.body.slice(0, 80)}
                    {fb.body.length > 80 ? '\u2026' : ''}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {fb.isAnonymous
                      ? 'Anonymous'
                      : fb.submitterName ?? 'Unknown'}
                    {' \u00b7 '}
                    {format(
                      parseISO(
                        typeof fb.createdAt === 'string'
                          ? fb.createdAt
                          : (fb.createdAt as unknown as Date).toISOString(),
                      ),
                      'MMM d, yyyy',
                    )}
                  </p>
                </div>
              </label>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Discard
          </Button>
          <Button
            disabled={selected.length === 0 || linkMutation.isPending}
            onClick={handleLink}
          >
            Link {selected.length > 0 ? `(${selected.length})` : ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState } from 'react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

/**
 * VersionLinkPicker — Phase 27 Plan 05 (RESEARCH-08).
 *
 * Controlled dialog ({ open, onOpenChange } parent-owned) for bulk-linking
 * document_versions to a research item. No prior art in workshop-manage —
 * versions are fetched per-document via trpc.version.list inside a
 * DocumentVersionsGroup subcomponent so each group can run its own
 * useQuery without violating React hook ordering.
 *
 * Permission gate (per src/lib/permissions.ts version:read):
 *   admin/policy_lead/auditor/observer/research_lead/stakeholder
 * — covers the three privileged research roles that can mount the
 * picker (admin, policy_lead, research_lead).
 *
 * Uses Promise-based bulk-link with consolidated success / partial-
 * failure toast (UI-SPEC Copywriting Contract). Already-linked versions
 * are filtered out per group. Selection state resets on close.
 */

export interface VersionLinkPickerProps {
  researchItemId: string
  linkedVersionIds: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VersionLinkPicker({
  researchItemId,
  linkedVersionIds,
  open,
  onOpenChange,
}: VersionLinkPickerProps) {
  const [selected, setSelected] = useState<string[]>([])
  const utils = trpc.useUtils()

  const documentsQuery = trpc.document.list.useQuery(
    { includeSections: false },
    { enabled: open },
  )
  const linkMutation = trpc.research.linkVersion.useMutation()

  async function handleLink() {
    const targets = selected.filter((id) => !linkedVersionIds.includes(id))
    if (targets.length === 0) {
      setSelected([])
      onOpenChange(false)
      return
    }
    try {
      const results = await Promise.allSettled(
        targets.map((versionId) =>
          linkMutation.mutateAsync({ researchItemId, versionId }),
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
            ? 'Version linked.'
            : `${successes} versions linked.`,
        )
      } else {
        toast.error(
          `Linked ${successes} of ${results.length}. ${failures} failed — try again.`,
        )
      }
    } finally {
      setSelected([])
      onOpenChange(false)
    }
  }

  function toggleVersion(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link Versions to Research Item</DialogTitle>
        </DialogHeader>
        <div className="mt-4 flex max-h-[320px] flex-col gap-4 overflow-y-auto">
          {documentsQuery.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (documentsQuery.data ?? []).length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No documents available.
            </p>
          ) : (
            (documentsQuery.data ?? []).map((doc) => (
              <DocumentVersionsGroup
                key={doc.id}
                documentId={doc.id}
                documentTitle={doc.title}
                linkedVersionIds={linkedVersionIds}
                selected={selected}
                onToggle={toggleVersion}
                enabled={open}
              />
            ))
          )}
        </div>
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

interface DocumentVersionsGroupProps {
  documentId: string
  documentTitle: string
  linkedVersionIds: string[]
  selected: string[]
  onToggle: (id: string) => void
  enabled: boolean
}

function DocumentVersionsGroup({
  documentId,
  documentTitle,
  linkedVersionIds,
  selected,
  onToggle,
  enabled,
}: DocumentVersionsGroupProps) {
  const versionsQuery = trpc.version.list.useQuery(
    { documentId },
    { enabled },
  )
  const available = (versionsQuery.data ?? []).filter(
    (v) => !linkedVersionIds.includes(v.id),
  )
  if (versionsQuery.isLoading) return null
  if (available.length === 0) return null
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {documentTitle}
      </h4>
      {available.map((v) => (
        <label
          key={v.id}
          className="flex cursor-pointer items-center gap-3 rounded-md border p-2 hover:bg-muted/50"
        >
          <Checkbox
            checked={selected.includes(v.id)}
            onCheckedChange={() => onToggle(v.id)}
          />
          <span className="flex-1 font-mono text-sm">v{v.versionLabel}</span>
          {v.isPublished && (
            <Badge variant="secondary" className="text-[10px]">
              Published
            </Badge>
          )}
        </label>
      ))}
    </div>
  )
}

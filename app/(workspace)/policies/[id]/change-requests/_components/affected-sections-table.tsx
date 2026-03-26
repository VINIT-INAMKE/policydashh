'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Plus, Trash2 } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { toast } from 'sonner'
import type { CRStatus } from './cr-status-badge'
import { AddSectionDialog } from './add-section-dialog'

interface LinkedSection {
  id: string
  title: string
}

interface AffectedSectionsTableProps {
  crId: string
  crStatus: CRStatus
  linkedSections: LinkedSection[]
  documentId: string
  onSectionsChange: () => void
}

export function AffectedSectionsTable({
  crId,
  crStatus,
  linkedSections,
  documentId,
  onSectionsChange,
}: AffectedSectionsTableProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<LinkedSection | null>(null)

  const isDrafting = crStatus === 'drafting'

  const removeSectionMutation = trpc.changeRequest.removeSection.useMutation({
    onSuccess: () => {
      toast.success('Section removed.')
      setRemoveTarget(null)
      onSectionsChange()
    },
    onError: () => {
      toast.error("Couldn't update the change request. Your changes were not saved.")
    },
  })

  function handleRemoveConfirm() {
    if (!removeTarget) return
    removeSectionMutation.mutate({
      crId,
      sectionId: removeTarget.id,
    })
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Section Title</TableHead>
            <TableHead>Section ID</TableHead>
            {isDrafting && <TableHead className="w-[60px]">Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {linkedSections.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={isDrafting ? 3 : 2}
                className="text-center"
              >
                <p className="text-[14px] font-normal text-muted-foreground">
                  No sections linked yet.
                </p>
              </TableCell>
            </TableRow>
          ) : (
            linkedSections.map((section) => (
              <TableRow key={section.id}>
                <TableCell className="text-[14px] font-normal">
                  {section.title}
                </TableCell>
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger render={<span className="font-mono text-[12px] text-muted-foreground" />}>
                      {section.id.slice(0, 8)}
                    </TooltipTrigger>
                    <TooltipContent>{section.id}</TooltipContent>
                  </Tooltip>
                </TableCell>
                {isDrafting && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove section ${section.title} from change request`}
                      onClick={() => setRemoveTarget(section)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Add Section button - only in drafting state */}
      {isDrafting && (
        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="size-3.5" />
            Add Section
          </Button>
        </div>
      )}

      {/* Add Section Dialog */}
      <AddSectionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        crId={crId}
        documentId={documentId}
        existingSectionIds={linkedSections.map((s) => s.id)}
        onAdded={onSectionsChange}
      />

      {/* Remove Section Confirmation */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Section</AlertDialogTitle>
            <AlertDialogDescription>
              Remove &ldquo;{removeTarget?.title}&rdquo; from this change request?
              The section will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Section</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleRemoveConfirm}
              disabled={removeSectionMutation.isPending}
            >
              Remove Section
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

'use client'

import { trpc } from '@/src/trpc/client'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

interface PublicDraftToggleProps {
  documentId: string
  isPublicDraft: boolean
}

export function PublicDraftToggle({ documentId, isPublicDraft }: PublicDraftToggleProps) {
  const utils = trpc.useUtils()

  const setPublicDraftMutation = trpc.document.setPublicDraft.useMutation({
    onSuccess: () => {
      toast.success('Public draft flag updated')
      utils.document.getById.invalidate({ id: documentId })
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="space-y-0.5">
        <p className="text-sm font-semibold">Public Draft Consultation</p>
        <p className="text-xs text-muted-foreground">
          Make this document visible on the public /framework page.
        </p>
      </div>
      <Switch
        checked={isPublicDraft}
        onCheckedChange={(checked) =>
          setPublicDraftMutation.mutate({ id: documentId, isPublicDraft: checked })
        }
        disabled={setPublicDraftMutation.isPending}
      />
    </div>
  )
}

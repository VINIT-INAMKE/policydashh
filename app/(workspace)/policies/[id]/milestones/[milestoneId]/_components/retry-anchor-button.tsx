'use client'

import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { trpc } from '@/src/trpc/client'

interface RetryAnchorButtonProps {
  milestoneId: string
}

export function RetryAnchorButton({ milestoneId }: RetryAnchorButtonProps) {
  const utils = trpc.useUtils()
  const retryMutation = trpc.milestone.retryAnchor.useMutation({
    onSuccess: () => {
      toast.success('Anchor retry started')
      utils.milestone.getById.invalidate({ milestoneId })
    },
    onError: () => {
      toast.error('Failed to retry anchor')
    },
  })

  return (
    <Button
      variant="outline"
      onClick={() => retryMutation.mutate({ milestoneId })}
      disabled={retryMutation.isPending}
      className="min-h-[44px]"
    >
      {retryMutation.isPending ? (
        <>
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
          Retrying…
        </>
      ) : (
        <>
          <RefreshCw className="mr-2 size-4" aria-hidden="true" />
          Retry Anchor
        </>
      )}
    </Button>
  )
}

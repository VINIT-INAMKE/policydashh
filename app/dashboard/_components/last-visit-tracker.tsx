'use client'

import { useEffect } from 'react'
import { trpc } from '@/src/trpc/client'

/**
 * Client component that updates the user's lastVisitedAt timestamp on mount.
 * Renders nothing. Used by the dashboard server component to enable
 * "what changed since last visit" tracking (NOTIF-03).
 */
export function LastVisitTracker() {
  const mutation = trpc.user.updateLastVisited.useMutation()

  useEffect(() => {
    mutation.mutate()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
